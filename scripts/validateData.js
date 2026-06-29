/**
 * validateData.js — Compares Excel vs Supabase to find any gaps
 * Usage: node scripts/validateData.js
 */
import { createRequire } from 'module';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const require    = createRequire(import.meta.url);
const XLSX       = require('xlsx');
const __dirname  = dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = join(resolve(__dirname, '..'), 'public', 'AskQ_Master_Dashboard.xlsx');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const wb      = XLSX.readFile(EXCEL_PATH);
const toSheet = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });

// ── Excel counts ──────────────────────────────────────────────────────────────
const cleaned       = toSheet('AskQ_Cleaned');
const flatTable     = toSheet('PowerBI_Flat_Table');
const tokenUsage    = toSheet('AskQ_TokenUsage');
const llmSteps      = toSheet('AskQ_LLMSteps');
const responseTimes = toSheet('AskQ_ResponseTime');

const countByMonth = (rows, key = 'Month') => {
  const m = {};
  rows.forEach(r => { const k = r[key] || 'Unknown'; m[k] = (m[k] || 0) + 1; });
  return m;
};

console.log('\n=== EXCEL DATA ===');
console.log(`AskQ_Cleaned:       ${cleaned.length} rows`);
console.log(`PowerBI_Flat_Table: ${flatTable.length} rows`);
console.log(`AskQ_TokenUsage:    ${tokenUsage.length} rows`);
console.log(`AskQ_LLMSteps:      ${llmSteps.length} rows`);
console.log(`AskQ_ResponseTime:  ${responseTimes.length} rows`);

console.log('\nExcel — Cleaned by month:');
const excelByMonth = countByMonth(cleaned);
Object.entries(excelByMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c}`));

// ── Supabase counts ───────────────────────────────────────────────────────────
async function fetchCount(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count;
}

async function fetchByMonth(table, col = 'month') {
  let allRows = [], from = 0;
  while (true) {
    const { data } = await supabase.from(table).select(col).range(from, from + 999);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const m = {};
  allRows.forEach(r => { const k = r[col] || 'Unknown'; m[k] = (m[k] || 0) + 1; });
  return m;
}

const [c1, c2, c3, c4, c5] = await Promise.all([
  fetchCount('analytics_cleaned'),
  fetchCount('analytics_flat_table'),
  fetchCount('analytics_token_usage'),
  fetchCount('analytics_llm_steps'),
  fetchCount('analytics_response_times'),
]);

console.log('\n=== SUPABASE DATA ===');
console.log(`analytics_cleaned:        ${c1} rows`);
console.log(`analytics_flat_table:     ${c2} rows`);
console.log(`analytics_token_usage:    ${c3} rows`);
console.log(`analytics_llm_steps:      ${c4} rows`);
console.log(`analytics_response_times: ${c5} rows`);

const sbByMonth = await fetchByMonth('analytics_cleaned');
console.log('\nSupabase — Cleaned by month:');
Object.entries(sbByMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c}`));

// ── Comparison ────────────────────────────────────────────────────────────────
console.log('\n=== GAPS ===');
const allMonths = new Set([...Object.keys(excelByMonth), ...Object.keys(sbByMonth)]);
let hasGap = false;
for (const month of [...allMonths].sort()) {
  const excel = excelByMonth[month] || 0;
  const sb    = sbByMonth[month] || 0;
  if (excel !== sb) {
    console.log(`  ⚠ ${month}: Excel=${excel} vs Supabase=${sb} (diff: ${excel - sb})`);
    hasGap = true;
  }
}

const totalDiff = cleaned.length - c1;
if (totalDiff !== 0) {
  console.log(`\n  Total gap: Excel has ${cleaned.length} vs Supabase has ${c1} (missing ${totalDiff})`);
  hasGap = true;
}

if (!hasGap) console.log('  ✅ No gaps — Excel and Supabase are in sync!');
