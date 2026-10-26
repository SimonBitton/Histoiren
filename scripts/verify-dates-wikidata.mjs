import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fetchJson, normalizeTitle, parisDate } from './history-api.mjs';
import { parseHistoricalDate } from '../src/utils.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const eventKey = (event, countryId = '') => JSON.stringify([countryId, event.name, event.date]);
export const eraOf = year => year < -3500 ? 'prehist' : year < 476 ? 'antiquite' : year < 1492 ? 'moyen-age' : year < 1789 ? 'modernes' : 'contemporain';

// Do not turn a range, a Julian date or an approximate value into a precise Gregorian date.
export function reliableDate(entity, previousDate) {
  if (entity.claims?.P580?.length || entity.claims?.P582?.length) return { reason: 'event-spans-a-period' };
  let statements = (entity.claims?.P585 || []).filter(statement => statement.rank !== 'deprecated');
  if (statements.some(statement => statement.rank === 'preferred')) statements = statements.filter(statement => statement.rank === 'preferred');
  if (!statements.length) return { reason: 'no-point-in-time' };
  const values = [];
  for (const statement of statements) {
    const value = statement.mainsnak?.datavalue?.value;
    if (!value || statement.mainsnak.snaktype !== 'value' || !statement.references?.length || Object.keys(statement.qualifiers || {}).length || value.before !== 0 || value.after !== 0 || value.timezone !== 0 || !value.calendarmodel?.endsWith('/Q1985727') || ![9, 10, 11].includes(value.precision)) return { reason: 'uncertain-or-unsourced' };
    const match = value.time.match(/^([+-])(\d+)-(\d{2})-(\d{2})T00:00:00Z$/);
    if (!match) return { reason: 'invalid-time' };
    const year = Number(match[2]) * (match[1] === '-' ? -1 : 1);
    const month = Number(match[3]);
    const day = Number(match[4]);
    if (!year || Math.abs(year) > 100_000 || (value.precision >= 10 && (month < 1 || month > 12)) || (value.precision === 11 && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()))) return { reason: 'invalid-time' };
    const suffix = year < 0 ? ' av. J.-C.' : '';
    const date = value.precision === 11 ? `${day} ${MONTHS[month - 1]} ${Math.abs(year)}${suffix}` : value.precision === 10 ? `${MONTHS[month - 1]} ${Math.abs(year)}${suffix}` : `${Math.abs(year)}${suffix}`;
    values.push({ date, year, month: value.precision >= 10 ? month : null, day: value.precision === 11 ? day : null, precision: value.precision, isoDate: year > 0 && value.precision === 11 ? `${String(year).padStart(4, '0')}-${match[3]}-${match[4]}` : null });
  }
  const unique = [...new Map(values.map(value => [value.date, value])).values()];
  if (unique.length !== 1) return { reason: 'conflicting-dates' };
  const candidate = unique[0];
  const previous = parseHistoricalDate(previousDate);
  if (!previous || previousDate.includes('≈') || /\bvers\b|entre|[–—]|\d\s*-\s*\d/i.test(previousDate)) return { reason: 'approximate-or-range' };
  if (candidate.precision < (previous.day ? 11 : previous.month ? 10 : 9)) return { reason: 'less-precise' };
  if (previous.year !== candidate.year || (previous.month && candidate.month !== previous.month) || (previous.day && candidate.day !== previous.day)) return { reason: 'conflicting-editorial-date', proposedDate: candidate.date };
  return candidate;
}

export async function verifyDates({ timeline, countries, previous = {}, now = new Date(), fetchImpl = fetch, pause = () => new Promise(resolve => setTimeout(resolve, 250)) } = {}) {
  const records = [...timeline.events.map(event => ({ event, countryId: '' })), ...countries.flatMap(country => country.events.map(event => ({ event, countryId: country.id })))];
  const titles = [...new Set(records.map(({ event }) => event.name))];
  const byTitle = new Map();
  const batches = [];
  for (const title of titles.filter(title => !/[|<>{}\[\]#]/.test(title))) {
    let batch = batches.at(-1);
    if (!batch || batch.length === 40 || encodeURIComponent([...batch, title].join('|')).length > 6000) { batch = []; batches.push(batch); }
    batch.push(title);
  }
  for (const [index, batch] of batches.entries()) {
    if (index) await pause();
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({ action: 'wbgetentities', sites: 'frwiki', titles: batch.join('|'), props: 'claims|sitelinks', sitefilter: 'frwiki', redirects: 'yes', format: 'json' });
    const payload = await fetchJson(url, fetchImpl);
    if (payload.success !== 1 || !payload.entities || typeof payload.entities !== 'object') throw new Error('Réponse Wikidata incomplète');
    for (const entity of Object.values(payload.entities)) {
      const title = entity.sitelinks?.frwiki?.title;
      if (!title || !/^Q[1-9]\d*$/.test(entity.id || '')) continue;
      const key = normalizeTitle(title);
      const matches = byTitle.get(key) || new Map();
      matches.set(entity.id, entity);
      byTitle.set(key, matches);
    }
  }
  const previousCorrections = new Map((previous.policyVersion === 2 ? previous.corrections || [] : []).map(correction => [correction.key, correction]));
  const corrections = [];
  const unresolved = [];
  const counts = { total: records.length, matched: 0, verified: 0, corrected: 0, retained: 0, unresolved: 0 };
  for (const { event, countryId } of records) {
    const key = eventKey(event, countryId);
    const entities = [...(byTitle.get(normalizeTitle(event.name))?.values() || [])];
    const candidate = entities.length === 1 ? reliableDate(entities[0], event.date) : { reason: entities.length ? 'ambiguous-entity' : 'no-exact-match' };
    if (entities.length) counts.matched++;
    if (candidate.reason) {
      unresolved.push({ key, reason: candidate.reason, ...(candidate.proposedDate ? { proposedDate: candidate.proposedDate, source: `https://www.wikidata.org/wiki/${entities[0].id}` } : {}) });
      if (previousCorrections.has(key)) { corrections.push(previousCorrections.get(key)); counts.retained++; }
      continue;
    }
    counts.verified++;
    const parsed = parseHistoricalDate(event.date);
    if (parsed?.year === candidate.year && (candidate.month === null || parsed?.month === candidate.month) && (candidate.day === null || parsed?.day === candidate.day)) continue;
    corrections.push({ key, name: event.name, countryId, previousDate: event.date, ...candidate, era: eraOf(candidate.year), source: `https://www.wikidata.org/wiki/${entities[0].id}`, verifiedAt: now.toISOString() });
    counts.corrected++;
  }
  counts.unresolved = unresolved.length;
  return { policyVersion: 2, date: parisDate(now), lastUpdate: now.toISOString(), counts, corrections, unresolved };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A dry run never changes the editorial files. The daily sync publishes accepted corrections.
  const [timeline, countries] = await Promise.all(['timeline.json', 'countries.json'].map(name => readFile(resolve(ROOT, 'data', name), 'utf8').then(JSON.parse)));
  const report = await verifyDates({ timeline, countries });
  console.log(JSON.stringify(report, null, 2));
}
