import React from 'react';

export default function PageInsight({ title, subtitle, insight }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {insight && (
        <div className="page-insight">
          <span className="page-insight-icon">💡</span>
          <span>{insight}</span>
        </div>
      )}
    </div>
  );
}
