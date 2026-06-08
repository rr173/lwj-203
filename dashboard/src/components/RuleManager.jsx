import { useState, useEffect, useCallback } from 'react';
import { getRulesByCCP, createRule, updateRule, deleteRule, toggleRule, getRuleAlerts, acknowledgeRuleAlert } from '../api/client';

const EMPTY_CUMULATIVE = { consecutiveCount: 3 };
const EMPTY_TREND = { windowMinutes: 10, rateThresholdPerMinute: 2 };

function RuleForm({ ccpId, rule, onSave, onCancel }) {
  const [name, setName] = useState(rule?.name || '');
  const [type, setType] = useState(rule?.type || 'cumulative');
  const [config, setConfig] = useState(rule?.config || { ...EMPTY_CUMULATIVE });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleTypeChange = (newType) => {
    setType(newType);
    setConfig(newType === 'cumulative' ? { ...EMPTY_CUMULATIVE } : { ...EMPTY_TREND });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const data = { name, type, ccpId, config, enabled: rule?.enabled !== false };
      if (rule) {
        await updateRule(rule.id, data);
      } else {
        await createRule(data);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="rule-form" onSubmit={handleSubmit}>
      <div className="rule-form-row">
        <label className="rule-form-label">规则名称</label>
        <input
          className="rule-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 连续超合规累积告警"
          required
        />
      </div>

      <div className="rule-form-row">
        <label className="rule-form-label">规则类型</label>
        <select
          className="rule-form-select"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          disabled={!!rule}
        >
          <option value="cumulative">累积告警</option>
          <option value="trend">趋势告警</option>
        </select>
      </div>

      {type === 'cumulative' && (
        <div className="rule-form-row">
          <label className="rule-form-label">连续次数</label>
          <input
            className="rule-form-input rule-form-input-sm"
            type="number"
            min="1"
            value={config.consecutiveCount}
            onChange={(e) => setConfig({ ...config, consecutiveCount: parseInt(e.target.value, 10) || 1 })}
            required
          />
          <span className="rule-form-hint">连续N次读数超出合规但未达严重偏差线时触发</span>
        </div>
      )}

      {type === 'trend' && (
        <>
          <div className="rule-form-row">
            <label className="rule-form-label">时间窗口(分钟)</label>
            <input
              className="rule-form-input rule-form-input-sm"
              type="number"
              min="1"
              value={config.windowMinutes}
              onChange={(e) => setConfig({ ...config, windowMinutes: parseInt(e.target.value, 10) || 1 })}
              required
            />
          </div>
          <div className="rule-form-row">
            <label className="rule-form-label">速率阈值(°C/分钟)</label>
            <input
              className="rule-form-input rule-form-input-sm"
              type="number"
              min="0.1"
              step="0.1"
              value={config.rateThresholdPerMinute}
              onChange={(e) => setConfig({ ...config, rateThresholdPerMinute: parseFloat(e.target.value) || 0.1 })}
              required
            />
            <span className="rule-form-hint">温度变化速率超过此值时触发(上升或下降)</span>
          </div>
        </>
      )}

      {error && <div className="rule-form-error">{error}</div>}

      <div className="rule-form-actions">
        <button type="submit" className="rule-btn rule-btn-primary" disabled={saving}>
          {saving ? '保存中...' : rule ? '更新' : '创建'}
        </button>
        <button type="button" className="rule-btn rule-btn-secondary" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

export default function RuleManager({ ccpId }) {
  const [rules, setRules] = useState([]);
  const [ruleAlerts, setRuleAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const data = await getRulesByCCP(ccpId);
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  }, [ccpId]);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getRuleAlerts({ ccpId });
      setRuleAlerts(data.data || data || []);
    } catch (err) {
      console.error('Failed to fetch rule alerts:', err);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (showAlerts) {
      fetchAlerts();
    }
  }, [showAlerts, fetchAlerts]);

  const handleSave = () => {
    setShowForm(false);
    setEditingRule(null);
    fetchRules();
  };

  const handleToggle = async (rule) => {
    try {
      await toggleRule(rule.id);
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!confirm('确定删除此规则？')) return;
    try {
      await deleteRule(ruleId);
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await acknowledgeRuleAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const typeLabels = { cumulative: '累积告警', trend: '趋势告警' };

  if (loading) {
    return <div className="rule-manager-loading">加载规则...</div>;
  }

  return (
    <div className="rule-manager">
      <div className="rule-manager-header">
        <h3 className="rule-manager-title">告警规则</h3>
        <div className="rule-manager-actions">
          <button
            className="rule-btn rule-btn-secondary"
            onClick={() => setShowAlerts(!showAlerts)}
          >
            {showAlerts ? '隐藏告警记录' : `告警记录 (${ruleAlerts.length || ''})`}
          </button>
          <button
            className="rule-btn rule-btn-primary"
            onClick={() => { setEditingRule(null); setShowForm(true); }}
          >
            + 添加规则
          </button>
        </div>
      </div>

      {showForm && (
        <RuleForm
          ccpId={ccpId}
          rule={editingRule}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
        />
      )}

      {rules.length === 0 && !showForm ? (
        <div className="rule-empty">暂无告警规则，点击"添加规则"创建</div>
      ) : (
        <div className="rule-list">
          {rules.map((rule) => (
            <div key={rule.id} className={`rule-card ${rule.enabled ? '' : 'disabled'}`}>
              <div className="rule-card-header">
                <div className="rule-card-info">
                  <span className="rule-card-name">{rule.name}</span>
                  <span className={`rule-card-type type-${rule.type}`}>
                    {typeLabels[rule.type] || rule.type}
                  </span>
                </div>
                <div className="rule-card-actions">
                  <button
                    className={`rule-btn-icon ${rule.enabled ? 'active' : ''}`}
                    onClick={() => handleToggle(rule)}
                    title={rule.enabled ? '点击禁用' : '点击启用'}
                  >
                    {rule.enabled ? '●' : '○'}
                  </button>
                  <button
                    className="rule-btn-icon"
                    onClick={() => { setEditingRule(rule); setShowForm(true); }}
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    className="rule-btn-icon delete"
                    onClick={() => handleDelete(rule.id)}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="rule-card-config">
                {rule.type === 'cumulative' && (
                  <span>连续 {rule.config.consecutiveCount} 次超合规未达严重线</span>
                )}
                {rule.type === 'trend' && (
                  <span>{rule.config.windowMinutes}分钟内速率 &gt; {rule.config.rateThresholdPerMinute}°C/分</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAlerts && (
        <div className="rule-alerts-section">
          <h4 className="rule-alerts-title">规则告警记录</h4>
          {ruleAlerts.length === 0 ? (
            <div className="rule-empty">暂无规则告警记录</div>
          ) : (
            <div className="rule-alerts-list">
              {ruleAlerts.slice(0, 20).map((alert) => (
                <div key={alert.id} className={`rule-alert-item ${alert.status}`}>
                  <div className="rule-alert-item-header">
                    <span className={`rule-alert-type type-${alert.ruleType}`}>
                      {typeLabels[alert.ruleType] || alert.ruleType}
                    </span>
                    <span className="rule-alert-name">{alert.ruleName}</span>
                    <span className="rule-alert-time">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                    <span className={`rule-alert-status ${alert.status}`}>
                      {alert.status === 'open' ? '未确认' : '已确认'}
                    </span>
                  </div>
                  {alert.evidence && (
                    <div className="rule-alert-evidence">
                      <div className="evidence-desc">{alert.evidence.description}</div>
                      {alert.evidence.ruleType === 'cumulative' && alert.evidence.readings && (
                        <div className="evidence-details">
                          {alert.evidence.readings.map((r, i) => (
                            <span key={i} className="evidence-reading">
                              {r.temperature}°C
                              <span className="evidence-time">
                                {new Date(r.timestamp).toLocaleTimeString()}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                      {alert.evidence.ruleType === 'trend' && alert.evidence.startReading && (
                        <div className="evidence-details">
                          <span className="evidence-reading">
                            {alert.evidence.startReading.temperature}°C → {alert.evidence.endReading.temperature}°C
                          </span>
                          <span className="evidence-rate">
                            速率: {Math.abs(alert.evidence.actualRate).toFixed(2)}°C/分
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {alert.status === 'open' && (
                    <button
                      className="rule-btn rule-btn-sm"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      确认
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
