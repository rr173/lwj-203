import { useState, useEffect, useCallback } from 'react';
import ComplianceBarChart from '../components/ComplianceBarChart';
import { getProductionLines, getOnlineRateStats } from '../api/client';

export default function LineComparison() {
  const [lines, setLines] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const linesData = await getProductionLines();
      setLines(linesData);

      const statsMap = {};
      await Promise.all(
        linesData.map(async (line) => {
          try {
            const data = await getOnlineRateStats(line);
            statsMap[line] = (data.stats || []).map((s) => ({
              ccpId: s.ccpId,
              ccpName: s.ccpName,
              complianceRate: s.onlineRate,
              onlineRate: s.onlineRate,
            }));
          } catch {
            statsMap[line] = [];
          }
        })
      );
      setStats(statsMap);
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="comparison">
        <div className="loading">
          <div className="loading-spinner" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="comparison">
      <div className="comparison-header">
        <h2 className="comparison-title">产线对比视图</h2>
        <p className="comparison-subtitle">展示各产线下所有CCP的合规率，鼠标悬停查看具体数值</p>
      </div>

      {lines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div>暂无产线数据</div>
        </div>
      ) : (
        lines.map((line) => (
          <div key={line} className="line-comparison-section">
            <h3 className="line-comparison-title">{line}</h3>
            <ComplianceBarChart data={stats[line]} title={line} />
          </div>
        ))
      )}
    </div>
  );
}
