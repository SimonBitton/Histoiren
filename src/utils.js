export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const MONTH_NAMES = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre'
];

export function parseHistoricalDate(text) {
  if (!text) return null;

  const clean = normalizeText(text)
    .replace(/≈|vers|ca\.?|env\.?/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Conserve les séparateurs de milliers : « 500 000 av. J.-C. » est une
  // seule année, pas les nombres 500 puis 000.
  const digits = [...clean.matchAll(/\d{1,3}(?:[ .]\d{3})+|\d+/g)].map((match) => ({
    value: Number.parseInt(match[0].replace(/[ .]/g, ''), 10),
    index: match.index ?? 0
  })).filter((match) => !Number.isNaN(match.value));

  if (digits.length === 0) return null;

  const hasMonth = MONTH_NAMES.some((month) => clean.includes(month));
  const hasBce = clean.includes('av. j.-c');
  // Les données commencent généralement par l'année (« 2012 (4 juillet) »).
  // Pour la forme française « 4 juillet 1776 », le premier nombre > 31 est
  // l'année. Cela évite de confondre jour du mois et année.
  let yearIndex = 0;
  if (hasMonth) {
    const explicitYearIndex = digits.findIndex((entry) => entry.value > 31);
    yearIndex = explicitYearIndex >= 0 ? explicitYearIndex : digits.length - 1;
  }

  let year = digits[yearIndex].value;
  if (hasBce) {
    year *= -1;
  }

  const monthIndex = hasMonth
    ? MONTH_NAMES.findIndex((month) => clean.includes(month))
    : -1;

  let day = null;
  let specificity = 1;

  if (monthIndex >= 0) {
    specificity = 2;
    const monthMarker = MONTH_NAMES[monthIndex];
    const monthPosition = clean.indexOf(monthMarker);
    const candidateDay = digits.find((match) => match.index < monthPosition && match.value >= 1 && match.value <= 31);
    if (candidateDay) {
      day = candidateDay.value;
      specificity = 3;
    }
  } else if (digits.length > 1) {
    specificity = 2;
  }

  return {
    year,
    month: monthIndex >= 0 ? monthIndex + 1 : null,
    day,
    specificity
  };
}

export function compareHistoricalDates(left, right) {
  const leftParsed = parseHistoricalDate(left);
  const rightParsed = parseHistoricalDate(right);

  if (!leftParsed && !rightParsed) return 0;
  if (!leftParsed) return 1;
  if (!rightParsed) return -1;

  if (leftParsed.year !== rightParsed.year) {
    return leftParsed.year - rightParsed.year;
  }

  const leftMonth = leftParsed.month ?? 0;
  const rightMonth = rightParsed.month ?? 0;
  if (leftMonth !== rightMonth) {
    return leftMonth - rightMonth;
  }

  const leftDay = leftParsed.day ?? 0;
  const rightDay = rightParsed.day ?? 0;
  if (leftDay !== rightDay) {
    return leftDay - rightDay;
  }

  return rightParsed.specificity - leftParsed.specificity;
}

export function mergeTimelineEvents(events) {
  const grouped = new Map();

  for (const event of events) {
    const key = [
      normalizeText(event.name).replace(/\s+/g, ' ').trim(),
      normalizeText(event.era).replace(/\s+/g, ' ').trim(),
      normalizeText(event.category).replace(/\s+/g, ' ').trim()
    ].join('::');

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(event);
  }

  const mergedEvents = [];

  for (const group of grouped.values()) {
    if (group.length === 1) {
      mergedEvents.push(group[0]);
      continue;
    }

    const canonical = [...group].sort((left, right) => {
      const leftParsed = parseHistoricalDate(left.date);
      const rightParsed = parseHistoricalDate(right.date);

      if (!leftParsed && !rightParsed) return 0;
      if (!leftParsed) return 1;
      if (!rightParsed) return -1;
      if (leftParsed.year !== rightParsed.year) {
        return leftParsed.year - rightParsed.year;
      }
      if (leftParsed.specificity !== rightParsed.specificity) {
        return rightParsed.specificity - leftParsed.specificity;
      }
      return compareHistoricalDates(left.date, right.date);
    })[0];

    const contexts = [...new Set(group.map((event) => (event.context || '').trim()).filter(Boolean))];
    const people = [...new Set(group.map((event) => (event.people || '').trim()).filter(Boolean))];

    mergedEvents.push({
      ...canonical,
      major: group.some((event) => Boolean(event.major)),
      context: contexts.sort((left, right) => right.length - left.length)[0] || canonical.context || '',
      people: people.join(', ')
    });
  }

  return mergedEvents.sort((left, right) => compareHistoricalDates(left.date, right.date));
}

export function debounce(fn, delay = 140) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

export function estimateYearFromText(text) {
  if (!text) return null;
  const clean = text
    .toLowerCase()
    .replace(/≈|vers|ca\.?|env\.?/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const firstYear = clean.match(/(\d[\d\s]*)/);
  if (!firstYear) return null;
  const numeric = parseInt(firstYear[1].replace(/\s/g, ''), 10);
  if (Number.isNaN(numeric)) return null;
  return clean.includes('av. j.-c') ? -numeric : numeric;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getCategoryClass(category) {
  const normalizedLabel = normalizeCategory(category);
  if (normalizedLabel === 'histoire') return 'cat-histoire';
  if (normalizedLabel === 'science') return 'cat-science';
  if (normalizedLabel === 'culture') return 'cat-culture';
  return 'cat-politique';
}

export function normalizeCategory(category) {
  const normalized = normalizeText(category);
  if (normalized === 'histoire') return 'histoire';
  if (normalized.includes('science')) return 'science';
  if (normalized.includes('culture') || normalized.includes('exploration')) return 'culture';
  return 'politique';
}

export function getCategoryLabel(category) {
  const normalized = normalizeCategory(category);
  if (normalized === 'histoire') return 'Histoire';
  if (normalized === 'science') return 'Science';
  if (normalized === 'culture') return 'Culture';
  return 'Politique';
}

/* ══════════════════════════════════════════════════
   THÈMES — Classification fine pour filtres avancés
══════════════════════════════════════════════════ */

export const THEME_DEFINITIONS = [
  { key: 'guerre', label: 'Guerres', icon: '⚔️' },
  { key: 'invention', label: 'Inventions', icon: '🔬' },
  { key: 'personnage', label: 'Personnages', icon: '👑' },
  { key: 'religion', label: 'Religion', icon: '⛪' },
  { key: 'art', label: 'Art & Culture', icon: '🎨' },
  { key: 'exploration', label: 'Exploration', icon: '🧭' },
  { key: 'politique', label: 'Politique', icon: '🏛️' }
];

const THEME_PATTERNS = {
  guerre: /guerre|bataille|conflit|siege|invasion|croisade|conquete|revolte|insurrection|massacre|attentat|offensive|debarquement|armistice|capitulation/,
  invention: /invention|decouverte|brevet|machine|moteur|telescope|imprimerie|vaccin|ordinateur|internet|electricite|telephone|automobile|avion|fusee|theorie|formule|microscope|antibiotique|adn|atome/,
  personnage: /naissance|mort|deces|regne|couronnement|sacre|empereur|imperatrice|\broi\b|reine|pharaon|pape|president|philosophe|peintre|ecrivain|savant|general|chancelier|dictateur/,
  religion: /religion|eglise|temple|cathedrale|christianisme|chretien|islam|musulman|bouddhisme|judaisme|reforme|concile|\bpape\b|prophete|bible|coran|croisade|protestant|catholique/,
  art: /peinture|sculpture|roman|poeme|symphonie|opera|cinema|theatre|litterature|renaissance artistique|cathedrale|architecture|musee|fresque|chef-d.oeuvre/,
  exploration: /exploration|voyage|expedition|circumnavigation|colonisation|conquistador|nouveau monde|cap de|route maritime|antarctique|everest|lune|espace|mars/
};

export function detectEventThemes(event) {
  const text = normalizeText(`${event.name || ''} ${event.context || ''} ${event.people || ''}`);
  const themes = new Set();

  for (const [key, pattern] of Object.entries(THEME_PATTERNS)) {
    if (pattern.test(text)) themes.add(key);
  }

  const cat = normalizeText(event.category || '');
  if (cat.includes('science')) themes.add('invention');
  if (cat.includes('culture')) themes.add('art');
  if (cat.includes('exploration')) themes.add('exploration');
  if (cat.includes('politique')) themes.add('politique');

  return [...themes];
}

/* Recherche multi-champ : nom, contexte, personnages, date, catégorie, thème */
export function eventMatchesSearch(event, normalizedSearch) {
  if (!normalizedSearch) return true;
  const haystack = normalizeText([
    event.name,
    event.context,
    event.people,
    event.date,
    getCategoryLabel(event.category),
    (event._themes || []).join(' ')
  ].filter(Boolean).join(' '));
  return haystack.includes(normalizedSearch);
}

export function sanitizeExternalUrl(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return null;
  if (rawValue.length > 2048) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  if (/[^\x20-\x7E]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function getAppleFlagEmojiHtml(flagEmoji, countryName = '') {
  if (!flagEmoji || typeof flagEmoji !== 'string') return '';
  const codePoints = [...flagEmoji].map((char) => char.codePointAt(0).toString(16));
  const filename = codePoints.join('-').toLowerCase() + '.png';
  const url = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${filename}`;
  return `<img class="apple-flag" src="${url}" alt="${escapeHtml(countryName || flagEmoji)}" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
}
