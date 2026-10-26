import { state } from './state.js';
import { compareHistoricalDates, escapeHtml, getCategoryClass, getCategoryLabel, normalizeText, eventMatchesSearch, THEME_DEFINITIONS, getAppleFlagEmojiHtml } from './utils.js';
import { renderWorldMap } from './worldmap.js';
import { getContinentOf, getContinentMeta } from './continents.js';

function passesFilters(event, search) {
  if (state.timelineEra !== 'all' && event.era !== state.timelineEra) return false;
  if (state.timelineTheme !== 'all' && !(event._themes || []).includes(state.timelineTheme)) return false;
  return eventMatchesSearch(event, search);
}

function groupEventsByEra(events, search) {
  const grouped = new Map();
  for (const event of events) {
    if (!passesFilters(event, search)) continue;
    if (!grouped.has(event.era)) grouped.set(event.era, []);
    grouped.get(event.era).push(event);
  }
  for (const [, eraEvents] of grouped) {
    eraEvents.sort((left, right) => {
      return compareHistoricalDates(left.date, right.date);
    });
  }
  return grouped;
}

function hasActiveFilters(search) {
  return Boolean(search) || state.timelineEra !== 'all' || state.timelineTheme !== 'all';
}

function renderFilterBar() {
  const eras = [{ id: 'all', name: 'Toutes les époques' }, ...(state.timelineData?.eras || [])];
  const themes = [{ key: 'all', label: 'Tous les thèmes' }, ...THEME_DEFINITIONS];
  return `<div class="filter-bar" id="timelineFilterBar">
    <div class="filter-field"><label for="eraFilter">Époque</label><select id="eraFilter" data-filter="era">${eras.map(era => `<option value="${escapeHtml(era.id)}" ${state.timelineEra === era.id ? 'selected' : ''}>${escapeHtml(era.name)}</option>`).join('')}</select></div>
    <div class="filter-field"><label for="themeFilter">Thème</label><select id="themeFilter" data-filter="theme">${themes.map(theme => `<option value="${escapeHtml(theme.key)}" ${state.timelineTheme === theme.key ? 'selected' : ''}>${escapeHtml(theme.label)}</option>`).join('')}</select></div>
    ${hasActiveFilters(state.timelineSearch) ? '<button type="button" class="reset-filters" data-reset-filters>Tout effacer</button>' : ''}
  </div>`;
}

function bindFilterBar(container) {
  const bar = container.querySelector('#timelineFilterBar');
  bar?.addEventListener('change', (event) => {
    const { filter } = event.target.dataset;
    if (!filter) return;
    if (filter === 'era') state.timelineEra = event.target.value;
    if (filter === 'theme') state.timelineTheme = event.target.value;
    const focusId = event.target.id;
    renderActiveTimelineView();
    document.getElementById(focusId)?.focus({ preventScroll: true });
  });
  bar?.querySelector('[data-reset-filters]')?.addEventListener('click', () => {
    state.timelineSearch = '';
    state.timelineEra = 'all';
    state.timelineTheme = 'all';
    window.dispatchEvent(new Event('histoiren:sync-search-inputs'));
    renderActiveTimelineView();
    document.getElementById('searchInput')?.focus();
  });
}

function getTimelineFilterData() {
  const search = normalizeText(state.timelineSearch);
  const filtersActive = hasActiveFilters(search);
  const groupedByEra = groupEventsByEra(state.timelineData.events, search);
  const filteredFlat = [...groupedByEra.values()].flat();
  return { search, filtersActive, groupedByEra, filteredFlat, totalMatches: filteredFlat.length };
}

export function renderActiveTimelineView() {
  if (state.currentView === 'timeline') renderTimelineList();
}

export function renderTimelineList() {
  const container = document.getElementById('timelineContent');
  if (!container || !state.timelineData) return;

  const { filtersActive, groupedByEra, totalMatches } = getTimelineFilterData();

  let html = renderFilterBar();

  {
    html += `<p class="filter-result-count" role="status">${totalMatches} événement${totalMatches > 1 ? 's' : ''} trouvé${totalMatches > 1 ? 's' : ''}</p>`;
  }

  html += state.timelineData.eras.map((era) => {
    const eraEvents = groupedByEra.get(era.id) || [];
    if (eraEvents.length === 0 && filtersActive) return '';

    return `
      <section class="era-section reveal" id="era-${escapeHtml(era.id)}">
        <div class="era-header">

          <div class="era-title-block">
            <h2>${escapeHtml(era.name)}</h2>
            <p>${escapeHtml(era.subtitle)}</p>
          </div>
        </div>
        <div class="events-list">
          ${eraEvents.map((event) => `
            <button class="event ${event.major ? 'major' : ''}" data-id="${escapeHtml(event.id)}" type="button">
              <span class="event-dot" aria-hidden="true"></span>
              <div class="event-content">
                <span class="event-date">${escapeHtml(event.date)}</span>
                <div class="event-text">
                  <span class="event-name">${escapeHtml(event.name)}</span>
                  <span class="event-context">${escapeHtml(event.context)}</span>
                  ${event.people ? `<span class="event-people">${escapeHtml(event.people)}</span>` : ''}
                </div>
                <span class="event-cat ${getCategoryClass(event.category)}">${escapeHtml(getCategoryLabel(event.category))}</span>
              </div>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }).join('');

  if (filtersActive && totalMatches === 0) {
    html += '<p class="empty-state">Aucun événement ne correspond à ces critères. Essayez d\'élargir vos filtres.</p>';
  }

  container.innerHTML = html;
  bindTimelineClicks(container);
  bindFilterBar(container);
  observeReveals(container);
}

function bindTimelineClicks(container) {
  container.onclick = (event) => {
    const eventCard = event.target.closest('.event');
    if (!eventCard) return;
    const eventId = eventCard.dataset.id;
    if (eventId && window.showDetail) window.showDetail(eventId);
  };
}

let revealObserver = null;
function observeReveals(container) {
  if (revealObserver) revealObserver.disconnect();
  if (!('IntersectionObserver' in window)) {
    container.querySelectorAll('.reveal').forEach((el) => el.classList.add('revealed'));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  container.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}

export function renderCountries() {
  const container = document.getElementById('countriesGrid');
  if (!container || !state.countriesData) return;

  renderWorldMap(document.getElementById('worldMapContainer'));
  renderContinentBanner();

  const search = normalizeText(state.countrySearch);
  const filtered = state.countriesData.filter((country) => {
    if (state.countryContinent !== 'all' && getContinentOf(country.name) !== state.countryContinent) return false;
    return normalizeText(country.name).includes(search);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun pays ne correspond à votre recherche.</p>';
    container.onclick = null;
    return;
  }

  container.innerHTML = filtered.map((country) => `
    <button class="country-card" type="button" data-country-id="${escapeHtml(country.id)}" aria-label="Ouvrir la chronologie de ${escapeHtml(country.name)}">
      <div class="country-flag">${getAppleFlagEmojiHtml(country.flag, country.name)}</div>
      <div class="country-info">
        <h3>${escapeHtml(country.name)}</h3>
        <p>${country.events.length} Événements</p>
      </div>
    </button>
  `).join('');

  container.onclick = (event) => {
    const card = event.target.closest('.country-card');
    if (!card) return;
    const countryId = card.dataset.countryId;
    if (countryId && window.showCountryDetail) window.showCountryDetail(countryId);
  };
}

function renderContinentBanner() {
  const banner = document.getElementById('continentBanner');
  if (!banner) return;
  if (state.countryContinent === 'all') {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  const meta = getContinentMeta(state.countryContinent);
  const count = state.countriesData.filter((c) => getContinentOf(c.name) === state.countryContinent).length;
  banner.hidden = false;
  banner.innerHTML = `
    <span class="continent-banner-label">${escapeHtml(meta?.label || '')} · ${count} pays</span>
    <button class="continent-banner-reset" type="button" data-continent-reset>✕ Voir tous les pays</button>
  `;
  banner.querySelector('[data-continent-reset]')?.addEventListener('click', () => {
    state.countryContinent = 'all';
    renderCountries();
  });
}

export function renderStats() {
  renderDailyHistory();
  const container = document.getElementById('presentationStats');
  if (!container) return;

  const totalEvents = state.timelineData?.events.length || 0;
  const totalCountries = state.countriesData?.length || 0;

  container.innerHTML = `<p class="collection-summary"><strong>${totalEvents.toLocaleString('fr-FR')}</strong> événements <span aria-hidden="true">·</span> <strong>${totalCountries}</strong> pays <span aria-hidden="true">·</span> <strong>${state.timelineData?.eras.length || 0}</strong> époques à explorer</p>`;
}


function renderDailyHistory() {
  const container = document.getElementById('dailyHistory');
  const snapshot = state.historyUpdates;
  if (!container || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot?.date || '') || !Number.isFinite(Date.parse(snapshot.lastUpdate)) || !Array.isArray(snapshot.events)) return;
  const events = state.timelineData.events.filter(event => event._daily);
  if (!events.length) return;
  const chosen = [...events].sort((left, right) => Number(right._highlighted) - Number(left._highlighted)).slice(0, 3);
  const formatted = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${snapshot.date}T12:00:00Z`));
  const updated = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(snapshot.lastUpdate));
  container.hidden = false;
  container.innerHTML = `
    <div class="daily-heading"><div><div class="section-folio">AU FIL DES DATES · ${escapeHtml(formatted)}</div><h2 id="dailyHistoryTitle">À cette date dans l’histoire</h2></div><p>Collection du ${escapeHtml(snapshot.date)}<br>Actualisée le ${escapeHtml(updated)}</p></div>
    <div class="daily-events">${chosen.map(event => `<button type="button" class="daily-event" data-daily-id="${escapeHtml(event.id)}"><span>${escapeHtml(event.date)}</span><strong>${escapeHtml(event.name)}</strong><small>Découvrir l’événement <span aria-hidden="true">↗</span></small></button>`).join('')}</div>
    <p class="daily-attribution">Source : <a href="https://fr.wikipedia.org" target="_blank" rel="noopener noreferrer">Wikipédia en français</a> · Textes sous <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. ${snapshot.verification?.counts?.verified || 0} dates existantes vérifiées lors de cette actualisation.</p>`;
  container.onclick = event => {
    const card = event.target.closest('[data-daily-id]');
    if (card) window.showDetail(card.dataset.dailyId, 'timeline');
  };
}
