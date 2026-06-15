import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47'];

export default function BotPerformance({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c } = data;

  return (
    <div className="page">
      {/* KPI Row — matches PBI: NLSQLAgent, Training Bot, Copilot Sales, Issue Rate by Bot, Avg Response Time */}
      <div className="kpi-row">
        <KPICard label="NLSQLAgent Responses"       value={m.nlsqlResponses} />
        <KPICard label="Training Bot Responses"     value={m.trainingBotResponses} />
        <KPICard label="Copilot Sales Bot Responses" value={m.copilotSalesResponses} />
        <KPICard label="Issue Rate by Bot"          value={m.overallIssueRateByBot} format="decimal" accent="#ED7D31" />
        <KPICard label="Avg Response Time (sec)"    value={m.avgResponseTime} format="time" />
      </div>

      {/* Row 1: Bot Responses by Month (lines per bot type) | Avg Response Time by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Bot Responses by Month" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={c.botResponsesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {c.botTypeNames.map((bt, i) => (
                <Line
                  key={bt}
                  type="monotone"
                  dataKey={bt}
                  name={bt}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Response Time by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={c.responseTimeByBot}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="s" />
              <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => [`${v}s`, 'Avg Time']}
              />
              <Bar dataKey="avgTime" name="Avg Response Time (s)" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Issues by Bot Type | Likes & Dislikes by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Issues by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={c.issuesByBotPerf}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="issues" name="Issues" fill="#ED7D31" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Likes & Dislikes by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={c.likesByBot}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="likes"    name="Likes"    fill="#70AD47" radius={[0, 3, 3, 0]} />
              <Bar dataKey="dislikes" name="Dislikes" fill="#FF0000" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
