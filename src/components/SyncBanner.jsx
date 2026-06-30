import React from 'react';

export default function SyncBanner({ syncing, refreshed }) {
  if (syncing) {
    return (
      <div className="sync-banner sync-banner--loading">
        <span className="sync-spinner" />
        Refreshing data… please wait
      </div>
    );
  }
  if (refreshed) {
    return (
      <div className="sync-banner sync-banner--success">
        ✓ Data refreshed successfully
      </div>
    );
  }
  return null;
}
