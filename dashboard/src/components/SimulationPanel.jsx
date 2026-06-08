import { useState, useEffect, useCallback } from 'react';
import {
  getAllScenes, deleteScene,
  startRecording, stopRecording, getRecordingStatus,
  startReplay, pauseReplay, resumeReplay, stopReplay, getReplayStatus, setReplaySpeed,
  startSimulation, stopSimulation, getSimulationStatus,
} from '../api/client';

const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
];

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

export default function SimulationPanel({ ccpId }) {
  const [tab, setTab] = useState('replay');
  const [scenes, setScenes] = useState([]);
  const [recording, setRecording] = useState(null);
  const [replay, setReplay] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [replaySpeed, setReplaySpeedState] = useState(1);
  const [simMode, setSimMode] = useState('fixed');
  const [simFixedTemp, setSimFixedTemp] = useState('');
  const [simBaseTemp, setSimBaseTemp] = useState('');
  const [simAmplitude, setSimAmplitude] = useState('');
  const [simPeriod, setSimPeriod] = useState('');
  const [recordName, setRecordName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchScenes = useCallback(async () => {
    try {
      const data = await getAllScenes();
      setScenes(data);
    } catch (err) {
      console.error('Failed to fetch scenes:', err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const [recData, repData, simData] = await Promise.all([
        getRecordingStatus(ccpId).catch(() => null),
        getReplayStatus(ccpId).catch(() => null),
        getSimulationStatus(ccpId).catch(() => null),
      ]);
      setRecording(recData);
      setReplay(repData);
      setSimulation(simData);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchScenes();
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchScenes, fetchStatus]);

  const handleStartRecording = async () => {
    setError('');
    setLoading(true);
    try {
      await startRecording(ccpId, recordName || undefined);
      setRecordName('');
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecording = async () => {
    setError('');
    setLoading(true);
    try {
      await stopRecording(ccpId);
      await fetchStatus();
      await fetchScenes();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScene = async (id) => {
    if (!confirm('确定删除此场景？')) return;
    try {
      await deleteScene(id);
      await fetchScenes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartReplay = async () => {
    if (!selectedSceneId) {
      setError('请选择要回放的场景');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await startReplay(selectedSceneId, ccpId, replaySpeed);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseReplay = async () => {
    setError('');
    try {
      await pauseReplay(ccpId);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResumeReplay = async () => {
    setError('');
    try {
      await resumeReplay(ccpId);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStopReplay = async () => {
    setError('');
    try {
      await stopReplay(ccpId);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSpeedChange = async (speed) => {
    setError('');
    setReplaySpeedState(speed);
    if (replay && replay.status === 'playing') {
      try {
        await setReplaySpeed(ccpId, speed);
        await fetchStatus();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleStartSimulation = async () => {
    setError('');
    if (simMode === 'fixed') {
      if (!simFixedTemp || isNaN(Number(simFixedTemp))) {
        setError('请输入有效的固定温度');
        return;
      }
      setLoading(true);
      try {
        await startSimulation(ccpId, 'fixed', { temperature: Number(simFixedTemp) });
        await fetchStatus();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      if (!simBaseTemp || isNaN(Number(simBaseTemp)) || !simAmplitude || isNaN(Number(simAmplitude)) || !simPeriod || isNaN(Number(simPeriod))) {
        setError('请输入有效的正弦波参数');
        return;
      }
      setLoading(true);
      try {
        await startSimulation(ccpId, 'sine', {
          baseTemp: Number(simBaseTemp),
          amplitude: Number(simAmplitude),
          periodSeconds: Number(simPeriod),
        });
        await fetchStatus();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStopSimulation = async () => {
    setError('');
    try {
      await stopSimulation(ccpId);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  const isBusy = replay?.status === 'playing' || replay?.status === 'paused' || simulation?.status === 'running';

  return (
    <div className="sim-panel">
      <div className="sim-panel-header">
        <h3 className="sim-panel-title">模拟 / 回放</h3>
        {isBusy && <span className="sim-active-badge">活跃</span>}
      </div>

      <div className="sim-tabs">
        <button className={`sim-tab ${tab === 'replay' ? 'active' : ''}`} onClick={() => setTab('replay')}>场景回放</button>
        <button className={`sim-tab ${tab === 'record' ? 'active' : ''}`} onClick={() => setTab('record')}>录制场景</button>
        <button className={`sim-tab ${tab === 'simulate' ? 'active' : ''}`} onClick={() => setTab('simulate')}>手动模拟</button>
      </div>

      {error && <div className="sim-error">{error}</div>}

      {tab === 'record' && (
        <div className="sim-section">
          {recording ? (
            <div className="sim-recording-active">
              <div className="sim-recording-indicator">
                <span className="sim-rec-dot" />
                录制中...
              </div>
              <div className="sim-recording-info">
                <span>场景名: {recording.name}</span>
                <span>已采集: {recording.readingCount} 条</span>
              </div>
              <button className="sim-btn sim-btn-danger" onClick={handleStopRecording} disabled={loading}>
                停止录制
              </button>
            </div>
          ) : (
            <div className="sim-form">
              <div className="sim-form-row">
                <label className="sim-form-label">场景名称</label>
                <input
                  className="sim-form-input"
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                  placeholder="可选，留空自动生成"
                  disabled={isBusy}
                />
              </div>
              <button className="sim-btn sim-btn-primary" onClick={handleStartRecording} disabled={loading || isBusy}>
                {loading ? '...' : '开始录制'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'replay' && (
        <div className="sim-section">
          {replay && (replay.status === 'playing' || replay.status === 'paused') ? (
            <div className="sim-replay-active">
              <div className="sim-replay-info">
                <span className="sim-replay-scene">{replay.sceneName}</span>
                <span className={`sim-replay-status ${replay.status}`}>
                  {replay.status === 'playing' ? '播放中' : '已暂停'}
                </span>
              </div>
              <div className="sim-progress-bar">
                <div className="sim-progress-fill" style={{ width: `${replay.progress}%` }} />
              </div>
              <div className="sim-progress-text">
                {replay.currentIndex} / {replay.totalReadings} ({replay.progress}%)
              </div>
              <div className="sim-speed-control">
                <span className="sim-speed-label">倍速:</span>
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`sim-speed-btn ${replaySpeed === opt.value ? 'active' : ''}`}
                    onClick={() => handleSpeedChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="sim-replay-controls">
                {replay.status === 'playing' ? (
                  <button className="sim-btn sim-btn-secondary" onClick={handlePauseReplay}>暂停</button>
                ) : (
                  <button className="sim-btn sim-btn-primary" onClick={handleResumeReplay}>继续</button>
                )}
                <button className="sim-btn sim-btn-danger" onClick={handleStopReplay}>停止</button>
              </div>
            </div>
          ) : (
            <div className="sim-form">
              <div className="sim-form-row">
                <label className="sim-form-label">选择场景</label>
                <select
                  className="sim-form-select"
                  value={selectedSceneId}
                  onChange={(e) => setSelectedSceneId(e.target.value)}
                >
                  <option value="">-- 选择场景 --</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.readingCount}条, {formatDuration(s.durationMs)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sim-form-row">
                <label className="sim-form-label">回放速度</label>
                <div className="sim-speed-control">
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`sim-speed-btn ${replaySpeed === opt.value ? 'active' : ''}`}
                      onClick={() => setReplaySpeedState(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="sim-btn sim-btn-primary" onClick={handleStartReplay} disabled={loading || !selectedSceneId || isBusy}>
                {loading ? '...' : '开始回放'}
              </button>

              {scenes.length > 0 && (
                <div className="sim-scenes-list">
                  <h4 className="sim-scenes-title">已保存场景</h4>
                  {scenes.map((s) => (
                    <div key={s.id} className="sim-scene-item">
                      <div className="sim-scene-info">
                        <span className="sim-scene-name">{s.name}</span>
                        <span className="sim-scene-meta">
                          {s.sourceCcpName} · {s.readingCount}条 · {formatDuration(s.durationMs)}
                        </span>
                      </div>
                      <button className="sim-btn-icon delete" onClick={() => handleDeleteScene(s.id)} title="删除">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'simulate' && (
        <div className="sim-section">
          {simulation?.status === 'running' ? (
            <div className="sim-sim-active">
              <div className="sim-sim-info">
                <span className="sim-sim-mode">
                  {simulation.mode === 'fixed' ? '固定温度模式' : '正弦波模式'}
                </span>
                <span className="sim-sim-status running">运行中</span>
              </div>
              {simulation.mode === 'fixed' && (
                <div className="sim-sim-detail">温度: {simulation.config.temperature}°C</div>
              )}
              {simulation.mode === 'sine' && (
                <div className="sim-sim-detail">
                  基准: {simulation.config.baseTemp}°C · 振幅: {simulation.config.amplitude}°C · 周期: {simulation.config.periodSeconds}s
                </div>
              )}
              <button className="sim-btn sim-btn-danger" onClick={handleStopSimulation}>停止模拟</button>
            </div>
          ) : (
            <div className="sim-form">
              <div className="sim-form-row">
                <label className="sim-form-label">模拟模式</label>
                <select
                  className="sim-form-select"
                  value={simMode}
                  onChange={(e) => setSimMode(e.target.value)}
                  disabled={isBusy}
                >
                  <option value="fixed">固定温度</option>
                  <option value="sine">正弦波</option>
                </select>
              </div>

              {simMode === 'fixed' && (
                <div className="sim-form-row">
                  <label className="sim-form-label">温度 (°C)</label>
                  <input
                    className="sim-form-input sim-form-input-sm"
                    type="number"
                    step="0.1"
                    value={simFixedTemp}
                    onChange={(e) => setSimFixedTemp(e.target.value)}
                    placeholder="例: 4.5"
                    disabled={isBusy}
                  />
                  <span className="sim-form-hint">持续按此温度自动上报</span>
                </div>
              )}

              {simMode === 'sine' && (
                <>
                  <div className="sim-form-row">
                    <label className="sim-form-label">基准温度 (°C)</label>
                    <input
                      className="sim-form-input sim-form-input-sm"
                      type="number"
                      step="0.1"
                      value={simBaseTemp}
                      onChange={(e) => setSimBaseTemp(e.target.value)}
                      placeholder="例: 4.0"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="sim-form-row">
                    <label className="sim-form-label">振幅 (°C)</label>
                    <input
                      className="sim-form-input sim-form-input-sm"
                      type="number"
                      step="0.1"
                      value={simAmplitude}
                      onChange={(e) => setSimAmplitude(e.target.value)}
                      placeholder="例: 2.0"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="sim-form-row">
                    <label className="sim-form-label">周期 (秒)</label>
                    <input
                      className="sim-form-input sim-form-input-sm"
                      type="number"
                      step="1"
                      value={simPeriod}
                      onChange={(e) => setSimPeriod(e.target.value)}
                      placeholder="例: 60"
                      disabled={isBusy}
                    />
                    <span className="sim-form-hint">T = baseTemp + amplitude × sin(2π × t / 周期)</span>
                  </div>
                </>
              )}

              <button className="sim-btn sim-btn-primary" onClick={handleStartSimulation} disabled={loading || isBusy}>
                {loading ? '...' : '开始模拟'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
