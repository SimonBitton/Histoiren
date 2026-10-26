// Apply a verified overlay without rewriting the editorial source files.
export const historyKey = (event, countryId = '') => JSON.stringify([countryId, event.name, event.date]);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const eraOf = year => year < -3500 ? 'prehist' : year < 476 ? 'antiquite' : year < 1492 ? 'moyen-age' : year < 1789 ? 'modernes' : 'contemporain';

export function applyCorrections(events, snapshot, countryId = '') {
  const candidates = Array.isArray(snapshot?.verification?.corrections) ? snapshot.verification.corrections : [];
  const corrections = new Map(candidates.filter(correction =>
    correction && typeof correction.key === 'string' && typeof correction.date === 'string' && correction.date.length <= 120 && Number.isInteger(correction.year) && /^https:\/\/www\.wikidata\.org\/wiki\/Q[1-9]\d*$/.test(correction.source || '')
  ).map(correction => [correction.key, correction]));
  return events.map(event => {
    const correction = corrections.get(historyKey(event, countryId));
    if (!correction || correction.previousDate !== event.date) return event;
    return { ...event, date: correction.date, ...(countryId ? { year: correction.year, isoDate: correction.isoDate, era: eraOf(correction.year) } : { era: eraOf(correction.year) }), dateVerification: { source: correction.source, verifiedAt: correction.verifiedAt, previousDate: event.date } };
  });
}

export function dailyEvents(snapshot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot?.date || '') || !Array.isArray(snapshot.events)) return [];
  const [, month, day] = snapshot.date.split('-').map(Number);
  if (!MONTHS[month - 1] || day < 1 || day > 31 || snapshot.events.length > 2000) return [];
  return snapshot.events.flatMap((entry, index) => {
    if (!Number.isInteger(entry.year) || !entry.year || typeof entry.description !== 'string' || entry.description.length < 10 || entry.description.length > 4000) return [];
    return [{ id: `daily-${snapshot.date}-${index}`, name: entry.description.slice(0, 480), date: `${day} ${MONTHS[month - 1]} ${Math.abs(entry.year)}${entry.year < 0 ? ' av. J.-C.' : ''}`, era: eraOf(entry.year), category: 'histoire', context: entry.description, people: '', major: false, _daily: true, _highlighted: Boolean(entry.highlighted), source: { type: 'wikipedia', url: entry.source } }];
  });
}

export function newestUpdates(bundled, published) {
  return [bundled, published].filter(snapshot => snapshot && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date || '') && Number.isFinite(Date.parse(snapshot.lastUpdate)) && Array.isArray(snapshot.events) && snapshot.events.length && snapshot.verification?.date === snapshot.date && snapshot.verification?.policyVersion === 2 && Array.isArray(snapshot.verification.corrections))
    .sort((left, right) => Date.parse(right.lastUpdate) - Date.parse(left.lastUpdate))[0] || null;
}
