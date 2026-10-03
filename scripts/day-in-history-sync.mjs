import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE_URL = 'https://api.dayinhistory.com/v1';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;
const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../data/day-in-history.json');
const LOG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../data/day-in-history-sync.log');
const KV_KEY = 'histoiren:day-in-history';

const cleanText = (value) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalized = (value) => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

function extractEntries(payload, category) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of [category, 'data', 'results', 'items']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function normalizeEntry(raw, category) {
  if (!raw || typeof raw !== 'object') return null;
  const yearValue = raw.year ?? raw.date ?? raw.year_of_event ?? raw.birth_year ?? raw.death_year;
  const yearMatch = String(yearValue ?? '').match(/-?\d{1,6}/);
  const year = yearMatch ? Number(yearMatch[0]) : NaN;
  const title = cleanText(raw.title ?? raw.name ?? raw.event ?? raw.person ?? '');
  const description = cleanText(raw.description ?? raw.text ?? raw.summary ?? raw.details ?? '');
  const name = cleanText(raw.name ?? raw.person ?? raw.title ?? '');
  const primaryText = category === 'events' ? (title || description) : (name || title || description);

  if (!Number.isInteger(year) || year < -100_000 || year > new Date().getUTCFullYear() + 1) return null;
  if (primaryText.length < 10 && description.length < 10 && title.length < 10) return null;

  return {
    year,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(category !== 'events' && name ? { name } : {})
  };
}

function similarity(left, right) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = left[row - 1] === right[column - 1]
        ? diagonal
        : Math.min(diagonal, previous[column - 1], above) + 1;
      diagonal = above;
    }
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function entryText(entry) {
  return normalized([entry.title, entry.description, entry.name].filter(Boolean).join(' '));
}

function completeness(entry) {
  return Object.values(entry).filter(Boolean).reduce((total, value) => total + String(value).length, 0);
}

function deduplicate(entries) {
  const unique = [];
  let removed = 0;
  for (const entry of entries) {
    const entryKey = entryText(entry);
    const duplicateIndex = unique.findIndex((candidate) => {
      if (candidate.year !== entry.year) return false;
      const sameTitle = entry.title && candidate.title && normalized(entry.title) === normalized(candidate.title);
      const sameDescription = entry.description && candidate.description
        && normalized(entry.description) === normalized(candidate.description);
      const sameName = entry.name && candidate.name && normalized(entry.name) === normalized(candidate.name);
      return sameTitle || sameDescription || sameName || similarity(entryKey, entryText(candidate)) > 0.95;
    });

    if (duplicateIndex === -1) {
      unique.push(entry);
    } else {
      removed += 1;
      if (completeness(entry) > completeness(unique[duplicateIndex])) unique[duplicateIndex] = entry;
    }
  }
  return { entries: unique, removed };
}

async function fetchJson(path) {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} sur ${path}`);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError' && attempt < MAX_RETRIES) {
        attempt += 1;
        continue;
      }
      if (error.name === 'AbortError') throw new Error(`Timeout après ${REQUEST_TIMEOUT_MS} ms sur ${path}`);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

async function readDatabase() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const response = await fetch(process.env.KV_REST_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      body: JSON.stringify(['GET', KV_KEY])
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} lors de la lecture KV`);
    const body = await response.json();
    if (body.result) return JSON.parse(body.result);
  }
  try {
    return JSON.parse(await readFile(DATA_PATH, 'utf8'));
  } catch {
    return { lastUpdate: null, events: [], births: [], deaths: [] };
  }
}

async function writeDatabase(database) {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const response = await fetch(process.env.KV_REST_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', KV_KEY, JSON.stringify(database)])
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} lors de l’écriture KV`);
    return;
  }
  const temporaryPath = `${DATA_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, DATA_PATH);
}

async function writeLog(record) {
  const line = `${JSON.stringify(record)}\n`;
  try {
    await writeFile(LOG_PATH, line, { encoding: 'utf8', flag: 'a' });
  } catch {
    // Logging to stdout remains available in read-only serverless environments.
  }
  console.log('[day-in-history]', line.trim());
}

export async function synchronize() {
  const previous = await readDatabase();
  const startedAt = new Date().toISOString();
  try {
    const payloads = await Promise.all([
      fetchJson('/today/events/'),
      fetchJson('/today/births/'),
      fetchJson('/today/deaths/')
    ]);
    const categories = ['events', 'births', 'deaths'];
    const result = { lastUpdate: startedAt, events: [], births: [], deaths: [] };
    let removed = 0;
    let fetched = 0;

    categories.forEach((category, index) => {
      const entries = extractEntries(payloads[index], category)
        .map((entry) => normalizeEntry(entry, category))
        .filter(Boolean);
      fetched += entries.length;
      const previousEntries = Array.isArray(previous[category]) ? previous[category] : [];
      const deduplicated = deduplicate([...previousEntries, ...entries]);
      result[category] = deduplicated.entries.sort((left, right) => left.year - right.year);
      removed += deduplicated.removed;
    });

    await writeDatabase(result);
    const added = Math.max(0, categories.reduce((total, category) => (
      total + result[category].length - (previous[category]?.length || 0)
    ), 0));
    await writeLog({ date: startedAt, fetched, duplicatesRemoved: removed, added, errors: [] });
    return { ...result, stats: { fetched, duplicatesRemoved: removed, added } };
  } catch (error) {
    await writeLog({ date: startedAt, fetched: 0, duplicatesRemoved: 0, added: 0, errors: [error.message] });
    return { ...previous, error: error.message };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await synchronize();
  if (result.error) process.exitCode = 1;
  else console.log(JSON.stringify(result.stats));
}