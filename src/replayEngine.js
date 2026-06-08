const store = require('./store');
const { handleCCPRecovered } = require('./heartbeatController');
const { evaluateRulesForCCP } = require('./ruleEngine');
const { broadcastReplayStatus, broadcastSimulationStatus } = require('./websocket');

const activeRecordings = new Map();
const activeReplays = new Map();
const activeSimulations = new Map();

function injectReading(ccpId, temperature) {
  const { determineReadingLevel, handleStatusTransition } = require('./readingController');
  const ccp = store.getCCP(ccpId);
  if (!ccp || !ccp.isActive) return null;

  const now = new Date();
  const timestamp = now.toISOString();

  const level = determineReadingLevel(temperature, ccp);
  const savedReading = store.addReading(ccpId, { timestamp, temperature, level });
  handleStatusTransition(ccp, level, savedReading);

  try {
    evaluateRulesForCCP(ccpId, savedReading);
  } catch (err) {
    console.error(`[ReplayEngine] Rule eval error for ${ccpId}:`, err.message);
  }

  store.updateCCP(ccpId, { lastReadingTime: timestamp });
  handleCCPRecovered(ccpId, timestamp);

  return savedReading;
}

function startRecording(ccpId, name) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) throw new Error('CCP不存在');

  if (activeRecordings.has(ccpId)) {
    throw new Error('该CCP已在录制中');
  }

  const recording = {
    name: name || `${ccp.name} ${new Date().toLocaleString()}`,
    sourceCcpId: ccpId,
    sourceCcpName: ccp.name,
    startedAt: new Date().toISOString(),
    readingIds: [],
    readings: []
  };

  const onReading = (savedReading) => {
    if (activeRecordings.has(ccpId)) {
      const rec = activeRecordings.get(ccpId);
      rec.readingIds.push(savedReading.id);
      rec.readings.push({
        temperature: savedReading.temperature,
        timestamp: savedReading.timestamp,
        relativeOffsetMs: new Date(savedReading.timestamp).getTime() - new Date(rec.startedAt).getTime()
      });
    }
  };

  recording._onReading = onReading;
  activeRecordings.set(ccpId, recording);

  return {
    ccpId,
    name: recording.name,
    startedAt: recording.startedAt
  };
}

function stopRecording(ccpId) {
  const recording = activeRecordings.get(ccpId);
  if (!recording) throw new Error('该CCP未在录制中');

  activeRecordings.delete(ccpId);

  const scene = store.addScene({
    name: recording.name,
    sourceCcpId: recording.sourceCcpId,
    sourceCcpName: recording.sourceCcpName,
    startRecordedAt: recording.startedAt,
    endRecordedAt: new Date().toISOString(),
    readings: recording.readings,
    readingCount: recording.readings.length,
    durationMs: recording.readings.length > 0
      ? recording.readings[recording.readings.length - 1].relativeOffsetMs
      : 0
  });

  return scene;
}

function getRecordingStatus(ccpId) {
  const recording = activeRecordings.get(ccpId);
  if (!recording) return null;
  return {
    ccpId,
    name: recording.name,
    startedAt: recording.startedAt,
    readingCount: recording.readings.length
  };
}

function startReplay(sceneId, targetCcpId, speed = 1) {
  const validSpeeds = [0.5, 1, 2, 5];
  if (!validSpeeds.includes(speed)) {
    throw new Error('不支持的速度，可选: 0.5, 1, 2, 5');
  }

  const scene = store.getScene(sceneId);
  if (!scene) throw new Error('场景不存在');
  if (!scene.readings || scene.readings.length === 0) {
    throw new Error('场景中没有读数数据');
  }

  const ccp = store.getCCP(targetCcpId);
  if (!ccp) throw new Error('目标CCP不存在');
  if (!ccp.isActive) throw new Error('目标CCP已停用');

  if (activeReplays.has(targetCcpId)) {
    throw new Error('目标CCP已有回放在进行中');
  }

  if (activeSimulations.has(targetCcpId)) {
    throw new Error('目标CCP已有模拟在进行中');
  }

  const preReplayState = {
    status: ccp.status,
    lastReadingTime: ccp.lastReadingTime
  };

  const replaySession = {
    id: store.generateId('replay'),
    sceneId,
    sceneName: scene.name,
    targetCcpId,
    speed,
    status: 'playing',
    currentIndex: 0,
    totalReadings: scene.readings.length,
    startedAt: new Date().toISOString(),
    pausedAt: null,
    preReplayState,
    timer: null
  };

  activeReplays.set(targetCcpId, replaySession);
  scheduleNextReplayReading(targetCcpId);

  broadcastReplayStatus({
    ccpId: targetCcpId,
    status: 'playing',
    sceneId,
    sceneName: scene.name,
    speed,
    progress: 0,
    currentIndex: 0,
    total: scene.readings.length
  });

  return {
    id: replaySession.id,
    sceneId,
    sceneName: scene.name,
    targetCcpId,
    speed,
    status: 'playing',
    totalReadings: scene.readings.length,
    startedAt: replaySession.startedAt
  };
}

function scheduleNextReplayReading(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session || session.status !== 'playing') return;

  const scene = store.getScene(session.sceneId);
  if (!scene || session.currentIndex >= scene.readings.length) {
    completeReplay(ccpId);
    return;
  }

  const reading = scene.readings[session.currentIndex];
  let delayMs;

  if (session.currentIndex === 0) {
    delayMs = 0;
  } else {
    const prevReading = scene.readings[session.currentIndex - 1];
    const intervalMs = reading.relativeOffsetMs - prevReading.relativeOffsetMs;
    delayMs = Math.max(10, intervalMs / session.speed);
  }

  session.timer = setTimeout(() => {
    const currentSession = activeReplays.get(ccpId);
    if (!currentSession || currentSession.status !== 'playing') return;

    injectReading(ccpId, reading.temperature);

    currentSession.currentIndex++;
    const progress = Math.round((currentSession.currentIndex / currentSession.totalReadings) * 100);

    broadcastReplayStatus({
      ccpId,
      status: 'playing',
      sceneId: currentSession.sceneId,
      sceneName: currentSession.sceneName,
      speed: currentSession.speed,
      progress,
      currentIndex: currentSession.currentIndex,
      total: currentSession.totalReadings
    });

    scheduleNextReplayReading(ccpId);
  }, delayMs);
}

function completeReplay(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session) return;

  if (session.timer) {
    clearTimeout(session.timer);
  }

  const ccp = store.getCCP(ccpId);
  if (ccp && session.preReplayState) {
    store.updateCCP(ccpId, {
      status: session.preReplayState.status
    });
  }

  session.status = 'completed';

  broadcastReplayStatus({
    ccpId,
    status: 'completed',
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    speed: session.speed,
    progress: 100,
    currentIndex: session.totalReadings,
    total: session.totalReadings
  });

  activeReplays.delete(ccpId);
}

function pauseReplay(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session) throw new Error('该CCP没有回放在进行中');
  if (session.status !== 'playing') throw new Error('回放不在播放状态');

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  session.status = 'paused';
  session.pausedAt = new Date().toISOString();

  const progress = Math.round((session.currentIndex / session.totalReadings) * 100);
  broadcastReplayStatus({
    ccpId,
    status: 'paused',
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    speed: session.speed,
    progress,
    currentIndex: session.currentIndex,
    total: session.totalReadings
  });

  return { status: 'paused', currentIndex: session.currentIndex };
}

function resumeReplay(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session) throw new Error('该CCP没有回放在进行中');
  if (session.status !== 'paused') throw new Error('回放不在暂停状态');

  session.status = 'playing';
  session.pausedAt = null;

  scheduleNextReplayReading(ccpId);

  const progress = Math.round((session.currentIndex / session.totalReadings) * 100);
  broadcastReplayStatus({
    ccpId,
    status: 'playing',
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    speed: session.speed,
    progress,
    currentIndex: session.currentIndex,
    total: session.totalReadings
  });

  return { status: 'playing', currentIndex: session.currentIndex };
}

function stopReplay(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session) throw new Error('该CCP没有回放在进行中');

  if (session.timer) {
    clearTimeout(session.timer);
  }

  const ccp = store.getCCP(ccpId);
  if (ccp && session.preReplayState) {
    store.updateCCP(ccpId, {
      status: session.preReplayState.status
    });
  }

  session.status = 'stopped';

  const progress = Math.round((session.currentIndex / session.totalReadings) * 100);
  broadcastReplayStatus({
    ccpId,
    status: 'stopped',
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    speed: session.speed,
    progress,
    currentIndex: session.currentIndex,
    total: session.totalReadings
  });

  activeReplays.delete(ccpId);

  return { status: 'stopped' };
}

function getReplayStatus(ccpId) {
  const session = activeReplays.get(ccpId);
  if (!session) return null;

  const progress = Math.round((session.currentIndex / session.totalReadings) * 100);
  return {
    id: session.id,
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    targetCcpId: session.targetCcpId,
    speed: session.speed,
    status: session.status,
    progress,
    currentIndex: session.currentIndex,
    totalReadings: session.totalReadings,
    startedAt: session.startedAt,
    pausedAt: session.pausedAt
  };
}

function setReplaySpeed(ccpId, speed) {
  const validSpeeds = [0.5, 1, 2, 5];
  if (!validSpeeds.includes(speed)) {
    throw new Error('不支持的速度，可选: 0.5, 1, 2, 5');
  }

  const session = activeReplays.get(ccpId);
  if (!session) throw new Error('该CCP没有回放在进行中');

  session.speed = speed;

  if (session.status === 'playing') {
    if (session.timer) {
      clearTimeout(session.timer);
    }
    scheduleNextReplayReading(ccpId);
  }

  const progress = Math.round((session.currentIndex / session.totalReadings) * 100);
  broadcastReplayStatus({
    ccpId,
    status: session.status,
    sceneId: session.sceneId,
    sceneName: session.sceneName,
    speed,
    progress,
    currentIndex: session.currentIndex,
    total: session.totalReadings
  });

  return { speed };
}

function startSimulation(ccpId, mode, config) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) throw new Error('CCP不存在');
  if (!ccp.isActive) throw new Error('CCP已停用');

  if (activeReplays.has(ccpId)) {
    throw new Error('该CCP已有回放在进行中');
  }
  if (activeSimulations.has(ccpId)) {
    throw new Error('该CCP已有模拟在进行中');
  }

  if (mode === 'fixed') {
    if (typeof config.temperature !== 'number') {
      throw new Error('固定温度模式需要提供 temperature 参数');
    }
  } else if (mode === 'sine') {
    if (typeof config.baseTemp !== 'number' || typeof config.amplitude !== 'number' || typeof config.periodSeconds !== 'number') {
      throw new Error('正弦波模式需要提供 baseTemp, amplitude, periodSeconds 参数');
    }
    if (config.periodSeconds <= 0) {
      throw new Error('正弦波周期必须大于0');
    }
  } else {
    throw new Error('不支持的模式，可选: fixed, sine');
  }

  const simSession = {
    id: store.generateId('simulation'),
    ccpId,
    mode,
    config,
    status: 'running',
    startedAt: new Date().toISOString(),
    timer: null,
    _startTime: Date.now()
  };

  activeSimulations.set(ccpId, simSession);
  scheduleNextSimulationReading(ccpId);

  broadcastSimulationStatus({
    ccpId,
    status: 'running',
    mode,
    config
  });

  return {
    id: simSession.id,
    ccpId,
    mode,
    config,
    status: 'running',
    startedAt: simSession.startedAt
  };
}

function scheduleNextSimulationReading(ccpId) {
  const session = activeSimulations.get(ccpId);
  if (!session || session.status !== 'running') return;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    stopSimulation(ccpId);
    return;
  }

  const intervalMs = ccp.reportingFrequency * 1000;

  session.timer = setTimeout(() => {
    const currentSession = activeSimulations.get(ccpId);
    if (!currentSession || currentSession.status !== 'running') return;

    const elapsedMs = Date.now() - currentSession._startTime;
    let temperature;

    if (currentSession.mode === 'fixed') {
      temperature = currentSession.config.temperature;
    } else if (currentSession.mode === 'sine') {
      const { baseTemp, amplitude, periodSeconds } = currentSession.config;
      const elapsedSeconds = elapsedMs / 1000;
      temperature = baseTemp + amplitude * Math.sin((2 * Math.PI * elapsedSeconds) / periodSeconds);
      temperature = parseFloat(temperature.toFixed(2));
    }

    injectReading(ccpId, temperature);

    broadcastSimulationStatus({
      ccpId,
      status: 'running',
      mode: currentSession.mode,
      config: currentSession.config,
      currentTemperature: temperature
    });

    scheduleNextSimulationReading(ccpId);
  }, intervalMs);
}

function stopSimulation(ccpId) {
  const session = activeSimulations.get(ccpId);
  if (!session) throw new Error('该CCP没有模拟在进行中');

  if (session.timer) {
    clearTimeout(session.timer);
  }

  session.status = 'stopped';

  broadcastSimulationStatus({
    ccpId,
    status: 'stopped',
    mode: session.mode,
    config: session.config
  });

  activeSimulations.delete(ccpId);

  return { status: 'stopped' };
}

function getSimulationStatus(ccpId) {
  const session = activeSimulations.get(ccpId);
  if (!session) return null;

  return {
    id: session.id,
    ccpId: session.ccpId,
    mode: session.mode,
    config: session.config,
    status: session.status,
    startedAt: session.startedAt
  };
}

function isCCPBusy(ccpId) {
  return activeReplays.has(ccpId) || activeSimulations.has(ccpId) || activeRecordings.has(ccpId);
}

function onReadingSaved(ccpId, savedReading) {
  const recording = activeRecordings.get(ccpId);
  if (recording && recording._onReading) {
    recording._onReading(savedReading);
  }
}

module.exports = {
  startRecording,
  stopRecording,
  getRecordingStatus,
  startReplay,
  pauseReplay,
  resumeReplay,
  stopReplay,
  getReplayStatus,
  setReplaySpeed,
  startSimulation,
  stopSimulation,
  getSimulationStatus,
  isCCPBusy,
  onReadingSaved
};
