import { useState, useEffect, useCallback } from 'react';
import { getCCPPrediction } from '../api/client';

function SlopeArrow({ slope }) {
  if (Math.abs(slope) < 0.0001) {
    return <span className="trend-arrow trend-arrow-flat">→</span>;
  }
  if (slope > 0) {
    return <span className="trend-arrow trend-arrow-up">↑</span>;
  }
  return <span className="trend-arrow trend-arrow-down">↓</span>;
}

export default function TrendPredictionCard({ ccpId }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPrediction = useCallback(async () => {
    try {
      const data = await getCCPPrediction(ccpId);
      setPrediction(data);
    } catch (err) {
      console.error('Failed to fetch prediction:', err);
    } finally {
      setLoading(false);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 10000);
    return () => clearInterval(interval);
  }, [fetchPrediction]);

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

          <div className="trend-prediction-footer">
            基于 {prediction.sampleCount} 条最近读数
          </div>
        </div>
      )}
    </div>
  );
}
