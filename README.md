# AskMe Analytics Dashboard

A single-file analytics dashboard for monitoring AskMe AI assistant performance and usage across Ramco ERP modules.

---

## How it works

The dashboard is a single HTML file (`AskMe_Dashboard.html`) that loads an Excel workbook and renders all charts and KPIs in the browser — no server required. All logic (data parsing, filtering, charting) runs client-side using React, Recharts, and SheetJS loaded from CDN.

A GitHub Actions workflow (`process-logs.yml`) automatically processes incoming production log files and updates the master Excel workbook.

---

## Project structure

```
AskMe_Dashboard.html          # The dashboard — open this in a browser
AskMe_Dashboard_Data.xlsx     # Master data workbook (5 sheets, see below)
scripts/
  parseNewLogs.js             # Node.js log parser — run via `npm run parse-logs`
logs/                         # Drop new production log Excel files here
logs/completed/               # Processed logs are moved here automatically
.github/
  workflows/
    process-logs.yml          # GitHub Actions: auto-processes logs on push
```

---

## Excel workbook sheets

The dashboard reads `AskMe_Dashboard_Data.xlsx` which must contain these five sheets:

| Sheet | Description |
|---|---|
| `AskQ_Cleaned` | One row per chat message (user + bot) |
| `AskQ_LLMSteps` | One row per LLM step per bot response |
| `AskQ_TokenUsage` | Aggregated token counts per bot response |
| `AskQ_ResponseTime` | Response time in seconds per bot response |
| `PowerBI_Flat_Table` | Issue flags per bot response |

---

## Running the dashboard

1. Place `AskMe_Dashboard.html` and `AskMe_Dashboard_Data.xlsx` in the same folder.
2. Open `AskMe_Dashboard.html` in a browser.
3. The dashboard auto-loads the Excel file on startup. If it can't find it, use the file picker.

> **Note:** Due to browser security restrictions, open via a local web server (e.g. VS Code Live Server) rather than double-clicking the file directly — `fetch()` is blocked on `file://` in most browsers.

---

## Processing new production logs

New logs from the dev team arrive as Excel files. To process them:

**Automatically (GitHub Actions):**
- Drop the log file into the `logs/` folder and push to `main`.
- The workflow runs `npm run parse-logs`, appends new rows to the master workbook, and commits the updated file.

**Manually:**
```bash
npm install
# drop log file(s) into logs/
npm run parse-logs
# then commit public/AskQ_Master_Dashboard.xlsx
```

The parser:
- Reads the `RawData` sheet from each log file
- Appends new rows to all five sheets (deduplicates by session ID)
- Moves processed files to `logs/completed/`

---

## Dashboard pages

| Page | What it shows |
|---|---|
| Executive Overview | Total questions, users, likes/dislikes, bot distribution, questions by module |
| Issue Analysis | KB gaps, system errors, masked data, copilot loops by month and bot type |
| User Activity | Active users, sessions, questions vs sessions trend |
| Bot Performance | Response times by month and bot type, responses by bot type over time |
| Token Usage | Total tokens by month, module, and LLM step |

Use **⚙ Manage Pages** in the header to show or hide specific pages — useful for customer presentations. Settings are saved in the browser.

---

## Dependencies (CDN — no build step needed)

| Library | Version | Purpose |
|---|---|---|
| React | 18 | UI rendering |
| Recharts | 2.10.3 | Charts |
| SheetJS (xlsx) | 0.18.5 | Excel parsing |
| Babel Standalone | latest | JSX transpilation in browser |

> The dashboard uses Babel Standalone to compile JSX at runtime — this is intentional to avoid a build step. For a production deployment with high traffic, consider pre-compiling with Vite.
