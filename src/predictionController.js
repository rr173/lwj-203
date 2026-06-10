const store = require('./store');
const { getPredictionForCCP, getAllAlertingCCPs, getConfig, updateConfig, getModelComparison, getModelDistribution } = require('./predictionEngine');

function getCCPPrediction(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const result = getPredictionForCCP(ccpId);
  if (!result) {
    return res.status(404).json({ error: '无法生成预测' });
  }

  res.json(result);
}

function getAlertingCCPs(req, res) {
  const alerting = getAllAlertingCCPs();
  res.json(alerting);
}

function getPredictionConfig(req, res) {
  res.json(getConfig());
}

function setPredictionConfig(req, res) {
  const { sampleSize, predictMinutes, emaAlpha, maWindow, maeWindowSize } = req.body;

  if (sampleSize !== undefined && (typeof sampleSize !== 'number' || sampleSize < 3)) {
    return res.status(400).json({ error: '采样数量必须为不小于3的数字' });
  }
  if (predictMinutes !== undefined && (typeof predictMinutes !== 'number' || predictMinutes < 1)) {
    return res.status(400).json({ error: '预测时长必须为不小于1的数字' });
  }
  if (emaAlpha !== undefined && (typeof emaAlpha !== 'number' || emaAlpha < 0.01 || emaAlpha > 1)) {
    return res.status(400).json({ error: 'EMA衰减系数必须为0.01-1之间的数字' });
  }
  if (maWindow !== undefined && (typeof maWindow !== 'number' || maWindow < 2)) {
    return res.status(400).json({ error: '移动平均窗口必须为不小于2的整数' });
  }
  if (maeWindowSize !== undefined && (typeof maeWindowSize !== 'number' || maeWindowSize < 5)) {
    return res.status(400).json({ error: 'MAE窗口必须为不小于5的整数' });
  }

  const updated = updateConfig(req.body);
  res.json(updated);
}

function getCCPModelComparison(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const result = getModelComparison(ccpId);
  res.json(result);
}

function getModelDistributionStats(req, res) {
  const result = getModelDistribution();
  res.json(result);
}

module.exports = {
  getCCPPrediction,
  getAlertingCCPs,
  getPredictionConfig,
  setPredictionConfig,
  getCCPModelComparison,
  getModelDistributionStats
};
