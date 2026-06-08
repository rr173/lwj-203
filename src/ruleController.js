const store = require('./store');

const VALID_RULE_TYPES = ['cumulative', 'trend'];

function validateRuleData(data) {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('规则名称不能为空');
  }

  if (!VALID_RULE_TYPES.includes(data.type)) {
    errors.push(`规则类型必须是: ${VALID_RULE_TYPES.join(', ')}`);
  }

  if (!data.ccpId) {
    errors.push('必须指定CCP');
  } else {
    const ccp = store.getCCP(data.ccpId);
    if (!ccp) {
      errors.push('指定的CCP不存在');
    }
  }

  if (data.type === 'cumulative') {
    if (!data.config || typeof data.config.consecutiveCount !== 'number' || data.config.consecutiveCount < 1) {
      errors.push('累积规则需要consecutiveCount参数且为正整数');
    }
  }

  if (data.type === 'trend') {
    if (!data.config || typeof data.config.windowMinutes !== 'number' || data.config.windowMinutes < 1) {
      errors.push('趋势规则需要windowMinutes参数且为正数');
    }
    if (!data.config || typeof data.config.rateThresholdPerMinute !== 'number' || data.config.rateThresholdPerMinute <= 0) {
      errors.push('趋势规则需要rateThresholdPerMinute参数且为正数');
    }
  }

  return errors;
}

function createRule(req, res) {
  const errors = validateRuleData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const rule = store.addRule({
    name: req.body.name.trim(),
    type: req.body.type,
    ccpId: req.body.ccpId,
    config: req.body.config,
    enabled: req.body.enabled !== false
  });

  res.status(201).json(rule);
}

function getAllRules(req, res) {
  const { ccpId, type, enabled } = req.query;
  let rules = store.getAllRules();

  if (ccpId) {
    rules = rules.filter(r => r.ccpId === ccpId);
  }
  if (type) {
    rules = rules.filter(r => r.type === type);
  }
  if (enabled !== undefined) {
    const isEnabled = enabled === 'true';
    rules = rules.filter(r => r.enabled === isEnabled);
  }

  rules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(rules);
}

function getRulesByCCP(req, res) {
  const { ccpId } = req.params;
  const ccp = store.getCCP(ccpId);
  if (!ccp) {
    return res.status(404).json({ error: 'CCP不存在' });
  }
  const rules = store.getRulesByCCP(ccpId);
  res.json(rules);
}

function getRule(req, res) {
  const rule = store.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }
  res.json(rule);
}

function updateRule(req, res) {
  const rule = store.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }

  const updateData = { ...rule, ...req.body, id: rule.id };
  const errors = validateRuleData(updateData);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const updated = store.updateRule(req.params.id, {
    name: req.body.name !== undefined ? req.body.name.trim() : rule.name,
    type: req.body.type !== undefined ? req.body.type : rule.type,
    ccpId: req.body.ccpId !== undefined ? req.body.ccpId : rule.ccpId,
    config: req.body.config !== undefined ? req.body.config : rule.config,
    enabled: req.body.enabled !== undefined ? req.body.enabled : rule.enabled
  });

  if (req.body.config) {
    store.resetRuleEvalState(req.params.id);
  }

  res.json(updated);
}

function deleteRule(req, res) {
  const rule = store.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }

  store.deleteRule(req.params.id);
  store.resetRuleEvalState(req.params.id);
  res.json({ message: '规则已删除', id: req.params.id });
}

function toggleRule(req, res) {
  const rule = store.getRule(req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '规则不存在' });
  }

  const updated = store.updateRule(req.params.id, { enabled: !rule.enabled });
  if (!updated.enabled) {
    store.resetRuleEvalState(req.params.id);
  }
  res.json(updated);
}

function getAllRuleAlerts(req, res) {
  const { ccpId, ruleId, type, status, startTime, endTime, page = 1, pageSize = 20 } = req.query;
  let alerts = store.getAllRuleAlerts();

  if (ccpId) {
    alerts = alerts.filter(a => a.ccpId === ccpId);
  }
  if (ruleId) {
    alerts = alerts.filter(a => a.ruleId === ruleId);
  }
  if (type) {
    alerts = alerts.filter(a => a.ruleType === type);
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

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = alerts.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginatedAlerts = alerts.slice(startIndex, startIndex + size);

  res.json({
    data: paginatedAlerts,
    pagination: {
      page: pageNum,
      pageSize: size,
      total,
      totalPages
    }
  });
}

function getRuleAlert(req, res) {
  const alert = store.getRuleAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: '规则告警不存在' });
  }
  res.json(alert);
}

function acknowledgeRuleAlert(req, res) {
  const alert = store.getRuleAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: '规则告警不存在' });
  }
  if (alert.status === 'acknowledged') {
    return res.status(400).json({ error: '告警已确认' });
  }
  const updated = store.acknowledgeRuleAlert(req.params.id);
  res.json(updated);
}

module.exports = {
  createRule,
  getAllRules,
  getRulesByCCP,
  getRule,
  updateRule,
  deleteRule,
  toggleRule,
  getAllRuleAlerts,
  getRuleAlert,
  acknowledgeRuleAlert
};
