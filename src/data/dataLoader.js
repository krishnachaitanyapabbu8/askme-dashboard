import * as XLSX from 'xlsx';

// ─── Data source configuration ────────────────────────────────────────────────
//
// Set VITE_API_URL in your .env file to switch to live DB mode:
//   VITE_API_URL=https://your-django-app.com
//   VITE_API_KEY=your-secret-key
//
// Leave VITE_API_URL unset to fall back to the local Excel file.

const API_BASE  = import.meta.env.VITE_API_URL  || '';
const API_KEY   = import.meta.env.VITE_API_KEY   || '';
const MASTER_PATH = `./AskQ_Master_Dashboard.xlsx?v=${Date.now()}`;

// ─── API loader ───────────────────────────────────────────────────────────────

async function fetchFromAPI() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;

  const res = await fetch(`${API_BASE}/analytics/dashboard-data`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.data;
}

// ─── Excel loader (fallback) ──────────────────────────────────────────────────

async function fetchWorkbook(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load: ${path} — ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
}

function getSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { console.warn(`Sheet "${sheetName}" not found.`); return []; }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
    .map(r => r.Month !== undefined ? { ...r, Month: normalizeMonth(r.Month) } : r);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalise "Jun 2026" → "Jun-2026" so space- and hyphen-separated months
// compare equal regardless of which tool produced them.
function normalizeMonth(m) {
  if (!m) return '';
  return String(m).trim().replace(/\s+/, '-');
}

const toInt   = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
const toFloat = (v) => { const n = parseFloat(v);   return isNaN(n) ? 0 : n; };
const distinctCount = (arr) => new Set(arr).size;
const groupBy = (arr, key) =>
  arr.reduce((acc, row) => {
    const k = row[key] ?? '';
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});
const sumField = (arr, field) => arr.reduce((s, r) => s + toInt(r[field]), 0);
const avgField = (arr, field) => {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + toFloat(r[field]), 0) / arr.length;
};

// ─── Month Sorting ─────────────────────────────────────────────────────────────

const MONTH_ORDER = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function sortMonths(months) {
  return [...months].sort((a, b) => {
    const [ma, ya] = a.split(/[-\s]/);
    const [mb, yb] = b.split(/[-\s]/);
    const yearDiff = (parseInt(ya) || 0) - (parseInt(yb) || 0);
    if (yearDiff !== 0) return yearDiff;
    return MONTH_ORDER.indexOf(ma) - MONTH_ORDER.indexOf(mb);
  });
}

// ─── Session Filter ────────────────────────────────────────────────────────────
//
// PowerBI_Flat_Table (standalone) acts as the "truth" for which sessions are
// valid. AskQ_Cleaned is always cross-filtered to sessions present in the ft.
// This mirrors the Power BI table relationship: AskQ_Cleaned ↔ PowerBI_Flat_Table
// via Session_ID (cross-filter both directions).
//
// When a Module filter is active, only ft sessions matching that module are kept.
// When a Month filter is active, only ft sessions in those months are kept.
// Without filters, all ft sessions are used.

function getSessionFilter(flatTable, filters) {
  let rows = flatTable;
  if (filters.months?.length)  rows = rows.filter(r => filters.months.includes(r.Month));
  if (filters.modules?.length) rows = rows.filter(r => filters.modules.includes(r.Module));
  return new Set(rows.map(r => r.Session_ID).filter(Boolean));
}

// ─── Filter Functions ──────────────────────────────────────────────────────────

// AskQ_Cleaned: filter by bot type, question category, and session whitelist.
// Month is handled via session whitelist (ft sessions already filtered by month).
function filterCleaned(data, filters, sessionFilter) {
  let out = data;
  if (filters.botTypes?.length)           out = out.filter(r => filters.botTypes.includes(r.Bot_Type));
  if (filters.questionCategories?.length) out = out.filter(r => filters.questionCategories.includes(r.Question_Category));
  out = out.filter(r => sessionFilter.has(r.Session_ID));
  return out;
}

// Same as filterCleaned but ignores Bot_Type filter (for "Total User Questions" KPI).
function filterCleanedNoBotType(data, filters, sessionFilter) {
  let out = data;
  if (filters.questionCategories?.length) out = out.filter(r => filters.questionCategories.includes(r.Question_Category));
  out = out.filter(r => sessionFilter.has(r.Session_ID));
  return out;
}

// PowerBI_Flat_Table: standard filter by month, bot type, module, question category.
function filterFlat(data, filters) {
  let out = data;
  if (filters.months?.length)            out = out.filter(r => filters.months.includes(r.Month));
  if (filters.botTypes?.length)          out = out.filter(r => filters.botTypes.includes(r.Bot_Type));
  if (filters.modules?.length)           out = out.filter(r => filters.modules.includes(r.Module));
  if (filters.questionCategories?.length) out = out.filter(r => filters.questionCategories.includes(r.Question_Category));
  return out;
}

function filterResponseTime(data, filters) {
  let out = data;
  if (filters.months?.length)   out = out.filter(r => filters.months.includes(r.Month));
  if (filters.botTypes?.length) out = out.filter(r => filters.botTypes.includes(r.Bot_Type));
  return out;
}

function filterTokenUsage(data, filters) {
  let out = data;
  if (filters.months?.length)   out = out.filter(r => filters.months.includes(r.Month));
  if (filters.botTypes?.length) out = out.filter(r => filters.botTypes.includes(r.Bot_Type));
  if (filters.modules?.length)  out = out.filter(r => filters.modules.includes(r.Module_Clean));
  return out;
}

function filterLLMSteps(data, filters) {
  let out = data;
  if (filters.months?.length) out = out.filter(r => filters.months.includes(r.Month));
  return out;
}

// ─── Filter Options ────────────────────────────────────────────────────────────

function getFilterOptions(cleaned, flatTable) {
  // Months: use only ft months (Feb-May), matching what PBI exposes.
  const months = sortMonths([...new Set(flatTable.map(r => r.Month).filter(Boolean))]);
  // Exclude "Human" and "Unknown" — user-message rows, not real bot types.
  const BOT_TYPE_EXCLUDE = new Set(['Human', 'Unknown', '']);
  const botTypes = [...new Set(cleaned.map(r => r.Bot_Type).filter(v => v && !BOT_TYPE_EXCLUDE.has(v)))].sort();
  const modules           = [...new Set(flatTable.map(r => r.Module).filter(Boolean))].sort();
  const questionCategories = [...new Set(cleaned.map(r => r.Question_Category).filter(Boolean))].sort();
  return { months, botTypes, modules, questionCategories };
}

// ─── LLM Step Labels ───────────────────────────────────────────────────────────

const LLM_STEP_LABELS = {
  first_sql_generation_llm:          'SQL Generation',
  standalone_question_generation_llm: 'Question Rephrasing',
  component_name_identification_llm:  'Component ID',
  final_response_llm:                 'Final Response',
  retry_sql_generation_1:             'SQL Retry (1st)',
  retry_sql_generation_2:             'SQL Retry (2nd)',
  canonical_and_intent_llm:           'Intent Extraction',
  similarity_score_llm:               'Similarity Score',
  fewshot_score_identification_llm:   'Few-shot Score',
};
const labelStep = (step) => LLM_STEP_LABELS[step] || step;

// ─── Main Loader ───────────────────────────────────────────────────────────────

export async function loadDashboardData(filters = {}) {
  let cleaned, responseTime, tokenUsage, llmSteps, flatTable;

  if (API_BASE) {
    // ── Live DB mode — fetch from Django API ──────────────────────────────
    const data = await fetchFromAPI();
    cleaned      = (data.cleaned       || []).map(r => ({ ...r, Month: normalizeMonth(r.Month) }));
    responseTime = (data.response_times || []).map(r => ({ ...r, Month: normalizeMonth(r.Month) }));
    tokenUsage   = (data.token_usage    || []).map(r => ({ ...r, Month: normalizeMonth(r.Month) }));
    llmSteps     = (data.llm_steps      || []).map(r => ({ ...r, Month: normalizeMonth(r.Month) }));
    flatTable    = (data.flat_table     || []).map(r => ({ ...r, Month: normalizeMonth(r.Month) }));
  } else {
    // ── Excel fallback mode ───────────────────────────────────────────────
    const wb = await fetchWorkbook(MASTER_PATH);

    const EXCLUDED_USERS = new Set(['QUADDEBUG', 'RAMCOUSER']);
    const allCleaned     = getSheet(wb, 'AskQ_Cleaned');
    const excludedSessions = new Set(
      allCleaned
        .filter(r => EXCLUDED_USERS.has(String(r.User_Name ?? '').trim()))
        .map(r => r.Session_ID)
        .filter(Boolean)
    );

    cleaned      = allCleaned.filter(r => !excludedSessions.has(r.Session_ID));
    responseTime = getSheet(wb, 'AskQ_ResponseTime').filter(r => !excludedSessions.has(r.Session_ID));
    tokenUsage   = getSheet(wb, 'AskQ_TokenUsage').filter(r => !excludedSessions.has(r.Session_ID));
    llmSteps     = getSheet(wb, 'AskQ_LLMSteps').filter(r => !excludedSessions.has(r.Session_ID));
    flatTable    = getSheet(wb, 'PowerBI_Flat_Table').filter(r => !excludedSessions.has(r.Session_ID));
  }

  const filterOptions = getFilterOptions(cleaned, flatTable);

  // Session whitelist: ft sessions filtered by active month/module filters.
  // AskQ_Cleaned is always cross-filtered to this whitelist (mirrors PBI relationship).
  const sessionFilter = getSessionFilter(flatTable, filters);

  // Filtered slices
  const fc     = filterCleaned(cleaned, filters, sessionFilter);
  const fcNoBt = filterCleanedNoBotType(cleaned, filters, sessionFilter);
  const ft     = filterFlat(flatTable, filters);
  const fr     = filterResponseTime(responseTime, filters);
  const ftu    = filterTokenUsage(tokenUsage, filters);
  const fls    = filterLLMSteps(llmSteps, filters);

  // ── Subsets ────────────────────────────────────────────────────────────────

  const userQuestions     = fc.filter(r => toInt(r.Is_User_Question_Flag) === 1);
  const userQuestionsNoBt = fcNoBt.filter(r => toInt(r.Is_User_Question_Flag) === 1);
  const botRows           = fc.filter(r => r.Sender_Type === 'bot' && r.Bot_Type !== 'Unknown');

  // ── Volume / Users ─────────────────────────────────────────────────────────

  // Total User Questions ignores Bot_Type filter (matches PBI "Total User Questions")
  const totalUserQuestions  = userQuestionsNoBt.length;
  const totalQuestions      = userQuestions.length;
  const totalUniqueQuestions = distinctCount(userQuestions.map(r => r.Message));
  const activeUsers         = distinctCount(userQuestionsNoBt.map(r => r.User_Display).filter(Boolean));
  const avgQuestionsPerUser = activeUsers ? totalUserQuestions / activeUsers : 0;
  const totalSessions       = distinctCount(fc.map(r => r.Session_ID).filter(Boolean));
  const avgSessionsPerUser  = activeUsers ? totalSessions / activeUsers : 0;
  const repeatQuestionRate  = totalQuestions > 0
    ? ((totalQuestions - totalUniqueQuestions) / totalQuestions) * 100 : 0;

  // ── Feedback ───────────────────────────────────────────────────────────────

  const totalLikes    = fc.filter(r => r.Feedback === 'LIKE').length;
  const totalDislikes = fc.filter(r => r.Feedback === 'DISLIKE').length;

  // ── Issues ─────────────────────────────────────────────────────────────────

  const totalIssues  = sumField(ft, 'Is_Issue');
  const kbGaps       = sumField(ft, 'Is_KB_Gap');
  const systemErrors = sumField(ft, 'Is_System_Error');
  const maskedData   = sumField(ft, 'Is_Placeholder_Data');
  const copilotLoops = sumField(ft, 'Is_Copilot_Loop');
  const sessionDrops = ft.filter(r => toInt(r.Is_Context_Drop) === 1).length;

  // ── Bot Types ──────────────────────────────────────────────────────────────

  const botResponses          = botRows.length;
  const nlsqlResponses        = fc.filter(r => r.Bot_Type === 'NLSQLAgent').length;
  const trainingBotResponses  = fc.filter(r => r.Bot_Type === 'Training Bot').length;
  const copilotSalesResponses = fc.filter(r => r.Bot_Type === 'Copilot Sales Bot').length;

  // Issue rate: decimal ratio (PBI shows 0.05, not 5%)
  const overallIssueRateByBot = botResponses > 0
    ? +((totalIssues / botResponses) * 100).toFixed(1) : 0;

  // ── Tokens / Performance ───────────────────────────────────────────────────

  const totalTokens           = ftu.reduce((s, r) => s + toInt(r.Total_Tokens), 0);
  const totalPromptTokens     = ftu.reduce((s, r) => s + toInt(r.Prompt_Tokens), 0);
  const totalCompletionTokens = ftu.reduce((s, r) => s + toInt(r.Completion_Tokens), 0);
  const avgTokensPerQuestion  = avgField(ftu, 'Total_Tokens');
  const queriesTracked        = ftu.length;
  const sessionsTracked       = distinctCount(ftu.map(r => r.Session_ID).filter(Boolean));
  const sqlSteps              = fls.filter(r => r.LLM_Step === 'first_sql_generation_llm');
  const avgSqlTokens          = avgField(sqlSteps, 'Total_Tokens');
  const retrySqlSteps         = fls.filter(r => r.LLM_Step === 'retry_sql_generation_1').length;
  const sqlRetryRate          = sqlSteps.length > 0 ? +((retrySqlSteps / sqlSteps.length) * 100).toFixed(1) : 0;
  const avgResponseTime       = avgField(fr, 'Response_Time_Seconds');

  // ────────────────────────────────────────────────────────────────────────────
  // CHART DATA
  // ────────────────────────────────────────────────────────────────────────────

  const allMonths    = sortMonths([...new Set(ft.map(r => r.Month).filter(Boolean))]);
  const rtAllMonths  = sortMonths([...new Set(fr.map(r => r.Month).filter(Boolean))]);
  const tuAllMonths  = sortMonths([...new Set(ftu.map(r => r.Month).filter(Boolean))]);

  // ── Executive Overview ─────────────────────────────────────────────────────

  // Column chart: Questions by Month (from AskQ_Cleaned flag=1, grouped by AskQ_Cleaned.Month)
  const questionsByMonth = allMonths.map(month => ({
    month,
    questions: userQuestionsNoBt.filter(r => r.Month === month).length,
  }));

  // Grouped bar: Likes + Dislikes by Month
  const feedbackByMonth = allMonths.map(month => {
    const mRows = fc.filter(r => r.Month === month);
    return {
      month,
      likes:    mRows.filter(r => r.Feedback === 'LIKE').length,
      dislikes: mRows.filter(r => r.Feedback === 'DISLIKE').length,
    };
  });

  // Horizontal bar: Bot Responses by Bot Type
  const botResponsesByBotType = (() => {
    const byBot = groupBy(botRows, 'Bot_Type');
    return Object.entries(byBot)
      .filter(([b]) => b)
      .map(([bot, rows]) => ({ bot, responses: rows.length }))
      .sort((a, b) => b.responses - a.responses);
  })();

  // Horizontal bar: Questions by Module (from ft, all modules)
  const questionsByModule = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([module, rows]) => ({ module, count: rows.length }))
      .sort((a, b) => b.count - a.count);
  })();

  // ── Issue Analysis ─────────────────────────────────────────────────────────

  // Line chart: Total Issues by Month
  const issuesByMonth = allMonths.map(month => ({
    month,
    issues: sumField(ft.filter(r => r.Month === month), 'Is_Issue'),
  }));

  // Pie: Issues by Type
  const issueBreakdown = [
    { name: "Questions Training Bot Couldn't Answer", value: kbGaps },
    { name: 'Bot Forgot the Conversation', value: sessionDrops },
    { name: 'System Errors',        value: systemErrors },
  ].filter(d => d.value > 0);

  // Horizontal bar: Issues by Module (all modules)
  const issuesByModule = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([module, rows]) => ({ module, issues: sumField(rows, 'Is_Issue') }))
      .sort((a, b) => b.issues - a.issues);
  })();

  // Horizontal bar: Issues by Bot Type
  const issuesByBot = (() => {
    const byBot = groupBy(ft, 'Bot_Type');
    return Object.entries(byBot)
      .filter(([b]) => b && b !== 'Human' && b !== 'Unknown')
      .map(([bot, rows]) => ({ bot, issues: sumField(rows, 'Is_Issue') }))
      .sort((a, b) => b.issues - a.issues);
  })();

  // ── User Activity ──────────────────────────────────────────────────────────

  // Line chart: Active Users by Month
  const activeUsersByMonth = allMonths.map(month => {
    const monthSessions = new Set(ft.filter(r => r.Month === month).map(r => r.Session_ID));
    return {
      month,
      activeUsers: distinctCount(
        userQuestionsNoBt.filter(r => monthSessions.has(r.Session_ID))
                         .map(r => r.User_Display).filter(Boolean)
      ),
    };
  });

  // Bar: All users by Question Count (scrollable chart, no slice)
  const questionsByUser = (() => {
    const byUser = groupBy(userQuestions, 'User_Display');
    return Object.entries(byUser)
      .filter(([u]) => u)
      .map(([user, rows]) => ({ user, count: rows.length }))
      .sort((a, b) => b.count - a.count);
  })();

  // Session → Module map (from ft)
  const sessionToModule = {};
  flatTable.forEach(r => { if (r.Session_ID && r.Module) sessionToModule[r.Session_ID] = r.Module; });

  // All users — stacked charts slice to selected top N client-side
  const topUsers = questionsByUser.map(x => x.user);

  // Top 5 modules
  const chartModules = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([m, rows]) => ({ m, count: rows.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(x => x.m);
  })();

  // Top 5 categories
  const chartCategories = (() => {
    const byCat = groupBy(userQuestions, 'Question_Category');
    return Object.entries(byCat)
      .filter(([c]) => c)
      .map(([c, rows]) => ({ c, count: rows.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(x => x.c);
  })();

  // Stacked horizontal bar: Questions by User per Module
  const questionsByUserModule = topUsers.map(user => {
    const entry = { user };
    const uRows = userQuestions.filter(r => r.User_Display === user);
    chartModules.forEach(mod => {
      entry[mod] = uRows.filter(r => sessionToModule[r.Session_ID] === mod).length;
    });
    return entry;
  });

  // Stacked horizontal bar: Questions by Category per User
  const questionsByUserCategory = topUsers.map(user => {
    const entry = { user };
    const uRows = userQuestions.filter(r => r.User_Display === user);
    chartCategories.forEach(cat => {
      entry[cat] = uRows.filter(r => r.Question_Category === cat).length;
    });
    return entry;
  });

  // ── Bot Performance ────────────────────────────────────────────────────────

  // Horizontal bar: Avg Response Time by Bot Type
  const responseTimeByBot = (() => {
    const byBot = groupBy(fr, 'Bot_Type');
    return Object.entries(byBot)
      .filter(([b]) => b)
      .map(([bot, rows]) => ({ bot, avgTime: +avgField(rows, 'Response_Time_Seconds').toFixed(1) }))
      .sort((a, b) => b.avgTime - a.avgTime);
  })();

  // Line chart: Bot Responses by Month
  const botTypeNames = [...new Set(botRows.map(r => r.Bot_Type).filter(Boolean))];
  const botResponsesByMonth = allMonths.map(month => {
    const entry = { month };
    botTypeNames.forEach(bt => {
      entry[bt] = botRows.filter(r => r.Bot_Type === bt && r.Month === month).length;
    });
    return entry;
  });

  // Issues by Bot Type (from ft)
  const issuesByBotPerf = (() => {
    const byBot = groupBy(ft, 'Bot_Type');
    return Object.entries(byBot)
      .filter(([b]) => b && b !== 'Human' && b !== 'Unknown')
      .map(([bot, rows]) => ({ bot, issues: sumField(rows, 'Is_Issue') }))
      .sort((a, b) => b.issues - a.issues);
  })();

  // Grouped bar: Likes + Dislikes by Bot Type
  const likesByBot = (() => {
    const byBot = groupBy(fc, 'Bot_Type');
    return Object.entries(byBot)
      .filter(([b]) => b && b !== 'Unknown' && b !== 'Human')
      .map(([bot, rows]) => ({
        bot,
        likes:    rows.filter(r => r.Feedback === 'LIKE').length,
        dislikes: rows.filter(r => r.Feedback === 'DISLIKE').length,
      }))
      .sort((a, b) => b.likes - a.likes);
  })();

  // ── Token Usage ────────────────────────────────────────────────────────────

  const tokensByMonth = tuAllMonths.map(month => ({
    month,
    totalTokens: ftu.filter(r => r.Month === month).reduce((s, r) => s + toInt(r.Total_Tokens), 0),
  }));

  const tokensByModule = (() => {
    const byMod = groupBy(ftu, 'Module_Clean');
    return Object.entries(byMod)
      .filter(([m]) => m && m !== 'Unknown')
      .map(([module, rows]) => ({
        module,
        totalTokens: rows.reduce((s, r) => s + toInt(r.Total_Tokens), 0),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);
  })();

  const tokensByStep = (() => {
    const byStep = groupBy(fls, 'LLM_Step');
    return Object.entries(byStep)
      .filter(([s]) => s)
      .map(([step, rows]) => ({
        step: labelStep(step),
        rawStep: step,
        avgTokens: +avgField(rows, 'Total_Tokens').toFixed(0),
      }))
      .sort((a, b) => b.avgTokens - a.avgTokens);
  })();

  // Stacked area: Prompt vs Completion tokens by month
  const tokenSplitByMonth = tuAllMonths.map(month => {
    const mRows = ftu.filter(r => r.Month === month);
    return {
      month,
      promptTokens:     mRows.reduce((s, r) => s + toInt(r.Prompt_Tokens), 0),
      completionTokens: mRows.reduce((s, r) => s + toInt(r.Completion_Tokens), 0),
    };
  });

  // Issue rate trend: (issues / bot responses) per month
  const issueRateByMonth = allMonths.map(month => {
    const mBotResponses = botRows.filter(r => r.Month === month).length;
    return {
      month,
      issueRate: mBotResponses > 0
        ? +((sumField(ft.filter(r => r.Month === month), 'Is_Issue') / mBotResponses) * 100).toFixed(1)
        : 0,
    };
  });

  // Issue questions table — user questions from sessions flagged as Is_Issue = 1
  const issueSessions = new Set(ft.filter(r => toInt(r.Is_Issue) === 1).map(r => r.Session_ID));
  const issueRows = userQuestions
    .filter(r => issueSessions.has(r.Session_ID))
    .map(r => {
      const sessionFt = ft.filter(f => f.Session_ID === r.Session_ID);
      const isSystemError = sessionFt.some(f => toInt(f.Is_System_Error) === 1);
      const isKbGap       = sessionFt.some(f => toInt(f.Is_KB_Gap) === 1);
      const issueType     = isSystemError ? 'System Error'
                          : isKbGap       ? "Training Bot Couldn't Answer"
                          :                 'Issue';
      return {
        date:      r.Date,
        month:     r.Month,
        user:      r.User_Display ?? '',
        module:    sessionToModule[r.Session_ID] ?? '',
        question:  r.Message ?? '',
        issueType,
      };
    })
    .sort((a, b) => a.date > b.date ? -1 : 1);

  // KB Gaps by Module — which modules have the most training gaps
  const kbGapsByModule = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([module, rows]) => ({ module, kbGaps: sumField(rows, 'Is_KB_Gap') }))
      .filter(d => d.kbGaps > 0)
      .sort((a, b) => b.kbGaps - a.kbGaps);
  })();

  // ── Per-month metrics (for flexible Comparison page) ──────────────────────

  function computeMonthMetrics(month) {
    const ftM  = ft.filter(r => r.Month === month);
    const sessM = new Set(ftM.map(r => r.Session_ID));
    const fcM  = fc.filter(r => sessM.has(r.Session_ID));
    const uqM  = fcM.filter(r => toInt(r.Is_User_Question_Flag) === 1);
    const botM = fcM.filter(r => r.Sender_Type === 'bot' && r.Bot_Type !== 'Unknown');
    const ftuM = ftu.filter(r => r.Month === month);
    const frM  = fr.filter(r => r.Month === month);
    const issM = sumField(ftM, 'Is_Issue');
    const brM  = botM.length;
    return {
      totalUserQuestions:    uqM.length,
      activeUsers:           distinctCount(uqM.map(r => r.User_Display).filter(Boolean)),
      totalLikes:            fcM.filter(r => r.Feedback === 'LIKE').length,
      totalDislikes:         fcM.filter(r => r.Feedback === 'DISLIKE').length,
      totalIssues:           issM,
      systemErrors:          sumField(ftM, 'Is_System_Error'),
      kbGaps:                sumField(ftM, 'Is_KB_Gap'),
      sessionDrops:          ftM.filter(r => toInt(r.Is_Context_Drop) === 1).length,
      overallIssueRateByBot: brM > 0 ? +((issM / brM) * 100).toFixed(1) : 0,
      avgResponseTime:       +avgField(frM, 'Response_Time_Seconds').toFixed(1),
      nlsqlResponses:        fcM.filter(r => r.Bot_Type === 'NLSQLAgent').length,
      totalTokens:           ftuM.reduce((s, r) => s + toInt(r.Total_Tokens), 0),
      avgTokensPerQuestion:  +avgField(ftuM, 'Total_Tokens').toFixed(0),
    };
  }

  const allMonthlyMetrics = Object.fromEntries(allMonths.map(m => [m, computeMonthMetrics(m)]));

  // ── Month-over-Month ──────────────────────────────────────────────────────

  function momPct(curr, prev) {
    if (!prev || prev === 0) return null;
    return +((curr - prev) / Math.abs(prev) * 100).toFixed(1);
  }

  const currentMonth  = allMonths[allMonths.length - 1] ?? null;
  const previousMonth = allMonths[allMonths.length - 2] ?? null;

  const mom = (() => {
    if (!currentMonth || !previousMonth) return { currentMonth, previousMonth };

    const ftC = ft.filter(r => r.Month === currentMonth);
    const ftP = ft.filter(r => r.Month === previousMonth);
    const sessC = new Set(ftC.map(r => r.Session_ID));
    const sessP = new Set(ftP.map(r => r.Session_ID));
    const fcC = fc.filter(r => sessC.has(r.Session_ID));
    const fcP = fc.filter(r => sessP.has(r.Session_ID));
    const uqC = fcC.filter(r => toInt(r.Is_User_Question_Flag) === 1);
    const uqP = fcP.filter(r => toInt(r.Is_User_Question_Flag) === 1);
    const botC = fcC.filter(r => r.Sender_Type === 'bot' && r.Bot_Type !== 'Unknown');
    const botP = fcP.filter(r => r.Sender_Type === 'bot' && r.Bot_Type !== 'Unknown');
    const ftuC = ftu.filter(r => r.Month === currentMonth);
    const ftuP = ftu.filter(r => r.Month === previousMonth);
    const frC = fr.filter(r => r.Month === currentMonth);
    const frP = fr.filter(r => r.Month === previousMonth);
    const issC = sumField(ftC, 'Is_Issue');
    const issP = sumField(ftP, 'Is_Issue');
    const brC = botC.length;
    const brP = botP.length;

    const currRT = +avgField(frC, 'Response_Time_Seconds').toFixed(1);
    const prevRT = +avgField(frP, 'Response_Time_Seconds').toFixed(1);
    const currIR = brC > 0 ? +((issC / brC) * 100).toFixed(1) : 0;
    const prevIR = brP > 0 ? +((issP / brP) * 100).toFixed(1) : 0;
    const currTok = ftuC.reduce((s, r) => s + toInt(r.Total_Tokens), 0);
    const prevTok = ftuP.reduce((s, r) => s + toInt(r.Total_Tokens), 0);
    const currATQ = +avgField(ftuC, 'Total_Tokens').toFixed(0);
    const prevATQ = +avgField(ftuP, 'Total_Tokens').toFixed(0);
    const currAU  = distinctCount(uqC.map(r => r.User_Display).filter(Boolean));
    const prevAU  = distinctCount(uqP.map(r => r.User_Display).filter(Boolean));

    // Raw values for comparison table
    const current = {
      totalUserQuestions:    uqC.length,
      activeUsers:           currAU,
      totalLikes:            fcC.filter(r => r.Feedback === 'LIKE').length,
      totalDislikes:         fcC.filter(r => r.Feedback === 'DISLIKE').length,
      totalIssues:           issC,
      sessionDrops:          ftC.filter(r => toInt(r.Is_Context_Drop) === 1).length,
      kbGaps:                sumField(ftC, 'Is_KB_Gap'),
      systemErrors:          sumField(ftC, 'Is_System_Error'),
      overallIssueRateByBot: currIR,
      avgResponseTime:       currRT,
      totalTokens:           currTok,
      avgTokensPerQuestion:  currATQ,
      nlsqlResponses:        fcC.filter(r => r.Bot_Type === 'NLSQLAgent').length,
    };
    const previous = {
      totalUserQuestions:    uqP.length,
      activeUsers:           prevAU,
      totalLikes:            fcP.filter(r => r.Feedback === 'LIKE').length,
      totalDislikes:         fcP.filter(r => r.Feedback === 'DISLIKE').length,
      totalIssues:           issP,
      sessionDrops:          ftP.filter(r => toInt(r.Is_Context_Drop) === 1).length,
      kbGaps:                sumField(ftP, 'Is_KB_Gap'),
      systemErrors:          sumField(ftP, 'Is_System_Error'),
      overallIssueRateByBot: prevIR,
      avgResponseTime:       prevRT,
      totalTokens:           prevTok,
      avgTokensPerQuestion:  prevATQ,
      nlsqlResponses:        fcP.filter(r => r.Bot_Type === 'NLSQLAgent').length,
    };

    // Comparison chart data
    const allUsers = [...new Set([...uqC, ...uqP].map(r => r.User_Display).filter(Boolean))];
    const userComparison = allUsers
      .map(u => ({
        user:     u,
        current:  uqC.filter(r => r.User_Display === u).length,
        previous: uqP.filter(r => r.User_Display === u).length,
      }))
      .sort((a, b) => (b.current + b.previous) - (a.current + a.previous))
      .slice(0, 10);

    const allMods = [...new Set([...ftC, ...ftP].map(r => r.Module).filter(Boolean))];
    const moduleComparison = allMods
      .map(m => ({
        module:   m,
        current:  ftC.filter(r => r.Module === m).length,
        previous: ftP.filter(r => r.Module === m).length,
      }))
      .sort((a, b) => (b.current + b.previous) - (a.current + a.previous))
      .slice(0, 10);

    const issueComparison = allMods
      .map(m => ({
        module:   m,
        current:  sumField(ftC.filter(r => r.Module === m), 'Is_Issue'),
        previous: sumField(ftP.filter(r => r.Module === m), 'Is_Issue'),
      }))
      .filter(d => d.current > 0 || d.previous > 0)
      .sort((a, b) => (b.current + b.previous) - (a.current + a.previous))
      .slice(0, 10);

    return {
      currentMonth,
      previousMonth,
      current,
      previous,
      charts: { userComparison, moduleComparison, issueComparison },
      // % changes
      totalUserQuestions:    momPct(uqC.length, uqP.length),
      activeUsers:           momPct(currAU, prevAU),
      totalLikes:            momPct(current.totalLikes, previous.totalLikes),
      totalDislikes:         momPct(current.totalDislikes, previous.totalDislikes),
      totalIssues:           momPct(issC, issP),
      sessionDrops:          momPct(current.sessionDrops, previous.sessionDrops),
      kbGaps:                momPct(current.kbGaps, previous.kbGaps),
      systemErrors:          momPct(current.systemErrors, previous.systemErrors),
      overallIssueRateByBot: momPct(currIR, prevIR),
      avgResponseTime:       momPct(currRT, prevRT),
      totalTokens:           momPct(currTok, prevTok),
      totalSessions:         momPct(
        distinctCount(fcC.map(r => r.Session_ID).filter(Boolean)),
        distinctCount(fcP.map(r => r.Session_ID).filter(Boolean))
      ),
      nlsqlResponses:        momPct(current.nlsqlResponses, previous.nlsqlResponses),
      avgTokensPerQuestion:  momPct(currATQ, prevATQ),
    };
  })();

  // ── Last updated date ────────────────────────────────────────────────────
  const lastUpdated = (() => {
    const dates = fc.map(r => r.Date).filter(Boolean).sort();
    return dates[dates.length - 1] ?? null;
  })();

  // ── Page insights (auto-generated key takeaway per page) ─────────────────
  const topModule  = questionsByModule[0]?.module ?? null;
  const topUser    = questionsByUser[0]?.user ?? null;
  const topBotType = botResponsesByBotType[0]?.bot ?? null;
  const topStep    = tokensByStep[0]?.step ?? null;
  const latestMonth = allMonths[allMonths.length - 1] ?? null;

  const insights = {
    overview: topModule && latestMonth
      ? `${latestMonth} data: ${totalUserQuestions.toLocaleString()} questions from ${activeUsers} users across ${questionsByModule.length} ERP modules. Top module: ${topModule}.`
      : `${totalUserQuestions.toLocaleString()} total questions from ${activeUsers} active users.`,

    issues: totalIssues > 0
      ? `${totalIssues} issues flagged. ${systemErrors > 0 ? `${systemErrors} system errors` : ''} ${kbGaps > 0 ? `· ${kbGaps} questions the Training Bot couldn't answer` : ''}${sessionDrops > 0 ? ` · ${sessionDrops} forgotten conversations` : ''}.`.replace(/^·\s*/, '').trim()
      : 'No issues flagged in the selected period — everything looks healthy.',

    users: topUser
      ? `${activeUsers} active users this period. ${topUser} leads with ${questionsByUser[0]?.count ?? 0} questions. Average ${Math.round(avgQuestionsPerUser)} questions per user.`
      : `${activeUsers} active users with ${totalUserQuestions.toLocaleString()} questions total.`,

    bots: topBotType
      ? `${topBotType} handled the most responses. Average response time: ${+avgResponseTime.toFixed(1)}s. Overall issue rate: ${overallIssueRateByBot}%.`
      : `Average response time: ${+avgResponseTime.toFixed(1)}s across all bot types.`,

    tokens: topStep
      ? `${totalTokens.toLocaleString()} total tokens consumed. ${topStep} is the most token-intensive LLM step at an average of ${tokensByStep[0]?.avgTokens?.toLocaleString() ?? 0} tokens.`
      : `${totalTokens.toLocaleString()} total tokens used across ${queriesTracked} tracked queries.`,
  };

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    filterOptions,
    allMonths,
    allMonthlyMetrics,
    lastUpdated,
    insights,
    mom,
    measures: {
      totalQuestions,
      totalUserQuestions,
      totalUniqueQuestions,
      activeUsers,
      avgQuestionsPerUser: Math.round(avgQuestionsPerUser),
      totalSessions,
      avgSessionsPerUser:  Math.round(avgSessionsPerUser),
      repeatQuestionRate:  +repeatQuestionRate.toFixed(1),
      totalLikes,
      totalDislikes,
      totalIssues,
      sessionDrops,
      kbGaps,
      maskedData,
      copilotLoops,
      systemErrors,
      overallIssueRateByBot,
      botResponses,
      nlsqlResponses,
      trainingBotResponses,
      copilotSalesResponses,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      avgTokensPerQuestion: +avgTokensPerQuestion.toFixed(0),
      queriesTracked,
      sessionsTracked,
      avgSqlTokens:    +avgSqlTokens.toFixed(0),
      sqlRetryRate,
      avgResponseTime: +avgResponseTime.toFixed(1),
    },
    charts: {
      // Executive Overview
      questionsByMonth,
      feedbackByMonth,
      botResponsesByBotType,
      questionsByModule,
      // Issue Analysis
      issuesByMonth,
      issueBreakdown,
      issuesByModule,
      issuesByBot,
      // User Activity
      activeUsersByMonth,
      questionsByUser,
      questionsByUserModule,
      questionsByUserCategory,
      chartModules,
      chartCategories,
      // Bot Performance
      botResponsesByMonth,
      botTypeNames,
      issuesByBotPerf,
      likesByBot,
      responseTimeByBot,
      // Token Usage
      tokensByMonth,
      tokenSplitByMonth,
      tokensByModule,
      tokensByStep,
      // Issue Analysis extras
      issueRateByMonth,
      kbGapsByModule,
      issueRows,
      // User drilldown — all filtered question rows (modal reads these)
      drilldownRows: userQuestions.map(r => ({
        user:     r.User_Display ?? '',
        date:     r.Date,
        month:    r.Month,
        session:  r.Session_ID ?? '',
        module:   sessionToModule[r.Session_ID] ?? '',
        category: r.Question_Category ?? '',
        message:  r.Message ?? '',
      })),
    },
  };
}
