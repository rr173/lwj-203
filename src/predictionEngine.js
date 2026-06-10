const store = require('./store');
const { broadcastPredictionAlert } = require('./websocket');

const defaultConfig = {
  sampleSize: 20,
  predictMinutes: 10,
  emaAlpha: 0.3,
  maWindow: 5,
  maeWindowSize: 20
};

let predictionConfig = { ...defaultConfig };

const predictionState = new Map();
const modelErrorState = new Map();

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
  if (updates.emaAlpha !== undefined) {
    predictionConfig.emaAlpha = Math.min(1, Math.max(0.01, parseFloat(updates.emaAlpha)));
  }
  if (updates.maWindow !== undefined) {
    predictionConfig.maWindow = Math.max(2, Math.floor(updates.maWindow));
  }
  if (updates.maeWindowSize !== undefined) {
    predictionConfig.maeWindowSize = Math.max(5, Math.floor(updates.maeWindowSize));
  }
  recomputeAll();
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

function predictLinearRegression(points, predictOffsetSec) {
  const regression = linearRegression(points);
  if (!regression) return null;

  const { slope, intercept, r2 } = regression;
  const lastTimeSec = points[points.length - 1].x;
  const predictedTemp = slope * (lastTimeSec + predictOffsetSec) + intercept;

  return {
    predictedTemperature: parseFloat(predictedTemp.toFixed(2)),
    slope: parseFloat(slope.toFixed(6)),
    r2: parseFloat(r2.toFixed(6))
  };
}

function predictEMA(readings, alpha, predictOffsetSec) {
  if (readings.length < 2) return null;

  let ema = readings[0].temperature;
  for (let i = 1; i < readings.length; i++) {
    ema = alpha * readings[i].temperature + (1 - alpha) * ema;
  }

  const n = readings.length;
  if (n < 2) return { predictedTemperature: parseFloat(ema.toFixed(2)), emaSlope: 0 };

  const recentCount = Math.min(5, n);
  let recentSlopeSum = 0;
  for (let i = n - recentCount; i < n; i++) {
    if (i > 0) {
      const dt = (new Date(readings[i].timestamp).getTime() - new Date(readings[i - 1].timestamp).getTime()) / 1000;
      if (dt > 0) {
        recentSlopeSum += (readings[i].temperature - readings[i - 1].temperature) / dt;
      }
    }
  }
  const avgSlope = recentSlopeSum / Math.max(recentCount - 1, 1);
  const predictedTemp = ema + avgSlope * predictOffsetSec;

  return {
    predictedTemperature: parseFloat(predictedTemp.toFixed(2)),
    emaValue: parseFloat(ema.toFixed(2)),
    emaSlope: parseFloat(avgSlope.toFixed(6))
  };
}

function predictMovingAverage(readings, windowSize, predictOffsetSec) {
  if (readings.length < 2) return null;

  const effectiveWindow = Math.min(windowSize, readings.length);
  const windowReadings = readings.slice(-effectiveWindow);
  const ma = windowReadings.reduce((sum, r) => sum + r.temperature, 0) / effectiveWindow;

  const n = readings.length;
  const recentCount = Math.min(5, n);
  let recentSlopeSum = 0;
  for (let i = n - recentCount; i < n; i++) {
    if (i > 0) {
      const dt = (new Date(readings[i].timestamp).getTime() - new Date(readings[i - 1].timestamp).getTime()) / 1000;
      if (dt > 0) {
        recentSlopeSum += (readings[i].temperature - readings[i - 1].temperature) / dt;
      }
    }
  }
  const avgSlope = recentSlopeSum / Math.max(recentCount - 1, 1);
  const predictedTemp = ma + avgSlope * predictOffsetSec;

  return {
    predictedTemperature: parseFloat(predictedTemp.toFixed(2)),
    maValue: parseFloat(ma.toFixed(2)),
    maSlope: parseFloat(avgSlope.toFixed(6)),
    windowUsed: effectiveWindow
  };
}

function updateModelErrors(ccpId, readings) {
  if (readings.length < 3) return;

  const { sampleSize, emaAlpha, maWindow, maeWindowSize } = predictionConfig;
  const recent = readings.slice(-sampleSize);
  if (recent.length < 3) return;

  const baseTime = new Date(recent[0].timestamp).getTime();
  const points = recent.map(r => ({
    x: (new Date(r.timestamp).getTime() - baseTime) / 1000,
    y: r.temperature
  }));

  if (!modelErrorState.has(ccpId)) {
    modelErrorState.set(ccpId, {
      linear: [],
      ema: [],
      ma: []
    });
  }

  const errors = modelErrorState.get(ccpId);

  const evalCount = Math.min(recent.length - 1, 10);
  const startIdx = recent.length - 1 - evalCount;

  for (let i = startIdx; i < recent.length - 1; i++) {
    const actualTemp = recent[i + 1].temperature;
    const subReadings = recent.slice(0, i + 1);
    const subPoints = points.slice(0, i + 1);
    const dt = (new Date(recent[i + 1].timestamp).getTime() - new Date(recent[i].timestamp).getTime()) / 1000;
    const predictSec = dt > 0 ? dt : 1;

    const lrResult = predictLinearRegression(subPoints, predictSec);
    if (lrResult) {
      errors.linear.push(Math.abs(actualTemp - lrResult.predictedTemperature));
    }

    const emaResult = predictEMA(subReadings, emaAlpha, predictSec);
    if (emaResult) {
      errors.ema.push(Math.abs(actualTemp - emaResult.predictedTemperature));
    }

    const maResult = predictMovingAverage(subReadings, maWindow, predictSec);
    if (maResult) {
      errors.ma.push(Math.abs(actualTemp - maResult.predictedTemperature));
    }
  }

  errors.linear = errors.linear.slice(-maeWindowSize);
  errors.ema = errors.ema.slice(-maeWindowSize);
  errors.ma = errors.ma.slice(-maeWindowSize);
}

function computeMAE(errorList) {
  if (!errorList || errorList.length === 0) return null;
  return errorList.reduce((s, e) => s + e, 0) / errorList.length;
}

function selectRecommendedModel(ccpId) {
  const errors = modelErrorState.get(ccpId);
  if (!errors) return 'linear';

  const maeLinear = computeMAE(errors.linear);
  const maeEma = computeMAE(errors.ema);
  const maeMa = computeMAE(errors.ma);

  const candidates = [];
  if (maeLinear !== null) candidates.push({ model: 'linear', mae: maeLinear });
  if (maeEma !== null) candidates.push({ model: 'ema', mae: maeEma });
  if (maeMa !== null) candidates.push({ model: 'ma', mae: maeMa });

  if (candidates.length === 0) return 'linear';

  candidates.sort((a, b) => a.mae - b.mae);
  return candidates[0].model;
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
      insufficientData: true,
      models: null,
      recommendedModel: null
    };
  }

  const { sampleSize, predictMinutes, emaAlpha, maWindow } = predictionConfig;
  const recent = readings.slice(-sampleSize);

  const baseTime = new Date(recent[0].timestamp).getTime();
  const points = recent.map(r => ({
    x: (new Date(r.timestamp).getTime() - baseTime) / 1000,
    y: r.temperature
  }));

  const predictOffsetSec = predictMinutes * 60;

  const lrResult = predictLinearRegression(points, predictOffsetSec);
  const emaResult = predictEMA(recent, emaAlpha, predictOffsetSec);
  const maResult = predictMovingAverage(recent, maWindow, predictOffsetSec);

  if (!lrResult && !emaResult && !maResult) {
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
      insufficientData: true,
      models: null,
      recommendedModel: null
    };
  }

  updateModelErrors(ccpId, readings);
  const recommendedModel = selectRecommendedModel(ccpId);

  const errorData = modelErrorState.get(ccpId);
  const maeLinear = computeMAE(errorData ? errorData.linear : []);
  const maeEma = computeMAE(errorData ? errorData.ema : []);
  const maeMa = computeMAE(errorData ? errorData.ma : []);

  const models = {
    linear: {
      name: '线性回归',
      predictedTemperature: lrResult ? lrResult.predictedTemperature : null,
      slope: lrResult ? lrResult.slope : null,
      r2: lrResult ? lrResult.r2 : null,
      mae: maeLinear !== null ? parseFloat(maeLinear.toFixed(4)) : null,
      isRecommended: recommendedModel === 'linear'
    },
    ema: {
      name: '指数平滑',
      predictedTemperature: emaResult ? emaResult.predictedTemperature : null,
      emaValue: emaResult ? emaResult.emaValue : null,
      emaSlope: emaResult ? emaResult.emaSlope : null,
      mae: maeEma !== null ? parseFloat(maeEma.toFixed(4)) : null,
      isRecommended: recommendedModel === 'ema'
    },
    ma: {
      name: '移动平均',
      predictedTemperature: maResult ? maResult.predictedTemperature : null,
      maValue: maResult ? maResult.maValue : null,
      maSlope: maResult ? maResult.maSlope : null,
      windowUsed: maResult ? maResult.windowUsed : null,
      mae: maeMa !== null ? parseFloat(maeMa.toFixed(4)) : null,
      isRecommended: recommendedModel === 'ma'
    }
  };

  const recommendedResult = models[recommendedModel];
  const predictedTemp = recommendedResult.predictedTemperature;
  const effectiveSlope = recommendedModel === 'linear' && lrResult
    ? lrResult.slope
    : (recommendedModel === 'ema' && emaResult
      ? emaResult.emaSlope
      : (maResult ? maResult.maSlope : 0));
  const effectiveR2 = lrResult ? lrResult.r2 : 0;

  let alertTriggered = false;
  let alertDirection = null;
  let predictedArrivalTime = null;

  if (predictedTemp !== null) {
    if (effectiveSlope > 0 && predictedTemp > ccp.complianceMax) {
      alertTriggered = true;
      alertDirection = 'upper';
      const lastReadingMs = new Date(recent[recent.length - 1].timestamp).getTime();
      const lastTemp = recent[recent.length - 1].temperature;
      if (lastTemp < ccp.complianceMax && effectiveSlope > 0) {
        const secondsToBreach = (ccp.complianceMax - lastTemp) / effectiveSlope;
        predictedArrivalTime = new Date(lastReadingMs + secondsToBreach * 1000).toISOString();
      } else {
        predictedArrivalTime = new Date(lastReadingMs).toISOString();
      }
    } else if (effectiveSlope < 0 && predictedTemp < ccp.complianceMin) {
      alertTriggered = true;
      alertDirection = 'lower';
      const lastReadingMs = new Date(recent[recent.length - 1].timestamp).getTime();
      const lastTemp = recent[recent.length - 1].temperature;
      if (lastTemp > ccp.complianceMin && effectiveSlope < 0) {
        const secondsToBreach = (ccp.complianceMin - lastTemp) / effectiveSlope;
        predictedArrivalTime = new Date(lastReadingMs + secondsToBreach * 1000).toISOString();
      } else {
        predictedArrivalTime = new Date(lastReadingMs).toISOString();
      }
    }
  }

  return {
    ccpId,
    ccpName: ccp.name,
    complianceMin: ccp.complianceMin,
    complianceMax: ccp.complianceMax,
    slope: parseFloat(effectiveSlope.toFixed(6)),
    slopeUnit: '°C/s',
    r2: parseFloat(effectiveR2.toFixed(6)),
    predictedTemperature: predictedTemp !== null ? parseFloat(predictedTemp.toFixed(2)) : null,
    predictMinutes,
    alertTriggered,
    alertDirection,
    predictedArrivalTime,
    sampleCount: recent.length,
    insufficientData: false,
    recommendedModel,
    models
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
  const allCCPs = store.getAllCCPs();
  for (const ccp of allCCPs) {
    const pred = predictForCCP(ccp.id);
    if (pred && pred.alertTriggered) {
      results.push(pred);
    }
  }
  return results;
}

function getModelComparison(ccpId) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) return null;

  const prediction = predictForCCP(ccpId);
  if (!prediction || prediction.insufficientData) {
    return {
      ccpId,
      ccpName: ccp.name,
      insufficientData: true,
      models: null,
      recommendedModel: null
    };
  }

  return {
    ccpId,
    ccpName: ccp.name,
    insufficientData: false,
    recommendedModel: prediction.recommendedModel,
    models: prediction.models
  };
}

function getModelDistribution() {
  const allCCPs = store.getAllCCPs();
  const distribution = { linear: 0, ema: 0, ma: 0 };
  const details = [];

  for (const ccp of allCCPs) {
    const pred = predictForCCP(ccp.id);
    if (pred && !pred.insufficientData && pred.recommendedModel) {
      distribution[pred.recommendedModel] = (distribution[pred.recommendedModel] || 0) + 1;
      details.push({
        ccpId: ccp.id,
        ccpName: ccp.name,
        productionLine: ccp.productionLine,
        recommendedModel: pred.recommendedModel,
        predictedTemperature: pred.predictedTemperature,
        modelMAE: pred.models[pred.recommendedModel].mae
      });
    }
  }

  const total = details.length;
  return {
    total,
    distribution,
    percentages: {
      linear: total > 0 ? parseFloat((distribution.linear / total * 100).toFixed(1)) : 0,
      ema: total > 0 ? parseFloat((distribution.ema / total * 100).toFixed(1)) : 0,
      ma: total > 0 ? parseFloat((distribution.ma / total * 100).toFixed(1)) : 0
    },
    details
  };
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
  getModelComparison,
  getModelDistribution,
  recomputeAll
};
