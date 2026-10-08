// Read-only MCP server for hull-cleaning estimates at Berkeley Marina.
// POST /api/mcp  (Model Context Protocol, Streamable HTTP transport)
//
// Stateless and JSON-only: every POST carries one JSON-RPC message (or a batch)
// and gets one JSON response. No SSE streams, no sessions, no auth.
// Same math as the /hull-cleaning estimator and GET /api/hull-cleaning-quote:
// every number comes from src/services/lib/hull-cleaning-public.js.
// No writes, no personal data, nothing is booked or charged.
import {
  BUSINESS,
  INPUT_OPTIONS,
  ORDER_URL,
  PRICING_JSON_URL,
  SERVICE_AREA,
  buildPricingSummary,
  buildQuote,
  parseQuoteQuery,
} from '../src/services/lib/hull-cleaning-public.js';
import { SERVICES, PAINT_AGE_OPTIONS, LAST_CLEANED_OPTIONS } from '../src/services/lib/diving-calculator.js';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
export const MAX_BODY_BYTES = 32 * 1024;

const SERVER_INFO = { name: 'briancline-hull-cleaning', title: BUSINESS.name, version: '1.0.0' };

const DISCLAIMER =
  'These are estimates for boats at Berkeley Marina only. The final price depends on the marine growth found at service time. Nothing is booked or charged.';

const INSTRUCTIONS =
  `Read-only hull cleaning estimates from ${BUSINESS.name}, for boats kept at Berkeley Marina, Berkeley, California only. ` +
  'Use estimate_hull_cleaning for a price on a specific boat (boat length in feet is required for cleaning, running gear and inspection) ' +
  'and get_hull_cleaning_rates for the full rate card. ' +
  'Results are estimates: the final price depends on the marine growth found at service time. ' +
  `Nothing is booked or charged through this server; to order, follow the order link in the estimate or visit ${ORDER_URL}. ` +
  `For boats at other marinas: ${SERVICE_AREA.note}`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const optionList = (opts) => opts.map((o) => `"${o.value}" (${o.label})`).join(', ');

const ESTIMATE_PROPERTIES = {
  service: {
    type: 'string',
    enum: INPUT_OPTIONS.service,
    default: 'cleaning',
    description: `Service to price. ${INPUT_OPTIONS.service.map((k) => `"${k}": ${SERVICES[k].name}`).join('; ')}.`,
  },
  length: {
    type: 'integer',
    minimum: INPUT_OPTIONS.lengthFeet.min,
    maximum: INPUT_OPTIONS.lengthFeet.max,
    description:
      'Boat length in feet, often in the model name (e.g. Islander 36 = 36). Required for cleaning, running_gear and underwater_inspection.',
  },
  boatType: { type: 'string', enum: INPUT_OPTIONS.boatType, default: 'sailboat', description: 'Sailboat or powerboat.' },
  hull: { type: 'string', enum: INPUT_OPTIONS.hullType, default: 'monohull', description: 'Hull type.' },
  frequency: {
    type: 'string',
    enum: INPUT_OPTIONS.frequency,
    default: 'monthly',
    description: 'Cleaning plan: monthly, bimonthly (every 2 months), quarterly, or onetime (a single cleaning).',
  },
  propellers: {
    type: 'integer',
    minimum: INPUT_OPTIONS.propellers.min,
    maximum: INPUT_OPTIONS.propellers.max,
    default: 1,
    description: 'Number of propellers.',
  },
  anodes: {
    type: 'integer',
    minimum: INPUT_OPTIONS.anodes.min,
    maximum: INPUT_OPTIONS.anodes.max,
    default: 0,
    description: 'Number of anodes (zincs) to replace. Labor only; anode parts are extra.',
  },
  paintAge: {
    type: 'string',
    enum: INPUT_OPTIONS.paintAge,
    description: `Age of the antifouling paint. Omit if unknown. Values: ${optionList(PAINT_AGE_OPTIONS)}.`,
  },
  lastCleaned: {
    type: 'string',
    enum: INPUT_OPTIONS.lastCleaned,
    description: `Time since the last cleaning. Omit if unknown. Values: ${optionList(LAST_CLEANED_OPTIONS)}.`,
  },
};

export const TOOLS = [
  {
    name: 'estimate_hull_cleaning',
    title: 'Estimate hull cleaning',
    description:
      `Price estimate for hull cleaning or a dive service from ${BUSINESS.name} at Berkeley Marina, Berkeley, California. ` +
      'Same math as the estimator on briancline.co/hull-cleaning. Returns the total, line items, a range across growth conditions, and a prefilled order link. ' +
      DISCLAIMER,
    inputSchema: { type: 'object', properties: ESTIMATE_PROPERTIES, additionalProperties: false },
    annotations: { title: 'Estimate hull cleaning', ...READ_ONLY },
  },
  {
    name: 'get_hull_cleaning_rates',
    title: 'Get hull cleaning rates',
    description:
      `The full public rate card for ${BUSINESS.name}: per-foot rates, minimum charge, surcharges, growth tiers and service area. ` +
      DISCLAIMER,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Get hull cleaning rates', ...READ_ONLY },
  },
];

// ── Text summaries ──

const PLAN_LABELS = { monthly: 'monthly', bimonthly: 'every 2 months', quarterly: 'quarterly' };
const usd = (n) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function quoteText(q) {
  const { input, estimate, conditionRange } = q;
  const lines = [`Estimate from ${BUSINESS.name} (Berkeley Marina only).`];
  const boat = input.length != null ? `${input.length} ft ${input.boatType}, ${input.hull}` : null;
  lines.push(`Service: ${q.service.name}${boat ? `, ${boat}` : ''}.`);
  const total = `${estimate.startingPrice ? 'from ' : ''}${usd(estimate.total)}`;
  lines.push(
    estimate.per === 'visit'
      ? `Estimated total: ${total} per visit (plan: ${PLAN_LABELS[input.frequency] || input.frequency}).`
      : `Estimated total: ${total} (one-time service).`
  );
  if (estimate.lineItems.length) {
    lines.push(`Line items: ${estimate.lineItems.map((i) => `${i.label} ${usd(i.amount)}`).join('; ')}.`);
  }
  if (conditionRange) {
    lines.push(
      `Range across growth conditions: ${usd(conditionRange.low)} to ${usd(conditionRange.high)}` +
        (conditionRange.expected ? ` (expected growth: ${conditionRange.expected}).` : '.')
    );
    lines.push(`By growth tier: ${conditionRange.tiers.map((t) => `${t.label} ${usd(t.total)}`).join('; ')}.`);
  }
  lines.push(DISCLAIMER);
  lines.push(`Service area: ${SERVICE_AREA.note}`);
  lines.push(`To order: ${q.orderUrl}`);
  return lines.join('\n');
}

export function ratesText(s) {
  const svc = Object.fromEntries(s.services.map((x) => [x.key, x]));
  return [
    `Hull cleaning rates from ${BUSINESS.name} (Berkeley Marina only).`,
    `Cleaning: ${usd(svc.cleaning.pricing.recurringPerFoot)} per foot on a recurring plan (monthly, every 2 months or quarterly), ${usd(svc.cleaning.pricing.oneTimePerFoot)} per foot for a one-time cleaning.`,
    `Underwater inspection: ${usd(svc.underwater_inspection.pricing.perFoot)} per foot. Minimum charge: ${usd(s.minimumCharge.amount)} per visit.`,
    'Surcharges apply for powerboats, multihulls, extra propellers and heavier growth; the full rate card is in the structured result.',
    DISCLAIMER,
    `Service area: ${SERVICE_AREA.note}`,
    `Rate card JSON: ${PRICING_JSON_URL}. To order: ${ORDER_URL}`,
  ].join('\n');
}

// ── Tools ──

const ESTIMATE_KEYS = Object.keys(ESTIMATE_PROPERTIES);

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function callEstimate(args) {
  const unknown = Object.keys(args).filter((k) => !ESTIMATE_KEYS.includes(k));
  if (unknown.length) {
    return toolError(`Invalid input: unknown argument(s) ${unknown.join(', ')}. Allowed: ${ESTIMATE_KEYS.join(', ')}.`);
  }
  const parsed = parseQuoteQuery(args);
  if (!parsed.ok) return toolError(`Invalid input: ${parsed.errors.join('; ')}.`);
  const quote = buildQuote(parsed.input);
  return { content: [{ type: 'text', text: quoteText(quote) }], structuredContent: quote };
}

function callRates() {
  const summary = buildPricingSummary();
  return { content: [{ type: 'text', text: ratesText(summary) }], structuredContent: summary };
}

const TOOL_HANDLERS = { estimate_hull_cleaning: callEstimate, get_hull_cleaning_rates: callRates };

// ── JSON-RPC ──

class RpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

const METHODS = {
  initialize(params) {
    const requested = isPlainObject(params) ? params.protocolVersion : undefined;
    return {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
      instructions: INSTRUCTIONS,
    };
  },
  ping() {
    return {};
  },
  'tools/list'() {
    return { tools: TOOLS };
  },
  'tools/call'(params) {
    if (!isPlainObject(params) || typeof params.name !== 'string') {
      throw new RpcError(-32602, 'Invalid params: "name" (string) is required');
    }
    const run = TOOL_HANDLERS[params.name];
    if (!run) throw new RpcError(-32602, `Unknown tool: ${params.name}`);
    const args = params.arguments ?? {};
    if (!isPlainObject(args)) throw new RpcError(-32602, 'Invalid params: "arguments" must be an object');
    return run(args);
  },
};

const errorResponse = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message. Returns a response object, or null for notifications. */
export function handleMessage(msg) {
  if (!isPlainObject(msg) || msg.jsonrpc !== '2.0') {
    return errorResponse(isPlainObject(msg) ? msg.id : null, -32600, 'Invalid Request');
  }
  const hasId = Object.prototype.hasOwnProperty.call(msg, 'id');
  const validId = hasId && (typeof msg.id === 'string' || (typeof msg.id === 'number' && Number.isFinite(msg.id)));

  if (typeof msg.method !== 'string') {
    // A response or error from the client (we never send requests); nothing to answer.
    if (hasId && ('result' in msg || 'error' in msg)) return null;
    return errorResponse(validId ? msg.id : null, -32600, 'Invalid Request');
  }
  // Notifications (no id) are accepted and never answered.
  if (!hasId) return null;
  if (!validId) return errorResponse(null, -32600, 'Invalid Request: id must be a string or number');

  const fn = Object.prototype.hasOwnProperty.call(METHODS, msg.method) ? METHODS[msg.method] : null;
  if (!fn) return errorResponse(msg.id, -32601, `Method not found: ${msg.method}`);
  try {
    return { jsonrpc: '2.0', id: msg.id, result: fn(msg.params) };
  } catch (err) {
    if (err instanceof RpcError) return errorResponse(msg.id, err.code, err.message);
    return errorResponse(msg.id, -32603, 'Internal error');
  }
}

// ── Rate limiting ──
// Best effort and per instance: a small in-memory window per client IP. It
// resets when the instance recycles and is not shared across instances.
export const RATE_LIMIT = { windowMs: 60_000, max: 60 };
const hits = new Map();

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim();
  return first || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function rateLimited(req, now = Date.now()) {
  const ip = clientIp(req);
  let entry = hits.get(ip);
  if (!entry || now - entry.start >= RATE_LIMIT.windowMs) {
    entry = { start: now, count: 0 };
    hits.set(ip, entry);
  }
  entry.count += 1;
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now - v.start >= RATE_LIMIT.windowMs) hits.delete(k);
  }
  return entry.count > RATE_LIMIT.max ? Math.ceil((entry.start + RATE_LIMIT.windowMs - now) / 1000) : 0;
}

export function resetRateLimit() {
  hits.clear();
}

// ── Body ──

class BodyError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const tooLarge = () => new BodyError(413, -32600, `Request body too large (max ${MAX_BODY_BYTES} bytes)`);
const parseError = () => new BodyError(400, -32700, 'Parse error');

function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(tooLarge());
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Reads the JSON body. Works with Vercel's parsed req.body and with a raw stream. */
async function readJsonBody(req) {
  const declared = Number(req.headers?.['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw tooLarge();

  let body;
  try {
    body = req.body; // Vercel parses JSON lazily and throws on malformed JSON.
  } catch {
    throw parseError();
  }
  if (body === undefined && typeof req.on === 'function' && !req.readableEnded) {
    body = await readStream(req);
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw tooLarge();
    if (!body.trim()) throw parseError();
    try {
      return JSON.parse(body);
    } catch {
      throw parseError();
    }
  }
  if (body == null) throw parseError();
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) throw tooLarge();
  return body;
}

// ── HTTP ──

const ALLOW = 'POST, GET, OPTIONS';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', ALLOW);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    // No SSE stream is offered, so GET (and anything else) is 405 per the transport spec.
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      error: 'Method not allowed. This is a Model Context Protocol server: send JSON-RPC requests with POST.',
      name: SERVER_INFO.name,
      transport: 'streamable-http',
      docs: PRICING_JSON_URL,
    });
  }

  const retryAfter = rateLimited(req);
  if (retryAfter) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json(errorResponse(null, -32000, 'Too many requests. Try again shortly.'));
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    if (err instanceof BodyError) return res.status(err.status).json(errorResponse(null, err.code, err.message));
    return res.status(400).json(errorResponse(null, -32700, 'Parse error'));
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) return res.status(400).json(errorResponse(null, -32600, 'Invalid Request: empty batch'));
    const responses = payload.map(handleMessage).filter(Boolean);
    return responses.length ? res.status(200).json(responses) : res.status(202).end();
  }

  const response = handleMessage(payload);
  return response ? res.status(200).json(response) : res.status(202).end();
}
