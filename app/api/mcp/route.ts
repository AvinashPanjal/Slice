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

export async function POST(request: Request) {
  const auth = validateAiAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: auth.error || 'Unauthorized' },
        id: null,
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { jsonrpc, id, method, params } = body || {};

    if (jsonrpc !== '2.0') {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
        id: id || null,
      });
    }

    // 1. Initialize
    if (method === 'initialize') {
      return NextResponse.json({
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
      });
    }

    // 2. Initialized notification
    if (method === 'notifications/initialized') {
      return new Response(null, { status: 204 });
    }

    // 3. Tools list
    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
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
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Tool not found: ${toolName}` },
          });
      }

      return NextResponse.json({
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
      });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not supported: ${method}` },
    });
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message || 'Internal error' },
      id: null,
    });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Slice MCP Server',
    description: 'Model Context Protocol (MCP) server for Slice loan management. Send JSON-RPC 2.0 POST requests to this endpoint with Authorization: Bearer <key>.',
    protocol: '2024-11-05',
    availableTools: MCP_TOOLS.map((t) => t.name),
  });
}
