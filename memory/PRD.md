# MSquare Care Solutions — Product Requirements Document

## Original Problem Statement
"Build me website analysing uploaded image need chatbot and whatsapp and google form also backend information store in mcaresquare@gmail.com sheets add general and term insurance also."

Brand: MSquare Care Solutions — insurance & business consultancy, Trichy, Tamil Nadu.
Tagline: "One Square. Every Solution." Consultant: Marimuthu R. Phone 8072571879, Email msquarecare@gmail.com.

## Architecture
- Frontend: React 19 + Tailwind + Shadcn UI + Framer Motion + Lenis + Phosphor icons.
- Backend: FastAPI + MongoDB (Motor). All routes under /api.
- AI: Gemini 3.1 Pro (`gemini-3.1-pro-preview`) via emergentintegrations + EMERGENT_LLM_KEY (chat streaming + image vision analysis).
- Brand palette: Navy #1a2f6b + Green #3aa935 on white.

## User Personas
- Prospective customer seeking insurance/loan/business help — browses services, requests a quote, chats with AI, uploads a document to understand it.
- Admin (Marimuthu / staff) — views captured leads, exports CSV.

## Core Requirements (static)
1. AI image/document analyzer (upload → plain-language explanation).
2. AI chatbot assistant (floating, streaming).
3. WhatsApp click-to-chat (918072571879).
4. Lead capture form (replaces Google Form) + backend storage.
5. Services incl. Health, Motor, General, Term/Life, Business, Loans, AI Automations.

## Implemented (2026-08-22)
- Landing page: Hero, Services grid (7 incl. General + Term/Life), AI Document Analyzer (scanning animation + markdown result), About, Contact/Quote form, dark footer.
- Floating WhatsApp button + floating AI chat widget (streaming Gemini replies).
- Backend endpoints: /api/config, /api/leads (create), /api/admin/leads (auth), /api/admin/leads/export (CSV), /api/analyze-image (Gemini vision), /api/chat (streaming).
- Admin panel at /admin (passcode `msquare2026`): searchable leads table + CSV export.
- Verified: testing agent 100% backend + 100% frontend pass.

## Backlog / Remaining
- P1: Google Sheets sync to mcaresquare@gmail.com (needs service-account JSON credentials from owner).
- P1: Full WhatsApp Business API (needs paid API + verification) — currently click-to-chat.
- P2: Lead status editing UI in admin; rate-limiting on public endpoints.
- P2: Email/WhatsApp notification to admin on new lead.

## Notes / Mocked
- Google Sheets storage is NOT yet wired — leads live in MongoDB + admin panel + CSV export until owner provides Google service-account credentials.

## Insurance CRM (2026-10-13)
- Backend `backend/crm.py` (routers `/api/crm/*` with JWT auth, `/api/portal/*` public). Users with admin/agent roles; bootstrap admin from env.
- Entities: leads (pipeline stages, owner, follow-up, expected premium), customers, policies (commission, renewal), claims (status history), tasks, activities timeline.
- Frontend `/crm` (dashboard, leads kanban, customers 360, policies, renewals, claims, tasks, settings) and `/my-policy` customer portal. `/admin` redirects to `/crm`.
- Legacy `/api/admin/*` passcode endpoints still work; integrations endpoints accept the passcode or an admin bearer token.
- Tests: `backend/tests/test_crm.py` (mongomock). Demo data: `backend/seed_demo.py`.
