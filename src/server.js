const express = require('express');
const cors = require('cors');
const http = require('http');

const ccpController = require('./ccpController');
const readingController = require('./readingController');
const deviationController = require('./deviationController');
const reportController = require('./reportController');
const heartbeatController = require('./heartbeatController');
const dashboardController = require('./dashboardController');
const ruleController = require('./ruleController');
const replayController = require('./replayController');
const batchController = require('./batchController');
const calibrationController = require('./calibrationController');
const maintenanceController = require('./maintenanceController');
const predictionController = require('./predictionController');
const { generateDemoData } = require('./demoData');
const { startScheduler } = require('./scheduler');
const { initWebSocket } = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/production-lines', reportController.getProductionLines);

app.post('/api/ccps', ccpController.createCCP);
app.get('/api/ccps', ccpController.getAllCCPs);
app.get('/api/ccps/:id', ccpController.getCCP);
app.put('/api/ccps/:id', ccpController.updateCCP);
app.post('/api/ccps/:id/deactivate', ccpController.deactivateCCP);
app.post('/api/ccps/:id/activate', ccpController.activateCCP);

app.get('/api/ccps/:ccpId/readings', readingController.getReadings);
app.post('/api/readings', readingController.submitReadings);

app.get('/api/deviations', deviationController.getAllDeviations);
app.get('/api/deviations/:id', deviationController.getDeviation);
app.post('/api/deviations/:id/actions', deviationController.addCorrectiveAction);
app.post('/api/deviations/:id/close', deviationController.closeDeviation);

app.get('/api/reports/production-line/:productionLine', reportController.getProductionLineReport);
app.get('/api/reports/ccp/:ccpId/timeline', reportController.getCCPTimeline);

app.get('/api/offline-ccps', heartbeatController.getOfflineCCPs);
app.get('/api/offline-alerts', heartbeatController.getOfflineAlerts);
app.get('/api/reports/online-rate', heartbeatController.getOnlineRateStats);

app.get('/api/dashboard/overview', dashboardController.getDashboardOverview);

app.post('/api/rules', ruleController.createRule);
app.get('/api/rules', ruleController.getAllRules);
app.get('/api/rules/:id', ruleController.getRule);
app.put('/api/rules/:id', ruleController.updateRule);
app.delete('/api/rules/:id', ruleController.deleteRule);
app.post('/api/rules/:id/toggle', ruleController.toggleRule);
app.get('/api/ccps/:ccpId/rules', ruleController.getRulesByCCP);

app.get('/api/rule-alerts', ruleController.getAllRuleAlerts);
app.get('/api/rule-alerts/:id', ruleController.getRuleAlert);
app.post('/api/rule-alerts/:id/acknowledge', ruleController.acknowledgeRuleAlert);

app.get('/api/scenes', replayController.getAllScenes);
app.get('/api/scenes/:id', replayController.getScene);
app.delete('/api/scenes/:id', replayController.deleteScene);
app.post('/api/recordings/start', replayController.startRecording);
app.post('/api/recordings/stop', replayController.stopRecording);
app.get('/api/recordings/status/:ccpId', replayController.getRecordingStatus);
app.post('/api/replay/start', replayController.startReplay);
app.post('/api/replay/pause', replayController.pauseReplay);
app.post('/api/replay/resume', replayController.resumeReplay);
app.post('/api/replay/stop', replayController.stopReplay);
app.get('/api/replay/status/:ccpId', replayController.getReplayStatus);
app.post('/api/replay/speed', replayController.setReplaySpeed);
app.post('/api/simulation/start', replayController.startSimulation);
app.post('/api/simulation/stop', replayController.stopSimulation);
app.get('/api/simulation/status/:ccpId', replayController.getSimulationStatus);

app.post('/api/batches', batchController.createBatch);
app.get('/api/batches', batchController.getAllBatches);
app.get('/api/batches/ranking', batchController.getBatchRiskRanking);
app.get('/api/batches/threshold', batchController.getRecallThreshold);
app.put('/api/batches/threshold', batchController.setRecallThreshold);
app.get('/api/batches/:id', batchController.getBatch);
app.get('/api/batches/:id/risk', batchController.getBatchRiskScore);
app.post('/api/batches/:id/finish', batchController.finishBatch);
app.post('/api/batches/:id/release', batchController.releaseBatch);
app.post('/api/batches/:id/recall', batchController.recallBatch);
app.post('/api/batches/:id/recall-executions', batchController.addRecallExecution);
app.get('/api/batches/:id/recall-summary', batchController.getRecallSummary);
app.get('/api/recall-overview', batchController.getRecallOverview);

app.get('/api/calibration/dashboard', calibrationController.getCalibrationDashboard);
app.get('/api/calibration/alerts', calibrationController.getCalibrationAlerts);
app.post('/api/calibration/alerts/:id/acknowledge', calibrationController.acknowledgeCalibrationAlert);
app.post('/api/ccps/:ccpId/calibrations', calibrationController.addCalibration);
app.get('/api/ccps/:ccpId/calibrations', calibrationController.getCalibrationsByCCP);
app.get('/api/ccps/:ccpId/calibration-status', calibrationController.getCCPCalibrationStatus);

app.post('/api/maintenance-plans', maintenanceController.createMaintenancePlan);
app.get('/api/maintenance-plans', maintenanceController.getAllMaintenancePlans);
app.get('/api/maintenance-plans/:id', maintenanceController.getMaintenancePlan);
app.put('/api/maintenance-plans/:id', maintenanceController.updateMaintenancePlan);
app.delete('/api/maintenance-plans/:id', maintenanceController.deleteMaintenancePlan);
app.get('/api/maintenance-plans/line/:productionLine', maintenanceController.getLinePlans);
app.get('/api/maintenance-active-lines', maintenanceController.getCurrentlyMaintainedLines);

app.get('/api/ccps/:ccpId/prediction', predictionController.getCCPPrediction);
app.get('/api/ccps/:ccpId/prediction/models', predictionController.getCCPModelComparison);
app.get('/api/prediction/alerts', predictionController.getAlertingCCPs);
app.get('/api/prediction/config', predictionController.getPredictionConfig);
app.put('/api/prediction/config', predictionController.setPredictionConfig);
app.get('/api/prediction/model-distribution', predictionController.getModelDistributionStats);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

generateDemoData();

const server = http.createServer(app);
initWebSocket(server);

startScheduler();

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  食品加工产线温控合规记录与偏差管理服务                       ║
║  服务已启动: http://localhost:${PORT}                        ║
║  WebSocket: ws://localhost:${PORT}/ws                        ║
║                                                              ║
║  API 端点:                                                    ║
║  GET    /api/health                                          ║
║  GET    /api/production-lines                                ║
║  POST   /api/ccps                                            ║
║  GET    /api/ccps                                            ║
║  GET    /api/ccps/:id                                        ║
║  PUT    /api/ccps/:id                                        ║
║  POST   /api/ccps/:id/deactivate                             ║
║  POST   /api/ccps/:id/activate                               ║
║  GET    /api/ccps/:ccpId/readings                            ║
║  POST   /api/readings (批量上报)                              ║
║  GET    /api/deviations                                      ║
║  GET    /api/deviations/:id                                  ║
║  POST   /api/deviations/:id/actions                          ║
║  POST   /api/deviations/:id/close                            ║
║  GET    /api/reports/production-line/:productionLine         ║
║  GET    /api/reports/ccp/:ccpId/timeline                     ║
║  GET    /api/offline-ccps (当前离线CCP列表)                   ║
║  GET    /api/offline-alerts (历史离线告警记录)                ║
║  GET    /api/reports/online-rate (CCP在线率统计)              ║
║  GET    /api/dashboard/overview (监控面板总览)                ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
