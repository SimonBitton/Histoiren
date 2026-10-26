import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDailyFeed, parisDate } from './history-api.mjs';
import { verifyDates } from './verify-dates-wikidata.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function synchronize({ now = new Date(), fetchImpl = fetch, dataPath = resolve(ROOT, 'data/day-in-history.json'), timelinePath = resolve(ROOT, 'data/timeline.json'), countriesPath = resolve(ROOT, 'data/countries.json'), pause, logger = console.log } = {}) {
  let previous = {};
  let temporaryPath;
  try {
    try { previous = JSON.parse(await readFile(dataPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const today = parisDate(now);
    if (previous.date === today && previous.verification?.date === today && previous.verification?.policyVersion === 2 && previous.events?.length) {
      logger('[history] Déjà mis à jour pour cette journée. Aucun appel API.');
      return { ...previous, skipped: true };
    }
    const [timeline, countries] = await Promise.all([timelinePath, countriesPath].map(path => readFile(path, 'utf8').then(JSON.parse)));
    const [feed, verification] = await Promise.all([
      fetchDailyFeed({ now, fetchImpl }),
      verifyDates({ timeline, countries, previous: previous.verification, now, fetchImpl, pause })
    ]);
    const result = { ...feed, verification };
    // Publish the feed and the date corrections together, only after every request succeeds.
    temporaryPath = `${dataPath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, dataPath);
    logger(`[history] ${feed.date}: ${feed.events.length} événements du jour; ${verification.counts.verified} dates vérifiées, ${verification.counts.corrected} corrigées ou précisées, ${verification.counts.unresolved} cas non résolus.`);
    return result;
  } catch (error) {
    if (temporaryPath) await unlink(temporaryPath).catch(() => {});
    logger(`[history] Échec, données précédentes conservées : ${error.message}`);
    return { ...previous, error: error.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await synchronize();
  if (result.error) process.exitCode = 1;
}
