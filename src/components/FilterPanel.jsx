import React from 'react';

function MultiSelect({ label, options, selected, onChange }) {
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
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              className={`filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => toggle(opt)}
              title={opt}
            >
              {opt}
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
        options={filterOptions.months}
        selected={filters.months}
        onChange={set('months')}
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
