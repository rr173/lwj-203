import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea
} from 'recharts';

function CustomTooltip({ active, payload, ccp }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{new Date(d.time).toLocaleTimeString()}</div>
      <div className="custom-tooltip-item">
        <span className="custom-tooltip-dot" style={{ background: d.level === 'critical' ? 'var(--color-red)' : d.level === 'minor' ? 'var(--color-yellow)' : 'var(--color-green)' }} />
        温度: {d.temperature}°C ({d.level === 'critical' ? '严重偏差' : d.level === 'minor' ? '轻微偏差' : '正常'})
      </div>
    </div>
  );
}

export default function TemperatureChart({ readings, ccp }) {
  const chartData = useMemo(() => {
    if (!readings || !readings.length) return [];
    return readings.map((r) => ({
      time: new Date(r.timestamp).getTime(),
      temperature: r.temperature,
      level: r.level,
      timestamp: r.timestamp,
    })).sort((a, b) => a.time - b.time);
  }, [readings]);

  if (!chartData.length) {
    return <div className="empty-state">暂无温度数据</div>;
  }

  const timeRange = chartData.length > 1
    ? chartData[chartData.length - 1].time - chartData[0].time
    : 0;

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,197,94,0.12)" />
              <stop offset="100%" stopColor="rgba(34,197,94,0.04)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => new Date(v).toLocaleTimeString()}
            stroke="var(--color-text-secondary)"
            tick={{ fontSize: 11 }}
            tickCount={6}
          />
          <YAxis
            stroke="var(--color-text-secondary)"
            tick={{ fontSize: 11 }}
            domain={[(min) => Math.min(min, ccp.complianceMin) - 2, (max) => Math.max(max, ccp.complianceMax) + 2]}
          />
          <Tooltip content={<CustomTooltip ccp={ccp} />} />
          <ReferenceArea
            y1={ccp.complianceMin}
            y2={ccp.complianceMax}
            fill="url(#complianceFill)"
            stroke="rgba(34,197,94,0.3)"
            strokeDasharray="4 4"
          />
          <ReferenceLine y={ccp.complianceMin} stroke="var(--color-green)" strokeDasharray="6 3" strokeWidth={1} />
          <ReferenceLine y={ccp.complianceMax} stroke="var(--color-green)" strokeDasharray="6 3" strokeWidth={1} />
          <ReferenceLine y={ccp.criticalMin} stroke="var(--color-red)" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={ccp.criticalMax} stroke="var(--color-red)" strokeDasharray="4 4" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
