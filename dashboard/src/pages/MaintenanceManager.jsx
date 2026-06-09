import { useState, useEffect, useCallback } from 'react';
import {
  getProductionLines,
  getLineMaintenancePlans,
  createMaintenancePlan,
  deleteMaintenancePlan,
  getCurrentlyMaintainedLines,
} from '../api/client';

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function getPlanStatus(plan) {
  const now = Date.now();
  const start = new Date(plan.startTime).getTime();
  const end = new Date(plan.endTime).getTime();
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'scheduled';
  return 'completed';
}

export default function MaintenanceManager() {
  const [lines, setLines] = useState([]);
  const [selectedLine, setSelectedLine] = useState('');
  const [lineData, setLineData] = useState(null);
  const [maintainedLines, setMaintainedLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    productionLine: '',
    startTime: '',
    endTime: '',
    reason: '',
    responsiblePerson: '',
  });

  const fetchLines = useCallback(async () => {
    try {
      const data = await getProductionLines();
      setLines(data);
      if (!selectedLine && data.length > 0) {
        setSelectedLine(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch lines:', err);
    }
  }, [selectedLine]);

  const fetchLineData = useCallback(async () => {
    if (!selectedLine) return;
    try {
      const data = await getLineMaintenancePlans(selectedLine);
      setLineData(data);
    } catch (err) {
      console.error('Failed to fetch line plans:', err);
    }
  }, [selectedLine]);

  const fetchMaintainedLines = useCallback(async () => {
    try {
      const data = await getCurrentlyMaintainedLines();
      setMaintainedLines(data);
    } catch (err) {
      console.error('Failed to fetch maintained lines:', err);
    }
  }, []);

  useEffect(() => {
    fetchLines();
    fetchMaintainedLines();
  }, [fetchLines, fetchMaintainedLines]);

  useEffect(() => {
    fetchLineData();
  }, [fetchLineData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.productionLine) {
      setFormError('请选择产线');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setFormError('请填写开始时间和结束时间');
      return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      setFormError('结束时间必须晚于开始时间');
      return;
    }
    if (!form.reason.trim()) {
      setFormError('请填写维护原因');
      return;
    }
    if (!form.responsiblePerson.trim()) {
      setFormError('请填写负责人');
      return;
    }

    try {
      await createMaintenancePlan({
        productionLine: form.productionLine,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        reason: form.reason,
        responsiblePerson: form.responsiblePerson,
      });
      setShowForm(false);
      setForm({ productionLine: selectedLine || '', startTime: '', endTime: '', reason: '', responsiblePerson: '' });
      fetchLineData();
      fetchMaintainedLines();
    } catch (err) {
      setFormError(err.message || '创建失败');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该维护计划？')) return;
    try {
      await deleteMaintenancePlan(id);
      fetchLineData();
      fetchMaintainedLines();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const now = Date.now();

  const getLocalDateTimeValue = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  return (
    <div className="maintenance-manager">
      <div className="mnt-header">
        <h2 className="mnt-title">维护计划与停机窗口管理</h2>
        <button className="mnt-btn mnt-btn-primary" onClick={() => { setShowForm(!showForm); setFormError(''); setForm(f => ({ ...f, productionLine: selectedLine })); }}>
          {showForm ? '取消' : '+ 新建维护计划'}
        </button>
      </div>

      {maintainedLines.length > 0 && (
        <div className="mnt-active-section">
          <h3 className="mnt-section-title">当前维护中的产线</h3>
          <div className="mnt-active-grid">
            {maintainedLines.map(item => (
              <div key={item.productionLine} className="mnt-active-card">
                <div className="mnt-active-card-top">
                  <span className="mnt-active-line-name">{item.productionLine}</span>
                  <span className="mnt-active-badge">维护中</span>
                </div>
                <div className="mnt-active-card-info">
                  CCP数量: {item.ccpCount}
                </div>
                <div className="mnt-active-plans">
                  {item.activePlans.map(p => (
                    <div key={p.id} className="mnt-active-plan-item">
                      <span className="mnt-active-plan-reason">{p.reason}</span>
                      <span className="mnt-active-plan-time">
                        {formatTime(p.startTime)} ~ {formatTime(p.endTime)}
                      </span>
                      <span className="mnt-active-plan-person">负责人: {p.responsiblePerson}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="mnt-form-card">
          <h3 className="mnt-form-title">创建维护计划</h3>
          {formError && <div className="mnt-form-error">{formError}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mnt-form-grid">
              <div className="mnt-form-field">
                <label className="mnt-form-label">产线</label>
                <select className="mnt-form-select" value={form.productionLine} onChange={e => setForm(f => ({ ...f, productionLine: e.target.value }))}>
                  <option value="">请选择产线</option>
                  {lines.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="mnt-form-field">
                <label className="mnt-form-label">开始时间</label>
                <input type="datetime-local" className="mnt-form-input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="mnt-form-field">
                <label className="mnt-form-label">结束时间</label>
                <input type="datetime-local" className="mnt-form-input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div className="mnt-form-field">
                <label className="mnt-form-label">维护原因</label>
                <input type="text" className="mnt-form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="如：设备定期保养" />
              </div>
              <div className="mnt-form-field">
                <label className="mnt-form-label">负责人</label>
                <input type="text" className="mnt-form-input" value={form.responsiblePerson} onChange={e => setForm(f => ({ ...f, responsiblePerson: e.target.value }))} placeholder="如：张工" />
              </div>
            </div>
            <div className="mnt-form-actions">
              <button type="submit" className="mnt-btn mnt-btn-primary">创建</button>
              <button type="button" className="mnt-btn mnt-btn-secondary" onClick={() => setShowForm(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="mnt-line-selector">
        <label className="mnt-form-label">选择产线查看计划:</label>
        <select className="mnt-form-select" value={selectedLine} onChange={e => setSelectedLine(e.target.value)}>
          {lines.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {lineData && (
        <div className="mnt-line-detail">
          {lineData.active && lineData.active.length > 0 && (
            <div className="mnt-section">
              <h3 className="mnt-section-title">
                <span className="mnt-section-dot active"></span>
                进行中的维护
              </h3>
              <div className="mnt-timeline">
                {lineData.active.map(plan => {
                  const start = new Date(plan.startTime).getTime();
                  const end = new Date(plan.endTime).getTime();
                  const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
                  return (
                    <div key={plan.id} className="mnt-plan-card mnt-plan-active">
                      <div className="mnt-plan-timeline-bar">
                        <div className="mnt-plan-timeline-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="mnt-plan-header">
                        <span className="mnt-plan-id">{plan.id}</span>
                        <span className="mnt-plan-status active">进行中</span>
                      </div>
                      <div className="mnt-plan-body">
                        <div className="mnt-plan-reason">{plan.reason}</div>
                        <div className="mnt-plan-time">
                          {formatTime(plan.startTime)} ~ {formatTime(plan.endTime)}
                        </div>
                        <div className="mnt-plan-person">负责人: {plan.responsiblePerson}</div>
                        <div className="mnt-plan-progress">进度: {progress.toFixed(1)}%</div>
                      </div>
                      <button className="mnt-btn mnt-btn-danger-sm" onClick={() => handleDelete(plan.id)}>删除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lineData.future && lineData.future.length > 0 && (
            <div className="mnt-section">
              <h3 className="mnt-section-title">
                <span className="mnt-section-dot scheduled"></span>
                未来维护计划
              </h3>
              <div className="mnt-timeline">
                {lineData.future.map(plan => (
                  <div key={plan.id} className="mnt-plan-card mnt-plan-scheduled">
                    <div className="mnt-plan-header">
                      <span className="mnt-plan-id">{plan.id}</span>
                      <span className="mnt-plan-status scheduled">已计划</span>
                    </div>
                    <div className="mnt-plan-body">
                      <div className="mnt-plan-reason">{plan.reason}</div>
                      <div className="mnt-plan-time">
                        {formatTime(plan.startTime)} ~ {formatTime(plan.endTime)}
                      </div>
                      <div className="mnt-plan-person">负责人: {plan.responsiblePerson}</div>
                    </div>
                    <button className="mnt-btn mnt-btn-danger-sm" onClick={() => handleDelete(plan.id)}>删除</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lineData.history && lineData.history.length > 0 && (
            <div className="mnt-section">
              <h3 className="mnt-section-title">
                <span className="mnt-section-dot completed"></span>
                历史维护记录
              </h3>
              <div className="mnt-timeline">
                {lineData.history.slice(0, 20).map(plan => (
                  <div key={plan.id} className="mnt-plan-card mnt-plan-completed">
                    <div className="mnt-plan-header">
                      <span className="mnt-plan-id">{plan.id}</span>
                      <span className="mnt-plan-status completed">已完成</span>
                    </div>
                    <div className="mnt-plan-body">
                      <div className="mnt-plan-reason">{plan.reason}</div>
                      <div className="mnt-plan-time">
                        {formatTime(plan.startTime)} ~ {formatTime(plan.endTime)}
                      </div>
                      <div className="mnt-plan-person">负责人: {plan.responsiblePerson}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!lineData.active || lineData.active.length === 0) &&
            (!lineData.future || lineData.future.length === 0) &&
            (!lineData.history || lineData.history.length === 0) && (
            <div className="mnt-empty">该产线暂无维护计划</div>
          )}
        </div>
      )}
    </div>
  );
}
