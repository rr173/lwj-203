import { useMemo } from 'react';

const STATUS_TEXT = {
  normal: '正常',
  minor: '轻微偏差',
  critical: '严重偏差',
  offline: '离线',
};

export default function AlertBar({ alerts, onDismiss }) {
  const visible = alerts.slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <div className={`alert-bar${visible.length > 0 ? ' has-alerts' : ''}`}>
      {visible.map((alert, i) => {
        const isOffline = alert.type === 'offline_alert';
        const label = isOffline ? '离线告警' : '偏差事件';
        const message = isOffline
          ? `${alert.data?.ccpName || alert.data?.ccpId} 传感器离线`
          : `${alert.data?.ccpId} 温度偏差 (${alert.data?.level === 'critical' ? '严重' : '轻微'})`;

        return (
          <div key={alert.id || i} className={`alert-item ${isOffline ? 'offline' : 'deviation'}`}>
            <div className="alert-item-content">
              <span className={`alert-item-badge ${isOffline ? 'offline' : 'deviation'}`}>{label}</span>
              <span>{message}</span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                {alert.data?.createdAt ? new Date(alert.data.createdAt).toLocaleTimeString() : ''}
              </span>
            </div>
            <button className="alert-dismiss" onClick={() => onDismiss(alert.id)}>&times;</button>
          </div>
        );
      })}
    </div>
  );
}
