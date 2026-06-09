import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  getCalibrationDashboard,
  getCalibrationsByCCP,
  addCalibration,
  getCalibrationAlerts,
  acknowledgeCalibrationAlert
} from '../api/client';

const STATUS_TEXT = {
  normal: '正常',
  expiring_soon: '即将到期',
  expired: '已过期',
  drift_alert: '漂移告警'
};

const STATUS_CLASS = {
  normal: 'cal-status-normal',
  expiring_soon: 'cal-status-expiring',
  expired: 'cal-status-expired',
  drift_alert: 'cal-status-drift'
};

const ALERT_STATUS_TEXT = {
  open: '待处理',
  acknowledged: '已确认',
  auto_resolved: '已自动恢复'
};

function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{formatDate(d.calibrationDate)}</div>
      <div className="custom-tooltip-item">
        <span className="custom-tooltip-dot" style={{ background: '#eab308' }} />
        偏差值: {d.deviation.toFixed(4)}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
        标准: {d.standardValue} / 实测: {d.measuredValue}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        校准人: {d.calibratedBy}
      </div>
    </div>
  );
}

export default function CalibrationManager() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCCP, setSelectedCCP] = useState(null);
  const [calRecords, setCalRecords] = useState([]);
  const [calStatus, setCalStatus] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    calibrationDate: '',
    standardValue: '',
    measuredValue: '',
    calibratedBy: '',
    nextCalibrationDue: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await getCalibrationDashboard();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to fetch calibration dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getCalibrationAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch calibration alerts:', err);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchAlerts();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchAlerts]);

  const handleSelectCCP = useCallback(async (ccpId) => {
    setDetailLoading(true);
    setShowForm(false);
    try {
      const data = await getCalibrationsByCCP(ccpId);
      setCalRecords(data.records || []);
      setCalStatus(data.calibrationStatus || null);
      setSelectedCCP(ccpId);
    } catch (err) {
      console.error('Failed to fetch calibration records:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSubmitCalibration = useCallback(async () => {
    setFormError('');
    if (!selectedCCP) return;
    const { calibrationDate, standardValue, measuredValue, calibratedBy, nextCalibrationDue } = formData;
    if (!calibrationDate || standardValue === '' || measuredValue === '' || !calibratedBy) {
      setFormError('校准日期、标准值、实测值和校准人员为必填项');
      return;
    }
    setSubmitting(true);
    try {
      await addCalibration(selectedCCP, {
        calibrationDate: new Date(calibrationDate).toISOString(),
        standardValue: parseFloat(standardValue),
        measuredValue: parseFloat(measuredValue),
        calibratedBy,
        nextCalibrationDue: nextCalibrationDue ? new Date(nextCalibrationDue).toISOString() : null
      });
      setFormData({ calibrationDate: '', standardValue: '', measuredValue: '', calibratedBy: '', nextCalibrationDue: '' });
      setShowForm(false);
      handleSelectCCP(selectedCCP);
      fetchDashboard();
      fetchAlerts();
    } catch (err) {
      setFormError(err.message || '录入失败');
    } finally {
      setSubmitting(false);
    }
  }, [selectedCCP, formData, handleSelectCCP, fetchDashboard, fetchAlerts]);

  const handleAckAlert = useCallback(async (alertId) => {
    try {
      await acknowledgeCalibrationAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  }, [fetchAlerts]);

  const chartData = useMemo(() => {
    return calRecords.map(r => ({
      ...r,
      dateLabel: formatDate(r.calibrationDate)
    }));
  }, [calRecords]);

  const statusCounts = useMemo(() => {
    if (!dashboard || !dashboard.statusCounts) {
      return { normal: 0, expiring_soon: 0, expired: 0, drift_alert: 0 };
    }
    return dashboard.statusCounts;
  }, [dashboard]);

  const selectedCCPInfo = useMemo(() => {
    if (!dashboard || !selectedCCP) return null;
    return dashboard.items.find(item => item.ccpId === selectedCCP);
  }, [dashboard, selectedCCP]);

  if (loading) {
    return (
      <div className="calibration-manager">
        <div className="loading">
          <div className="loading-spinner" />
          加载中...
        </div>
      </div>
    );
  }

  if (selectedCCP) {
    const deviationValues = calRecords.map(r => r.deviation);
    const minDev = deviationValues.length > 0 ? Math.min(...deviationValues) : -1;
    const maxDev = deviationValues.length > 0 ? Math.max(...deviationValues) : 1;
    const padding = Math.max(Math.abs(minDev), Math.abs(maxDev), 0.5) * 0.3;

    return (
      <div className="calibration-manager">
        <button className="cal-back-btn" onClick={() => { setSelectedCCP(null); setCalRecords([]); setCalStatus(null); setShowForm(false); }}>
          ← 返回校准看板
        </button>

        <div className="cal-detail-header">
          <h2 className="cal-detail-title">{selectedCCPInfo ? selectedCCPInfo.ccpName : selectedCCP}</h2>
          {calStatus && (
            <span className={`cal-status-badge ${STATUS_CLASS[calStatus.status]}`}>
              {STATUS_TEXT[calStatus.status]}
            </span>
          )}
          {selectedCCPInfo && (
            <span className="cal-detail-line">{selectedCCPInfo.productionLine}</span>
          )}
        </div>

        {calStatus && (
          <div className="cal-detail-info-grid">
            <div className="cal-detail-info-item">
              <div className="cal-detail-info-label">校准状态</div>
              <div className={`cal-detail-info-value ${STATUS_CLASS[calStatus.status]}`}>
                {STATUS_TEXT[calStatus.status]}
              </div>
            </div>
            <div className="cal-detail-info-item">
              <div className="cal-detail-info-label">状态说明</div>
              <div className="cal-detail-info-value" style={{ fontSize: '14px' }}>{calStatus.reason}</div>
            </div>
            <div className="cal-detail-info-item">
              <div className="cal-detail-info-label">下次校准截止</div>
              <div className="cal-detail-info-value">{calStatus.nextDue ? formatDate(calStatus.nextDue) : '未设定'}</div>
            </div>
            <div className="cal-detail-info-item">
              <div className="cal-detail-info-label">校准记录数</div>
              <div className="cal-detail-info-value">{calRecords.length}</div>
            </div>
          </div>
        )}

        {detailLoading && (
          <div className="loading" style={{ padding: '24px' }}>
            <div className="loading-spinner" />
            加载中...
          </div>
        )}

        {!detailLoading && calRecords.length > 0 && (
          <div className="cal-chart-section">
            <h3 className="cal-section-title">偏差趋势 (校准历史折线图)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  domain={[minDev - padding, maxDev + padding]}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  stroke="var(--color-border)"
                  label={{ value: '偏差值', angle: -90, position: 'insideLeft', fill: 'var(--color-text-secondary)', fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="var(--color-green)" strokeDasharray="6 3" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="deviation"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ fill: '#eab308', r: 4, strokeWidth: 2, stroke: '#eab308' }}
                  activeDot={{ r: 6, fill: '#eab308', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {!detailLoading && calRecords.length === 0 && (
          <div className="cal-chart-section">
            <h3 className="cal-section-title">偏差趋势</h3>
            <div className="cal-empty">暂无校准记录，请录入第一条校准记录</div>
          </div>
        )}

        {!detailLoading && calRecords.length > 0 && (
          <div className="cal-records-section">
            <h3 className="cal-section-title">校准记录 ({calRecords.length})</h3>
            <div className="cal-records-table-wrap">
              <table className="cal-records-table">
                <thead>
                  <tr>
                    <th>校准日期</th>
                    <th>标准值</th>
                    <th>实测值</th>
                    <th>偏差值</th>
                    <th>校准人员</th>
                    <th>下次截止</th>
                  </tr>
                </thead>
                <tbody>
                  {[...calRecords].reverse().map(r => (
                    <tr key={r.id}>
                      <td>{formatDate(r.calibrationDate)}</td>
                      <td>{r.standardValue}</td>
                      <td>{r.measuredValue}</td>
                      <td style={{ color: Math.abs(r.deviation) > 0.5 ? 'var(--color-red)' : Math.abs(r.deviation) > 0.2 ? 'var(--color-yellow)' : 'var(--color-green)', fontWeight: 600 }}>
                        {r.deviation.toFixed(4)}
                      </td>
                      <td>{r.calibratedBy}</td>
                      <td>{r.nextCalibrationDue ? formatDate(r.nextCalibrationDue) : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="cal-form-section">
          {!showForm ? (
            <button className="cal-btn cal-btn-primary" onClick={() => setShowForm(true)}>
              + 录入新校准记录
            </button>
          ) : (
            <div className="cal-form-card">
              <h3 className="cal-section-title">录入新校准记录</h3>
              {formError && <div className="cal-form-error">{formError}</div>}
              <div className="cal-form-grid">
                <div className="cal-form-field">
                  <label className="cal-form-label">校准日期 *</label>
                  <input
                    className="cal-form-input"
                    type="datetime-local"
                    value={formData.calibrationDate}
                    onChange={e => setFormData({ ...formData, calibrationDate: e.target.value })}
                  />
                </div>
                <div className="cal-form-field">
                  <label className="cal-form-label">标准值 *</label>
                  <input
                    className="cal-form-input"
                    type="number"
                    step="0.01"
                    value={formData.standardValue}
                    onChange={e => setFormData({ ...formData, standardValue: e.target.value })}
                    placeholder="如: 75.000"
                  />
                </div>
                <div className="cal-form-field">
                  <label className="cal-form-label">实测值 *</label>
                  <input
                    className="cal-form-input"
                    type="number"
                    step="0.01"
                    value={formData.measuredValue}
                    onChange={e => setFormData({ ...formData, measuredValue: e.target.value })}
                    placeholder="如: 75.230"
                  />
                </div>
                <div className="cal-form-field">
                  <label className="cal-form-label">校准人员 *</label>
                  <input
                    className="cal-form-input"
                    value={formData.calibratedBy}
                    onChange={e => setFormData({ ...formData, calibratedBy: e.target.value })}
                    placeholder="如: 张三"
                  />
                </div>
                <div className="cal-form-field">
                  <label className="cal-form-label">下次校准截止日期</label>
                  <input
                    className="cal-form-input"
                    type="datetime-local"
                    value={formData.nextCalibrationDue}
                    onChange={e => setFormData({ ...formData, nextCalibrationDue: e.target.value })}
                  />
                </div>
              </div>
              <div className="cal-form-actions">
                <button className="cal-btn cal-btn-primary" onClick={handleSubmitCalibration} disabled={submitting}>
                  {submitting ? '提交中...' : '确认录入'}
                </button>
                <button className="cal-btn cal-btn-secondary" onClick={() => { setShowForm(false); setFormError(''); }}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="calibration-manager">
      <div className="cal-header">
        <h2 className="cal-title">设备校准管理与漂移检测</h2>
      </div>

      <div className="cal-stats-cards">
        <div className="cal-stat-card cal-stat-expired">
          <div className="cal-stat-value">{statusCounts.expired}</div>
          <div className="cal-stat-label">已过期</div>
        </div>
        <div className="cal-stat-card cal-stat-drift">
          <div className="cal-stat-value">{statusCounts.drift_alert}</div>
          <div className="cal-stat-label">漂移告警</div>
        </div>
        <div className="cal-stat-card cal-stat-expiring">
          <div className="cal-stat-value">{statusCounts.expiring_soon}</div>
          <div className="cal-stat-label">即将到期</div>
        </div>
        <div className="cal-stat-card cal-stat-normal">
          <div className="cal-stat-value">{statusCounts.normal}</div>
          <div className="cal-stat-label">正常</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="cal-alerts-section">
          <h3 className="cal-section-title">漂移告警记录 ({alerts.length})</h3>
          <div className="cal-alerts-list">
            {alerts.map(alert => (
              <div key={alert.id} className={`cal-alert-item cal-alert-${alert.status}`}>
                <div className="cal-alert-left">
                  <span className="cal-alert-type">漂移告警</span>
                  <span className="cal-alert-ccp">{alert.ccpName}</span>
                  <span className="cal-alert-line">{alert.productionLine}</span>
                  <span className={`cal-alert-status cal-alert-status-${alert.status}`}>
                    {ALERT_STATUS_TEXT[alert.status] || alert.status}
                  </span>
                </div>
                <div className="cal-alert-right">
                  <span className="cal-alert-time">{formatTime(alert.createdAt)}</span>
                  {alert.status === 'auto_resolved' && alert.resolvedAt && (
                    <span className="cal-alert-resolved-time">恢复于 {formatTime(alert.resolvedAt)}</span>
                  )}
                  {alert.status === 'open' && (
                    <button className="cal-btn cal-btn-sm" onClick={() => handleAckAlert(alert.id)}>确认</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cal-ccp-list-section">
        <h3 className="cal-section-title">CCP校准状态 (按紧急程度排序)</h3>
        <div className="cal-ccp-list">
          {dashboard && dashboard.items.map(item => (
            <div
              key={item.ccpId}
              className={`cal-ccp-card ${STATUS_CLASS[item.calibrationStatus]}`}
              onClick={() => handleSelectCCP(item.ccpId)}
            >
              <div className="cal-ccp-top">
                <div className="cal-ccp-name">{item.ccpName}</div>
                <span className={`cal-status-badge ${STATUS_CLASS[item.calibrationStatus]}`}>
                  {STATUS_TEXT[item.calibrationStatus]}
                </span>
              </div>
              <div className="cal-ccp-line">{item.productionLine}</div>
              <div className="cal-ccp-bottom">
                <div className="cal-ccp-info">
                  <span>最近校准: {item.lastCalibrationDate ? formatDate(item.lastCalibrationDate) : '无'}</span>
                  {item.lastDeviation !== null && (
                    <span className="cal-ccp-deviation">偏差: {item.lastDeviation.toFixed(4)}</span>
                  )}
                </div>
                <div className="cal-ccp-due">
                  {item.nextCalibrationDue && (
                    <span>截止: {formatDate(item.nextCalibrationDue)}</span>
                  )}
                </div>
              </div>
              {item.driftAlert && (
                <div className="cal-ccp-drift-badge">漂移加剧</div>
              )}
            </div>
          ))}
          {(!dashboard || dashboard.items.length === 0) && (
            <div className="cal-empty">暂无CCP数据</div>
          )}
        </div>
      </div>
    </div>
  );
}
