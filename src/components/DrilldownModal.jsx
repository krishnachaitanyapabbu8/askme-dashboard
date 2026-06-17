import React from 'react';

function fmtDate(d) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(String(d));
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DrilldownModal({ user, rows, onClose }) {
  if (!user) return null;

  const userRows = [...rows.filter(r => r.user === user)]
    .sort((a, b) => {
      const da = new Date(a.date), db = new Date(b.date);
      return isNaN(da) || isNaN(db) ? 0 : db - da;
    });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{user}</div>
            <div className="modal-subtitle">{userRows.length} questions in selected period</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {userRows.length === 0 ? (
            <div className="modal-empty">No questions found for this user.</div>
          ) : (
            <table className="drilldown-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Module</th>
                  <th>Category</th>
                  <th>Question</th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((r, i) => (
                  <tr key={i}>
                    <td className="col-date">{fmtDate(r.date)}</td>
                    <td className="col-module">{r.module || '—'}</td>
                    <td className="col-category">{r.category || '—'}</td>
                    <td className="col-message">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
