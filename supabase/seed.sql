-- Seed Script for Development / Testing
-- Usage: Run this script in the Supabase SQL Editor after replacing 'YOUR_USER_ID' with your user's UUID.

-- DO NOT RUN directly in production without replacing YOUR_USER_ID.
-- Replace '00000000-0000-0000-0000-000000000000' with a real authenticated user ID.

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with auth.uid()
  v_rahul_id UUID;
  v_arjun_id UUID;
  v_slice_id UUID;
  v_navi_id UUID;
  v_loan1_id UUID;
  v_loan2_id UUID;
  v_loan3_id UUID;
  v_loan4_id UUID;
  v_due1_id UUID;
  v_due2_id UUID;
  v_due3_id UUID;
  v_pay1_id UUID;
BEGIN

  -- 1. Seed Loan Sources
  INSERT INTO public.loan_sources (user_id, name, notes)
  VALUES (v_user_id, 'Slice', 'Slice credit line app')
  RETURNING id INTO v_slice_id;

  INSERT INTO public.loan_sources (user_id, name, notes)
  VALUES (v_user_id, 'Navi', 'Navi instant cash loan app')
  RETURNING id INTO v_navi_id;

  -- 2. Seed People
  INSERT INTO public.people (user_id, name, phone, country_code, email, notes)
  VALUES (v_user_id, 'Rahul', '9876543210', '+91', 'rahul@example.com', 'Colleague from work')
  RETURNING id INTO v_rahul_id;

  INSERT INTO public.people (user_id, name, phone, country_code, email, notes)
  VALUES (v_user_id, 'Arjun', '9812345678', '+91', 'arjun@example.com', 'College friend')
  RETURNING id INTO v_arjun_id;

  -- 3. Seed Loans for Rahul (3 separate loans)
  -- Loan 1: Jan 10 - ₹5,000
  INSERT INTO public.loans (user_id, person_id, borrower_type, loan_source_id, original_amount, default_due_amount, repayment_type, taken_date, default_due_day, status)
  VALUES (v_user_id, v_rahul_id, 'PERSON', v_slice_id, 5000.00, 1000.00, 'FIXED_EMI', '2026-01-10', 10, 'ACTIVE')
  RETURNING id INTO v_loan1_id;

  -- Loan 2: Feb 18 - ₹8,000
  INSERT INTO public.loans (user_id, person_id, borrower_type, loan_source_id, original_amount, default_due_amount, repayment_type, taken_date, default_due_day, status)
  VALUES (v_user_id, v_rahul_id, 'PERSON', v_navi_id, 8000.00, 2000.00, 'FIXED_EMI', '2026-02-18', 18, 'ACTIVE')
  RETURNING id INTO v_loan2_id;

  -- Loan 3: Apr 5 - ₹3,000
  INSERT INTO public.loans (user_id, person_id, borrower_type, loan_source_id, original_amount, default_due_amount, repayment_type, taken_date, default_due_day, status)
  VALUES (v_user_id, v_rahul_id, 'PERSON', v_slice_id, 3000.00, 500.00, 'FLEXIBLE', '2026-04-05', 5, 'ACTIVE')
  RETURNING id INTO v_loan3_id;

  -- 4. Seed Monthly Dues for Rahul (July 2026)
  INSERT INTO public.monthly_dues (user_id, loan_id, person_id, due_month, due_date, original_amount, current_amount, status)
  VALUES (v_user_id, v_loan1_id, v_rahul_id, '2026-07', '2026-07-10', 1000.00, 1000.00, 'PAID')
  RETURNING id INTO v_due1_id;

  INSERT INTO public.monthly_dues (user_id, loan_id, person_id, due_month, due_date, original_amount, current_amount, status)
  VALUES (v_user_id, v_loan2_id, v_rahul_id, '2026-07', '2026-07-18', 2000.00, 2000.00, 'PENDING')
  RETURNING id INTO v_due2_id;

  INSERT INTO public.monthly_dues (user_id, loan_id, person_id, due_month, due_date, original_amount, current_amount, status)
  VALUES (v_user_id, v_loan3_id, v_rahul_id, '2026-07', '2026-07-30', 500.00, 500.00, 'PENDING')
  RETURNING id INTO v_due3_id;

  -- 5. Seed Payments for Rahul
  INSERT INTO public.payments (user_id, person_id, loan_id, monthly_due_id, amount, payment_date, payment_method, notes)
  VALUES (v_user_id, v_rahul_id, v_loan1_id, v_due1_id, 2000.00, '2026-07-10', 'UPI', 'UPI Transfer for Loan #1')
  RETURNING id INTO v_pay1_id;

  -- Payment allocation
  INSERT INTO public.payment_allocations (user_id, payment_id, monthly_due_id, loan_id, amount, allocation_type)
  VALUES (v_user_id, v_pay1_id, v_due1_id, v_loan1_id, 1000.00, 'DUE_PAYMENT');

  INSERT INTO public.payment_allocations (user_id, payment_id, monthly_due_id, loan_id, amount, allocation_type)
  VALUES (v_user_id, v_pay1_id, NULL, v_loan1_id, 1000.00, 'PRINCIPAL_REDUCTION');

  -- 6. Activity log
  INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, new_values, reason)
  VALUES (v_user_id, 'PAYMENT', v_pay1_id, 'PAYMENT_RECORDED', '{"amount": 2000, "person": "Rahul"}'::jsonb, 'Received ₹2,000 via UPI');

END $$;
