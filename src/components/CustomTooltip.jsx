import React from 'react';
import { fmt } from './KPICard';

export default function CustomTooltip({ active, payload, label, format = 'number' }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="custom-tooltip">
      {label && <div className="tooltip-label">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="tooltip-row">
          <span className="tooltip-dot" style={{ background: entry.color }} />
          <span className="tooltip-name">{entry.name}:</span>
          <span className="tooltip-value">{fmt(entry.value, format)}</span>
        </div>
      ))}
    </div>
  );
}
