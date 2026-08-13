import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { jwtVerify } from 'jose';

export function createAiProxyRouter({ supabaseJwks }) {
  const router = Router();

  const aiProxyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Troppe richieste al proxy AI, riprova tra un minuto' },
  });

  // Proxy per chiamate AI (Anthropic + OpenAI) — la API key non passa mai dal browser
  router.post('/', aiProxyLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

      // Validazione JWT: verifica firma e scadenza.
      // Supabase Auth firma i token in ES256 (JWKS); fallback HS256 per il segreto legacy.
      const token = authHeader.replace(/^Bearer\s+/i, '');
      let jwtPayload;
      try {
        if (!supabaseJwks) throw new Error('JWKS non disponibile');
        const { payload } = await jwtVerify(token, supabaseJwks);
        jwtPayload = payload;
      } catch (jwksErr) {
        // Fallback: segreto condiviso HS256 (deployment legacy)
        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        if (!jwtSecret) {
          console.warn('[ai-proxy] JWT non valido (JWKS):', jwksErr.message);
          return res.status(401).json({ error: 'Token non valido o scaduto' });
        }
        try {
          jwtPayload = jwt.verify(token, jwtSecret);
        } catch (jwtErr) {
          console.warn('[ai-proxy] JWT non valido:', jwtErr.message);
          return res.status(401).json({ error: 'Token non valido o scaduto' });
        }
      }

      const { model, system, messages, max_tokens, company_id } = req.body;
      if (!model || !messages || !company_id) {
        return res.status(400).json({ error: 'Missing required fields: model, messages, company_id' });
      }

      const isOpenAI = model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3');

      console.log(`[ai-proxy] user=${jwtPayload.sub} company=${company_id} model=${model} ip=${req.ip}`);

      // Legge la API key dal DB usando il JWT dell'utente (rispetta RLS)
      const { createClient } = await import('@supabase/supabase-js');
      const userSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: settingsData, error: settingsError } = await userSupabase
        .from('settings')
        .select('anthropic_api_key, openai_api_key')
        .eq('id', 'default')
        .eq('company_id', company_id)
        .single();

      if (isOpenAI) {
        if (settingsError || !settingsData?.openai_api_key) {
          return res.status(400).json({ error: 'API key OpenAI non configurata nelle impostazioni' });
        }

        const openaiMessages = system
          ? [{ role: 'system', content: system }, ...messages]
          : messages;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settingsData.openai_api_key}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: max_tokens ?? 500,
            messages: openaiMessages,
            response_format: { type: 'json_object' },
          }),
        });

        const data = await openaiRes.json();
        // Normalizza la risposta al formato Anthropic per compatibilità col client
        if (openaiRes.ok && data.choices?.[0]?.message?.content) {
          return res.json({
            content: [{ type: 'text', text: data.choices[0].message.content }],
            model: data.model,
          });
        }
        return res.status(openaiRes.status).json(data);
      } else {
        if (settingsError || !settingsData?.anthropic_api_key) {
          return res.status(400).json({ error: 'API key Anthropic non configurata nelle impostazioni' });
        }

        const body = { model, max_tokens: max_tokens ?? 500, messages };
        if (system) body.system = system;

        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settingsData.anthropic_api_key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });

        const data = await anthropicRes.json();
        return res.status(anthropicRes.status).json(data);
      }
    } catch (err) {
      console.error('[ai-proxy]', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  return router;
}
