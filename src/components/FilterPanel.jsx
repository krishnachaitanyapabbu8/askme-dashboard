import React, { useState, useRef, useEffect } from 'react';

function MultiSelectDropdown({ label, options, selected, onChange, partialItems = new Set() }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const clearAll    = (e) => { e.stopPropagation(); onChange([]); };
  const selectAll   = (e) => { e.stopPropagation(); onChange([...options]); };
  const allSelected = selected.length === 0;

  const buttonLabel = allSelected
    ? 'All'
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div className="filter-group" ref={ref}>
      <div className="filter-label">{label}</div>
      <button
        className={`filter-dropdown-btn ${!allSelected ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="filter-dropdown-value">{buttonLabel}</span>
        <span className="filter-dropdown-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="filter-dropdown-menu">
          <div className="filter-dropdown-actions">
            <button onClick={selectAll}>All</button>
            <button onClick={clearAll}>Clear</button>
          </div>
          <div className="filter-dropdown-options">
            {options.map(opt => (
              <label key={opt} className="filter-dropdown-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                <span>
                  {opt}{partialItems.has(opt) ? ' *' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ filterOptions, filters, onFilterChange }) {
  if (!filterOptions) return <div className="filter-panel loading">Loading filters…</div>;

  const set = (key) => (val) => onFilterChange({ ...filters, [key]: val });

  const months = filterOptions.months ?? [];
  const partialMonths = new Set(months.length ? [months[months.length - 1]] : []);

  return (
    <aside className="filter-panel">
      <div className="filter-panel-header">
        <span>🔽 Filters</span>
        <button
          className="filter-reset-btn"
          onClick={() => onFilterChange({ months: [], botTypes: [], modules: [], questionCategories: [] })}
        >
          Reset all
        </button>
      </div>

      <MultiSelectDropdown
        label="Month"
        options={months}
        selected={filters.months}
        onChange={set('months')}
        partialItems={partialMonths}
      />
      <MultiSelectDropdown
        label="Bot Type"
        options={filterOptions.botTypes}
        selected={filters.botTypes}
        onChange={set('botTypes')}
      />
      <MultiSelectDropdown
        label="Module"
        options={filterOptions.modules}
        selected={filters.modules}
        onChange={set('modules')}
      />
      <MultiSelectDropdown
        label="Question Category"
        options={filterOptions.questionCategories}
        selected={filters.questionCategories}
        onChange={set('questionCategories')}
      />
    </aside>
  );
}
