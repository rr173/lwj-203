const { checkAndEscalateDeviations } = require('./deviationController');
const { checkAllCCPsHeartbeat, getMinReportingFrequency } = require('./heartbeatController');

const DEVIATION_CHECK_INTERVAL = 10 * 1000;

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

  startHeartbeatScheduler();
}

function startHeartbeatScheduler() {
  const minFrequency = getMinReportingFrequency();
  const heartbeatInterval = Math.min(minFrequency, 10) * 1000;
  
  console.log(`启动传感器心跳监测服务，扫描间隔: ${heartbeatInterval / 1000}秒`);
  
  setInterval(() => {
    try {
      const results = checkAllCCPsHeartbeat();
      if (results.length > 0) {
        console.log(`[${new Date().toISOString()}] 检测到 ${results.length} 个CCP传感器离线:`);
        results.forEach(r => console.log(`  - ${r.alert.ccpName} (${r.alert.ccpId})，告警ID: ${r.alert.id}`));
      }
    } catch (error) {
      console.error('心跳监测检查出错:', error);
    }
  }, heartbeatInterval);
}

module.exports = { startScheduler };
