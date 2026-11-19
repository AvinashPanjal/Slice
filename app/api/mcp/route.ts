import { NextResponse } from 'next/server';
import { validateAiAuth } from '@/lib/ai/auth';
import {
  getDashboardSummary,
  searchPerson,
  listLoans,
  getMonthlyDues,
  getOverdueDues,
} from '@/lib/ai/data-service';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, accept',
};

const MCP_TOOLS = [
  {
    name: 'get_dashboard_summary',
    description:
      'Get high-level summary of all finances: total lent, total collected, outstanding balance, this month’s due/pending amounts, and overdue counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_person_dues',
    description:
      'Search for a borrower or friend by name or phone number. Returns active loans, remaining balance, current month due, next due date, and whether paid.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Name or phone number of the person (e.g. "Abin")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_active_loans',
    description:
      'List loans with original principal, total with interest, total paid, remaining balance, EMI amounts, loan source (Bajaj, HDFC, Direct Cash), and tenure.',
    inputSchema: {
      type: 'object',
      properties: {
        borrowerType: {
          type: 'string',
          enum: ['ALL', 'PERSON', 'MYSELF'],
          description: 'Filter by borrower type: ALL, PERSON, or MYSELF',
        },
        status: {
          type: 'string',
          description: 'Filter by status: ACTIVE, CLOSED, ALL',
        },
      },
    },
  },
  {
    name: 'get_monthly_dues',
    description:
      'Get scheduled EMI dues for any month (defaults to current month) with paid/pending status for all borrowers.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'Month in YYYY-MM format (e.g., 2026-11). If omitted, uses current month.',
        },
      },
    },
  },
  {
    name: 'get_overdue_dues',
    description:
      'Get a list of all currently overdue dues and borrowers who missed their due dates.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Handles MCP Server-Sent Events (SSE) connection handshake or status info
 */
export async function GET(request: Request) {
  const auth = validateAiAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const host = request.headers.get('host') || 'slice-blush-ten.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const url = new URL(request.url);
  const keyParam = url.searchParams.get('key') ? `?key=${url.searchParams.get('key')}` : '';
  const postEndpoint = `${protocol}://${host}/api/mcp${keyParam}`;

  const acceptHeader = request.headers.get('accept') || '';

  // MCP SSE Transport handshake
  if (acceptHeader.includes('text/event-stream')) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: endpoint\ndata: ${postEndpoint}\n\n`));
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  // JSON summary for regular GET
  return NextResponse.json(
    {
      name: 'Slice MCP Server',
      description: 'Model Context Protocol (MCP) server for Slice loan management.',
      protocolVersion: '2024-11-05',
      endpoint: postEndpoint,
      availableTools: MCP_TOOLS.map((t) => t.name),
    },
    { headers: CORS_HEADERS }
  );
}

/**
 * Handles MCP JSON-RPC 2.0 requests
 */
export async function POST(request: Request) {
  const auth = validateAiAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: auth.error || 'Unauthorized' },
        id: null,
      },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body || {};

    if (jsonrpc !== '2.0') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
          id: id || null,
        },
        { headers: CORS_HEADERS }
      );
    }

    // Ping
    if (method === 'ping') {
      return NextResponse.json(
        { jsonrpc: '2.0', id, result: {} },
        { headers: CORS_HEADERS }
      );
    }

    // 1. Initialize
    if (method === 'initialize') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'slice-mcp-server',
              version: '1.0.0',
            },
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Initialized notification
    if (method === 'notifications/initialized') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 3. Tools list
    if (method === 'tools/list') {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    // 4. Tools call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      let toolResult: any = null;

      switch (toolName) {
        case 'get_dashboard_summary':
          toolResult = await getDashboardSummary();
          break;

        case 'search_person_dues':
          toolResult = await searchPerson(toolArgs.query || '');
          break;

        case 'list_active_loans':
          toolResult = await listLoans({
            borrowerType: toolArgs.borrowerType || 'ALL',
            status: toolArgs.status || 'ALL',
          });
          break;

        case 'get_monthly_dues':
          toolResult = await getMonthlyDues(toolArgs.month);
          break;

        case 'get_overdue_dues':
          toolResult = await getOverdueDues();
          break;

        default:
          return NextResponse.json(
            {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool not found: ${toolName}` },
            },
            { headers: CORS_HEADERS }
          );
      }

      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
              },
            ],
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not supported: ${method}` },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message || 'Internal error' },
        id: null,
      },
      { headers: CORS_HEADERS }
    );
  }
}
