import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmt } from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };

const KPI_ROWS = [
  { key: 'totalUserQuestions',    label: 'User Questions',       format: 'number',  invert: false },
  { key: 'activeUsers',           label: 'Active Users',         format: 'number',  invert: false },
  { key: 'totalLikes',            label: 'Likes',                format: 'number',  invert: false },
  { key: 'totalDislikes',         label: 'Dislikes',             format: 'number',  invert: true  },
  { key: 'totalIssues',           label: 'Total Issues',         format: 'number',  invert: true  },
  { key: 'systemErrors',          label: 'System Errors',        format: 'number',  invert: true  },
  { key: 'kbGaps',                label: 'Unanswered Questions', format: 'number',  invert: true  },
  { key: 'sessionDrops',          label: 'Lost Conversations',   format: 'number',  invert: true  },
  { key: 'overallIssueRateByBot', label: 'Issue Rate',           format: 'percent', invert: true  },
  { key: 'avgResponseTime',       label: 'Avg Response Time',    format: 'time',    invert: true  },
  { key: 'nlsqlResponses',        label: 'NLSQLAgent Responses', format: 'number',  invert: false },
  { key: 'totalTokens',           label: 'Total Tokens',         format: 'tokens',  invert: false },
  { key: 'avgTokensPerQuestion',  label: 'Avg Tokens / Query',   format: 'number',  invert: false },
];

function ChangeCell({ change, invert }) {
  if (change === null || change === undefined) return <td className="comp-change">—</td>;
  const up     = change > 0;
  const isGood = invert ? !up : up;
  const color  = change === 0 ? '#94A3B8' : (isGood ? '#70AD47' : '#EF4444');
  const arrow  = change > 0 ? '▲' : change < 0 ? '▼' : '—';
  return (
    <td className="comp-change" style={{ color }}>
      {arrow} {Math.abs(change)}%
    </td>
  );
}

export default function Comparison({ data }) {
  if (!data) return <div className="page-loading">Loading…</div>;
  const { mom } = data;

  if (!mom?.currentMonth || !mom?.previousMonth) {
    return (
      <div className="page">
        <div className="comp-no-data">
          At least 2 months of data are needed to show a comparison.
          Use the month filters or add more log data.
        </div>
      </div>
    );
  }

  const { currentMonth, previousMonth, current, previous, charts } = mom;

  return (
    <div className="page">

      {/* Period banner */}
      <div className="comp-banner">
        <span className="comp-period prev">{previousMonth}</span>
        <span className="comp-vs">vs</span>
        <span className="comp-period curr">{currentMonth}</span>
      </div>

      {/* KPI comparison table */}
      <ChartCard title="Key Metrics Side by Side">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>{previousMonth}</th>
              <th>{currentMonth}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {KPI_ROWS.map(row => (
              <tr key={row.key}>
                <td className="comp-metric">{row.label}</td>
                <td className="comp-prev">{fmt(previous[row.key], row.format)}</td>
                <td className="comp-curr">{fmt(current[row.key],  row.format)}</td>
                <ChangeCell change={mom[row.key]} invert={row.invert} />
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      {/* Top users comparison */}
      <div className="chart-row">
        <ChartCard title="Questions by User" minHeight={340}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={charts.userComparison}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'Questions', position: 'insideBottom', offset: -2, ...AL }} />
              <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previous" name={previousMonth} fill="#A5A5A5" radius={[0, 2, 2, 0]} />
              <Bar dataKey="current"  name={currentMonth}  fill="#4472C4" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Questions by ERP Module" minHeight={340}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart layout="vertical" data={charts.moduleComparison}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }}
                label={{ value: 'Questions', position: 'insideBottom', offset: -2, ...AL }} />
              <YAxis dataKey="module" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previous" name={previousMonth} fill="#A5A5A5" radius={[0, 2, 2, 0]} />
              <Bar dataKey="current"  name={currentMonth}  fill="#4472C4" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Issues comparison */}
      {charts.issueComparison.length > 0 && (
        <div className="chart-row single">
          <ChartCard title="Issues by ERP Module" minHeight={300}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={charts.issueComparison}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  label={{ value: 'Issues', position: 'insideBottom', offset: -2, ...AL }} />
                <YAxis dataKey="module" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="previous" name={previousMonth} fill="#FFBABA" radius={[0, 2, 2, 0]} />
                <Bar dataKey="current"  name={currentMonth}  fill="#ED7D31" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

    </div>
  );
}
