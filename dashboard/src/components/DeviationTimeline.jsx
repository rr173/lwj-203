import { useMemo } from 'react';

const TYPE_LABELS = {
  deviation_start: '偏差发生',
  deviation_escalated: '偏差升级',
  deviation_closed: '偏差关闭',
  corrective_action: '纠偏动作',
};

export default function DeviationTimeline({ timeline }) {
  const items = useMemo(() => {
    if (!timeline) return [];
    return timeline
      .filter((t) => t.type !== 'reading')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [timeline]);

  if (!items.length) {
    return <div className="empty-state">暂无偏差事件</div>;
  }

  return (
    <div className="timeline-list">
      {items.map((item, i) => (
        <div key={i} className="timeline-item">
          <span className={`timeline-dot ${item.type}`} />
          <div className="timeline-content">
            <div className="timeline-time">
              {new Date(item.timestamp).toLocaleString()}
            </div>
            <div className="timeline-desc">
              {item.type === 'deviation_start' && (
                <>{TYPE_LABELS[item.type]} — 等级: {item.level === 'critical' ? '严重' : '轻微'}, 初始温度: {item.initialTemperature}°C</>
              )}
              {item.type === 'deviation_escalated' && (
                <>{TYPE_LABELS[item.type]}</>
              )}
              {item.type === 'deviation_closed' && (
                <>{TYPE_LABELS[item.type]} — 原因: {item.closeReason}, 操作人: {item.closedBy}</>
              )}
              {item.type === 'corrective_action' && (
                <>{TYPE_LABELS[item.type]} — {item.description} ({item.operator})</>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
