const { WebSocketServer } = require('ws');

const clients = new Set();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  console.log('[WS] WebSocket server initialized at /ws');
}

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(data);
      } catch (err) {
        console.error('[WS] Broadcast error:', err.message);
        clients.delete(client);
      }
    }
  }
}

function broadcastDeviation(deviation) {
  broadcast({
    type: 'deviation',
    id: `dev_${deviation.id}_${Date.now()}`,
    data: {
      id: deviation.id,
      ccpId: deviation.ccpId,
      level: deviation.level,
      initialTemperature: deviation.initialTemperature,
      createdAt: deviation.createdAt,
    },
  });
}

function broadcastOfflineAlert(alert) {
  broadcast({
    type: 'offline_alert',
    id: `off_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      ccpId: alert.ccpId,
      ccpName: alert.ccpName,
      productionLine: alert.productionLine,
      createdAt: alert.createdAt,
      lastReadingTime: alert.lastReadingTime,
    },
  });
}

function broadcastRuleAlert(alert) {
  broadcast({
    type: 'rule_alert',
    id: `rule_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      ruleId: alert.ruleId,
      ccpId: alert.ccpId,
      ruleName: alert.ruleName,
      ruleType: alert.ruleType,
      evidence: alert.evidence,
      createdAt: alert.createdAt,
    },
  });
}

function broadcastReplayStatus(status) {
  broadcast({
    type: 'replay_status',
    id: `replay_${Date.now()}`,
    data: status,
  });
}

function broadcastSimulationStatus(status) {
  broadcast({
    type: 'simulation_status',
    id: `sim_${Date.now()}`,
    data: status,
  });
}

function broadcastPredictionAlert(prediction) {
  broadcast({
    type: 'prediction_alert',
    id: `pred_${prediction.ccpId}_${Date.now()}`,
    data: {
      ccpId: prediction.ccpId,
      ccpName: prediction.ccpName,
      slope: prediction.slope,
      r2: prediction.r2,
      predictedTemperature: prediction.predictedTemperature,
      alertDirection: prediction.alertDirection,
      predictedArrivalTime: prediction.predictedArrivalTime,
      predictMinutes: prediction.predictMinutes,
      complianceMin: prediction.complianceMin,
      complianceMax: prediction.complianceMax,
      sampleCount: prediction.sampleCount
    },
  });
}

function broadcastMaintenanceStatus(data) {
  broadcast({
    type: 'maintenance_status',
    id: `mnt_${Date.now()}`,
    data,
  });
}

function broadcastGroupAlert(alert) {
  broadcast({
    type: 'group_alert',
    id: `grp_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      groupId: alert.groupId,
      groupName: alert.groupName,
      productionLine: alert.productionLine,
      status: alert.status,
      deviatingCCPIds: alert.deviatingCCPIds,
      deviatingCCPDetails: alert.deviatingCCPDetails,
      thresholdCount: alert.thresholdCount,
      triggeredAt: alert.triggeredAt,
      resolvedAt: alert.resolvedAt,
      durationMs: alert.durationMs,
      wasEscalated: alert.wasEscalated,
    },
  });
}

function broadcastGroupEscalation(alert) {
  broadcast({
    type: 'group_escalation',
    id: `grpe_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      groupId: alert.groupId,
      groupName: alert.groupName,
      productionLine: alert.productionLine,
      status: alert.status,
      deviatingCCPIds: alert.deviatingCCPIds,
      deviatingCCPDetails: alert.deviatingCCPDetails,
      triggeredAt: alert.triggeredAt,
      escalatedAt: alert.escalatedAt,
    },
  });
}

function broadcastWorkOrder(workOrder) {
  broadcast({
    type: 'work_order',
    id: `wo_${workOrder.id}_${Date.now()}`,
    data: {
      id: workOrder.id,
      deviationId: workOrder.deviationId,
      deviationLevel: workOrder.deviationLevel,
      ccpId: workOrder.ccpId,
      ccpName: workOrder.ccpName,
      productionLine: workOrder.productionLine,
      status: workOrder.status,
      assignee: workOrder.assignee,
      deadline: workOrder.deadline,
      isOverdue: workOrder.isOverdue,
      stepsCompleted: workOrder.steps.filter(s => s.completed).length,
      stepsTotal: workOrder.steps.length,
      createdAt: workOrder.createdAt,
    },
  });
}

function broadcastWorkOrderStatusChange(workOrder, changeType, operator) {
  broadcast({
    type: 'work_order_status',
    id: `wos_${workOrder.id}_${Date.now()}`,
    data: {
      id: workOrder.id,
      deviationId: workOrder.deviationId,
      status: workOrder.status,
      changeType,
      operator,
      assignee: workOrder.assignee,
      isOverdue: workOrder.isOverdue,
      timestamp: new Date().toISOString(),
    },
  });
}

function broadcastTimeoutAlert(alert) {
  broadcast({
    type: 'timeout_alert',
    id: `toa_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      workOrderId: alert.workOrderId,
      deviationId: alert.deviationId,
      ccpId: alert.ccpId,
      ccpName: alert.ccpName,
      productionLine: alert.productionLine,
      assignee: alert.assignee,
      deviationLevel: alert.deviationLevel,
      deadline: alert.deadline,
      alertedAt: alert.alertedAt,
    },
  });
}

module.exports = {
  initWebSocket,
  broadcast,
  broadcastDeviation,
  broadcastOfflineAlert,
  broadcastRuleAlert,
  broadcastReplayStatus,
  broadcastSimulationStatus,
  broadcastPredictionAlert,
  broadcastMaintenanceStatus,
  broadcastGroupAlert,
  broadcastGroupEscalation,
  broadcastWorkOrder,
  broadcastWorkOrderStatusChange,
  broadcastTimeoutAlert,
};
