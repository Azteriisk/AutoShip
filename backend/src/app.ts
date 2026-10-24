import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { RateController } from './controllers/rateController.js';
import { ShipmentController } from './controllers/shipmentController.js';
import { SettingsController } from './controllers/settingsController.js';
import { WebhookController } from './controllers/webhookController.js';

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
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

  // Rate Calculation & Boxes
  apiRouter.post('/rates/calculate', RateController.calculate);
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

  // Clover & EasyPost Webhooks & Simulation
  apiRouter.post('/webhooks/clover', WebhookController.handleCloverWebhook);
  apiRouter.post('/webhooks/easypost', WebhookController.handleEasyPostWebhook);
  apiRouter.post('/webhooks/simulate', WebhookController.simulateWebhook);
  apiRouter.get('/webhooks/logs', WebhookController.getLogs);

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
    res.sendFile(path.join(publicDir, 'index.html'));
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

