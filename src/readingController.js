const store = require('./store');

function determineReadingLevel(temperature, ccp) {
  if (temperature < ccp.criticalMin || temperature > ccp.criticalMax) {
    return 'critical';
  }
  if (temperature < ccp.complianceMin || temperature > ccp.complianceMax) {
    return 'minor';
  }
  return 'normal';
}

function handleStatusTransition(ccp, newStatus, reading) {
  const oldStatus = ccp.status;
  
  if (oldStatus === 'normal' && (newStatus === 'minor' || newStatus === 'critical')) {
    const deviation = store.addDeviation({
      ccpId: ccp.id,
      level: newStatus,
      initialTemperature: reading.temperature,
      initialReadingTime: reading.timestamp
    });
    store.updateCCP(ccp.id, { status: newStatus });
    return deviation;
  }

  if ((oldStatus === 'minor' || oldStatus === 'critical') && newStatus === 'normal') {
    const openDeviation = store.getOpenDeviationForCCP(ccp.id);
    if (openDeviation) {
      store.updateDeviation(openDeviation.id, {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closeReason: '自动恢复',
        closedBy: 'system'
      });
    }
    store.updateCCP(ccp.id, { status: 'normal' });
  }

  if (oldStatus === 'minor' && newStatus === 'critical') {
    const openDeviation = store.getOpenDeviationForCCP(ccp.id);
    if (openDeviation) {
      store.updateDeviation(openDeviation.id, { level: 'critical' });
    }
    store.updateCCP(ccp.id, { status: 'critical' });
  }

  if (oldStatus === 'critical' && newStatus === 'minor') {
    store.updateCCP(ccp.id, { status: 'minor' });
  }

  return null;
}

function submitReadings(req, res) {
  const readings = req.body;

  if (!Array.isArray(readings)) {
    return res.status(400).json({ error: '请求体必须是数组' });
  }

  if (readings.length > 200) {
    return res.status(400).json({ error: '单次最多上报200条读数' });
  }

  const results = [];
  const errors = [];

  const groupedByCCP = new Map();
  for (const reading of readings) {
    if (!groupedByCCP.has(reading.ccpId)) {
      groupedByCCP.set(reading.ccpId, []);
    }
    groupedByCCP.get(reading.ccpId).push(reading);
  }

  for (const [ccpId, ccpReadings] of groupedByCCP) {
    const ccp = store.getCCP(ccpId);
    if (!ccp) {
      errors.push({ ccpId, error: 'CCP不存在' });
      continue;
    }

    if (!ccp.isActive) {
      errors.push({ ccpId, error: 'CCP已停用，不接收数据' });
      continue;
    }

    ccpReadings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const lastReading = store.getLastReading(ccpId);
    const lastTime = lastReading ? new Date(lastReading.timestamp).getTime() : 0;

    let validReadings = [];
    for (const reading of ccpReadings) {
      const readingTime = new Date(reading.timestamp).getTime();
      if (readingTime <= lastTime) {
        errors.push({ ccpId, timestamp: reading.timestamp, error: '时间戳乱序，必须递增' });
        continue;
      }
      validReadings.push(reading);
    }

    for (const reading of validReadings) {
      const level = determineReadingLevel(reading.temperature, ccp);
      const savedReading = store.addReading(ccpId, {
        timestamp: reading.timestamp,
        temperature: reading.temperature,
        level
      });
      
      handleStatusTransition(ccp, level, savedReading);
      
      results.push({
        ccpId,
        readingId: savedReading.id,
        timestamp: reading.timestamp,
        temperature: reading.temperature,
        level
      });
    }

    if (validReadings.length > 0) {
      const lastValid = validReadings[validReadings.length - 1];
      store.updateCCP(ccpId, { lastReadingTime: lastValid.timestamp });
    }
  }

  res.json({
    success: results.length,
    failed: errors.length,
    results,
    errors
  });
}

function getReadings(req, res) {
  const { ccpId } = req.params;
  const { startTime, endTime } = req.query;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const startMs = startTime ? new Date(startTime).getTime() : null;
  const endMs = endTime ? new Date(endTime).getTime() : null;

  const readings = store.getReadings(ccpId, startMs, endMs);
  res.json(readings);
}

module.exports = {
  submitReadings,
  getReadings,
  determineReadingLevel,
  handleStatusTransition
};
