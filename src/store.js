class DataStore {
  constructor() {
    this.ccps = new Map();
    this.readings = new Map();
    this.deviations = new Map();
    this.correctiveActions = new Map();
    this.offlineAlerts = new Map();
    this.productionLines = new Set();
    this.nextCcpId = 1;
    this.nextReadingId = 1;
    this.nextDeviationId = 1;
    this.nextActionId = 1;
    this.nextOfflineAlertId = 1;
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
      default:
        return Date.now();
    }
  }

  addCCP(ccp) {
    const id = this.generateId('ccp');
    const ccpWithId = { ...ccp, id, status: 'normal', isActive: true, lastReadingTime: null };
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
    const durationSeconds = Math.round((end - start) / 1000);
    return this.updateOfflineAlert(id, {
      status: 'resolved',
      resolvedAt,
      durationSeconds
    });
  }
}

const store = new DataStore();
module.exports = store;
