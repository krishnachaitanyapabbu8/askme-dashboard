import React from 'react';

export default function ChartCard({ title, children, minHeight = 280, scrollable = false }) {
  return (
    <div className="chart-card" style={!scrollable ? { minHeight } : {}}>
      {title && <div className="chart-title">{title}</div>}
      <div
        className={`chart-body${scrollable ? ' chart-body--scroll' : ''}`}
        style={scrollable ? { height: minHeight } : {}}
      >
        {children}
      </div>
    </div>
  );
}
