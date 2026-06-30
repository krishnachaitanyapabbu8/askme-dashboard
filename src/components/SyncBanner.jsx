import React from 'react';

export default function SyncBanner({ syncing }) {
  if (!syncing) return null;
  return (
    <div className="sync-banner">
      <span className="sync-spinner" />
      Refreshing data… please wait
    </div>
  );
}
