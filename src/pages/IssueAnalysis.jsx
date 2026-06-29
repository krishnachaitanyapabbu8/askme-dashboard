import React, { useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import KPICard, { fmt } from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import PageInsight from '../components/PageInsight';

const COLORS = ['#4472C4', '#EF4444', '#A5A5A5', '#FFC000', '#10B981', '#ED7D31'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };
const BAR_H = 36;

const EmptyState = ({ message = 'No data for the selected filters.' }) => (
  <div className="empty-state">{message}</div>
);

const RADIAN = Math.PI / 180;
const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const ISSUE_TYPE_COLORS = {
  'System Error':                   { bg: '#FEE2E2', color: '#DC2626' },
  "Training Bot Couldn't Answer":   { bg: '#DBEAFE', color: '#1D4ED8' },
  'Issue':                          { bg: '#FEF9C3', color: '#854D0E' },
};

export default function IssueAnalysis({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c, mom, insights } = data;
  const [search, setSearch] = useState('');
  const [expandedSessions, setExpandedSessions] = useState(new Set());

  const toggleSession = useCallback((id) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const filteredIssueRows = c.issueRows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    const msgMatch = (r.messages || []).some(m => m.message.toLowerCase().includes(q));
    return (
      msgMatch ||
      (r.user || '').toLowerCase().includes(q) ||
      (r.module || '').toLowerCase().includes(q) ||
      (r.issueType || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="page">
      <PageInsight
        title="Issue Analysis"
        subtitle="Track and diagnose chatbot failures — system errors, unanswered questions and forgotten conversations."
        insight={insights?.issues}
      />

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Questions Training Bot Couldn't Answer" value={m.kbGaps}
          accent="#4472C4" trend={mom.kbGaps} prevValue={mom?.previous?.kbGaps} invertTrend
          sub="RAG knowledge base gaps" icon="📚" />
        <KPICard label="System Errors" value={m.systemErrors}
          accent="#EF4444" trend={mom.systemErrors} prevValue={mom?.previous?.systemErrors} invertTrend
          sub="SQL / query execution failures" icon="⚙" />
        <KPICard label="Total Issues" value={m.totalIssues}
          accent="#ED7D31" trend={mom.totalIssues} prevValue={mom?.previous?.totalIssues} invertTrend
          sub="All issue types combined" icon="⚑" />
        <KPICard label="Bot Forgot the Conversation" value={m.sessionDrops}
          accent="#10B981" trend={mom.sessionDrops} prevValue={mom?.previous?.sessionDrops} invertTrend
          sub="Sessions where context was lost" icon="↺" />
      </div>

      {/* Row 1: Total Issue Trend | Issues by Type */}
      <div className="chart-row">
        <ChartCard title="Total Issue Trend" minHeight={300}>
          {c.issuesByMonth.every(d => d.issues === 0) ? <EmptyState message="No issues in the selected period." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={c.issuesByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }}
                  label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="issues" name="Total Issues"
                  stroke="#ED7D31" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="issues" position="top" style={{ fontSize: 10, fill: '#ED7D31', fontWeight: 600 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Issues by Type" minHeight={300}>
          {c.issueBreakdown.length === 0 ? <EmptyState message="No issues flagged." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={c.issueBreakdown} cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100} paddingAngle={3}
                  dataKey="value" labelLine={false} label={renderLabel}>
                  {c.issueBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Issues by Module | Issues by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Issues by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.issuesByModule.slice(0, n);
            if (d.length === 0 || d.every(r => r.issues === 0)) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 50, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issues" name="Issues" fill="#ED7D31" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="issues" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard title="Issues by Bot Type" minHeight={300}>
          {c.issuesByBot.length === 0 || c.issuesByBot.every(r => r.issues === 0) ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={c.issuesByBot} margin={{ top: 5, right: 50, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  label={{ value: 'Issues', position: 'insideBottom', offset: -8, ...AL }} />
                <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="issues" name="Issues" fill="#4472C4" radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="issues" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Issue Rate Trend | Questions Bot Couldn't Answer by Module */}
      <div className="chart-row">
        <ChartCard title="Issue Rate Trend (% of Bot Responses)" minHeight={300}>
          {c.issueRateByMonth.every(d => d.issueRate === 0) ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={c.issueRateByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%"
                  label={{ value: 'Issue Rate (%)', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v}%`, 'Issue Rate']} />
                <ReferenceLine y={m.overallIssueRateByBot} stroke="#A5A5A5" strokeDasharray="4 4"
                  label={{ value: `Avg ${m.overallIssueRateByBot}%`, fill: '#A5A5A5', fontSize: 11 }} />
                <Line type="monotone" dataKey="issueRate" name="Issue Rate %"
                  stroke="#ED7D31" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Questions Training Bot Couldn't Answer by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.kbGapsByModule.slice(0, n);
            if (d.length === 0) return <EmptyState message="No unanswered questions by module." />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 50, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Count', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="kbGaps" name="Questions Training Bot Couldn't Answer" fill="#4472C4" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="kbGaps" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>

      {/* Issues Sessions Table */}
      <div style={{ marginTop: 8 }}>
        <div className="issues-table-header">
          <h3 className="issues-table-title">
            Sessions with Issues <span className="issues-table-count">({c.issueRows.length} sessions)</span>
          </h3>
          <div className="issues-search-wrapper">
            <span className="issues-search-icon">🔍</span>
            <input
              className="issues-search-input"
              type="text"
              placeholder="Search by question, user, module or issue type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="issues-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>

        {filteredIssueRows.length === 0 ? (
          <div className="empty-state">
            {search ? `No results for "${search}"` : 'No issues found for the selected filters.'}
          </div>
        ) : (
          <div className="issues-session-list">
            {filteredIssueRows.map((row, i) => {
              const badgeStyle = ISSUE_TYPE_COLORS[row.issueType] || { bg: '#F1F5F9', color: '#475569' };
              const isExpanded = expandedSessions.has(row.sessionId);
              const firstUserMsg = row.messages.find(m => m.sender === 'User');

              return (
                <div key={row.sessionId || i} className="issue-session-card">
                  {/* Session header row — always visible */}
                  <div
                    className="issue-session-header"
                    onClick={() => toggleSession(row.sessionId)}
                  >
                    <div className="issue-session-meta">
                      <span className="td-date">{row.date}</span>
                      <span className="td-user">{row.user || '—'}</span>
                      <span className="td-module">{row.module || '—'}</span>
                      <span className="issue-type-badge" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
                        {row.issueType}
                      </span>
                    </div>
                    <div className="issue-session-preview">
                      <span className="issue-session-preview-text">
                        {firstUserMsg?.message?.slice(0, 100) ?? '—'}
                        {(firstUserMsg?.message?.length ?? 0) > 100 ? '…' : ''}
                      </span>
                      <span className="issue-session-toggle">
                        {isExpanded ? '▲ Hide' : `▼ View conversation (${row.messages.length} messages)`}
                      </span>
                    </div>
                  </div>

                  {/* Expanded conversation thread */}
                  {isExpanded && (
                    <div className="issue-conversation">
                      {row.messages.map((msg, mi) => (
                        <div key={mi} className={`conv-message conv-${msg.sender.toLowerCase()}`}>
                          <span className="conv-sender">{msg.sender === 'User' ? '👤 User' : '🤖 Bot'}</span>
                          <p className="conv-text">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
