// Database connector — swap this in when DB credentials are available.
// To activate: set VITE_DATA_SOURCE=db in your .env and implement fetchFromDB below.
//
// Expected tables (same columns as the Excel sheets):
//   AskQ_Cleaned       → user questions, sessions, bot responses, feedback
//   AskQ_ResponseTime  → response time per bot interaction
//   AskQ_TokenUsage    → token counts per LLM call
//   AskQ_LLMSteps      → per-step LLM token breakdown
//   PowerBI_Flat_Table → issue flags (Is_Issue, Is_KB_Gap, Is_System_Error, etc.)

export const DB_QUERIES = {
  cleaned:      'SELECT * FROM AskQ_Cleaned',
  responseTime: 'SELECT * FROM AskQ_ResponseTime',
  tokenUsage:   'SELECT * FROM AskQ_TokenUsage',
  llmSteps:     'SELECT * FROM AskQ_LLMSteps',
  flatTable:    'SELECT * FROM PowerBI_Flat_Table',
};

// TODO: install your DB client (e.g. `npm install pg` for PostgreSQL, `npm install mssql` for SQL Server)
// and replace this stub with the real implementation.
export async function fetchFromDB(_query) {
  throw new Error(
    'DB connector not configured yet. Add credentials to .env and implement fetchFromDB in src/data/dbConnector.js'
  );
}

// Example PostgreSQL implementation (uncomment and fill in when ready):
//
// import { Pool } from 'pg';
// const pool = new Pool({ connectionString: import.meta.env.VITE_DB_URL });
// export async function fetchFromDB(query, params = []) {
//   const { rows } = await pool.query(query, params);
//   return rows;
// }
