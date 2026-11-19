#!/usr/bin/env tsx
import * as readline from 'readline';

/**
 * Slice Model Context Protocol (MCP) Stdio Server
 * Connects Claude Desktop, Cursor, or any MCP client to your Slice loans tracker.
 */

const API_BASE_URL = process.env.SLICE_API_URL || 'https://slice-blush-ten.vercel.app';
const API_KEY = process.env.SLICE_AI_API_KEY || 'slice_sec_99a8b7c6d5e4';

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

async function callSliceApi(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    });
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'x-api-key': API_KEY,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Slice API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

function sendResponse(response: any) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);
    const { jsonrpc, id, method, params } = msg;

    if (jsonrpc !== '2.0') {
      sendResponse({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request' },
      });
      return;
    }

    if (method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'slice-mcp-stdio', version: '1.0.0' },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      return;
    }

    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      let toolData: any = null;

      switch (toolName) {
        case 'get_dashboard_summary':
          toolData = await callSliceApi('/api/ai/summary');
          break;

        case 'search_person_dues':
          toolData = await callSliceApi('/api/ai/person', { name: toolArgs.query });
          break;

        case 'list_active_loans':
          toolData = await callSliceApi('/api/ai/loans', {
            type: toolArgs.borrowerType,
            status: toolArgs.status,
          });
          break;

        case 'get_monthly_dues':
          toolData = await callSliceApi('/api/ai/dues', { month: toolArgs.month });
          break;

        case 'get_overdue_dues':
          toolData = await callSliceApi('/api/ai/overdue');
          break;

        default:
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Tool not found: ${toolName}` },
          });
          return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toolData, null, 2),
            },
          ],
        },
      });
      return;
    }

    sendResponse({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err: any) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: err.message || 'Internal error' },
    });
  }
});
