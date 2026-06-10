const store = require('./store');
const {
  broadcastWorkOrder,
  broadcastTimeoutAlert,
  broadcastWorkOrderStatusChange
} = require('./websocket');

function getAllWorkOrders(req, res) {
  const { status, ccpId, productionLine, assignee, deviationLevel, page = 1, pageSize = 20 } = req.query;
  let workOrders = store.getAllWorkOrders();

  if (status) {
    workOrders = workOrders.filter(wo => wo.status === status);
  }
  if (ccpId) {
    workOrders = workOrders.filter(wo => wo.ccpId === ccpId);
  }
  if (productionLine) {
    workOrders = workOrders.filter(wo => wo.productionLine === productionLine);
  }
  if (assignee) {
    workOrders = workOrders.filter(wo => wo.assignee === assignee);
  }
  if (deviationLevel) {
    workOrders = workOrders.filter(wo => wo.deviationLevel === deviationLevel);
  }

  workOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = workOrders.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginated = workOrders.slice(startIndex, startIndex + size);

  res.json({
    data: paginated,
    pagination: {
      page: pageNum,
      pageSize: size,
      total,
      totalPages
    }
  });
}

function getWorkOrder(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  res.json(workOrder);
}

function getWorkOrderTemplates(req, res) {
  const templates = store.getAllWorkOrderTemplates();
  res.json(templates);
}

function acceptWorkOrder(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  if (workOrder.status !== 'pending_accept') {
    return res.status(400).json({ error: '工单当前状态不允许接单' });
  }

  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  const updated = store.acceptWorkOrder(req.params.id, operator);
  if (!updated) {
    return res.status(500).json({ error: '接单失败' });
  }

  broadcastWorkOrderStatusChange(updated, 'accepted', operator);
  res.json(updated);
}

function completeStep(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  if (workOrder.status !== 'processing') {
    return res.status(400).json({ error: '工单当前状态不允许执行步骤' });
  }

  const { stepIndex, operator, remark } = req.body;
  if (!stepIndex || !operator) {
    return res.status(400).json({ error: '步骤序号和操作人不能为空' });
  }

  const stepIdx = parseInt(stepIndex, 10);
  const stepExists = workOrder.steps.find(s => s.stepIndex === stepIdx);
  if (!stepExists) {
    return res.status(400).json({ error: '指定的步骤不存在' });
  }
  if (stepExists.completed) {
    return res.status(400).json({ error: '该步骤已完成' });
  }

  const updated = store.completeWorkOrderStep(req.params.id, stepIdx, operator, remark);
  if (!updated) {
    return res.status(500).json({ error: '步骤完成失败' });
  }

  if (updated.status !== workOrder.status) {
    broadcastWorkOrderStatusChange(updated, updated.status, operator);
  } else {
    broadcastWorkOrder(updated);
  }

  res.json(updated);
}

function reviewWorkOrder(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  if (workOrder.status !== 'pending_review') {
    return res.status(400).json({ error: '工单当前状态不允许复核' });
  }

  const { reviewer, passed, reviewRemark } = req.body;
  if (!reviewer) {
    return res.status(400).json({ error: '复核人不能为空' });
  }
  if (passed === undefined || passed === null) {
    return res.status(400).json({ error: '复核结果不能为空' });
  }

  if (workOrder.reviewer && workOrder.reviewer !== reviewer) {
    return res.status(403).json({ error: `该工单指定复核人为 ${workOrder.reviewer}` });
  }

  const updated = store.reviewWorkOrder(req.params.id, reviewer, passed, reviewRemark);
  if (!updated) {
    return res.status(500).json({ error: '复核操作失败' });
  }

  broadcastWorkOrderStatusChange(updated, passed ? 'review_passed' : 'review_rejected', reviewer);

  if (passed && updated.status === 'closed') {
    const deviation = store.getDeviation(updated.deviationId);
    if (deviation && deviation.status !== 'closed') {
      store.updateDeviation(deviation.id, {
        status: 'closed',
        closedAt: new Date().toISOString(),
        closeReason: `关联工单 ${updated.id} 复核通过自动关闭`,
        closedBy: reviewer
      });
    }
  }

  res.json(updated);
}

function closeWorkOrder(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  if (workOrder.status === 'closed') {
    return res.status(400).json({ error: '工单已关闭' });
  }

  const { closedBy, closeReason } = req.body;
  if (!closedBy) {
    return res.status(400).json({ error: '关闭人不能为空' });
  }

  const updated = store.closeWorkOrder(req.params.id, closedBy, closeReason);
  if (!updated) {
    return res.status(500).json({ error: '工单关闭失败' });
  }

  broadcastWorkOrderStatusChange(updated, 'closed', closedBy);

  res.json(updated);
}

function reassignWorkOrder(req, res) {
  const workOrder = store.getWorkOrder(req.params.id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  if (workOrder.status === 'closed') {
    return res.status(400).json({ error: '已关闭工单不能转派' });
  }

  const { newAssignee, operator, reason } = req.body;
  if (!newAssignee || !operator) {
    return res.status(400).json({ error: '新指派人、操作人不能为空' });
  }

  const updated = store.reassignWorkOrder(req.params.id, newAssignee, operator, reason);
  if (!updated) {
    return res.status(500).json({ error: '转派失败' });
  }

  broadcastWorkOrderStatusChange(updated, 'reassigned', operator);
  res.json(updated);
}

function getOpenWorkOrdersSortedByTime(req, res) {
  const workOrders = store.getWorkOrdersWithRemainingTime();
  res.json(workOrders);
}

function getWorkOrdersByAssignee(req, res) {
  const { assignee } = req.params;
  if (!assignee) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  const workOrders = store.getWorkOrdersByAssignee(decodeURIComponent(assignee));
  const now = Date.now();

  const withRemaining = workOrders.map(wo => {
    const deadline = new Date(wo.deadline).getTime();
    let remainingMinutes = null;
    if (wo.status === 'processing' || wo.status === 'pending_review') {
      remainingMinutes = Math.max(0, Math.ceil((deadline - now) / 60000));
    }
    return { ...wo, remainingMinutes };
  }).sort((a, b) => {
    const statusOrder = { pending_accept: 0, processing: 1, pending_review: 2, closed: 3 };
    if (a.status !== b.status) {
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    }
    if (a.remainingMinutes === null && b.remainingMinutes === null) return 0;
    if (a.remainingMinutes === null) return 1;
    if (b.remainingMinutes === null) return -1;
    return a.remainingMinutes - b.remainingMinutes;
  });

  res.json({
    assignee: decodeURIComponent(assignee),
    total: withRemaining.length,
    open: withRemaining.filter(w => w.status !== 'closed').length,
    overdue: withRemaining.filter(w => w.isOverdue).length,
    workOrders: withRemaining
  });
}

function getWorkOrderStatistics(req, res) {
  const stats = store.getWorkOrderStatistics();
  res.json(stats);
}

function getTimeoutAlerts(req, res) {
  const { status } = req.query;
  const alerts = store.getAllTimeoutAlerts(status);
  alerts.sort((a, b) => new Date(b.alertedAt).getTime() - new Date(a.alertedAt).getTime());
  res.json(alerts);
}

function acknowledgeTimeoutAlert(req, res) {
  const alert = store.getTimeoutAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: '超时告警不存在' });
  }
  if (alert.status === 'acknowledged') {
    return res.status(400).json({ error: '告警已确认' });
  }

  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ error: '确认人不能为空' });
  }

  const updated = store.acknowledgeTimeoutAlert(req.params.id, operator);
  if (!updated) {
    return res.status(500).json({ error: '确认失败' });
  }

  res.json(updated);
}

function checkWorkOrderOverdue() {
  const now = Date.now();
  const openOrders = store.getOpenWorkOrders();
  const results = [];

  for (const wo of openOrders) {
    if (wo.status === 'pending_accept') continue;
    if (wo.isOverdue) continue;

    const deadline = new Date(wo.deadline).getTime();
    if (now > deadline) {
      const result = store.markWorkOrderOverdue(wo.id);
      if (result) {
        results.push(result);
        broadcastWorkOrder(result.workOrder);
        broadcastTimeoutAlert(result.alert);
      }
    }
  }

  return results;
}

module.exports = {
  getAllWorkOrders,
  getWorkOrder,
  getWorkOrderTemplates,
  acceptWorkOrder,
  completeStep,
  reviewWorkOrder,
  closeWorkOrder,
  reassignWorkOrder,
  getOpenWorkOrdersSortedByTime,
  getWorkOrdersByAssignee,
  getWorkOrderStatistics,
  getTimeoutAlerts,
  acknowledgeTimeoutAlert,
  checkWorkOrderOverdue
};
