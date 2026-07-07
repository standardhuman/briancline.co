// Returns the Stripe publishable key for the active mode (test/live).
// Called by the website diving-order form before it can render the
// payment-element. Mode-aware so flipping STRIPE_MODE serves the right pk.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const allowedOrigins = [
  'https://briancline.co',
  'https://www.briancline.co',
  'https://diving.sailorskills.com',
  'https://sailorskills-site-redesign.sailorskills.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5175',
]

function getCorsHeaders(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve((req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const mode = Deno.env.get('STRIPE_MODE') || 'test'
  const publishableKey = mode === 'live'
    ? Deno.env.get('STRIPE_PUBLISHABLE_KEY_LIVE')
    : Deno.env.get('STRIPE_PUBLISHABLE_KEY_TEST')

  if (!publishableKey) {
    return new Response(
      JSON.stringify({ error: `Publishable key not configured for mode=${mode}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }

  return new Response(
    JSON.stringify({ publishableKey, mode }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  )
})
