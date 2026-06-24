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
const BAR_H = 36;

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
  const { measures: m, charts: c, mom } = data;

  return (
    <div className="page">
      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Questions Training Bot Couldn't Answer" value={m.kbGaps} accent="#4472C4" trend={mom.kbGaps} invertTrend />
        <KPICard label="System Errors"        value={m.systemErrors} accent="#FF0000" trend={mom.systemErrors} invertTrend />
        <KPICard label="Total Issues"         value={m.totalIssues}  accent="#ED7D31" trend={mom.totalIssues}  invertTrend />
        <KPICard label="Bot Forgot the Conversation" value={m.sessionDrops} accent="#70AD47" trend={mom.sessionDrops} invertTrend />
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
              <Line type="monotone" dataKey="issues" name="Total Issues"
                stroke="#4472C4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Issues by Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={c.issueBreakdown} cx="50%" cy="50%"
                innerRadius={60} outerRadius={100}
                dataKey="value" labelLine={false} label={renderLabel}>
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
        <ChartCard title="Issues by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.issuesByModule.slice(0, n);
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d}
                  margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issues" name="Issues" fill="#ED7D31" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard title="Issues by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={c.issuesByBot}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
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

      {/* Row 3: Issue Rate Trend | Questions Training Bot Couldn't Answer by Module */}
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
              <Line type="monotone" dataKey="issueRate" name="Issue Rate %"
                stroke="#ED7D31" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Questions Training Bot Couldn't Answer by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.kbGapsByModule.slice(0, n);
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d}
                  margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Count', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="kbGaps" name="Questions Training Bot Couldn't Answer" fill="#4472C4" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>

      {/* Questions with Issues Table */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 12 }}>
          Questions with Issues ({c.issueRows.length})
        </h3>
        {c.issueRows.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94A3B8' }}>No issues found for the selected filters.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  {['Date', 'User', 'Module', 'Issue Type', 'Question'].map(col => (
                    <th key={col} style={{
                      padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                      color: '#475569', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap'
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.issueRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#64748B' }}>{row.date}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#334155' }}>{row.user || '—'}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#334155' }}>{row.module || '—'}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                        background: row.issueType === 'System Error' ? '#FEE2E2' : row.issueType === "Training Bot Couldn't Answer" ? '#DBEAFE' : '#FEF9C3',
                        color:      row.issueType === 'System Error' ? '#DC2626' : row.issueType === "Training Bot Couldn't Answer" ? '#1D4ED8' : '#854D0E',
                      }}>{row.issueType}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#334155', maxWidth: 500 }}>{row.question}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
