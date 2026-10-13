# MSquare Care Solutions — Website + Insurance CRM

Public website (services, AI document analyzer, chatbot, WhatsApp, quote form) plus a full
insurance CRM for the team and a self-service portal for customers.

## What's where

| URL | Who | What |
|---|---|---|
| `/` | Public | Marketing site; the quote form creates a lead in the CRM |
| `/my-policy` | Customers | Look up a policy with mobile + policy number, see renewal date & claims, request renewal / claim / correction / callback |
| `/crm` | Staff | Insurance CRM (login required) |

### CRM modules
- **Dashboard** – active premium, commission, renewals due/overdue, open claims, tasks, lead conversion, premium-by-month chart, pipeline.
- **Leads** – kanban board + list across `new → contacted → quoted → negotiation → won / lost`; assign owners, follow-up dates, activity timeline, one-click WhatsApp/call, **convert to customer**.
- **Customers** – 360° view: policies, claims, tasks and the full activity timeline.
- **Policies** – health, motor, term/life, general…; premium, sum insured, commission %, vehicle no., members, nominee.
- **Renewals** – policies expiring in 15/30/60/90 days, WhatsApp reminder with pre-filled message, one-click **renew** (creates the next term and closes the old one), auto-create renewal follow-up tasks.
- **Claims** – intimation → documents → submitted → review → approved/settled/rejected, with status history.
- **Tasks** – overdue / today / upcoming follow-ups per user.
- **Settings** – team users (admin / agent roles), password change, Google Sheets sync & email alerts, CSV exports.

## Running

Backend (FastAPI + MongoDB), from `backend/`:
```
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```
Frontend (React), from `frontend/`: `yarn install && yarn start` (set `REACT_APP_BACKEND_URL`).

### First login
On first start the backend creates an admin user if none exists:
- email: `CRM_ADMIN_EMAIL` (falls back to `COMPANY_EMAIL`, then `admin@msquarecare.com`)
- password: `CRM_ADMIN_PASSWORD` (falls back to `ADMIN_PASSCODE`)

Change the password after first login (Settings). Also set a strong `JWT_SECRET` in `backend/.env`.

### Demo data
`cd backend && python seed_demo.py` fills an empty database with sample leads, customers, policies and claims
(adds agent `agent@msquarecare.com` / `agent123`). `--wipe` resets CRM data first — never run that on production.

### Tests
`cd backend && python -m pytest tests/test_crm.py -n 0` — runs against an in-memory MongoDB, no server needed.
