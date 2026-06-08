export default function OfflineAlarmHistory({ alerts }) {
  if (!alerts || !alerts.length) {
    return <div className="empty-state">暂无离线告警记录</div>;
  }

  const sorted = [...alerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="alert-history-list">
      {sorted.map((alert) => (
        <div key={alert.id} className="alert-history-item">
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {alert.ccpName || alert.ccpId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              离线开始: {new Date(alert.createdAt).toLocaleString()}
              {alert.resolvedAt && ` — 恢复: ${new Date(alert.resolvedAt).toLocaleString()}`}
              {alert.durationSeconds != null && ` (持续 ${formatDuration(alert.durationSeconds)})`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              上次读数: {new Date(alert.lastReadingTime).toLocaleString()} | 预期间隔: {alert.expectedIntervalSeconds}s
            </div>
          </div>
          <span className={`alert-history-status ${alert.status}`}>
            {alert.status === 'open' ? '未恢复' : '已恢复'}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}小时${m}分`;
}
