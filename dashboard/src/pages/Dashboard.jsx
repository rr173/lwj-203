import { useState, useEffect, useMemo, useCallback } from 'react';
import CCPBlock from '../components/CCPBlock';
import { getDashboardOverview } from '../api/client';

export default function Dashboard({ realtimeAlerts }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await getDashboardOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (realtimeAlerts.length > 0) {
      fetchData();
    }
  }, [realtimeAlerts, fetchData]);

  const grouped = useMemo(() => {
    if (!overview || !overview.lines) return {};
    return overview.lines;
  }, [overview]);

  const stats = useMemo(() => {
    if (!overview || !overview.summary) {
      return { normal: 0, minor: 0, critical: 0, offline: 0 };
    }
    return overview.summary;
  }, [overview]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="loading-spinner" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">实时总览</h2>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value green">{stats.normal}</div>
            <div className="stat-label">正常</div>
          </div>
          <div className="stat-card">
            <div className="stat-value yellow">{stats.minor}</div>
            <div className="stat-label">轻微偏差</div>
          </div>
          <div className="stat-card">
            <div className="stat-value red">{stats.critical}</div>
            <div className="stat-label">严重偏差</div>
          </div>
          <div className="stat-card">
            <div className="stat-value gray">{stats.offline}</div>
            <div className="stat-label">离线</div>
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([lineName, lineCCPs]) => (
        <div key={lineName} className="production-line-section">
          <h3 className="line-title">{lineName}</h3>
          <div className="ccp-grid">
            {lineCCPs.map((ccp) => (
              <CCPBlock key={ccp.id} ccp={ccp} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
