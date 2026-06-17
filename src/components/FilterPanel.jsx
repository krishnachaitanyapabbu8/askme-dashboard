import React from 'react';

function MultiSelect({ label, options, selected, onChange, partialItems = new Set() }) {
  const allSelected = selected.length === 0;

  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="filter-group">
      <div className="filter-label">
        {label}
        {!allSelected && (
          <button className="filter-clear" onClick={clearAll} title="Clear filter">
            ✕
          </button>
        )}
      </div>
      <div className="filter-options">
        {options.map((opt) => {
          const isActive   = selected.includes(opt);
          const isPartial  = partialItems.has(opt);
          return (
            <button
              key={opt}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => toggle(opt)}
              title={isPartial ? `${opt} — data may be incomplete` : opt}
            >
              {opt}{isPartial ? ' *' : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterPanel({ filterOptions, filters, onFilterChange }) {
  if (!filterOptions) return <div className="filter-panel loading">Loading filters…</div>;

  const set = (key) => (val) => onFilterChange({ ...filters, [key]: val });

  // Mark the most recent month as potentially partial
  const months = filterOptions.months ?? [];
  const partialMonths = new Set(months.length ? [months[months.length - 1]] : []);

  return (
    <aside className="filter-panel">
      <div className="filter-panel-header">
        <span>🔽 Filters</span>
        <button
          className="filter-reset-btn"
          onClick={() =>
            onFilterChange({ months: [], botTypes: [], modules: [], questionCategories: [] })
          }
        >
          Reset all
        </button>
      </div>

      <MultiSelect
        label="Month"
        options={months}
        selected={filters.months}
        onChange={set('months')}
        partialItems={partialMonths}
      />
      <MultiSelect
        label="Bot Type"
        options={filterOptions.botTypes}
        selected={filters.botTypes}
        onChange={set('botTypes')}
      />
      <MultiSelect
        label="Module"
        options={filterOptions.modules}
        selected={filters.modules}
        onChange={set('modules')}
      />
      <MultiSelect
        label="Question Category"
        options={filterOptions.questionCategories}
        selected={filters.questionCategories}
        onChange={set('questionCategories')}
      />
    </aside>
  );
}
