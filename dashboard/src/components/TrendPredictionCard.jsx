import { useState, useEffect, useCallback } from 'react';
import { getCCPPrediction, getCCPModelComparison } from '../api/client';

function SlopeArrow({ slope }) {
  if (Math.abs(slope) < 0.0001) {
    return <span className="trend-arrow trend-arrow-flat">→</span>;
  }
  if (slope > 0) {
    return <span className="trend-arrow trend-arrow-up">↑</span>;
  }
  return <span className="trend-arrow trend-arrow-down">↓</span>;
}

const MODEL_LABELS = {
  linear: '线性回归',
  ema: '指数平滑',
  ma: '移动平均'
};

const MODEL_COLORS = {
  linear: '#3b82f6',
  ema: '#f59e0b',
  ma: '#22c55e'
};

function ModelComparisonSection({ models, recommendedModel }) {
  if (!models) return null;

  const modelKeys = ['linear', 'ema', 'ma'];

  return (
    <div className="model-comparison">
      <div className="model-comparison-title">
        模型对比
        <span className="model-comparison-recommend-label">
          推荐: {MODEL_LABELS[recommendedModel] || recommendedModel}
        </span>
      </div>
      <div className="model-comparison-grid">
        {modelKeys.map(key => {
          const model = models[key];
          if (!model) return null;
          const isRecommended = model.isRecommended;
          return (
            <div
              key={key}
              className={`model-comparison-card ${isRecommended ? 'model-comparison-recommended' : ''}`}
              style={{ '--model-color': MODEL_COLORS[key] }}
            >
              <div className="model-comparison-card-header">
                <span className="model-comparison-model-name">{model.name}</span>
                {isRecommended && (
                  <span className="model-comparison-recommended-badge">推荐</span>
                )}
              </div>
              <div className="model-comparison-card-body">
                <div className="model-comparison-pred">
                  <span className="model-comparison-pred-label">预测温度</span>
                  <span className="model-comparison-pred-value">
                    {model.predictedTemperature !== null ? `${model.predictedTemperature}°C` : '--'}
                  </span>
                </div>
                <div className="model-comparison-mae">
                  <span className="model-comparison-mae-label">MAE</span>
                  <span className="model-comparison-mae-value">
                    {model.mae !== null ? model.mae.toFixed(4) : '--'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrendPredictionCard({ ccpId }) {
  const [prediction, setPrediction] = useState(null);
  const [modelComparison, setModelComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [predData, compData] = await Promise.all([
        getCCPPrediction(ccpId),
        getCCPModelComparison(ccpId)
      ]);
      setPrediction(predData);
      setModelComparison(compData);
    } catch (err) {
      console.error('Failed to fetch prediction:', err);
    } finally {
      setLoading(false);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="trend-prediction-card">
        <div className="trend-prediction-title">趋势预测</div>
        <div className="trend-prediction-loading">加载中...</div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="trend-prediction-card">
        <div className="trend-prediction-title">趋势预测</div>
        <div className="trend-prediction-empty">暂无数据</div>
      </div>
    );
  }

  const isAlert = prediction.alertTriggered;
  const cardClass = isAlert
    ? 'trend-prediction-card trend-prediction-alerting'
    : 'trend-prediction-card';

  const slopePerMin = prediction.slope * 60;

  return (
    <div className={cardClass}>
      <div className="trend-prediction-header">
        <div className="trend-prediction-title">趋势预测</div>
        {isAlert && (
          <span className="trend-prediction-alert-badge">
            预测性预警
          </span>
        )}
      </div>

      {prediction.insufficientData ? (
        <div className="trend-prediction-empty">
          数据不足，需要至少2条读数
        </div>
      ) : (
        <div className="trend-prediction-body">
          <div className="trend-prediction-main">
            <div className="trend-prediction-slope">
              <span className="trend-prediction-label">当前斜率</span>
              <span className="trend-prediction-slope-value">
                <SlopeArrow slope={prediction.slope} />
                {slopePerMin >= 0 ? '+' : ''}
                {slopePerMin.toFixed(4)}°C/min
              </span>
            </div>
            <div className="trend-prediction-temp">
              <span className="trend-prediction-label">
                预测温度 ({prediction.predictMinutes}分钟后)
              </span>
              <span className="trend-prediction-temp-value">
                {prediction.predictedTemperature}°C
              </span>
            </div>
            <div className="trend-prediction-r2">
              <span className="trend-prediction-label">R² 拟合度</span>
              <span className="trend-prediction-r2-value">
                {prediction.r2.toFixed(4)}
              </span>
            </div>
          </div>

          {isAlert && (
            <div className="trend-prediction-alert-detail">
              <div className="trend-prediction-alert-direction">
                {prediction.alertDirection === 'upper' ? '↑ 温度上升趋势，将超出合规上限' : '↓ 温度下降趋势，将低于合规下限'}
              </div>
              {prediction.predictedArrivalTime && (
                <div className="trend-prediction-alert-time">
                  预计到达时间: {new Date(prediction.predictedArrivalTime).toLocaleTimeString()}
                </div>
              )}
              <div className="trend-prediction-alert-pred-temp">
                预测温度: {prediction.predictedTemperature}°C
                {prediction.alertDirection === 'upper' && prediction.complianceMax && (
                  <span className="trend-prediction-alert-bound"> (上限 {prediction.complianceMax}°C)</span>
                )}
                {prediction.alertDirection === 'lower' && prediction.complianceMin && (
                  <span className="trend-prediction-alert-bound"> (下限 {prediction.complianceMin}°C)</span>
                )}
              </div>
              <div className="trend-prediction-alert-slope">
                当前斜率: {slopePerMin >= 0 ? '+' : ''}{slopePerMin.toFixed(4)}°C/min
              </div>
            </div>
          )}

          <ModelComparisonSection
            models={prediction.models}
            recommendedModel={prediction.recommendedModel}
          />

          <div className="trend-prediction-footer">
            基于 {prediction.sampleCount} 条最近读数 · 推荐模型: {MODEL_LABELS[prediction.recommendedModel] || prediction.recommendedModel}
          </div>
        </div>
      )}
    </div>
  );
}
