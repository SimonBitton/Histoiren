import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchDailyFeed, parisDate } from '../scripts/history-api.mjs';
import { reliableDate, verifyDates, eventKey } from '../scripts/verify-dates-wikidata.mjs';
import { synchronize } from '../scripts/day-in-history-sync.mjs';
import { applyCorrections, dailyEvents, newestUpdates } from '../src/history-updates.js';

const now = new Date('2026-10-18T12:00:00Z');
const event = { name: 'Prise de la Bastille', date: '1789', era: 'modernes', category: 'politique' };
const claim = (overrides = {}) => ({ rank: 'normal', references: [{ snaks: {} }], mainsnak: { snaktype: 'value', datavalue: { value: { time: '+1789-07-14T00:00:00Z', precision: 11, timezone: 0, before: 0, after: 0, calendarmodel: 'http://www.wikidata.org/entity/Q1985727', ...overrides } } } });
const entity = (statements = [claim()]) => ({ id: 'Q6539', sitelinks: { frwiki: { title: 'Prise de la Bastille' } }, claims: { P585: statements } });
const feed = { selected: [{ year: 1922, text: 'Fondation de la BBC.' }], events: [{ year: 1922, text: 'Fondation de la BBC.', pages: [{ content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/BBC' } } }] }], births: [], deaths: [] };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const mockFetch = async url => new URL(url).hostname === 'www.wikidata.org' ? json({ success: 1, entities: { Q6539: entity() } }) : json(feed);

test('la journée est calculée à Paris, y compris autour de minuit', () => {
  assert.equal(parisDate(new Date('2026-10-17T23:30:00Z')), '2026-10-18');
});

test('le flux français est normalisé, dédupliqué et conserve la provenance', async () => {
  const payload = { ...feed, events: [...feed.events, ...feed.events, { year: 'bad', text: 'Entrée invalide' }] };
  let requested;
  const result = await fetchDailyFeed({ now, fetchImpl: async url => { requested = String(url); return json(payload); } });
  assert.match(requested, /fr\.wikipedia\.org\/api\/rest_v1\/feed\/onthisday\/all\/10\/18$/);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].highlighted, true);
  assert.equal(result.events[0].source, 'https://fr.wikipedia.org/wiki/BBC');
  assert.equal(dailyEvents(result)[0].date, '18 octobre 1922');
});

test('les réponses vides ou incomplètes ne peuvent pas remplacer le flux', async () => {
  await assert.rejects(fetchDailyFeed({ now, fetchImpl: async () => json({ events: [], births: [], deaths: [] }) }), /Aucun événement/);
  await assert.rejects(fetchDailyFeed({ now, fetchImpl: async () => json({ events: feed.events }) }), /births absente/);
});

test('une date grégorienne unique et sourcée est acceptée', () => {
  const result = reliableDate(entity(), event.date);
  assert.equal(result.date, '14 juillet 1789');
  assert.equal(result.isoDate, '1789-07-14');
});

test('les précisions année/mois et les dates avant notre ère ne créent pas de faux jour', () => {
  assert.equal(reliableDate(entity([claim({ precision: 9, time: '+1789-00-00T00:00:00Z' })]), '1789').date, '1789');
  assert.equal(reliableDate(entity([claim({ precision: 10, time: '+1789-07-00T00:00:00Z' })]), '1789').date, 'juillet 1789');
  const bce = reliableDate(entity([claim({ time: '-0044-03-15T00:00:00Z' })]), '44 av. J.-C.');
  assert.equal(bce.date, '15 mars 44 av. J.-C.');
  assert.equal(bce.isoDate, null);
  assert.equal(reliableDate(entity([claim({ precision: 9 })]), '14 juillet 1789').reason, 'less-precise');
});

test('les calendriers juliens, les dates incertaines, les plages et conflits restent inchangés', () => {
  assert.ok(reliableDate(entity([claim({ calendarmodel: 'http://www.wikidata.org/entity/Q1985786' })]), event.date).reason);
  assert.ok(reliableDate(entity([claim({ before: 1 })]), event.date).reason);
  assert.equal(reliableDate(entity(), '≈ 1789').reason, 'approximate-or-range');
  assert.equal(reliableDate(entity(), '1789 — 1799').reason, 'approximate-or-range');
  assert.equal(reliableDate(entity([claim(), claim({ time: '+1789-07-15T00:00:00Z' })]), event.date).reason, 'conflicting-dates');
  const unsourced = claim(); delete unsourced.references;
  assert.equal(reliableDate(entity([unsourced]), event.date).reason, 'uncertain-or-unsourced');
});

test('seules les correspondances exactes avec une date fiable produisent une correction', async () => {
  const result = await verifyDates({ timeline: { events: [event, { ...event, name: 'Bastille — événement non identifié' }] }, countries: [], now, fetchImpl: mockFetch });
  assert.equal(result.counts.total, 2);
  assert.equal(result.counts.corrected, 1);
  assert.equal(result.counts.unresolved, 1);
  assert.equal(result.corrections[0].date, '14 juillet 1789');
  assert.equal(result.corrections[0].source, 'https://www.wikidata.org/wiki/Q6539');
  assert.equal(result.corrections[0].era, 'contemporain');
});

test('une date déjà correcte est vérifiée sans correction superflue', async () => {
  const result = await verifyDates({ timeline: { events: [{ ...event, date: '14 juillet 1789' }] }, countries: [], now, fetchImpl: mockFetch });
  assert.equal(result.counts.verified, 1);
  assert.equal(result.corrections.length, 0);
});

test('les corrections sont affichées sans modifier les sources éditoriales et respectent les modifications manuelles', async () => {
  const verification = await verifyDates({ timeline: { events: [event] }, countries: [], now, fetchImpl: mockFetch });
  const snapshot = { verification };
  const changed = applyCorrections([event], snapshot)[0];
  assert.equal(changed.date, '14 juillet 1789');
  assert.equal(event.date, '1789');
  assert.equal(changed.dateVerification.previousDate, event.date);
  const manual = { ...event, date: '16 juillet 1789' };
  assert.equal(applyCorrections([manual], snapshot)[0], manual);
  assert.equal(applyCorrections([event], { verification: { corrections: 'bad' } })[0], event);
});

test('une ancienne correction sûre est conservée si la source devient ambiguë', async () => {
  const oldCorrection = { key: eventKey(event), previousDate: event.date, date: '14 juillet 1789' };
  const result = await verifyDates({ timeline: { events: [event] }, countries: [], previous: { policyVersion: 2, corrections: [oldCorrection] }, now, fetchImpl: async () => json({ success: 1, entities: {} }) });
  assert.deepEqual(result.corrections, [oldCorrection]);
  assert.equal(result.counts.retained, 1);
});

test('la publication est atomique et une seconde exécution le même jour ne contacte aucune API', async () => {
  const root = await mkdtemp(join(tmpdir(), 'histoiren-history-'));
  try {
    const dataPath = join(root, 'history.json');
    const timelinePath = join(root, 'timeline.json');
    const countriesPath = join(root, 'countries.json');
    await writeFile(timelinePath, JSON.stringify({ events: [event] }));
    await writeFile(countriesPath, '[]');
    const options = { now, dataPath, timelinePath, countriesPath, fetchImpl: mockFetch, logger: () => {} };
    const result = await synchronize(options);
    assert.equal(result.verification.counts.corrected, 1);
    assert.equal(JSON.parse(await readFile(dataPath, 'utf8')).events.length, 1);
    const skipped = await synchronize({ ...options, fetchImpl: () => { throw new Error('doit rester sans appel API'); } });
    assert.equal(skipped.skipped, true);
    const beforeFailure = await readFile(dataPath, 'utf8');
    const failed = await synchronize({ ...options, now: new Date('2026-10-19T12:00:00Z'), fetchImpl: async () => json({}, 503) });
    assert.match(failed.error, /503/);
    assert.equal(await readFile(dataPath, 'utf8'), beforeFailure);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('une période et une divergence avec une date éditoriale précise nécessitent une revue', () => {
  const period = entity(); period.claims.P580 = [claim()];
  assert.equal(reliableDate(period, '1789').reason, 'event-spans-a-period');
  assert.equal(reliableDate(entity(), '15 juillet 1789').reason, 'conflicting-editorial-date');
  assert.equal(reliableDate(entity(), '1788').reason, 'conflicting-editorial-date');
  assert.equal(reliableDate(entity(), '1789-1799').reason, 'approximate-or-range');
});


test('la collection publiée la plus récente est choisie, avec repli sur le fichier inclus', () => {
  const local = { date: '2026-10-18', lastUpdate: '2026-10-18T10:00:00Z', events: feed.events, verification: { date: '2026-10-18', policyVersion: 2, corrections: [] } };
  const remote = { ...local, date: '2026-10-19', lastUpdate: '2026-10-19T10:00:00Z', verification: { ...local.verification, date: '2026-10-19' } };
  assert.equal(newestUpdates(local, remote), remote);
  assert.equal(newestUpdates(local, null), local);
  assert.equal(newestUpdates(local, { ...remote, events: [] }), local);
  assert.equal(newestUpdates(local, { ...remote, verification: {} }), local);
  assert.equal(newestUpdates(null, null), null);
});
