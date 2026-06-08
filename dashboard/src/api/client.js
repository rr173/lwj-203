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
