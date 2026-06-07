const store = require('./store');

function validateCCPData(data) {
  const errors = [];
  if (!data.name) errors.push('名称不能为空');
  if (!data.productionLine) errors.push('所属产线不能为空');
  if (typeof data.complianceMin !== 'number') errors.push('合规温度下限必须是数字');
  if (typeof data.complianceMax !== 'number') errors.push('合规温度上限必须是数字');
  if (typeof data.criticalMin !== 'number') errors.push('严重偏差下限必须是数字');
  if (typeof data.criticalMax !== 'number') errors.push('严重偏差上限必须是数字');
  if (data.complianceMin >= data.complianceMax) errors.push('合规温度下限必须小于上限');
  if (data.criticalMin >= data.criticalMax) errors.push('严重偏差下限必须小于上限');
  if (data.criticalMin > data.complianceMin) errors.push('严重偏差下限必须小于等于合规下限');
  if (data.criticalMax < data.complianceMax) errors.push('严重偏差上限必须大于等于合规上限');
  if (typeof data.reportingFrequency !== 'number' || data.reportingFrequency <= 0) errors.push('上报频率必须是正整数');
  if (data.deviationCloseTimeLimit !== undefined && (typeof data.deviationCloseTimeLimit !== 'number' || data.deviationCloseTimeLimit <= 0)) {
    errors.push('偏差关闭时限必须是正整数');
  }
  return errors;
}

function createCCP(req, res) {
  const errors = validateCCPData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const ccp = store.addCCP({
    name: req.body.name,
    productionLine: req.body.productionLine,
    complianceMin: req.body.complianceMin,
    complianceMax: req.body.complianceMax,
    criticalMin: req.body.criticalMin,
    criticalMax: req.body.criticalMax,
    reportingFrequency: req.body.reportingFrequency,
    deviationCloseTimeLimit: req.body.deviationCloseTimeLimit || 30
  });

  res.status(201).json(ccp);
}

function getAllCCPs(req, res) {
  const { productionLine } = req.query;
  let ccps;
  if (productionLine) {
    ccps = store.getCCPsByProductionLine(productionLine);
  } else {
    ccps = store.getAllCCPs();
  }
  res.json(ccps);
}

function getCCP(req, res) {
  const ccp = store.getCCP(req.params.id);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }
  res.json(ccp);
}

function updateCCP(req, res) {
  const ccp = store.getCCP(req.params.id);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const updateData = { ...ccp, ...req.body };
  const errors = validateCCPData(updateData);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const updated = store.updateCCP(req.params.id, req.body);
  res.json(updated);
}

function deactivateCCP(req, res) {
  const ccp = store.getCCP(req.params.id);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }
  const updated = store.deactivateCCP(req.params.id);
  res.json(updated);
}

function activateCCP(req, res) {
  const ccp = store.getCCP(req.params.id);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }
  const updated = store.activateCCP(req.params.id);
  res.json(updated);
}

module.exports = {
  createCCP,
  getAllCCPs,
  getCCP,
  updateCCP,
  deactivateCCP,
  activateCCP
};
