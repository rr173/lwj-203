import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-label">{d.name}</div>
      <div className="custom-tooltip-item">
        <span className="custom-tooltip-dot" style={{ background: d.fill }} />
        合规率: {d.complianceRate}%
      </div>
      <div className="custom-tooltip-item" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
        在线率: {d.onlineRate}%
      </div>
    </div>
  );
}

function getBarColor(rate) {
  if (rate >= 95) return 'var(--color-green)';
  if (rate >= 80) return 'var(--color-yellow)';
  return 'var(--color-red)';
}

export default function ComplianceBarChart({ data, title }) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      name: d.ccpName || d.ccpId,
      complianceRate: parseFloat(d.complianceRate?.toFixed(1) || 0),
      onlineRate: parseFloat(d.onlineRate?.toFixed(1) || 0),
      fill: getBarColor(d.complianceRate ?? 0),
    }));
  }, [data]);

  if (!chartData.length) {
    return <div className="empty-state">暂无数据</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
            stroke="var(--color-text-secondary)"
            tick={{ fontSize: 11 }}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="var(--color-text-secondary)"
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="complianceRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
