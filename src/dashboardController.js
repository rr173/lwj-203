const store = require('./store');

function getDashboardOverview(req, res) {
  const ccps = store.getAllCCPs();
  const offlineAlerts = store.getOpenOfflineAlerts();
  const offlineMap = new Map();

  for (const alert of offlineAlerts) {
    offlineMap.set(alert.ccpId, alert);
  }

  const lines = store.getAllProductionLines();
  const lineData = {};

  for (const line of lines) {
    lineData[line] = [];
  }

  let normalCount = 0;
  let minorCount = 0;
  let criticalCount = 0;
  let offlineCount = 0;

  for (const ccp of ccps) {
    const isOffline = offlineMap.has(ccp.id);
    const lastReading = store.getLastReading(ccp.id);
    const lastTemperature = lastReading ? lastReading.temperature : null;
    const lastReadingTime = lastReading ? lastReading.timestamp : null;

    let displayStatus = ccp.status || 'normal';
    if (isOffline) {
      displayStatus = 'offline';
      offlineCount++;
    } else if (displayStatus === 'critical') {
      criticalCount++;
    } else if (displayStatus === 'minor') {
      minorCount++;
    } else {
      normalCount++;
    }

    const ccpInfo = {
      id: ccp.id,
      name: ccp.name,
      productionLine: ccp.productionLine,
      status: displayStatus,
      lastTemperature,
      lastReadingTime,
      complianceMin: ccp.complianceMin,
      complianceMax: ccp.complianceMax,
      criticalMin: ccp.criticalMin,
      criticalMax: ccp.criticalMax,
      isActive: ccp.isActive,
    };

    if (ccp.productionLine && lineData[ccp.productionLine]) {
      lineData[ccp.productionLine].push(ccpInfo);
    } else if (ccp.productionLine) {
      lineData[ccp.productionLine] = [ccpInfo];
    }
  }

  const openDeviations = store.getOpenDeviations();
  const recentAlerts = offlineAlerts.slice(0, 10);

  res.json({
    summary: {
      total: ccps.length,
      normal: normalCount,
      minor: minorCount,
      critical: criticalCount,
      offline: offlineCount,
    },
    lines: lineData,
    openDeviations: openDeviations.map((d) => ({
      id: d.id,
      ccpId: d.ccpId,
      level: d.level,
      createdAt: d.createdAt,
      initialTemperature: d.initialTemperature,
    })),
    recentOfflineAlerts: recentAlerts.map((a) => ({
      id: a.id,
      ccpId: a.ccpId,
      ccpName: a.ccpName,
      productionLine: a.productionLine,
      createdAt: a.createdAt,
      lastReadingTime: a.lastReadingTime,
    })),
  });
}

module.exports = { getDashboardOverview };
