ONERA WEBSITE — FIXED PROJECT

IMPORTANT: This website has a frontend AND a Node.js backend. Uploading index.html alone to Tiiny.site or another static HTML host will NOT make the login/API work. The backend must run on a Node.js host.

LOCAL WINDOWS TEST
1. Install Node.js LTS from https://nodejs.org
2. Extract this ONERA folder.
3. Open the ONERA folder in VS Code using File > Open Folder.
4. Choose Terminal > New Terminal.
5. Run: npm start
   (or: node server.js)
6. Keep the terminal running.
7. Open http://localhost:3000 — do not use Live Server port 5500 and do not open index.html directly.

DEFAULT DEMO ADMIN
Username: admin
Password: admin123
Change/remove this demo password before public use.

DEPLOY ONLINE
Deploy the entire ONERA folder/repository to a Node.js hosting service. Build command can be left blank; start command: npm start. The service must run server.js and serve index.html from the same origin. Do not deploy only index.html to Tiiny.site. If using a separate static frontend, its API URL must point to the deployed backend and the backend must allow that frontend origin.

DATABASE WARNING
This starter project uses db.json for demonstration. For 15,000–20,000 students and real school records, migrate to PostgreSQL and configure persistent storage/backups, strong admin credentials, secure document storage, and access controls before production. Do not store real student certificates in a public demo.

PAYMENTS
The current payment/subscribe actions are demonstrations only; they do not process real money.
