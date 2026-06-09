const store = require('./store');
const { broadcastMaintenanceStatus } = require('./websocket');

function createMaintenancePlan(req, res) {
  const { productionLine, startTime, endTime, reason, responsiblePerson } = req.body;

  if (!productionLine) {
    return res.status(400).json({ error: '产线不能为空' });
  }
  if (!startTime || !endTime) {
    return res.status(400).json({ error: '开始时间和结束时间不能为空' });
  }

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    return res.status(400).json({ error: '时间格式无效' });
  }
  if (endMs <= startMs) {
    return res.status(400).json({ error: '结束时间必须晚于开始时间' });
  }
  if (!reason) {
    return res.status(400).json({ error: '维护原因不能为空' });
  }
  if (!responsiblePerson) {
    return res.status(400).json({ error: '负责人不能为空' });
  }

  const plan = store.addMaintenancePlan({
    productionLine,
    startTime,
    endTime,
    reason,
    responsiblePerson
  });

  broadcastMaintenanceStatus({
    action: 'created',
    planId: plan.id,
    productionLine: plan.productionLine,
    isActive: store.isLineUnderMaintenance(plan.productionLine)
  });

  res.status(201).json(plan);
}

function getAllMaintenancePlans(req, res) {
  const { productionLine, status } = req.query;
  let plans = store.getAllMaintenancePlans();

  if (productionLine) {
    plans = plans.filter(p => p.productionLine === productionLine);
  }
  if (status) {
    const now = Date.now();
    if (status === 'active') {
      plans = plans.filter(p => {
        const start = new Date(p.startTime).getTime();
        const end = new Date(p.endTime).getTime();
        return start <= now && end >= now;
      });
    } else if (status === 'scheduled') {
      plans = plans.filter(p => new Date(p.startTime).getTime() > now);
    } else if (status === 'completed') {
      plans = plans.filter(p => new Date(p.endTime).getTime() <= now);
    }
  }

  plans.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  res.json(plans);
}

function getMaintenancePlan(req, res) {
  const plan = store.getMaintenancePlan(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: '维护计划不存在' });
  }
  res.json(plan);
}

function updateMaintenancePlan(req, res) {
  const plan = store.getMaintenancePlan(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: '维护计划不存在' });
  }

  const { startTime, endTime } = req.body;
  if (startTime && endTime) {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (endMs <= startMs) {
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }
  } else if ((startTime && !endTime) || (!startTime && endTime)) {
    const s = startTime ? new Date(startTime).getTime() : new Date(plan.startTime).getTime();
    const e = endTime ? new Date(endTime).getTime() : new Date(plan.endTime).getTime();
    if (e <= s) {
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }
  }

  const updated = store.updateMaintenancePlan(req.params.id, req.body);

  broadcastMaintenanceStatus({
    action: 'updated',
    planId: updated.id,
    productionLine: updated.productionLine,
    isActive: store.isLineUnderMaintenance(updated.productionLine)
  });

  res.json(updated);
}

function deleteMaintenancePlan(req, res) {
  const plan = store.getMaintenancePlan(req.params.id);
  if (!plan) {
    return res.status(404).json({ error: '维护计划不存在' });
  }

  store.deleteMaintenancePlan(req.params.id);

  broadcastMaintenanceStatus({
    action: 'deleted',
    planId: req.params.id,
    productionLine: plan.productionLine,
    isActive: store.isLineUnderMaintenance(plan.productionLine)
  });

  res.json({ message: '维护计划已删除' });
}

function getLinePlans(req, res) {
  const { productionLine } = req.params;
  const future = store.getFuturePlansByLine(productionLine);
  const history = store.getHistoryPlansByLine(productionLine);
  const active = store.getActiveMaintenanceForLine(productionLine);

  res.json({
    productionLine,
    active,
    future,
    history
  });
}

function getCurrentlyMaintainedLines(req, res) {
  const lines = store.getCurrentlyMaintainedLines();
  const result = lines.map(line => {
    const activePlans = store.getActiveMaintenanceForLine(line);
    return {
      productionLine: line,
      activePlans,
      ccpCount: store.getCCPsByProductionLine(line).length
    };
  });
  res.json(result);
}

module.exports = {
  createMaintenancePlan,
  getAllMaintenancePlans,
  getMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  getLinePlans,
  getCurrentlyMaintainedLines
};
