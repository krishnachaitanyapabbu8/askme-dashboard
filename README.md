
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

## Target Architecture — Live DB with Persistent Analytics Tables

The Excel-based pipeline is a temporary solution. The proper long-term architecture stores parsed analytics data in dedicated DB tables and serves it via a REST API. This eliminates the manual log processing workflow entirely.

### Three-phase data flow

```
PHASE 1 — Current (temporary)
─────────────────────────────
Ramco logs Excel
    → parseNewLogs.js (manual)
    → AskQ_Master_Dashboard.xlsx
    → Dashboard reads Excel

PHASE 2 — Intermediate (API without persistent tables)
───────────────────────────────────────────────────────
cwms_chat_messages (production DB)
    → GET /analytics/dashboard-data (Django API)
    → dashboard_builder.py processes ALL messages on every request
    → Dashboard reads from API
    ⚠ Slow at scale — reprocesses everything on every page load

PHASE 3 — Target (persistent analytics tables)
───────────────────────────────────────────────
cwms_chat_messages (production DB)
    → Scheduled Django job (daily/hourly) processes only NEW messages
    → Saves processed data to dedicated analytics tables
    → GET /analytics/dashboard-data reads from analytics tables (fast)
    → Dashboard reads from API
    ✅ Fast, live, no manual steps, scalable
```

---

### Analytics tables to create (Phase 3)

These mirror the 5 Excel sheets but as proper DB tables, populated incrementally by a scheduled job:

```sql
-- Equivalent of AskQ_Cleaned
CREATE TABLE analytics_cleaned (
    id              BIGINT PRIMARY KEY IDENTITY,
    session_id      VARCHAR(36) NOT NULL,
    date            DATE,
    month           VARCHAR(10),           -- e.g. 'Jun-2026'
    sender_type     VARCHAR(10),           -- 'Human' or 'bot'
    user_name       VARCHAR(512),
    bot_type        VARCHAR(50),
    message         NVARCHAR(MAX),
    question_category VARCHAR(50),
    feedback        VARCHAR(10),           -- 'LIKE', 'DISLIKE', or NULL
    is_user_question BIT DEFAULT 0,
    is_system_error  BIT DEFAULT 0,
    is_issue         BIT DEFAULT 0,
    source_date     DATE                   -- date this row was processed
);

-- Equivalent of PowerBI_Flat_Table
CREATE TABLE analytics_flat_table (
    id              BIGINT PRIMARY KEY IDENTITY,
    session_id      VARCHAR(36) NOT NULL,
    month           VARCHAR(10),
    module          VARCHAR(255),
    bot_type        VARCHAR(50),
    is_issue        BIT DEFAULT 0,
    is_system_error BIT DEFAULT 0,
    is_kb_gap       BIT DEFAULT 0,        -- set automatically (see below)
    is_placeholder  BIT DEFAULT 0,
    is_copilot_loop BIT DEFAULT 0,
    is_context_drop BIT DEFAULT 0,
    source_date     DATE
);

-- Equivalent of AskQ_TokenUsage
CREATE TABLE analytics_token_usage (
    id              BIGINT PRIMARY KEY IDENTITY,
    session_id      VARCHAR(36) NOT NULL,
    month           VARCHAR(10),
    module          VARCHAR(255),
    bot_type        VARCHAR(50),
    prompt_tokens   INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens    INT DEFAULT 0,
    source_date     DATE
);

-- Equivalent of AskQ_LLMSteps
CREATE TABLE analytics_llm_steps (
    id              BIGINT PRIMARY KEY IDENTITY,
    session_id      VARCHAR(36) NOT NULL,
    month           VARCHAR(10),
    module          VARCHAR(255),
    bot_type        VARCHAR(50),
    llm_step        VARCHAR(100),
    prompt_tokens   INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_tokens    INT DEFAULT 0,
    source_date     DATE
);

-- Equivalent of AskQ_ResponseTime
CREATE TABLE analytics_response_times (
    id              BIGINT PRIMARY KEY IDENTITY,
    session_id      VARCHAR(36) NOT NULL,
    month           VARCHAR(10),
    bot_type        VARCHAR(50),
    response_time_seconds DECIMAL(8,1),
    source_date     DATE
);
```

---

### Scheduled processing job

A Django management command (or Celery task) runs daily/hourly and processes only new messages since the last run:

```python
# analytics/management/commands/process_analytics.py

class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        last_processed = AnalyticsCheckpoint.get_last_date()  # track what's been processed
        new_messages = ChatMessage.objects.filter(
            chat_message_created_at__gt=last_processed
        ).select_related(...)

        rows = [format_chat_message(m) for m in new_messages]
        data = build_dashboard_data(rows)   # reuse existing dashboard_builder.py

        # Save to analytics tables (bulk insert, deduplicate by session_id)
        AnalyticsCleaned.objects.bulk_create(data['cleaned'], ignore_conflicts=True)
        AnalyticsFlatTable.objects.bulk_create(data['flat_table'], ignore_conflicts=True)
        # ... same for token_usage, llm_steps, response_times

        AnalyticsCheckpoint.update(timezone.now())
```

---

### Auto-detecting KB Gaps

The `Is_KB_Gap` flag should be set automatically — not manually. Detection logic using existing DB fields:

```python
# In dashboard_builder.py — auto-detect KB gaps from bot message attributes
def is_kb_gap(bot_message_attribute):
    # Method 1: message_status_code indicates failure
    if bot_message_attribute.message_status_code != 200:
        return True
    # Method 2: response text contains known failure phrases
    text = (bot_message_attribute.response_text or '').lower()
    failure_phrases = [
        "information isn't available",
        "looks like that information",
        "i don't have",
        "unable to find",
        "no specific steps provided",
    ]
    return any(phrase in text for phrase in failure_phrases)
```

---

### Updated API endpoint (Phase 3)

Once analytics tables exist, the API reads from them instead of reprocessing raw messages:

```python
# Much faster — reads pre-computed analytics tables
class DashboardDataView(APIView):
    def get(self, request):
        cleaned    = AnalyticsCleaned.objects.all().values()
        flat_table = AnalyticsFlatTable.objects.all().values()
        token_usage = AnalyticsTokenUsage.objects.all().values()
        # ... return as JSON
```

**To activate:**

1. Create analytics tables (SQL above)
2. Run the processing job once to backfill historical data
3. Schedule it to run daily (cron / Celery beat)
4. Update `DashboardDataView` to read from analytics tables
5. Set `VITE_API_URL` in dashboard build

**API endpoint (already built, no changes needed on dashboard side):**
```
GET /analytics/dashboard-data
Headers: X-Api-Key: <DASHBOARD_API_KEY>
```

**CORS:** Add dashboard URL to `CORS_ALLOWED_ORIGINS` in Django settings (requires `django-cors-headers`).

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

### P2 — Persistent Analytics Tables (Target Architecture)

This is the most important long-term task. Replaces both the Excel pipeline and the slow on-the-fly API.

- [ ] **Create 5 analytics tables** in the production DB — `analytics_cleaned`, `analytics_flat_table`, `analytics_token_usage`, `analytics_llm_steps`, `analytics_response_times` (SQL schema in [Target Architecture](#target-architecture--live-db-with-persistent-analytics-tables) section above)
- [ ] **Create Django models** for each analytics table (`managed = True` so migrations work)
- [ ] **Build processing management command** — `process_analytics.py` that uses `dashboard_builder.py` to process new messages and bulk-insert into analytics tables. Tracks last-processed timestamp via a checkpoint table.
- [ ] **Backfill historical data** — run the command once to populate analytics tables from all existing `cwms_chat_messages`
- [ ] **Schedule the job** — run daily (or hourly) via cron / Celery beat / Azure DevOps scheduled pipeline
- [ ] **Update `DashboardDataView`** to read from analytics tables instead of processing raw `cwms_chat_messages` on every request
- [ ] **Auto-detect KB gaps** — in `dashboard_builder.py`, set `Is_KB_Gap = 1` automatically using `message_status_code` or known failure phrases in bot response text (see detection logic in Target Architecture section)
- [ ] **Retire manual log pipeline** — once analytics tables are live, `scripts/parseNewLogs.js` and `AskQ_Master_Dashboard.xlsx` are no longer needed

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
