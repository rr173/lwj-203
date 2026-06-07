const { checkAndEscalateDeviations } = require('./deviationController');
const { checkAllCCPsHeartbeat, getMinReportingFrequency } = require('./heartbeatController');

const DEVIATION_CHECK_INTERVAL = 10 * 1000;
const HEARTBEAT_BASE_INTERVAL = 1000;
const MIN_HEARTBEAT_INTERVAL = 1000;

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
