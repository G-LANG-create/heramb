// School Platform backend — run: node server.js  (Node 16+, no npm install needed)
const http = require('http'), fs = require('fs'), crypto = require('crypto'), path = require('path');
const DB = path.join(__dirname, 'db.json');
let db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) : { u: [], s: [], n: [], r: [], d: [], f: [], p: [] };
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));
const id = () => crypto.randomBytes(5).toString('hex');
const hash = (p, s) => crypto.scryptSync(String(p), s, 32).toString('hex');
const mk = (o, p) => { const salt = id(); return { id: id(), ...o, salt, h: hash(p, salt) }; };
const E = (c, m) => { throw { c, m }; };
const sess = {};
const SUB_DAYS = 30, SUB_PRICE = 199;

if (!db.u.length) { db.u.push(mk({ role: 'admin', name: 'Super Admin', username: 'admin' }, 'admin123')); save(); }

const pub = x => ({ id: x.id, role: x.role, name: x.name, username: x.username, schoolId: x.schoolId, cls: x.cls, sub: x.sub });

function handle(m, p, q, b, u) {
  const k = m + ' ' + p, sid = u && u.schoolId;
  const need = (...r) => { if (!u) E(401, 'Please login first'); if (r.length && !r.includes(u.role)) E(403, 'Not allowed'); };
  const mine = sId => { const s = db.u.find(v => v.id === sId && v.schoolId === sid && v.role === 'student'); if (!s) E(400, 'Student not found in your school'); return s; };
  const nameOf = x => (db.u.find(v => v.id === x.studentId) || {}).name;

  // ---- public ----
  if (k === 'GET schools') { const s = (q.get('q') || '').toLowerCase(); return db.s.filter(x => (x.name + ' ' + x.city + ' ' + x.type).toLowerCase().includes(s)); }
  if (k === 'POST login') {
    const x = db.u.find(v => v.username === b.username);
    if (!x || hash(b.password || '', x.salt) !== x.h) E(401, 'Wrong username or password');
    const t = id() + id(); sess[t] = x.id; return { token: t, user: pub(x) };
  }
  if (k === 'GET me') { need(); return pub(u); }

  // ---- main admin: add schools / colleges ----
  if (k === 'POST schools') {
    need('admin');
    if (!b.name || !b.username || !b.password) E(400, 'Fill all fields');
    if (db.u.some(v => v.username === b.username)) E(400, 'Username already taken');
    const s = { id: id(), name: b.name, type: b.type, city: b.city }; db.s.push(s);
    db.u.push(mk({ role: 'school', name: b.name + ' (Admin)', username: b.username, schoolId: s.id }, b.password));
    save(); return s;
  }

  // ---- school admin: teachers & students ----
  if (k === 'POST users') {
    need('school');
    if (!['teacher', 'student'].includes(b.role)) E(400, 'Invalid role');
    if (db.u.some(v => v.username === b.username)) E(400, 'Username already taken');
    const c = +b.cls; if (b.role === 'student' && !(c >= 1 && c <= 10)) E(400, 'Class must be 1-10');
    db.u.push(mk({ role: b.role, name: b.name, username: b.username, schoolId: sid, cls: b.role === 'student' ? c : null }, b.password));
    save(); return { ok: 1 };
  }
  if (k === 'GET users') { need('school', 'teacher'); return db.u.filter(v => v.schoolId === sid && (v.role === 'student' || v.role === 'teacher')).map(pub); }

  // ---- notes (paid) ----
  if (k === 'POST notes') {
    need('teacher'); const c = +b.cls; if (!(c >= 1 && c <= 10)) E(400, 'Class must be 1-10');
    db.n.push({ id: id(), schoolId: sid, cls: c, title: b.title, content: b.content, by: u.name, at: Date.now() }); save(); return { ok: 1 };
  }
  if (k === 'GET notes') {
    need('teacher', 'student', 'school');
    if (u.role === 'student') {
      const ok = (u.sub || 0) > Date.now();
      return { subscribed: ok, price: SUB_PRICE, items: db.n.filter(x => x.schoolId === sid && x.cls === u.cls).map(x => ({ ...x, content: ok ? x.content : null })) };
    }
    return { items: db.n.filter(x => x.schoolId === sid) };
  }
  if (k === 'POST subscribe') { need('student'); u.sub = Math.max(u.sub || 0, Date.now()) + SUB_DAYS * 864e5; save(); return pub(u); } // demo: plug a payment gateway here

  // ---- results ----
  if (k === 'POST results') {
    need('school', 'teacher'); mine(b.studentId);
    db.r.push({ id: id(), schoolId: sid, studentId: b.studentId, exam: b.exam, subject: b.subject, marks: +b.marks, total: +b.total }); save(); return { ok: 1 };
  }
  if (k === 'GET results') {
    need('school', 'teacher', 'student');
    return (u.role === 'student' ? db.r.filter(x => x.studentId === u.id) : db.r.filter(x => x.schoolId === sid)).map(x => ({ ...x, student: nameOf(x) }));
  }

  // ---- student documents (govt IDs etc.) ----
  if (k === 'POST docs') {
    need('school'); mine(b.studentId);
    if (!b.type || !b.photoData) E(400, 'Choose a document type and upload a photo');
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.photoData);
    if (!match) E(400, 'Photo must be JPG, PNG or WebP');
    if (Buffer.from(match[2], 'base64').length > 3 * 1024 * 1024) E(400, 'Photo must be 3 MB or smaller');
    db.d.push({ id: id(), schoolId: sid, studentId: b.studentId, type: b.type, photoData: b.photoData });
    save(); return { ok: 1 };
  }
  if (k === 'GET docs') {
    need('school', 'student');
    return (u.role === 'student' ? db.d.filter(x => x.studentId === u.id) : db.d.filter(x => x.schoolId === sid)).map(x => ({ ...x, student: nameOf(x) }));
  }

  // ---- fees / payments ----
  if (k === 'POST fees') { need('school'); db.f.push({ id: id(), schoolId: sid, title: b.title, amount: +b.amount, dueDate: b.dueDate }); save(); return { ok: 1 }; }
  if (k === 'GET fees') {
    need('school', 'student');
    return db.f.filter(x => x.schoolId === sid).map(x => u.role === 'student' ? { ...x, paid: db.p.some(y => y.s === u.id && y.f === x.id) } : { ...x, paidCount: db.p.filter(y => y.f === x.id).length });
  }
  if (k === 'POST pay') {
    need('student'); const f = db.f.find(x => x.id === b.feeId && x.schoolId === sid); if (!f) E(404, 'Fee not found');
    if (!db.p.some(y => y.s === u.id && y.f === f.id)) { db.p.push({ s: u.id, f: f.id, at: Date.now() }); save(); } return { ok: 1 };
  }
  E(404, 'Not found');
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'); let body = '';
  req.on('data', d => {
    body += d;
    if (body.length > 5 * 1024 * 1024) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Request too large. Choose an image under 3 MB.' })); req.destroy(); }
  });
  req.on('end', () => {
    if (!url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(__dirname, 'index.html'))); }
    const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    try {
      const u = db.u.find(x => x.id === sess[req.headers.authorization]);
      send(200, handle(req.method, url.pathname.slice(5), url.searchParams, body ? JSON.parse(body) : {}, u));
    } catch (e) { send(e.c || 400, { error: e.m || e.message }); }
  });
}).listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:' + (process.env.PORT || 3000) + '  (admin / admin123)'));
