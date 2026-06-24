import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fmt } from '../components/KPICard';
import ChartCard from '../components/ChartCard';

const AL = { style: { textAnchor: 'middle', fontSize: 11, fill: '#94A3B8' } };

const BAR_COLORS = ['#A5A5A5', '#4472C4', '#70AD47', '#ED7D31', '#FFC000', '#9B59B6'];

const KPI_ROWS = [
  { key: 'totalUserQuestions',    label: 'User Questions',                        format: 'number',  invert: false },
  { key: 'activeUsers',           label: 'Active Users',                          format: 'number',  invert: false },
  { key: 'totalLikes',            label: 'Likes',                                 format: 'number',  invert: false },
  { key: 'totalDislikes',         label: 'Dislikes',                              format: 'number',  invert: true  },
  { key: 'totalIssues',           label: 'Total Issues',                          format: 'number',  invert: true  },
  { key: 'systemErrors',          label: 'System Errors',                         format: 'number',  invert: true  },
  { key: 'kbGaps',                label: "Training Bot Couldn't Answer",          format: 'number',  invert: true  },
  { key: 'sessionDrops',          label: 'Bot Forgot the Conversation',           format: 'number',  invert: true  },
  { key: 'overallIssueRateByBot', label: 'Issue Rate',                            format: 'percent', invert: true  },
  { key: 'avgResponseTime',       label: 'Avg Response Time',                     format: 'time',    invert: true  },
  { key: 'nlsqlResponses',        label: 'NLSQLAgent Responses',                  format: 'number',  invert: false },
  { key: 'totalTokens',           label: 'Total Tokens',                          format: 'tokens',  invert: false },
  { key: 'avgTokensPerQuestion',  label: 'Avg Tokens / Query',                   format: 'number',  invert: false },
];

function pct(curr, prev) {
  if (!prev || prev === 0) return null;
  return +((curr - prev) / Math.abs(prev) * 100).toFixed(1);
}

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

  const { allMonths = [], allMonthlyMetrics = {}, mom } = data;

  // Default to last 2 months
  const defaultMonths = allMonths.length >= 2
    ? [allMonths[allMonths.length - 2], allMonths[allMonths.length - 1]]
    : allMonths.length === 1
    ? [allMonths[0]]
    : [];

  const [selectedMonths, setSelectedMonths] = useState(defaultMonths);

  // Reset when data changes (e.g. global filter applied)
  useEffect(() => {
    setSelectedMonths(
      allMonths.length >= 2
        ? [allMonths[allMonths.length - 2], allMonths[allMonths.length - 1]]
        : allMonths.slice()
    );
  }, [allMonths.join(',')]);

  const updateMonth = (index, value) => {
    const updated = [...selectedMonths];
    updated[index] = value;
    setSelectedMonths(updated);
  };

  const addMonth = () => {
    const unused = allMonths.find(m => !selectedMonths.includes(m));
    if (unused) setSelectedMonths([...selectedMonths, unused]);
  };

  const removeMonth = (index) => {
    setSelectedMonths(selectedMonths.filter((_, i) => i !== index));
  };

  if (allMonths.length < 2) {
    return (
      <div className="page">
        <div className="comp-no-data">
          At least 2 months of data are needed to show a comparison.
          Use the month filters or add more log data.
        </div>
      </div>
    );
  }

  const metrics = selectedMonths.map(m => allMonthlyMetrics[m] || {});
  const canAddMore = selectedMonths.length < allMonths.length;

  return (
    <div className="page">

      {/* Month pickers */}
      <div className="comp-month-picker">
        {selectedMonths.map((month, i) => (
          <div key={i} className="comp-month-selector">
            <select
              className="comp-month-select"
              value={month}
              onChange={e => updateMonth(i, e.target.value)}
              style={{ borderColor: BAR_COLORS[i] }}
            >
              {allMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {selectedMonths.length > 2 && (
              <button className="comp-month-remove" onClick={() => removeMonth(i)}>✕</button>
            )}
          </div>
        ))}
        {canAddMore && (
          <button className="comp-add-month" onClick={addMonth}>+ Add Month</button>
        )}
      </div>

      {/* Period banner */}
      <div className="comp-banner">
        {selectedMonths.map((m, i) => (
          <React.Fragment key={m}>
            {i > 0 && <span className="comp-vs">vs</span>}
            <span className="comp-period" style={{ color: BAR_COLORS[i], borderColor: BAR_COLORS[i] }}>{m}</span>
          </React.Fragment>
        ))}
      </div>

      {/* KPI comparison table */}
      <ChartCard title="Key Metrics Side by Side">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              {selectedMonths.map((m, i) => (
                <th key={m} style={{ color: BAR_COLORS[i] }}>{m}</th>
              ))}
              {selectedMonths.length === 2 && <th>Change</th>}
            </tr>
          </thead>
          <tbody>
            {KPI_ROWS.map(row => (
              <tr key={row.key}>
                <td className="comp-metric">{row.label}</td>
                {metrics.map((m, i) => (
                  <td key={i} className={i === selectedMonths.length - 1 ? 'comp-curr' : 'comp-prev'}>
                    {fmt(m[row.key], row.format)}
                  </td>
                ))}
                {selectedMonths.length === 2 && (
                  <ChangeCell
                    change={pct(metrics[1]?.[row.key], metrics[0]?.[row.key])}
                    invert={row.invert}
                  />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      {/* Questions by User comparison chart */}
      {mom?.charts && (
        <>
          <div className="chart-row">
            <ChartCard title="Questions by User" minHeight={340}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={mom.charts.userComparison}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Questions', position: 'insideBottom', offset: -2, ...AL }} />
                  <YAxis dataKey="user" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="previous" name={mom.previousMonth} fill={BAR_COLORS[0]} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="current"  name={mom.currentMonth}  fill={BAR_COLORS[1]} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Questions by ERP Module" minHeight={340}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={mom.charts.moduleComparison}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }}
                    label={{ value: 'Questions', position: 'insideBottom', offset: -2, ...AL }} />
                  <YAxis dataKey="module" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="previous" name={mom.previousMonth} fill={BAR_COLORS[0]} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="current"  name={mom.currentMonth}  fill={BAR_COLORS[1]} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {mom.charts.issueComparison.length > 0 && (
            <div className="chart-row single">
              <ChartCard title="Issues by ERP Module" minHeight={300}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart layout="vertical" data={mom.charts.issueComparison}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }}
                      label={{ value: 'Issues', position: 'insideBottom', offset: -2, ...AL }} />
                    <YAxis dataKey="module" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="previous" name={mom.previousMonth} fill="#FFBABA" radius={[0, 2, 2, 0]} />
                    <Bar dataKey="current"  name={mom.currentMonth}  fill="#ED7D31" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
