/**
 * detectKbGaps.js
 *
 * Scans all bot responses in AskQ_Cleaned and auto-flags KB gaps in
 * PowerBI_Flat_Table based on known failure phrases in the bot's reply.
 *
 * Usage:
 *   node scripts/detectKbGaps.js
 *
 * Run this:
 *   - Once to backfill existing data
 *   - After each batch of new logs to keep KB gaps up to date
 *
 * Going forward, parseNewLogs.js also auto-detects KB gaps during parsing,
 * so this script is mainly needed to backfill historical data.
 */

import { createRequire } from 'module';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require    = createRequire(import.meta.url);
const XLSX       = require('xlsx');
const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const EXCEL_PATH = join(ROOT, 'public', 'AskQ_Master_Dashboard.xlsx');

// ── KB Gap detection phrases ────────────────────────────────────────────────
// These are phrases the bot uses when it cannot answer a question due to
// missing training/knowledge base content. Add new phrases here as discovered.

export const KB_GAP_PHRASES = [
  "looks like that information isn't available",
  "information isn't available at the moment",
  "no specific steps provided",
  "information is insufficient to retrieve",
  "information provided is insufficient",
  "provided information is insufficient",
];

export function isKbGap(botMessageText) {
  if (!botMessageText) return false;
  const lower = String(botMessageText).toLowerCase();
  return KB_GAP_PHRASES.some(phrase => lower.includes(phrase));
}

// ── Main ────────────────────────────────────────────────────────────────────

const wb      = XLSX.readFile(EXCEL_PATH);
const cleaned = XLSX.utils.sheet_to_json(wb.Sheets['AskQ_Cleaned'], { defval: '' });
const ft      = XLSX.utils.sheet_to_json(wb.Sheets['PowerBI_Flat_Table'], { defval: '' });

const toInt = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

// Find sessions where any bot response contains a KB gap phrase
const kbGapSessions = new Set(
  cleaned
    .filter(r => r.Sender_Type === 'bot' && isKbGap(r.Message))
    .map(r => r.Session_ID)
    .filter(Boolean)
);

console.log(`KB gap sessions detected: ${kbGapSessions.size}`);

// Update PowerBI_Flat_Table
let updated = 0;
let alreadyFlagged = 0;

const newFt = ft.map(r => {
  if (!kbGapSessions.has(r.Session_ID)) return r;
  if (toInt(r.Is_KB_Gap) === 1) { alreadyFlagged++; return r; }
  updated++;
  return { ...r, Is_KB_Gap: 1, Is_Issue: 1 };
});

console.log(`Already flagged:  ${alreadyFlagged}`);
console.log(`Newly flagged:    ${updated}`);
console.log(`Total KB gaps:    ${newFt.filter(r => toInt(r.Is_KB_Gap) === 1).length}`);

if (updated > 0) {
  wb.Sheets['PowerBI_Flat_Table'] = XLSX.utils.json_to_sheet(newFt);
  XLSX.writeFile(wb, EXCEL_PATH);
  console.log('\nSaved. Run git add + commit + push to deploy.');
} else {
  console.log('\nNo changes — everything already up to date.');
}
