const store = require('./store');

function getProductionLineReport(req, res) {
  const { productionLine } = req.params;
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    return res.status(400).json({ error: '必须提供开始时间和结束时间' });
  }

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  const ccps = store.getCCPsByProductionLine(productionLine);
  if (ccps.length === 0) {
    return res.status(404).json({ error: '产线不存在或没有CCP' });
  }

  let totalReadings = 0;
  let normalReadings = 0;
  let minorDeviationCount = 0;
  let criticalDeviationCount = 0;
  let longestDeviation = null;
  const deviationDurations = [];

  for (const ccp of ccps) {
    const readings = store.getReadings(ccp.id, startMs, endMs);
    totalReadings += readings.length;
    normalReadings += readings.filter(r => r.level === 'normal').length;

    const deviations = store.getDeviationsByCCP(ccp.id).filter(d => {
      const dStart = new Date(d.createdAt).getTime();
      const dEnd = d.closedAt ? new Date(d.closedAt).getTime() : endMs;
      return dStart <= endMs && dEnd >= startMs;
    });

    for (const deviation of deviations) {
      if (deviation.level === 'minor') minorDeviationCount++;
      if (deviation.level === 'critical') criticalDeviationCount++;

      const devStart = Math.max(new Date(deviation.createdAt).getTime(), startMs);
      const devEnd = deviation.closedAt 
        ? Math.min(new Date(deviation.closedAt).getTime(), endMs)
        : endMs;
      const duration = devEnd - devStart;
      deviationDurations.push(duration);

      if (!longestDeviation || duration > longestDeviation.duration) {
        longestDeviation = {
          deviationId: deviation.id,
          ccpId: ccp.id,
          ccpName: ccp.name,
          level: deviation.level,
          duration,
          startTime: new Date(devStart).toISOString(),
          endTime: deviation.closedAt ? new Date(devEnd).toISOString() : null,
          status: deviation.status
        };
      }
    }
  }

  const complianceRate = totalReadings > 0 ? (normalReadings / totalReadings) * 100 : 0;
  const avgDeviationDuration = deviationDurations.length > 0
    ? deviationDurations.reduce((a, b) => a + b, 0) / deviationDurations.length
    : 0;

  res.json({
    productionLine,
    startTime,
    endTime,
    complianceRate: parseFloat(complianceRate.toFixed(2)),
    totalReadings,
    normalReadings,
    deviationCount: minorDeviationCount + criticalDeviationCount,
    minorDeviationCount,
    criticalDeviationCount,
    averageDeviationDurationMs: Math.round(avgDeviationDuration),
    averageDeviationDurationMinutes: parseFloat((avgDeviationDuration / 60000).toFixed(2)),
    longestDeviation
  });
}

function getCCPTimeline(req, res) {
  const { ccpId } = req.params;
  const { startTime, endTime } = req.query;

  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const startMs = startTime ? new Date(startTime).getTime() : null;
  const endMs = endTime ? new Date(endTime).getTime() : null;

  const readings = store.getReadings(ccpId, startMs, endMs);
  const deviations = store.getDeviationsByCCP(ccpId).filter(d => {
    if (!startMs && !endMs) return true;
    const dStart = new Date(d.createdAt).getTime();
    const dEnd = d.closedAt ? new Date(d.closedAt).getTime() : Date.now();
    if (startMs && dEnd < startMs) return false;
    if (endMs && dStart > endMs) return false;
    return true;
  });

  const timeline = [];

  for (const reading of readings) {
    timeline.push({
      type: 'reading',
      timestamp: reading.timestamp,
      temperature: reading.temperature,
      level: reading.level
    });
  }

  for (const deviation of deviations) {
    timeline.push({
      type: 'deviation_start',
      timestamp: deviation.createdAt,
      deviationId: deviation.id,
      level: deviation.level,
      initialTemperature: deviation.initialTemperature
    });

    if (deviation.escalatedAt) {
      timeline.push({
        type: 'deviation_escalated',
        timestamp: deviation.escalatedAt,
        deviationId: deviation.id
      });
    }

    if (deviation.closedAt) {
      timeline.push({
        type: 'deviation_closed',
        timestamp: deviation.closedAt,
        deviationId: deviation.id,
        closeReason: deviation.closeReason,
        closedBy: deviation.closedBy
      });
    }

    for (const action of deviation.actions) {
      timeline.push({
        type: 'corrective_action',
        timestamp: action.createdAt,
        deviationId: deviation.id,
        actionId: action.id,
        description: action.description,
        operator: action.operator
      });
    }
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    ccp,
    timeline
  });
}

function getProductionLines(req, res) {
  res.json(store.getAllProductionLines());
}

module.exports = {
  getProductionLineReport,
  getCCPTimeline,
  getProductionLines
};
