import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import PageInsight from '../components/PageInsight';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };

const EmptyState = ({ message = 'No data for the selected filters.' }) => (
  <div className="empty-state">{message}</div>
);

export default function BotPerformance({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c, mom, insights } = data;

  return (
    <div className="page">
      <PageInsight
        title="Bot Performance"
        subtitle="Monitor how each bot type is performing — response speed, issue rates and user feedback."
        insight={insights?.bots}
      />

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="NLSQLAgent Responses" value={m.nlsqlResponses} trend={mom.nlsqlResponses}
          prevValue={mom?.previous?.nlsqlResponses} sub="Data query bot responses" />
        <KPICard label="Training Bot Responses" value={m.trainingBotResponses}
          sub="Process / how-to bot responses" />
        <KPICard label="Copilot Sales Bot Responses" value={m.copilotSalesResponses}
          sub="Sales copilot bot responses" />
        <KPICard label="Issue Rate by Bot" value={m.overallIssueRateByBot} format="percent"
          accent="#ED7D31" trend={mom.overallIssueRateByBot} prevValue={mom?.previous?.overallIssueRateByBot}
          invertTrend sub="Issues per bot response" />
        <KPICard label="SQL Retry Rate" value={m.sqlRetryRate} format="percent"
          accent="#FFC000" sub="% of SQL queries that needed retry" />
        <KPICard label="Avg Response Time" value={m.avgResponseTime} format="time"
          trend={mom.avgResponseTime} prevValue={mom?.previous?.avgResponseTime}
          invertTrend sub="Seconds from user question to bot reply" />
      </div>

      {/* Row 1: Bot Responses by Month | Avg Response Time by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Bot Responses by Month" minHeight={300}>
          {c.botTypeNames.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={c.botResponsesByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }}
                  label={{ value: 'Responses', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {c.botTypeNames.map((bt, i) => (
                  <Line key={bt} type="monotone" dataKey={bt} name={bt}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Avg Response Time by Bot Type" minHeight={300}>
          {c.responseTimeByBot.length === 0 ? <EmptyState message="No response time data available." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={c.responseTimeByBot}
                margin={{ top: 5, right: 60, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="s"
                  label={{ value: 'Seconds (s)', position: 'insideBottom', offset: -8, ...AL }} />
                <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v}s`, 'Avg Time']} />
                <Bar dataKey="avgTime" name="Avg Response Time (s)" fill="#4472C4" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="avgTime" position="right" formatter={v => `${v}s`} style={{ fontSize: 10, fill: '#64748B' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Issues by Bot Type | Likes & Dislikes by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Issues by Bot Type" minHeight={300}>
          {c.issuesByBotPerf.length === 0 || c.issuesByBotPerf.every(r => r.issues === 0) ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={c.issuesByBotPerf}
                margin={{ top: 5, right: 60, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
                <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="issues" name="Issues" fill="#ED7D31" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="issues" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Likes & Dislikes by Bot Type" minHeight={300}>
          {c.likesByBot.length === 0 ? <EmptyState message="No feedback data available." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={c.likesByBot}
                margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  label={{ value: 'Count', position: 'insideBottom', offset: -8, ...AL }} />
                <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="likes"    name="Likes"    fill="#10B981" radius={[0, 3, 3, 0]} />
                <Bar dataKey="dislikes" name="Dislikes" fill="#EF4444" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
