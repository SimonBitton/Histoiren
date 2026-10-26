import { readAppState } from './app-state.js';

const persistedAppState = readAppState();

export const state = {
  era: 'all',
  type: 'all',
  timelineSearch: '',
  timelineEra: 'all',
  timelineTheme: 'all',
  countrySearch: '',
  countryContinent: 'all',
  currentView: persistedAppState.lastView || 'presentation',
  timelineData: null,
  historyUpdates: null,
  countriesData: [],
  eventById: null,
  sidebarOpen: false,
  detailSource: 'timeline',
  detailCountryId: null,
  hasVisited: Boolean(persistedAppState.hasVisited)
};

export const eraConfigs = {
  prehist: { label: 'Préhistoire', icon: '🦴' },
  antiquite: { label: 'Antiquité', icon: '🏛' },
  'moyen-age': { label: 'Moyen Âge', icon: '⚔️' },
  modernes: { label: 'Temps modernes', icon: '🔭' },
  contemporain: { label: 'Epoque contemporaine', icon: '⚡' }
};
