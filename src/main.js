import { state } from './state.js';
import { loadData, getEventById } from './data-manager.js';
import { initRouter, setView } from './router.js';
import { toggleSidebar, buildSidebarContent } from './sidebar.js';
import { renderActiveTimelineView, renderCountries } from './ui-renderer.js';
import { showDetailPage } from './detail-view.js';
import { showCountryDetail, closeCountryModal } from './country-modal.js';
import { getKeyModifier } from './os-detect.js';
import { markAppVisited } from './app-state.js';
import { initLearn } from './quiz.js';
import { debounce } from './utils.js';

const MAX_SEARCH_LENGTH = 120;

function cleanupDebugBadges() {
  const ids = ['js-loaded', 'jsLoaded', 'js-status', 'debug-status'];
  ids.forEach((id) => document.getElementById(id)?.remove());

  // Defensive cleanup for extension/dev leftover text badge.
  const exactBadge = Array.from(document.querySelectorAll('body *')).find((el) => {
    return el.children.length === 0 && el.textContent?.trim() === 'JS Loaded';
  });
  exactBadge?.remove();

  // Defensive cleanup for accidental text badges.
  const removeStrayBadges = () => {
    const stray = Array.from(document.querySelectorAll('body *')).filter((el) => {
      if (el.children.length !== 0) return false;
      const text = el.textContent?.trim();
      return text === '$c' || text === 'JS Loaded';
    });
    stray.forEach((el) => el.remove());
  };
  removeStrayBadges();
  setTimeout(removeStrayBadges, 250);
}

function bindSearch() {
  const searchInput = document.getElementById('searchInput');
  const countrySearchInput = document.getElementById('countrySearchInput');

  const syncSearchInputs = () => {
    if (searchInput && searchInput.value !== state.timelineSearch) searchInput.value = state.timelineSearch;
    if (countrySearchInput && countrySearchInput.value !== state.countrySearch) countrySearchInput.value = state.countrySearch;
  };

  syncSearchInputs();

  window.addEventListener('histoiren:sync-search-inputs', syncSearchInputs);

  const onTimelineSearch = debounce((event) => {
    state.timelineSearch = event.target.value.slice(0, MAX_SEARCH_LENGTH);
    renderActiveTimelineView();
  });

  if (searchInput) {
    searchInput.addEventListener('input', onTimelineSearch);
  }


  if (countrySearchInput) {
    const onCountrySearch = debounce((event) => {
      state.countrySearch = event.target.value.slice(0, MAX_SEARCH_LENGTH);
      renderCountries();
    });
    countrySearchInput.addEventListener('input', onCountrySearch);
  }

  // Raccourcis clavier pour l'accès rapide
  document.addEventListener('keydown', (event) => {
    // Ctrl+K ou Cmd+K pour focus sur la recherche
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      const activeView = document.querySelector('.view-container.active');
      if (activeView.id === 'view-timeline' && searchInput) {
        searchInput.focus();
        searchInput.select();

      } else if (activeView.id === 'view-countries' && countrySearchInput) {
        countrySearchInput.focus();
        countrySearchInput.select();
      }
    }

    // Échap pour effacer la recherche
    if (event.key === 'Escape') {
      if (document.activeElement === searchInput
        || document.activeElement === countrySearchInput) {
        document.activeElement.value = '';
        document.activeElement.dispatchEvent(new Event('input'));

      }
    }
  });

  // Afficher le modificateur de clavier correct dans les placeholders si nécessaire
  const modifier = getKeyModifier();
  if (searchInput) {
    const placeholder = searchInput.placeholder;
    if (!placeholder.includes('Ctrl') && !placeholder.includes('Cmd')) {
      searchInput.title = `Appuyez sur ${modifier}+K pour rechercher rapidement`;
    }
  }
}

function bindHomeNavigation() {
  document.getElementById('view-presentation')?.addEventListener('click', (event) => {
    const entry = event.target.closest('[data-home-view]');
    if (!entry) return;
    setView(entry.dataset.homeView);
  });
}

async function init() {
  const statusEl = document.getElementById('appStatus');
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.textContent = 'Chargement des données...';
    statusEl.dataset.state = 'loading';
  }

  try {
    const data = await loadData();
    if (!data || !data.timeline || !data.countries) {
      throw new Error('Données corrompues ou manquantes');
    }
    if (statusEl) statusEl.hidden = true;
  } catch (error) {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.dataset.state = 'error';
      statusEl.textContent = `Erreur de chargement: ${error.message}. Cliquez pour recharger.`;
      statusEl.onclick = () => window.location.reload();
    }
    return;
  }

  cleanupDebugBadges();
  initLearn();
  initRouter();
  window.addEventListener('histoiren:set-view', (event) => {
    const targetView = event.detail?.view;
    if (targetView) setView(targetView);
  });
  window.addEventListener('histoiren:countries-refresh', () => renderCountries());
  bindSearch();
  bindHomeNavigation();
  document.getElementById('homeSearchForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    state.timelineSearch = document.getElementById('homeSearchInput').value.trim().slice(0, MAX_SEARCH_LENGTH);
    state.timelineEra = 'all';
    state.timelineTheme = 'all';
    setView('timeline');
    document.getElementById('searchInput')?.focus();
  });
  state.hasVisited = true;
  markAppVisited();

  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

  buildSidebarContent();
}

window.showDetail = function showDetail(id, source = 'timeline') {
  const entry = getEventById(id);
  if (!entry) return;
  state.detailSource = source;
  showDetailPage(entry);
};

window.showCountryDetail = showCountryDetail;
window.closeCountryModal = closeCountryModal;

init();
