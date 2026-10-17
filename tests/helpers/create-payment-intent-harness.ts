/**
 * Runs the real create-payment-intent edge function (Deno) inside vitest.
 *
 * The function cannot be imported directly: it pulls supabase-js, Stripe and the
 * std `serve` from https URLs and reads Deno.env at module load. This harness
 * copies index.ts to a temp dir with those three imports rewritten to local
 * stubs (and `../_shared/` pointed at the real shared modules), installs a fake
 * `Deno.env`, a recording Supabase client, a recording Stripe client and a fetch
 * stub, then hands back the captured request handler. Nothing leaves the process:
 * no network, no database, no Stripe.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(here, '../../supabase/functions');
const indexPath = path.join(functionsDir, 'create-payment-intent/index.ts');

export const PROVIDER_OWNER = '11111111-1111-4111-8111-111111111111';

export interface DbCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  payload: any;
  columns: string | null;
  filters: Array<[string, ...unknown[]]>;
  terminal: 'single' | 'maybeSingle' | null;
}

export interface DbResult {
  data?: any;
  error?: any;
  count?: number;
}

export type DbResponder = (call: DbCall, db: FakeDb) => DbResult | undefined;

export class FakeDb {
  calls: DbCall[] = [];
  /** service_orders rows "stored" by inserts, for claim simulation. */
  emailClaimed = new Set<string>();
  smsClaimed = new Set<string>();

  constructor(private readonly override?: DbResponder) {}

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(name: string, args: unknown) {
    const call: DbCall = { table: name, op: 'rpc', payload: args, columns: null, filters: [], terminal: null };
    this.calls.push(call);
    return this.respond(call);
  }

  respond(call: DbCall): DbResult {
    const custom = this.override?.(call, this);
    if (custom) return { data: null, error: null, ...custom };
    return { data: null, error: null, ...defaultResponse(call, this) };
  }

  writes(table: string, op?: DbCall['op']): DbCall[] {
    return this.calls.filter((c) => c.table === table && c.op !== 'select' && (!op || c.op === op));
  }
}

class FakeQuery {
  private readonly call: DbCall;

  constructor(private readonly db: FakeDb, table: string) {
    this.call = { table, op: 'select', payload: null, columns: null, filters: [], terminal: null };
  }

  select(columns?: string) { this.call.columns = columns ?? '*'; return this; }
  insert(payload: unknown) { this.call.op = 'insert'; this.call.payload = payload; return this; }
  update(payload: unknown) { this.call.op = 'update'; this.call.payload = payload; return this; }
  upsert(payload: unknown) { this.call.op = 'upsert'; this.call.payload = payload; return this; }
  delete() { this.call.op = 'delete'; return this; }
  eq(...args: unknown[]) { this.call.filters.push(['eq', ...args]); return this; }
  neq(...args: unknown[]) { this.call.filters.push(['neq', ...args]); return this; }
  is(...args: unknown[]) { this.call.filters.push(['is', ...args]); return this; }
  in(...args: unknown[]) { this.call.filters.push(['in', ...args]); return this; }
  gte(...args: unknown[]) { this.call.filters.push(['gte', ...args]); return this; }
  or(...args: unknown[]) { this.call.filters.push(['or', ...args]); return this; }
  not(...args: unknown[]) { this.call.filters.push(['not', ...args]); return this; }
  ilike(...args: unknown[]) { this.call.filters.push(['ilike', ...args]); return this; }
  order() { return this; }
  limit() { return this; }
  single() { this.call.terminal = 'single'; return this.exec(); }
  maybeSingle() { this.call.terminal = 'maybeSingle'; return this.exec(); }
  then<T>(resolve: (value: DbResult) => T, reject?: (reason: unknown) => T) {
    return this.exec().then(resolve, reject);
  }
  private exec(): Promise<DbResult> {
    this.db.calls.push(this.call);
    return Promise.resolve(this.db.respond(this.call));
  }
}

export function filterValue(call: DbCall, kind: string, column: string): unknown {
  const f = call.filters.find((entry) => entry[0] === kind && entry[1] === column);
  return f ? f[2] : undefined;
}

function defaultResponse(call: DbCall, db: FakeDb): DbResult {
  const { table, op } = call;
  if (table === 'marinas' && op === 'select') {
    return call.columns === 'name' ? { data: [{ name: 'Berkeley Marina' }] } : { data: [] };
  }
  if (table === 'terms_documents') return { data: { version: filterValue(call, 'eq', 'version') } };
  if (table === 'service_providers') {
    return call.columns === 'id' ? { data: [{ id: 'sp-1' }] } : { data: [{ owner_user_id: PROVIDER_OWNER }] };
  }
  if (table === 'business_pricing_config') return { data: [] };
  if (table === 'customers' && op === 'upsert') {
    return { data: { id: 'cust-1', stripe_customer_id: null, ...call.payload } };
  }
  if (table === 'addresses' && op === 'select') return { data: null };
  if (table === 'boats' && op === 'select') return { data: null };
  if (table === 'boats' && (op === 'insert' || op === 'update')) {
    return { data: { id: 'boat-1', ...call.payload } };
  }
  if (table === 'service_orders' && op === 'select') return { data: null };
  if (table === 'service_orders' && op === 'insert') {
    return { data: { id: 'order-1', is_test: false, ...call.payload } };
  }
  if (table === 'service_orders' && op === 'update') {
    const id = String(filterValue(call, 'eq', 'id'));
    if ('confirmation_email_sent_at' in call.payload && call.payload.confirmation_email_sent_at !== null) {
      if (db.emailClaimed.has(id)) return { data: null };
      db.emailClaimed.add(id);
      return { data: emailRow(db) };
    }
    if ('confirmation_email_sent_at' in call.payload) {
      db.emailClaimed.delete(id);
      return { data: null };
    }
    if ('operator_sms_sent_at' in call.payload && call.payload.operator_sms_sent_at !== null) {
      if (db.smsClaimed.has(id)) return { data: null };
      db.smsClaimed.add(id);
      return { data: { id } };
    }
    if ('operator_sms_sent_at' in call.payload) {
      db.smsClaimed.delete(id);
      return { data: { id } };
    }
    return { data: null };
  }
  if (table === 'order_authorizations' && op === 'insert') return { data: { id: 'auth-1' } };
  return { data: null };
}

function emailRow(db: FakeDb) {
  const order = db.writes('service_orders', 'insert')[0]?.payload ?? {};
  return {
    order_number: order.order_number,
    service_type: order.service_type,
    service_interval: order.service_interval,
    estimate_mode: order.estimate_mode,
    estimated_amount: order.estimated_amount,
    estimated_min_amount: order.estimated_min_amount,
    estimated_max_amount: order.estimated_max_amount,
    notes: order.notes,
    service_details: order.service_details,
    dock: order.dock,
    slip_number: order.slip_number,
    requires_review: order.requires_review,
    boat: { name: 'Raindancer II', length: 36, make: 'Catalina', model: '36' },
    marina: null,
    customer: { name: 'Pat Example', email: 'pat@example.com', phone: '5105550100' },
  };
}

export class FakeStripe {
  calls: Array<[string, unknown]> = [];
  customers = {
    retrieve: async (id: string) => { this.calls.push(['customers.retrieve', id]); return { id }; },
    create: async (params: unknown) => { this.calls.push(['customers.create', params]); return { id: 'cus_test_1' }; },
  };
  setupIntents = {
    create: async (params: unknown) => {
      this.calls.push(['setupIntents.create', params]);
      return { id: 'seti_test_1', client_secret: 'seti_test_1_secret_x', status: 'requires_payment_method' };
    },
    retrieve: async (id: string) => {
      this.calls.push(['setupIntents.retrieve', id]);
      return { id, client_secret: `${id}_secret_x`, status: 'requires_payment_method' };
    },
    cancel: async (id: string) => { this.calls.push(['setupIntents.cancel', id]); return { id }; },
  };
  named(name: string) {
    return this.calls.filter(([n]) => n === name);
  }
}

export interface FetchLog {
  url: string;
  body: any;
}

export interface Harness {
  handle(formData: Record<string, unknown>, ip?: string): Promise<{ status: number; body: any }>;
  db: FakeDb;
  stripe: FakeStripe;
  fetches: FetchLog[];
  cleanup(): void;
}

export interface HarnessOptions {
  env?: Record<string, string>;
  db?: DbResponder;
  /** Override the HTTP status for the Resend endpoint (default 200). */
  resendStatus?: number;
}

const BASE_ENV: Record<string, string> = {
  STRIPE_MODE: 'live',
  STRIPE_SECRET_KEY_LIVE: 'sk_test_harness',
  SUPABASE_URL: 'https://harness.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-harness',
  TURNSTILE_SECRET_KEY: 'turnstile-harness',
  DEFAULT_PROVIDER_OWNER_USER_ID: PROVIDER_OWNER,
  ORDER_NOTIFY_PHONE_E164: '+14155550100',
  RESEND_API_KEY_DIVING: 're_harness',
  ADMIN_EMAILS: 'admin@example.com',
};

let loadCounter = 0;

export async function loadCreatePaymentIntent(options: HarnessOptions = {}): Promise<Harness> {
  const env = { ...BASE_ENV, ...(options.env ?? {}) };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cpi-harness-'));
  fs.writeFileSync(path.join(tmp, 'serve.ts'),
    'export function serve(handler: any) { (globalThis as any).__cpiHandler = handler }\n');
  fs.writeFileSync(path.join(tmp, 'supabase.ts'),
    'export function createClient() { return (globalThis as any).__cpiDb }\n');
  fs.writeFileSync(path.join(tmp, 'stripe.ts'), [
    'export default class Stripe {',
    '  static createFetchHttpClient() { return {} }',
    '  constructor() { return (globalThis as any).__cpiStripe }',
    '}',
    '',
  ].join('\n'));

  const source = fs.readFileSync(indexPath, 'utf8')
    .replace("'https://deno.land/std@0.168.0/http/server.ts'", `'${path.join(tmp, 'serve.ts')}'`)
    .replace("'https://esm.sh/@supabase/supabase-js@2'", `'${path.join(tmp, 'supabase.ts')}'`)
    .replace("'https://esm.sh/stripe@12.18.0?target=deno'", `'${path.join(tmp, 'stripe.ts')}'`)
    .replaceAll("'../_shared/", `'${path.join(functionsDir, '_shared')}/`);
  const target = path.join(tmp, `index-${++loadCounter}.ts`);
  fs.writeFileSync(target, source);

  const db = new FakeDb(options.db);
  const stripe = new FakeStripe();
  const fetches: FetchLog[] = [];
  const g = globalThis as any;
  g.Deno = { env: { get: (name: string) => env[name] } };
  g.__cpiDb = db;
  g.__cpiStripe = stripe;
  g.__cpiHandler = undefined;

  const fakeFetch = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    let body: any = init?.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* keep raw */ }
    }
    fetches.push({ url, body });
    if (url.includes('turnstile')) return Response.json({ success: true });
    if (url.startsWith('https://api.resend.com/')) {
      return Response.json({ id: 'email_1' }, { status: options.resendStatus ?? 200 });
    }
    if (url.endsWith('/functions/v1/send-sms')) {
      return Response.json({ success: true, sms_sent: true, mock: false });
    }
    throw new Error(`unexpected fetch in harness: ${url}`);
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch as typeof fetch;

  const silence = ['log', 'warn', 'error'] as const;
  const realConsole = silence.map((k) => console[k]);
  silence.forEach((k) => { console[k] = () => {}; });

  await import(/* @vite-ignore */ target);
  const handler = g.__cpiHandler as (req: Request) => Promise<Response>;
  if (typeof handler !== 'function') throw new Error('serve() handler was not captured');

  let ipCounter = 0;
  return {
    db,
    stripe,
    fetches,
    async handle(formData, ip) {
      const req = new Request('https://harness.supabase.co/functions/v1/create-payment-intent', {
        method: 'POST',
        headers: {
          origin: 'https://briancline.co',
          'content-type': 'application/json',
          // Fresh IP per request: the function's in-memory limiter allows 2/hour/IP.
          'x-forwarded-for': ip ?? `203.0.113.${++ipCounter}`,
        },
        body: JSON.stringify({ formData }),
      });
      const res = await handler(req);
      return { status: res.status, body: await res.json() };
    },
    cleanup() {
      globalThis.fetch = realFetch;
      silence.forEach((k, i) => { console[k] = realConsole[i]; });
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}
