# AskMe Analytics Dashboard

An analytics dashboard for monitoring AskMe AI assistant (Jeff) usage and performance across Ramco ERP modules. Built with React + Vite. Data is sourced from production chat logs processed into a master Excel workbook.

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Current State](#current-state)
3. [Project Structure](#project-structure)
4. [Data Pipeline](#data-pipeline)
5. [Dashboard Pages](#dashboard-pages)
6. [Running Locally](#running-locally)
7. [Building for Production](#building-for-production)
8. [Processing New Logs](#processing-new-logs)
9. [Excluded Accounts](#excluded-accounts)
10. [Security — Current vs Required](#security--current-vs-required)
11. [Developer Tasks](#developer-tasks)

---

## What This Is

The AskMe Dashboard is a React + Vite web application that visualises how users interact with the AskMe chatbot (Jeff) inside Ramco ERP. It tracks:

- Total questions asked per user, module, and month
- Bot response quality (issues, KB gaps, system errors)
- Token usage and LLM step breakdown
- Active users and session trends
- Month-over-month comparisons

All data is loaded at runtime from a single Excel file (`AskQ_Master_Dashboard.xlsx`) served as a static asset. There is no backend API — everything runs client-side using SheetJS.

---

## Current State

| Area | Status |
|---|---|
| Dashboard UI | Live and working |
| Data pipeline (log parser) | Working — manual process |
| Deployment | Temporarily hosted on Vercel (personal account) |
| Security | Basic Auth (`admin` / `Quad@123`) — **temporary, must be replaced** |
| Admin button redirect | Points to production Vercel URL |
| Org repo / CI-CD integration | **Not done — developer action required** |
| Role-based admin access | **Not done — developer action required** |

---

## Project Structure

```
├── public/
│   └── AskQ_Master_Dashboard.xlsx   # Master data file — served as static asset
│
├── src/
│   ├── data/
│   │   └── dataLoader.js            # Loads Excel, computes all metrics and chart data
│   ├── pages/
│   │   ├── ExecutiveOverview.jsx
│   │   ├── IssueAnalysis.jsx
│   │   ├── UserActivity.jsx
│   │   ├── BotPerformance.jsx
│   │   ├── TokenUsage.jsx
│   │   └── Comparison.jsx
│   ├── components/
│   │   ├── KPICard.jsx
│   │   ├── ChartCard.jsx
│   │   ├── FilterPanel.jsx
│   │   ├── DrilldownModal.jsx
│   │   └── CustomTooltip.jsx
│   ├── App.jsx
│   └── main.jsx
│
├── scripts/
│   └── parseNewLogs.js              # Node.js log parser — processes raw Ramco logs
│
├── logs/                            # Drop new production log Excel files here
│   └── completed/                   # Processed logs are moved here automatically
│
├── .github/
│   └── workflows/
│       └── process-logs.yml         # GitHub Actions: auto-runs parser when log pushed
│
├── middleware.js                    # TEMPORARY — Vercel Basic Auth (replace with JWT)
├── vercel.json                      # Vercel-specific config — not needed outside Vercel
├── vite.config.js
└── package.json
```

---

## Data Pipeline

### How data flows

```
Ramco ERP chat logs (Excel)
        ↓
Drop file into logs/ folder
        ↓
npm run parse-logs
        ↓
Parser reads RawData sheet → transforms → deduplicates
        ↓
Appends rows to AskQ_Master_Dashboard.xlsx (5 sheets)
        ↓
Commit + push updated Excel
        ↓
Redeploy dashboard → data visible in UI
```

### Excel sheets updated by the parser

| Sheet | Description | Dedup Key |
|---|---|---|
| `AskQ_Cleaned` | One row per chat message (user + bot) | Session_ID + Sender_Type + Message |
| `AskQ_LLMSteps` | One row per LLM step per bot response | Session_ID + LLM_Step |
| `AskQ_TokenUsage` | Aggregated token counts per bot response | Session_ID |
| `AskQ_ResponseTime` | Response time in seconds per bot response | Session_ID |
| `PowerBI_Flat_Table` | Issue flags per bot response (KB gaps, errors, etc.) | Session_ID + Bot_Type |

### Issue flags in PowerBI_Flat_Table

| Column | Meaning |
|---|---|
| `Is_Issue` | 1 if any issue occurred in this session |
| `Is_System_Error` | 1 if the SQL/query execution failed (`query_exce_failed_status = true`) |
| `Is_KB_Gap` | 1 if the bot could not answer — **manually flagged by reviewing bot responses** |
| `Is_Placeholder_Data` | 1 if bot returned masked/placeholder data |
| `Is_Copilot_Loop` | 1 if bot went into a response loop |
| `Is_Context_Drop` | 1 if session context was lost mid-conversation |

> **Note:** `Is_KB_Gap` is not auto-detected. It must be manually identified by reviewing sessions where the bot responded with "information not available" or similar failure messages, then updated in the Excel.

---

## Dashboard Pages

| Page | Description |
|---|---|
| Executive Overview | Total questions, active users, feedback, bot distribution, modules |
| Issue Analysis | KB gaps, errors, issues by month / module / bot type |
| User Activity | Active users over time, questions per user, module/category breakdown |
| Bot Performance | Response times, bot type comparison, feedback by bot |
| Token Usage | Token consumption by month, module, and LLM step |
| Comparison | Month-over-month changes across all key metrics |

### Filters available

- **Month** — filter all data to one or more months
- **Bot Type** — filter by NLSQLAgent, Training Bot, etc.
- **Module** — filter by Ramco ERP module (Accounts Payable, Purchase, etc.)
- **Question Category** — Data Query, Process/How-To, Transactional, Unclassified

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Building for Production

```bash
npm install
npm run build
```

Output is in the `dist/` folder — a fully static site. Serve this folder from any web server (nginx, IIS, Apache, CDN). No server-side runtime is required.

> **Important:** `AskQ_Master_Dashboard.xlsx` is copied into `dist/` automatically during build (it lives in `public/`). Ensure your web server serves it with `Cache-Control: no-cache` so users always get the latest data after a redeploy.

---

## Processing New Logs

Production logs arrive as Excel files from the Ramco system. To process them:

```bash
# 1. Drop the log file into logs/
# 2. Run the parser
npm run parse-logs

# 3. Commit and push the updated Excel
git add public/AskQ_Master_Dashboard.xlsx
git commit -m "Add prod logs YYYY-MM-DD"
git push
```

The parser will:
- Read the `RawData` sheet from each log file in `logs/`
- Skip rows from excluded test accounts (see below)
- Append new rows to all five sheets in the master Excel (deduplicating existing data)
- Move processed files to `logs/completed/`
- Print a summary of rows added per sheet

This can be automated in the org's CI/CD pipeline. A reference GitHub Actions workflow is available at `.github/workflows/process-logs.yml`.

---

## Excluded Accounts

The following user accounts are excluded from both parsing and dashboard display as they are internal test or debug accounts:

| Account | Reason |
|---|---|
| `QUADDEBUG` | Internal debug/testing account |

To add more exclusions, update the `EXCLUDED_USERS` set in:
- `scripts/parseNewLogs.js` (line ~155) — excludes from future log parsing
- `src/data/dataLoader.js` (line ~160) — filters from dashboard display

---

## Security — Current vs Required

### Current (Temporary)

Basic Auth is enforced via `middleware.js` (Vercel Edge Middleware):

- **Username:** `admin`
- **Password:** `Quad@123`
- Anyone with these credentials can access the dashboard

This is a **temporary measure** for the initial client demo. It must be replaced before production rollout.

> `middleware.js` is Vercel-specific and will not work on other hosting platforms. Remove it or re-implement Basic Auth at the web server / proxy level if deploying elsewhere.

### Required (Developer to Implement)

The Admin button in the AskMe chatbot should redirect to the dashboard only for authorised users. The recommended approach:

**1. Add `is_admin` column to the users table:**
```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
```

**2. Update chatbot logic:**
- If the logged-in user has `is_admin = true`, show the Admin button
- On click, generate a short-lived JWT (1 hour expiry) signed with a shared secret
- Redirect to: `https://<dashboard-url>?token=<JWT>`

**3. Dashboard validates the token:**
- Edge Middleware (or equivalent) checks the JWT on every request
- Valid token → allow access, set session cookie, strip token from URL
- Invalid / expired token → return 401 / redirect to unauthorised page

**Shared secret** must be stored as an environment variable on both the chatbot server and the dashboard host — never hardcoded in code.

---

## Live DB Integration (replacing Excel)

The dashboard supports two data modes:

### Mode 1 — Excel (current, temporary)
Dashboard loads `AskQ_Master_Dashboard.xlsx` at runtime. Requires manual log processing.

### Mode 2 — Live API (target)
Dashboard fetches data directly from `rerp-reporting-app` via a REST API. No Excel, no manual steps — always live data.

**What's already built:**

| File | What it does |
|---|---|
| `rerp-reporting-app/analytics/utils/dashboard_builder.py` | Python port of the log parser — transforms raw DB messages into dashboard-ready data |
| `rerp-reporting-app/analytics/views/analytics_views.py` | `DashboardDataView` — new endpoint `GET /analytics/dashboard-data` |
| `rerp-reporting-app/analytics/urls.py` | Route registered |
| `src/data/dataLoader.js` | Updated to call API when `VITE_API_URL` is set, falls back to Excel otherwise |
| `.env.example` | Environment variable reference |

**To activate live DB mode:**

1. Deploy `rerp-reporting-app` with the new endpoint
2. Set `DASHBOARD_API_KEY` env var on the Django server
3. Set these env vars when building the dashboard:
   ```
   VITE_API_URL=https://your-django-app.com
   VITE_API_KEY=your-secret-api-key
   ```
4. Run `npm run build` — the dashboard will now fetch live data

**API endpoint:**
```
GET /analytics/dashboard-data
Headers: X-Api-Key: <DASHBOARD_API_KEY>
Query params (optional):
  from_date=YYYY-MM-DD
  to_date=YYYY-MM-DD
```

**CORS:** The Django app must allow requests from the dashboard domain. Add the dashboard URL to `CORS_ALLOWED_ORIGINS` in Django settings (requires `django-cors-headers`).

---

## Developer Tasks

### P0 — Before Go-Live

- [ ] **Migrate to org repo** — move codebase to the organisation's Git repository
- [ ] **Set up CI/CD** — configure the org's deployment pipeline to run `npm run build` and serve the `dist/` folder
- [ ] **Remove Vercel-specific files** — `middleware.js` and `vercel.json` are not needed outside Vercel
- [ ] **Implement Basic Auth at web server level** — until JWT is ready, protect the dashboard at nginx / IIS / proxy level
- [ ] **Add `django-cors-headers`** to `rerp-reporting-app` and allow the dashboard domain
- [ ] **Deploy `DashboardDataView`** — the new endpoint is already written, just needs deploying
- [ ] **Set env vars** — `DASHBOARD_API_KEY` on Django server, `VITE_API_URL` + `VITE_API_KEY` at dashboard build time

### P1 — Admin Access Control

- [ ] **Add `user_is_admin` column** to `cwms_users` table:
  ```sql
  ALTER TABLE cwms_users ADD COLUMN user_is_admin BIT DEFAULT 0;
  ```
- [ ] **Add Django model field** in `analytics/models/user_models.py`:
  ```python
  is_admin = models.BooleanField(default=False, db_column="user_is_admin")
  ```
- [ ] **Flag admin users** — set `user_is_admin = 1` for users who should access the dashboard
- [ ] **Update Admin button in chatbot** — only show to users where `is_admin = True`
- [ ] **Implement JWT generation** — generate a short-lived signed JWT on Admin button click, redirect to `https://<dashboard-url>?token=<JWT>`
- [ ] **Implement JWT validation** — validate token in dashboard middleware before serving content
- [ ] **Remove Basic Auth** once JWT is in place

### P2 — Automation & Quality

- [ ] **Retire manual log pipeline** — once Live DB mode is active, `scripts/parseNewLogs.js` and `AskQ_Master_Dashboard.xlsx` are no longer needed
- [ ] **Auto-detect KB gaps** — the `DashboardDataView` currently sets `Is_KB_Gap = 0` for all rows; add logic to detect "no answer" bot responses (e.g. `message_status_code != 200` or specific response phrases) and set `Is_KB_Gap = 1` automatically

### Reference

| Item | Value |
|---|---|
| Current deployment | Vercel (temporary) |
| Production dashboard URL | `https://askme-dashboard-bice.vercel.app` |
| Django app | `rerp-reporting-app` |
| New API endpoint | `GET /analytics/dashboard-data` |
| DB tables used | `cwms_chat_messages`, `cwms_users`, `cwms_bot_message_attributes`, `cwms_human_message_attributes`, `cma_chat_message_feedbacks` |
| Build command | `npm run build` |
| Build output | `dist/` |
| Node version | 20+ |
