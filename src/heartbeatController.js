const store = require('./store');

function checkCCPHearbeat(ccp, now) {
  if (!ccp.isActive) {
    return null;
  }

  if (!ccp.lastReadingTime) {
    return null;
  }

  const lastReadingTime = new Date(ccp.lastReadingTime).getTime();
  const reportingIntervalMs = ccp.reportingFrequency * 1000;
  const thresholdMs = reportingIntervalMs * 3;
  const elapsedMs = now - lastReadingTime;

  if (elapsedMs > thresholdMs) {
    const openAlert = store.getOpenOfflineAlertForCCP(ccp.id);
    if (!openAlert) {
      const alert = store.addOfflineAlert({
        ccpId: ccp.id,
        ccpName: ccp.name,
        productionLine: ccp.productionLine,
        expectedIntervalSeconds: ccp.reportingFrequency,
        lastReadingTime: ccp.lastReadingTime
      });
      return { type: 'created', alert };
    }
  }

  return null;
}

function checkAllCCPsHeartbeat() {
  const now = Date.now();
  const ccps = store.getAllCCPs();
  const results = [];

  for (const ccp of ccps) {
    const result = checkCCPHearbeat(ccp, now);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

function handleCCPRecovered(ccpId, recoveryTime) {
  const openAlert = store.getOpenOfflineAlertForCCP(ccpId);
  if (openAlert) {
    const resolved = store.resolveOfflineAlert(openAlert.id, recoveryTime);
    return resolved;
  }
  return null;
}

function getMinReportingFrequency() {
  const ccps = store.getAllCCPs();
  if (ccps.length === 0) {
    return 10;
  }
  return Math.min(...ccps.map(c => c.reportingFrequency));
}

function getOfflineCCPs(req, res) {
  const openAlerts = store.getOpenOfflineAlerts();
  const offlineCCPs = openAlerts.map(alert => {
    const ccp = store.getCCP(alert.ccpId);
    return {
      ccpId: alert.ccpId,
      ccpName: alert.ccpName,
      productionLine: alert.productionLine,
      alertId: alert.id,
      offlineSince: alert.createdAt,
      lastReadingTime: alert.lastReadingTime,
      expectedIntervalSeconds: alert.expectedIntervalSeconds,
      offlineDurationSeconds: Math.round((Date.now() - new Date(alert.createdAt).getTime()) / 1000)
    };
  });
  res.json(offlineCCPs);
}

function getOfflineAlerts(req, res) {
  const { ccpId, productionLine, status, startTime, endTime } = req.query;
  let alerts = store.getAllOfflineAlerts();

  if (ccpId) {
    alerts = alerts.filter(a => a.ccpId === ccpId);
  }
  if (productionLine) {
    alerts = alerts.filter(a => a.productionLine === productionLine);
  }
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }
  if (startTime) {
    const startMs = new Date(startTime).getTime();
    alerts = alerts.filter(a => new Date(a.createdAt).getTime() >= startMs);
  }
  if (endTime) {
    const endMs = new Date(endTime).getTime();
    alerts = alerts.filter(a => new Date(a.createdAt).getTime() <= endMs);
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(alerts);
}

function getOnlineRateStats(req, res) {
  const { productionLine, startTime, endTime } = req.query;

  let ccps;
  if (productionLine) {
    ccps = store.getCCPsByProductionLine(productionLine);
  } else {
    ccps = store.getAllCCPs();
  }

  const now = Date.now();
  const endMs = endTime ? new Date(endTime).getTime() : now;
  const startMs = startTime ? new Date(startTime).getTime() : (endMs - 24 * 60 * 60 * 1000);
  const totalPeriodSeconds = Math.round((endMs - startMs) / 1000);

  const stats = [];

  for (const ccp of ccps) {
    const alerts = store.getOfflineAlertsByCCP(ccp.id);
    const relevantAlerts = alerts.filter(a => {
      const alertStart = new Date(a.createdAt).getTime();
      const alertEnd = a.resolvedAt ? new Date(a.resolvedAt).getTime() : now;
      return alertEnd >= startMs && alertStart <= endMs;
    });

    let totalOfflineSeconds = 0;
    for (const alert of relevantAlerts) {
      const alertStart = Math.max(new Date(alert.createdAt).getTime(), startMs);
      const alertEnd = Math.min(alert.resolvedAt ? new Date(alert.resolvedAt).getTime() : now, endMs);
      totalOfflineSeconds += Math.round((alertEnd - alertStart) / 1000);
    }

    const onlineSeconds = Math.max(0, totalPeriodSeconds - totalOfflineSeconds);
    const onlineRate = totalPeriodSeconds > 0 ? (onlineSeconds / totalPeriodSeconds) * 100 : 100;

    stats.push({
      ccpId: ccp.id,
      ccpName: ccp.name,
      productionLine: ccp.productionLine,
      period: {
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        totalSeconds: totalPeriodSeconds
      },
      onlineSeconds,
      offlineSeconds: totalOfflineSeconds,
      onlineRate: parseFloat(onlineRate.toFixed(2)),
      offlineAlertCount: relevantAlerts.length
    });
  }

  res.json({
    period: {
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString()
    },
    stats
  });
}

module.exports = {
  checkCCPHearbeat,
  checkAllCCPsHeartbeat,
  handleCCPRecovered,
  getMinReportingFrequency,
  getOfflineCCPs,
  getOfflineAlerts,
  getOnlineRateStats
};
