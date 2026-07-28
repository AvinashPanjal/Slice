# LendWise 💰

A modern personal loan & payment reminder tracker built with **Next.js 14**, **Supabase**, and **TypeScript**.

## Features

- 📊 **Dashboard** — Real-time portfolio overview with charts and priority "Needs Attention" section
- 👥 **People Ledger** — Full borrower directory with per-person financial summaries
- 🏦 **Loans** — Multi-loan tracking per person with status lifecycle (Active → Closed → Archived)
- 💳 **Payments** — Multi-loan payment allocation ledger with receipt generation
- 📅 **Monthly Dues** — Auto-generated dues with carry-forward and manual overrides
- 🗓️ **Calendar View** — Interactive monthly calendar for due dates
- ⚠️ **Overdue Manager** — Grouped overdue view with one-click WhatsApp reminders
- 📈 **Reports** — Bar/pie charts for portfolio breakdown by source and borrower
- ⚙️ **Settings** — WhatsApp message template editor & user profile preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth + RLS |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel |

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/mravinash222324-dev/Slice.git
cd Slice
npm install
```

### 2. Configure environment

Create `.env.local` in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run the database migration

In your Supabase project SQL editor, run the full schema file:

```
supabase/migrations/20260728_initial_schema.sql
```

### 4. (Optional) Seed demo data

After signing up, get your user ID from Supabase Auth → Users, then edit and run:

```
supabase/seed.sql
```

### 5. Start development server

```bash
npm run dev
```

Visit **http://localhost:3000**

## Deployment (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Next.js

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | User settings & defaults |
| `people` | Borrowers directory |
| `loan_sources` | App/source labels (e.g. "PhonePe", "HDFC") |
| `loans` | Individual loan records |
| `monthly_dues` | Per-month due records per loan |
| `payments` | Incoming payment entries |
| `payment_allocations` | Multi-loan split per payment |
| `adjustments` | Manual corrections, waivers, opening balances |
| `reminder_templates` | WhatsApp message templates |
| `activity_logs` | Audit trail |

## WhatsApp Reminder Variables

Templates support: `{name}`, `{month}`, `{due_amount}`, `{paid_amount}`, `{remaining_amount}`, `{due_date}`

## License

MIT — Personal use only. Not a banking application.
