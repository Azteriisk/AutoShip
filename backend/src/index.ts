import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AutoShip Backend Service & Clover Dashboard`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`📦 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔌 Webhook URL: http://localhost:${PORT}/api/webhooks/clover`);
  console.log(`====================================================`);
});
