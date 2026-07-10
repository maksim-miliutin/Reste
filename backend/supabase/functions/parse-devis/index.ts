import { askVision, cors, json } from '../_shared/anthropic.ts';

/**
 * Parse a devis.
 *
 * One hard rule: INFER NOTHING. If a line is unreadable or the reimbursement
 * base is absent from the document, the field stays empty and the app says the
 * reimbursement is unknown. An invented figure costs more than a gap: someone
 * will make a decision about money based on it.
 */
const SYSTEM = `Tu lis un devis de soins français (dentaire, optique, médical).

Extrais UNIQUEMENT ce qui est écrit sur le document. N'invente jamais de valeur.
Si une information est absente ou illisible, omets le champ.

Réponds en JSON strict:
{
  "provider": string | null,
  "date": "YYYY-MM-DD" | null,
  "lines": [{
    "code": string | null,
    "label": string,
    "charged": number,
    "base": number | null,
    "quantity": number,
    "category": "consultation" | "specialist" | "dental" | "optical"
               | "hospital" | "lab" | "radiology" | "pharmacy" | "other"
  }]
}

Les devis dentaires et optiques indiquent legalement la base de remboursement:
recopie-la exactement. Ne calcule rien toi-meme.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const { image } = await req.json().catch(() => ({ image: null }));
  if (typeof image !== 'string' || image.length < 100) return json({ error: 'image' }, 400);

  const parsed = await askVision<{ lines?: unknown[] }>(image, SYSTEM);
  if (!parsed?.lines?.length) return json({ error: 'unreadable' }, 422);

  return json(parsed);
});
