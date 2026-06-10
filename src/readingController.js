const store = require('./store');
const { handleCCPRecovered } = require('./heartbeatController');
const { broadcastDeviation, broadcastWorkOrder } = require('./websocket');
const { evaluateRulesForCCP } = require('./ruleEngine');
const { onReadingSaved } = require('./replayEngine');
const { runPrediction } = require('./predictionEngine');
const { checkEnergyAnomaly } = require('./energyController');
const { evaluateGroupForCCP } = require('./groupAlertEngine');

function determineReadingLevel(temperature, ccp) {
  const complianceRange = ccp.complianceMax - ccp.complianceMin;
  const criticalRange = ccp.criticalMax - ccp.criticalMin;
  const severeThreshold = complianceRange * 0.5;

  if (temperature < ccp.criticalMin || temperature > ccp.criticalMax) {
    return 'severe';
  }

  if (temperature < ccp.complianceMin) {
    const deviation = ccp.complianceMin - temperature;
    if (deviation >= severeThreshold) {
      return 'critical';
    }
    return 'moderate';
  }
  if (temperature > ccp.complianceMax) {
    const deviation = temperature - ccp.complianceMax;
    if (deviation >= severeThreshold) {
      return 'critical';
    }
    return 'moderate';
  }

  if (temperature < ccp.complianceMin + complianceRange * 0.1 ||
      temperature > ccp.complianceMax - complianceRange * 0.1) {
    return 'minor';
  }

  return 'normal';
}

function handleStatusTransition(ccp, newStatus, reading) {
  const oldStatus = ccp.status;
  const abnormalStatuses = ['minor', 'moderate', 'critical', 'severe'];

  if (oldStatus === 'normal' && abnormalStatuses.includes(newStatus)) {
    const readingTimeMs = new Date(reading.timestamp).getTime();
    const isMaintenance = store.isLineUnderMaintenance(ccp.productionLine, readingTimeMs);
    const deviation = store.addDeviation({
      ccpId: ccp.id,
      level: newStatus,
      initialTemperature: reading.temperature,
      initialReadingTime: reading.timestamp,
      isMaintenanceDeviation: isMaintenance,
      deviationType: isMaintenance ? 'maintenance' : 'normal'
    });
    ccp.status = newStatus;
    store.updateCCP(ccp.id, { status: newStatus });
    broadcastDeviation(deviation);

    try {
      const workOrder = store.createWorkOrderFromDeviation(deviation);
      console.log(`[WorkOrder] 偏差 ${deviation.id} 自动生成工单: ${workOrder.id}, 等级: ${deviation.level}, 指派人: ${workOrder.assignee}`);
      broadcastWorkOrder(workOrder);
    } catch (err) {
      console.error(`[WorkOrder] 为偏差 ${deviation.id} 创建工单失败:`, err.message);
    }

    try {
      evaluateGroupForCCP(ccp.id);
    } catch (err) {
      console.error(`[GroupAlert] Error evaluating group for CCP ${ccp.id}:`, err.message);
    }
    return deviation;
  }

  if (abnormalStatuses.includes(oldStatus) && newStatus === 'normal') {
    const openDeviation = store.getOpenDeviationForCCP(ccp.id);
    if (openDeviation) {
      store.updateDeviation(openDeviation.id, {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closeReason: '自动恢复',
        closedBy: 'system'
      });
    }
    ccp.status = 'normal';
    store.updateCCP(ccp.id, { status: 'normal' });
    try {
      evaluateGroupForCCP(ccp.id);
    } catch (err) {
      console.error(`[GroupAlert] Error evaluating group for CCP ${ccp.id}:`, err.message);
    }
  }

  const statusSeverity = { minor: 1, moderate: 2, critical: 3, severe: 4 };
  if (abnormalStatuses.includes(oldStatus) && abnormalStatuses.includes(newStatus)) {
    const oldSeverity = statusSeverity[oldStatus] || 0;
    const newSeverity = statusSeverity[newStatus] || 0;
    if (newSeverity > oldSeverity) {
      const openDeviation = store.getOpenDeviationForCCP(ccp.id);
      if (openDeviation) {
        store.updateDeviation(openDeviation.id, { level: newStatus });
        const workOrders = store.getWorkOrdersByDeviation(openDeviation.id);
        for (const wo of workOrders) {
          if (wo.status !== 'closed') {
            store.updateWorkOrder(wo.id, { deviationLevel: newStatus });
          }
        }
      }
      ccp.status = newStatus;
      store.updateCCP(ccp.id, { status: newStatus });
    }
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

    const lastReading = store.getLastReading(ccpId);
    let lastTime = lastReading ? new Date(lastReading.timestamp).getTime() : 0;
    let hasOutOfOrder = false;

    for (const reading of ccpReadings) {
      const readingTime = new Date(reading.timestamp).getTime();
      if (readingTime <= lastTime) {
        errors.push({ ccpId, timestamp: reading.timestamp, error: '时间戳乱序，必须递增，该CCP批次内所有读数已拒绝' });
        hasOutOfOrder = true;
        break;
      }
      lastTime = readingTime;
    }

    if (hasOutOfOrder) {
      continue;
    }

    for (const reading of ccpReadings) {
      const level = determineReadingLevel(reading.temperature, ccp);
      const savedReading = store.addReading(ccpId, {
        timestamp: reading.timestamp,
        temperature: reading.temperature,
        level
      });

      if (reading.powerKw !== undefined && reading.powerKw !== null) {
        store.addPowerReading(ccpId, {
          timestamp: reading.timestamp,
          powerKw: parseFloat(Number(reading.powerKw).toFixed(4)),
          equipmentType: reading.equipmentType || 'unknown'
        });
      }
      
      handleStatusTransition(ccp, level, savedReading);

      try {
        evaluateRulesForCCP(ccpId, savedReading);
      } catch (err) {
        console.error(`[RuleEngine] Error evaluating rules for CCP ${ccpId}:`, err.message);
      }

      try {
        onReadingSaved(ccpId, savedReading);
      } catch (err) {
        console.error(`[ReplayEngine] Recording callback error for CCP ${ccpId}:`, err.message);
      }

      try {
        runPrediction(ccpId);
      } catch (err) {
        console.error(`[PredictionEngine] Prediction error for CCP ${ccpId}:`, err.message);
      }
      
      results.push({
        ccpId,
        readingId: savedReading.id,
        timestamp: reading.timestamp,
        temperature: reading.temperature,
        level,
        powerKw: reading.powerKw !== undefined ? parseFloat(Number(reading.powerKw).toFixed(4)) : undefined
      });
    }

    if (ccpReadings.length > 0) {
      const firstValid = ccpReadings[0];
      const lastValid = ccpReadings[ccpReadings.length - 1];
      store.updateCCP(ccpId, { lastReadingTime: lastValid.timestamp });
      handleCCPRecovered(ccpId, firstValid.timestamp);

      try {
        const hasPower = ccpReadings.some(r => r.powerKw !== undefined && r.powerKw !== null);
        if (hasPower) {
          checkEnergyAnomaly(ccpId);
        }
      } catch (err) {
        console.error(`[Energy] 检查CCP ${ccpId}能效异常时出错:`, err.message);
      }
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
  const { startTime, endTime, page = 1, pageSize = 100 } = req.query;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const startMs = startTime ? new Date(startTime).getTime() : null;
  const endMs = endTime ? new Date(endTime).getTime() : null;

  let readings = store.getReadings(ccpId, startMs, endMs);
  
  readings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = readings.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginatedReadings = readings.slice(startIndex, startIndex + size);

  res.json({
    data: paginatedReadings,
    pagination: {
      page: pageNum,
      pageSize: size,
      total,
      totalPages
    }
  });
}

module.exports = {
  submitReadings,
  getReadings,
  determineReadingLevel,
  handleStatusTransition
};
