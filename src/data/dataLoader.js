import * as XLSX from 'xlsx';

const MASTER_PATH = './AskQ_Master_Dashboard.xlsx';

async function fetchWorkbook(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load: ${path} — ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
}

function getSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) { console.warn(`Sheet "${sheetName}" not found.`); return []; }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const wb = await fetchWorkbook(MASTER_PATH);

  const cleaned      = getSheet(wb, 'AskQ_Cleaned');
  const responseTime = getSheet(wb, 'AskQ_ResponseTime');
  const tokenUsage   = getSheet(wb, 'AskQ_TokenUsage');
  const llmSteps     = getSheet(wb, 'AskQ_LLMSteps');
  const flatTable    = getSheet(wb, 'PowerBI_Flat_Table');

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
    ? +((totalIssues / botResponses)).toFixed(2) : 0;

  // ── Tokens / Performance ───────────────────────────────────────────────────

  const totalTokens           = ftu.reduce((s, r) => s + toInt(r.Total_Tokens), 0);
  const totalPromptTokens     = ftu.reduce((s, r) => s + toInt(r.Prompt_Tokens), 0);
  const totalCompletionTokens = ftu.reduce((s, r) => s + toInt(r.Completion_Tokens), 0);
  const avgTokensPerQuestion  = avgField(ftu, 'Total_Tokens');
  const queriesTracked        = ftu.length;
  const sessionsTracked       = distinctCount(ftu.map(r => r.Session_ID).filter(Boolean));
  const sqlSteps              = fls.filter(r => r.LLM_Step === 'first_sql_generation_llm');
  const avgSqlTokens          = avgField(sqlSteps, 'Total_Tokens');
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

  // Horizontal bar: Questions by Module (from ft, top 12)
  const questionsByModule = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([module, rows]) => ({ module, count: rows.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  })();

  // ── Issue Analysis ─────────────────────────────────────────────────────────

  // Line chart: Total Issues by Month
  const issuesByMonth = allMonths.map(month => ({
    month,
    issues: sumField(ft.filter(r => r.Month === month), 'Is_Issue'),
  }));

  // Pie: Issues by Type
  const issueBreakdown = [
    { name: 'KB Gaps',       value: kbGaps },
    { name: 'Context Drops', value: sessionDrops },
    { name: 'System Errors', value: systemErrors },
    { name: 'Masked Data',   value: maskedData },
    { name: 'Copilot Loops', value: copilotLoops },
  ].filter(d => d.value > 0);

  // Horizontal bar: Issues by Module
  const issuesByModule = (() => {
    const byMod = groupBy(ft, 'Module');
    return Object.entries(byMod)
      .filter(([m]) => m)
      .map(([module, rows]) => ({ module, issues: sumField(rows, 'Is_Issue') }))
      .sort((a, b) => b.issues - a.issues)
      .slice(0, 12);
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

  // Bar: Top 10 Users by Question Count
  const questionsByUser = (() => {
    const byUser = groupBy(userQuestions, 'User_Display');
    return Object.entries(byUser)
      .filter(([u]) => u)
      .map(([user, rows]) => ({ user, count: rows.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  // Session → Module map (from ft)
  const sessionToModule = {};
  flatTable.forEach(r => { if (r.Session_ID && r.Module) sessionToModule[r.Session_ID] = r.Module; });

  const topUsers = questionsByUser.slice(0, 8).map(x => x.user);

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
      .filter(([b]) => b && b !== 'Human')
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
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 12);
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

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    filterOptions,
    measures: {
      totalQuestions,
      totalUserQuestions,
      totalUniqueQuestions,
      activeUsers,
      avgQuestionsPerUser: +avgQuestionsPerUser.toFixed(2),
      totalSessions,
      avgSessionsPerUser:  +avgSessionsPerUser.toFixed(2),
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
      tokensByModule,
      tokensByStep,
    },
  };
}
