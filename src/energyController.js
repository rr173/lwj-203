const store = require('./store');
const { broadcast } = require('./websocket');

function broadcastEnergyAnomaly(anomaly) {
  broadcast({
    type: 'energy_anomaly',
    id: `ena_${anomaly.id}_${Date.now()}`,
    data: anomaly,
  });
}

function broadcastLinkedWarning(warning) {
  broadcast({
    type: 'energy_linked_warning',
    id: `elw_${Date.now()}`,
    data: warning,
  });
}

function calculateTotalEnergyKwh(ccpId, startTime, endTime) {
  const powerReadings = store.getPowerReadings(ccpId, startTime, endTime);
  if (powerReadings.length < 2) return 0;

  let totalEnergyKwh = 0;
  for (let i = 1; i < powerReadings.length; i++) {
    const prev = powerReadings[i - 1];
    const curr = powerReadings[i];
    const dtHours = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / (1000 * 60 * 60);
    const avgPowerKw = (prev.powerKw + curr.powerKw) / 2;
    totalEnergyKwh += avgPowerKw * dtHours;
  }
  return totalEnergyKwh;
}

function calculateLineTotalEnergy(productionLine, startTime, endTime) {
  const ccps = store.getCCPsByProductionLine(productionLine);
  let total = 0;
  for (const ccp of ccps) {
    total += calculateTotalEnergyKwh(ccp.id, startTime, endTime);
  }
  return total;
}

function calculateUnitEnergyConsumption(ccpId, startTime, endTime) {
  const powerReadings = store.getPowerReadings(ccpId, startTime, endTime);
  const tempReadings = store.getReadings(ccpId, startTime, endTime);

  if (powerReadings.length < 2 || tempReadings.length < 2) {
    return null;
  }

  const totalEnergyKwh = calculateTotalEnergyKwh(ccpId, startTime, endTime);

  const ccp = store.getCCP(ccpId);
  if (!ccp) return null;

  const targetTemp = (ccp.complianceMin + ccp.complianceMax) / 2;
  let tempDeviationSum = 0;
  for (const r of tempReadings) {
    tempDeviationSum += Math.abs(r.temperature - targetTemp);
  }
  const avgTempDeviation = tempDeviationSum / tempReadings.length;

  const durationHours = (endTime - startTime) / (1000 * 60 * 60);
  if (durationHours <= 0 || avgTempDeviation <= 0) {
    return null;
  }

  const unitEnergy = totalEnergyKwh / (avgTempDeviation * durationHours);
  return {
    ccpId,
    totalEnergyKwh: parseFloat(totalEnergyKwh.toFixed(4)),
    avgTempDeviation: parseFloat(avgTempDeviation.toFixed(4)),
    durationHours: parseFloat(durationHours.toFixed(4)),
    unitEnergyKwhPerDegHour: parseFloat(unitEnergy.toFixed(4)),
    sampleCount: powerReadings.length
  };
}

function calculateBaseline(ccpId) {
  const config = store.getEnergyConfig();
  const now = Date.now();
  const windowMs = config.baselineWindowHours * 60 * 60 * 1000;
  const configStartTime = now - windowMs;

  const allPowerReadings = store.getPowerReadings(ccpId);
  if (allPowerReadings.length < 10) {
    return null;
  }

  const actualStartTime = Math.max(
    configStartTime,
    new Date(allPowerReadings[0].timestamp).getTime()
  );

  const segmentMs = 30 * 60 * 1000;
  const samples = [];

  for (let t = actualStartTime; t + segmentMs <= now; t += segmentMs) {
    const result = calculateUnitEnergyConsumption(ccpId, t, t + segmentMs);
    if (result && result.unitEnergyKwhPerDegHour > 0) {
      samples.push(result.unitEnergyKwhPerDegHour);
    }
  }

  if (samples.length < 3) {
    const overall = calculateUnitEnergyConsumption(ccpId, actualStartTime, now);
    if (overall && overall.unitEnergyKwhPerDegHour > 0) {
      const baseline = {
        mean: overall.unitEnergyKwhPerDegHour,
        std: overall.unitEnergyKwhPerDegHour * 0.1,
        min: overall.unitEnergyKwhPerDegHour * 0.8,
        max: overall.unitEnergyKwhPerDegHour * 1.2,
        sampleCount: 1
      };
      store.setEnergyBaseline(ccpId, baseline);
      return baseline;
    }
    return null;
  }

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / samples.length;
  const std = Math.sqrt(variance);

  const baseline = {
    mean: parseFloat(mean.toFixed(4)),
    std: parseFloat(std.toFixed(4)),
    min: parseFloat(Math.min(...samples).toFixed(4)),
    max: parseFloat(Math.max(...samples).toFixed(4)),
    sampleCount: samples.length,
    samples: samples.map(s => parseFloat(s.toFixed(4)))
  };

  store.setEnergyBaseline(ccpId, baseline);
  return baseline;
}

function checkEnergyAnomaly(ccpId) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) return null;

  const config = store.getEnergyConfig();
  const baseline = store.getEnergyBaseline(ccpId) || calculateBaseline(ccpId);
  if (!baseline) return null;

  const now = Date.now();
  const last30Min = now - 30 * 60 * 1000;
  const current = calculateUnitEnergyConsumption(ccpId, last30Min, now);
  if (!current) return null;

  const deviationRatio = Math.abs(current.unitEnergyKwhPerDegHour - baseline.mean) / baseline.mean;

  if (deviationRatio > config.anomalyThreshold) {
    const existing = store.getOpenEnergyAnomalyForCCP(ccpId);
    if (existing) return existing;

    const anomaly = store.addEnergyAnomalyEvent({
      ccpId,
      ccpName: ccp.name,
      productionLine: ccp.productionLine,
      currentUnitEnergy: current.unitEnergyKwhPerDegHour,
      baselineMean: baseline.mean,
      baselineStd: baseline.std,
      deviationRatio: parseFloat(deviationRatio.toFixed(4)),
      threshold: config.anomalyThreshold,
      anomalyType: current.unitEnergyKwhPerDegHour > baseline.mean ? 'high_consumption' : 'low_consumption',
      description: `${ccp.name} 单位能耗偏离基线 ${(deviationRatio * 100).toFixed(1)}%，阈值 ${(config.anomalyThreshold * 100).toFixed(0)}%`
    });

    triggerLinkedWarnings(anomaly);
    broadcastEnergyAnomaly(anomaly);
    return anomaly;
  }

  return null;
}

function triggerLinkedWarnings(anomaly) {
  const linkedLines = store.getLinkedLines(anomaly.productionLine);
  for (const linkedLine of linkedLines) {
    const lineCCPs = store.getCCPsByProductionLine(linkedLine);
    for (const ccp of lineCCPs) {
      const warning = {
        sourceAnomalyId: anomaly.id,
        sourceCCPId: anomaly.ccpId,
        sourceProductionLine: anomaly.productionLine,
        linkedCCPId: ccp.id,
        linkedCCPName: ccp.name,
        linkedProductionLine: linkedLine,
        warningType: 'shared_cold_source_linked',
        message: `共用冷源联动预警：${anomaly.productionLine} 的 ${anomaly.ccpName} 出现能效异常，${linkedLine} 的 ${ccp.name} 请注意检查`
      };
      store.addLinkedWarningToAnomaly(anomaly.id, warning);
      broadcastLinkedWarning(warning);
    }
  }
}

function submitPowerReadings(req, res) {
  const readings = req.body;

  if (!Array.isArray(readings)) {
    return res.status(400).json({ error: '请求体必须是数组' });
  }

  if (readings.length > 200) {
    return res.status(400).json({ error: '单次最多上报200条功率读数' });
  }

  const results = [];
  const errors = [];

  const groupedByCCP = new Map();
  for (const reading of readings) {
    if (!reading.ccpId) {
      errors.push({ error: 'ccpId不能为空', reading });
      continue;
    }
    if (typeof reading.powerKw !== 'number' || reading.powerKw < 0) {
      errors.push({ ccpId: reading.ccpId, error: 'powerKw必须是非负数字', reading });
      continue;
    }
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
      errors.push({ ccpId, error: 'CCP已停用' });
      continue;
    }

    const sorted = [...ccpReadings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const reading of sorted) {
      const saved = store.addPowerReading(ccpId, {
        timestamp: reading.timestamp || new Date().toISOString(),
        powerKw: parseFloat(reading.powerKw.toFixed(4)),
        equipmentType: reading.equipmentType || 'unknown'
      });
      results.push({
        ccpId,
        readingId: saved.id,
        timestamp: saved.timestamp,
        powerKw: saved.powerKw
      });
    }

    checkEnergyAnomaly(ccpId);
  }

  res.json({
    success: results.length,
    failed: errors.length,
    results,
    errors
  });
}

function getPowerReadings(req, res) {
  const { ccpId } = req.params;
  const { startTime, endTime, page = 1, pageSize = 100 } = req.query;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const startMs = startTime ? new Date(startTime).getTime() : null;
  const endMs = endTime ? new Date(endTime).getTime() : null;

  let readings = store.getPowerReadings(ccpId, startMs, endMs);
  readings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = readings.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginated = readings.slice(startIndex, startIndex + size);

  res.json({
    data: paginated,
    pagination: { page: pageNum, pageSize: size, total, totalPages }
  });
}

function getCCPEnergyDetail(req, res) {
  const { ccpId } = req.params;
  const { startTime, endTime } = req.query;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const now = Date.now();
  const defaultEnd = endTime ? new Date(endTime).getTime() : now;
  const defaultStart = startTime ? new Date(startTime).getTime() : now - 2 * 60 * 60 * 1000;

  const tempReadings = store.getReadings(ccpId, defaultStart, defaultEnd);
  const powerReadings = store.getPowerReadings(ccpId, defaultStart, defaultEnd);
  const baseline = store.getEnergyBaseline(ccpId);
  const currentStats = calculateUnitEnergyConsumption(ccpId, defaultStart, defaultEnd);
  const anomalies = store.getEnergyAnomaliesByCCP(ccpId);

  const timeSeries = [];
  const tempMap = new Map();
  for (const r of tempReadings) {
    tempMap.set(new Date(r.timestamp).getTime(), r.temperature);
  }
  for (const p of powerReadings) {
    const ts = new Date(p.timestamp).getTime();
    let nearestTemp = null;
    let minDiff = Infinity;
    for (const [tTime, temp] of tempMap) {
      const diff = Math.abs(tTime - ts);
      if (diff < minDiff) {
        minDiff = diff;
        nearestTemp = temp;
      }
    }
    timeSeries.push({
      timestamp: p.timestamp,
      powerKw: p.powerKw,
      temperature: nearestTemp
    });
  }
  timeSeries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    ccpId,
    ccpName: ccp.name,
    productionLine: ccp.productionLine,
    baseline,
    currentStats,
    anomalies,
    timeSeries
  });
}

function getEnergyRanking(req, res) {
  const { startTime, endTime } = req.query;
  const now = Date.now();
  const defaultEnd = endTime ? new Date(endTime).getTime() : now;
  const defaultStart = startTime ? new Date(startTime).getTime() : now - 24 * 60 * 60 * 1000;

  const lines = store.getAllProductionLines();
  const lineStats = [];

  for (const line of lines) {
    const ccps = store.getCCPsByProductionLine(line);
    let totalEnergy = 0;
    const ccpDetails = [];

    for (const ccp of ccps) {
      const stats = calculateUnitEnergyConsumption(ccp.id, defaultStart, defaultEnd);
      if (stats) {
        totalEnergy += stats.totalEnergyKwh;
        ccpDetails.push({
          ccpId: ccp.id,
          ccpName: ccp.name,
          ...stats
        });
      }
    }

    const activeAnomalies = store.getOpenEnergyAnomalies().filter(a => a.productionLine === line);

    lineStats.push({
      productionLine: line,
      totalEnergyKwh: parseFloat(totalEnergy.toFixed(4)),
      ccpCount: ccps.length,
      activeAnomalyCount: activeAnomalies.length,
      ccpDetails: ccpDetails.sort((a, b) => b.unitEnergyKwhPerDegHour - a.unitEnergyKwhPerDegHour)
    });
  }

  lineStats.sort((a, b) => b.totalEnergyKwh - a.totalEnergyKwh);
  lineStats.forEach((line, idx) => { line.rank = idx + 1; });

  res.json({
    startTime: new Date(defaultStart).toISOString(),
    endTime: new Date(defaultEnd).toISOString(),
    ranking: lineStats
  });
}

function getEnergyTrendComparison(req, res) {
  const { productionLines, startTime, endTime, interval = '1h' } = req.query;

  if (!productionLines) {
    return res.status(400).json({ error: '请指定productionLines参数(逗号分隔)' });
  }

  const lines = productionLines.split(',');
  const now = Date.now();
  const defaultEnd = endTime ? new Date(endTime).getTime() : now;
  const defaultStart = startTime ? new Date(startTime).getTime() : now - 24 * 60 * 60 * 1000;

  let intervalMs;
  switch (interval) {
    case '15m': intervalMs = 15 * 60 * 1000; break;
    case '30m': intervalMs = 30 * 60 * 1000; break;
    case '1h': intervalMs = 60 * 60 * 1000; break;
    case '4h': intervalMs = 4 * 60 * 60 * 1000; break;
    default: intervalMs = 60 * 60 * 1000;
  }

  const result = {
    startTime: new Date(defaultStart).toISOString(),
    endTime: new Date(defaultEnd).toISOString(),
    interval,
    lines: []
  };

  for (const line of lines) {
    const ccps = store.getCCPsByProductionLine(line.trim());
    const points = [];

    for (let t = defaultStart; t + intervalMs <= defaultEnd; t += intervalMs) {
      let lineTotalEnergy = 0;
      for (const ccp of ccps) {
        const stats = calculateUnitEnergyConsumption(ccp.id, t, t + intervalMs);
        if (stats) {
          lineTotalEnergy += stats.totalEnergyKwh;
        }
      }
      points.push({
        timestamp: new Date(t).toISOString(),
        energyKwh: parseFloat(lineTotalEnergy.toFixed(4))
      });
    }

    result.lines.push({
      productionLine: line.trim(),
      dataPoints: points
    });
  }

  res.json(result);
}

function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return null;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = x.reduce((acc, _, i) => acc + y[i] * y[i], 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

function calculateLineCorrelation(req, res) {
  const { lineA, lineB, startTime, endTime } = req.query;

  if (!lineA || !lineB) {
    return res.status(400).json({ error: '请指定lineA和lineB参数' });
  }

  const now = Date.now();
  const defaultEnd = endTime ? new Date(endTime).getTime() : now;
  const defaultStart = startTime ? new Date(startTime).getTime() : now - 24 * 60 * 60 * 1000;

  const intervalMs = 5 * 60 * 1000;
  const lineATotal = [];
  const lineBTotal = [];
  const timestamps = [];

  for (let t = defaultStart; t + intervalMs <= defaultEnd; t += intervalMs) {
    const energyA = calculateLineTotalEnergy(lineA, t, t + intervalMs);
    const energyB = calculateLineTotalEnergy(lineB, t, t + intervalMs);

    lineATotal.push(energyA);
    lineBTotal.push(energyB);
    timestamps.push(new Date(t).toISOString());
  }

  const correlation = pearsonCorrelation(lineATotal, lineBTotal);
  const config = store.getEnergyConfig();
  const isSharedColdSource = correlation !== null && correlation >= config.correlationThreshold;

  if (correlation !== null) {
    store.setLineCorrelation(lineA, lineB, parseFloat(correlation.toFixed(4)));
  }

  res.json({
    lineA,
    lineB,
    startTime: new Date(defaultStart).toISOString(),
    endTime: new Date(defaultEnd).toISOString(),
    sampleCount: lineATotal.length,
    correlation: correlation !== null ? parseFloat(correlation.toFixed(4)) : null,
    correlationThreshold: config.correlationThreshold,
    isSharedColdSource,
    label: isSharedColdSource ? '疑似共用冷源' : '能耗相关性正常',
    lineAEnergySeries: lineATotal.map(v => parseFloat(v.toFixed(4))),
    lineBEnergySeries: lineBTotal.map(v => parseFloat(v.toFixed(4))),
    timestamps
  });
}

function getAllCorrelations(req, res) {
  const correlations = store.getAllLineCorrelations();
  const sharedPairs = store.getSharedColdSourcePairs();
  res.json({
    allCorrelations: correlations,
    sharedColdSourcePairs: sharedPairs
  });
}

function getAllEnergyAnomalies(req, res) {
  const { status, ccpId, productionLine, page = 1, pageSize = 20 } = req.query;
  let events = store.getAllEnergyAnomalyEvents();

  if (status) events = events.filter(e => e.status === status);
  if (ccpId) events = events.filter(e => e.ccpId === ccpId);
  if (productionLine) events = events.filter(e => e.productionLine === productionLine);

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = events.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginated = events.slice(startIndex, startIndex + size);

  res.json({
    data: paginated,
    pagination: { page: pageNum, pageSize: size, total, totalPages }
  });
}

function getEnergyAnomaly(req, res) {
  const event = store.getEnergyAnomalyEvent(req.params.id);
  if (!event) {
    return res.status(404).json({ error: '能效异常事件不存在' });
  }
  res.json(event);
}

function acknowledgeEnergyAnomaly(req, res) {
  const event = store.acknowledgeEnergyAnomaly(req.params.id);
  if (!event) {
    return res.status(404).json({ error: '能效异常事件不存在' });
  }
  res.json(event);
}

function getEnergyConfig(req, res) {
  res.json(store.getEnergyConfig());
}

function updateEnergyConfig(req, res) {
  const updated = store.updateEnergyConfig(req.body);
  res.json(updated);
}

function getEnergyOverview(req, res) {
  const lines = store.getAllProductionLines();
  const ccps = store.getAllCCPs();
  const openAnomalies = store.getOpenEnergyAnomalies();
  const sharedPairs = store.getSharedColdSourcePairs();

  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  let totalEnergy24h = 0;
  for (const ccp of ccps) {
    const stats = calculateUnitEnergyConsumption(ccp.id, last24h, now);
    if (stats) totalEnergy24h += stats.totalEnergyKwh;
  }

  const lineSummary = lines.map(line => {
    const lineCCPs = store.getCCPsByProductionLine(line);
    let lineEnergy = 0;
    for (const ccp of lineCCPs) {
      const stats = calculateUnitEnergyConsumption(ccp.id, last24h, now);
      if (stats) lineEnergy += stats.totalEnergyKwh;
    }
    const lineAnomalies = openAnomalies.filter(a => a.productionLine === line);
    return {
      productionLine: line,
      energy24hKwh: parseFloat(lineEnergy.toFixed(4)),
      activeAnomalies: lineAnomalies.length,
      ccpCount: lineCCPs.length
    };
  });

  res.json({
    totalCCPs: ccps.length,
    totalProductionLines: lines.length,
    totalEnergy24hKwh: parseFloat(totalEnergy24h.toFixed(4)),
    activeAnomalyCount: openAnomalies.length,
    sharedColdSourcePairCount: sharedPairs.length,
    lineSummary,
    openAnomalies
  });
}

function runEnergyAnomalyDetectionForAll() {
  const ccps = store.getAllCCPs().filter(c => c.isActive);
  const detected = [];
  for (const ccp of ccps) {
    try {
      const anomaly = checkEnergyAnomaly(ccp.id);
      if (anomaly) detected.push(anomaly);
    } catch (err) {
      console.error(`[Energy] 检测CCP ${ccp.id}异常时出错:`, err.message);
    }
  }
  return detected;
}

function recalculateAllBaselines() {
  const ccps = store.getAllCCPs().filter(c => c.isActive);
  const results = [];
  for (const ccp of ccps) {
    try {
      const baseline = calculateBaseline(ccp.id);
      if (baseline) results.push({ ccpId: ccp.id, baseline });
    } catch (err) {
      console.error(`[Energy] 计算CCP ${ccp.id}基线时出错:`, err.message);
    }
  }
  return results;
}

function recalculateAllCorrelations() {
  const lines = store.getAllProductionLines();
  const results = [];

  let earliestTime = Date.now();
  for (const ccp of store.getAllCCPs()) {
    const readings = store.getPowerReadings(ccp.id);
    if (readings.length > 0) {
      const t = new Date(readings[0].timestamp).getTime();
      if (t < earliestTime) earliestTime = t;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      try {
        const lineA = lines[i];
        const lineB = lines[j];
        const now = Date.now();
        const startTime = earliestTime;
        const intervalMs = 5 * 60 * 1000;
        const lineATotal = [];
        const lineBTotal = [];

        for (let t = startTime; t + intervalMs <= now; t += intervalMs) {
          const energyA = calculateLineTotalEnergy(lineA, t, t + intervalMs);
          const energyB = calculateLineTotalEnergy(lineB, t, t + intervalMs);
          lineATotal.push(energyA);
          lineBTotal.push(energyB);
        }

        const correlation = pearsonCorrelation(lineATotal, lineBTotal);
        if (correlation !== null) {
          store.setLineCorrelation(lineA, lineB, parseFloat(correlation.toFixed(4)));
          results.push({ lineA, lineB, correlation: parseFloat(correlation.toFixed(4)) });
        }
      } catch (err) {
        console.error(`[Energy] 计算产线相关性时出错:`, err.message);
      }
    }
  }
  return results;
}

module.exports = {
  submitPowerReadings,
  getPowerReadings,
  getCCPEnergyDetail,
  getEnergyRanking,
  getEnergyTrendComparison,
  calculateLineCorrelation,
  getAllCorrelations,
  getAllEnergyAnomalies,
  getEnergyAnomaly,
  acknowledgeEnergyAnomaly,
  getEnergyConfig,
  updateEnergyConfig,
  getEnergyOverview,
  calculateUnitEnergyConsumption,
  calculateTotalEnergyKwh,
  calculateLineTotalEnergy,
  calculateBaseline,
  checkEnergyAnomaly,
  pearsonCorrelation,
  runEnergyAnomalyDetectionForAll,
  recalculateAllBaselines,
  recalculateAllCorrelations,
  broadcastEnergyAnomaly,
  broadcastLinkedWarning
};
