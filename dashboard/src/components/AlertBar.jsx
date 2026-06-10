import { useMemo, useState } from 'react';

const TYPE_CONFIG = {
  deviation: { label: '偏差', className: 'deviation', icon: '⚠' },
  offline_alert: { label: '离线', className: 'offline', icon: '📡' },
  rule_alert: { label: '规则', className: 'rule', icon: '🔔' },
  prediction_alert: { label: '预测预警', className: 'prediction', icon: '🔮' },
};

function RuleEvidence({ evidence }) {
  if (!evidence) return null;

  if (evidence.ruleType === 'cumulative' && evidence.readings) {
    return (
      <div className="alert-evidence">
        <div className="evidence-desc">{evidence.description}</div>
        <div className="evidence-details">
          {evidence.readings.map((r, i) => (
            <span key={i} className="evidence-reading">
              {r.temperature}°C
              <span className="evidence-time">
                {new Date(r.timestamp).toLocaleTimeString()}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (evidence.ruleType === 'trend' && evidence.startReading) {
    return (
      <div className="alert-evidence">
        <div className="evidence-desc">{evidence.description}</div>
        <div className="evidence-details">
          <span className="evidence-reading">
            {evidence.startReading.temperature}°C → {evidence.endReading.temperature}°C
          </span>
          <span className="evidence-rate">
            速率: {Math.abs(evidence.actualRate).toFixed(2)}°C/分
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default function AlertBar({ alerts, onDismiss }) {
  const [expandedId, setExpandedId] = useState(null);
  const visible = alerts.slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <div className={`alert-bar${visible.length > 0 ? ' has-alerts' : ''}`}>
      {visible.map((alert, i) => {
        const typeConfig = TYPE_CONFIG[alert.type] || TYPE_CONFIG.deviation;
        const isRuleAlert = alert.type === 'rule_alert';
        const isOffline = alert.type === 'offline_alert';
        const isPrediction = alert.type === 'prediction_alert';

        let message = '';
        if (isRuleAlert) {
          const ev = alert.data?.evidence;
          const ruleLabel = ev?.ruleType === 'cumulative' ? '累积告警' : ev?.ruleType === 'trend' ? '趋势告警' : '规则告警';
          message = `${alert.data?.ccpId} ${ruleLabel}: ${alert.data?.ruleName}`;
        } else if (isOffline) {
          message = `${alert.data?.ccpName || alert.data?.ccpId} 传感器离线`;
        } else if (isPrediction) {
          const dir = alert.data?.alertDirection === 'upper' ? '上升' : '下降';
          message = `${alert.data?.ccpName || alert.data?.ccpId} 温度${dir}趋势预警，预测${alert.data?.predictMinutes}分钟后${alert.data?.predictedTemperature}°C`;
        } else {
          message = `${alert.data?.ccpId} 温度偏差 (${alert.data?.level === 'critical' ? '严重' : '轻微'})`;
        }

        const isExpanded = expandedId === alert.id;

        return (
          <div key={alert.id || i} className={`alert-item ${typeConfig.className}`}>
            <div className="alert-item-content">
              <span className={`alert-item-badge ${typeConfig.className}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
              <span
                className={isRuleAlert ? 'alert-message-clickable' : ''}
                onClick={() => isRuleAlert && setExpandedId(isExpanded ? null : alert.id)}
              >
                {message}
              </span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                {alert.data?.createdAt ? new Date(alert.data.createdAt).toLocaleTimeString() : ''}
              </span>
            </div>
            <button className="alert-dismiss" onClick={() => onDismiss(alert.id)}>&times;</button>
            {isRuleAlert && isExpanded && (
              <RuleEvidence evidence={alert.data?.evidence} />
            )}
          </div>
        );
      })}
    </div>
  );
}
