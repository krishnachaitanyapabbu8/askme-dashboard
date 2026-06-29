import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { loadDashboardData } from './data/dataLoader';
import FilterPanel from './components/FilterPanel';
import { SkeletonPage } from './components/Skeleton';
import ExecutiveOverview from './pages/ExecutiveOverview';
import IssueAnalysis from './pages/IssueAnalysis';
import UserActivity from './pages/UserActivity';
import BotPerformance from './pages/BotPerformance';
import TokenUsage from './pages/TokenUsage';
import Comparison from './pages/Comparison';

const TABS = [
  { id: 'overview',   label: 'Executive Overview', icon: '▦' },
  { id: 'issues',     label: 'Issue Analysis',     icon: '⚑' },
  { id: 'users',      label: 'User Activity',      icon: '◎' },
  { id: 'bots',       label: 'Bot Performance',    icon: '◈' },
  { id: 'tokens',     label: 'Token Usage',        icon: '◉' },
  { id: 'comparison', label: 'MoM Comparison',     icon: '⇄' },
];

const DEFAULT_FILTERS = {
  months: [],
  botTypes: [],
  modules: [],
  questionCategories: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadDashboardData(activeFilters);
      setData(result);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(DEFAULT_FILTERS);
  }, [fetchData]);

  // Re-fetch on filter change
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  const renderPage = () => {
    if (loading) return <SkeletonPage />;
    if (error) {
      return (
        <div className="error-screen">
          <h2>⚠️ Could not load data</h2>
          <p>{error}</p>
          <p>
            Place <strong>AskMe_Dashboard_Data.xlsx</strong> in the <code>public/</code> folder
            and refresh.
          </p>
        </div>
      );
    }
    switch (activeTab) {
      case 'overview': return <ExecutiveOverview data={data} />;
      case 'issues':   return <IssueAnalysis data={data} />;
      case 'users':    return <UserActivity data={data} />;
      case 'bots':     return <BotPerformance data={data} />;
      case 'tokens':     return <TokenUsage data={data} />;
      case 'comparison': return <Comparison data={data} />;
      default:           return null;
    }
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="header-logo">MJB</span>
          <div className="header-title-group">
            <h1>AskMe Analytics</h1>
            <span className="header-sub">Powered by Quadratyx</span>
          </div>
        </div>
        {data?.lastUpdated && (
          <span className="header-last-updated">
            Last updated: {data.lastUpdated}
          </span>
        )}
      </header>

      {/* Tab Bar */}
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Layout */}
      <div className="main-layout">
        <FilterPanel
          filterOptions={data?.filterOptions}
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        <main className="page-content">{renderPage()}</main>
      </div>
    </div>
  );
}
