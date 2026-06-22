/**
 * Log Parser — transforms Ramco LLM Analytics Excel logs into AskQ_Master_Dashboard.xlsx
 *
 * Usage:
 *   npm run parse-logs
 *
 * Drop log Excel files into logs/ and run. The parser reads the RawData sheet,
 * appends new rows to ALL five sheets, deduplicates existing data, and reports.
 *
 * Sheets updated:
 *   - AskQ_Cleaned       (one row per message — user + bot)
 *   - AskQ_LLMSteps      (one row per LLM step in each bot response)
 *   - AskQ_TokenUsage    (one row per bot response with aggregated token counts)
 *   - AskQ_ResponseTime  (one row per bot response with response time in seconds)
 *   - PowerBI_Flat_Table (one row per bot response with issue/flag columns)
 *
 * After running:
 *   git add public/AskQ_Master_Dashboard.xlsx
 *   git commit -m "Add prod logs YYYY-MM-DD"
 *   git push
 */

import { createRequire } from 'module';
import { readdirSync, existsSync, renameSync, unlinkSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require   = createRequire(import.meta.url);
const XLSX      = require('xlsx');

const __dirname       = dirname(fileURLToPath(import.meta.url));
const ROOT            = resolve(__dirname, '..');
const EXCEL_PATH      = join(ROOT, 'public', 'AskQ_Master_Dashboard.xlsx');
const LOGS_FOLDER     = join(ROOT, 'logs');
const COMPLETED_FOLDER = join(ROOT, 'logs', 'completed');

// ── Date helpers ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Normalize any date string to DD-MM-YYYY for consistent storage across all sheets.
// Accepts: "YYYY-MM-DD", "DD-MM-YYYY", "MM/DD/YYYY", JS Date, or Excel serial number.
function toDisplayDate(raw) {
  if (!raw && raw !== 0) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // Already DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return s;

  // YYYY-MM-DD (ISO)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[3]}-${ymd[2]}-${ymd[1]}`;

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[2].padStart(2,'0')}-${mdy[1].padStart(2,'0')}-${mdy[3]}`;

  // Excel serial number
  if (/^\d+$/.test(s)) {
    const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
    if (!isNaN(d)) {
      const dd = String(d.getUTCDate()).padStart(2,'0');
      const mm = String(d.getUTCMonth()+1).padStart(2,'0');
      return `${dd}-${mm}-${d.getUTCFullYear()}`;
    }
  }

  // Fall back via Date parse
  const d = new Date(s);
  if (!isNaN(d)) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }

  return s;
}

function monthFromDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  if (/^[A-Za-z]{3}-\d{4}$/.test(s)) return s;

  // DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return `${MONTH_NAMES[parseInt(dmy[2]) - 1]}-${dmy[3]}`;

  // YYYY-MM-DD (ISO)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${MONTH_NAMES[parseInt(ymd[2]) - 1]}-${ymd[1]}`;

  const d = new Date(s);
  if (!isNaN(d)) return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;

  return '';
}

function parseTimestamp(dateStr) {
  if (!dateStr) return NaN;
  const t = new Date(String(dateStr).trim()).getTime();
  return isNaN(t) ? NaN : t;
}

// ── Python-dict parser ─────────────────────────────────────────────────────────

function parsePythonDict(s) {
  if (!s || s === 'undefined') return null;
  try {
    return JSON.parse(
      String(s)
        .replace(/'/g, '"')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bNone\b/g, 'null')
        .replace(/,(\s*[}\]])/g, '$1')
    );
  } catch {
    return null;
  }
}

// ── Bot type + module inference ────────────────────────────────────────────────

function inferBotType(rg) {
  if (!rg?.token_usage || typeof rg.token_usage !== 'object') return '';
  const steps = Object.keys(rg.token_usage);
  if (steps.some(s => s.includes('sql'))) return 'NLSQLAgent';
  return '';
}

function inferModule(rg) {
  return rg?.modulename ?? rg?.token_usage?.modulename ?? '';
}

// ── Simple question category classifier ───────────────────────────────────────
// Applied to user messages. New data defaults to 'Unclassified' when unsure.

const DATA_QUERY_RE   = /\b(show|list|how many|total|count|give me|display|what is|average|sum|report)\b/i;
const PROCESS_RE      = /\b(how to|what is the process|steps to|procedure|explain|guide|process for)\b/i;
const TRANSACTIONAL_RE = /\b(create|update|delete|post|submit|approve|reject|record|enter|add new)\b/i;

function classifyQuestion(message) {
  if (!message) return 'Unclassified';
  if (TRANSACTIONAL_RE.test(message)) return 'Transactional';
  if (PROCESS_RE.test(message))       return 'Process/How-To';
  if (DATA_QUERY_RE.test(message))    return 'Data Query';
  return 'Unclassified';
}

// ── Excluded users (test/debug accounts) ──────────────────────────────────────

const EXCLUDED_USERS = new Set(['QUADDEBUG']);

// ── Row transformer ────────────────────────────────────────────────────────────

function transformRawData(rows, sourceFile) {
  rows = rows.filter(r => !EXCLUDED_USERS.has(String(r.user_name ?? '').trim()));
  const cleaned      = [];
  const llmSteps     = [];
  const tokenUsage   = [];
  const responseTimes = [];
  const flatTable    = [];

  // Group rows by session and sort by timestamp for response-time calculation
  const bySession = {};
  for (const row of rows) {
    const sid = String(row.chat_message_session_id ?? '');
    if (!bySession[sid]) bySession[sid] = [];
    bySession[sid].push(row);
  }
  for (const msgs of Object.values(bySession)) {
    msgs.sort((a, b) => parseTimestamp(a.chat_message_created_at) - parseTimestamp(b.chat_message_created_at));
  }

  for (const row of rows) {
    const sessionId  = String(row.chat_message_session_id ?? '');
    const senderRaw  = String(row.chat_message_sender_type ?? '').toLowerCase();
    const senderType = senderRaw === 'bot' ? 'bot' : 'Human';
    const isBot      = senderType === 'bot';
    const rawDate    = row.Date || row.chat_message_created_at || '';
    const dateStr    = toDisplayDate(rawDate);
    const month      = monthFromDate(dateStr);
    const message    = String(row.chat_message_text ?? '');
    const userName   = row.user_name ?? '';
    const rg         = parsePythonDict(row.response_generation);
    const module     = inferModule(rg);
    const botType    = isBot ? inferBotType(rg) : '';
    const queryFailed = rg?.query_exce_failed_status === true ? 1 : 0;
    const category   = isBot ? '' : classifyQuestion(message);

    // ── AskQ_Cleaned ──────────────────────────────────────────────────────────
    cleaned.push({
      Date:                    dateStr,
      Month:                   month,
      Session_ID:              sessionId,
      Sender_Type:             senderType,
      Human_Message_Flag:      isBot ? 0 : 1,
      Bot_Message_Flag:        isBot ? 1 : 0,
      User_Name:               isBot ? '' : userName,
      User_Display:            isBot ? '' : userName,
      Bot_Type:                botType,
      Message:                 message,
      Question_Category:       category,
      Feedback:                '',
      Is_User_Question_Flag:   isBot ? 0 : 1,
      Is_System_Error:         isBot ? queryFailed : 0,
      Is_Issue:                isBot ? queryFailed : 0,
      Source_File:             sourceFile,
      user_name:               userName,
      chat_message_sender_id:  row.chat_message_sender_id ?? '',
      response_generation:     row.response_generation ?? '',
    });

    if (!isBot) continue;

    // ── LLM steps + token aggregation ────────────────────────────────────────
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

        totalPrompt     += prompt;
        totalCompletion += completion;
        totalAll        += total;
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

    // ── AskQ_ResponseTime — calculate from paired user→bot timestamps ─────────
    const sessionMsgs = bySession[sessionId] ?? [];
    const thisIndex   = sessionMsgs.indexOf(row);
    if (thisIndex > 0) {
      const prevRow   = sessionMsgs[thisIndex - 1];
      const prevIsUser = String(prevRow.chat_message_sender_type ?? '').toLowerCase() !== 'bot';
      if (prevIsUser) {
        const t0 = parseTimestamp(prevRow.chat_message_created_at);
        const t1 = parseTimestamp(dateStr);
        if (!isNaN(t0) && !isNaN(t1) && t1 > t0) {
          const diffSec = +((t1 - t0) / 1000).toFixed(1);
          if (diffSec < 300) {
            responseTimes.push({
              Session_ID:            sessionId,
              Month:                 month,
              Bot_Type:              botType,
              Response_Time_Seconds: diffSec,
              Source_File:           sourceFile,
            });
          }
        }
      }
    }

    // ── PowerBI_Flat_Table ─────────────────────────────────────────────────────
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

  return { cleaned, llmSteps, tokenUsage, responseTimes, flatTable };
}

// ── Deduplication ──────────────────────────────────────────────────────────────

const DEDUP_KEYS = {
  AskQ_Cleaned:       ['Session_ID', 'Sender_Type', 'Message'],
  AskQ_LLMSteps:      ['Session_ID', 'LLM_Step'],
  AskQ_TokenUsage:    ['Session_ID'],
  AskQ_ResponseTime:  ['Session_ID'],
  PowerBI_Flat_Table: ['Session_ID', 'Bot_Type'],
};

function dedupKey(row, keys) {
  return keys.map(k => String(row[k] ?? '')).join('||');
}

/**
 * Appends new rows that are not already present in the sheet.
 * Existing rows are never modified or removed.
 * Returns the count of rows actually added.
 */
function appendToSheet(wb, sheetName, newRows) {
  const sheet    = wb.Sheets[sheetName];
  const existing = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];
  const keys     = DEDUP_KEYS[sheetName] ?? ['Session_ID'];

  const seen = new Set(existing.map(r => dedupKey(r, keys)));
  const toAdd = newRows.filter(r => !seen.has(dedupKey(r, keys)));

  if (!toAdd.length) return 0;

  const ws = XLSX.utils.json_to_sheet([...existing, ...toAdd]);
  wb.Sheets[sheetName] = ws;
  if (!wb.SheetNames.includes(sheetName)) wb.SheetNames.push(sheetName);

  return toAdd.length;
}

// ── Main ───────────────────────────────────────────────────────────────────────

if (!existsSync(EXCEL_PATH))  { console.error(`Excel not found: ${EXCEL_PATH}`);  process.exit(1); }
if (!existsSync(LOGS_FOLDER)) { console.error(`logs/ folder not found.`);          process.exit(1); }

const SUPPORTED = new Set(['.csv', '.xlsx', '.xls']);
const logFiles  = readdirSync(LOGS_FOLDER)
  .filter(f => SUPPORTED.has(extname(f).toLowerCase()) && !f.startsWith('.'));

const wb = XLSX.readFile(EXCEL_PATH);
let totalAdded = 0;

if (!logFiles.length) {
  console.log('No new log files found in logs/. Nothing to do.');
  process.exit(0);
}

// ── Process log files ──────────────────────────────────────────────────────

for (const file of logFiles) {
  const logPath = join(LOGS_FOLDER, file);
  let rawRows;

  const ext = extname(file).toLowerCase();
  if (ext === '.csv') {
    const logWb = XLSX.readFile(logPath);
    rawRows = XLSX.utils.sheet_to_json(logWb.Sheets[logWb.SheetNames[0]], { defval: '' });
  } else {
    const logWb = XLSX.readFile(logPath);
    const sheetName = logWb.SheetNames.includes('RawData') ? 'RawData' : logWb.SheetNames[0];
    rawRows = XLSX.utils.sheet_to_json(logWb.Sheets[sheetName], { defval: '' });
  }

  if (!rawRows.length) { console.log(`  ${file}: empty — skipping`); continue; }

  const headers       = Object.keys(rawRows[0]);
  const isKnownFormat = ['chat_message_session_id', 'chat_message_sender_type'].every(c => headers.includes(c));

  if (!isKnownFormat) {
    console.log(`  ${file}: unrecognised format — skipping`);
    console.log(`    Columns found: ${headers.join(', ')}`);
    continue;
  }

  const { cleaned, llmSteps, tokenUsage, responseTimes, flatTable } =
    transformRawData(rawRows, file);

  const results = {
    'AskQ_Cleaned':       appendToSheet(wb, 'AskQ_Cleaned',       cleaned),
    'AskQ_LLMSteps':      appendToSheet(wb, 'AskQ_LLMSteps',      llmSteps),
    'AskQ_TokenUsage':    appendToSheet(wb, 'AskQ_TokenUsage',     tokenUsage),
    'AskQ_ResponseTime':  appendToSheet(wb, 'AskQ_ResponseTime',   responseTimes),
    'PowerBI_Flat_Table': appendToSheet(wb, 'PowerBI_Flat_Table',  flatTable),
  };

  console.log(`\n  ${file} (${rawRows.length} raw rows):`);
  for (const [sheet, added] of Object.entries(results)) {
    console.log(`    → ${sheet}: ${added > 0 ? `+${added} new rows` : 'nothing new'}`);
    totalAdded += added;
  }

  const dest = join(COMPLETED_FOLDER, file);
  if (existsSync(dest)) unlinkSync(dest);
  renameSync(logPath, dest);
  console.log(`    ✓ moved to logs/completed/${file}`);
}

if (totalAdded > 0) {
  XLSX.writeFile(wb, EXCEL_PATH);
  console.log(`\nSaved — ${totalAdded} new rows added.`);
  console.log('Next steps:');
  console.log('  git add public/AskQ_Master_Dashboard.xlsx');
  console.log('  git commit -m "Add prod logs YYYY-MM-DD"');
  console.log('  git push');
} else {
  console.log('\nNo changes — Excel unchanged.');
}
