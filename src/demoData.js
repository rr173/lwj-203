const store = require('./store');
const { determineReadingLevel, handleStatusTransition } = require('./readingController');
const { escalateDeviation } = require('./deviationController');

function generateDemoData() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const line1CCPs = [
    {
      name: '杀菌釜温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 115,
      complianceMax: 125,
      criticalMin: 110,
      criticalMax: 130,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    },
    {
      name: '冷却槽温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 0,
      complianceMax: 8,
      criticalMin: -5,
      criticalMax: 15,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    },
    {
      name: '发酵室温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 35,
      complianceMax: 40,
      criticalMin: 25,
      criticalMax: 50,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    }
  ];

  const line2CCPs = [
    {
      name: '杀菌釜温度-2号',
      productionLine: '产线B-饮料灌装',
      complianceMin: 90,
      complianceMax: 98,
      criticalMin: 80,
      criticalMax: 105,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    },
    {
      name: '灌装前温度-2号',
      productionLine: '产线B-饮料灌装',
      complianceMin: 80,
      complianceMax: 88,
      criticalMin: 70,
      criticalMax: 95,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    },
    {
      name: '成品冷藏温度-2号',
      productionLine: '产线B-饮料灌装',
      complianceMin: 2,
      complianceMax: 6,
      criticalMin: -2,
      criticalMax: 12,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30
    }
  ];

  const allCCPConfigs = [...line1CCPs, ...line2CCPs];
  const createdCCPs = [];

  for (const config of allCCPConfigs) {
    const ccp = store.addCCP(config);
    createdCCPs.push(ccp);
  }

  for (const ccp of createdCCPs) {
    generateReadingsForCCP(ccp, oneHourAgo, now);
  }

  const problematicCCP = createdCCPs[1];
  createDeviationWithEscalation(problematicCCP, now);

  createDemoBatches(now);

  console.log('演示数据生成完成');
  console.log(`创建了 ${createdCCPs.length} 个CCP`);
  console.log(`产线: ${store.getAllProductionLines().join(', ')}`);
}

function generateReadingsForCCP(ccp, startTime, endTime) {
  const interval = 10 * 1000;
  const midTemp = (ccp.complianceMin + ccp.complianceMax) / 2;
  const range = (ccp.complianceMax - ccp.complianceMin) / 4;

  let currentTime = startTime;
  while (currentTime <= endTime) {
    const noise = (Math.random() - 0.5) * range;
    let temperature = midTemp + noise;

    if (ccp.name === '冷却槽温度-1号' && currentTime > endTime - 20 * 60 * 1000) {
      temperature = ccp.complianceMax + 2 + Math.random() * 3;
    }

    const level = determineReadingLevel(temperature, ccp);
    const reading = store.addReading(ccp.id, {
      timestamp: new Date(currentTime).toISOString(),
      temperature: parseFloat(temperature.toFixed(2)),
      level
    });

    handleStatusTransition(ccp, level, reading);
    currentTime += interval;
  }

  const lastReading = store.getLastReading(ccp.id);
  if (lastReading) {
    store.updateCCP(ccp.id, { lastReadingTime: lastReading.timestamp });
  }
}

function createDeviationWithEscalation(ccp, now) {
  const openDeviation = store.getOpenDeviationForCCP(ccp.id);
  
  if (openDeviation) {
    const fortyFiveMinutesAgo = now - 45 * 60 * 1000;
    store.updateDeviation(openDeviation.id, {
      createdAt: new Date(fortyFiveMinutesAgo).toISOString()
    });

    store.addCorrectiveAction(openDeviation.id, {
      description: '发现冷却槽温度偏高，已检查制冷系统',
      operator: '张工'
    });

    escalateDeviation(openDeviation.id);

    console.log(`为 ${ccp.name} 创建了已升级的偏差事件: ${openDeviation.id}`);
  }
}

function createDemoBatches(now) {
  const lineA = '产线A-熟食加工';
  const lineB = '产线B-饮料灌装';

  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const fortyMinAgo = now - 40 * 60 * 1000;

  const batchA1 = store.addBatch({
    batchNo: 'LOT-A-20260609-001',
    productName: '红烧排骨罐头',
    productionLine: lineA,
    startTime: new Date(twoHoursAgo).toISOString()
  });
  store.updateBatch(batchA1.id, {
    status: 'pending_inspection',
    endTime: new Date(oneHourAgo).toISOString()
  });

  const batchA2 = store.addBatch({
    batchNo: 'LOT-A-20260609-002',
    productName: '卤蛋真空包装',
    productionLine: lineA,
    startTime: new Date(oneHourAgo).toISOString()
  });

  const batchB1 = store.addBatch({
    batchNo: 'LOT-B-20260609-001',
    productName: '橙汁无菌灌装',
    productionLine: lineB,
    startTime: new Date(twoHoursAgo).toISOString()
  });
  store.updateBatch(batchB1.id, {
    status: 'released',
    endTime: new Date(fortyMinAgo).toISOString()
  });

  const batchB2 = store.addBatch({
    batchNo: 'LOT-B-20260609-002',
    productName: '绿茶PET瓶灌装',
    productionLine: lineB,
    startTime: new Date(fortyMinAgo).toISOString()
  });
  store.updateBatch(batchB2.id, {
    status: 'recalled',
    endTime: new Date(now - 10 * 60 * 1000).toISOString()
  });

  console.log(`创建了 ${store.getAllBatches().length} 个批次`);
}

module.exports = { generateDemoData };
