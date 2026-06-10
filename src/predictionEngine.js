const store = require('./store');
const { broadcastPredictionAlert } = require('./websocket');

const defaultConfig = {
  sampleSize: 20,
  predictMinutes: 10
};

let predictionConfig = { ...defaultConfig };

const predictionState = new Map();

function getConfig() {
  return { ...predictionConfig };
}

function updateConfig(updates) {
  if (updates.sampleSize !== undefined) {
    predictionConfig.sampleSize = Math.max(3, Math.floor(updates.sampleSize));
  }
  if (updates.predictMinutes !== undefined) {
    predictionConfig.predictMinutes = Math.max(1, Math.floor(updates.predictMinutes));
  }
  return getConfig();
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = points[i].x;
    const y = points[i].y;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  let ssTot = 0;
  let ssRes = 0;
  const meanY = sumY / n;
  for (let i = 0; i < n; i++) {
    ssTot += (points[i].y - meanY) ** 2;
    const predicted = slope * points[i].x + intercept;
    ssRes += (points[i].y - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

function predictForCCP(ccpId) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) return null;

  const readings = store.getReadings(ccpId);
  if (!readings || readings.length < 2) {
    return {
      ccpId,
      ccpName: ccp.name,
      slope: 0,
      r2: 0,
      predictedTemperature: null,
      alertTriggered: false,
      alertDirection: null,
      predictedArrivalTime: null,
      sampleCount: 0,
      insufficientData: true
    };
  }

  const { sampleSize, predictMinutes } = predictionConfig;
  const recent = readings.slice(-sampleSize);

  const baseTime = new Date(recent[0].timestamp).getTime();
  const points = recent.map(r => ({
    x: (new Date(r.timestamp).getTime() - baseTime) / 1000,
    y: r.temperature
  }));

  const regression = linearRegression(points);
  if (!regression) {
    return {
      ccpId,
      ccpName: ccp.name,
      slope: 0,
      r2: 0,
      predictedTemperature: null,
      alertTriggered: false,
      alertDirection: null,
      predictedArrivalTime: null,
      sampleCount: recent.length,
      insufficientData: true
    };
  }

  const { slope, intercept, r2 } = regression;
  const lastTimeSec = points[points.length - 1].x;
  const predictOffsetSec = predictMinutes * 60;
  const predictedTemp = slope * (lastTimeSec + predictOffsetSec) + intercept;

  let alertTriggered = false;
  let alertDirection = null;
  let predictedArrivalTime = null;

  if (slope > 0 && predictedTemp > ccp.complianceMax) {
    alertTriggered = true;
    alertDirection = 'upper';
    if (slope > 0) {
      const boundaryTemp = ccp.complianceMax;
      const currentTemp = slope * lastTimeSec + intercept;
      if (currentTemp < boundaryTemp) {
        const secondsToBreach = (boundaryTemp - currentTemp) / slope;
        const nowMs = Date.now();
        const lastReadingMs = new Date(recent[recent.length - 1].timestamp).getTime();
        predictedArrivalTime = new Date(Math.max(nowMs, lastReadingMs) + secondsToBreach * 1000).toISOString();
      } else {
        predictedArrivalTime = new Date().toISOString();
      }
    }
  } else if (slope < 0 && predictedTemp < ccp.complianceMin) {
    alertTriggered = true;
    alertDirection = 'lower';
    if (slope < 0) {
      const boundaryTemp = ccp.complianceMin;
      const currentTemp = slope * lastTimeSec + intercept;
      if (currentTemp > boundaryTemp) {
        const secondsToBreach = (boundaryTemp - currentTemp) / slope;
        const nowMs = Date.now();
        const lastReadingMs = new Date(recent[recent.length - 1].timestamp).getTime();
        predictedArrivalTime = new Date(Math.max(nowMs, lastReadingMs) + secondsToBreach * 1000).toISOString();
      } else {
        predictedArrivalTime = new Date().toISOString();
      }
    }
  }

  return {
    ccpId,
    ccpName: ccp.name,
    complianceMin: ccp.complianceMin,
    complianceMax: ccp.complianceMax,
    slope: parseFloat(slope.toFixed(6)),
    slopeUnit: '°C/s',
    r2: parseFloat(r2.toFixed(6)),
    predictedTemperature: parseFloat(predictedTemp.toFixed(2)),
    predictMinutes,
    alertTriggered,
    alertDirection,
    predictedArrivalTime,
    sampleCount: recent.length,
    insufficientData: false
  };
}

function runPrediction(ccpId) {
  const result = predictForCCP(ccpId);
  if (!result) return null;

  const prev = predictionState.get(ccpId);
  const wasAlerting = prev ? prev.alertTriggered : false;

  predictionState.set(ccpId, result);

  if (result.alertTriggered && !wasAlerting) {
    broadcastPredictionAlert(result);
  }

  return result;
}

function getPredictionForCCP(ccpId) {
  const cached = predictionState.get(ccpId);
  if (cached) return cached;
  return predictForCCP(ccpId);
}

function getAllAlertingCCPs() {
  const results = [];
  for (const [ccpId] of predictionState) {
    const pred = predictionState.get(ccpId);
    if (pred && pred.alertTriggered) {
      results.push(pred);
    }
  }

  const allCCPs = store.getAllCCPs();
  for (const ccp of allCCPs) {
    if (!predictionState.has(ccp.id)) {
      const pred = predictForCCP(ccp.id);
      if (pred && pred.alertTriggered) {
        results.push(pred);
      }
    }
  }

  return results;
}

function recomputeAll() {
  const allCCPs = store.getAllCCPs();
  for (const ccp of allCCPs) {
    runPrediction(ccp.id);
  }
}

module.exports = {
  getConfig,
  updateConfig,
  predictForCCP,
  runPrediction,
  getPredictionForCCP,
  getAllAlertingCCPs,
  recomputeAll
};
