import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'slice-blush-ten.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Slice - Loan & Dues Tracker API',
      description:
        'Secure read-only API to query loans, monthly EMI schedules, borrower balances, and overdue dues.',
      version: '1.0.0',
    },
    servers: [
      {
        url: baseUrl,
        description: 'Current Slice Server',
      },
      {
        url: 'https://slice-blush-ten.vercel.app',
        description: 'Vercel Production Deployment',
      },
    ],
    paths: {
      '/api/ai/summary': {
        get: {
          operationId: 'getDashboardSummary',
          summary: 'Get overall financial dashboard summary',
          description:
            'Returns total principal lent/borrowed, total collected, total outstanding balance, this month’s due/pending amounts, next due date, and overdue summary.',
          responses: {
            '200': {
              description: 'Financial dashboard statistics',
            },
          },
        },
      },
      '/api/ai/person': {
        get: {
          operationId: 'searchPersonDues',
          summary: 'Search a friend or borrower by name or phone',
          description:
            'Returns full details for a person: their active loans, remaining balance, current monthly due, next due date, whether they have paid this month, and pending EMI list.',
          parameters: [
            {
              name: 'name',
              in: 'query',
              required: false,
              description: 'Name or partial name of the borrower (e.g., Abin)',
              schema: {
                type: 'string',
              },
            },
            {
              name: 'phone',
              in: 'query',
              required: false,
              description: 'Phone number of the borrower',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Detailed person financial profile and loan breakdown',
            },
          },
        },
      },
      '/api/ai/loans': {
        get: {
          operationId: 'listLoans',
          summary: 'List active and historical loan records',
          description:
            'Returns all loans with original principal, total with interest, total paid, remaining balance, EMI amounts, loan source (Bajaj, HDFC, Direct Cash, etc.), and status.',
          parameters: [
            {
              name: 'type',
              in: 'query',
              required: false,
              description: 'Borrower type filter: ALL, PERSON (friend loans), or MYSELF (personal loans)',
              schema: {
                type: 'string',
                enum: ['ALL', 'PERSON', 'MYSELF'],
                default: 'ALL',
              },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Loan status filter: ALL, ACTIVE, PAUSED, CLOSED',
              schema: {
                type: 'string',
                default: 'ALL',
              },
            },
          ],
          responses: {
            '200': {
              description: 'List of matching loans',
            },
          },
        },
      },
      '/api/ai/dues': {
        get: {
          operationId: 'getMonthlyDues',
          summary: 'Get monthly EMI dues for a given month',
          description:
            'Returns all scheduled dues for a calendar month (e.g. 2026-11), showing who owes what, who has paid, who is pending, and due dates.',
          parameters: [
            {
              name: 'month',
              in: 'query',
              required: false,
              description: 'Calendar month in YYYY-MM format (defaults to current month if omitted)',
              schema: {
                type: 'string',
                example: '2026-11',
              },
            },
          ],
          responses: {
            '200': {
              description: 'List of dues for the specified month',
            },
          },
        },
      },
      '/api/ai/overdue': {
        get: {
          operationId: 'getOverdueDues',
          summary: 'Get all currently overdue dues across all borrowers',
          description:
            'Returns a list of all unpaid dues that have passed their 5th due date, including borrower name, phone, and overdue amount.',
          responses: {
            '200': {
              description: 'List of overdue payments',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'Provide your Slice AI Secret Key as Bearer token',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  };

  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}
