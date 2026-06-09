const store = require('./store');

const SEVERITY_WEIGHT = { critical: 3, minor: 1 };

function calculateBatchRiskScore(batch) {
  const deviations = store.getDeviationsForBatch(batch);
  const batchStartMs = new Date(batch.startTime).getTime();
  const batchEndMs = batch.endTime ? new Date(batch.endTime).getTime() : Date.now();
  const batchDurationMs = Math.max(batchEndMs - batchStartMs, 1);

  let weightedCount = 0;
  let totalDeviationMs = 0;
  let maxConsecutiveMs = 0;
  let currentConsecutiveMs = 0;
  let currentConsecutiveStart = null;

  const severityDist = { critical: 0, minor: 0 };

  const sorted = [...deviations].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const dev of sorted) {
    const weight = SEVERITY_WEIGHT[dev.level] || 1;
    weightedCount += weight;
    severityDist[dev.level] = (severityDist[dev.level] || 0) + 1;

    const devRawStartMs = new Date(dev.createdAt).getTime();
    const devRawEndMs = dev.closedAt ? new Date(dev.closedAt).getTime() : batchEndMs;
    const devStartMs = Math.max(devRawStartMs, batchStartMs);
    const devEndMs = Math.min(devRawEndMs, batchEndMs);
    const devDurationMs = Math.max(devEndMs - devStartMs, 0);
    totalDeviationMs += devDurationMs;

    if (currentConsecutiveStart !== null && devStartMs <= currentConsecutiveStart + currentConsecutiveMs + 60000) {
      currentConsecutiveMs = devEndMs - currentConsecutiveStart;
    } else {
      currentConsecutiveStart = devStartMs;
      currentConsecutiveMs = devDurationMs;
    }
    maxConsecutiveMs = Math.max(maxConsecutiveMs, currentConsecutiveMs);
  }

  const durationRatio = totalDeviationMs / batchDurationMs;
  const maxWeightedCount = 30;
  const countScore = Math.min(weightedCount / maxWeightedCount, 1) * 40;
  const durationScore = Math.min(durationRatio, 1) * 40;
  const severityBonus = severityDist.critical > 0 ? Math.min(severityDist.critical * 5, 20) : 0;

  const rawScore = countScore + durationScore + severityBonus;
  const score = Math.min(Math.round(rawScore), 100);

  return {
    score,
    details: {
      deviationCount: deviations.length,
      weightedCount,
      severityDistribution: severityDist,
      totalDeviationMs,
      batchDurationMs,
      durationRatio: parseFloat(durationRatio.toFixed(4)),
      maxConsecutiveDeviationMs: maxConsecutiveMs,
      countScore: parseFloat(countScore.toFixed(2)),
      durationScore: parseFloat(durationScore.toFixed(2)),
      severityBonus: parseFloat(severityBonus.toFixed(2))
    },
    deviations: deviations.map(d => ({
      id: d.id,
      ccpId: d.ccpId,
      level: d.level,
      createdAt: d.createdAt,
      closedAt: d.closedAt,
      status: d.status,
      initialTemperature: d.initialTemperature
    }))
  };
}

function createBatch(req, res) {
  const { batchNo, productName, productionLine, startTime } = req.body;

  if (!batchNo || !productName || !productionLine) {
    return res.status(400).json({ error: '批号、产品名和产线不能为空' });
  }

  const activeBatch = store.getActiveBatchByLine(productionLine);
  if (activeBatch) {
    return res.status(400).json({ error: `产线 ${productionLine} 已有生产中批次: ${activeBatch.id}` });
  }

  const batch = store.addBatch({ batchNo, productName, productionLine, startTime });
  res.status(201).json(batch);
}

function getAllBatches(req, res) {
  const { status, productionLine, startTime, endTime, page = 1, pageSize = 20 } = req.query;
  let batches = store.getAllBatches();

  if (status) {
    batches = batches.filter(b => b.status === status);
  }
  if (productionLine) {
    batches = batches.filter(b => b.productionLine === productionLine);
  }
  if (startTime) {
    const startMs = new Date(startTime).getTime();
    batches = batches.filter(b => new Date(b.startTime).getTime() >= startMs);
  }
  if (endTime) {
    const endMs = new Date(endTime).getTime();
    batches = batches.filter(b => {
      const batchEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
      return batchEnd <= endMs;
    });
  }

  batches.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = batches.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginatedBatches = batches.slice(startIndex, startIndex + size);

  const withRisk = paginatedBatches.map(b => {
    const risk = calculateBatchRiskScore(b);
    return { ...b, riskScore: risk.score, riskLevel: risk.score >= store.getRecallThreshold() ? 'high' : risk.score >= 30 ? 'medium' : 'low' };
  });

  res.json({
    data: withRisk,
    pagination: { page: pageNum, pageSize: size, total, totalPages }
  });
}

function getBatch(req, res) {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  const risk = calculateBatchRiskScore(batch);
  const recommendation = risk.score >= store.getRecallThreshold() ? '建议召回' : '正常';

  res.json({
    ...batch,
    riskScore: risk.score,
    riskLevel: risk.score >= store.getRecallThreshold() ? 'high' : risk.score >= 30 ? 'medium' : 'low',
    recommendation,
    riskDetails: risk.details,
    linkedDeviations: risk.deviations
  });
}

function getBatchRiskScore(req, res) {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const risk = calculateBatchRiskScore(batch);
  const threshold = store.getRecallThreshold();
  const recommendation = risk.score >= threshold ? '建议召回' : '正常';

  res.json({
    batchId: batch.id,
    batchNo: batch.batchNo,
    riskScore: risk.score,
    riskLevel: risk.score >= threshold ? 'high' : risk.score >= 30 ? 'medium' : 'low',
    recommendation,
    threshold,
    riskDetails: risk.details,
    linkedDeviations: risk.deviations
  });
}

function finishBatch(req, res) {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  if (batch.status !== 'producing') {
    return res.status(400).json({ error: '只有生产中的批次可以结束' });
  }

  const endTime = req.body.endTime || new Date().toISOString();
  const updated = store.updateBatch(req.params.id, {
    status: 'pending_inspection',
    endTime
  });
  res.json(updated);
}

function releaseBatch(req, res) {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  if (batch.status !== 'pending_inspection') {
    return res.status(400).json({ error: '只有待检状态的批次可以放行' });
  }

  const updated = store.updateBatch(req.params.id, { status: 'released' });
  res.json(updated);
}

function recallBatch(req, res) {
  const batch = store.getBatch(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  if (batch.status !== 'pending_inspection' && batch.status !== 'released') {
    return res.status(400).json({ error: '只有待检或已放行的批次可以召回' });
  }

  const updated = store.updateBatch(req.params.id, { status: 'recalled' });
  res.json(updated);
}

function getBatchRiskRanking(req, res) {
  const { startTime, endTime, productionLine, limit = 20 } = req.query;
  let batches = store.getAllBatches();

  if (productionLine) {
    batches = batches.filter(b => b.productionLine === productionLine);
  }
  if (startTime) {
    const startMs = new Date(startTime).getTime();
    batches = batches.filter(b => new Date(b.startTime).getTime() >= startMs);
  }
  if (endTime) {
    const endMs = new Date(endTime).getTime();
    batches = batches.filter(b => {
      const batchEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
      return batchEnd <= endMs;
    });
  }

  const threshold = store.getRecallThreshold();
  const ranked = batches.map(b => {
    const risk = calculateBatchRiskScore(b);
    return {
      id: b.id,
      batchNo: b.batchNo,
      productName: b.productName,
      productionLine: b.productionLine,
      status: b.status,
      startTime: b.startTime,
      endTime: b.endTime,
      riskScore: risk.score,
      riskLevel: risk.score >= threshold ? 'high' : risk.score >= 30 ? 'medium' : 'low',
      recommendation: risk.score >= threshold ? '建议召回' : '正常',
      deviationCount: risk.details.deviationCount,
      weightedCount: risk.details.weightedCount
    };
  });

  ranked.sort((a, b) => b.riskScore - a.riskScore);

  const size = parseInt(limit, 10);
  res.json(ranked.slice(0, size));
}

function getRecallThreshold(req, res) {
  res.json({ threshold: store.getRecallThreshold() });
}

function setRecallThreshold(req, res) {
  const { threshold } = req.body;
  if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
    return res.status(400).json({ error: '阈值必须为0-100之间的数字' });
  }
  store.setRecallThreshold(threshold);
  res.json({ threshold });
}

module.exports = {
  createBatch,
  getAllBatches,
  getBatch,
  getBatchRiskScore,
  finishBatch,
  releaseBatch,
  recallBatch,
  getBatchRiskRanking,
  getRecallThreshold,
  setRecallThreshold,
  calculateBatchRiskScore
};
