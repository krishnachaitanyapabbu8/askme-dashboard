/**
 * Log Parser — transforms Ramco LLM Analytics Excel logs into AskQ_Master_Dashboard.xlsx
 *
 * Usage:
 *   npm run parse-logs
 *
 * Drop log Excel files into logs/ and run. The parser reads the RawData sheet,
 * extracts token usage from response_generation, and appends new rows to:
 *   - AskQ_Cleaned       (one row per message)
 *   - AskQ_LLMSteps      (one row per LLM step in bot responses)
 *   - AskQ_TokenUsage    (one row per bot response with aggregated tokens)
 *   - PowerBI_Flat_Table (one row per bot response with issue flags)
 *
 * After running: git add public/AskQ_Master_Dashboard.xlsx && git commit && git push
 */

import { createRequire } from 'module';
import { readdirSync, existsSync, renameSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX    = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const EXCEL_PATH      = join(ROOT, 'public', 'AskQ_Master_Dashboard.xlsx');
const LOGS_FOLDER     = join(ROOT, 'logs');
const COMPLETED_FOLDER = join(ROOT, 'logs', 'completed');

// ── Date helpers ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthFromDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  if (/^[A-Za-z]{3}-\d{4}$/.test(s)) return s;          // already "Jun-2026"

  // DD-MM-YYYY  (e.g. 15-06-2026)
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${MONTH_NAMES[parseInt(dmy[2]) - 1]}-${dmy[3]}`;

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${MONTH_NAMES[parseInt(ymd[2]) - 1]}-${ymd[1]}`;

  const d = new Date(s);
  if (!isNaN(d)) return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;

  return '';
}

// ── Python-dict parser ─────────────────────────────────────────────────────────
// response_generation is stored as a Python repr string, not valid JSON.

function parsePythonDict(s) {
  if (!s || s === 'undefined') return null;
  try {
    const json = String(s)
      .replace(/'/g, '"')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bNone\b/g, 'null')
      .replace(/,(\s*[}\]])/g, '$1');     // trailing commas
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Bot type inference ─────────────────────────────────────────────────────────

function inferBotType(rg) {
  if (!rg?.token_usage || typeof rg.token_usage !== 'object') return '';
  const steps = Object.keys(rg.token_usage);
  if (steps.some(s => s.includes('sql'))) return 'NLSQLAgent';
  return '';
}

// ── Row transformer ────────────────────────────────────────────────────────────

function transformRawData(rows, sourceFile) {
  const cleaned    = [];
  const llmSteps   = [];
  const tokenUsage = [];
  const flatTable  = [];

  for (const row of rows) {
    const sessionId  = row.chat_message_session_id ?? '';
    const senderRaw  = String(row.chat_message_sender_type ?? '').toLowerCase();
    const senderType = senderRaw === 'bot' ? 'bot' : 'Human';
    const isBot      = senderType === 'bot';
    const dateStr    = row.chat_message_created_at ?? row.Date ?? '';
    const month      = monthFromDate(dateStr);
    const message    = String(row.chat_message_text ?? '');
    const userName   = row.user_name ?? '';

    const rg          = parsePythonDict(row.response_generation);
    const module      = rg?.modulename ?? rg?.token_usage?.modulename ?? '';
    const botType     = inferBotType(rg);
    const queryFailed = rg?.query_exce_failed_status === true ? 1 : 0;

    // ── AskQ_Cleaned ────────────────────────────────────────────────────────
    cleaned.push({
      Date:                    dateStr,
      Month:                   month,
      Session_ID:              sessionId,
      Sender_Type:             senderType,
      Human_Message_Flag:      isBot ? 0 : 1,
      Bot_Message_Flag:        isBot ? 1 : 0,
      User_Name:               isBot ? '' : userName,
      User_Display:            isBot ? '' : userName,
      Bot_Type:                isBot ? botType : '',
      Message:                 message,
      Is_User_Question_Flag:   isBot ? 0 : 1,
      Is_System_Error:         isBot ? queryFailed : 0,
      Is_Issue:                isBot ? queryFailed : 0,
      Source_File:             sourceFile,
      user_name:               userName,
      chat_message_sender_id:  row.chat_message_sender_id ?? '',
      response_generation:     row.response_generation ?? '',
    });

    if (!isBot) continue;

    // ── LLM steps + token aggregation (bot rows only) ─────────────────────
    const tu = rg?.token_usage;
    if (tu && typeof tu === 'object') {
      let totalPrompt = 0, totalCompletion = 0, totalAll = 0;

      for (const [stepName, stepData] of Object.entries(tu)) {
        if (!stepData || typeof stepData !== 'object') continue;
        if (!('total_tokens' in stepData)) continue;

        const prompt     = stepData.prompt_tokens     ?? 0;
        const completion = stepData.completion_tokens ?? 0;
        const total      = stepData.total_tokens      ?? 0;

        llmSteps.push({
          Session_ID:        sessionId,
          Month:             month,
          Module:            module,
          Bot_Type:          botType,
          LLM_Step:          stepName,
          Prompt_Tokens:     prompt,
          Completion_Tokens: completion,
          Total_Tokens:      total,
          Source_File:       sourceFile,
        });

        totalPrompt      += prompt;
        totalCompletion  += completion;
        totalAll         += total;
      }

      if (totalAll > 0) {
        tokenUsage.push({
          Session_ID:        sessionId,
          Month:             month,
          Module_Clean:      module,
          Bot_Type:          botType,
          Prompt_Tokens:     totalPrompt,
          Completion_Tokens: totalCompletion,
          Total_Tokens:      totalAll,
          Source_File:       sourceFile,
        });
      }
    }

    // ── PowerBI_Flat_Table ─────────────────────────────────────────────────
    flatTable.push({
      Session_ID:          sessionId,
      Month:               month,
      Module:              module,
      Bot_Type:            botType,
      Is_Issue:            queryFailed,
      Is_System_Error:     queryFailed,
      Is_KB_Gap:           0,
      Is_Placeholder_Data: 0,
      Is_Copilot_Loop:     0,
      Is_Context_Drop:     0,
      Source_File:         sourceFile,
    });
  }

  return { cleaned, llmSteps, tokenUsage, flatTable };
}

// ── Deduplication ──────────────────────────────────────────────────────────────

const DEDUP_KEYS = {
  AskQ_Cleaned:       ['Session_ID', 'Sender_Type', 'Message'],
  AskQ_LLMSteps:      ['Session_ID', 'LLM_Step'],
  AskQ_TokenUsage:    ['Session_ID'],
  PowerBI_Flat_Table: ['Session_ID', 'Bot_Type'],
};

function dedupKey(row, keys) {
  return keys.map(k => String(row[k] ?? '')).join('||');
}

function appendToSheet(wb, sheetName, newRows) {
  if (!newRows.length) return 0;
  const existing    = XLSX.utils.sheet_to_json(wb.Sheets[sheetName] ?? {}, { defval: '' });
  const keys        = DEDUP_KEYS[sheetName];
  const existingSet = new Set(existing.map(r => dedupKey(r, keys)));
  const toAdd       = newRows.filter(r => !existingSet.has(dedupKey(r, keys)));
  if (!toAdd.length) return 0;
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet([...existing, ...toAdd]);
  return toAdd.length;
}

// ── Main ───────────────────────────────────────────────────────────────────────

if (!existsSync(EXCEL_PATH))  { console.error(`Excel not found: ${EXCEL_PATH}`);  process.exit(1); }
if (!existsSync(LOGS_FOLDER)) { console.error(`logs/ folder not found.`);          process.exit(1); }

const SUPPORTED = new Set(['.csv', '.xlsx', '.xls']);
const logFiles  = readdirSync(LOGS_FOLDER)
  .filter(f => SUPPORTED.has(extname(f).toLowerCase()) && !f.startsWith('.'));

if (!logFiles.length) {
  console.log('No log files in logs/. Drop Excel or CSV files there and re-run.');
  process.exit(0);
}

const wb = XLSX.readFile(EXCEL_PATH);
let totalAdded = 0;

for (const file of logFiles) {
  const logWb = XLSX.readFile(join(LOGS_FOLDER, file));

  // Prefer RawData sheet; fall back to first sheet
  const sheetName = logWb.SheetNames.includes('RawData') ? 'RawData' : logWb.SheetNames[0];
  const rawRows   = XLSX.utils.sheet_to_json(logWb.Sheets[sheetName], { defval: '' });

  if (!rawRows.length) { console.log(`  ${file}: empty — skipping`); continue; }

  const headers        = Object.keys(rawRows[0]);
  const isKnownFormat  = ['chat_message_session_id', 'chat_message_sender_type'].every(c => headers.includes(c));

  if (!isKnownFormat) {
    console.log(`  ${file}: unrecognised format — skipping`);
    console.log(`    Columns: ${headers.join(', ')}`);
    continue;
  }

  const { cleaned, llmSteps, tokenUsage, flatTable } = transformRawData(rawRows, file);

  const added = {
    'AskQ_Cleaned':       appendToSheet(wb, 'AskQ_Cleaned',       cleaned),
    'AskQ_LLMSteps':      appendToSheet(wb, 'AskQ_LLMSteps',      llmSteps),
    'AskQ_TokenUsage':    appendToSheet(wb, 'AskQ_TokenUsage',     tokenUsage),
    'PowerBI_Flat_Table': appendToSheet(wb, 'PowerBI_Flat_Table',  flatTable),
  };

  const fileTotal = Object.values(added).reduce((s, n) => s + n, 0);
  totalAdded += fileTotal;

  console.log(`\n  ${file} (${rawRows.length} raw rows):`);
  for (const [sheet, n] of Object.entries(added)) {
    console.log(`    → ${sheet}: ${n > 0 ? `+${n} new rows` : 'nothing new'}`);
  }

  // Move to completed/ regardless of whether rows were new or already present
  const dest = join(COMPLETED_FOLDER, file);
  renameSync(join(LOGS_FOLDER, file), dest);
  console.log(`    ✓ moved to logs/completed/`);
}

if (totalAdded > 0) {
  XLSX.writeFile(wb, EXCEL_PATH);
  console.log(`\nSaved — ${totalAdded} total new rows added to ${EXCEL_PATH}`);
  console.log('Next steps:');
  console.log('  git add public/AskQ_Master_Dashboard.xlsx');
  console.log('  git commit -m "Add logs YYYY-MM-DD"');
  console.log('  git push');
} else {
  console.log('\nNo new rows — Excel unchanged.');
}
