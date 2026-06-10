const store = require('./store');

function createCCPGroup(req, res) {
  const { name, productionLine, ccpIds, rule } = req.body;

  if (!name) {
    return res.status(400).json({ error: '分组名称不能为空' });
  }
  if (!productionLine) {
    return res.status(400).json({ error: '所属产线不能为空' });
  }
  if (!ccpIds || !Array.isArray(ccpIds) || ccpIds.length === 0) {
    return res.status(400).json({ error: 'CCP列表不能为空' });
  }

  for (const ccpId of ccpIds) {
    const ccp = store.getCCP(ccpId);
    if (!ccp) {
      return res.status(400).json({ error: `CCP ${ccpId} 不存在` });
    }
    if (ccp.productionLine !== productionLine) {
      return res.status(400).json({ error: `CCP ${ccpId} 不属于产线 ${productionLine}` });
    }
  }

  if (rule) {
    if (typeof rule.thresholdCount !== 'number' || rule.thresholdCount < 1) {
      return res.status(400).json({ error: '偏差阈值必须是大于0的整数' });
    }
    if (rule.thresholdCount > ccpIds.length) {
      return res.status(400).json({ error: '偏差阈值不能大于组内CCP总数' });
    }
    if (typeof rule.escalationMinutes !== 'number' || rule.escalationMinutes < 1) {
      return res.status(400).json({ error: '升级时限必须是大于0的整数(分钟)' });
    }
  }

  const group = store.addCCPGroup({ name, productionLine, ccpIds, rule });
  res.status(201).json(group);
}

function getAllCCPGroups(req, res) {
  const { productionLine } = req.query;
  let groups;
  if (productionLine) {
    groups = store.getCCPGroupsByProductionLine(productionLine);
  } else {
    groups = store.getAllCCPGroups();
  }
  res.json(groups);
}

function getCCPGroup(req, res) {
  const group = store.getCCPGroup(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'CCP分组不存在' });
  }
  res.json(group);
}

function updateCCPGroup(req, res) {
  const group = store.getCCPGroup(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'CCP分组不存在' });
  }

  const { name, ccpIds, rule } = req.body;
  const productionLine = group.productionLine;

  if (ccpIds !== undefined) {
    if (!Array.isArray(ccpIds) || ccpIds.length === 0) {
      return res.status(400).json({ error: 'CCP列表不能为空' });
    }
    for (const ccpId of ccpIds) {
      const ccp = store.getCCP(ccpId);
      if (!ccp) {
        return res.status(400).json({ error: `CCP ${ccpId} 不存在` });
      }
      if (ccp.productionLine !== productionLine) {
        return res.status(400).json({ error: `CCP ${ccpId} 不属于产线 ${productionLine}` });
      }
    }
  }

  if (rule) {
    if (typeof rule.thresholdCount !== 'number' || rule.thresholdCount < 1) {
      return res.status(400).json({ error: '偏差阈值必须是大于0的整数' });
    }
    const effectiveCCPCount = ccpIds !== undefined ? ccpIds.length : group.ccpIds.length;
    if (rule.thresholdCount > effectiveCCPCount) {
      return res.status(400).json({ error: '偏差阈值不能大于组内CCP总数' });
    }
    if (typeof rule.escalationMinutes !== 'number' || rule.escalationMinutes < 1) {
      return res.status(400).json({ error: '升级时限必须是大于0的整数(分钟)' });
    }
  }

  const updated = store.updateCCPGroup(req.params.id, { name, ccpIds, rule });
  res.json(updated);
}

function deleteCCPGroup(req, res) {
  const group = store.getCCPGroup(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'CCP分组不存在' });
  }

  const activeAlert = store.getActiveGroupAlertForGroup(req.params.id);
  if (activeAlert) {
    store.resolveGroupAlert(activeAlert.id);
  }

  store.deleteCCPGroup(req.params.id);
  res.json({ message: 'CCP分组已删除' });
}

function getGroupHealth(req, res) {
  const health = store.getGroupHealthStatus(req.params.id);
  if (!health) {
    return res.status(404).json({ error: 'CCP分组不存在' });
  }
  res.json(health);
}

function getGroupCCPSummary(req, res) {
  const group = store.getCCPGroup(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'CCP分组不存在' });
  }

  const ccpSummary = group.ccpIds.map(ccpId => {
    const ccp = store.getCCP(ccpId);
    if (!ccp) return { ccpId, name: '(已删除)', status: 'unknown', isActive: false };

    const openDeviation = store.getOpenDeviationForCCP(ccpId);
    const lastReading = store.getLastReading(ccpId);

    return {
      ccpId,
      name: ccp.name,
      status: ccp.status,
      isActive: ccp.isActive,
      complianceMin: ccp.complianceMin,
      complianceMax: ccp.complianceMax,
      criticalMin: ccp.criticalMin,
      criticalMax: ccp.criticalMax,
      isDeviating: openDeviation !== null && openDeviation !== undefined,
      deviationLevel: openDeviation ? openDeviation.level : null,
      deviationId: openDeviation ? openDeviation.id : null,
      deviationCreatedAt: openDeviation ? openDeviation.createdAt : null,
      lastReadingTemperature: lastReading ? lastReading.temperature : null,
      lastReadingTime: lastReading ? lastReading.timestamp : null
    };
  });

  res.json({
    groupId: group.id,
    groupName: group.name,
    productionLine: group.productionLine,
    totalCCPCount: group.ccpIds.length,
    ccpSummary
  });
}

function getGroupAlertHistory(req, res) {
  const { groupId, productionLine, status, startTime, endTime, page = 1, pageSize = 20 } = req.query;
  let alerts = store.getAllGroupAlerts();

  if (groupId) {
    alerts = alerts.filter(a => a.groupId === groupId);
  }
  if (productionLine) {
    alerts = alerts.filter(a => a.productionLine === productionLine);
  }
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }
  if (startTime) {
    const startMs = new Date(startTime).getTime();
    alerts = alerts.filter(a => new Date(a.triggeredAt).getTime() >= startMs);
  }
  if (endTime) {
    const endMs = new Date(endTime).getTime();
    alerts = alerts.filter(a => new Date(a.triggeredAt).getTime() <= endMs);
  }

  alerts.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  const pageNum = parseInt(page, 10);
  const size = parseInt(pageSize, 10);
  const total = alerts.length;
  const totalPages = Math.ceil(total / size);
  const startIndex = (pageNum - 1) * size;
  const paginatedAlerts = alerts.slice(startIndex, startIndex + size).map(alert => {
    const result = { ...alert };
    if (result.durationMs === null && result.status !== 'active' && result.status !== 'escalated') {
      result.durationMs = null;
    } else if (result.durationMs === null && (result.status === 'active' || result.status === 'escalated')) {
      result.durationMs = Date.now() - new Date(result.triggeredAt).getTime();
    }
    return result;
  });

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

function getGroupAlertDetail(req, res) {
  const alert = store.getGroupAlert(req.params.alertId);
  if (!alert) {
    return res.status(404).json({ error: '组级告警不存在' });
  }
  res.json(alert);
}

module.exports = {
  createCCPGroup,
  getAllCCPGroups,
  getCCPGroup,
  updateCCPGroup,
  deleteCCPGroup,
  getGroupHealth,
  getGroupCCPSummary,
  getGroupAlertHistory,
  getGroupAlertDetail
};
