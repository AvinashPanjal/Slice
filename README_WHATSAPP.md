# 🤖 Lendwise (Slice) WhatsApp Gemini AI Integration

Integrates **Gemini 3.5 Flash AI Middleware** and **Automated 1st & 4th Monthly Due Reminders** into **Lendwise / Slice**.

---

## 🛑 STRICT SAFETY & DATABASE GUARANTEE

- **READ-ONLY DB Access**: ALL queries executed by the WhatsApp bot use `.select()` strictly.
- **ZERO Data Mutation**: The bot will **NEVER** run `INSERT`, `UPDATE`, `DELETE`, or `ALTER` statements against your Supabase database. Real financial data is 100% safe.

---

## 🧪 Test Phone Number & Dry-Run Mode

- Default Test Target Phone: **`+91 6238851129`**
- In Test Mode (`TEST_MODE=true`), all monthly reminder batches and test triggers are routed **exclusively** to `+91 6238851129` so you can verify WhatsApp outputs on your own phone without sending messages to actual borrowers.

---

## 🏗 Architecture (Vercel + Render/Railway Worker)

Since **Slice** is hosted on **Vercel** (serverless architecture):

1. **Vercel**: Hosts the Lendwise Web Frontend & Admin API preview endpoint `/api/whatsapp/test-reminders`.
2. **Render / Railway Worker**: Runs `lib/whatsapp/bot-worker.ts` container via `Dockerfile`. Keeps the active WhatsApp Web Puppeteer session alive, listens to borrower queries, and runs the 1st & 4th monthly due reminder cron job.

---

## ⚙️ Environment Variables

Add these environment variables to your Render / Railway worker deployment:

| Variable | Value / Description | Default |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | *(From Supabase)* |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (for READ-ONLY queries) | *(From Supabase)* |
| `GEMINI_API_KEY` | Gemini API Key from Google AI Studio | *(Your Gemini Key)* |
| `GEMINI_MODEL` | Gemini AI Model | `gemini-3.5-flash` |
| `TEST_MODE` | Set `true` to redirect all reminders to test phone | `true` |
| `TEST_PHONE_NUMBER` | Your phone number for testing | `+916238851129` |
| `ENABLE_AUTO_REMINDERS` | Set `true` when ready for live 1st & 4th auto-sending | `false` |
| `DEFAULT_UPI_ID` | Default UPI ID for payment links | `avinashpanjal5@okhdfcbank` |

---

## 🚀 How to Run Worker Locally

```bash
npm install
npm run whatsapp-worker
```

1. Open `http://localhost:3000` in your web browser.
2. Scan the QR code with WhatsApp (**Linked Devices > Link a Device**).
3. Send a message asking *"What is my due amount?"* from `+91 6238851129` to test the AI middleware!
