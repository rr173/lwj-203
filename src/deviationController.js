const store = require('./store');
const { evaluateGroupForCCP } = require('./groupAlertEngine');
const { broadcastSOPExecution } = require('./websocket');

function getAllDeviations(req, res) {
  const { status, ccpId, productionLine, startTime, endTime, page = 1, pageSize = 20 } = req.query;
  let deviations = store.getAllDeviations();

  if (status) {
    deviations = deviations.filter(d => d.status === status);
  }
  if (ccpId) {
    deviations = deviations.filter(d => d.ccpId === ccpId);
  }
  if (productionLine) {
    const ccpIds = store.getCCPsByProductionLine(productionLine).map(c => c.id);
    deviations = deviations.filter(d => ccpIds.includes(d.ccpId));
  }
  if (startTime) {
    const startMs = new Date(startTime).getTime();
    deviations = deviations.filter(d => new Date(d.createdAt).getTime() >= startMs);
  }
  if (endTime) {
    const endMs = new Date(endTime).getTime();
    deviations = deviations.filter(d => new Date(d.createdAt).getTime() <= endMs);
  }

  deviations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = deviations.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginatedDeviations = deviations.slice(startIndex, startIndex + size);

  res.json({
    data: paginatedDeviations,
    pagination: {
      page: pageNum,
      pageSize: size,
      total,
      totalPages
    }
  });
}

function getDeviation(req, res) {
  const deviation = store.getDeviation(req.params.id);
  if (!deviation) {
    return res.status(404).json({ error: '偏差事件不存在' });
  }
  res.json(deviation);
}

function addCorrectiveAction(req, res) {
  const deviation = store.getDeviation(req.params.id);
  if (!deviation) {
    return res.status(404).json({ error: '偏差事件不存在' });
  }

  if (deviation.status === 'closed') {
    return res.status(400).json({ error: '已关闭的偏差不能添加纠偏动作' });
  }

  const { description, operator } = req.body;
  if (!description || !operator) {
    return res.status(400).json({ error: '描述和操作人不能为空' });
  }

  const action = store.addCorrectiveAction(req.params.id, {
    description,
    operator
  });

  res.status(201).json(action);
}

function closeDeviation(req, res) {
  const deviation = store.getDeviation(req.params.id);
  if (!deviation) {
    return res.status(404).json({ error: '偏差事件不存在' });
  }

  if (deviation.status === 'closed') {
    return res.status(400).json({ error: '偏差已关闭' });
  }

  const { closeReason, closedBy } = req.body;

  if (deviation.status === 'escalated' && !closeReason) {
    return res.status(400).json({ error: '已升级的偏差必须填写关闭原因' });
  }

  if (!closedBy) {
    return res.status(400).json({ error: '关闭人不能为空' });
  }

  const scene = store.getSceneForDeviationClose(deviation.level);
  const compliance = store.checkSOPCompliance(scene, 'deviation', deviation.id);
  if (!compliance.compliant) {
    return res.status(403).json({
      error: `操作被拒绝: ${compliance.reason}`,
      sopCompliance: compliance
    });
  }

  const updated = store.updateDeviation(req.params.id, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closeReason: closeReason || '手动关闭',
    closedBy
  });

  const ccp = store.getCCP(deviation.ccpId);
  if (ccp && ccp.status !== 'normal') {
    store.updateCCP(deviation.ccpId, { status: 'normal' });
  }

  try {
    evaluateGroupForCCP(deviation.ccpId);
  } catch (err) {
    console.error(`[GroupAlert] Error evaluating group for CCP ${deviation.ccpId}:`, err.message);
  }

  res.json(updated);
}

function escalateDeviation(deviationId) {
  const deviation = store.getDeviation(deviationId);
  if (!deviation || deviation.status !== 'open') {
    return null;
  }

  return store.updateDeviation(deviationId, {
    status: 'escalated',
    escalatedAt: new Date().toISOString()
  });
}

function checkAndEscalateDeviations() {
  const openDeviations = store.getOpenDeviations();
  const now = Date.now();
  const escalated = [];

  for (const deviation of openDeviations) {
    const ccp = store.getCCP(deviation.ccpId);
    if (!ccp) continue;

    let timeLimit = ccp.deviationCloseTimeLimit * 60 * 1000;
    if (deviation.level === 'critical') {
      timeLimit = timeLimit / 2;
    }

    const createdAt = new Date(deviation.createdAt).getTime();
    if (now - createdAt > timeLimit) {
      const result = escalateDeviation(deviation.id);
      if (result) {
        escalated.push(result);
      }
    }
  }

  return escalated;
}

module.exports = {
  getAllDeviations,
  getDeviation,
  addCorrectiveAction,
  closeDeviation,
  escalateDeviation,
  checkAndEscalateDeviations
};
