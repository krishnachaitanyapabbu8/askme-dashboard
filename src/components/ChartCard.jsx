import React, { useState } from 'react';

const TOP_N_OPTS = [10, 20, 'all'];

export default function ChartCard({
  title,
  children,
  minHeight = 280,
  scrollable = false,
  topNOptions,
}) {
  const [topN, setTopN] = useState(topNOptions ? topNOptions[0] : null);

  // Infinity lets .slice(0, n) return the full array unchanged
  const n = topN === 'all' ? Infinity : (topN ?? Infinity);
  const childContent = typeof children === 'function' ? children(n) : children;

  return (
    <div className="chart-card" style={!scrollable ? { minHeight } : {}}>
      {title && (
        <div className="chart-title">
          <span>{title}</span>
          {topNOptions && (
            <div className="chart-top-n">
              {topNOptions.map(opt => (
                <button
                  key={opt}
                  className={`top-n-btn${topN === opt ? ' active' : ''}`}
                  onClick={() => setTopN(opt)}
                >
                  {opt === 'all' ? 'All' : `Top ${opt}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className={`chart-body${scrollable ? ' chart-body--scroll' : ''}`}
        style={scrollable ? { height: minHeight } : {}}
      >
        {childContent}
      </div>
    </div>
  );
}
