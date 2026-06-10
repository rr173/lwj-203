const store = require('./store');
const { broadcastGroupAlert, broadcastGroupEscalation } = require('./websocket');

function evaluateGroupForCCP(ccpId) {
  const groups = store.getCCPGroupsForCCP(ccpId);
  const triggeredAlerts = [];

  for (const group of groups) {
    const deviatingCCPIds = [];
    const deviatingCCPDetails = [];

    for (const memberCCPId of group.ccpIds) {
      const openDeviation = store.getOpenDeviationForCCP(memberCCPId);
      if (openDeviation) {
        deviatingCCPIds.push(memberCCPId);
        const ccp = store.getCCP(memberCCPId);
        deviatingCCPDetails.push({
          ccpId: memberCCPId,
          ccpName: ccp ? ccp.name : '(未知)',
          deviationId: openDeviation.id,
          deviationLevel: openDeviation.level,
          deviationCreatedAt: openDeviation.createdAt
        });
      }
    }

    const activeAlert = store.getActiveGroupAlertForGroup(group.id);

    if (deviatingCCPIds.length >= group.rule.thresholdCount) {
      if (!activeAlert) {
        const alert = store.addGroupAlert({
          groupId: group.id,
          groupName: group.name,
          productionLine: group.productionLine,
          deviatingCCPIds,
          deviatingCCPDetails,
          thresholdCount: group.rule.thresholdCount
        });
        broadcastGroupAlert(alert);
        triggeredAlerts.push(alert);
      } else {
        store.updateGroupAlert(activeAlert.id, {
          deviatingCCPIds,
          deviatingCCPDetails
        });
      }
    } else {
      if (activeAlert) {
        const resolved = store.resolveGroupAlert(activeAlert.id);
        if (resolved) {
          broadcastGroupAlert(resolved);
        }
      }
    }
  }

  return triggeredAlerts;
}

function checkAndEscalateGroupAlerts() {
  const activeAlerts = store.getActiveGroupAlerts();
  const now = Date.now();
  const escalated = [];

  for (const alert of activeAlerts) {
    if (alert.status !== 'active') continue;

    const group = store.getCCPGroup(alert.groupId);
    if (!group) continue;

    const triggeredMs = new Date(alert.triggeredAt).getTime();
    const escalationMs = group.rule.escalationMinutes * 60 * 1000;

    if (now - triggeredMs >= escalationMs) {
      const escalatedAlert = store.escalateGroupAlert(alert.id);
      if (escalatedAlert) {
        broadcastGroupEscalation(escalatedAlert);
        escalated.push(escalatedAlert);
      }
    }
  }

  return escalated;
}

module.exports = {
  evaluateGroupForCCP,
  checkAndEscalateGroupAlerts
};
