const store = require('./store');
const { broadcastSOPExecution, broadcastSOPStepCompleted, broadcastSOPTimeoutAlert } = require('./websocket');

function createSOPDefinition(req, res) {
  const { name, description, scene, steps } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'SOP名称不能为空' });
  }
  if (!scene) {
    return res.status(400).json({ error: 'SOP场景不能为空' });
  }
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'SOP步骤不能为空' });
  }

  const validActionTypes = ['confirm', 'photo_upload', 'number_input', 'supervisor_approval'];
  for (const step of steps) {
    if (step.actionType && !validActionTypes.includes(step.actionType)) {
      return res.status(400).json({ error: `无效的动作类型: ${step.actionType}，有效值: ${validActionTypes.join('/')}` });
    }
  }

  const def = store.addSOPDefinition({ name, description, scene, steps });
  res.status(201).json(def);
}

function getAllSOPDefinitions(req, res) {
  const { scene } = req.query;
  let defs = store.getAllSOPDefinitions();
  if (scene) {
    defs = defs.filter(d => d.scene === scene);
  }
  res.json(defs);
}

function getSOPDefinition(req, res) {
  const def = store.getSOPDefinition(req.params.id);
  if (!def) {
    return res.status(404).json({ error: 'SOP定义不存在' });
  }
  res.json(def);
}

function updateSOPDefinition(req, res) {
  const def = store.getSOPDefinition(req.params.id);
  if (!def) {
    return res.status(404).json({ error: 'SOP定义不存在' });
  }

  const { steps } = req.body;
  if (steps && !Array.isArray(steps)) {
    return res.status(400).json({ error: 'steps必须是数组' });
  }

  const validActionTypes = ['confirm', 'photo_upload', 'number_input', 'supervisor_approval'];
  if (steps) {
    for (const step of steps) {
      if (step.actionType && !validActionTypes.includes(step.actionType)) {
        return res.status(400).json({ error: `无效的动作类型: ${step.actionType}` });
      }
    }
  }

  const updated = store.updateSOPDefinition(req.params.id, req.body);
  res.json(updated);
}

function deleteSOPDefinition(req, res) {
  const def = store.getSOPDefinition(req.params.id);
  if (!def) {
    return res.status(404).json({ error: 'SOP定义不存在' });
  }
  store.deleteSOPDefinition(req.params.id);
  res.json({ message: 'SOP定义已删除' });
}

function startSOPExecution(req, res) {
  const { scene, referenceType, referenceId, ccpId, operator, eventTime } = req.body;

  if (!scene) {
    return res.status(400).json({ error: 'SOP场景不能为空' });
  }
  if (!referenceType || !referenceId) {
    return res.status(400).json({ error: '关联类型和关联ID不能为空' });
  }

  const sop = store.getSOPForScene(scene);
  if (!sop) {
    return res.status(400).json({ error: `场景 ${scene} 没有对应的SOP定义` });
  }

  const existing = store.getActiveSOPExecutionByReference(referenceType, referenceId);
  if (existing) {
    return res.status(409).json({
      error: '该关联对象已有进行中的SOP执行实例',
      existingExecution: {
        id: existing.id,
        sopName: existing.sopName,
        currentStepIndex: existing.currentStepIndex,
        status: existing.status
      }
    });
  }

  const execution = store.createSOPExecution({
    scene,
    referenceType,
    referenceId,
    ccpId,
    operator,
    eventTime
  });

  if (!execution) {
    return res.status(500).json({ error: 'SOP执行实例创建失败' });
  }

  broadcastSOPExecution(execution, 'started');
  res.status(201).json(execution);
}

function completeSOPStep(req, res) {
  const { executionId } = req.params;
  const { stepIndex, operator, inputData } = req.body;

  const execution = store.getSOPExecution(executionId);
  if (!execution) {
    return res.status(404).json({ error: 'SOP执行实例不存在' });
  }
  if (execution.status !== 'in_progress') {
    return res.status(400).json({ error: 'SOP执行实例不在进行中状态' });
  }
  if (!stepIndex) {
    return res.status(400).json({ error: '步骤序号不能为空' });
  }
  if (!operator) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  const stepIdx = parseInt(stepIndex, 10);
  if (execution.currentStepIndex !== stepIdx) {
    return res.status(400).json({
      error: `当前需完成步骤${execution.currentStepIndex}，不能跳步操作`,
      currentStepIndex: execution.currentStepIndex
    });
  }

  const step = execution.steps.find(s => s.stepIndex === stepIdx);
  if (!step) {
    return res.status(400).json({ error: '指定步骤不存在' });
  }
  if (step.status === 'completed') {
    return res.status(400).json({ error: '该步骤已完成' });
  }
  if (step.status === 'timed_out') {
    return res.status(400).json({ error: '该步骤已超时，请联系主管处理' });
  }

  if (step.actionType === 'number_input' && !inputData) {
    return res.status(400).json({ error: '数值录入步骤必须提供inputData' });
  }
  if (step.actionType === 'photo_upload' && !inputData) {
    return res.status(400).json({ error: '拍照上传步骤必须提供inputData(照片信息)' });
  }

  const result = store.completeSOPStep(executionId, stepIdx, operator, inputData);
  if (!result) {
    return res.status(500).json({ error: '步骤完成失败' });
  }
  if (result.error) {
    return res.status(400).json({ error: result.error, blockedAtStep: result.blockedAtStep });
  }

  broadcastSOPStepCompleted(result, stepIdx, operator);

  if (result.status === 'completed') {
    broadcastSOPExecution(result, 'completed');
  }

  res.json(result);
}

function getSOPExecution(req, res) {
  const execution = store.getSOPExecution(req.params.id);
  if (!execution) {
    return res.status(404).json({ error: 'SOP执行实例不存在' });
  }
  res.json(execution);
}

function getAllSOPExecutions(req, res) {
  const { scene, referenceType, referenceId, status, page = 1, pageSize = 20 } = req.query;
  let executions = store.getAllSOPExecutions();

  if (scene) {
    executions = executions.filter(e => e.scene === scene);
  }
  if (referenceType) {
    executions = executions.filter(e => e.referenceType === referenceType);
  }
  if (referenceId) {
    executions = executions.filter(e => e.referenceId === referenceId);
  }
  if (status) {
    executions = executions.filter(e => e.status === status);
  }

  executions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = executions.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginated = executions.slice(startIndex, startIndex + size);

  res.json({
    data: paginated,
    pagination: { page: pageNum, pageSize: size, total, totalPages }
  });
}

function getSOPExecutionProgress(req, res) {
  const { referenceType, referenceId } = req.params;
  const executions = store.getSOPExecutionsByReference(referenceType, referenceId);

  if (executions.length === 0) {
    return res.json({ referenceType, referenceId, executions: [], activeExecution: null });
  }

  const activeExecution = executions.find(e => e.status === 'in_progress') || null;

  const progressList = executions.map(exec => {
    const completedSteps = exec.steps.filter(s => s.status === 'completed').length;
    const totalSteps = exec.steps.length;
    const currentStep = exec.steps.find(s => s.stepIndex === exec.currentStepIndex);
    return {
      id: exec.id,
      sopName: exec.sopName,
      scene: exec.scene,
      status: exec.status,
      progress: `${completedSteps}/${totalSteps}`,
      progressPercent: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      currentStep: currentStep ? {
        stepIndex: currentStep.stepIndex,
        name: currentStep.name,
        actionType: currentStep.actionType,
        status: currentStep.status,
        isOverdue: currentStep.isOverdue,
        deadline: currentStep.deadline
      } : null,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      hasTimeout: exec.timeoutAlerts.length > 0
    };
  });

  res.json({
    referenceType,
    referenceId,
    executions: progressList,
    activeExecution: activeExecution ? {
      id: activeExecution.id,
      sopName: activeExecution.sopName,
      currentStepIndex: activeExecution.currentStepIndex,
      totalSteps: activeExecution.steps.length,
      completedSteps: activeExecution.steps.filter(s => s.status === 'completed').length
    } : null
  });
}

function getOperatorPendingSteps(req, res) {
  const { operator } = req.params;
  if (!operator) {
    return res.status(400).json({ error: '操作人不能为空' });
  }

  const pending = store.getPendingSOPStepsForOperator(decodeURIComponent(operator));

  const overdueCount = pending.filter(p => p.isOverdue).length;
  const urgentCount = pending.filter(p => {
    if (p.isOverdue) return false;
    if (!p.deadline) return false;
    const remaining = (new Date(p.deadline).getTime() - Date.now()) / 60000;
    return remaining < 10;
  }).length;

  res.json({
    operator: decodeURIComponent(operator),
    totalPending: pending.length,
    overdueCount,
    urgentCount,
    steps: pending
  });
}

function checkCompliance(req, res) {
  const { scene, referenceType, referenceId } = req.body;

  if (!scene || !referenceType || !referenceId) {
    return res.status(400).json({ error: 'scene、referenceType和referenceId不能为空' });
  }

  const result = store.checkSOPCompliance(scene, referenceType, referenceId);
  res.json(result);
}

function cancelSOPExecution(req, res) {
  const { executionId } = req.params;
  const { reason, operator } = req.body;

  const execution = store.getSOPExecution(executionId);
  if (!execution) {
    return res.status(404).json({ error: 'SOP执行实例不存在' });
  }
  if (execution.status === 'completed' || execution.status === 'cancelled') {
    return res.status(400).json({ error: 'SOP执行实例已结束，无法取消' });
  }

  const result = store.cancelSOPExecution(executionId, reason, operator);
  if (!result) {
    return res.status(500).json({ error: '取消失败' });
  }

  broadcastSOPExecution(result, 'cancelled');
  res.json(result);
}

function getSOPStatistics(req, res) {
  const { scene, startTime, endTime } = req.query;
  const stats = store.getSOPExecutionStatistics(scene, startTime, endTime);
  res.json(stats);
}

function getSOPTimeoutAlerts(req, res) {
  const { status } = req.query;
  const alerts = store.getSOPTimeoutAlerts(status);
  alerts.sort((a, b) => new Date(b.alertedAt).getTime() - new Date(a.alertedAt).getTime());
  res.json(alerts);
}

function acknowledgeSOPTimeoutAlert(req, res) {
  const alert = store.sopTimeoutAlerts?.get(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'SOP超时告警不存在' });
  }
  if (alert.status === 'acknowledged') {
    return res.status(400).json({ error: '告警已确认' });
  }

  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ error: '确认人不能为空' });
  }

  const updated = store.acknowledgeSOPTimeoutAlert(req.params.id, operator);
  if (!updated) {
    return res.status(500).json({ error: '确认失败' });
  }
  res.json(updated);
}

function checkSOPStepTimeouts() {
  const results = store.checkSOPStepTimeouts();
  for (const result of results) {
    broadcastSOPTimeoutAlert(result.alert);
    broadcastSOPExecution(result.execution, 'step_timeout');
  }
  return results;
}

module.exports = {
  createSOPDefinition,
  getAllSOPDefinitions,
  getSOPDefinition,
  updateSOPDefinition,
  deleteSOPDefinition,
  startSOPExecution,
  completeSOPStep,
  getSOPExecution,
  getAllSOPExecutions,
  getSOPExecutionProgress,
  getOperatorPendingSteps,
  checkCompliance,
  cancelSOPExecution,
  getSOPStatistics,
  getSOPTimeoutAlerts,
  acknowledgeSOPTimeoutAlert,
  checkSOPStepTimeouts
};
