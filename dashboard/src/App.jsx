import { Routes, Route, NavLink } from 'react-router-dom';
import { useState, useCallback } from 'react';
import Dashboard from './pages/Dashboard';
import CCPDetail from './pages/CCPDetail';
import LineComparison from './pages/LineComparison';
import BatchManager from './pages/BatchManager';
import CalibrationManager from './pages/CalibrationManager';
import MaintenanceManager from './pages/MaintenanceManager';
import AlertBar from './components/AlertBar';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  const [alerts, setAlerts] = useState([]);

  const handleWSMessage = useCallback((msg) => {
    if (msg.type === 'deviation' || msg.type === 'offline_alert' || msg.type === 'rule_alert' || msg.type === 'maintenance_status') {
      setAlerts((prev) => [msg, ...prev].slice(0, 50));
    }
  }, []);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useWebSocket(handleWSMessage);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">温控合规监控面板</h1>
          <nav className="app-nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              总览
            </NavLink>
            <NavLink to="/comparison" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              产线对比
            </NavLink>
            <NavLink to="/batches" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              批次管理
            </NavLink>
            <NavLink to="/calibration" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              校准管理
            </NavLink>
            <NavLink to="/maintenance" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              维护计划
            </NavLink>
          </nav>
        </div>
      </header>
      <AlertBar alerts={alerts} onDismiss={dismissAlert} />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard realtimeAlerts={alerts} />} />
          <Route path="/ccp/:ccpId" element={<CCPDetail />} />
          <Route path="/comparison" element={<LineComparison />} />
          <Route path="/batches" element={<BatchManager />} />
          <Route path="/calibration" element={<CalibrationManager />} />
          <Route path="/maintenance" element={<MaintenanceManager />} />
        </Routes>
      </main>
    </div>
  );
}
