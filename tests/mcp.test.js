/**
 * The public MCP server (api/mcp.js) must speak JSON-RPC 2.0 over Streamable
 * HTTP and return exactly what the quote API returns for the same input.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import handler, { RATE_LIMIT, MAX_BODY_BYTES, resetRateLimit } from '../api/mcp.js';
import {
  buildQuote,
  buildPricingSummary,
  parseQuoteQuery,
  BUSINESS,
  INPUT_OPTIONS,
  MCP_URL,
} from '../src/services/lib/hull-cleaning-public.js';

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

function mockReq({ method = 'POST', body, headers = {} } = {}) {
  return { method, headers: { 'x-forwarded-for': '203.0.113.7', ...headers }, body };
}

async function call(body, opts = {}) {
  const res = mockRes();
  await handler(mockReq({ body, ...opts }), res);
  return res;
}

const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

beforeEach(() => resetRateLimit());

describe('MCP lifecycle', () => {
  it('initialize echoes a supported protocol version and describes the server', async () => {
    const res = await call(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }));
    expect(res.statusCode).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.id).toBe(1);
    const r = res.body.result;
    expect(r.protocolVersion).toBe('2025-06-18');
    expect(r.serverInfo.name).toBe('briancline-hull-cleaning');
    expect(r.capabilities).toEqual({ tools: {} });
    expect(r.instructions).toMatch(/Berkeley Marina/);
    expect(r.instructions).toContain(BUSINESS.name);
  });

  it('initialize falls back to the latest supported version for an unknown one', async () => {
    const res = await call(rpc('initialize', { protocolVersion: '1999-01-01' }));
    expect(res.body.result.protocolVersion).toBe('2025-11-25');
  });

  it('accepts notifications/initialized with 202 and no body', async () => {
    const res = await call({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res.statusCode).toBe(202);
    expect(res.body).toBeUndefined();
    expect(res.ended).toBe(true);
  });

  it('answers ping', async () => {
    const res = await call(rpc('ping', undefined, 'abc'));
    expect(res.body).toEqual({ jsonrpc: '2.0', id: 'abc', result: {} });
  });
});

describe('tools/list', () => {
  it('lists both tools with schemas and read-only annotations', async () => {
    const res = await call(rpc('tools/list'));
    const tools = res.body.result.tools;
    expect(tools.map((t) => t.name).sort()).toEqual(['estimate_hull_cleaning', 'get_hull_cleaning_rates']);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object');
      expect(t.description).toMatch(/Berkeley Marina only/);
      expect(t.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false, idempotentHint: true });
    }
    const est = tools.find((t) => t.name === 'estimate_hull_cleaning');
    expect(Object.keys(est.inputSchema.properties).sort()).toEqual(
      ['anodes', 'boatType', 'frequency', 'hull', 'lastCleaned', 'length', 'paintAge', 'propellers', 'service'].sort()
    );
    expect(est.inputSchema.properties.service.enum).toEqual(INPUT_OPTIONS.service);
    expect(est.inputSchema.properties.paintAge.enum).toEqual(INPUT_OPTIONS.paintAge);
    expect(est.inputSchema.properties.lastCleaned.enum).toEqual(INPUT_OPTIONS.lastCleaned);
    expect(est.inputSchema.properties.length).toMatchObject({ type: 'integer', minimum: 1, maximum: 200 });
  });
});

describe('tools/call', () => {
  it('estimate_hull_cleaning returns exactly buildQuote for the same input', async () => {
    const args = { service: 'cleaning', length: 35, frequency: 'monthly', paintAge: '1-1.5yr', lastCleaned: '2-4', anodes: 2 };
    const res = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: args }));
    const result = res.body.result;
    expect(result.isError).toBeFalsy();
    const expected = buildQuote(parseQuoteQuery(args).input);
    expect(result.structuredContent).toEqual(expected);

    const text = result.content[0].text;
    expect(result.content[0].type).toBe('text');
    expect(text).toContain(BUSINESS.name);
    expect(text).toContain(`$${expected.estimate.total.toFixed(2)} per visit`);
    expect(text).toContain(expected.orderUrl);
    expect(text).toMatch(/Berkeley Marina only/);
    expect(text).toMatch(/growth found at service time/);
    expect(text).toMatch(/Nothing is booked or charged/);
    expect(text).not.toMatch(/\u2014/);
  });

  it('describes a one-time estimate as one-time', async () => {
    const res = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: { length: 30, frequency: 'onetime' } }));
    expect(res.body.result.content[0].text).toMatch(/\(one-time service\)/);
  });

  it('invalid input is a tool error with the validation message', async () => {
    const res = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: { service: 'cleaning', length: 500 } }));
    expect(res.statusCode).toBe(200);
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toContain('length must be a whole number from 1 to 200');
  });

  it('missing length is a tool error', async () => {
    const res = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: {} }));
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/length is required/);
  });

  it('unknown arguments are a tool error', async () => {
    const res = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: { length: 30, color: 'blue' } }));
    expect(res.body.result.isError).toBe(true);
    expect(res.body.result.content[0].text).toMatch(/unknown argument\(s\) color/);
  });

  it('get_hull_cleaning_rates returns the pricing summary', async () => {
    const res = await call(rpc('tools/call', { name: 'get_hull_cleaning_rates', arguments: {} }));
    const result = res.body.result;
    expect(result.structuredContent).toEqual(buildPricingSummary());
    expect(result.content[0].text).toMatch(/Berkeley Marina only/);
    expect(result.content[0].text).not.toMatch(/\u2014/);
  });

  it('unknown tool and bad arguments are -32602', async () => {
    const a = await call(rpc('tools/call', { name: 'book_cleaning', arguments: {} }));
    expect(a.body.error.code).toBe(-32602);
    const b = await call(rpc('tools/call', { name: 'estimate_hull_cleaning', arguments: 'length=35' }));
    expect(b.body.error.code).toBe(-32602);
    const c = await call(rpc('tools/call', {}));
    expect(c.body.error.code).toBe(-32602);
  });
});

describe('JSON-RPC errors', () => {
  it('unknown method is -32601', async () => {
    const res = await call(rpc('resources/list', undefined, 7));
    expect(res.body).toEqual({ jsonrpc: '2.0', id: 7, error: { code: -32601, message: 'Method not found: resources/list' } });
  });

  it('malformed JSON is -32700', async () => {
    const res = await call('{"jsonrpc": "2.0", "id": 1, "method": ');
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe(-32700);
    expect(res.body.id).toBeNull();
  });

  it('a body getter that throws (Vercel on bad JSON) is -32700', async () => {
    const req = mockReq();
    Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON'); } });
    const res = mockRes();
    await handler(req, res);
    expect(res.body.error.code).toBe(-32700);
  });

  it('a non-JSON-RPC object is -32600', async () => {
    const res = await call({ hello: 'world' });
    expect(res.body.error.code).toBe(-32600);
  });

  it('an empty batch is -32600; a batch returns one response per request', async () => {
    const empty = await call([]);
    expect(empty.body.error.code).toBe(-32600);
    const res = await call([rpc('ping', undefined, 1), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc('nope', undefined, 2)]);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
    expect(res.body[1].error.code).toBe(-32601);
  });

  it('rejects bodies over the size limit', async () => {
    const big = await call(rpc('ping'), { headers: { 'content-length': String(MAX_BODY_BYTES + 1) } });
    expect(big.statusCode).toBe(413);
    const bigString = await call(JSON.stringify({ ...rpc('ping'), pad: 'x'.repeat(MAX_BODY_BYTES) }));
    expect(bigString.statusCode).toBe(413);
  });

  it('reads a raw request stream when no parsed body is present', async () => {
    const req = Readable.from([Buffer.from(JSON.stringify(rpc('ping', undefined, 9)))]);
    req.method = 'POST';
    req.headers = { 'x-forwarded-for': '203.0.113.8' };
    const res = mockRes();
    await handler(req, res);
    expect(res.body).toEqual({ jsonrpc: '2.0', id: 9, result: {} });
  });
});

describe('HTTP', () => {
  it('GET is 405 with an Allow header', async () => {
    const res = await call(undefined, { method: 'GET' });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('POST, OPTIONS');
  });

  it('OPTIONS answers the CORS preflight', async () => {
    const res = await call(undefined, { method: 'OPTIONS' });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toMatch(/Content-Type/);
    expect(res.headers['access-control-allow-headers']).toMatch(/Mcp-Protocol-Version/);
  });

  it('POST responses carry CORS and no-store', async () => {
    const res = await call(rpc('ping'));
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rate limits per IP with 429 and Retry-After', async () => {
    let res;
    for (let i = 0; i <= RATE_LIMIT.max; i++) res = await call(rpc('ping'), { headers: { 'x-forwarded-for': '198.51.100.1' } });
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    const other = await call(rpc('ping'), { headers: { 'x-forwarded-for': '198.51.100.2' } });
    expect(other.statusCode).toBe(200);
  });
});

describe('discovery', () => {
  it('the rate card advertises the MCP server', () => {
    expect(buildPricingSummary().mcpServer).toEqual({ url: MCP_URL, transport: 'streamable-http' });
    expect(MCP_URL).toBe('https://briancline.co/api/mcp');
  });
});
