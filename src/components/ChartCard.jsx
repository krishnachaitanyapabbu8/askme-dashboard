import React from 'react';

export default function ChartCard({ title, children, minHeight = 280 }) {
  return (
    <div className="chart-card" style={{ minHeight }}>
      {title && <div className="chart-title">{title}</div>}
      <div className="chart-body">{children}</div>
    </div>
  );
}
