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
    this.sopDefinitions = new Map();
    this.nextSopDefId = 1;
    this.sopExecutions = new Map();
    this.nextSopExecId = 1;
    this.sopTimeoutAlerts = new Map();
    this.nextSopTimeoutAlertId = 1;
    this.defaultSOPs = {
      'deviation_close_minor': {
        name: '轻微偏差关闭流程',
        description: '轻微偏差只需确认后关闭',
        steps: [
          { stepIndex: 1, name: '确认偏差', actionType: 'confirm', description: '操作员确认偏差已自动恢复', timeLimitMinutes: 30, preconditions: [], requiredRole: null },
          { stepIndex: 2, name: '关闭偏差', actionType: 'confirm', description: '确认关闭偏差记录', timeLimitMinutes: 10, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null }
        ]
      },
      'deviation_close_moderate': {
        name: '一般偏差关闭流程',
        description: '一般偏差需现场确认+纠偏操作',
        steps: [
          { stepIndex: 1, name: '现场确认', actionType: 'confirm', description: '操作员到达现场确认偏差情况', timeLimitMinutes: 15, preconditions: [], requiredRole: null },
          { stepIndex: 2, name: '纠偏操作', actionType: 'number_input', description: '执行纠偏操作并记录数据', timeLimitMinutes: 30, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null },
          { stepIndex: 3, name: '主管签批', actionType: 'supervisor_approval', description: '主管审核确认纠偏结果', timeLimitMinutes: 60, preconditions: [{ type: 'previous_step_completed', stepIndex: 2 }], requiredRole: 'supervisor' }
        ]
      },
      'deviation_close_critical': {
        name: '严重偏差关闭流程',
        description: '严重偏差需现场确认→纠偏操作→主管签批',
        steps: [
          { stepIndex: 1, name: '现场确认', actionType: 'photo_upload', description: '到达现场拍照确认偏差情况', timeLimitMinutes: 10, preconditions: [{ type: 'within_minutes_of_event', minutes: 30 }], requiredRole: null },
          { stepIndex: 2, name: '纠偏操作', actionType: 'number_input', description: '执行应急纠偏并记录数据', timeLimitMinutes: 20, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null },
          { stepIndex: 3, name: '主管签批', actionType: 'supervisor_approval', description: '主管审核确认纠偏结果', timeLimitMinutes: 30, preconditions: [{ type: 'previous_step_completed', stepIndex: 2 }], requiredRole: 'supervisor' }
        ]
      },
      'deviation_close_severe': {
        name: '致命偏差关闭流程',
        description: '致命偏差需紧急确认→应急纠偏→主管签批→总监签批',
        steps: [
          { stepIndex: 1, name: '紧急现场确认', actionType: 'photo_upload', description: '10分钟内到达现场拍照确认', timeLimitMinutes: 10, preconditions: [{ type: 'within_minutes_of_event', minutes: 10 }], requiredRole: null },
          { stepIndex: 2, name: '应急纠偏', actionType: 'number_input', description: '执行应急纠偏并记录关键数据', timeLimitMinutes: 15, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null },
          { stepIndex: 3, name: '主管签批', actionType: 'supervisor_approval', description: '主管审核确认', timeLimitMinutes: 15, preconditions: [{ type: 'previous_step_completed', stepIndex: 2 }], requiredRole: 'supervisor' },
          { stepIndex: 4, name: '总监签批', actionType: 'supervisor_approval', description: '质量总监最终审核', timeLimitMinutes: 30, preconditions: [{ type: 'previous_step_completed', stepIndex: 3 }], requiredRole: 'director' }
        ]
      },
      'calibration_record': {
        name: '校准记录流程',
        description: '录入校准记录需确认+录入数据+主管签批',
        steps: [
          { stepIndex: 1, name: '确认校准环境', actionType: 'confirm', description: '确认校准环境符合要求', timeLimitMinutes: 15, preconditions: [{ type: 'ccp_status', status: 'normal' }], requiredRole: null },
          { stepIndex: 2, name: '录入校准数据', actionType: 'number_input', description: '录入标准值和实测值', timeLimitMinutes: 10, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null },
          { stepIndex: 3, name: '主管确认', actionType: 'supervisor_approval', description: '主管确认校准数据有效性', timeLimitMinutes: 60, preconditions: [{ type: 'previous_step_completed', stepIndex: 2 }], requiredRole: 'supervisor' }
        ]
      },
      'recall_execute': {
        name: '召回执行流程',
        description: '执行产品召回需确认→隔离→主管签批',
        steps: [
          { stepIndex: 1, name: '确认召回范围', actionType: 'confirm', description: '确认受影响产品批次和范围', timeLimitMinutes: 30, preconditions: [], requiredRole: null },
          { stepIndex: 2, name: '隔离受影响产品', actionType: 'photo_upload', description: '拍照记录隔离措施', timeLimitMinutes: 60, preconditions: [{ type: 'previous_step_completed', stepIndex: 1 }], requiredRole: null },
          { stepIndex: 3, name: '主管签批', actionType: 'supervisor_approval', description: '主管确认召回执行到位', timeLimitMinutes: 60, preconditions: [{ type: 'previous_step_completed', stepIndex: 2 }], requiredRole: 'supervisor' }
        ]
      }
    };
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
      case 'sopDef':
        return `SOP${String(this.nextSopDefId++).padStart(4, '0')}`;
      case 'sopExec':
        return `SOP_EX${String(this.nextSopExecId++).padStart(6, '0')}`;
      case 'sopTimeoutAlert':
        return `SOP_TA${String(this.nextSopTimeoutAlertId++).padStart(6, '0')}`;
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

  addSOPDefinition(sop) {
    const id = this.generateId('sopDef');
    const now = new Date().toISOString();
    const steps = (sop.steps || []).map((step, idx) => ({
      stepIndex: idx + 1,
      name: step.name || `步骤${idx + 1}`,
      actionType: step.actionType || 'confirm',
      description: step.description || '',
      timeLimitMinutes: step.timeLimitMinutes || 30,
      preconditions: step.preconditions || [],
      requiredRole: step.requiredRole || null
    }));
    const def = {
      id,
      name: sop.name,
      description: sop.description || '',
      scene: sop.scene,
      steps,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    this.sopDefinitions.set(id, def);
    return def;
  }

  getSOPDefinition(id) {
    return this.sopDefinitions.get(id) || null;
  }

  getAllSOPDefinitions() {
    return Array.from(this.sopDefinitions.values());
  }

  getSOPDefinitionsByScene(scene) {
    return Array.from(this.sopDefinitions.values()).filter(d => d.scene === scene);
  }

  getActiveSOPDefinitionByScene(scene) {
    return Array.from(this.sopDefinitions.values()).find(d => d.scene === scene && d.isActive);
  }

  updateSOPDefinition(id, updates) {
    const def = this.sopDefinitions.get(id);
    if (!def) return null;
    const updated = { ...def, ...updates, updatedAt: new Date().toISOString() };
    this.sopDefinitions.set(id, updated);
    return updated;
  }

  deleteSOPDefinition(id) {
    return this.sopDefinitions.delete(id);
  }

  initializeDefaultSOPs() {
    for (const [scene, sop] of Object.entries(this.defaultSOPs)) {
      const existing = this.getActiveSOPDefinitionByScene(scene);
      if (!existing) {
        this.addSOPDefinition({
          name: sop.name,
          description: sop.description,
          scene,
          steps: sop.steps
        });
      }
    }
  }

  getSOPForScene(scene) {
    const custom = this.getActiveSOPDefinitionByScene(scene);
    if (custom) return custom;
    const defaultSOP = this.defaultSOPs[scene];
    if (!defaultSOP) return null;
    return {
      id: `DEFAULT_${scene}`,
      name: defaultSOP.name,
      description: defaultSOP.description,
      scene,
      steps: defaultSOP.steps,
      isActive: true,
      isDefault: true
    };
  }

  getSceneForDeviationClose(deviationLevel) {
    const map = {
      minor: 'deviation_close_minor',
      moderate: 'deviation_close_moderate',
      critical: 'deviation_close_critical',
      severe: 'deviation_close_severe'
    };
    return map[deviationLevel] || 'deviation_close_moderate';
  }

  createSOPExecution(params) {
    const { sopDefinitionId, sopName, scene, referenceType, referenceId, ccpId, operator, eventTime } = params;
    const sop = this.getSOPForScene(scene);
    if (!sop) return null;

    const id = this.generateId('sopExec');
    const now = new Date().toISOString();
    const refTime = eventTime ? new Date(eventTime).getTime() : Date.now();

    const steps = sop.steps.map(step => {
      const startedAt = step.stepIndex === 1 ? now : null;
      const deadline = (step.stepIndex === 1 && step.timeLimitMinutes)
        ? new Date(refTime + step.timeLimitMinutes * 60 * 1000).toISOString()
        : null;
      return {
        stepIndex: step.stepIndex,
        name: step.name,
        actionType: step.actionType,
        description: step.description,
        timeLimitMinutes: step.timeLimitMinutes,
        preconditions: step.preconditions,
        requiredRole: step.requiredRole,
        status: step.stepIndex === 1 ? 'in_progress' : 'pending',
        startedAt,
        completedAt: null,
        completedBy: null,
        inputData: null,
        deadline,
        isOverdue: false
      };
    });

    const execution = {
      id,
      sopDefinitionId: sopDefinitionId || sop.id,
      sopName: sopName || sop.name,
      scene,
      referenceType,
      referenceId,
      ccpId: ccpId || null,
      status: 'in_progress',
      currentStepIndex: 1,
      steps,
      startedAt: now,
      completedAt: null,
      timeoutAlerts: [],
      createdBy: operator || 'system',
      createdAt: now,
      eventTime: eventTime || now
    };
    this.sopExecutions.set(id, execution);
    return execution;
  }

  getSOPExecution(id) {
    return this.sopExecutions.get(id) || null;
  }

  getAllSOPExecutions() {
    return Array.from(this.sopExecutions.values());
  }

  getSOPExecutionsByReference(referenceType, referenceId) {
    return Array.from(this.sopExecutions.values()).filter(
      e => e.referenceType === referenceType && e.referenceId === referenceId
    );
  }

  getActiveSOPExecutionByReference(referenceType, referenceId) {
    return Array.from(this.sopExecutions.values()).find(
      e => e.referenceType === referenceType && e.referenceId === referenceId && e.status === 'in_progress'
    );
  }

  getSOPExecutionsByOperator(operator) {
    return Array.from(this.sopExecutions.values()).filter(
      e => e.status === 'in_progress' && e.steps.some(s => s.status === 'in_progress' && (s.completedBy === operator || !s.completedBy))
    );
  }

  getPendingSOPStepsForOperator(operator) {
    const executions = this.getAllSOPExecutions();
    const pending = [];
    for (const exec of executions) {
      if (exec.status !== 'in_progress') continue;
      const currentStep = exec.steps.find(s => s.stepIndex === exec.currentStepIndex);
      if (!currentStep || currentStep.status !== 'in_progress') continue;
      pending.push({
        executionId: exec.id,
        sopName: exec.sopName,
        scene: exec.scene,
        referenceType: exec.referenceType,
        referenceId: exec.referenceId,
        ccpId: exec.ccpId,
        stepIndex: currentStep.stepIndex,
        stepName: currentStep.name,
        actionType: currentStep.actionType,
        description: currentStep.description,
        timeLimitMinutes: currentStep.timeLimitMinutes,
        deadline: currentStep.deadline,
        isOverdue: currentStep.isOverdue,
        requiredRole: currentStep.requiredRole,
        startedAt: currentStep.startedAt,
        createdBy: exec.createdBy
      });
    }
    pending.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return 0;
    });
    return pending;
  }

  checkStepPreconditions(executionId, stepIndex) {
    const exec = this.sopExecutions.get(executionId);
    if (!exec) return { passed: false, reason: 'SOP执行实例不存在' };
    const step = exec.steps.find(s => s.stepIndex === stepIndex);
    if (!step) return { passed: false, reason: '步骤不存在' };

    for (const cond of step.preconditions) {
      switch (cond.type) {
        case 'previous_step_completed': {
          const prevStep = exec.steps.find(s => s.stepIndex === cond.stepIndex);
          if (!prevStep || prevStep.status !== 'completed') {
            return { passed: false, reason: `前置步骤${cond.stepIndex}未完成`, blockedAtStep: cond.stepIndex };
          }
          break;
        }
        case 'within_minutes_of_event': {
          const eventMs = new Date(exec.eventTime).getTime();
          const elapsed = (Date.now() - eventMs) / 60000;
          if (elapsed > cond.minutes) {
            return { passed: false, reason: `已超过事件发生后${cond.minutes}分钟的时限（已过${elapsed.toFixed(1)}分钟）` };
          }
          break;
        }
        case 'ccp_status': {
          if (!exec.ccpId) break;
          const ccp = this.ccps.get(exec.ccpId);
          if (!ccp) {
            return { passed: false, reason: `CCP ${exec.ccpId} 不存在` };
          }
          if (ccp.status !== cond.status) {
            return { passed: false, reason: `CCP当前状态为${ccp.status}，要求状态为${cond.status}` };
          }
          break;
        }
      }
    }
    return { passed: true };
  }

  completeSOPStep(executionId, stepIndex, operator, inputData) {
    const exec = this.sopExecutions.get(executionId);
    if (!exec) return null;
    if (exec.status !== 'in_progress') return null;
    if (exec.currentStepIndex !== stepIndex) return null;

    const step = exec.steps.find(s => s.stepIndex === stepIndex);
    if (!step || step.status !== 'in_progress') return null;

    const precondition = this.checkStepPreconditions(executionId, stepIndex);
    if (!precondition.passed) {
      return { error: precondition.reason, blockedAtStep: precondition.blockedAtStep };
    }

    const now = new Date().toISOString();
    step.status = 'completed';
    step.completedAt = now;
    step.completedBy = operator;
    if (inputData !== undefined && inputData !== null) {
      step.inputData = inputData;
    }

    const allCompleted = exec.steps.every(s => s.status === 'completed');
    if (allCompleted) {
      exec.status = 'completed';
      exec.completedAt = now;
      exec.currentStepIndex = stepIndex;
    } else {
      const nextStepIndex = stepIndex + 1;
      const nextStep = exec.steps.find(s => s.stepIndex === nextStepIndex);
      if (nextStep) {
        nextStep.status = 'in_progress';
        nextStep.startedAt = now;
        if (nextStep.timeLimitMinutes) {
          nextStep.deadline = new Date(Date.now() + nextStep.timeLimitMinutes * 60 * 1000).toISOString();
        }
        exec.currentStepIndex = nextStepIndex;
      }
    }

    this.sopExecutions.set(executionId, exec);
    return exec;
  }

  checkSOPCompliance(scene, referenceType, referenceId) {
    const executions = this.getSOPExecutionsByReference(referenceType, referenceId);
    const activeExec = executions.find(e => e.status === 'in_progress');
    const completedExec = executions.find(e => e.status === 'completed');

    if (!activeExec && !completedExec) {
      return { compliant: false, reason: '该操作没有关联的SOP执行实例，需先启动SOP流程', requiresSOP: true, scene };
    }
    if (completedExec) {
      return { compliant: true, executionId: completedExec.id };
    }
    const currentStep = activeExec.steps.find(s => s.stepIndex === activeExec.currentStepIndex);
    return {
      compliant: false,
      reason: `SOP流程未完成，当前卡在步骤${activeExec.currentStepIndex}: ${currentStep ? currentStep.name : '未知'}`,
      executionId: activeExec.id,
      sopName: activeExec.sopName,
      currentStepIndex: activeExec.currentStepIndex,
      currentStepName: currentStep ? currentStep.name : '',
      currentStepActionType: currentStep ? currentStep.actionType : '',
      totalSteps: activeExec.steps.length,
      completedSteps: activeExec.steps.filter(s => s.status === 'completed').length,
      requiresSOP: false
    };
  }

  markSOPStepTimeout(executionId, stepIndex) {
    const exec = this.sopExecutions.get(executionId);
    if (!exec) return null;
    const step = exec.steps.find(s => s.stepIndex === stepIndex);
    if (!step || step.status !== 'in_progress') return null;
    if (step.isOverdue) return null;

    const now = new Date().toISOString();
    step.isOverdue = true;
    step.status = 'timed_out';

    const alert = this.createSOPTimeoutAlert(exec, step);

    exec.timeoutAlerts.push({
      stepIndex,
      stepName: step.name,
      alertedAt: now,
      alertId: alert.id
    });

    this.sopExecutions.set(executionId, exec);
    return { execution: exec, alert };
  }

  createSOPTimeoutAlert(execution, step) {
    const id = this.generateId('sopTimeoutAlert');
    const now = new Date().toISOString();
    const ccp = execution.ccpId ? this.ccps.get(execution.ccpId) : null;
    const alert = {
      id,
      executionId: execution.id,
      sopName: execution.sopName,
      scene: execution.scene,
      referenceType: execution.referenceType,
      referenceId: execution.referenceId,
      ccpId: execution.ccpId,
      ccpName: ccp ? ccp.name : '',
      stepIndex: step.stepIndex,
      stepName: step.name,
      actionType: step.actionType,
      deadline: step.deadline,
      status: 'active',
      alertedAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null
    };
    this.sopTimeoutAlerts.set(id, alert);
    return alert;
  }

  checkSOPStepTimeouts() {
    const now = Date.now();
    const results = [];
    const executions = Array.from(this.sopExecutions.values()).filter(e => e.status === 'in_progress');

    for (const exec of executions) {
      const currentStep = exec.steps.find(s => s.stepIndex === exec.currentStepIndex);
      if (!currentStep || currentStep.status !== 'in_progress' || !currentStep.deadline) continue;
      if (now > new Date(currentStep.deadline).getTime() && !currentStep.isOverdue) {
        const result = this.markSOPStepTimeout(exec.id, currentStep.stepIndex);
        if (result) results.push(result);
      }
    }
    return results;
  }

  getSOPTimeoutAlerts(status) {
    const alerts = Array.from(this.sopTimeoutAlerts.values());
    if (status) return alerts.filter(a => a.status === status);
    return alerts;
  }

  acknowledgeSOPTimeoutAlert(alertId, operator) {
    const alert = this.sopTimeoutAlerts.get(alertId);
    if (!alert) return null;
    const now = new Date().toISOString();
    const updated = { ...alert, status: 'acknowledged', acknowledgedAt: now, acknowledgedBy: operator };
    this.sopTimeoutAlerts.set(alertId, updated);
    return updated;
  }

  cancelSOPExecution(executionId, reason, operator) {
    const exec = this.sopExecutions.get(executionId);
    if (!exec) return null;
    if (exec.status === 'completed' || exec.status === 'cancelled') return null;
    const now = new Date().toISOString();
    exec.status = 'cancelled';
    exec.completedAt = now;
    exec.cancelReason = reason || '';
    exec.cancelledBy = operator || '';
    this.sopExecutions.set(executionId, exec);
    return exec;
  }

  getSOPExecutionStatistics(scene, startTime, endTime) {
    let executions = this.getAllSOPExecutions();

    if (scene) {
      executions = executions.filter(e => e.scene === scene);
    }
    if (startTime) {
      const startMs = new Date(startTime).getTime();
      executions = executions.filter(e => new Date(e.createdAt).getTime() >= startMs);
    }
    if (endTime) {
      const endMs = new Date(endTime).getTime();
      executions = executions.filter(e => new Date(e.createdAt).getTime() <= endMs);
    }

    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const inProgress = executions.filter(e => e.status === 'in_progress').length;
    const cancelled = executions.filter(e => e.status === 'cancelled').length;
    const timedOutExecutions = executions.filter(e => e.timeoutAlerts.length > 0);

    const stepStats = {};
    for (const exec of executions) {
      for (const step of exec.steps) {
        const key = `${step.stepIndex}:${step.name}`;
        if (!stepStats[key]) {
          stepStats[key] = {
            stepIndex: step.stepIndex,
            stepName: step.name,
            actionType: step.actionType,
            totalOccurrences: 0,
            completedCount: 0,
            timedOutCount: 0,
            totalDurationMinutes: 0,
            durations: []
          };
        }
        const stat = stepStats[key];
        stat.totalOccurrences++;
        if (step.status === 'completed') {
          stat.completedCount++;
          if (step.startedAt && step.completedAt) {
            const dur = (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 60000;
            stat.totalDurationMinutes += dur;
            stat.durations.push(dur);
          }
        }
        if (step.isOverdue) {
          stat.timedOutCount++;
        }
      }
    }

    const stepAnalysis = Object.values(stepStats).map(stat => {
      const avgDuration = stat.completedCount > 0 ? stat.totalDurationMinutes / stat.completedCount : 0;
      const sorted = stat.durations.sort((a, b) => a - b);
      const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
      const timeoutRate = stat.totalOccurrences > 0 ? stat.timedOutCount / stat.totalOccurrences : 0;
      return {
        stepIndex: stat.stepIndex,
        stepName: stat.stepName,
        actionType: stat.actionType,
        totalOccurrences: stat.totalOccurrences,
        completedCount: stat.completedCount,
        timedOutCount: stat.timedOutCount,
        timeoutRate: parseFloat(timeoutRate.toFixed(4)),
        avgDurationMinutes: parseFloat(avgDuration.toFixed(2)),
        p50DurationMinutes: parseFloat(p50.toFixed(2)),
        p95DurationMinutes: parseFloat(p95.toFixed(2))
      };
    });

    stepAnalysis.sort((a, b) => b.avgDurationMinutes - a.avgDurationMinutes);
    const bottleneckStep = stepAnalysis.length > 0 ? stepAnalysis[0] : null;
    const highestTimeoutStep = [...stepAnalysis].sort((a, b) => b.timeoutRate - a.timeoutRate)[0] || null;

    const sceneBreakdown = {};
    for (const exec of executions) {
      if (!sceneBreakdown[exec.scene]) {
        sceneBreakdown[exec.scene] = { total: 0, completed: 0, timedOut: 0 };
      }
      sceneBreakdown[exec.scene].total++;
      if (exec.status === 'completed') sceneBreakdown[exec.scene].completed++;
      if (exec.timeoutAlerts.length > 0) sceneBreakdown[exec.scene].timedOut++;
    }

    return {
      summary: {
        total,
        completed,
        inProgress,
        cancelled,
        timedOut: timedOutExecutions.length,
        completionRate: total > 0 ? parseFloat((completed / total).toFixed(4)) : 0,
        timeoutRate: total > 0 ? parseFloat((timedOutExecutions.length / total).toFixed(4)) : 0
      },
      stepAnalysis,
      bottleneckStep,
      highestTimeoutStep,
      sceneBreakdown
    };
  }
}

const store = new DataStore();
module.exports = store;
