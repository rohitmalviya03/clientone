# Lab Home Collection Website (React + Node + MySQL)

This project is a diagnostic lab website focused on **patient home sample collection**.

## Stack

- Frontend: React (browser-based, no build step)
- Backend: Node.js (`server.js`)
- Database: MySQL (`database/schema.sql`)

## APIs (Node)

- `GET /api/health`
- `GET /api/tests`
- `GET /api/packages`
- `GET /api/services`
- `POST /api/bookings`
- `GET /api/bookings`
- `POST /api/service-requests`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/bookings` (auth required)
- `GET /api/admin/packages` (auth required)
- `POST /api/admin/packages` (auth required)
- `PUT /api/admin/packages/:id` (auth required)
- `GET /api/admin/tests` (auth required)
- `POST /api/admin/tests` (auth required)
- `PUT /api/admin/tests/:id` (auth required)
- `PATCH /api/admin/tests/:id/status` (auth required)
- `PATCH /api/admin/packages/:id/status` (auth required)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create DB schema in MySQL:

`database/schema.sql`

3. Start Node server:

```bash
npm start
```

4. Open:

`http://127.0.0.1:3000`

Lab admin login page:

`http://127.0.0.1:3000/lab-login.html`

## Environment variables (optional)

- `PORT` (default: `3000`)
- `DB_HOST` (default: `127.0.0.1`)
- `DB_PORT` (default: `3306`)
- `DB_USER` (default: `root`)
- `DB_PASS` (default: empty)
- `DB_NAME` (default: `lab_portal`)
- `ADMIN_USER` (default: `labadmin`)
- `ADMIN_PASS` (default: `admin123`)

## Project structure

```text
frontend/
  index.html
  app.js
  styles.css
database/
  schema.sql
server.js
package.json
```
