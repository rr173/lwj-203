const { WebSocketServer } = require('ws');

const clients = new Set();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      clients.delete(ws);
    });
  });

  console.log('[WS] WebSocket server initialized at /ws');
}

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      try {
        client.send(data);
      } catch (err) {
        console.error('[WS] Broadcast error:', err.message);
        clients.delete(client);
      }
    }
  }
}

function broadcastDeviation(deviation) {
  broadcast({
    type: 'deviation',
    id: `dev_${deviation.id}_${Date.now()}`,
    data: {
      id: deviation.id,
      ccpId: deviation.ccpId,
      level: deviation.level,
      initialTemperature: deviation.initialTemperature,
      createdAt: deviation.createdAt,
    },
  });
}

function broadcastOfflineAlert(alert) {
  broadcast({
    type: 'offline_alert',
    id: `off_${alert.id}_${Date.now()}`,
    data: {
      id: alert.id,
      ccpId: alert.ccpId,
      ccpName: alert.ccpName,
      productionLine: alert.productionLine,
      createdAt: alert.createdAt,
      lastReadingTime: alert.lastReadingTime,
    },
  });
}

module.exports = {
  initWebSocket,
  broadcast,
  broadcastDeviation,
  broadcastOfflineAlert,
};
