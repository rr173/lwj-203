const store = require('./store');
const { broadcastRuleAlert } = require('./websocket');

function evaluateCumulativeRule(rule, ccp, reading) {
  const { consecutiveCount } = rule.config;
  const temp = reading.temperature;
  const outOfCompliance = temp < ccp.complianceMin || temp > ccp.complianceMax;
  const withinCritical = temp >= ccp.criticalMin && temp <= ccp.criticalMax;

  let state = store.getRuleEvalState(rule.id);
  if (!state) {
    state = { consecutiveViolations: 0, evidenceReadings: [] };
  }

  if (outOfCompliance && withinCritical) {
    state.consecutiveViolations += 1;
    state.evidenceReadings.push({
      readingId: reading.id,
      temperature: temp,
      timestamp: reading.timestamp,
      complianceMin: ccp.complianceMin,
      complianceMax: ccp.complianceMax,
      criticalMin: ccp.criticalMin,
      criticalMax: ccp.criticalMax
    });

    if (state.consecutiveViolations >= consecutiveCount) {
      const evidence = {
        ruleName: rule.name,
        ruleType: 'cumulative',
        consecutiveCount,
        actualConsecutive: state.consecutiveViolations,
        readings: state.evidenceReadings.slice(-consecutiveCount),
        description: `连续${state.consecutiveViolations}次读数超出合规范围但未达到严重偏差线`
      };

      const alert = store.addRuleAlert({
        ruleId: rule.id,
        ccpId: ccp.id,
        ruleName: rule.name,
        ruleType: 'cumulative',
        evidence
      });

      state.consecutiveViolations = 0;
      state.evidenceReadings = [];
      store.setRuleEvalState(rule.id, state);

      broadcastRuleAlert(alert);
      return alert;
    }
  } else {
    state.consecutiveViolations = 0;
    state.evidenceReadings = [];
  }

  store.setRuleEvalState(rule.id, state);
  return null;
}

const TREND_COOLDOWN_MS = 60 * 1000;

function evaluateTrendRule(rule, ccp, reading) {
  const { windowMinutes, rateThresholdPerMinute } = rule.config;
  const nowMs = new Date(reading.timestamp).getTime();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStartMs = nowMs - windowMs;

  let state = store.getRuleEvalState(rule.id);
  if (state && state.lastAlertTime && (nowMs - state.lastAlertTime < TREND_COOLDOWN_MS)) {
    return null;
  }

  const allReadings = store.getReadings(ccp.id, windowStartMs, nowMs);
  const recentReadings = allReadings.filter(r =>
    new Date(r.timestamp).getTime() >= windowStartMs
  );

  if (recentReadings.length < 2) {
    return null;
  }

  recentReadings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const first = recentReadings[0];
  const last = recentReadings[recentReadings.length - 1];
  const tempDiff = last.temperature - first.temperature;
  const timeDiffMinutes = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 60000;

  if (timeDiffMinutes <= 0) return null;

  const actualRate = tempDiff / timeDiffMinutes;
  const direction = rule.config.direction || 'both';

  let triggered = false;
  if (direction === 'up') {
    triggered = actualRate > rateThresholdPerMinute;
  } else if (direction === 'down') {
    triggered = actualRate < -rateThresholdPerMinute;
  } else {
    triggered = Math.abs(actualRate) > rateThresholdPerMinute;
  }

  if (triggered) {
    const directionLabel = actualRate > 0 ? '上升' : '下降';

    const evidence = {
      ruleName: rule.name,
      ruleType: 'trend',
      windowMinutes,
      rateThresholdPerMinute,
      configuredDirection: direction,
      actualRate: parseFloat(actualRate.toFixed(4)),
      direction: directionLabel,
      tempDiff: parseFloat(tempDiff.toFixed(2)),
      timeDiffMinutes: parseFloat(timeDiffMinutes.toFixed(2)),
      startReading: {
        readingId: first.id,
        temperature: first.temperature,
        timestamp: first.timestamp
      },
      endReading: {
        readingId: last.id,
        temperature: last.temperature,
        timestamp: last.timestamp
      },
      readingsInWindow: recentReadings.map(r => ({
        temperature: r.temperature,
        timestamp: r.timestamp
      })),
      description: `${windowMinutes}分钟内温度${directionLabel}速率${Math.abs(actualRate).toFixed(2)}°C/分钟，超过阈值${rateThresholdPerMinute}°C/分钟`
    };

    const alert = store.addRuleAlert({
      ruleId: rule.id,
      ccpId: ccp.id,
      ruleName: rule.name,
      ruleType: 'trend',
      evidence
    });

    if (!state) state = {};
    state.lastAlertTime = nowMs;
    store.setRuleEvalState(rule.id, state);

    broadcastRuleAlert(alert);
    return alert;
  }

  if (!state) state = {};
  state.lastAlertTime = null;
  store.setRuleEvalState(rule.id, state);
  return null;
}

function evaluateRulesForCCP(ccpId, reading) {
  const ccp = store.getCCP(ccpId);
  if (!ccp) return [];

  const rules = store.getRulesByCCP(ccpId).filter(r => r.enabled !== false);
  const triggeredAlerts = [];

  for (const rule of rules) {
    let alert = null;

    switch (rule.type) {
      case 'cumulative':
        alert = evaluateCumulativeRule(rule, ccp, reading);
        break;
      case 'trend':
        alert = evaluateTrendRule(rule, ccp, reading);
        break;
      default:
        console.warn(`[RuleEngine] Unknown rule type: ${rule.type}`);
    }

    if (alert) {
      triggeredAlerts.push(alert);
    }
  }

  return triggeredAlerts;
}

module.exports = {
  evaluateRulesForCCP,
  evaluateCumulativeRule,
  evaluateTrendRule
};
