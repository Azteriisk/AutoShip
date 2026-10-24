import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { RateController } from './controllers/rateController.js';
import { ShipmentController } from './controllers/shipmentController.js';
import { SettingsController } from './controllers/settingsController.js';
import { WebhookController } from './controllers/webhookController.js';
import { PrinterController } from './controllers/printerController.js';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

/**
 * In-memory sliding-window IP rate limiter to protect sensitive endpoints from DoS attacks
 */
export function createInMemoryRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, { count: number; resetTime: number }>();

  // Cleanup expired entries periodically to prevent memory leaks
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, Math.max(options.windowMs, 10000));

  if (timer.unref) {
    timer.unref();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const now = Date.now();
    const record = store.get(ip);

    if (!record || now > record.resetTime) {
      store.set(ip, { count: 1, resetTime: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + options.windowMs) / 1000));
      return next();
    }

    record.count += 1;
    const remaining = Math.max(0, options.maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
}

export function createApp(): Express {
  const app = express();

  // Security Headers Middleware (OWASP recommended & strict transport security)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Middleware with raw body buffer preservation for webhook signature verification
  app.use(cors());
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf-8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Request logger in development
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'AutoShip Backend', version: '1.0.0' });
  });

  // API Routes
  const apiRouter = express.Router();

  // Rate Limiting instances for sensitive endpoints
  const isTest = process.env.NODE_ENV === 'test';
  const calculateRateLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: isTest ? 1000 : 60,
    message: 'Rate calculation limit exceeded. Please wait a moment before retrying.',
  });

  const webhookRateLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: isTest ? 1000 : 120,
    message: 'Webhook rate limit exceeded. Please try again later.',
  });

  // Rate Calculation & Boxes
  apiRouter.post('/rates/calculate', calculateRateLimiter, RateController.calculate);
  apiRouter.get('/rates/boxes', RateController.getBoxes);

  // Shipments & Label Management
  apiRouter.get('/shipments', ShipmentController.getShipments);
  apiRouter.get('/shipments/:id', ShipmentController.getShipmentById);
  apiRouter.get('/shipments/:id/label', ShipmentController.getLabel);
  apiRouter.post('/shipments/fulfill', ShipmentController.fulfill);
  apiRouter.post('/shipments/create-manual', ShipmentController.createManual);
  apiRouter.post('/shipments/:id/events', ShipmentController.addTrackingEvent);
  apiRouter.post('/shipments/:id/void', ShipmentController.voidShipment);

  // Merchant Settings & Packaging Presets & Promo Codes
  apiRouter.get('/settings', SettingsController.getSettings);
  apiRouter.put('/settings', SettingsController.updateSettings);
  apiRouter.post('/settings/sync-subscription', SettingsController.syncSubscription);
  apiRouter.get('/settings/presets', SettingsController.getPresets);
  apiRouter.post('/settings/presets', SettingsController.savePreset);
  apiRouter.delete('/settings/presets/:id', SettingsController.deletePreset);
  apiRouter.get('/settings/promos', SettingsController.getPromoCodes);
  apiRouter.post('/settings/promos', SettingsController.savePromoCode);
  apiRouter.delete('/settings/promos/:id', SettingsController.deletePromoCode);

  // Clover & EasyPost Webhooks & Simulation (Protected with rate limiter)
  apiRouter.use('/webhooks', webhookRateLimiter);
  apiRouter.post('/webhooks/clover', WebhookController.handleCloverWebhook);
  apiRouter.post('/webhooks/easypost', WebhookController.handleEasyPostWebhook);
  apiRouter.post('/webhooks/simulate', WebhookController.simulateWebhook);
  apiRouter.get('/webhooks/logs', WebhookController.getLogs);

  // Network Thermal Printers (Zebra, Rollo, Brother, Clover)
  apiRouter.post('/printers/print-label', PrinterController.printLabel);
  apiRouter.post('/printers/test', PrinterController.testPrinter);
  apiRouter.get('/printers/preview/:shipmentId', PrinterController.previewLabel);
  apiRouter.get('/printers/presets', PrinterController.getPresets);

  // Clover OAuth Callback
  app.get(['/oauth/clover', '/oauth/clover/callback'], async (req: Request, res: Response) => {
    try {
      const { code, merchant_id } = req.query;
      if (!code) {
        res.redirect('/dashboard?error=missing_code');
        return;
      }
      const { cloverService } = await import('./services/cloverService.js');
      await cloverService.exchangeOAuthCode(code as string);
      console.log(`[Clover OAuth] Successfully exchanged token for merchant: ${merchant_id}`);
      res.redirect('/dashboard?oauth=success');
    } catch (err: any) {
      console.error('[Clover OAuth] Error exchanging code:', err);
      res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(err.message)}`);
    }
  });

  app.use('/api', apiRouter);

  // Static Dashboard Assets
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));

  // Serve Dashboard on root or /dashboard
  app.get(['/', '/dashboard'], (req: Request, res: Response) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.redirect('/index.html');
    }
  });

  // 404 Handler for API
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}

const defaultApp = createApp();
export default defaultApp;

