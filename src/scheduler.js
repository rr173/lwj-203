const { checkAndEscalateDeviations } = require('./deviationController');

const CHECK_INTERVAL = 10 * 1000;

function startScheduler() {
  console.log(`启动偏差升级定时检查服务，间隔: ${CHECK_INTERVAL / 1000}秒`);
  
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
  }, CHECK_INTERVAL);
}

module.exports = { startScheduler };
