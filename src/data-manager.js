import { state } from './state.js';
import { applyCorrections, dailyEvents, newestUpdates } from './history-updates.js';
import { mergeTimelineEvents, detectEventThemes, parseHistoricalDate } from './utils.js';

const MAX_JSON_CHARACTERS = 5_000_000;
const MAX_TIMELINE_EVENTS = 10_000;
const MAX_COUNTRIES = 300;
const MAX_COUNTRY_EVENTS = 10_000;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertText(value, path, { max = 4_000, required = true } = {}) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new Error(`Champ invalide dans ${path}`);
  }
}

async function readBoundedJson(response, label) {
  const announcedSize = Number.parseInt(response.headers.get('content-length') || '0', 10);
  if (announcedSize > MAX_JSON_CHARACTERS) {
    throw new Error(`${label} dépasse la taille maximale autorisée`);
  }

  const raw = await response.text();
  if (raw.length > MAX_JSON_CHARACTERS) {
    throw new Error(`${label} dépasse la taille maximale autorisée`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`JSON invalide dans ${label}`);
  }
}

function validateTimelineData(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.events) || !Array.isArray(payload.eras)) {
    throw new Error('Structure invalide pour timeline.json');
  }
  if (payload.events.length > MAX_TIMELINE_EVENTS || payload.eras.length > 20) {
    throw new Error('Volume de données invalide pour timeline.json');
  }

  const eraIds = new Set();
  payload.eras.forEach((era, index) => {
    if (!isRecord(era)) throw new Error(`Époque invalide à la position ${index}`);
    assertText(era.id, `eras[${index}].id`, { max: 80 });
    assertText(era.name, `eras[${index}].name`, { max: 120 });
    assertText(era.subtitle || '', `eras[${index}].subtitle`, { max: 300, required: false });
    assertText(era.icon || '', `eras[${index}].icon`, { max: 20, required: false });
    if (eraIds.has(era.id)) throw new Error(`Identifiant d'époque dupliqué : ${era.id}`);
    eraIds.add(era.id);
  });

  payload.events.forEach((event, index) => {
    if (!isRecord(event)) throw new Error(`Événement invalide à la position ${index}`);
    assertText(event.name, `events[${index}].name`, { max: 500 });
    assertText(event.date, `events[${index}].date`, { max: 120 });
    assertText(event.era, `events[${index}].era`, { max: 80 });
    assertText(event.category, `events[${index}].category`, { max: 100 });
    assertText(event.context || '', `events[${index}].context`, { max: 8_000, required: false });
    assertText(event.people || '', `events[${index}].people`, { max: 2_000, required: false });
    if (!eraIds.has(event.era)) throw new Error(`Époque inconnue dans events[${index}]`);
  });

  return payload;
}

function validateCountriesData(payload) {
  if (!Array.isArray(payload) || payload.length > MAX_COUNTRIES) {
    throw new Error('Structure invalide pour countries.json');
  }

  const countryIds = new Set();
  let totalEvents = 0;
  payload.forEach((country, countryIndex) => {
    if (!isRecord(country) || !Array.isArray(country.events)) {
      throw new Error(`Pays invalide à la position ${countryIndex}`);
    }
    assertText(country.id, `countries[${countryIndex}].id`, { max: 80 });
    assertText(country.name, `countries[${countryIndex}].name`, { max: 160 });
    assertText(country.flag || '', `countries[${countryIndex}].flag`, { max: 16, required: false });
    if (countryIds.has(country.id)) throw new Error(`Identifiant de pays dupliqué : ${country.id}`);
    countryIds.add(country.id);

    totalEvents += country.events.length;
    if (totalEvents > MAX_COUNTRY_EVENTS) throw new Error('Trop d’événements dans countries.json');
    country.events.forEach((event, eventIndex) => {
      if (!isRecord(event)) throw new Error(`Événement pays invalide à la position ${eventIndex}`);
      assertText(event.name, `countries[${countryIndex}].events[${eventIndex}].name`, { max: 500 });
      assertText(event.date, `countries[${countryIndex}].events[${eventIndex}].date`, { max: 120 });
      assertText(event.context || '', `countries[${countryIndex}].events[${eventIndex}].context`, { max: 8_000, required: false });
      assertText(event.category || 'politique', `countries[${countryIndex}].events[${eventIndex}].category`, { max: 100 });
    });
  });

  return payload;
}

export async function loadData() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const bundledUpdates = fetch('data/day-in-history.json', { signal: controller.signal, cache: 'no-cache' }).then(response => response.ok ? readBoundedJson(response, 'day-in-history.json') : null).catch(() => null);
    // The public repository is the published data store: daily updates do not require a new deployment.
    const publishedUpdates = window.location.protocol === 'https:'
      ? fetch('https://raw.githubusercontent.com/SimonBitton/Histoiren/main/data/day-in-history.json', { signal: AbortSignal.timeout(4000), cache: 'no-cache' }).then(response => response.ok ? readBoundedJson(response, 'published history') : null).catch(() => null)
      : Promise.resolve(null);
    const updatesPromise = Promise.all([bundledUpdates, publishedUpdates]).then(([bundled, published]) => newestUpdates(bundled, published));
    const [timelineRes, countriesRes] = await Promise.all([
      fetch('data/timeline.json', { signal: controller.signal }),
      fetch('data/countries.json', { signal: controller.signal })
    ]);

    if (!timelineRes.ok || !countriesRes.ok) {
      throw new Error(`Erreur HTTP (${timelineRes.status}/${countriesRes.status}) lors du chargement des données.`);
    }

    const [timelineData, countriesData] = await Promise.all([
      readBoundedJson(timelineRes, 'timeline.json'),
      readBoundedJson(countriesRes, 'countries.json')
    ]);
    validateTimelineData(timelineData);
    validateCountriesData(countriesData);

    const snapshot = await updatesPromise;
    state.historyUpdates = snapshot;
    const updatedEvents = applyCorrections(timelineData.events, snapshot);
    const incomingEvents = dailyEvents(snapshot);
    state.timelineData = {
      ...timelineData,
      events: mergeTimelineEvents([...updatedEvents, ...incomingEvents])
    };
    state.countriesData = countriesData.map(country => ({ ...country, events: applyCorrections(country.events, snapshot, country.id) }));

    if (state.timelineData && Array.isArray(state.timelineData.events)) {
      state.eventById = new Map();
      const usedIds = new Set();
      state.timelineData.events.forEach((event, idx) => {
        const requestedId = typeof event.id === 'string' && event.id ? event.id : `evt-${idx}`;
        event.id = usedIds.has(requestedId) ? `${requestedId}-${idx}` : requestedId;
        usedIds.add(event.id);
        // Enrichissement : thèmes et année pour les fiches et la visualisation.
        event._themes = detectEventThemes(event);
        const parsed = parseHistoricalDate(event.date);
        event._year = parsed ? parsed.year : null;
        state.eventById.set(event.id, event);
      });
    }

    return {
      timeline: state.timelineData,
      countries: state.countriesData
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Le chargement des données a expiré. Vérifiez votre connexion puis rechargez la page.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getEventById(id) {
  if (!id || !state.eventById) return null;
  return state.eventById.get(id) || null;
}
