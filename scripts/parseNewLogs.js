/**
 * Log Parser — appends new CSV data into AskQ_Master_Dashboard.xlsx
 *
 * Usage:
 *   npm run parse-logs
 *
 * Drop one or more CSV files into the logs/ folder. Each file is auto-detected
 * to the correct sheet based on its column headers, deduplicated against existing
 * rows, and appended. The Excel file in public/ is updated in place.
 *
 * After running: git add public/AskQ_Master_Dashboard.xlsx && git push
 * Vercel will redeploy automatically with the new data.
 */

import * as XLSX from 'xlsx';
import { readdirSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EXCEL_PATH  = join(ROOT, 'public', 'AskQ_Master_Dashboard.xlsx');
const LOGS_FOLDER = join(ROOT, 'logs');

// ── Sheet detection ────────────────────────────────────────────────────────────
// Columns that uniquely identify which sheet a CSV belongs to.
// Order matters: more specific signatures first.

const SHEET_SIGNATURES = {
  PowerBI_Flat_Table:  ['Is_Issue', 'Is_KB_Gap', 'Module', 'Session_ID'],
  AskQ_TokenUsage:     ['Total_Tokens', 'Prompt_Tokens', 'Completion_Tokens', 'Module_Clean'],
  AskQ_LLMSteps:       ['LLM_Step', 'Total_Tokens', 'Session_ID'],
  AskQ_ResponseTime:   ['Response_Time_Seconds', 'Bot_Type', 'Session_ID'],
  AskQ_Cleaned:        ['Session_ID', 'Sender_Type', 'Is_User_Question_Flag'],
};

// ── Deduplication keys ─────────────────────────────────────────────────────────
// Columns whose combined values uniquely identify a row in each sheet.

const DEDUP_KEYS = {
  AskQ_Cleaned:       ['Session_ID', 'Sender_Type', 'Message'],
  PowerBI_Flat_Table: ['Session_ID', 'Is_Issue', 'Is_KB_Gap', 'Is_System_Error'],
  AskQ_ResponseTime:  ['Session_ID', 'Bot_Type', 'Response_Time_Seconds'],
  AskQ_TokenUsage:    ['Session_ID', 'LLM_Step', 'Total_Tokens'],
  AskQ_LLMSteps:      ['Session_ID', 'LLM_Step', 'Total_Tokens'],
};

// ── Month normaliser ───────────────────────────────────────────────────────────
// Converts any date/month value to the dashboard format: "Feb-2026"

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function normalizeMonth(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^[A-Za-z]{3}-\d{4}$/.test(s)) return s;           // already correct
  if (/^\d{4}-\d{2}/.test(s)) {                           // ISO: 2026-02-01
    const [yr, mo] = s.split('-');
    return `${MONTH_NAMES[parseInt(mo, 10) - 1]}-${yr}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
  return s;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectSheet(headers) {
  for (const [sheet, required] of Object.entries(SHEET_SIGNATURES)) {
    if (required.every(col => headers.includes(col))) return sheet;
  }
  return null;
}

function dedupKey(row, keys) {
  return keys.map(k => String(row[k] ?? '')).join('||');
}

// ── Main ───────────────────────────────────────────────────────────────────────

if (!existsSync(EXCEL_PATH)) {
  console.error(`Excel not found: ${EXCEL_PATH}`);
  process.exit(1);
}

if (!existsSync(LOGS_FOLDER)) {
  console.error(`logs/ folder not found. Create it and drop CSV files inside.`);
  process.exit(1);
}

const csvFiles = readdirSync(LOGS_FOLDER).filter(f => extname(f).toLowerCase() === '.csv');

if (!csvFiles.length) {
  console.log('No CSV files found in logs/. Nothing to do.');
  process.exit(0);
}

const wb = XLSX.readFile(EXCEL_PATH);
let totalAdded = 0;

for (const file of csvFiles) {
  const filePath = join(LOGS_FOLDER, file);

  const csvWb  = XLSX.readFile(filePath);
  const newRows = XLSX.utils.sheet_to_json(csvWb.Sheets[csvWb.SheetNames[0]], { defval: '' });

  if (!newRows.length) {
    console.log(`  ${file}: empty — skipping`);
    continue;
  }

  const headers     = Object.keys(newRows[0]);
  const targetSheet = detectSheet(headers);

  if (!targetSheet) {
    console.log(`  ${file}: unrecognised columns — skipping`);
    console.log(`    Found: ${headers.join(', ')}`);
    console.log(`    Expected one of: ${Object.keys(SHEET_SIGNATURES).join(', ')}`);
    continue;
  }

  // Normalise Month column if present
  if (headers.includes('Month')) {
    newRows.forEach(r => { r.Month = normalizeMonth(r.Month); });
  }

  // Load existing rows and build dedup set
  const existing    = XLSX.utils.sheet_to_json(wb.Sheets[targetSheet] ?? {}, { defval: '' });
  const keys        = DEDUP_KEYS[targetSheet];
  const existingSet = new Set(existing.map(r => dedupKey(r, keys)));

  const toAdd = newRows.filter(r => !existingSet.has(dedupKey(r, keys)));
  const dupes = newRows.length - toAdd.length;

  if (!toAdd.length) {
    console.log(`  ${file} → ${targetSheet}: all ${newRows.length} rows already present`);
    continue;
  }

  wb.Sheets[targetSheet] = XLSX.utils.json_to_sheet([...existing, ...toAdd]);
  totalAdded += toAdd.length;
  console.log(`  ${file} → ${targetSheet}: +${toAdd.length} new rows${dupes ? ` (${dupes} duplicates skipped)` : ''}`);
}

if (totalAdded > 0) {
  XLSX.writeFile(wb, EXCEL_PATH);
  console.log(`\nSaved ${EXCEL_PATH} with ${totalAdded} new row(s).`);
  console.log('Next steps:');
  console.log('  git add public/AskQ_Master_Dashboard.xlsx');
  console.log('  git commit -m "Add new log data"');
  console.log('  git push   ← Vercel redeploys automatically');
} else {
  console.log('\nNo new rows added — Excel unchanged.');
}
