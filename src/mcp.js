import { buildIndex, loadIndex, saveIndex, searchIndex, compressLog, dedupeSections } from './core.js';

const root = process.env.TOKENSHIELD_ROOT || process.cwd();

const TOOLS = [
  {
    name: 'tokenshield_search',
    description: 'Search locally indexed project files and retrieve relevant, line-numbered excerpts. Index is built automatically if missing. Source snippets are partial.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxTokens: { type: 'integer', minimum: 100, maximum: 10000 },
      },
      required: ['query'],
    },
  },
  {
    name: 'tokenshield_compress_log',
    description: 'Safely condense long build/test logs while preserving error and surrounding context. Returns original if safety budget exceeded.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        maxLines: { type: 'integer', minimum: 20, maximum: 1000 },
      },
      required: ['text'],
    },
  },
  {
    name: 'tokenshield_dedupe',
    description: 'Remove exact repeated paragraphs from supplied text.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'tokenshield_reindex',
    description: 'Rebuild local project index after source changes.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function resp(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function err(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function callTool(name, args) {
  switch (name) {
    case 'tokenshield_search': {
      const idx = loadIndex(root);
      return searchIndex(root, idx, args.query || '', { maxTokens: args.maxTokens || 1600 });
    }
    case 'tokenshield_compress_log':
      return compressLog(args.text || '', { maxLines: args.maxLines || 100 });
    case 'tokenshield_dedupe':
      return dedupeSections(args.text || '');
    case 'tokenshield_reindex': {
      const idx = buildIndex(root);
      saveIndex(root, idx);
      return { indexed: idx.files.length };
    }
    default:
      return undefined;
  }
}

async function handle(msg) {
  const { id, method, params = {} } = msg;

  if (method === 'initialize') {
    return resp(id, { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'tokenshield', version: '0.2.0' } });
  }
  if (method === 'notifications/initialized') return null;
  if (method === 'ping') return resp(id, {});
  if (method === 'tools/list') return resp(id, { tools: TOOLS });

  if (method === 'tools/call') {
    const args = params.arguments || {};
    if (!TOOLS.some((t) => t.name === params.name)) return err(id, -32602, 'Unknown tool');

    try {
      const output = await callTool(params.name, args);
      return resp(id, { content: [{ type: 'text', text: JSON.stringify(output) }] });
    } catch (e) {
      return resp(id, { isError: true, content: [{ type: 'text', text: String(e.message) }] });
    }
  }

  if (id !== undefined) return err(id, -32601, 'Unknown method');
  return null;
}

/**
 * Serve the MCP tools over stdio. MCP's stdio transport is newline-delimited
 * JSON-RPC, not LSP's Content-Length framing — each line is one message.
 */
export function serveMcp() {
  let pending = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    pending += chunk;
    if (pending.length > 10 * 1024 * 1024) {
      process.stderr.write('Oversized MCP request\n');
      process.exit(1);
    }

    let newlineAt;
    while ((newlineAt = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, newlineAt).trim();
      pending = pending.slice(newlineAt + 1);
      if (!line) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify(err(null, -32700, 'Parse error')) + '\n');
        continue;
      }

      Promise.resolve(handle(msg))
        .then((response) => {
          if (response) process.stdout.write(JSON.stringify(response) + '\n');
        })
        .catch((e) => {
          process.stdout.write(JSON.stringify(err(msg.id ?? null, -32603, e.message)) + '\n');
        });
    }
  });
}
