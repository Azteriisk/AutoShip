import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cloverService } from '../src/services/cloverService.js';
import { createApp, createInMemoryRateLimiter } from '../src/app.js';

describe('Security & Cryptography Audits', () => {
  const testSecret = 'clover_autoship_secret';

  describe('Clover Webhook HMAC-SHA256 Cryptographic Verification', () => {
    const payload = JSON.stringify({
      merchants: {
        MERCHANT_CLOVER_12345: [
          { objectId: 'O:CLOVER_ORD_88219', type: 'orders', action: 'UPDATE' },
        ],
      },
    });

    it('should verify valid HMAC-SHA256 hex digest', () => {
      const hmacHex = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');
      const isValid = cloverService.verifyWebhookSignature(hmacHex, payload);
      expect(isValid).toBe(true);
    });

    it('should verify valid HMAC-SHA256 base64 digest', () => {
      const hmacBase64 = crypto.createHmac('sha256', testSecret).update(payload).digest('base64');
      const isValid = cloverService.verifyWebhookSignature(hmacBase64, payload);
      expect(isValid).toBe(true);
    });

    it('should verify signature with sha256= or v1= prefix', () => {
      const hmacHex = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');
      const prefixedSig = `sha256=${hmacHex}`;
      const v1Prefixed = `v1=${hmacHex}`;

      expect(cloverService.verifyWebhookSignature(prefixedSig, payload)).toBe(true);
      expect(cloverService.verifyWebhookSignature(v1Prefixed, payload)).toBe(true);
    });

    it('should reject tampered or forged payloads', () => {
      const hmacHex = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');
      const tamperedPayload = JSON.stringify({
        merchants: {
          MERCHANT_ATTACKER_9999: [
            { objectId: 'O:CLOVER_ORD_FORGED', type: 'orders', action: 'UPDATE' },
          ],
        },
      });

      const isValid = cloverService.verifyWebhookSignature(hmacHex, tamperedPayload);
      expect(isValid).toBe(false);
    });

    it('should reject invalid or manipulated signatures', () => {
      const forgedSig = 'abcdef1234567890deadbeefcafebabef00d1234567890abcdef1234567890aa';
      const isValid = cloverService.verifyWebhookSignature(forgedSig, payload);
      expect(isValid).toBe(false);
    });

    it('should reject missing signature header', () => {
      expect(cloverService.verifyWebhookSignature(undefined, payload)).toBe(false);
      expect(cloverService.verifyWebhookSignature('', payload)).toBe(false);
    });

    it('should support sandbox verification code and shared secret fallback', () => {
      // Direct shared secret
      expect(cloverService.verifyWebhookSignature(testSecret, payload)).toBe(true);

      // Dynamic sandbox handshake verification code
      const verificationCode = 'clover_sandbox_verification_token_7788';
      expect(cloverService.verifyWebhookSignature(verificationCode, payload, verificationCode)).toBe(true);
    });
  });

  describe('Backend Security Headers Middleware', () => {
    it('should include OWASP security and HSTS headers on responses', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        expect(res.status).toBe(200);

        expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
        expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
        expect(res.headers.get('strict-transport-security')).toContain('includeSubDomains');
        expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
        expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      } finally {
        server.close();
      }
    });
  });

  describe('In-Memory IP Rate Limiter Middleware', () => {
    it('should enforce 429 Too Many Requests when rate threshold is exceeded', async () => {
      const limiter = createInMemoryRateLimiter({
        windowMs: 10000,
        maxRequests: 3,
        message: 'Rate limit exceeded for test',
      });

      const mockReq = {
        headers: { 'x-forwarded-for': '198.51.100.42' },
        socket: { remoteAddress: '198.51.100.42' },
      } as any;

      let statusCode = 200;
      let responseBody: any = null;
      const headersSent = new Map<string, any>();

      const mockRes = {
        setHeader: (k: string, v: any) => headersSent.set(k, v),
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              responseBody = body;
            },
          };
        },
      } as any;

      const next = () => {};

      // Requests 1, 2, 3 should succeed
      limiter(mockReq, mockRes, next);
      expect(headersSent.get('X-RateLimit-Remaining')).toBe(2);

      limiter(mockReq, mockRes, next);
      expect(headersSent.get('X-RateLimit-Remaining')).toBe(1);

      limiter(mockReq, mockRes, next);
      expect(headersSent.get('X-RateLimit-Remaining')).toBe(0);

      // Request 4 should be blocked with 429
      limiter(mockReq, mockRes, next);
      expect(statusCode).toBe(429);
      expect(responseBody?.success).toBe(false);
      expect(responseBody?.error).toBe('Rate limit exceeded for test');
      expect(headersSent.get('Retry-After')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Webhook Endpoints Security Integration', () => {
    it('should reject unauthorized Clover webhook requests with 401', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/clover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Clover-Auth': 'forged_unauthorized_token',
          },
          body: JSON.stringify({ orderId: 'FAKE_ORDER' }),
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Unauthorized webhook signature');
      } finally {
        server.close();
      }
    });

    it('should handle Clover verificationCode handshake without signature', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/clover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationCode: 'clover_test_handshake_code_99' }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.verificationCode).toBe('clover_test_handshake_code_99');
      } finally {
        server.close();
      }
    });

    it('should accept Clover webhook with valid HMAC-SHA256 signature', async () => {
      const app = createApp();
      const server = app.listen(0);
      const port = (server.address() as any).port;

      const payload = JSON.stringify({ orderId: 'DEMO_ORD_1001' });
      const signature = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/clover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Clover-Auth': signature,
          },
          body: payload,
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      } finally {
        server.close();
      }
    });
  });

  describe('Android Network Security & Cleartext Traffic Audit', () => {
    it('should have usesCleartextTraffic="false" in AndroidManifest.xml', () => {
      const manifestPath = path.resolve(process.cwd(), '../android/app/src/main/AndroidManifest.xml');
      const content = fs.readFileSync(manifestPath, 'utf-8');
      expect(content).toContain('android:usesCleartextTraffic="false"');
      expect(content).not.toContain('android:usesCleartextTraffic="true"');
    });

    it('should enforce strict TLS and deny cleartext traffic in network_security_config.xml', () => {
      const configPath = path.resolve(
        process.cwd(),
        '../android/app/src/main/res/xml/network_security_config.xml'
      );
      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('cleartextTrafficPermitted="false"');
      expect(content).not.toContain('cleartextTrafficPermitted="true"');
      expect(content).toContain('<certificates src="system" />');
      expect(content).not.toContain('<certificates src="user" />');
    });
  });
});
