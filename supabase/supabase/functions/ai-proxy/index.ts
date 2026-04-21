// Supabase Edge Function: proxy for Anthropic API calls
// Deploy with: supabase functions deploy ai-proxy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[ai-proxy] Parsing request body...')
    const { model, system, messages, max_tokens, company_id } = await req.json()
    console.log('[ai-proxy] model:', model, 'company_id:', company_id, 'messages_count:', messages?.length)

    if (!model || !messages || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: model, messages, company_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client with user's JWT — respects RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    console.log('[ai-proxy] SUPABASE_URL:', supabaseUrl)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Read API key from DB (never exposed to the browser)
    console.log('[ai-proxy] Querying DB for API key...')
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('anthropic_api_key')
      .eq('id', 'default')
      .eq('company_id', company_id)
      .single()

    console.log('[ai-proxy] DB result - error:', settingsError?.message ?? 'none', 'has_key:', !!settingsData?.anthropic_api_key)

    if (settingsError || !settingsData?.anthropic_api_key) {
      return new Response(JSON.stringify({ error: 'API key Anthropic non configurata nelle impostazioni' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call Anthropic API server-side
    console.log('[ai-proxy] Calling Anthropic API...')
    const body: Record<string, unknown> = {
      model,
      max_tokens: max_tokens ?? 500,
      messages,
    }
    if (system) body.system = system

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settingsData.anthropic_api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await anthropicResponse.json()

    return new Response(JSON.stringify(data), {
      status: anthropicResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[ai-proxy] Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
