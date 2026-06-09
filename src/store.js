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
    const deviationWithId = { ...deviation, id, status: 'open', createdAt: new Date().toISOString(), escalatedAt: null, closedAt: null, closeReason: null, closedBy: null, actions: [] };
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

  getDeviationsForBatch(batch) {
    const lineCCPIds = this.getCCPsByProductionLine(batch.productionLine).map(c => c.id);
    const batchStart = new Date(batch.startTime).getTime();
    const batchEnd = batch.endTime ? new Date(batch.endTime).getTime() : Date.now();
    return this.getAllDeviations().filter(d => {
      if (!lineCCPIds.includes(d.ccpId)) return false;
      const devTime = new Date(d.createdAt).getTime();
      return devTime >= batchStart && devTime <= batchEnd;
    });
  }
}

const store = new DataStore();
module.exports = store;
