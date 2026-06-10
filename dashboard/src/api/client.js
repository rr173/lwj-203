const BASE = '';

export async function fetchJSON(url, options = {}) {
  const res = await fetch(BASE + url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export function getDashboardOverview() {
  return fetchJSON('/api/dashboard/overview');
}

export function getAllCCPs(productionLine) {
  const params = productionLine ? `?productionLine=${encodeURIComponent(productionLine)}` : '';
  return fetchJSON(`/api/ccps${params}`);
}

export function getCCP(id) {
  return fetchJSON(`/api/ccps/${id}`);
}

export function getReadings(ccpId, startTime, endTime) {
  const params = new URLSearchParams();
  if (startTime) params.set('startTime', startTime);
  if (endTime) params.set('endTime', endTime);
  params.set('pageSize', '1000');
  return fetchJSON(`/api/ccps/${ccpId}/readings?${params.toString()}`);
}

export function getDeviations(ccpId) {
  const params = ccpId ? `?ccpId=${ccpId}&pageSize=100` : '?pageSize=100';
  return fetchJSON(`/api/deviations${params}`);
}

export function getOfflineAlerts(ccpId) {
  const params = ccpId ? `?ccpId=${ccpId}` : '';
  return fetchJSON(`/api/offline-alerts${params}`);
}

export function getOfflineCCPs() {
  return fetchJSON('/api/offline-ccps');
}

export function getProductionLines() {
  return fetchJSON('/api/production-lines');
}

export function getOnlineRateStats(productionLine) {
  const params = productionLine ? `?productionLine=${encodeURIComponent(productionLine)}` : '';
  return fetchJSON(`/api/reports/online-rate${params}`);
}

export function getProductionLineReport(productionLine, startTime, endTime) {
  return fetchJSON(`/api/reports/production-line/${encodeURIComponent(productionLine)}?startTime=${startTime}&endTime=${endTime}`);
}

export function getCCPTimeline(ccpId, startTime, endTime) {
  const params = new URLSearchParams();
  if (startTime) params.set('startTime', startTime);
  if (endTime) params.set('endTime', endTime);
  return fetchJSON(`/api/reports/ccp/${ccpId}/timeline?${params.toString()}`);
}

export function getRules(ccpId) {
  const params = ccpId ? `?ccpId=${encodeURIComponent(ccpId)}` : '';
  return fetchJSON(`/api/rules${params}`);
}

export function getRulesByCCP(ccpId) {
  return fetchJSON(`/api/ccps/${ccpId}/rules`);
}

export function createRule(data) {
  return fetchJSON('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateRule(id, data) {
  return fetchJSON(`/api/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteRule(id) {
  return fetchJSON(`/api/rules/${id}`, { method: 'DELETE' });
}

export function toggleRule(id) {
  return fetchJSON(`/api/rules/${id}/toggle`, { method: 'POST' });
}

export function getRuleAlerts(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.ccpId) searchParams.set('ccpId', params.ccpId);
  if (params.ruleId) searchParams.set('ruleId', params.ruleId);
  if (params.type) searchParams.set('type', params.type);
  if (params.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return fetchJSON(`/api/rule-alerts${qs ? `?${qs}` : ''}`);
}

export function acknowledgeRuleAlert(id) {
  return fetchJSON(`/api/rule-alerts/${id}/acknowledge`, { method: 'POST' });
}

export function getAllScenes() {
  return fetchJSON('/api/scenes');
}

export function getScene(id) {
  return fetchJSON(`/api/scenes/${id}`);
}

export function deleteScene(id) {
  return fetchJSON(`/api/scenes/${id}`, { method: 'DELETE' });
}

export function startRecording(ccpId, name) {
  return fetchJSON('/api/recordings/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId, name }),
  });
}

export function stopRecording(ccpId) {
  return fetchJSON('/api/recordings/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId }),
  });
}

export function getRecordingStatus(ccpId) {
  return fetchJSON(`/api/recordings/status/${ccpId}`);
}

export function startReplay(sceneId, targetCcpId, speed) {
  return fetchJSON('/api/replay/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneId, targetCcpId, speed }),
  });
}

export function pauseReplay(ccpId) {
  return fetchJSON('/api/replay/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId }),
  });
}

export function resumeReplay(ccpId) {
  return fetchJSON('/api/replay/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId }),
  });
}

export function stopReplay(ccpId) {
  return fetchJSON('/api/replay/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId }),
  });
}

export function getReplayStatus(ccpId) {
  return fetchJSON(`/api/replay/status/${ccpId}`);
}

export function setReplaySpeed(ccpId, speed) {
  return fetchJSON('/api/replay/speed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId, speed }),
  });
}

export function startSimulation(ccpId, mode, config) {
  return fetchJSON('/api/simulation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId, mode, config }),
  });
}

export function stopSimulation(ccpId) {
  return fetchJSON('/api/simulation/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccpId }),
  });
}

export function getSimulationStatus(ccpId) {
  return fetchJSON(`/api/simulation/status/${ccpId}`);
}

export function getBatches(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.productionLine) searchParams.set('productionLine', params.productionLine);
  if (params.startTime) searchParams.set('startTime', params.startTime);
  if (params.endTime) searchParams.set('endTime', params.endTime);
  if (params.page) searchParams.set('page', params.page);
  if (params.pageSize) searchParams.set('pageSize', params.pageSize);
  const qs = searchParams.toString();
  return fetchJSON(`/api/batches${qs ? `?${qs}` : ''}`);
}

export function getBatch(id) {
  return fetchJSON(`/api/batches/${id}`);
}

export function getBatchRiskScore(id) {
  return fetchJSON(`/api/batches/${id}/risk`);
}

export function createBatch(data) {
  return fetchJSON('/api/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function finishBatch(id) {
  return fetchJSON(`/api/batches/${id}/finish`, { method: 'POST' });
}

export function releaseBatch(id) {
  return fetchJSON(`/api/batches/${id}/release`, { method: 'POST' });
}

export function recallBatch(id) {
  return fetchJSON(`/api/batches/${id}/recall`, { method: 'POST' });
}

export function getBatchRiskRanking(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.startTime) searchParams.set('startTime', params.startTime);
  if (params.endTime) searchParams.set('endTime', params.endTime);
  if (params.productionLine) searchParams.set('productionLine', params.productionLine);
  if (params.limit) searchParams.set('limit', params.limit);
  const qs = searchParams.toString();
  return fetchJSON(`/api/batches/ranking${qs ? `?${qs}` : ''}`);
}

export function getRecallThreshold() {
  return fetchJSON('/api/batches/threshold');
}

export function setRecallThreshold(threshold) {
  return fetchJSON('/api/batches/threshold', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threshold }),
  });
}

export function addRecallExecution(batchId, data) {
  return fetchJSON(`/api/batches/${batchId}/recall-executions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getRecallSummary(batchId) {
  return fetchJSON(`/api/batches/${batchId}/recall-summary`);
}

export function getRecallOverview() {
  return fetchJSON('/api/recall-overview');
}

export function getCalibrationDashboard() {
  return fetchJSON('/api/calibration/dashboard');
}

export function getCalibrationAlerts(status) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchJSON(`/api/calibration/alerts${params}`);
}

export function acknowledgeCalibrationAlert(id) {
  return fetchJSON(`/api/calibration/alerts/${id}/acknowledge`, { method: 'POST' });
}

export function addCalibration(ccpId, data) {
  return fetchJSON(`/api/ccps/${ccpId}/calibrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getCalibrationsByCCP(ccpId) {
  return fetchJSON(`/api/ccps/${ccpId}/calibrations`);
}

export function getCCPCalibrationStatus(ccpId) {
  return fetchJSON(`/api/ccps/${ccpId}/calibration-status`);
}

export function getMaintenancePlans(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.productionLine) searchParams.set('productionLine', encodeURIComponent(params.productionLine));
  if (params.status) searchParams.set('status', params.status);
  const qs = searchParams.toString();
  return fetchJSON(`/api/maintenance-plans${qs ? `?${qs}` : ''}`);
}

export function getMaintenancePlan(id) {
  return fetchJSON(`/api/maintenance-plans/${id}`);
}

export function createMaintenancePlan(data) {
  return fetchJSON('/api/maintenance-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateMaintenancePlan(id, data) {
  return fetchJSON(`/api/maintenance-plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteMaintenancePlan(id) {
  return fetchJSON(`/api/maintenance-plans/${id}`, { method: 'DELETE' });
}

export function getLineMaintenancePlans(productionLine) {
  return fetchJSON(`/api/maintenance-plans/line/${encodeURIComponent(productionLine)}`);
}

export function getCurrentlyMaintainedLines() {
  return fetchJSON('/api/maintenance-active-lines');
}

export function getCCPPrediction(ccpId) {
  return fetchJSON(`/api/ccps/${ccpId}/prediction`);
}

export function getPredictionAlerts() {
  return fetchJSON('/api/prediction/alerts');
}

export function getPredictionConfig() {
  return fetchJSON('/api/prediction/config');
}

export function setPredictionConfig(config) {
  return fetchJSON('/api/prediction/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
