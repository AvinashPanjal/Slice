import express from 'express';
import QRCode from 'qrcode';
// @ts-ignore
import qrcodeTerminal from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import dotenv from 'dotenv';
import { handleBorrowerAIQuery } from './ai-middleware';
import { runDueRemindersBatch, initMonthlyReminderScheduler } from './scheduler';

dotenv.config();

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT) || 3000;

let currentQr: string | null = null;
let botStatus = 'Initializing...';
let qrImageSrc: string | null = null;

// Configure low-memory Puppeteer Chrome flags
const puppeteerArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-features=Translate,BackForwardCache,MediaRouter',
  '--disable-ipc-flooding-protection',
  '--disable-renderer-backgrounding',
  '--js-flags="--max-old-space-size=256"',
  '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

const puppeteerOptions: any = {
  headless: true,
  args: puppeteerArgs
};

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

console.log('Initializing WhatsApp Web Client for Lendwise (Slice)...');
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: puppeteerOptions
});

client.on('qr', async (qr) => {
  console.log('\n========================================');
  console.log('--- SCAN THIS QR CODE WITH WHATSAPP ---');
  qrcodeTerminal.generate(qr, { small: true });
  console.log('========================================\n');
  
  currentQr = qr;
  botStatus = 'Waiting for QR Code scan...';
  try {
    qrImageSrc = await QRCode.toDataURL(qr);
  } catch (err) {
    console.error('Failed to generate QR image:', err);
  }
});

client.on('ready', () => {
  console.log('🎉 Lendwise WhatsApp Bot Worker is Ready and Connected!');
  botStatus = 'Ready & Connected';
  currentQr = null;
  qrImageSrc = null;
});

client.on('authenticated', () => {
  console.log('🔑 WhatsApp Authentication successful!');
  botStatus = 'Authenticated. Starting session...';
});

client.on('auth_failure', (msg) => {
  console.error('❌ WhatsApp Auth Failure:', msg);
  botStatus = `Auth Failure: ${msg}`;
});

client.on('disconnected', async (reason) => {
  console.log('⚠️ WhatsApp Client disconnected:', reason);
  botStatus = `Disconnected: ${reason}`;
  try {
    await client.destroy();
  } catch (e) {
    // Ignore OS file lock errors on cleanup
  }
});

// Helper function to send WhatsApp text to a given phone number
async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  try {
    const cleanDigits = phone.replace(/\D/g, '');
    const chatId = cleanDigits.endsWith('@c.us') ? cleanDigits : `${cleanDigits}@c.us`;
    await client.sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error(`Failed to send WhatsApp message to ${phone}:`, err);
    return false;
  }
}

// Common message handler for incoming & self test queries
async function handleIncomingMessage(msg: any, isSelf: boolean) {
  try {
    if (msg.isStatus || msg.from === 'status@broadcast') return;

    const allowSelf = process.env.ALLOW_SELF_MESSAGES !== 'false';
    if (isSelf && !allowSelf) return;

    const body = msg.body ? msg.body.trim() : '';
    if (!body) return;

    if (isSelf && body.startsWith('🤖')) return;

    const prefix = process.env.BOT_PREFIX || '';
    if (prefix && !body.startsWith(prefix)) return;

    const userPrompt = prefix ? body.slice(prefix.length).trim() : body;
    if (!userPrompt) return;

    const isGroup = msg.from.endsWith('@g.us');
    if (isGroup && !prefix && process.env.ALLOW_GROUPS !== 'true') return;

    const senderPhone = isSelf ? (process.env.TEST_PHONE_NUMBER || '+916238851129') : msg.from;

    console.log(`📩 INCOMING BORROWER QUERY [${isSelf ? 'Self Test' : senderPhone}]: "${userPrompt}"`);

    // Process query using Gemini AI middleware + Supabase READ-ONLY lookup
    const aiReply = await handleBorrowerAIQuery(senderPhone, userPrompt);
    const formattedReply = `🤖 ${aiReply}`;

    await msg.reply(formattedReply);
    console.log(`📤 REPLIED to [${senderPhone}]`);
  } catch (err: any) {
    console.error('❌ Error handling borrower query:', err);
    try {
      await msg.reply(`🤖 ⚠️ Error processing query: ${err.message || 'Internal error'}`);
    } catch (sendErr) {
      console.error('Failed to send error reply:', sendErr);
    }
  }
}

client.on('message', async (msg) => {
  await handleIncomingMessage(msg, false);
});

client.on('message_create', async (msg) => {
  if (msg.fromMe) {
    await handleIncomingMessage(msg, true);
  }
});

// Express Web Dashboard & Health Endpoint
app.get('/', (req, res) => {
  const isConnected = botStatus === 'Ready & Connected';
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lendwise WhatsApp Bot Worker</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; }
        .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-align: center; max-width: 440px; width: 90%; }
        h1 { margin-top: 0; color: #0284c7; font-size: 1.5rem; }
        .status { margin: 1rem 0; padding: 0.6rem 1.2rem; border-radius: 20px; font-weight: 600; display: inline-block; }
        .status.connected { background: #dcfce7; color: #166534; }
        .status.waiting { background: #fef3c7; color: #92400e; }
        img { max-width: 250px; height: auto; border: 4px solid #0284c7; border-radius: 8px; margin-top: 1rem; }
        .footer { margin-top: 1.5rem; font-size: 0.85rem; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>📊 Lendwise WhatsApp Bot Worker</h1>
        <div class="status ${isConnected ? 'connected' : 'waiting'}">
          Status: ${botStatus}
        </div>
        
        ${qrImageSrc ? `
          <div>
            <p><strong>Scan QR code to connect WhatsApp:</strong></p>
            <img src="${qrImageSrc}" alt="WhatsApp QR Code" />
          </div>
        ` : `
          <p>${isConnected ? '✅ Bot is active and listening for borrower queries.' : '⏳ Initializing WhatsApp Web Client...'}</p>
        `}

        <div class="footer">
          Lendwise (Slice) AI Middleware • Test Recipient: <code>${process.env.TEST_PHONE_NUMBER || '+91 6238851129'}</code>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    botStatus,
    testPhone: process.env.TEST_PHONE_NUMBER || '+916238851129',
    timestamp: new Date().toISOString()
  });
});

// Admin API endpoint to trigger test reminders
app.post('/api/whatsapp/test-reminders', async (req, res) => {
  try {
    const customPhone = req.body?.testPhone || process.env.TEST_PHONE_NUMBER || '+916238851129';
    const report = await runDueRemindersBatch(sendWhatsAppMessage, customPhone);
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Lendwise WhatsApp Bot Worker running on http://0.0.0.0:${PORT}`);
  
  // Start monthly scheduler for 1st & 4th of every month
  initMonthlyReminderScheduler(sendWhatsAppMessage);

  client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    botStatus = `Initialization Error: ${err.message}`;
  });
});
