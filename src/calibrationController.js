const store = require('./store');

function addCalibration(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const { calibrationDate, standardValue, measuredValue, calibratedBy, nextCalibrationDue } = req.body;
  if (typeof standardValue !== 'number' || typeof measuredValue !== 'number') {
    return res.status(400).json({ error: '标准值和实测值必须是数字' });
  }
  if (!calibratedBy) {
    return res.status(400).json({ error: '校准人员不能为空' });
  }

  const compliance = store.checkSOPCompliance('calibration_record', 'calibration_ccp', ccpId);
  if (!compliance.compliant) {
    return res.status(403).json({
      error: `操作被拒绝: ${compliance.reason}`,
      sopCompliance: compliance
    });
  }

  const record = store.addCalibration(ccpId, {
    calibrationDate,
    standardValue,
    measuredValue,
    calibratedBy,
    nextCalibrationDue
  });

  const calStatus = store.getCCPCalibrationStatus(ccpId);
  const driftAlertGenerated = calStatus.driftAlert;

  res.status(201).json({ record, calibrationStatus: calStatus, driftAlertGenerated });
}

function getCalibrationsByCCP(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const records = store.getCalibrationsByCCP(ccpId);
  const calStatus = store.getCCPCalibrationStatus(ccpId);

  res.json({ records, calibrationStatus: calStatus });
}

function getCCPCalibrationStatus(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }

  const calStatus = store.getCCPCalibrationStatus(ccpId);
  const records = store.getCalibrationsByCCP(ccpId);

  res.json({
    ccpId,
    ccpName: ccp.name,
    productionLine: ccp.productionLine,
    ...calStatus,
    lastCalibrationDate: records.length > 0 ? records[records.length - 1].calibrationDate : null,
    lastDeviation: records.length > 0 ? records[records.length - 1].deviation : null,
    calibrationCount: records.length
  });
}

function getCalibrationDashboard(req, res) {
  const dashboard = store.getCalibrationDashboard();
  res.json(dashboard);
}

function getCalibrationAlerts(req, res) {
  const { status } = req.query;
  const alerts = store.getCalibrationAlerts(status);
  res.json(alerts);
}

function acknowledgeCalibrationAlert(req, res) {
  const alert = store.acknowledgeCalibrationAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: '告警不存在' });
  }
  res.json(alert);
}

module.exports = {
  addCalibration,
  getCalibrationsByCCP,
  getCCPCalibrationStatus,
  getCalibrationDashboard,
  getCalibrationAlerts,
  acknowledgeCalibrationAlert
};
