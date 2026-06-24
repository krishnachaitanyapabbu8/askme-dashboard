import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import PageInsight from '../components/PageInsight';

const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47', '#FF0000'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };
const BAR_H = 36;

const EmptyState = ({ message = 'No data for the selected filters.' }) => (
  <div className="empty-state">{message}</div>
);

export default function ExecutiveOverview({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c, mom, insights } = data;

  return (
    <div className="page">
      <PageInsight
        title="Executive Overview"
        subtitle="High-level summary of chatbot usage, user engagement and feedback."
        insight={insights?.overview}
      />

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Total User Questions" value={m.totalUserQuestions} trend={mom.totalUserQuestions}
          prevValue={mom?.previous?.totalUserQuestions} sub="Questions asked by human users" />
        <KPICard label="Active Users" value={m.activeUsers} trend={mom.activeUsers}
          prevValue={mom?.previous?.activeUsers} sub="Unique users who asked questions" />
        <KPICard label="Likes" value={m.totalLikes} trend={mom.totalLikes}
          prevValue={mom?.previous?.totalLikes} accent="#10B981" sub="Positive feedback received" />
        <KPICard label="Dislikes" value={m.totalDislikes} trend={mom.totalDislikes}
          prevValue={mom?.previous?.totalDislikes} accent="#EF4444" invertTrend sub="Negative feedback received" />
        <KPICard label="Chatbot Issues" value={m.totalIssues} trend={mom.totalIssues}
          prevValue={mom?.previous?.totalIssues} accent="#ED7D31" invertTrend sub="Sessions with any issue flagged" />
      </div>

      {/* Row 1: Questions by Month (Line) | Bot Responses by Bot Type (Donut) */}
      <div className="chart-row">
        <ChartCard title="Questions by Month" minHeight={300}>
          {c.questionsByMonth.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={c.questionsByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }}
                  label={{ value: 'Questions', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="questions" name="Questions"
                  stroke="#4472C4" strokeWidth={2.5} dot={{ r: 4, fill: '#4472C4' }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="questions" position="top" style={{ fontSize: 10, fill: '#4472C4', fontWeight: 600 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Bot Responses by Bot Type" minHeight={300}>
          {c.botResponsesByBotType.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={c.botResponsesByBotType} dataKey="responses" nameKey="bot"
                  cx="50%" cy="50%" innerRadius={65} outerRadius={100}
                  paddingAngle={3} label={({ bot, percent }) => `${bot} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {c.botResponsesByBotType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [v.toLocaleString(), name]} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Feedback by Month | Questions by Module */}
      <div className="chart-row">
        <ChartCard title="Feedback by Month" minHeight={300}>
          {c.feedbackByMonth.every(d => d.likes === 0 && d.dislikes === 0) ? <EmptyState message="No feedback data available." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={c.feedbackByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="likes"    name="Likes"    fill="#10B981" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="likes"    position="top" style={{ fontSize: 10, fill: '#10B981' }} />
                </Bar>
                <Bar dataKey="dislikes" name="Dislikes" fill="#EF4444" radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="dislikes" position="top" style={{ fontSize: 10, fill: '#EF4444' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Questions by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.questionsByModule.slice(0, n);
            if (d.length === 0) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 50, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Count', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Questions" fill="#4472C4" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>
    </div>
  );
}
