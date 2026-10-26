import http from 'node:http';
import { WebSocketServer } from 'ws';
import { readConfig } from './config.js';
import { createMonitor } from './monitor.js';

const config = readConfig();
const monitor = createMonitor(config);
const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && origin === config.webOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200);
    response.end(JSON.stringify({ status: 'up', mode: 'development', generatedAt: new Date().toISOString() }));
    return;
  }
  if (request.method === 'GET' && request.url === '/api/v1/dashboard') {
    response.writeHead(200);
    response.end(JSON.stringify(monitor.snapshot()));
    return;
  }
  response.writeHead(404);
  response.end(JSON.stringify({ message: 'Not found' }));
});

const sockets = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws' || request.headers.origin !== config.webOrigin) {
    socket.destroy();
    return;
  }
  sockets.handleUpgrade(request, socket, head, (client) => {
    sockets.emit('connection', client);
  });
});
sockets.on('connection', (client) => {
  client.send(JSON.stringify(monitor.snapshot()));
});
monitor.subscribe((snapshot) => {
  const message = JSON.stringify(snapshot);
  for (const client of sockets.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Monitoring Kadis dev API: http://${config.host}:${config.port}`);
  monitor.start();
});
