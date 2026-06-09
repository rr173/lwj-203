import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getBatches,
  getBatch,
  getProductionLines,
  createBatch,
  finishBatch,
  releaseBatch,
  recallBatch,
  getBatchRiskRanking,
  getRecallThreshold,
  setRecallThreshold,
  addRecallExecution,
  getRecallSummary,
  getRecallOverview
} from '../api/client';

const STATUS_TEXT = {
  producing: '生产中',
  pending_inspection: '待检',
  released: '放行',
  recalled: '召回',
  closed: '已结案'
};

const STATUS_CLASS = {
  producing: 'producing',
  pending_inspection: 'pending',
  released: 'released',
  recalled: 'recalled',
  closed: 'closed'
};

function formatDuration(ms) {
  if (!ms || ms <= 0) return '--';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return remainMin > 0 ? `${hours}小时${remainMin}分钟` : `${hours}小时`;
}

function formatTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function BatchManager() {
  const [batches, setBatches] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLine, setFilterLine] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [threshold, setThresholdVal] = useState(60);
  const [thresholdInput, setThresholdInput] = useState('60');
  const [newBatch, setNewBatch] = useState({ batchNo: '', productName: '', productionLine: '', startTime: '' });
  const [createError, setCreateError] = useState('');
  const [recallExecForm, setRecallExecForm] = useState({ reason: '', affectedQuantity: '', recoveredQuantity: '', channel: '', responsiblePerson: '' });
  const [recallExecError, setRecallExecError] = useState('');
  const [recallOverviewData, setRecallOverviewData] = useState([]);
  const [showRecallOverview, setShowRecallOverview] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      const params = { pageSize: 100 };
      if (filterStatus) params.status = filterStatus;
      if (filterLine) params.productionLine = filterLine;
      const data = await getBatches(params);
      setBatches(data.data || []);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterLine]);

  const fetchLines = useCallback(async () => {
    try {
      const data = await getProductionLines();
      setLines(data);
    } catch (err) {
      console.error('Failed to fetch lines:', err);
    }
  }, []);

  const fetchThreshold = useCallback(async () => {
    try {
      const data = await getRecallThreshold();
      setThresholdVal(data.threshold);
      setThresholdInput(String(data.threshold));
    } catch (err) {
      console.error('Failed to fetch threshold:', err);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchLines();
    fetchThreshold();
  }, [fetchBatches, fetchLines, fetchThreshold]);

  useEffect(() => {
    const interval = setInterval(fetchBatches, 10000);
    return () => clearInterval(interval);
  }, [fetchBatches]);

  const handleSelectBatch = useCallback(async (batchId) => {
    setDetailLoading(true);
    try {
      const data = await getBatch(batchId);
      setSelectedBatch(data);
    } catch (err) {
      console.error('Failed to fetch batch detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleFinish = useCallback(async (id) => {
    try {
      await finishBatch(id);
      fetchBatches();
      if (selectedBatch && selectedBatch.id === id) {
        handleSelectBatch(id);
      }
    } catch (err) {
      console.error('Failed to finish batch:', err);
    }
  }, [fetchBatches, selectedBatch, handleSelectBatch]);

  const handleRelease = useCallback(async (id) => {
    try {
      await releaseBatch(id);
      fetchBatches();
      if (selectedBatch && selectedBatch.id === id) {
        handleSelectBatch(id);
      }
    } catch (err) {
      console.error('Failed to release batch:', err);
    }
  }, [fetchBatches, selectedBatch, handleSelectBatch]);

  const handleRecall = useCallback(async (id) => {
    try {
      await recallBatch(id);
      fetchBatches();
      if (selectedBatch && selectedBatch.id === id) {
        handleSelectBatch(id);
      }
    } catch (err) {
      console.error('Failed to recall batch:', err);
    }
  }, [fetchBatches, selectedBatch, handleSelectBatch]);

  const handleCreate = useCallback(async () => {
    setCreateError('');
    if (!newBatch.batchNo || !newBatch.productName || !newBatch.productionLine) {
      setCreateError('批号、产品名和产线不能为空');
      return;
    }
    try {
      await createBatch({
        ...newBatch,
        startTime: newBatch.startTime || new Date().toISOString()
      });
      setShowCreateForm(false);
      setNewBatch({ batchNo: '', productName: '', productionLine: '', startTime: '' });
      fetchBatches();
    } catch (err) {
      setCreateError(err.message || '创建失败');
    }
  }, [newBatch, fetchBatches]);

  const handleFetchRanking = useCallback(async () => {
    try {
      const data = await getBatchRiskRanking({ limit: 50 });
      setRankingData(data);
      setShowRanking(true);
    } catch (err) {
      console.error('Failed to fetch ranking:', err);
    }
  }, []);

  const handleSetThreshold = useCallback(async () => {
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 0 || val > 100) return;
    try {
      await setRecallThreshold(val);
      setThresholdVal(val);
    } catch (err) {
      console.error('Failed to set threshold:', err);
    }
  }, [thresholdInput]);

  const handleAddRecallExec = useCallback(async (batchId) => {
    setRecallExecError('');
    const { reason, affectedQuantity, recoveredQuantity, channel, responsiblePerson } = recallExecForm;
    if (!reason || !affectedQuantity || !recoveredQuantity || !channel || !responsiblePerson) {
      setRecallExecError('所有字段不能为空');
      return;
    }
    try {
      const result = await addRecallExecution(batchId, {
        reason,
        affectedQuantity: Number(affectedQuantity),
        recoveredQuantity: Number(recoveredQuantity),
        channel,
        responsiblePerson
      });
      setRecallExecForm({ reason: '', affectedQuantity: '', recoveredQuantity: '', channel: '', responsiblePerson: '' });
      handleSelectBatch(batchId);
      if (result.autoClosed) {
        fetchBatches();
      }
    } catch (err) {
      setRecallExecError(err.message || '录入失败');
    }
  }, [recallExecForm, handleSelectBatch, fetchBatches]);

  const handleFetchRecallOverview = useCallback(async () => {
    try {
      const data = await getRecallOverview();
      setRecallOverviewData(data);
      setShowRecallOverview(true);
    } catch (err) {
      console.error('Failed to fetch recall overview:', err);
    }
  }, []);

  const riskScoreColor = useMemo(() => (score) => {
    if (score >= threshold) return 'var(--color-red)';
    if (score >= 30) return 'var(--color-yellow)';
    return 'var(--color-green)';
  }, [threshold]);

  if (loading) {
    return (
      <div className="batch-manager">
        <div className="loading">
          <div className="loading-spinner" />
          加载中...
        </div>
      </div>
    );
  }

  if (selectedBatch) {
    const b = selectedBatch;
    const isHighRisk = b.riskScore >= threshold;
    return (
      <div className="batch-manager">
        <button className="batch-back-btn" onClick={() => setSelectedBatch(null)}>← 返回批次列表</button>

        <div className={`batch-detail-card ${isHighRisk ? 'high-risk' : ''}`}>
          <div className="batch-detail-header">
            <h2 className="batch-detail-title">{b.batchNo}</h2>
            <span className={`batch-status-badge ${STATUS_CLASS[b.status]}`}>
              {STATUS_TEXT[b.status]}
            </span>
            {b.recommendation === '建议召回' && (
              <span className="batch-recall-badge">建议召回</span>
            )}
          </div>

          <div className="batch-detail-info-grid">
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">产品名称</div>
              <div className="batch-detail-info-value">{b.productName}</div>
            </div>
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">所属产线</div>
              <div className="batch-detail-info-value">{b.productionLine}</div>
            </div>
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">开始时间</div>
              <div className="batch-detail-info-value">{formatTime(b.startTime)}</div>
            </div>
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">结束时间</div>
              <div className="batch-detail-info-value">{b.endTime ? formatTime(b.endTime) : '生产中'}</div>
            </div>
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">风险评分</div>
              <div className="batch-detail-info-value" style={{ color: riskScoreColor(b.riskScore), fontSize: '24px' }}>
                {b.riskScore}
              </div>
            </div>
            <div className="batch-detail-info-item">
              <div className="batch-detail-info-label">系统建议</div>
              <div className="batch-detail-info-value" style={{ color: isHighRisk ? 'var(--color-red)' : 'var(--color-green)' }}>
                {b.recommendation}
              </div>
            </div>
          </div>

          <div className="batch-detail-actions">
            {b.status === 'producing' && (
              <button className="batch-btn batch-btn-warning" onClick={() => handleFinish(b.id)}>结束生产</button>
            )}
            {b.status === 'pending_inspection' && (
              <>
                <button className="batch-btn batch-btn-success" onClick={() => handleRelease(b.id)}>放行</button>
                <button className="batch-btn batch-btn-danger" onClick={() => handleRecall(b.id)}>召回</button>
              </>
            )}
            {b.status === 'released' && (
              <button className="batch-btn batch-btn-danger" onClick={() => handleRecall(b.id)}>召回</button>
            )}
          </div>
        </div>

        {(b.status === 'recalled' || b.status === 'closed') && b.recallSummary && (
          <div className="batch-recall-exec-section">
            <h3 className="batch-section-title">召回执行</h3>

            <div className="batch-recall-progress-row">
              <div className="batch-recall-progress-label">回收进度</div>
              <div className="batch-recall-progress-bar-wrap">
                <div className="batch-recall-progress-bar">
                  <div
                    className="batch-recall-progress-fill"
                    style={{
                      width: `${Math.min(b.recallSummary.recoveryRate * 100, 100)}%`,
                      background: b.recallSummary.recoveryRate >= 0.95
                        ? 'var(--color-green)'
                        : b.recallSummary.recoveryRate >= 0.6
                          ? 'var(--color-yellow)'
                          : 'var(--color-red)'
                    }}
                  />
                </div>
                <span className="batch-recall-progress-pct">
                  {(b.recallSummary.recoveryRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="batch-recall-progress-detail">
                <span>已回收 {b.recallSummary.totalRecovered} 件</span>
                <span> / 影响 {b.recallSummary.affectedQuantity} 件</span>
              </div>
              {b.status === 'closed' && (
                <span className="batch-recall-closed-badge">已结案</span>
              )}
            </div>

            {Object.keys(b.recallSummary.channelBreakdown).length > 0 && (
              <div className="batch-recall-channels">
                <div className="batch-recall-channels-title">各渠道回收明细</div>
                <div className="batch-recall-channels-grid">
                  {Object.entries(b.recallSummary.channelBreakdown).map(([ch, qty]) => (
                    <div key={ch} className="batch-recall-channel-item">
                      <div className="batch-recall-channel-name">{ch}</div>
                      <div className="batch-recall-channel-qty">{qty} 件</div>
                      <div className="batch-recall-channel-bar-wrap">
                        <div
                          className="batch-recall-channel-bar-fill"
                          style={{
                            width: `${b.recallSummary.affectedQuantity > 0 ? (qty / b.recallSummary.affectedQuantity * 100) : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {b.recallSummary.records && b.recallSummary.records.length > 0 && (
              <div className="batch-recall-records">
                <div className="batch-recall-records-title">回收记录 ({b.recallSummary.records.length})</div>
                <div className="batch-recall-records-list">
                  {b.recallSummary.records.map(rec => (
                    <div key={rec.id} className="batch-recall-record-item">
                      <div className="batch-recall-record-left">
                        <span className="batch-recall-record-channel">{rec.channel}</span>
                        <span className="batch-recall-record-reason">{rec.reason}</span>
                      </div>
                      <div className="batch-recall-record-right">
                        <span className="batch-recall-record-qty">+{rec.recoveredQuantity}件</span>
                        <span className="batch-recall-record-person">{rec.responsiblePerson}</span>
                        <span className="batch-recall-record-time">{formatTime(rec.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {b.status === 'recalled' && (
              <div className="batch-recall-exec-form">
                <div className="batch-recall-exec-form-title">录入新回收记录</div>
                {recallExecError && <div className="batch-form-error">{recallExecError}</div>}
                <div className="batch-form-grid">
                  <div className="batch-form-field">
                    <label className="batch-form-label">召回原因</label>
                    <input
                      className="batch-form-input"
                      value={recallExecForm.reason}
                      onChange={e => setRecallExecForm({ ...recallExecForm, reason: e.target.value })}
                      placeholder="如: 温度偏差导致质量隐患"
                    />
                  </div>
                  <div className="batch-form-field">
                    <label className="batch-form-label">影响数量(件)</label>
                    <input
                      className="batch-form-input"
                      type="number"
                      min="1"
                      value={recallExecForm.affectedQuantity}
                      onChange={e => setRecallExecForm({ ...recallExecForm, affectedQuantity: e.target.value })}
                      placeholder="如: 500"
                    />
                  </div>
                  <div className="batch-form-field">
                    <label className="batch-form-label">已回收数量(件)</label>
                    <input
                      className="batch-form-input"
                      type="number"
                      min="1"
                      value={recallExecForm.recoveredQuantity}
                      onChange={e => setRecallExecForm({ ...recallExecForm, recoveredQuantity: e.target.value })}
                      placeholder="如: 100"
                    />
                  </div>
                  <div className="batch-form-field">
                    <label className="batch-form-label">回收渠道</label>
                    <select
                      className="batch-form-select"
                      value={recallExecForm.channel}
                      onChange={e => setRecallExecForm({ ...recallExecForm, channel: e.target.value })}
                    >
                      <option value="">请选择渠道</option>
                      <option value="门店退回">门店退回</option>
                      <option value="经销商退回">经销商退回</option>
                      <option value="消费者退回">消费者退回</option>
                    </select>
                  </div>
                  <div className="batch-form-field">
                    <label className="batch-form-label">负责人</label>
                    <input
                      className="batch-form-input"
                      value={recallExecForm.responsiblePerson}
                      onChange={e => setRecallExecForm({ ...recallExecForm, responsiblePerson: e.target.value })}
                      placeholder="如: 张三"
                    />
                  </div>
                </div>
                <div className="batch-form-actions">
                  <button className="batch-btn batch-btn-primary" onClick={() => handleAddRecallExec(b.id)}>确认录入</button>
                </div>
              </div>
            )}
          </div>
        )}

        {b.riskDetails && (
          <div className="batch-risk-section">
            <h3 className="batch-section-title">风险计算明细</h3>
            <div className="batch-risk-grid">
              <div className="batch-risk-item">
                <div className="batch-risk-label">关联偏差数</div>
                <div className="batch-risk-value">{b.riskDetails.deviationCount}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">加权偏差数</div>
                <div className="batch-risk-value">{b.riskDetails.weightedCount}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">严重偏差</div>
                <div className="batch-risk-value" style={{ color: 'var(--color-red)' }}>{b.riskDetails.severityDistribution.critical || 0}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">轻微偏差</div>
                <div className="batch-risk-value" style={{ color: 'var(--color-yellow)' }}>{b.riskDetails.severityDistribution.minor || 0}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">累计偏差时长</div>
                <div className="batch-risk-value">{formatDuration(b.riskDetails.totalDeviationMs)}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">批次总时长</div>
                <div className="batch-risk-value">{formatDuration(b.riskDetails.batchDurationMs)}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">偏差时长占比</div>
                <div className="batch-risk-value">{(b.riskDetails.durationRatio * 100).toFixed(1)}%</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">最长连续偏差</div>
                <div className="batch-risk-value">{formatDuration(b.riskDetails.maxConsecutiveDeviationMs)}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">数量得分 (满分40)</div>
                <div className="batch-risk-value">{b.riskDetails.countScore}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">时长得分 (满分40)</div>
                <div className="batch-risk-value">{b.riskDetails.durationScore}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">严重度加分 (满分20)</div>
                <div className="batch-risk-value">{b.riskDetails.severityBonus}</div>
              </div>
              <div className="batch-risk-item">
                <div className="batch-risk-label">风险总分</div>
                <div className="batch-risk-value" style={{ color: riskScoreColor(b.riskScore), fontSize: '20px', fontWeight: 700 }}>{b.riskScore}</div>
              </div>
            </div>
          </div>
        )}

        {b.linkedDeviations && b.linkedDeviations.length > 0 && (
          <div className="batch-deviations-section">
            <h3 className="batch-section-title">关联偏差事件 ({b.linkedDeviations.length})</h3>
            <div className="batch-deviations-list">
              {b.linkedDeviations.map(dev => (
                <div key={dev.id} className={`batch-deviation-item ${dev.level}`}>
                  <div className="batch-deviation-left">
                    <span className={`batch-deviation-level ${dev.level}`}>
                      {dev.level === 'critical' ? '严重' : '轻微'}
                    </span>
                    <span className="batch-deviation-id">{dev.id}</span>
                    <span className="batch-deviation-ccp">{dev.ccpId}</span>
                  </div>
                  <div className="batch-deviation-right">
                    <span className="batch-deviation-temp">{dev.initialTemperature}°C</span>
                    <span className="batch-deviation-time">{formatTime(dev.createdAt)}</span>
                    <span className={`batch-deviation-status ${dev.status}`}>{dev.status === 'closed' ? '已关闭' : dev.status === 'escalated' ? '已升级' : '进行中'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {b.linkedDeviations && b.linkedDeviations.length === 0 && (
          <div className="batch-deviations-section">
            <h3 className="batch-section-title">关联偏差事件</h3>
            <div className="batch-empty">该批次生产时段内无关联偏差事件</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="batch-manager">
      <div className="batch-header">
        <h2 className="batch-title">批次管理与召回决策</h2>
        <div className="batch-header-actions">
          <button className="batch-btn batch-btn-primary" onClick={() => setShowCreateForm(true)}>新建批次</button>
          <button className="batch-btn batch-btn-secondary" onClick={handleFetchRanking}>风险排行</button>
          <button className="batch-btn batch-btn-danger" onClick={handleFetchRecallOverview}>召回总览</button>
        </div>
      </div>

      <div className="batch-filters">
        <select className="batch-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">全部状态</option>
          <option value="producing">生产中</option>
          <option value="pending_inspection">待检</option>
          <option value="released">放行</option>
          <option value="recalled">召回</option>
          <option value="closed">已结案</option>
        </select>
        <select className="batch-filter-select" value={filterLine} onChange={e => setFilterLine(e.target.value)}>
          <option value="">全部产线</option>
          {lines.map(line => (
            <option key={line} value={line}>{line}</option>
          ))}
        </select>
        <div className="batch-threshold-control">
          <span className="batch-threshold-label">召回阈值:</span>
          <input
            type="number"
            className="batch-threshold-input"
            value={thresholdInput}
            min="0"
            max="100"
            onChange={e => setThresholdInput(e.target.value)}
          />
          <button className="batch-btn batch-btn-sm" onClick={handleSetThreshold}>设置</button>
        </div>
      </div>

      {showCreateForm && (
        <div className="batch-create-form">
          <h3 className="batch-form-title">新建生产批次</h3>
          {createError && <div className="batch-form-error">{createError}</div>}
          <div className="batch-form-grid">
            <div className="batch-form-field">
              <label className="batch-form-label">批号</label>
              <input className="batch-form-input" value={newBatch.batchNo} onChange={e => setNewBatch({ ...newBatch, batchNo: e.target.value })} placeholder="如: LOT-A-20260609-003" />
            </div>
            <div className="batch-form-field">
              <label className="batch-form-label">产品名称</label>
              <input className="batch-form-input" value={newBatch.productName} onChange={e => setNewBatch({ ...newBatch, productName: e.target.value })} placeholder="如: 红烧排骨罐头" />
            </div>
            <div className="batch-form-field">
              <label className="batch-form-label">所属产线</label>
              <select className="batch-form-select" value={newBatch.productionLine} onChange={e => setNewBatch({ ...newBatch, productionLine: e.target.value })}>
                <option value="">请选择产线</option>
                {lines.map(line => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
            <div className="batch-form-field">
              <label className="batch-form-label">开始时间 (可选)</label>
              <input className="batch-form-input" type="datetime-local" value={newBatch.startTime ? new Date(newBatch.startTime).toISOString().slice(0, 16) : ''} onChange={e => setNewBatch({ ...newBatch, startTime: e.target.value ? new Date(e.target.value).toISOString() : '' })} />
            </div>
          </div>
          <div className="batch-form-actions">
            <button className="batch-btn batch-btn-primary" onClick={handleCreate}>确认创建</button>
            <button className="batch-btn batch-btn-secondary" onClick={() => { setShowCreateForm(false); setCreateError(''); }}>取消</button>
          </div>
        </div>
      )}

      {showRanking && (
        <div className="batch-ranking-section">
          <div className="batch-ranking-header">
            <h3 className="batch-section-title">批次风险评分排行</h3>
            <button className="batch-btn batch-btn-sm" onClick={() => setShowRanking(false)}>关闭</button>
          </div>
          <div className="batch-ranking-list">
            {rankingData.map((item, idx) => (
              <div key={item.id} className={`batch-ranking-item ${item.riskLevel === 'high' ? 'high-risk' : ''}`}>
                <span className="batch-ranking-idx">{idx + 1}</span>
                <span className="batch-ranking-no">{item.batchNo}</span>
                <span className="batch-ranking-product">{item.productName}</span>
                <span className="batch-ranking-line">{item.productionLine}</span>
                <span className={`batch-ranking-status ${STATUS_CLASS[item.status]}`}>{STATUS_TEXT[item.status]}</span>
                <span className="batch-ranking-devcount">{item.deviationCount}偏差</span>
                <span className="batch-ranking-score" style={{ color: riskScoreColor(item.riskScore) }}>{item.riskScore}分</span>
                {item.recommendation === '建议召回' && <span className="batch-ranking-recall">建议召回</span>}
              </div>
            ))}
            {rankingData.length === 0 && <div className="batch-empty">暂无数据</div>}
          </div>
        </div>
      )}

      {showRecallOverview && (
        <div className="batch-recall-overview-section">
          <div className="batch-ranking-header">
            <h3 className="batch-section-title">召回批次回收进度总览（按回收率升序排列）</h3>
            <button className="batch-btn batch-btn-sm" onClick={() => setShowRecallOverview(false)}>关闭</button>
          </div>
          <div className="batch-recall-overview-list">
            {recallOverviewData.map(item => (
              <div
                key={item.batchId}
                className={`batch-recall-overview-item ${item.recoveryRate < 0.6 ? 'low-recovery' : ''} ${item.batchStatus === 'closed' ? 'closed-batch' : ''}`}
                onClick={() => { setShowRecallOverview(false); handleSelectBatch(item.batchId); }}
              >
                <div className="batch-recall-overview-left">
                  <span className="batch-recall-overview-no">{item.batchNo}</span>
                  <span className="batch-recall-overview-product">{item.productName}</span>
                  <span className={`batch-recall-overview-status ${STATUS_CLASS[item.batchStatus]}`}>{STATUS_TEXT[item.batchStatus]}</span>
                </div>
                <div className="batch-recall-overview-center">
                  <div className="batch-recall-overview-bar-wrap">
                    <div
                      className="batch-recall-overview-bar-fill"
                      style={{
                        width: `${Math.min(item.recoveryRate * 100, 100)}%`,
                        background: item.recoveryRate >= 0.95
                          ? 'var(--color-green)'
                          : item.recoveryRate >= 0.6
                            ? 'var(--color-yellow)'
                            : 'var(--color-red)'
                      }}
                    />
                  </div>
                  <span className="batch-recall-overview-pct">{(item.recoveryRate * 100).toFixed(1)}%</span>
                </div>
                <div className="batch-recall-overview-right">
                  <span>{item.totalRecovered}/{item.affectedQuantity}件</span>
                  <span>{item.recordCount}条记录</span>
                </div>
                {item.batchStatus === 'recalled' && item.recoveryRate < 0.6 && <span className="batch-recall-overview-alert">重点跟踪</span>}
                {item.batchStatus === 'closed' && <span className="batch-recall-overview-closed">已结案</span>}
              </div>
            ))}
            {recallOverviewData.length === 0 && <div className="batch-empty">暂无召回记录</div>}
          </div>
        </div>
      )}

      <div className="batch-list">
        {batches.map(batch => {
          const isHigh = batch.riskScore >= threshold;
          return (
            <div
              key={batch.id}
              className={`batch-card ${isHigh ? 'high-risk' : ''}`}
              onClick={() => handleSelectBatch(batch.id)}
            >
              <div className="batch-card-top">
                <div className="batch-card-no">{batch.batchNo}</div>
                <span className={`batch-status-badge ${STATUS_CLASS[batch.status]}`}>
                  {STATUS_TEXT[batch.status]}
                </span>
              </div>
              <div className="batch-card-product">{batch.productName}</div>
              <div className="batch-card-line">{batch.productionLine}</div>
              <div className="batch-card-bottom">
                <div className="batch-card-time">
                  {formatTime(batch.startTime)} ~ {batch.endTime ? formatTime(batch.endTime) : '进行中'}
                </div>
                <div className="batch-card-risk">
                  <span className="batch-risk-score" style={{ color: riskScoreColor(batch.riskScore) }}>
                    {batch.riskScore}
                  </span>
                  <span className="batch-risk-label">风险分</span>
                </div>
              </div>
              {isHigh && <div className="batch-card-risk-overlay">高风险</div>}
            </div>
          );
        })}
        {batches.length === 0 && (
          <div className="batch-empty">暂无批次数据</div>
        )}
      </div>
    </div>
  );
}
