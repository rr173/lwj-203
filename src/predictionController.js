const store = require('./store');
const { getPredictionForCCP, getAllAlertingCCPs, getConfig, updateConfig } = require('./predictionEngine');

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
  const { sampleSize, predictMinutes } = req.body;

  if (sampleSize !== undefined && (typeof sampleSize !== 'number' || sampleSize < 3)) {
    return res.status(400).json({ error: '采样数量必须为不小于3的数字' });
  }
  if (predictMinutes !== undefined && (typeof predictMinutes !== 'number' || predictMinutes < 1)) {
    return res.status(400).json({ error: '预测时长必须为不小于1的数字' });
  }

  const updated = updateConfig(req.body);
  res.json(updated);
}

module.exports = {
  getCCPPrediction,
  getAlertingCCPs,
  getPredictionConfig,
  setPredictionConfig
};
