// Public Wikimedia APIs; all requests are made by the daily job, never by visitors.
export const USER_AGENT = 'Histoiren/0.2 (https://github.com/SimonBitton/Hitsoiren; historical educational atlas)';
export const CATEGORIES = ['events', 'births', 'deaths'];
export const cleanText = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export const normalizeTitle = value => cleanText(value).replaceAll('_', ' ').replaceAll('’', "'").normalize('NFC').toLocaleLowerCase('fr');
export const parisDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`API HTTP ${response.status}: ${new URL(url).hostname}`);
  const text = await response.text();
  if (text.length > 12_000_000) throw new Error('Réponse API trop volumineuse');
  const data = JSON.parse(text);
  if (data.error) throw new Error(`API: ${data.error.code || 'réponse invalide'}`);
  return data;
}

export function wikipediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'fr.wikipedia.org' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function fetchDailyFeed({ now = new Date(), fetchImpl = fetch } = {}) {
  const date = parisDate(now);
  const [, month, day] = date.split('-');
  const payload = await fetchJson(`https://fr.wikipedia.org/api/rest_v1/feed/onthisday/all/${month}/${day}`, fetchImpl);
  const selected = new Set((payload.selected || []).map(entry => `${entry.year}:${cleanText(entry.text)}`));
  const result = { date, lastUpdate: now.toISOString(), source: 'Wikipédia en français', sourceUrl: `https://fr.wikipedia.org/wiki/${Number(day)}_${new Intl.DateTimeFormat('fr', { month: 'long', timeZone: 'Europe/Paris' }).format(now)}` };
  for (const category of CATEGORIES) {
    if (!Array.isArray(payload[category])) throw new Error(`Catégorie ${category} absente de la réponse Wikipédia`);
    const seen = new Set();
    result[category] = payload[category].flatMap(raw => {
      const description = cleanText(raw.text);
      if (!Number.isInteger(raw.year) || raw.year === 0 || raw.year < -100_000 || raw.year > Number(date.slice(0, 4)) || description.length < 10 || description.length > 4000) return [];
      const key = `${raw.year}:${description}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const source = raw.pages?.map(page => wikipediaUrl(page.content_urls?.desktop?.page)).find(Boolean);
      return [{ year: raw.year, description, ...(source ? { source } : {}), highlighted: selected.has(key) }];
    }).sort((left, right) => left.year - right.year || left.description.localeCompare(right.description, 'fr'));
  }
  if (!result.events.length) throw new Error('Aucun événement valide : dernière collection conservée');
  return result;
}
