const store = require('./store');
const { determineReadingLevel, handleStatusTransition } = require('./readingController');
const { escalateDeviation } = require('./deviationController');
const {
  calculateUnitEnergyConsumption,
  recalculateAllBaselines,
  recalculateAllCorrelations
} = require('./energyController');

function generateDemoData() {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;

  const line1CCPs = [
    {
      name: '杀菌釜温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 115,
      complianceMax: 125,
      criticalMin: 110,
      criticalMax: 130,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30,
      basePowerKw: 45,
      equipmentType: 'heating'
    },
    {
      name: '冷却槽温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 0,
      complianceMax: 8,
      criticalMin: -5,
      criticalMax: 15,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30,
      basePowerKw: 22,
      equipmentType: 'cooling'
    },
    {
      name: '发酵室温度-1号',
      productionLine: '产线A-熟食加工',
      complianceMin: 35,
      complianceMax: 40,
      criticalMin: 25,
      criticalMax: 50,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30,
      basePowerKw: 15,
      equipmentType: 'heating'
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
      deviationCloseTimeLimit: 30,
      basePowerKw: 38,
      equipmentType: 'heating'
    },
    {
      name: '灌装前温度-2号',
      productionLine: '产线B-饮料灌装',
      complianceMin: 80,
      complianceMax: 88,
      criticalMin: 70,
      criticalMax: 95,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30,
      basePowerKw: 28,
      equipmentType: 'heating'
    },
    {
      name: '成品冷藏温度-2号',
      productionLine: '产线B-饮料灌装',
      complianceMin: 2,
      complianceMax: 6,
      criticalMin: -2,
      criticalMax: 12,
      reportingFrequency: 10,
      deviationCloseTimeLimit: 30,
      basePowerKw: 20,
      equipmentType: 'cooling'
    }
  ];

  const allCCPConfigs = [...line1CCPs, ...line2CCPs];
  const createdCCPs = [];

  for (const config of allCCPConfigs) {
    const ccp = store.addCCP({
      name: config.name,
      productionLine: config.productionLine,
      complianceMin: config.complianceMin,
      complianceMax: config.complianceMax,
      criticalMin: config.criticalMin,
      criticalMax: config.criticalMax,
      reportingFrequency: config.reportingFrequency,
      deviationCloseTimeLimit: config.deviationCloseTimeLimit
    });
    ccp.basePowerKw = config.basePowerKw;
    ccp.equipmentType = config.equipmentType;
    createdCCPs.push(ccp);
  }

  for (const ccp of createdCCPs) {
    generateReadingsForCCP(ccp, twoHoursAgo, now);
  }

  const problematicCCP = createdCCPs[1];
  createDeviationWithEscalation(problematicCCP, now);

  createDemoBatches(now);
  createDemoMaintenancePlans(now);

  console.log('演示温度数据生成完成');

  generatePowerDataForAllCCPs(createdCCPs, twoHoursAgo, now);

  console.log('演示能耗数据生成完成');
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

function generatePowerDataForAllCCPs(ccps, startTime, endTime) {
  const interval = 30 * 1000;

  const sharedWave = [];
  let t = startTime;
  while (t <= endTime) {
    const phase1 = (t - startTime) / (20 * 60 * 1000);
    const phase2 = (t - startTime) / (40 * 60 * 1000);
    const phase3 = (t - startTime) / (10 * 60 * 1000);
    const wave =
      Math.sin(phase1 * Math.PI * 2) * 0.18 +
      Math.sin(phase2 * Math.PI * 2) * 0.10 +
      Math.sin(phase3 * Math.PI * 2) * 0.08;
    sharedWave.push({ time: t, wave });
    t += interval;
  }

  const anomalyCCP = ccps.find(c => c.name === '成品冷藏温度-2号');
  const anomalyStartTime = endTime - 35 * 60 * 1000;

  for (let waveIdx = 0; waveIdx < sharedWave.length; waveIdx++) {
    const { time, wave } = sharedWave[waveIdx];

    for (const ccp of ccps) {
      let powerMultiplier = 1;

      if (ccp.equipmentType === 'cooling') {
        powerMultiplier += wave;
        powerMultiplier += (Math.random() - 0.5) * 0.01;
      } else {
        powerMultiplier += wave * 0.85;
        powerMultiplier += (Math.random() - 0.5) * 0.015;
      }

      if (ccp.id === anomalyCCP.id && time >= anomalyStartTime) {
        powerMultiplier *= 1.8;
      }

      const powerKw = ccp.basePowerKw * powerMultiplier;

      store.addPowerReading(ccp.id, {
        timestamp: new Date(time).toISOString(),
        powerKw: parseFloat(powerKw.toFixed(4)),
        equipmentType: ccp.equipmentType
      });
    }
  }

  console.log('功率数据已生成，正在计算基线...');
  const baselines = recalculateAllBaselines();
  console.log(`基线计算完成，成功计算 ${baselines.length} 个CCP基线`);
  baselines.forEach(b => console.log(`  - CCP ${b.ccpId}: 均值 ${b.baseline.mean} kWh/℃·h`));

  console.log('正在计算产线相关性...');
  const correlations = recalculateAllCorrelations();
  console.log(`相关性计算完成，共 ${correlations.length} 对产线`);
  correlations.forEach(c => {
    const label = c.correlation >= 0.8 ? '疑似共用冷源' : '正常';
    console.log(`  - ${c.lineA} <-> ${c.lineB}: ${c.correlation} (${label})`);
  });

  if (anomalyCCP) {
    const last30MinStart = endTime - 30 * 60 * 1000;
    const stats = calculateUnitEnergyConsumption(anomalyCCP.id, last30MinStart, endTime);
    const baseline = store.getEnergyBaseline(anomalyCCP.id);

    console.log(`准备为 ${anomalyCCP.name} 创建能效异常...`);
    console.log(`  stats: ${JSON.stringify(stats)}`);
    console.log(`  baseline: ${JSON.stringify(baseline)}`);

    if (stats && baseline && stats.unitEnergyKwhPerDegHour > 0 && baseline.mean > 0) {
      const deviationRatio = Math.abs(stats.unitEnergyKwhPerDegHour - baseline.mean) / baseline.mean;
      console.log(`  偏离率: ${(deviationRatio * 100).toFixed(2)}%`);

      const anomaly = store.addEnergyAnomalyEvent({
        ccpId: anomalyCCP.id,
        ccpName: anomalyCCP.name,
        productionLine: anomalyCCP.productionLine,
        currentUnitEnergy: stats.unitEnergyKwhPerDegHour,
        baselineMean: baseline.mean,
        baselineStd: baseline.std,
        deviationRatio: parseFloat(deviationRatio.toFixed(4)),
        threshold: 0.3,
        anomalyType: 'high_consumption',
        description: `${anomalyCCP.name} 单位能耗偏离基线，疑似制冷系统异常或结霜严重`
      });

      const linkedLines = store.getLinkedLines(anomalyCCP.productionLine);
      console.log(`  关联产线: ${linkedLines.join(', ')}`);
      for (const linkedLine of linkedLines) {
        const lineCCPs = store.getCCPsByProductionLine(linkedLine);
        for (const ccp of lineCCPs) {
          store.addLinkedWarningToAnomaly(anomaly.id, {
            sourceAnomalyId: anomaly.id,
            sourceCCPId: anomalyCCP.id,
            sourceProductionLine: anomalyCCP.productionLine,
            linkedCCPId: ccp.id,
            linkedCCPName: ccp.name,
            linkedProductionLine: linkedLine,
            warningType: 'shared_cold_source_linked',
            message: `共用冷源联动预警：${anomalyCCP.productionLine} 的 ${anomalyCCP.name} 出现能效异常，${linkedLine} 的 ${ccp.name} 请注意检查`
          });
        }
      }

      console.log(`已为 ${anomalyCCP.name} 创建能效异常事件: ${anomaly.id}`);
      console.log(`当前单位能耗: ${stats.unitEnergyKwhPerDegHour} kWh/℃·h, 基线均值: ${baseline.mean} kWh/℃·h`);
    } else {
      console.log(`跳过能效异常创建：条件不满足`);
    }
  }

  const allCorrelations = store.getAllLineCorrelations();
  for (const corr of allCorrelations) {
    console.log(`产线相关性: ${corr.lineA} <-> ${corr.lineB}: ${corr.correlation} (${corr.isSharedColdSource ? '疑似共用冷源' : '正常'})`);
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

function createDemoMaintenancePlans(now) {
  const lineA = '产线A-熟食加工';
  const lineB = '产线B-饮料灌装';

  store.addMaintenancePlan({
    productionLine: lineA,
    startTime: new Date(now - 30 * 60 * 1000).toISOString(),
    endTime: new Date(now + 90 * 60 * 1000).toISOString(),
    reason: '杀菌釜定期检修保养',
    responsiblePerson: '王工'
  });

  store.addMaintenancePlan({
    productionLine: lineB,
    startTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now + 26 * 60 * 60 * 1000).toISOString(),
    reason: '灌装设备年度大修',
    responsiblePerson: '李工'
  });

  store.addMaintenancePlan({
    productionLine: lineA,
    startTime: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now - 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    reason: '冷却系统故障抢修',
    responsiblePerson: '赵工'
  });

  console.log(`创建了 ${store.getAllMaintenancePlans().length} 个维护计划`);
}

module.exports = { generateDemoData };
