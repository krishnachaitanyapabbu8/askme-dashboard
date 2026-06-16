import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import KPICard, { fmt } from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47', '#FF0000'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };

const RADIAN = Math.PI / 180;
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.04) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function IssueAnalysis({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c } = data;

  return (
    <div className="page">
      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="KB Gaps"       value={m.kbGaps}       accent="#4472C4" />
        <KPICard label="System Errors" value={m.systemErrors} accent="#FF0000" />
        <KPICard label="Masked Data"   value={m.maskedData}   accent="#A5A5A5" />
        <KPICard label="Copilot Loops" value={m.copilotLoops} accent="#FFC000" />
        <KPICard label="Total Issues"  value={m.totalIssues}  accent="#ED7D31" />
        <KPICard label="Context Drops" value={m.sessionDrops} accent="#70AD47" />
      </div>

      {/* Row 1: Total Issue Trend | Issues by Type */}
      <div className="chart-row">
        <ChartCard title="Total Issue Trend" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={c.issuesByMonth} margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="issues" name="Total Issues"
                stroke="#4472C4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Issues by Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={c.issueBreakdown} cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                dataKey="value" labelLine={false} label={renderLabel}
              >
                {c.issueBreakdown.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Issues by Module | Issues by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Issues by ERP Module" scrollable minHeight={300}>
          <ResponsiveContainer width="100%" height={Math.max(260, c.issuesByModule.length * 36)}>
            <BarChart
              layout="vertical" data={c.issuesByModule}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
              <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="issues" name="Issues" fill="#ED7D31" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Issues by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical" data={c.issuesByBot}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
              <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="issues" name="Issues" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Issue Rate Trend | KB Gaps by Module */}
      <div className="chart-row">
        <ChartCard title="Issue Rate Trend (% of Bot Responses)" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={c.issueRateByMonth} margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%"
                label={{ value: 'Issue Rate (%)', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v}%`, 'Issue Rate']} />
              <ReferenceLine y={m.overallIssueRateByBot} stroke="#A5A5A5" strokeDasharray="4 4"
                label={{ value: `Avg ${m.overallIssueRateByBot}%`, fill: '#A5A5A5', fontSize: 11 }} />
              <Line
                type="monotone" dataKey="issueRate" name="Issue Rate %"
                stroke="#ED7D31" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="KB Gaps by ERP Module" scrollable minHeight={300}>
          <ResponsiveContainer width="100%" height={Math.max(260, c.kbGapsByModule.length * 36)}>
            <BarChart
              layout="vertical" data={c.kbGapsByModule}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'KB Gaps', position: 'insideBottom', offset: -8, ...AL }} />
              <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="kbGaps" name="KB Gaps" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
