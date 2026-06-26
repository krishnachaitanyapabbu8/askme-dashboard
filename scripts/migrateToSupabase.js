/**
 * migrateToSupabase.js
 *
 * One-time migration: pushes all existing data from AskQ_Master_Dashboard.xlsx
 * into the Supabase analytics tables.
 *
 * Usage:
 *   node scripts/migrateToSupabase.js
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const wb      = XLSX.readFile(EXCEL_PATH);
const toSheet = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });

async function upsertBatch(table, rows, onConflict, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: true });
    if (error) { console.error(`  ✗ ${table} batch ${i}: ${error.message}`); continue; }
    inserted += batch.length;
    process.stdout.write(`\r  → ${table}: ${inserted}/${rows.length} rows`);
  }
  console.log(`\r  → ${table}: ${inserted} rows pushed ✓`);
}

console.log('Reading Excel...');
const cleaned      = toSheet('AskQ_Cleaned');
const flatTable    = toSheet('PowerBI_Flat_Table');
const tokenUsage   = toSheet('AskQ_TokenUsage');
const llmSteps     = toSheet('AskQ_LLMSteps');
const responseTimes = toSheet('AskQ_ResponseTime');

console.log(`  AskQ_Cleaned:       ${cleaned.length} rows`);
console.log(`  PowerBI_Flat_Table: ${flatTable.length} rows`);
console.log(`  AskQ_TokenUsage:    ${tokenUsage.length} rows`);
console.log(`  AskQ_LLMSteps:      ${llmSteps.length} rows`);
console.log(`  AskQ_ResponseTime:  ${responseTimes.length} rows`);
console.log('\nPushing to Supabase...');

const toInt = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };

await upsertBatch('analytics_cleaned', cleaned.map(r => ({
  session_id: r.Session_ID, date: r.Date, month: r.Month,
  sender_type: r.Sender_Type, user_name: r.User_Name, user_display: r.User_Display,
  bot_type: r.Bot_Type, message: r.Message, question_category: r.Question_Category,
  feedback: r.Feedback,
  is_user_question: toInt(r.Is_User_Question_Flag ?? r.Human_Message_Flag),
  is_system_error:  toInt(r.Is_System_Error),
  is_issue:         toInt(r.Is_Issue),
  source_file: r.Source_File ?? '',
})).filter(r => r.session_id), 'session_id,sender_type,message');

await upsertBatch('analytics_flat_table', flatTable.map(r => ({
  session_id: r.Session_ID, month: r.Month, module: r.Module, bot_type: r.Bot_Type,
  is_issue: r.Is_Issue ?? 0, is_system_error: r.Is_System_Error ?? 0,
  is_kb_gap: r.Is_KB_Gap ?? 0, is_placeholder_data: r.Is_Placeholder_Data ?? 0,
  is_copilot_loop: r.Is_Copilot_Loop ?? 0, is_context_drop: r.Is_Context_Drop ?? 0,
  source_file: r.Source_File ?? '',
})).filter(r => r.session_id), 'session_id,bot_type');

await upsertBatch('analytics_token_usage', tokenUsage.map(r => ({
  session_id: r.Session_ID, month: r.Month, module_clean: r.Module_Clean,
  bot_type: r.Bot_Type, prompt_tokens: r.Prompt_Tokens ?? 0,
  completion_tokens: r.Completion_Tokens ?? 0, total_tokens: r.Total_Tokens ?? 0,
  source_file: r.Source_File ?? '',
})).filter(r => r.session_id), 'session_id');

await upsertBatch('analytics_llm_steps', llmSteps.map(r => ({
  session_id: r.Session_ID, month: r.Month, module: r.Module, bot_type: r.Bot_Type,
  llm_step: r.LLM_Step, prompt_tokens: r.Prompt_Tokens ?? 0,
  completion_tokens: r.Completion_Tokens ?? 0, total_tokens: r.Total_Tokens ?? 0,
  source_file: r.Source_File ?? '',
})).filter(r => r.session_id), 'session_id,llm_step');

await upsertBatch('analytics_response_times', responseTimes.map(r => ({
  session_id: r.Session_ID, month: r.Month, bot_type: r.Bot_Type,
  response_time_seconds: r.Response_Time_Seconds ?? null,
  source_file: r.Source_File ?? '',
})).filter(r => r.session_id), 'session_id');

console.log('\n✅ Migration complete! All data is now in Supabase.');
