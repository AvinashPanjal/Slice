-- LendTrack PostgreSQL Database Schema Migration for Supabase
-- Enables Row Level Security (RLS) across all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  default_currency TEXT DEFAULT 'INR',
  default_country_code TEXT DEFAULT '+91',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PEOPLE
CREATE TABLE IF NOT EXISTS public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country_code TEXT DEFAULT '+91',
  email TEXT,
  notes TEXT,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. LOAN SOURCES
CREATE TABLE IF NOT EXISTS public.loan_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LOANS
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  borrower_type TEXT NOT NULL CHECK (borrower_type IN ('PERSON', 'MYSELF')),
  loan_source_id UUID REFERENCES public.loan_sources(id) ON DELETE SET NULL,
  original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount > 0),
  default_due_amount NUMERIC(12, 2) CHECK (default_due_amount >= 0),
  repayment_type TEXT NOT NULL DEFAULT 'FIXED_EMI' CHECK (repayment_type IN ('FIXED_EMI', 'FLEXIBLE')),
  taken_date DATE NOT NULL,
  first_due_date DATE,
  default_due_day INT CHECK (default_due_day BETWEEN 1 AND 31),
  installment_count INT CHECK (installment_count > 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. MONTHLY DUES
CREATE TABLE IF NOT EXISTS public.monthly_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
  due_month TEXT NOT NULL, -- Format: YYYY-MM
  due_date DATE NOT NULL,
  original_amount NUMERIC(12, 2) NOT NULL CHECK (original_amount >= 0),
  current_amount NUMERIC(12, 2) NOT NULL CHECK (current_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('UPCOMING', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'SKIPPED')),
  is_manually_adjusted BOOLEAN DEFAULT false,
  adjustment_reason TEXT,
  carried_from_due_id UUID REFERENCES public.monthly_dues(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  monthly_due_id UUID REFERENCES public.monthly_dues(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  monthly_due_id UUID REFERENCES public.monthly_dues(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  allocation_type TEXT NOT NULL DEFAULT 'DUE_PAYMENT' CHECK (allocation_type IN ('DUE_PAYMENT', 'PRINCIPAL_REDUCTION', 'ADVANCE_CREDIT', 'NEXT_MONTH_DUE')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. ADJUSTMENTS
CREATE TABLE IF NOT EXISTS public.adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  monthly_due_id UUID REFERENCES public.monthly_dues(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('CORRECTION_ADD', 'CORRECTION_SUB', 'WAIVER', 'OPENING_BALANCE')),
  reason TEXT NOT NULL,
  adjustment_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. REMINDER TEMPLATES
CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('NORMAL', 'UPCOMING', 'OVERDUE', 'PARTIAL')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_people_user_id ON public.people(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_person_id ON public.loans(person_id);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_user_id ON public.monthly_dues(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_loan_id ON public.monthly_dues(loan_id);
CREATE INDEX IF NOT EXISTS idx_monthly_dues_month ON public.monthly_dues(due_month);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_person_id ON public.payments(person_id);
CREATE INDEX IF NOT EXISTS idx_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.activity_logs(user_id);

-- ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- People Policies
CREATE POLICY "Users access own people" ON public.people FOR ALL USING (auth.uid() = user_id);

-- Loan Sources Policies
CREATE POLICY "Users access own loan sources" ON public.loan_sources FOR ALL USING (auth.uid() = user_id);

-- Loans Policies
CREATE POLICY "Users access own loans" ON public.loans FOR ALL USING (auth.uid() = user_id);

-- Monthly Dues Policies
CREATE POLICY "Users access own dues" ON public.monthly_dues FOR ALL USING (auth.uid() = user_id);

-- Payments Policies
CREATE POLICY "Users access own payments" ON public.payments FOR ALL USING (auth.uid() = user_id);

-- Payment Allocations Policies
CREATE POLICY "Users access own allocations" ON public.payment_allocations FOR ALL USING (auth.uid() = user_id);

-- Adjustments Policies
CREATE POLICY "Users access own adjustments" ON public.adjustments FOR ALL USING (auth.uid() = user_id);

-- Activity Logs Policies
CREATE POLICY "Users access own logs" ON public.activity_logs FOR ALL USING (auth.uid() = user_id);

-- Reminder Templates Policies
CREATE POLICY "Users access own reminder templates" ON public.reminder_templates FOR ALL USING (auth.uid() = user_id);

-- FUNCTION: Handle new user profile creation automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');

  -- Insert default reminder templates for user
  INSERT INTO public.reminder_templates (user_id, name, type, template)
  VALUES
    (new.id, 'Standard Friendly Reminder', 'NORMAL', 'Hi {name} 👋\n\nThis is a friendly reminder regarding your pending payment for {month}.\nTotal Due: ₹{due_amount}\nPaid: ₹{paid_amount}\nRemaining: ₹{remaining_amount}\n\nPlease make the remaining payment when possible. Thank you!'),
    (new.id, 'Upcoming Payment Reminder', 'UPCOMING', 'Hi {name} 👋\n\nJust a reminder that your monthly due of ₹{remaining_amount} is coming up on {due_date}.\n\nThank you!'),
    (new.id, 'Overdue Payment Urgent', 'OVERDUE', 'Hi {name} 👋\n\nYour payment for {month} of ₹{remaining_amount} was due on {due_date} and is currently OVERDUE.\n\nPlease clear this balance as soon as possible.'),
    (new.id, 'Partial Payment Reminder', 'PARTIAL', 'Hi {name} 👋\n\nThank you for your recent payment of ₹{recent_payment}. Your remaining balance for {month} is ₹{remaining_amount}.\n\nThank you!');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
