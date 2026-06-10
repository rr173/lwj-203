const { checkAndEscalateDeviations } = require('./deviationController');
const { checkAllCCPsHeartbeat, getMinReportingFrequency } = require('./heartbeatController');
const { runEnergyAnomalyDetectionForAll, recalculateAllCorrelations } = require('./energyController');
const { checkAndEscalateGroupAlerts } = require('./groupAlertEngine');

const DEVIATION_CHECK_INTERVAL = 10 * 1000;
const HEARTBEAT_BASE_INTERVAL = 1000;
const MIN_HEARTBEAT_INTERVAL = 1000;
const ENERGY_ANOMALY_CHECK_INTERVAL = 5 * 60 * 1000;
const CORRELATION_RECALC_INTERVAL = 30 * 60 * 1000;
const GROUP_ESCALATION_CHECK_INTERVAL = 10 * 1000;

function startScheduler() {
  console.log(`启动偏差升级定时检查服务，间隔: ${DEVIATION_CHECK_INTERVAL / 1000}秒`);
  
  setInterval(() => {
    try {
      const escalated = checkAndEscalateDeviations();
      if (escalated.length > 0) {
        console.log(`[${new Date().toISOString()}] 自动升级了 ${escalated.length} 个偏差事件:`);
        escalated.forEach(d => console.log(`  - ${d.id} (CCP: ${d.ccpId})`));
      }
    } catch (error) {
      console.error('偏差升级检查出错:', error);
    }
  }, DEVIATION_CHECK_INTERVAL);

  console.log(`启动能效异常检测服务，间隔: ${ENERGY_ANOMALY_CHECK_INTERVAL / 1000}秒`);
  setInterval(() => {
    try {
      const anomalies = runEnergyAnomalyDetectionForAll();
      if (anomalies.length > 0) {
        console.log(`[${new Date().toISOString()}] 检测到 ${anomalies.length} 个能效异常事件:`);
        anomalies.forEach(a => console.log(`  - ${a.id} (CCP: ${a.ccpId}, 偏离率: ${(a.deviationRatio * 100).toFixed(1)}%)`));
      }
    } catch (error) {
      console.error('能效异常检测出错:', error);
    }
  }, ENERGY_ANOMALY_CHECK_INTERVAL);

  console.log(`启动产线能耗相关性重算服务，间隔: ${CORRELATION_RECALC_INTERVAL / 1000}秒`);
  setInterval(() => {
    try {
      const correlations = recalculateAllCorrelations();
      if (correlations.length > 0) {
        console.log(`[${new Date().toISOString()}] 重算了 ${correlations.length} 对产线能耗相关性`);
        correlations.forEach(c => {
          if (c.correlation >= 0.8) {
            console.log(`  - ${c.lineA} <-> ${c.lineB}: ${c.correlation} (疑似共用冷源)`);
          }
        });
      }
    } catch (error) {
      console.error('产线相关性重算出错:', error);
    }
  }, CORRELATION_RECALC_INTERVAL);

  console.log(`启动CCP分组级联告警升级检查服务，间隔: ${GROUP_ESCALATION_CHECK_INTERVAL / 1000}秒`);
  setInterval(() => {
    try {
      const escalated = checkAndEscalateGroupAlerts();
      if (escalated.length > 0) {
        console.log(`[${new Date().toISOString()}] 升级了 ${escalated.length} 个组级告警至产线级:`);
        escalated.forEach(a => console.log(`  - ${a.id} (组: ${a.groupName}, 产线: ${a.productionLine})`));
      }
    } catch (error) {
      console.error('组级告警升级检查出错:', error);
    }
  }, GROUP_ESCALATION_CHECK_INTERVAL);

  startHeartbeatScheduler();
}

function startHeartbeatScheduler() {
  let lastCheckTime = 0;
  let currentInterval = HEARTBEAT_BASE_INTERVAL;
  let intervalCounter = 0;
  
  console.log('启动传感器心跳监测服务，动态调整扫描间隔');
  
  setInterval(() => {
    try {
      const now = Date.now();
      const minFrequency = getMinReportingFrequency();
      const targetInterval = Math.max(minFrequency * 1000, MIN_HEARTBEAT_INTERVAL);
      
      intervalCounter++;
      if (intervalCounter % 10 === 0) {
        currentInterval = targetInterval;
      }
      
      const elapsed = now - lastCheckTime;
      if (elapsed >= currentInterval || lastCheckTime === 0) {
        const results = checkAllCCPsHeartbeat();
        if (results.length > 0) {
          console.log(`[${new Date().toISOString()}] 检测到 ${results.length} 个CCP传感器离线:`);
          results.forEach(r => console.log(`  - ${r.alert.ccpName} (${r.alert.ccpId})，告警ID: ${r.alert.id}`));
        }
        lastCheckTime = now;
      }
    } catch (error) {
      console.error('心跳监测检查出错:', error);
    }
  }, MIN_HEARTBEAT_INTERVAL);
}

module.exports = { startScheduler };
