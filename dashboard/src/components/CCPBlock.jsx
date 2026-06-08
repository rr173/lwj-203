import { Link } from 'react-router-dom';

const STATUS_TEXT = {
  normal: '正常',
  minor: '轻微偏差',
  critical: '严重偏差',
  offline: '离线',
};

export default function CCPBlock({ ccp }) {
  const status = ccp.status === 'offline' || ccp.isOffline ? 'offline' : (ccp.status || 'normal');

  return (
    <Link to={`/ccp/${ccp.id}`} className={`ccp-block status-${status}`}>
      <div className="ccp-block-name">{ccp.name}</div>
      <div className={`ccp-block-status ${status}`}>
        <span className={`status-dot ${status}`} />
        {STATUS_TEXT[status]}
      </div>
      {ccp.lastTemperature != null ? (
        <>
          <div className={`ccp-block-temp ${status}`}>{ccp.lastTemperature}°C</div>
          <div className="ccp-block-range">
            合规范围: {ccp.complianceMin}°C ~ {ccp.complianceMax}°C
          </div>
        </>
      ) : (
        <div className="ccp-block-temp offline">--</div>
      )}
    </Link>
  );
}
