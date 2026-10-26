import { state } from './state.js';

let timelineObserver = null;

function setActiveLink(targetId) {
  const sidebarLinks = document.getElementById('quickNavLinks');
  if (!sidebarLinks) return;

  sidebarLinks.querySelectorAll('a').forEach((link) => {
    link.classList.toggle('active', link.dataset.target === targetId);
  });
}

export function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const sidebar = document.getElementById('quickNav');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const main = document.querySelector('main');

  sidebar.classList.toggle('active', state.sidebarOpen);
  sidebarToggle.classList.toggle('active', state.sidebarOpen);
  sidebarToggle.setAttribute('aria-expanded', String(state.sidebarOpen));
  main.classList.toggle('sidebar-open', state.sidebarOpen);
}

function buildTimelineSidebar() {
  const eras = [
    { label: 'Préhistoire', id: 'era-prehist', icon: '🦴' },
    { label: 'Antiquité', id: 'era-antiquite', icon: '🏛' },
    { label: 'Moyen Âge', id: 'era-moyen-age', icon: '⚔️' },
    { label: 'Temps modernes', id: 'era-modernes', icon: '🔭' },
    { label: 'Contemporain', id: 'era-contemporain', icon: '⚡' }
  ];

  return `
    <div class="sidebar-section-label">Époques</div>
    ${eras.map((era) => `<a href="#${era.id}" data-target="${era.id}" data-type="era">${era.icon} ${era.label}</a>`).join('')}
    <a href="#top50-section" data-target="top50-section" data-type="top50">🏆 Top 50</a>

    <div class="sidebar-section-label">Raccourcis</div>
    <a href="#view-timeline" data-target="view-timeline" data-type="section">🔎 Recherche</a>
    <a href="#view-timeline" data-target="view-timeline" data-type="section">⬆️ Haut de page</a>
  `;
}

function bindSidebarInteractions(sidebarLinks) {
  sidebarLinks.onclick = (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const type = link.dataset.type;
    if (!type) return;
    event.preventDefault();

    if (type === 'view') {
      window.dispatchEvent(new CustomEvent('histoiren:set-view', { detail: { view: link.dataset.view } }));
      if (window.innerWidth < 1024 && state.sidebarOpen) toggleSidebar();
      return;
    }

    if (type === 'section') {
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (targetId === 'view-timeline') {
          document.getElementById('searchInput')?.focus();
        }
        if (targetId === 'view-countries') {
          document.getElementById('countrySearchInput')?.focus();
        }
      }
      if (window.innerWidth < 1024 && state.sidebarOpen) toggleSidebar();
      return;
    }

    if (type === 'era' || type === 'top50') {
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveLink(targetId);
      }
    }

    if (type === 'country' && window.showCountryDetail) {
      window.showCountryDetail(link.dataset.countryId);
      setActiveLink('');
      link.classList.add('active');
    }

    if (type === 'letter') {
      const letter = link.dataset.letter;
      const allCountryLinks = Array.from(sidebarLinks.querySelectorAll('a[data-type="country"]'));
      const firstMatch = allCountryLinks.find((entry) => entry.textContent.trim().charAt(0).toUpperCase() === letter);
      if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      setActiveLink('');
      link.classList.add('active');
    }

    if (window.innerWidth < 1024 && state.sidebarOpen) toggleSidebar();
  };
}

function watchTimelineSections() {
  if (timelineObserver) {
    timelineObserver.disconnect();
    timelineObserver = null;
  }

  if (state.currentView !== 'timeline') return;

  const sections = document.querySelectorAll('.era-section');
  if (!sections.length) return;

  timelineObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveLink(entry.target.id);
    });
  }, { rootMargin: '-25% 0px -60% 0px', threshold: 0.05 });

  sections.forEach((section) => timelineObserver.observe(section));
}

export function buildSidebarContent() {
  const sidebarLinks = document.getElementById('quickNavLinks');
  const quickNav = document.getElementById('quickNav');
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (!sidebarLinks) return;

  const hideSidebar = state.currentView === 'presentation'
    || state.currentView === 'apprendre';

  if (state.currentView === 'timeline') {
    if (quickNav) quickNav.hidden = false;
    if (sidebarToggle) sidebarToggle.hidden = false;
    sidebarLinks.innerHTML = buildTimelineSidebar();
  } else if (state.currentView === 'countries') {
    sidebarLinks.innerHTML = '';
    if (quickNav) quickNav.hidden = true;
    if (sidebarToggle) sidebarToggle.hidden = true;
    state.sidebarOpen = false;
    document.querySelector('main')?.classList.remove('sidebar-open');
  } else if (hideSidebar) {
    sidebarLinks.innerHTML = '';
    if (quickNav) quickNav.hidden = true;
    if (sidebarToggle) sidebarToggle.hidden = true;
    state.sidebarOpen = false;
    document.querySelector('main')?.classList.remove('sidebar-open');
  } else {
    if (quickNav) quickNav.hidden = false;
    if (sidebarToggle) sidebarToggle.hidden = false;
    sidebarLinks.innerHTML = '';
  }

  bindSidebarInteractions(sidebarLinks);
  watchTimelineSections();
}
