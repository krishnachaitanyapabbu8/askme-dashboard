import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47', '#FF0000'];
const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };
const BAR_H = 36;

export default function ExecutiveOverview({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c, mom } = data;

  return (
    <div className="page">
      {/* KPI Row */}
      <div className="kpi-row">
        <KPICard label="Total User Questions" value={m.totalUserQuestions} trend={mom.totalUserQuestions} />
        <KPICard label="Active Users"          value={m.activeUsers}        trend={mom.activeUsers} />
        <KPICard label="Likes"                 value={m.totalLikes}         trend={mom.totalLikes}    accent="#70AD47" />
        <KPICard label="Dislikes"              value={m.totalDislikes}      trend={mom.totalDislikes} accent="#FF0000" invertTrend />
        <KPICard label="Chatbot Issues"        value={m.totalIssues}        trend={mom.totalIssues}   accent="#ED7D31" invertTrend />
        <KPICard label="Lost Conversations"    value={m.sessionDrops}       trend={mom.sessionDrops}  accent="#A5A5A5" invertTrend />
      </div>

      {/* Row 1: Questions by Month | Bot Responses by Bot Type */}
      <div className="chart-row">
        <ChartCard title="Questions by Month" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={c.questionsByMonth} margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                label={{ value: 'Questions', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="questions" name="Questions" fill="#4472C4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bot Responses by Bot Type" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart layout="vertical" data={c.botResponsesByBotType}
              margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'Responses', position: 'insideBottom', offset: -8, ...AL }} />
              <YAxis dataKey="bot" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="responses" name="Bot Responses" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Feedback by Month | Questions by Module */}
      <div className="chart-row">
        <ChartCard title="Feedback by Month" minHeight={300}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={c.feedbackByMonth} margin={{ top: 5, right: 20, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, ...AL }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="likes"    name="Likes"    fill="#70AD47" radius={[3, 3, 0, 0]} />
              <Bar dataKey="dislikes" name="Dislikes" fill="#FF0000" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Questions by ERP Module" scrollable minHeight={300} topNOptions={[10, 20, 'all']}>
          {(n) => {
            const d = c.questionsByModule.slice(0, n);
            return (
              <ResponsiveContainer width="100%" height={Math.max(260, d.length * BAR_H)}>
                <BarChart layout="vertical" data={d}
                  margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Count', position: 'insideBottom', offset: -8, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Questions" fill="#4472C4" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>
      </div>
    </div>
  );
}
