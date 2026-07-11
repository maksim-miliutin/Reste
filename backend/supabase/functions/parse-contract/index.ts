import { askVision, cors, json } from '../_shared/anthropic.ts';

/**
 * Parse the insurer's guarantee table.
 *
 * Contracts express cover two ways: as a percentage of the base (100%, 300% BR)
 * and as a euro amount (typical for optical). Both are stored as-is — the
 * client does the conversion, where it is covered by tests.
 */
const SYSTEM = `Tu lis un tableau de garanties d'une mutuelle sante francaise.

Extrais UNIQUEMENT ce qui est ecrit. N'invente aucune garantie.
Si une categorie n'apparait pas, omets-la.

Reponds en JSON strict:
{
  "name": string,
  "responsible": boolean,
  "coverage": {
    "<categorie>": { "kind": "percentOfBase", "percent": number }
                 | { "kind": "flatEuro", "amount": number }
  },
  "annualCeiling": {
    "<categorie>": number   // plafond annuel en euros, si le tableau en indique un
  },
  "ceilingYearStart": "MM-DD" | null
}

ceilingYearStart: si le contrat precise que l'annee des plafonds ne suit pas
l'annee civile ("a compter de la date d'adhesion", "annee d'assurance",
"du 1er juillet au 30 juin"), donne le debut de periode au format MM-DD.
Si rien n'est precise, mets null: l'annee civile sera utilisee.

Cherche activement les plafonds annuels: ils apparaissent souvent en note de
bas de page ou en petits caracteres ("dans la limite de 400 EUR par an",
"plafond annuel", "par beneficiaire et par annee"). Omets la categorie si
aucun plafond n'est indique.

Categories possibles: consultation, specialist, dental, optical, hospital,
lab, radiology, pharmacy.

Attention: "300 % BR" signifie un plafond total de 300 % de la base,
part Securite sociale INCLUSE. Recopie le pourcentage tel quel.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const { image } = await req.json().catch(() => ({ image: null }));
  if (typeof image !== 'string' || image.length < 100) return json({ error: 'image' }, 400);

  const parsed = await askVision<{ coverage?: Record<string, unknown> }>(image, SYSTEM);
  if (!parsed?.coverage) return json({ error: 'unreadable' }, 422);

  return json(parsed);
});
