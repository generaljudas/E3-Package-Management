import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import database
import { initDatabase, closeDatabase } from './models/database.js';

// Import routes
import mailboxRoutes from './routes/mailboxes.js';
import tenantRoutes from './routes/tenants.js';
import packageRoutes from './routes/packages.js';
import pickupRoutes from './routes/pickups.js';
import signatureRoutes from './routes/signatures.js';
import reportRoutes from './routes/reports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (ensure we load backend/.env regardless of cwd)
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration (allow common localhost dev ports and Electron)
app.use(cors({
  origin: (origin, callback) => {
    const defaultOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const allowedOrigins = new Set([
      defaultOrigin,
      'http://localhost:5173',
      'http://localhost:5174',
    ]);
    // Allow non-browser clients, Electron (file:// protocol), or same-origin requests
    if (!origin || origin.startsWith('file://')) return callback(null, true);
    if (allowedOrigins.has(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Large limit for signature images
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-beta.1',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-beta.1',
  });
});

// API routes
app.use('/api/mailboxes', mailboxRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/reports', reportRoutes);

// Serve static files (for uploaded signatures, etc.)
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Database connection errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Database connection failed',
      message: 'Please check database configuration',
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.details || err.message,
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await closeDatabase();
  process.exit(0);
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize SQLite database
    await initDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 E3 Package Manager API running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: SQLite (${process.env.ELECTRON_MODE === 'true' ? 'Electron' : 'Dev'} mode)`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

export default app;