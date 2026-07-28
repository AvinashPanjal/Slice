import { describe, it, expect } from 'vitest';
import {
  calculateTotalBorrowed,
  calculateTotalPaid,
  calculateLoanRemaining,
  calculateDuePaid,
  calculateDueRemaining,
  deriveDueStatus,
  aggregatePersonSummary,
  autoAllocatePayment,
} from './index';
import { Loan, MonthlyDue, PaymentAllocation, Adjustment, Person } from '../types';

describe('Financial Calculation Rules Engine', () => {
  const dummyPerson: Person = {
    id: 'p-rahul',
    user_id: 'u-1',
    name: 'Rahul',
    phone: '9876543210',
    country_code: '+91',
    is_archived: false,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const loan1: Loan = {
    id: 'l-1',
    user_id: 'u-1',
    person_id: 'p-rahul',
    borrower_type: 'PERSON',
    original_amount: 5000,
    repayment_type: 'FIXED_EMI',
    taken_date: '2026-01-10',
    status: 'ACTIVE',
    created_at: '2026-01-10',
    updated_at: '2026-01-10',
  };

  const loan2: Loan = {
    id: 'l-2',
    user_id: 'u-1',
    person_id: 'p-rahul',
    borrower_type: 'PERSON',
    original_amount: 8000,
    repayment_type: 'FIXED_EMI',
    taken_date: '2026-02-18',
    status: 'ACTIVE',
    created_at: '2026-02-18',
    updated_at: '2026-02-18',
  };

  const loan3: Loan = {
    id: 'l-3',
    user_id: 'u-1',
    person_id: 'p-rahul',
    borrower_type: 'PERSON',
    original_amount: 3000,
    repayment_type: 'FLEXIBLE',
    taken_date: '2026-04-05',
    status: 'ACTIVE',
    created_at: '2026-04-05',
    updated_at: '2026-04-05',
  };

  it('1. Exact Payment: Due ₹2,000, Payment ₹2,000 -> Pending ₹0', () => {
    const due: MonthlyDue = {
      id: 'd-1',
      user_id: 'u-1',
      loan_id: 'l-1',
      person_id: 'p-rahul',
      due_month: '2026-07',
      due_date: '2026-07-10',
      original_amount: 2000,
      current_amount: 2000,
      status: 'PENDING',
      is_manually_adjusted: false,
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    };
    const allocations: PaymentAllocation[] = [
      {
        id: 'a-1',
        user_id: 'u-1',
        payment_id: 'pay-1',
        monthly_due_id: 'd-1',
        loan_id: 'l-1',
        amount: 2000,
        allocation_type: 'DUE_PAYMENT',
        created_at: '2026-07-10',
      },
    ];

    const paid = calculateDuePaid(due, allocations);
    const pending = calculateDueRemaining(due, allocations);
    const status = deriveDueStatus(due, paid, '2026-07-15');

    expect(paid).toBe(2000);
    expect(pending).toBe(0);
    expect(status).toBe('PAID');
  });

  it('2. Partial Payment: Due ₹2,000, Payment ₹500 -> Pending ₹1,500', () => {
    const due: MonthlyDue = {
      id: 'd-2',
      user_id: 'u-1',
      loan_id: 'l-1',
      person_id: 'p-rahul',
      due_month: '2026-07',
      due_date: '2026-07-10',
      original_amount: 2000,
      current_amount: 2000,
      status: 'PENDING',
      is_manually_adjusted: false,
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    };
    const allocations: PaymentAllocation[] = [
      {
        id: 'a-2',
        user_id: 'u-1',
        payment_id: 'pay-2',
        monthly_due_id: 'd-2',
        loan_id: 'l-1',
        amount: 500,
        allocation_type: 'DUE_PAYMENT',
        created_at: '2026-07-05',
      },
    ];

    const paid = calculateDuePaid(due, allocations);
    const pending = calculateDueRemaining(due, allocations);
    const status = deriveDueStatus(due, paid, '2026-07-15');

    expect(paid).toBe(500);
    expect(pending).toBe(1500);
    expect(status).toBe('PARTIALLY_PAID');
  });

  it('3. Multiple Payments: Due ₹3,500, Payments ₹1,000 + ₹500 + ₹2,000 -> Pending ₹0', () => {
    const due: MonthlyDue = {
      id: 'd-3',
      user_id: 'u-1',
      loan_id: 'l-1',
      person_id: 'p-rahul',
      due_month: '2026-07',
      due_date: '2026-07-10',
      original_amount: 3500,
      current_amount: 3500,
      status: 'PENDING',
      is_manually_adjusted: false,
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    };
    const allocations: PaymentAllocation[] = [
      { id: 'a-31', user_id: 'u-1', payment_id: 'pay-31', monthly_due_id: 'd-3', loan_id: 'l-1', amount: 1000, allocation_type: 'DUE_PAYMENT', created_at: '2026-07-02' },
      { id: 'a-32', user_id: 'u-1', payment_id: 'pay-32', monthly_due_id: 'd-3', loan_id: 'l-1', amount: 500, allocation_type: 'DUE_PAYMENT', created_at: '2026-07-05' },
      { id: 'a-33', user_id: 'u-1', payment_id: 'pay-33', monthly_due_id: 'd-3', loan_id: 'l-1', amount: 2000, allocation_type: 'DUE_PAYMENT', created_at: '2026-07-09' },
    ];

    const paid = calculateDuePaid(due, allocations);
    const pending = calculateDueRemaining(due, allocations);
    const status = deriveDueStatus(due, paid, '2026-07-15');

    expect(paid).toBe(3500);
    expect(pending).toBe(0);
    expect(status).toBe('PAID');
  });

  it('4. Extra Payment: Due ₹2,000, Payment ₹3,500 -> Extra ₹1,500', () => {
    const due: MonthlyDue = {
      id: 'd-4',
      user_id: 'u-1',
      loan_id: 'l-1',
      person_id: 'p-rahul',
      due_month: '2026-07',
      due_date: '2026-07-10',
      original_amount: 2000,
      current_amount: 2000,
      status: 'PENDING',
      is_manually_adjusted: false,
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    };

    const autoAlloc = autoAllocatePayment(3500, [due], [loan1], []);
    expect(autoAlloc.allocatedDues.length).toBe(1);
    expect(autoAlloc.allocatedDues[0].amount).toBe(2000);
    expect(autoAlloc.remainingExcess).toBe(1500);
  });

  it('5. Waived Amount: Due ₹3,500, Paid ₹2,000, Waive ₹1,500 -> No overdue balance', () => {
    const due: MonthlyDue = {
      id: 'd-5',
      user_id: 'u-1',
      loan_id: 'l-1',
      person_id: 'p-rahul',
      due_month: '2026-07',
      due_date: '2026-07-10',
      original_amount: 3500,
      current_amount: 3500,
      status: 'WAIVED',
      is_manually_adjusted: true,
      created_at: '2026-07-01',
      updated_at: '2026-07-01',
    };
    const allocations: PaymentAllocation[] = [
      { id: 'a-5', user_id: 'u-1', payment_id: 'pay-5', monthly_due_id: 'd-5', loan_id: 'l-1', amount: 2000, allocation_type: 'DUE_PAYMENT', created_at: '2026-07-10' }
    ];
    const adjustments: Adjustment[] = [
      { id: 'adj-5', user_id: 'u-1', person_id: 'p-rahul', loan_id: 'l-1', monthly_due_id: 'd-5', amount: 1500, adjustment_type: 'WAIVER', reason: 'Waived remaining', adjustment_date: '2026-07-12', created_at: '2026-07-12' }
    ];

    const summary = aggregatePersonSummary(dummyPerson, [loan1], [due], allocations, adjustments, '2026-07', '2026-07-28');
    expect(summary.overdue_amount).toBe(0);
  });

  it('6. Multiple Loans Aggregation: Rahul has 3 loans total ₹16,000', () => {
    const totalBorrowed = calculateTotalBorrowed([loan1, loan2, loan3]);
    expect(totalBorrowed).toBe(16000);
  });
});
