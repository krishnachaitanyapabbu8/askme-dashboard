import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import PageInsight from '../components/PageInsight';
import DrilldownModal from '../components/DrilldownModal';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };
const BAR_H = 36;

const EmptyState = ({ message = 'No data for the selected filters.' }) => (
  <div className="empty-state">{message}</div>
);

export default function UserActivity({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c, mom, insights } = data;
  const [drilldownUser, setDrilldownUser] = useState(null);

  return (
    <div className="page">
      <DrilldownModal user={drilldownUser} rows={c.drilldownRows} onClose={() => setDrilldownUser(null)} />

      <PageInsight
        title="User Activity"
        subtitle="Understand who is using the chatbot, how often, and what they're asking."
        insight={insights?.users}
      />

      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Active Users" value={m.activeUsers} trend={mom.activeUsers}
          prevValue={mom?.previous?.activeUsers} sub="Unique users who asked questions" />
        <KPICard label="Avg Questions / User" value={m.avgQuestionsPerUser}
          sub="Average questions per active user" />
        <KPICard label="Total Sessions" value={m.totalSessions} trend={mom.totalSessions}
          sub="Unique conversation sessions" />
        <KPICard label="Avg Sessions / User" value={m.avgSessionsPerUser}
          sub="Sessions per active user" />
        <KPICard label="Repeat Question Rate" value={m.repeatQuestionRate} format="percent"
          accent="#FFC000" invertTrend sub="% of questions asked more than once" />
      </div>

      {/* Row 1: Questions by User | Active Users by Month */}
      <div className="chart-row">
        <ChartCard title="Questions by User — click a bar to drill down" scrollable minHeight={320} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.questionsByUser.slice(0, n);
            if (d.length === 0) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(280, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 50, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Questions', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Questions" fill="#4472C4" radius={[0, 3, 3, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(payload) => setDrilldownUser(payload.user)}>
                    <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#64748B' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard title="Active Users by Month" minHeight={320}>
          {c.activeUsersByMonth.every(d => d.activeUsers === 0) ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={c.activeUsersByMonth} margin={{ top: 10, right: 20, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }}
                  label={{ value: 'Users', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="activeUsers" name="Active Users"
                  stroke="#4472C4" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="activeUsers" position="top" style={{ fontSize: 10, fill: '#4472C4', fontWeight: 600 }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Questions by User per Module | Questions by Category per User */}
      <div className="chart-row">
        <ChartCard title="Questions by User per Module" scrollable minHeight={320} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.questionsByUserModule.slice(0, n);
            if (d.length === 0 || c.chartModules.length === 0) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(280, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Questions', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {c.chartModules.map((mod, i) => (
                    <Bar key={mod} dataKey={mod} name={mod} stackId="mod"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === c.chartModules.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>

        <ChartCard title="Questions by Category per User" scrollable minHeight={320} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.questionsByUserCategory.slice(0, n);
            if (d.length === 0 || c.chartCategories.length === 0) return <EmptyState />;
            return (
              <ResponsiveContainer width="100%" height={Math.max(280, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Questions', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {c.chartCategories.map((cat, i) => (
                    <Bar key={cat} dataKey={cat} name={cat} stackId="cat"
                      fill={COLORS[i % COLORS.length]}
                      radius={i === c.chartCategories.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>
    </div>
  );
}
