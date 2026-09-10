import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root and server .env files reliably
const rootEnv = path.resolve(__dirname, '../../.env');
const serverEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(serverEnv)) dotenv.config({ path: serverEnv });
dotenv.config();

import authRoutes from './routes/auth.js';
import regionRoutes from './routes/regions.js';
import riskZoneRoutes from './routes/risk_zones.js';
import reportRoutes from './routes/reports.js';
import alertRoutes from './routes/alerts.js';
import weatherRoutes from './routes/weather.js';
import mlRoutes from './routes/ml.js';
import analyticsRoutes from './routes/analytics.js';
import statusRoutes from './routes/status.js';
import pipelineRoutes from './routes/pipeline.js';
import databaseRoutes from './routes/database.js';
import { wsClients } from './services/alertDispatcher.js';
import { seedNERCommanders } from './db/seed_ner_commanders.js';

const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing & Payload Parsers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static file serving for report media uploads
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// WebSocket Server for Real-Time Landslide Alerts
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  wsClients.add(ws);
  console.log(`[WEBSOCKET] Client connected. Active clients: ${wsClients.size}`);

  // Heartbeat ping interval to keep connection persistent through proxies
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 25000);

  // Handle optional region filter from client
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.action === 'subscribe_region') {
        if (parsed.region_id) ws.region_id = parsed.region_id;
        if (Array.isArray(parsed.region_ids)) ws.region_ids = parsed.region_ids;
      }
    } catch {
      // ignore non-json messages
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    wsClients.delete(ws);
    console.log(`[WEBSOCKET] Client disconnected. Active clients: ${wsClients.size}`);
  });

  ws.on('error', (err) => {
    clearInterval(pingInterval);
    console.error('[WEBSOCKET ERROR]:', err.message);
    wsClients.delete(ws);
  });

  // Welcome ping
  ws.send(JSON.stringify({ event: 'connected', message: 'BhoomiRakshak Telemetry Stream Connected' }));
});

// Mount API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/risk-zones', riskZoneRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/data-pipeline', pipelineRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/historical-landslides', (req, res, next) => {
  // redirect or forward to pipelineRoutes /historical-landslides
  req.url = '/historical-landslides' + (req.url === '/' ? '' : req.url);
  pipelineRoutes(req, res, next);
});

// Root API discovery & health endpoints
app.get(['/', '/api'], (req, res) => {
  res.json({
    name: 'BhoomiRakshak Disaster Intelligence & Early Warning System API',
    status: 'OPERATIONAL',
    version: '2.0.0',
    region: 'North Eastern Region (NER) - 8 Himalayan States',
    endpoints: {
      discovery: '/api',
      health: '/health',
      auth: '/api/auth',
      regions: '/api/regions',
      risk_zones: '/api/risk-zones',
      reports: '/api/reports',
      alerts: '/api/alerts',
      weather: '/api/weather',
      ml: '/api/ml',
      analytics: '/api/analytics',
      status: '/api/status',
      data_pipeline: '/api/data-pipeline',
      database: '/api/database',
      historical_landslides: '/api/historical-landslides',
      websocket: '/ws'
    },
    timestamp: new Date().toISOString()
  });
});

// Root health probe
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'BhoomiRakshak Core Telemetry API',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🛡️  BhoomiRakshak Disaster Intelligence Server Running`);
  console.log(`📡  REST API:      http://localhost:${PORT}/api`);
  console.log(`⚡  WebSocket:     ws://localhost:${PORT}/ws`);
  console.log(`⚙️  Mode:          ${process.env.NODE_ENV || 'development'}`);
  console.log(`=======================================================`);
  try {
    await seedNERCommanders();
  } catch (seedErr) {
    console.warn('[SEED WARNING]:', seedErr.message);
  }
});
