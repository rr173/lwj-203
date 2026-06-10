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
    this.ccpGroups = new Map();
    this.nextCCPGroupId = 1;
    this.groupAlerts = new Map();
    this.nextGroupAlertId = 1;
    this.workOrders = new Map();
    this.nextWorkOrderId = 1;
    this.workOrderTimeoutAlerts = new Map();
    this.nextTimeoutAlertId = 1;
    this.workOrderTemplates = {
      minor: {
        name: '轻微偏差简易模板',
        description: '适用于轻微偏差，1步确认即可',
        timeLimitMinutes: 60,
        defaultAssignee: '值班操作员',
        requiresReview: false,
        steps: [
          { description: '确认偏差已自动恢复，记录确认人', completed: false }
        ]
      },
      moderate: {
        name: '一般偏差标准模板',
        description: '适用于一般偏差，2步操作+复核',
        timeLimitMinutes: 120,
        defaultAssignee: '现场工程师',
        requiresReview: true,
        reviewer: '当班主管',
        steps: [
          { description: '到达现场确认偏差情况，记录初始数据', completed: false },
          { description: '执行纠偏操作，使参数恢复至合规范围', completed: false }
        ]
      },
      critical: {
        name: '严重偏差完整模板',
        description: '适用于严重偏差，3步操作+主管复核',
        timeLimitMinutes: 90,
        defaultAssignee: '高级工程师',
        requiresReview: true,
        reviewer: '生产经理',
        steps: [
          { description: '立即到达现场，评估偏差影响范围和风险等级', completed: false },
          { description: '执行应急纠偏措施，必要时暂停相关生产环节', completed: false },
          { description: '排查根本原因，制定预防措施并记录', completed: false }
        ]
      },
      severe: {
        name: '致命偏差紧急模板',
        description: '适用于致命偏差，紧急响应+多级复核',
        timeLimitMinutes: 30,
        defaultAssignee: '技术总监',
        requiresReview: true,
        reviewer: '质量总监',
        steps: [
          { description: '10分钟内到达现场，启动应急预案，通知管理层', completed: false },
          { description: '立即执行紧急纠偏，隔离受影响产品批次', completed: false },
          { description: '组织跨部门评审，评估质量风险并决定处置方案', completed: false }
        ]
      }
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
      case 'ccpGroup':
        return `GRP${String(this.nextCCPGroupId++).padStart(4, '0')}`;
      case 'groupAlert':
        return `GA${String(this.nextGroupAlertId++).padStart(6, '0')}`;
      case 'workOrder':
        return `WO${String(this.nextWorkOrderId++).padStart(6, '0')}`;
      case 'timeoutAlert':
        return `TOA${String(this.nextTimeoutAlertId++).padStart(6, '0')}`;
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

  addCCPGroup(group) {
    const id = this.generateId('ccpGroup');
    const now = new Date().toISOString();
    const groupWithId = {
      id,
      name: group.name,
      productionLine: group.productionLine,
      ccpIds: group.ccpIds || [],
      rule: {
        thresholdCount: group.rule?.thresholdCount || 2,
        escalationMinutes: group.rule?.escalationMinutes || 30
      },
      createdAt: now,
      updatedAt: now
    };
    this.ccpGroups.set(id, groupWithId);
    return groupWithId;
  }

  getCCPGroup(id) {
    return this.ccpGroups.get(id);
  }

  getAllCCPGroups() {
    return Array.from(this.ccpGroups.values());
  }

  getCCPGroupsByProductionLine(productionLine) {
    return Array.from(this.ccpGroups.values()).filter(g => g.productionLine === productionLine);
  }

  getCCPGroupsForCCP(ccpId) {
    return Array.from(this.ccpGroups.values()).filter(g => g.ccpIds.includes(ccpId));
  }

  updateCCPGroup(id, updates) {
    const group = this.ccpGroups.get(id);
    if (!group) return null;
    const updated = {
      ...group,
      name: updates.name !== undefined ? updates.name : group.name,
      ccpIds: updates.ccpIds !== undefined ? updates.ccpIds : group.ccpIds,
      rule: updates.rule ? { ...group.rule, ...updates.rule } : group.rule,
      updatedAt: new Date().toISOString()
    };
    this.ccpGroups.set(id, updated);
    return updated;
  }

  deleteCCPGroup(id) {
    return this.ccpGroups.delete(id);
  }

  addGroupAlert(alert) {
    const id = this.generateId('groupAlert');
    const now = new Date().toISOString();
    const alertWithId = {
      id,
      groupId: alert.groupId,
      groupName: alert.groupName,
      productionLine: alert.productionLine,
      status: 'active',
      deviatingCCPIds: alert.deviatingCCPIds || [],
      deviatingCCPDetails: alert.deviatingCCPDetails || [],
      thresholdCount: alert.thresholdCount,
      triggeredAt: now,
      escalatedAt: null,
      resolvedAt: null,
      durationMs: null,
      wasEscalated: false
    };
    this.groupAlerts.set(id, alertWithId);
    return alertWithId;
  }

  getGroupAlert(id) {
    return this.groupAlerts.get(id);
  }

  getAllGroupAlerts() {
    return Array.from(this.groupAlerts.values());
  }

  getActiveGroupAlertForGroup(groupId) {
    return Array.from(this.groupAlerts.values()).find(a => a.groupId === groupId && a.status === 'active');
  }

  getGroupAlertsByGroup(groupId) {
    return Array.from(this.groupAlerts.values()).filter(a => a.groupId === groupId);
  }

  getGroupAlertsByProductionLine(productionLine) {
    return Array.from(this.groupAlerts.values()).filter(a => a.productionLine === productionLine);
  }

  getActiveGroupAlerts() {
    return Array.from(this.groupAlerts.values()).filter(a => a.status === 'active');
  }

  updateGroupAlert(id, updates) {
    const alert = this.groupAlerts.get(id);
    if (!alert) return null;
    const updated = { ...alert, ...updates };
    this.groupAlerts.set(id, updated);
    return updated;
  }

  escalateGroupAlert(id) {
    const alert = this.groupAlerts.get(id);
    if (!alert || alert.status !== 'active') return null;
    const now = new Date().toISOString();
    const updated = {
      ...alert,
      status: 'escalated',
      escalatedAt: now,
      wasEscalated: true
    };
    this.groupAlerts.set(id, updated);
    return updated;
  }

  resolveGroupAlert(id) {
    const alert = this.groupAlerts.get(id);
    if (!alert || (alert.status !== 'active' && alert.status !== 'escalated')) return null;
    const now = new Date().toISOString();
    const triggeredMs = new Date(alert.triggeredAt).getTime();
    const resolvedMs = new Date(now).getTime();
    const durationMs = Math.max(0, resolvedMs - triggeredMs);
    const updated = {
      ...alert,
      status: 'resolved',
      resolvedAt: now,
      durationMs
    };
    this.groupAlerts.set(id, updated);
    return updated;
  }

  getGroupHealthStatus(groupId) {
    const group = this.ccpGroups.get(groupId);
    if (!group) return null;

    const activeAlert = this.getActiveGroupAlertForGroup(groupId);
    const ccpStatuses = group.ccpIds.map(ccpId => {
      const ccp = this.ccps.get(ccpId);
      if (!ccp) return { ccpId, name: '(已删除)', status: 'unknown', isDeviating: false };
      const openDeviation = this.getOpenDeviationForCCP(ccpId);
      return {
        ccpId,
        name: ccp.name,
        status: ccp.status,
        isDeviating: openDeviation !== null && openDeviation !== undefined,
        deviationLevel: openDeviation ? openDeviation.level : null
      };
    });

    const deviatingCount = ccpStatuses.filter(c => c.isDeviating).length;

    let healthStatus = 'normal';
    if (activeAlert && activeAlert.status === 'escalated') {
      healthStatus = 'escalated';
    } else if (activeAlert && activeAlert.status === 'active') {
      healthStatus = 'alerting';
    }

    return {
      groupId: group.id,
      groupName: group.name,
      productionLine: group.productionLine,
      healthStatus,
      totalCCPCount: group.ccpIds.length,
      deviatingCount,
      thresholdCount: group.rule.thresholdCount,
      escalationMinutes: group.rule.escalationMinutes,
      activeAlertId: activeAlert ? activeAlert.id : null,
      activeAlertTriggeredAt: activeAlert ? activeAlert.triggeredAt : null,
      activeAlertEscalatedAt: activeAlert ? activeAlert.escalatedAt : null,
      ccpStatuses
    };
  }

  getWorkOrderTemplate(level) {
    const templateMap = {
      minor: 'minor',
      moderate: 'moderate',
      critical: 'critical',
      severe: 'severe'
    };
    const templateKey = templateMap[level] || 'moderate';
    return JSON.parse(JSON.stringify(this.workOrderTemplates[templateKey]));
  }

  getAllWorkOrderTemplates() {
    return JSON.parse(JSON.stringify(this.workOrderTemplates));
  }

  createWorkOrderFromDeviation(deviation) {
    const ccp = this.getCCP(deviation.ccpId);
    const template = this.getWorkOrderTemplate(deviation.level);
    const now = new Date().toISOString();
    const id = this.generateId('workOrder');

    const steps = template.steps.map((step, idx) => ({
      stepIndex: idx + 1,
      description: step.description,
      completed: false,
      completedAt: null,
      completedBy: null
    }));

    const workOrder = {
      id,
      deviationId: deviation.id,
      deviationLevel: deviation.level,
      ccpId: deviation.ccpId,
      ccpName: ccp ? ccp.name : '',
      productionLine: ccp ? ccp.productionLine : '',
      templateName: template.name,
      description: `温控偏差处置工单 - ${ccp ? ccp.name : deviation.ccpId}`,
      status: 'pending_accept',
      assignee: deviation.assignee || template.defaultAssignee,
      reviewer: template.requiresReview ? template.reviewer : null,
      requiresReview: template.requiresReview,
      timeLimitMinutes: template.timeLimitMinutes,
      deadline: new Date(new Date(now).getTime() + template.timeLimitMinutes * 60 * 1000).toISOString(),
      acceptedAt: null,
      processingStartedAt: null,
      reviewStartedAt: null,
      closedAt: null,
      isOverdue: false,
      overdueAlertCreated: false,
      steps,
      createdAt: now,
      updatedAt: now,
      operationHistory: [
        {
          action: 'created',
          operator: 'system',
          timestamp: now,
          remark: `由偏差事件 ${deviation.id} 自动生成`
        }
      ]
    };

    this.workOrders.set(id, workOrder);
    return workOrder;
  }

  getWorkOrder(id) {
    return this.workOrders.get(id) || null;
  }

  getAllWorkOrders() {
    return Array.from(this.workOrders.values());
  }

  getOpenWorkOrders() {
    return Array.from(this.workOrders.values()).filter(
      wo => wo.status !== 'closed'
    );
  }

  getWorkOrdersByDeviation(deviationId) {
    return Array.from(this.workOrders.values()).filter(
      wo => wo.deviationId === deviationId
    );
  }

  getWorkOrdersByCCP(ccpId) {
    return Array.from(this.workOrders.values()).filter(
      wo => wo.ccpId === ccpId
    );
  }

  getWorkOrdersByAssignee(assignee) {
    return Array.from(this.workOrders.values()).filter(
      wo => wo.assignee === assignee
    );
  }

  getWorkOrdersByStatus(status) {
    return Array.from(this.workOrders.values()).filter(
      wo => wo.status === status
    );
  }

  updateWorkOrder(id, updates) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) return null;
    const updated = { ...workOrder, ...updates, updatedAt: new Date().toISOString() };
    this.workOrders.set(id, updated);
    return updated;
  }

  acceptWorkOrder(id, operator) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder || workOrder.status !== 'pending_accept') return null;
    const now = new Date().toISOString();
    const deadline = new Date(new Date(now).getTime() + workOrder.timeLimitMinutes * 60 * 1000).toISOString();
    const updated = {
      ...workOrder,
      status: 'processing',
      acceptedAt: now,
      processingStartedAt: now,
      deadline,
      updatedAt: now,
      operationHistory: [
        ...workOrder.operationHistory,
        { action: 'accepted', operator, timestamp: now, remark: '工单已接单，开始处置计时' }
      ]
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  completeWorkOrderStep(id, stepIndex, operator, remark) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder || workOrder.status !== 'processing') return null;
    const now = new Date().toISOString();
    const steps = workOrder.steps.map(step => {
      if (step.stepIndex === stepIndex && !step.completed) {
        return { ...step, completed: true, completedAt: now, completedBy: operator };
      }
      return step;
    });
    const allStepsCompleted = steps.every(s => s.completed);
    let newStatus = workOrder.status;
    let reviewStartedAt = workOrder.reviewStartedAt;
    const history = [
      ...workOrder.operationHistory,
      { action: 'step_completed', operator, timestamp: now, remark: `步骤${stepIndex}完成${remark ? ': ' + remark : ''}` }
    ];
    if (allStepsCompleted) {
      if (workOrder.requiresReview) {
        newStatus = 'pending_review';
        reviewStartedAt = now;
        history.push({ action: 'submitted_for_review', operator, timestamp: now, remark: '所有步骤完成，提交复核' });
      } else {
        newStatus = 'closed';
        history.push({ action: 'auto_closed', operator: 'system', timestamp: now, remark: '无需复核，工单自动关闭' });
      }
    }
    const updated = {
      ...workOrder,
      steps,
      status: newStatus,
      reviewStartedAt,
      closedAt: newStatus === 'closed' ? now : workOrder.closedAt,
      updatedAt: now,
      operationHistory: history
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  reviewWorkOrder(id, reviewer, passed, reviewRemark) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder || workOrder.status !== 'pending_review') return null;
    const now = new Date().toISOString();
    const history = [
      ...workOrder.operationHistory
    ];
    let newStatus = workOrder.status;
    let steps = workOrder.steps;
    if (passed) {
      newStatus = 'closed';
      history.push({
        action: 'review_passed',
        operator: reviewer,
        timestamp: now,
        remark: `复核通过${reviewRemark ? ': ' + reviewRemark : ''}`
      });
    } else {
      newStatus = 'processing';
      steps = steps.map(s => ({ ...s, completed: false, completedAt: null, completedBy: null }));
      history.push({
        action: 'review_rejected',
        operator: reviewer,
        timestamp: now,
        remark: `复核驳回，需重新处置${reviewRemark ? ': ' + reviewRemark : ''}`
      });
    }
    const updated = {
      ...workOrder,
      status: newStatus,
      steps,
      closedAt: newStatus === 'closed' ? now : null,
      updatedAt: now,
      operationHistory: history
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  closeWorkOrder(id, closedBy, closeReason) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder || workOrder.status === 'closed') return null;
    const now = new Date().toISOString();
    const updated = {
      ...workOrder,
      status: 'closed',
      closedAt: now,
      updatedAt: now,
      operationHistory: [
        ...workOrder.operationHistory,
        { action: 'closed', operator: closedBy, timestamp: now, remark: closeReason || '工单手动关闭' }
      ]
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  reassignWorkOrder(id, newAssignee, operator, reason) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) return null;
    const now = new Date().toISOString();
    const updated = {
      ...workOrder,
      assignee: newAssignee,
      updatedAt: now,
      operationHistory: [
        ...workOrder.operationHistory,
        { action: 'reassigned', operator, timestamp: now, remark: `转派给 ${newAssignee}${reason ? ': ' + reason : ''}` }
      ]
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  markWorkOrderOverdue(id) {
    const workOrder = this.workOrders.get(id);
    if (!workOrder || workOrder.status === 'closed' || workOrder.isOverdue) return null;
    const now = new Date().toISOString();
    const updated = {
      ...workOrder,
      isOverdue: true,
      overdueAlertCreated: true,
      updatedAt: now,
      operationHistory: [
        ...workOrder.operationHistory,
        { action: 'overdue', operator: 'system', timestamp: now, remark: '工单超过处置时限，标记为超时' }
      ]
    };
    this.workOrders.set(id, updated);
    const alert = this.createTimeoutAlert(updated);
    return { workOrder: updated, alert };
  }

  createTimeoutAlert(workOrder) {
    const id = this.generateId('timeoutAlert');
    const now = new Date().toISOString();
    const alert = {
      id,
      workOrderId: workOrder.id,
      deviationId: workOrder.deviationId,
      ccpId: workOrder.ccpId,
      ccpName: workOrder.ccpName,
      productionLine: workOrder.productionLine,
      assignee: workOrder.assignee,
      deviationLevel: workOrder.deviationLevel,
      deadline: workOrder.deadline,
      alertedAt: now,
      status: 'active',
      acknowledgedAt: null,
      acknowledgedBy: null
    };
    this.workOrderTimeoutAlerts.set(id, alert);
    return alert;
  }

  getTimeoutAlert(id) {
    return this.workOrderTimeoutAlerts.get(id) || null;
  }

  getAllTimeoutAlerts(status) {
    const alerts = Array.from(this.workOrderTimeoutAlerts.values());
    if (status) return alerts.filter(a => a.status === status);
    return alerts;
  }

  getTimeoutAlertsByWorkOrder(workOrderId) {
    return Array.from(this.workOrderTimeoutAlerts.values()).filter(
      a => a.workOrderId === workOrderId
    );
  }

  acknowledgeTimeoutAlert(id, operator) {
    const alert = this.workOrderTimeoutAlerts.get(id);
    if (!alert) return null;
    const now = new Date().toISOString();
    const updated = {
      ...alert,
      status: 'acknowledged',
      acknowledgedAt: now,
      acknowledgedBy: operator
    };
    this.workOrderTimeoutAlerts.set(id, updated);
    return updated;
  }

  getWorkOrdersWithRemainingTime() {
    const now = Date.now();
    return this.getOpenWorkOrders().map(wo => {
      const deadline = new Date(wo.deadline).getTime();
      let remainingMinutes = null;
      if (wo.status === 'processing' || wo.status === 'pending_review') {
        remainingMinutes = Math.max(0, Math.ceil((deadline - now) / 60000));
      }
      return { ...wo, remainingMinutes };
    }).sort((a, b) => {
      if (a.remainingMinutes === null && b.remainingMinutes === null) return 0;
      if (a.remainingMinutes === null) return 1;
      if (b.remainingMinutes === null) return -1;
      return a.remainingMinutes - b.remainingMinutes;
    });
  }

  getWorkOrderStatistics() {
    const allOrders = this.getAllWorkOrders();
    const closedOrders = allOrders.filter(wo => wo.status === 'closed');
    const total = allOrders.length;
    const closed = closedOrders.length;
    const overdue = allOrders.filter(wo => wo.isOverdue).length;
    const overdueRate = closed > 0 ? overdue / closed : 0;

    let totalProcessingMinutes = 0;
    let onTimeClosed = 0;
    closedOrders.forEach(wo => {
      if (wo.processingStartedAt && wo.closedAt) {
        const start = new Date(wo.processingStartedAt).getTime();
        const end = new Date(wo.closedAt).getTime();
        const duration = (end - start) / 60000;
        totalProcessingMinutes += duration;
        if (!wo.isOverdue) onTimeClosed++;
      }
    });

    const avgDurationMinutes = closed > 0 ? totalProcessingMinutes / closed : 0;

    const monthlyTrend = {};
    allOrders.forEach(wo => {
      const date = new Date(wo.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyTrend[monthKey]) {
        monthlyTrend[monthKey] = {
          month: monthKey,
          total: 0,
          closed: 0,
          overdue: 0,
          avgDurationMinutes: 0
        };
      }
      monthlyTrend[monthKey].total++;
      if (wo.status === 'closed') {
        monthlyTrend[monthKey].closed++;
        if (wo.processingStartedAt && wo.closedAt) {
          const dur = (new Date(wo.closedAt).getTime() - new Date(wo.processingStartedAt).getTime()) / 60000;
          monthlyTrend[monthKey].avgDurationMinutes += dur;
        }
      }
      if (wo.isOverdue) {
        monthlyTrend[monthKey].overdue++;
      }
    });

    const trendArray = Object.values(monthlyTrend).sort((a, b) => a.month.localeCompare(b.month));
    trendArray.forEach(t => {
      if (t.closed > 0) {
        t.avgDurationMinutes = parseFloat((t.avgDurationMinutes / t.closed).toFixed(2));
        t.overdueRate = parseFloat((t.overdue / t.total).toFixed(4));
      } else {
        t.overdueRate = t.total > 0 ? parseFloat((t.overdue / t.total).toFixed(4)) : 0;
      }
    });

    const byStatus = {
      pending_accept: allOrders.filter(wo => wo.status === 'pending_accept').length,
      processing: allOrders.filter(wo => wo.status === 'processing').length,
      pending_review: allOrders.filter(wo => wo.status === 'pending_review').length,
      closed: allOrders.filter(wo => wo.status === 'closed').length
    };

    const byLevel = {
      minor: allOrders.filter(wo => wo.deviationLevel === 'minor').length,
      moderate: allOrders.filter(wo => wo.deviationLevel === 'moderate').length,
      critical: allOrders.filter(wo => wo.deviationLevel === 'critical').length,
      severe: allOrders.filter(wo => wo.deviationLevel === 'severe').length
    };

    return {
      summary: {
        total,
        closed,
        open: total - closed,
        overdue,
        overdueRate: parseFloat(overdueRate.toFixed(4)),
        avgDurationMinutes: parseFloat(avgDurationMinutes.toFixed(2)),
        onTimeClosed,
        onTimeRate: closed > 0 ? parseFloat((onTimeClosed / closed).toFixed(4)) : 0
      },
      byStatus,
      byLevel,
      monthlyTrend: trendArray
    };
  }
}

const store = new DataStore();
module.exports = store;
