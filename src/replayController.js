const store = require('./store');
const replayEngine = require('./replayEngine');

function getAllScenes(req, res) {
  const scenes = store.getAllScenes();
  const scenesSummary = scenes.map(s => ({
    id: s.id,
    name: s.name,
    sourceCcpId: s.sourceCcpId,
    sourceCcpName: s.sourceCcpName,
    startRecordedAt: s.startRecordedAt,
    endRecordedAt: s.endRecordedAt,
    readingCount: s.readingCount,
    durationMs: s.durationMs,
    createdAt: s.createdAt
  }));
  res.json(scenesSummary);
}

function getScene(req, res) {
  const scene = store.getScene(req.params.id);
  if (!scene) {
    return res.status(404).json({ error: '场景不存在' });
  }
  res.json(scene);
}

function deleteScene(req, res) {
  const deleted = store.deleteScene(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: '场景不存在' });
  }
  res.json({ success: true });
}

function startRecording(req, res) {
  try {
    const { ccpId, name } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const result = replayEngine.startRecording(ccpId, name);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function stopRecording(req, res) {
  try {
    const { ccpId } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const scene = replayEngine.stopRecording(ccpId);
    res.status(201).json(scene);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function getRecordingStatus(req, res) {
  const { ccpId } = req.params;
  const status = replayEngine.getRecordingStatus(ccpId);
  res.json(status);
}

function startReplay(req, res) {
  try {
    const { sceneId, targetCcpId, speed } = req.body;
    if (!sceneId || !targetCcpId) {
      return res.status(400).json({ error: 'sceneId和targetCcpId不能为空' });
    }
    const result = replayEngine.startReplay(sceneId, targetCcpId, speed || 1);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function pauseReplay(req, res) {
  try {
    const { ccpId } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const result = replayEngine.pauseReplay(ccpId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function resumeReplay(req, res) {
  try {
    const { ccpId } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const result = replayEngine.resumeReplay(ccpId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function stopReplay(req, res) {
  try {
    const { ccpId } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const result = replayEngine.stopReplay(ccpId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function getReplayStatus(req, res) {
  const { ccpId } = req.params;
  const status = replayEngine.getReplayStatus(ccpId);
  res.json(status);
}

function setReplaySpeed(req, res) {
  try {
    const { ccpId, speed } = req.body;
    if (!ccpId || speed === undefined) {
      return res.status(400).json({ error: 'ccpId和speed不能为空' });
    }
    const result = replayEngine.setReplaySpeed(ccpId, speed);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function startSimulation(req, res) {
  try {
    const { ccpId, mode, config } = req.body;
    if (!ccpId || !mode || !config) {
      return res.status(400).json({ error: 'ccpId、mode和config不能为空' });
    }
    const result = replayEngine.startSimulation(ccpId, mode, config);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function stopSimulation(req, res) {
  try {
    const { ccpId } = req.body;
    if (!ccpId) {
      return res.status(400).json({ error: 'ccpId不能为空' });
    }
    const result = replayEngine.stopSimulation(ccpId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

function getSimulationStatus(req, res) {
  const { ccpId } = req.params;
  const status = replayEngine.getSimulationStatus(ccpId);
  res.json(status);
}

module.exports = {
  getAllScenes,
  getScene,
  deleteScene,
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
  getSimulationStatus
};
