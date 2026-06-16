import React from 'react';

// ── Number Formatters ──────────────────────────────────────────────────────────

export function fmt(value, type = 'number') {
  if (value === null || value === undefined) return '—';

  switch (type) {
    case 'tokens':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return value.toLocaleString();
      return String(value);

    case 'percent':
      return `${Number(value).toFixed(1)}%`;

    case 'time':
      return `${Number(value).toFixed(1)}s`;

    case 'decimal':
      return Number(value).toFixed(2);

    case 'text':
      return String(value);

    default:
      if (typeof value === 'number' && value >= 1000) return value.toLocaleString();
      return String(value);
  }
}

// ── KPI Card Component ────────────────────────────────────────────────────────

export default function KPICard({ label, value, format = 'number', accent, sub }) {
  const displayValue = fmt(value, format);

  return (
    <div className="kpi-card" style={accent ? { borderTopColor: accent } : {}}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: accent } : {}}>
        {displayValue}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
