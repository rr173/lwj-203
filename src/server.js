const express = require('express');
const cors = require('cors');

const ccpController = require('./ccpController');
const readingController = require('./readingController');
const deviationController = require('./deviationController');
const reportController = require('./reportController');
const { generateDemoData } = require('./demoData');
const { startScheduler } = require('./scheduler');

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

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

generateDemoData();
startScheduler();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  食品加工产线温控合规记录与偏差管理服务                       ║
║  服务已启动: http://localhost:${PORT}                        ║
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
╚══════════════════════════════════════════════════════════════╝
  `);
});
