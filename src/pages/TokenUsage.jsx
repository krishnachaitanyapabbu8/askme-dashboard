import React from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import KPICard, { fmt } from '../components/KPICard';
import ChartCard from '../components/ChartCard';

function formatTokenAxis(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value;
}

export default function TokenUsage({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c } = data;

  return (
    <div className="page">
      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Total Tokens" value={m.totalTokens} format="tokens" />
        <KPICard label="Queries Tracked" value={m.queriesTracked} />
        <KPICard label="Sessions Tracked" value={m.sessionsTracked} />
        <KPICard label="Avg Tokens / Question" value={m.avgTokensPerQuestion} />
        <KPICard label="Avg SQL Tokens" value={m.avgSqlTokens} />
      </div>

      {/* Charts Row 1 */}
      <div className="chart-row single">
        <ChartCard title="Total Tokens by Month" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={c.tokensByMonth}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4472C4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4472C4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatTokenAxis} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => [fmt(v, 'tokens'), 'Total Tokens']}
              />
              <Area
                type="monotone"
                dataKey="totalTokens"
                name="Total Tokens"
                stroke="#4472C4"
                strokeWidth={2}
                fill="url(#gradTokens)"
                dot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2: Prompt vs Completion split */}
      <div className="chart-row single">
        <ChartCard title="Prompt vs Completion Tokens by Month" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={c.tokenSplitByMonth}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="gradPrompt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4472C4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4472C4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompletion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ED7D31" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ED7D31" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatTokenAxis} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v, name) => [fmt(v, 'tokens'), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="promptTokens"
                name="Prompt Tokens"
                stroke="#4472C4"
                strokeWidth={2}
                fill="url(#gradPrompt)"
                dot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="completionTokens"
                name="Completion Tokens"
                stroke="#ED7D31"
                strokeWidth={2}
                fill="url(#gradCompletion)"
                dot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="chart-row">
        <ChartCard title="Total Tokens by ERP Module" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={c.tokensByModule}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tickFormatter={formatTokenAxis} tick={{ fontSize: 11 }} />
              <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => [fmt(v, 'tokens'), 'Total Tokens']}
              />
              <Bar dataKey="totalTokens" name="Total Tokens" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Tokens by LLM Step" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={c.tokensByStep}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="step" type="category" tick={{ fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => [v.toLocaleString(), 'Avg Tokens']}
              />
              <Bar dataKey="avgTokens" name="Avg Tokens" fill="#ED7D31" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
