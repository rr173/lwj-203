import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import TemperatureChart from '../components/TemperatureChart';
import DeviationTimeline from '../components/DeviationTimeline';
import OfflineAlarmHistory from '../components/OfflineAlarmHistory';
import RuleManager from '../components/RuleManager';
import { getCCP, getReadings, getCCPTimeline, getOfflineAlerts } from '../api/client';

const STATUS_TEXT = {
  normal: '正常',
  minor: '轻微偏差',
  critical: '严重偏差',
  offline: '离线',
};

export default function CCPDetail() {
  const { ccpId } = useParams();
  const [ccp, setCcp] = useState(null);
  const [readings, setReadings] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [offlineAlerts, setOfflineAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [ccpData, readingsData, timelineData, alertsData] = await Promise.all([
        getCCP(ccpId),
        getReadings(ccpId, oneHourAgo.toISOString(), now.toISOString()),
        getCCPTimeline(ccpId, oneHourAgo.toISOString(), now.toISOString()),
        getOfflineAlerts(ccpId),
      ]);

      setCcp(ccpData);
      setReadings(readingsData.data || readingsData || []);
      setTimeline(timelineData.timeline || timelineData || []);
      setOfflineAlerts(alertsData);
    } catch (err) {
      console.error('Failed to fetch CCP detail:', err);
    } finally {
      setLoading(false);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const latestTemp = useMemo(() => {
    if (!readings.length) return null;
    const sorted = [...readings].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return sorted[0].temperature;
  }, [readings]);

  const isOffline = useMemo(() => {
    return offlineAlerts.some((a) => a.status === 'open');
  }, [offlineAlerts]);

  if (loading) {
    return (
      <div className="ccp-detail">
        <div className="loading">
          <div className="loading-spinner" />
          加载中...
        </div>
      </div>
    );
  }

  if (!ccp) {
    return (
      <div className="ccp-detail">
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div>未找到CCP: {ccpId}</div>
        </div>
      </div>
    );
  }

  const status = isOffline ? 'offline' : (ccp.status || 'normal');
  const statusClass = isOffline ? 'offline' : status === 'critical' ? 'critical' : status === 'minor' ? 'minor' : 'normal';

  const badgeStyle = {
    offline: { bg: 'var(--color-gray-bg)', color: 'var(--color-gray)' },
    critical: { bg: 'var(--color-red-bg)', color: 'var(--color-red)' },
    minor: { bg: 'var(--color-yellow-bg)', color: 'var(--color-yellow)' },
    normal: { bg: 'var(--color-green-bg)', color: 'var(--color-green)' },
  };

  return (
    <div className="ccp-detail">
      <Link to="/" className="detail-back">← 返回总览</Link>

      <div className="detail-header">
        <h2 className="detail-title">{ccp.name}</h2>
        <span className={`detail-status-badge ${statusClass}`}
          style={{
            background: badgeStyle[statusClass].bg,
            color: badgeStyle[statusClass].color,
          }}
        >
          <span className={`status-dot ${statusClass}`} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="detail-info-grid">
        <div className="detail-info-item">
          <div className="detail-info-label">当前温度</div>
          <div className="detail-info-value" style={{
            color: badgeStyle[statusClass].color
          }}>
            {latestTemp != null ? `${latestTemp}°C` : '--'}
          </div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">合规范围</div>
          <div className="detail-info-value">{ccp.complianceMin}°C ~ {ccp.complianceMax}°C</div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">严重偏差范围</div>
          <div className="detail-info-value">{ccp.criticalMin}°C ~ {ccp.criticalMax}°C</div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">上报频率</div>
          <div className="detail-info-value">{ccp.reportingFrequency}s</div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">所属产线</div>
          <div className="detail-info-value">{ccp.productionLine}</div>
        </div>
        <div className="detail-info-item">
          <div className="detail-info-label">状态</div>
          <div className="detail-info-value">{ccp.isActive ? '启用' : '停用'}</div>
        </div>
      </div>

      <div className="chart-section">
        <h3 className="chart-section-title">最近1小时温度曲线</h3>
        <TemperatureChart readings={readings} ccp={ccp} />
      </div>

      <div className="timeline-section">
        <h3 className="timeline-title">偏差事件时间线</h3>
        <DeviationTimeline timeline={timeline} />
      </div>

      <div className="alert-history-section">
        <h3 className="alert-history-title">离线告警历史</h3>
        <OfflineAlarmHistory alerts={offlineAlerts} />
      </div>

      <div className="chart-section">
        <RuleManager ccpId={ccpId} />
      </div>
    </div>
  );
}
