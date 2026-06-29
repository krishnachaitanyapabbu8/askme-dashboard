import React from 'react';

// ── Number Formatters ──────────────────────────────────────────────────────────

export function fmt(value, type = 'number') {
  if (value === null || value === undefined) return '—';
  switch (type) {
    case 'tokens':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return value.toLocaleString();
      return String(value);
    case 'percent': return `${Number(value).toFixed(1)}%`;
    case 'time':    return `${Number(value).toFixed(1)}s`;
    case 'decimal': return Number(value).toFixed(2);
    case 'text':    return String(value);
    default:
      if (typeof value === 'number' && value >= 1000) return value.toLocaleString();
      return String(value);
  }
}

// ── Trend Badge ───────────────────────────────────────────────────────────────

function TrendBadge({ trend, invert, prevValue, format }) {
  if (trend === null || trend === undefined) return null;
  const up     = trend > 0;
  const isGood = invert ? !up : up;
  const color  = trend === 0 ? '#94A3B8' : (isGood ? '#10B981' : '#EF4444');
  const arrow  = trend > 0 ? '▲' : trend < 0 ? '▼' : '—';
  return (
    <div className="kpi-trend" style={{ color }}>
      {arrow} {Math.abs(trend)}% vs last month
      {prevValue !== undefined && prevValue !== null && (
        <span className="kpi-prev-value"> (was {fmt(prevValue, format)})</span>
      )}
    </div>
  );
}

// ── KPI Card Component ────────────────────────────────────────────────────────

export default function KPICard({ label, value, format = 'number', accent, sub, trend, invertTrend, prevValue, icon }) {
  const labelFontSize = label.length > 24 ? '10px' : label.length > 16 ? '11px' : '12px';
  const accentColor = accent || '#4472C4';
  return (
    <div className="kpi-card" style={{ borderTopColor: accentColor }}>
      <div className="kpi-card-top">
        <div className="kpi-label" style={{ fontSize: labelFontSize }}>{label}</div>
        {icon && <span className="kpi-icon" style={{ color: accentColor }}>{icon}</span>}
      </div>
      <div className="kpi-value" style={{ color: accentColor }}>{fmt(value, format)}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <TrendBadge trend={trend} invert={invertTrend} prevValue={prevValue} format={format} />
    </div>
  );
}
