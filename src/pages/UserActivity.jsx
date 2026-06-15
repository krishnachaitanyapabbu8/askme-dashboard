import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#70AD47', '#FF0000'];

export default function UserActivity({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { measures: m, charts: c } = data;

  return (
    <div className="page">
      {/* KPI Row — matches PBI: Active Users, Avg Questions Per User, Total Sessions, Avg Sessions Per User */}
      <div className="kpi-row">
        <KPICard label="Active Users"          value={m.activeUsers} />
        <KPICard label="Avg Questions / User"  value={m.avgQuestionsPerUser} format="decimal" />
        <KPICard label="Total Sessions"        value={m.totalSessions} />
        <KPICard label="Avg Sessions / User"   value={m.avgSessionsPerUser} format="decimal" />
      </div>

      {/* Row 1: Questions by User (top 10) | Active Users by Month */}
      <div className="chart-row">
        <ChartCard title="Questions by User" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={c.questionsByUser}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" name="Questions" fill="#4472C4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active Users by Month" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={c.activeUsersByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="activeUsers"
                name="Active Users"
                stroke="#4472C4"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Questions by User per Module | Questions by Category per User */}
      <div className="chart-row">
        <ChartCard title="Questions by User per Module" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={c.questionsByUserModule}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {c.chartModules.map((mod, i) => (
                <Bar
                  key={mod}
                  dataKey={mod}
                  name={mod}
                  stackId="mod"
                  fill={COLORS[i % COLORS.length]}
                  radius={i === c.chartModules.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Questions by Category per User" minHeight={320}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              layout="vertical"
              data={c.questionsByUserCategory}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {c.chartCategories.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  stackId="cat"
                  fill={COLORS[i % COLORS.length]}
                  radius={i === c.chartCategories.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
