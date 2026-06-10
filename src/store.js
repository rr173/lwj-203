class DataStore {
  constructor() {
    this.ccps = new Map();
    this.readings = new Map();
    this.deviations = new Map();
    this.correctiveActions = new Map();
    this.offlineAlerts = new Map();
    this.rules = new Map();
    this.ruleAlerts = new Map();
    this.ruleEvalState = new Map();
    this.productionLines = new Set();
    this.nextCcpId = 1;
    this.nextReadingId = 1;
    this.nextDeviationId = 1;
    this.nextActionId = 1;
    this.nextOfflineAlertId = 1;
    this.nextRuleId = 1;
    this.scenes = new Map();
    this.nextSceneId = 1;
    this.nextReplayId = 1;
    this.nextSimulationId = 1;
    this.nextRuleAlertId = 1;
    this.batches = new Map();
    this.nextBatchId = 1;
    this.recallThreshold = 60;
    this.recallExecutions = new Map();
    this.nextRecallExecId = 1;
    this.calibrations = new Map();
    this.nextCalibrationId = 1;
    this.calibrationAlerts = new Map();
    this.nextCalibrationAlertId = 1;
    this.maintenancePlans = new Map();
    this.nextMaintenancePlanId = 1;
    this.powerReadings = new Map();
    this.nextPowerReadingId = 1;
    this.energyBaselines = new Map();
    this.energyAnomalyEvents = new Map();
    this.nextEnergyAnomalyId = 1;
    this.lineCorrelations = new Map();
    this.sharedColdSourcePairs = new Set();
    this.energyConfig = {
      anomalyThreshold: 0.3,
      baselineWindowHours: 24,
      correlationThreshold: 0.8
    };
  }

  generateId(type) {
    switch (type) {
      case 'ccp':
        return `CCP${String(this.nextCcpId++).padStart(4, '0')}`;
      case 'reading':
        return this.nextReadingId++;
      case 'deviation':
        return `DEV${String(this.nextDeviationId++).padStart(6, '0')}`;
      case 'action':
        return this.nextActionId++;
      case 'offlineAlert':
        return `OFF${String(this.nextOfflineAlertId++).padStart(6, '0')}`;
      case 'rule':
        return `RULE${String(this.nextRuleId++).padStart(4, '0')}`;
      case 'ruleAlert':
        return `RAL${String(this.nextRuleAlertId++).padStart(6, '0')}`;
      case 'scene':
        return `SCENE${String(this.nextSceneId++).padStart(4, '0')}`;
      case 'replay':
        return `RPL${String(this.nextReplayId++).padStart(6, '0')}`;
      case 'simulation':
        return `SIM${String(this.nextSimulationId++).padStart(6, '0')}`;
      case 'batch':
        return `BATCH${String(this.nextBatchId++).padStart(6, '0')}`;
      case 'recallExec':
        return `RCLEX${String(this.nextRecallExecId++).padStart(6, '0')}`;
      case 'calibration':
        return `CAL${String(this.nextCalibrationId++).padStart(6, '0')}`;
      case 'calibrationAlert':
        return `CALALT${String(this.nextCalibrationAlertId++).padStart(6, '0')}`;
      case 'maintenancePlan':
        return `MNT${String(this.nextMaintenancePlanId++).padStart(6, '0')}`;
      case 'powerReading':
        return this.nextPowerReadingId++;
      case 'energyAnomaly':
        return `ENA${String(this.nextEnergyAnomalyId++).padStart(6, '0')}`;
      default:
        return Date.now();
    }
  }

  addCCP(ccp) {
    const id = this.generateId('ccp');
    const now = new Date().toISOString();
    const ccpWithId = { ...ccp, id, status: 'normal', isActive: true, lastReadingTime: now, createdAt: now };
    this.ccps.set(id, ccpWithId);
    this.readings.set(id, []);
    if (ccp.productionLine) {
      this.productionLines.add(ccp.productionLine);
    }
    return ccpWithId;
  }

  getCCP(id) {
    return this.ccps.get(id);
  }

  getAllCCPs() {
    return Array.from(this.ccps.values());
  }

  getCCPsByProductionLine(line) {
    return Array.from(this.ccps.values()).filter(c => c.productionLine === line);
  }

  updateCCP(id, updates) {
    const ccp = this.ccps.get(id);
    if (!ccp) return null;
    const updated = { ...ccp, ...updates };
    this.ccps.set(id, updated);
    return updated;
  }

  deactivateCCP(id) {
    return this.updateCCP(id, { isActive: false });
  }

  activateCCP(id) {
    return this.updateCCP(id, { isActive: true });
  }

  addReading(ccpId, reading) {
    const id = this.generateId('reading');
    const readingWithId = { ...reading, id, ccpId };
    const readings = this.readings.get(ccpId);
    if (readings) {
      readings.push(readingWithId);
    }
    return readingWithId;
  }

  getReadings(ccpId, startTime, endTime) {
    const readings = this.readings.get(ccpId) || [];
    if (!startTime && !endTime) return readings;
    return readings.filter(r => {
      const time = new Date(r.timestamp).getTime();
      if (startTime && time < startTime) return false;
      if (endTime && time > endTime) return false;
      return true;
    });
  }

  getLastReading(ccpId) {
    const readings = this.readings.get(ccpId) || [];
    return readings.length > 0 ? readings[readings.length - 1] : null;
  }

  addDeviation(deviation) {
    const id = this.generateId('deviation');
    const deviationWithId = { ...deviation, id, status: 'open', createdAt: new Date().toISOString(), escalatedAt: null, closedAt: null, closeReason: null, closedBy: null, actions: [], isMaintenanceDeviation: deviation.isMaintenanceDeviation || false, deviationType: deviation.deviationType || 'normal' };
    this.deviations.set(id, deviationWithId);
    return deviationWithId;
  }

  getDeviation(id) {
    return this.deviations.get(id);
  }

  getAllDeviations() {
    return Array.from(this.deviations.values());
  }

  getOpenDeviations() {
    return Array.from(this.deviations.values()).filter(d => d.status === 'open');
  }

  getDeviationsByCCP(ccpId) {
    return Array.from(this.deviations.values()).filter(d => d.ccpId === ccpId);
  }

  getOpenDeviationForCCP(ccpId) {
    return Array.from(this.deviations.values()).find(d => d.ccpId === ccpId && d.status !== 'closed');
  }

  updateDeviation(id, updates) {
    const deviation = this.deviations.get(id);
    if (!deviation) return null;
    const updated = { ...deviation, ...updates };
    this.deviations.set(id, updated);
    return updated;
  }

  addCorrectiveAction(deviationId, action) {
    const id = this.generateId('action');
    const actionWithId = { ...action, id, deviationId, createdAt: new Date().toISOString() };
    const deviation = this.deviations.get(deviationId);
    if (deviation) {
      deviation.actions.push(actionWithId);
    }
    return actionWithId;
  }

  getAllProductionLines() {
    return Array.from(this.productionLines);
  }

  addOfflineAlert(alert) {
    const id = this.generateId('offlineAlert');
    const alertWithId = {
      ...alert,
      id,
      status: 'open',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      durationSeconds: null
    };
    this.offlineAlerts.set(id, alertWithId);
    return alertWithId;
  }

  getOfflineAlert(id) {
    return this.offlineAlerts.get(id);
  }

  getAllOfflineAlerts() {
    return Array.from(this.offlineAlerts.values());
  }

  getOpenOfflineAlerts() {
    return Array.from(this.offlineAlerts.values()).filter(a => a.status === 'open');
  }

  getOfflineAlertsByCCP(ccpId) {
    return Array.from(this.offlineAlerts.values()).filter(a => a.ccpId === ccpId);
  }

  getOpenOfflineAlertForCCP(ccpId) {
    return Array.from(this.offlineAlerts.values()).find(a => a.ccpId === ccpId && a.status === 'open');
  }

  updateOfflineAlert(id, updates) {
    const alert = this.offlineAlerts.get(id);
    if (!alert) return null;
    const updated = { ...alert, ...updates };
    this.offlineAlerts.set(id, updated);
    return updated;
  }

  resolveOfflineAlert(id, resolvedAt) {
    const alert = this.offlineAlerts.get(id);
    if (!alert) return null;
    const start = new Date(alert.createdAt).getTime();
    const end = new Date(resolvedAt).getTime();
    const actualEnd = Math.max(start, end);
    const durationSeconds = Math.round((actualEnd - start) / 1000);
    const actualResolvedAt = new Date(actualEnd).toISOString();
    return this.updateOfflineAlert(id, {
      status: 'resolved',
      resolvedAt: actualResolvedAt,
      durationSeconds
    });
  }

  addRule(rule) {
    const id = this.generateId('rule');
    const now = new Date().toISOString();
    const ruleWithId = { ...rule, id, createdAt: now, updatedAt: now };
    this.rules.set(id, ruleWithId);
    return ruleWithId;
  }

  getRule(id) {
    return this.rules.get(id);
  }

  getAllRules() {
    return Array.from(this.rules.values());
  }

  getRulesByCCP(ccpId) {
    return Array.from(this.rules.values()).filter(r => r.ccpId === ccpId);
  }

  updateRule(id, updates) {
    const rule = this.rules.get(id);
    if (!rule) return null;
    const updated = { ...rule, ...updates, updatedAt: new Date().toISOString() };
    this.rules.set(id, updated);
    return updated;
  }

  deleteRule(id) {
    return this.rules.delete(id);
  }

  addRuleAlert(alert) {
    const id = this.generateId('ruleAlert');
    const alertWithId = {
      ...alert,
      id,
      status: 'open',
      createdAt: new Date().toISOString(),
      acknowledgedAt: null
    };
    this.ruleAlerts.set(id, alertWithId);
    return alertWithId;
  }

  getRuleAlert(id) {
    return this.ruleAlerts.get(id);
  }

  getAllRuleAlerts() {
    return Array.from(this.ruleAlerts.values());
  }

  getRuleAlertsByCCP(ccpId) {
    return Array.from(this.ruleAlerts.values()).filter(a => a.ccpId === ccpId);
  }

  getRuleAlertsByRule(ruleId) {
    return Array.from(this.ruleAlerts.values()).filter(a => a.ruleId === ruleId);
  }

  acknowledgeRuleAlert(id) {
    const alert = this.ruleAlerts.get(id);
    if (!alert) return null;
    const updated = { ...alert, status: 'acknowledged', acknowledgedAt: new Date().toISOString() };
    this.ruleAlerts.set(id, updated);
    return updated;
  }

  getRuleEvalState(ruleId) {
    return this.ruleEvalState.get(ruleId) || null;
  }

  setRuleEvalState(ruleId, state) {
    this.ruleEvalState.set(ruleId, state);
  }

  resetRuleEvalState(ruleId) {
    this.ruleEvalState.delete(ruleId);
  }

  addScene(scene) {
    const id = this.generateId('scene');
    const now = new Date().toISOString();
    const sceneWithId = { ...scene, id, createdAt: now };
    this.scenes.set(id, sceneWithId);
    return sceneWithId;
  }

  getScene(id) {
    return this.scenes.get(id);
  }

  getAllScenes() {
    return Array.from(this.scenes.values());
  }

  deleteScene(id) {
    return this.scenes.delete(id);
  }

  addBatch(batch) {
    const id = this.generateId('batch');
    const now = new Date().toISOString();
    const batchWithId = {
      ...batch,
      id,
      status: 'producing',
      startTime: batch.startTime || now,
      endTime: null,
      createdAt: now
    };
    this.batches.set(id, batchWithId);
    return batchWithId;
  }

  getBatch(id) {
    return this.batches.get(id);
  }

  getAllBatches() {
    return Array.from(this.batches.values());
  }

  getBatchesByProductionLine(line) {
    return Array.from(this.batches.values()).filter(b => b.productionLine === line);
  }

  getActiveBatchByLine(line) {
    return Array.from(this.batches.values()).find(b => b.productionLine === line && b.status === 'producing');
  }

  updateBatch(id, updates) {
    const batch = this.batches.get(id);
    if (!batch) return null;
    const updated = { ...batch, ...updates };
    this.batches.set(id, updated);
    return updated;
  }

  getRecallThreshold() {
    return this.recallThreshold;
  }

  setRecallThreshold(threshold) {
    this.recallThreshold = threshold;
    return threshold;
  }

  addRecallExecution(batchId, exec) {
    const id = this.generateId('recallExec');
    const now = new Date().toISOString();
    const record = {
      id,
      batchId,
      reason: exec.reason || '',
      affectedQuantity: exec.affectedQuantity || 0,
      recoveredQuantity: exec.recoveredQuantity || 0,
      channel: exec.channel || '',
      responsiblePerson: exec.responsiblePerson || '',
      createdAt: now
    };
    this.recallExecutions.set(id, record);
    return record;
  }

  getRecallExecution(id) {
    return this.recallExecutions.get(id);
  }

  getRecallExecutionsForBatch(batchId) {
    return Array.from(this.recallExecutions.values()).filter(r => r.batchId === batchId);
  }

  getAllRecallExecutions() {
    return Array.from(this.recallExecutions.values());
  }

  getRecallSummaryForBatch(batchId) {
    const batch = this.batches.get(batchId);
    if (!batch) return null;
    const records = this.getRecallExecutionsForBatch(batchId);
    let affectedQuantity = 0;
    let totalRecovered = 0;
    const channelBreakdown = {};
    for (const r of records) {
      affectedQuantity = Math.max(affectedQuantity, r.affectedQuantity);
      totalRecovered += r.recoveredQuantity;
      if (!channelBreakdown[r.channel]) {
        channelBreakdown[r.channel] = 0;
      }
      channelBreakdown[r.channel] += r.recoveredQuantity;
    }
    totalRecovered = Math.min(totalRecovered, affectedQuantity);
    for (const ch of Object.keys(channelBreakdown)) {
      channelBreakdown[ch] = Math.min(channelBreakdown[ch], affectedQuantity);
    }
    const recoveryRate = affectedQuantity > 0 ? totalRecovered / affectedQuantity : 0;
    return {
      batchId,
      batchNo: batch.batchNo,
      productName: batch.productName,
      productionLine: batch.productionLine,
      batchStatus: batch.status,
      affectedQuantity,
      totalRecovered,
      recoveryRate: parseFloat(recoveryRate.toFixed(4)),
      channelBreakdown,
      recordCount: records.length,
      records
    };
  }

  getRecallOverview() {
    const recalledBatches = Array.from(this.batches.values()).filter(b => b.status === 'recalled' || b.status === 'closed');
    return recalledBatches.map(b => {
      const summary = this.getRecallSummaryForBatch(b.id);
      return summary || {
        batchId: b.id,
        batchNo: b.batchNo,
        productName: b.productName,
        productionLine: b.productionLine,
        batchStatus: b.status,
        affectedQuantity: 0,
        totalRecovered: 0,
        recoveryRate: 0,
        channelBreakdown: {},
        recordCount: 0,
        records: []
      };
    }).sort((a, b) => a.recoveryRate - b.recoveryRate);
  }

  getDeviationsForBatch(batch) {
    const lineCCPIds = this.getCCPsByProductionLine(batch.productionLine).map(c => c.id);
    const batchStart = new Date(batch.startTime).getTime();
    const batchEnd = batch.endTime ? new Date(batch.endTime).getTime() : Date.now();
    return this.getAllDeviations().filter(d => {
      if (!lineCCPIds.includes(d.ccpId)) return false;
      const devStart = new Date(d.createdAt).getTime();
      const devEnd = d.closedAt ? new Date(d.closedAt).getTime() : Date.now();
      return devStart < batchEnd && devEnd > batchStart;
    });
  }

  addCalibration(ccpId, calibration) {
    const id = this.generateId('calibration');
    const now = new Date().toISOString();
    const record = {
      id,
      ccpId,
      calibrationDate: calibration.calibrationDate || now,
      standardValue: calibration.standardValue,
      measuredValue: calibration.measuredValue,
      deviation: parseFloat((calibration.measuredValue - calibration.standardValue).toFixed(4)),
      calibratedBy: calibration.calibratedBy || '',
      nextCalibrationDue: calibration.nextCalibrationDue || null,
      createdAt: now
    };
    this.calibrations.set(id, record);

    if (this.checkDriftAlert(ccpId)) {
      this.addCalibrationAlert(ccpId, 'drift');
    } else {
      this.resolveOpenDriftAlertsForCCP(ccpId);
    }

    return record;
  }

  resolveOpenDriftAlertsForCCP(ccpId) {
    for (const [id, alert] of this.calibrationAlerts) {
      if (alert.ccpId === ccpId && alert.type === 'drift' && alert.status === 'open') {
        this.calibrationAlerts.set(id, { ...alert, status: 'auto_resolved', resolvedAt: new Date().toISOString() });
      }
    }
  }

  getCalibrationsByCCP(ccpId) {
    return Array.from(this.calibrations.values())
      .filter(c => c.ccpId === ccpId)
      .sort((a, b) => new Date(a.calibrationDate).getTime() - new Date(b.calibrationDate).getTime());
  }

  getCalibration(id) {
    return this.calibrations.get(id);
  }

  getAllCalibrations() {
    return Array.from(this.calibrations.values());
  }

  checkDriftAlert(ccpId) {
    const records = this.getCalibrationsByCCP(ccpId);
    if (records.length < 3) return false;
    const last3 = records.slice(-3);
    const absDeviations = last3.map(r => Math.abs(r.deviation));
    return absDeviations[1] > absDeviations[0] && absDeviations[2] > absDeviations[1];
  }

  getCCPCalibrationStatus(ccpId) {
    const records = this.getCalibrationsByCCP(ccpId);
    if (records.length === 0) {
      return { status: 'normal', reason: '暂无校准记录', nextDue: null, driftAlert: false };
    }

    const latest = records[records.length - 1];
    const nextDue = latest.nextCalibrationDue;
    const isDrift = this.checkDriftAlert(ccpId);

    if (nextDue) {
      const now = Date.now();
      const dueMs = new Date(nextDue).getTime();
      if (dueMs < now) {
        return { status: 'expired', reason: isDrift ? '校准已过期且漂移加剧' : '校准已过期', nextDue, driftAlert: isDrift };
      }
      const daysUntilDue = (dueMs - now) / (1000 * 60 * 60 * 24);
      if (daysUntilDue <= 7) {
        return { status: 'expiring_soon', reason: isDrift ? `校准将于${Math.ceil(daysUntilDue)}天后到期且漂移加剧` : `校准将于${Math.ceil(daysUntilDue)}天后到期`, nextDue, driftAlert: isDrift };
      }
    }

    if (isDrift) {
      return { status: 'drift_alert', reason: '漂移加剧: 最近3次校准偏差绝对值单调递增', nextDue, driftAlert: true };
    }

    return { status: 'normal', reason: '校准状态正常', nextDue, driftAlert: false };
  }

  getCalibrationDashboard() {
    const ccps = this.getAllCCPs();
    const urgencyOrder = { expired: 0, drift_alert: 1, expiring_soon: 2, normal: 3 };
    const statusCounts = { normal: 0, expiring_soon: 0, expired: 0, drift_alert: 0 };

    const items = ccps.map(ccp => {
      const calStatus = this.getCCPCalibrationStatus(ccp.id);
      const records = this.getCalibrationsByCCP(ccp.id);
      statusCounts[calStatus.status]++;

      return {
        ccpId: ccp.id,
        ccpName: ccp.name,
        productionLine: ccp.productionLine,
        calibrationStatus: calStatus.status,
        calibrationReason: calStatus.reason,
        nextCalibrationDue: calStatus.nextDue,
        driftAlert: calStatus.driftAlert,
        lastCalibrationDate: records.length > 0 ? records[records.length - 1].calibrationDate : null,
        lastDeviation: records.length > 0 ? records[records.length - 1].deviation : null,
        calibrationCount: records.length
      };
    });

    items.sort((a, b) => urgencyOrder[a.calibrationStatus] - urgencyOrder[b.calibrationStatus]);

    return { items, statusCounts };
  }

  addCalibrationAlert(ccpId, type) {
    const existing = Array.from(this.calibrationAlerts.values())
      .find(a => a.ccpId === ccpId && a.type === type && a.status === 'open');
    if (existing) return existing;

    const id = this.generateId('calibrationAlert');
    const now = new Date().toISOString();
    const ccp = this.ccps.get(ccpId);
    const alert = {
      id,
      ccpId,
      ccpName: ccp ? ccp.name : '',
      productionLine: ccp ? ccp.productionLine : '',
      type,
      status: 'open',
      createdAt: now,
      acknowledgedAt: null
    };
    this.calibrationAlerts.set(id, alert);
    return alert;
  }

  getCalibrationAlerts(status) {
    const alerts = Array.from(this.calibrationAlerts.values());
    if (status) return alerts.filter(a => a.status === status);
    return alerts;
  }

  acknowledgeCalibrationAlert(id) {
    const alert = this.calibrationAlerts.get(id);
    if (!alert) return null;
    const updated = { ...alert, status: 'acknowledged', acknowledgedAt: new Date().toISOString() };
    this.calibrationAlerts.set(id, updated);
    return updated;
  }

  addMaintenancePlan(plan) {
    const id = this.generateId('maintenancePlan');
    const now = new Date().toISOString();
    const planWithId = {
      id,
      productionLine: plan.productionLine,
      startTime: plan.startTime,
      endTime: plan.endTime,
      reason: plan.reason || '',
      responsiblePerson: plan.responsiblePerson || '',
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    };
    this.maintenancePlans.set(id, planWithId);
    return planWithId;
  }

  getMaintenancePlan(id) {
    return this.maintenancePlans.get(id);
  }

  getAllMaintenancePlans() {
    return Array.from(this.maintenancePlans.values());
  }

  getMaintenancePlansByLine(productionLine) {
    return Array.from(this.maintenancePlans.values())
      .filter(p => p.productionLine === productionLine);
  }

  updateMaintenancePlan(id, updates) {
    const plan = this.maintenancePlans.get(id);
    if (!plan) return null;
    const updated = { ...plan, ...updates, updatedAt: new Date().toISOString() };
    this.maintenancePlans.set(id, updated);
    return updated;
  }

  deleteMaintenancePlan(id) {
    return this.maintenancePlans.delete(id);
  }

  isLineUnderMaintenance(productionLine, checkTime) {
    const time = checkTime || Date.now();
    return Array.from(this.maintenancePlans.values()).some(p => {
      if (p.productionLine !== productionLine) return false;
      const start = new Date(p.startTime).getTime();
      const end = new Date(p.endTime).getTime();
      return start <= time && end >= time;
    });
  }

  getActiveMaintenanceForLine(productionLine) {
    const now = Date.now();
    return Array.from(this.maintenancePlans.values()).filter(p => {
      if (p.productionLine !== productionLine) return false;
      const start = new Date(p.startTime).getTime();
      const end = new Date(p.endTime).getTime();
      return start <= now && end >= now;
    });
  }

  getCurrentlyMaintainedLines() {
    const now = Date.now();
    const lines = new Set();
    for (const plan of this.maintenancePlans.values()) {
      const start = new Date(plan.startTime).getTime();
      const end = new Date(plan.endTime).getTime();
      if (start <= now && end >= now) {
        lines.add(plan.productionLine);
      }
    }
    return Array.from(lines);
  }

  getFuturePlansByLine(productionLine) {
    const now = Date.now();
    return this.getMaintenancePlansByLine(productionLine)
      .filter(p => new Date(p.startTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getHistoryPlansByLine(productionLine) {
    const now = Date.now();
    return this.getMaintenancePlansByLine(productionLine)
      .filter(p => new Date(p.endTime).getTime() <= now)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
  }

  addPowerReading(ccpId, reading) {
    const id = this.generateId('powerReading');
    const readingWithId = { ...reading, id, ccpId };
    if (!this.powerReadings.has(ccpId)) {
      this.powerReadings.set(ccpId, []);
    }
    this.powerReadings.get(ccpId).push(readingWithId);
    return readingWithId;
  }

  getPowerReadings(ccpId, startTime, endTime) {
    const readings = this.powerReadings.get(ccpId) || [];
    if (!startTime && !endTime) return readings;
    return readings.filter(r => {
      const time = new Date(r.timestamp).getTime();
      if (startTime && time < startTime) return false;
      if (endTime && time > endTime) return false;
      return true;
    });
  }

  getLastPowerReading(ccpId) {
    const readings = this.powerReadings.get(ccpId) || [];
    return readings.length > 0 ? readings[readings.length - 1] : null;
  }

  getAllPowerReadingsByLine(productionLine, startTime, endTime) {
    const ccpIds = this.getCCPsByProductionLine(productionLine).map(c => c.id);
    const result = [];
    for (const ccpId of ccpIds) {
      result.push(...this.getPowerReadings(ccpId, startTime, endTime));
    }
    return result;
  }

  setEnergyBaseline(ccpId, baseline) {
    this.energyBaselines.set(ccpId, {
      ...baseline,
      ccpId,
      updatedAt: new Date().toISOString()
    });
  }

  getEnergyBaseline(ccpId) {
    return this.energyBaselines.get(ccpId) || null;
  }

  getAllEnergyBaselines() {
    return Array.from(this.energyBaselines.values());
  }

  addEnergyAnomalyEvent(event) {
    const id = this.generateId('energyAnomaly');
    const now = new Date().toISOString();
    const eventWithId = {
      ...event,
      id,
      status: 'open',
      createdAt: now,
      acknowledgedAt: null,
      linkedWarnings: []
    };
    this.energyAnomalyEvents.set(id, eventWithId);
    return eventWithId;
  }

  getEnergyAnomalyEvent(id) {
    return this.energyAnomalyEvents.get(id) || null;
  }

  getAllEnergyAnomalyEvents() {
    return Array.from(this.energyAnomalyEvents.values());
  }

  getOpenEnergyAnomalies() {
    return Array.from(this.energyAnomalyEvents.values()).filter(e => e.status === 'open');
  }

  getEnergyAnomaliesByCCP(ccpId) {
    return Array.from(this.energyAnomalyEvents.values()).filter(e => e.ccpId === ccpId);
  }

  getOpenEnergyAnomalyForCCP(ccpId) {
    return Array.from(this.energyAnomalyEvents.values())
      .find(e => e.ccpId === ccpId && e.status === 'open');
  }

  acknowledgeEnergyAnomaly(id) {
    const event = this.energyAnomalyEvents.get(id);
    if (!event) return null;
    const updated = { ...event, status: 'acknowledged', acknowledgedAt: new Date().toISOString() };
    this.energyAnomalyEvents.set(id, updated);
    return updated;
  }

  closeEnergyAnomaly(id, closeReason = 'auto_recovered') {
    const event = this.energyAnomalyEvents.get(id);
    if (!event) return null;
    const updated = { ...event, status: 'closed', closedAt: new Date().toISOString(), closeReason };
    this.energyAnomalyEvents.set(id, updated);
    return updated;
  }

  addLinkedWarningToAnomaly(anomalyId, warning) {
    const event = this.energyAnomalyEvents.get(anomalyId);
    if (!event) return null;
    event.linkedWarnings.push({ ...warning, createdAt: new Date().toISOString() });
    this.energyAnomalyEvents.set(anomalyId, event);
    return event;
  }

  setLineCorrelation(lineA, lineB, correlation, dataValid = true) {
    const key = [lineA, lineB].sort().join('||');
    const isSharedColdSource = dataValid && correlation >= this.energyConfig.correlationThreshold;
    this.lineCorrelations.set(key, {
      lineA: [lineA, lineB].sort()[0],
      lineB: [lineA, lineB].sort()[1],
      correlation,
      dataValid,
      isSharedColdSource,
      calculatedAt: new Date().toISOString()
    });
    if (isSharedColdSource) {
      this.sharedColdSourcePairs.add(key);
    } else {
      this.sharedColdSourcePairs.delete(key);
    }
  }

  getLineCorrelation(lineA, lineB) {
    const key = [lineA, lineB].sort().join('||');
    return this.lineCorrelations.get(key) || null;
  }

  getAllLineCorrelations() {
    return Array.from(this.lineCorrelations.values());
  }

  getSharedColdSourcePairs() {
    return Array.from(this.sharedColdSourcePairs).map(key => {
      const [lineA, lineB] = key.split('||');
      return { lineA, lineB, correlation: this.lineCorrelations.get(key)?.correlation || 0 };
    });
  }

  getLinkedLines(productionLine) {
    const linked = [];
    for (const key of this.sharedColdSourcePairs) {
      const [lineA, lineB] = key.split('||');
      if (lineA === productionLine) linked.push(lineB);
      if (lineB === productionLine) linked.push(lineA);
    }
    return linked;
  }

  getEnergyConfig() {
    return { ...this.energyConfig };
  }

  updateEnergyConfig(config) {
    this.energyConfig = { ...this.energyConfig, ...config };
    return this.getEnergyConfig();
  }
}

const store = new DataStore();
module.exports = store;
