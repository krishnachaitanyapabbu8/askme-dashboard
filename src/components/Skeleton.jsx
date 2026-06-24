import React from 'react';

function SkeletonBox({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div className="skeleton-box" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

export function SkeletonKPIRow({ count = 5 }) {
  return (
    <div className="kpi-row">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card">
          <SkeletonBox width="60%" height={12} style={{ marginBottom: 12 }} />
          <SkeletonBox width="40%" height={28} radius={4} style={{ marginBottom: 8 }} />
          <SkeletonBox width="70%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="skeleton-chart" style={{ height }}>
      <SkeletonBox width="40%" height={14} style={{ marginBottom: 16 }} />
      <SkeletonBox width="100%" height={height - 40} radius={8} />
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <SkeletonBox width="200px" height={20} style={{ marginBottom: 8 }} />
        <SkeletonBox width="400px" height={13} />
      </div>
      <SkeletonKPIRow count={5} />
      <div className="chart-row">
        <div className="chart-card"><SkeletonChart /></div>
        <div className="chart-card"><SkeletonChart /></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><SkeletonChart /></div>
        <div className="chart-card"><SkeletonChart /></div>
      </div>
    </div>
  );
}
