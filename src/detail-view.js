import { state } from './state.js';
import { getCategoryClass, getCategoryLabel, normalizeText, sanitizeExternalUrl, escapeHtml } from './utils.js';
import { findRelatedEvents } from './related.js';
import { fetchWikiInfo } from './wiki.js';
import { detectEventThemes, parseHistoricalDate } from './utils.js';

function getHistoricalSignificance(event) {
  const category = normalizeText(event.category || '');

  if (event.major) {
    return "Cet événement majeur a profondément transformé le cours de l'histoire et ses conséquences se font encore ressentir aujourd'hui.";
  }

  if (category.includes('science')) {
    return 'Cette avancée scientifique a contribué à élargir les connaissances humaines et a ouvert la voie à de nouvelles découvertes.';
  }

  if (category.includes('politique')) {
    return "Cet événement politique a redéfini les équilibres de pouvoir et influence l'organisation des sociétés de l'époque.";
  }

  if (category.includes('culture')) {
    return "Cet accomplissement culturel a enrichi le patrimoine artistique et intellectuel de l'humanité.";
  }

  if (category.includes('exploration')) {
    return 'Cette exploration a repoussé les frontières du monde connu et permis de nouvelles connexions entre civilisations.';
  }

  return "Cet événement a marqué son époque et constitue un jalon important dans la compréhension de cette période historique.";
}

function getCategoryContext(event) {
  const era = event.era || '';

  if (era === 'prehist') {
    return 'À cette époque reculée, les humains développaient progressivement des techniques et des organisations sociales qui allaient poser les fondations des civilisations futures.';
  }
  if (era === 'antiquite') {
    return "Durant l'Antiquité, les grandes civilisations établissaient les bases de la philosophie, des sciences, du droit et de l'organisation politique qui influencent encore notre monde.";
  }
  if (era === 'moyen-age') {
    return "Au Moyen Âge, entre transformations politiques, avancées techniques et échanges culturels, se construisaient les nations et les identités européennes.";
  }
  if (era === 'modernes') {
    return "Les Temps Modernes voient l'émergence de nouvelles conceptions du monde, des révolutions scientifiques et politiques qui façonnent la modernité.";
  }
  if (era === 'contemporain') {
    return "L'époque contemporaine est marquée par des transformations accélérées, des conflits mondiaux, des révolutions technologiques et une mondialisation sans précédent.";
  }

  return "Cet événement s'inscrit dans un contexte historique plus large de transformations sociales, politiques et culturelles.";
}

function getLegacyStatement(event) {
  const name = (event.name || '').toLowerCase();

  if (name.includes('invention') || name.includes('decouverte') || name.includes('découverte')) {
    return "Cette innovation a eu des répercussions durables et continue d'influencer notre vie quotidienne.";
  }
  if (name.includes('bataille') || name.includes('guerre')) {
    return 'Les conséquences de ce conflit ont redessiné la carte politique et laissé une empreinte indélébile dans la mémoire collective.';
  }
  if (name.includes('naissance') || name.includes('mort')) {
    return "La vie et l'œuvre de cette personne ont eu un impact profond sur l'histoire des idées et des civilisations.";
  }

  return "Son héritage perdure à travers les siècles et continue d'inspirer les générations futures.";
}

function generateDetailedSummary(event) {
  const parts = [];
  const era = state.timelineData?.eras.find((entry) => entry.id === event.era);
  const eraName = era ? era.name.toLowerCase() : "l'histoire";

  parts.push(`Cet événement s'inscrit dans ${eraName}, plus précisément ${event.date}.`);
  parts.push(`${event.name}.`);

  if (event.context) {
    parts.push(`Contexte : ${event.context}`);
  }
  if (event.people && event.people.trim()) {
    parts.push(`Personnages clés impliqués : ${event.people}.`);
  }

  parts.push(getHistoricalSignificance(event));
  parts.push(getCategoryContext(event));
  parts.push(getLegacyStatement(event));

  return parts.join(' ');
}

function generateCauses(event) {
  const themes = event._themes || [];
  if (themes.includes('guerre')) {
    return "Tensions politiques, rivalités territoriales et déséquilibres de pouvoir ont préparé le terrain de cet affrontement, souvent après une longue montée des hostilités.";
  }
  if (themes.includes('invention') || normalizeText(event.category).includes('science')) {
    return "Cette avancée découle de l'accumulation de savoirs antérieurs, de la curiosité de chercheurs et d'un besoin pratique ou théorique de l'époque.";
  }
  if (themes.includes('religion')) {
    return "Des transformations spirituelles, sociales et parfois politiques ont nourri ce mouvement, en réponse aux attentes et aux questionnements de la société.";
  }
  if (themes.includes('exploration')) {
    return "La recherche de nouvelles routes, de richesses ou de connaissances, soutenue par des progrès techniques, a motivé cette entreprise.";
  }
  return "Cet événement résulte d'un enchaînement de circonstances sociales, politiques et économiques propres à son époque.";
}

function generateConsequences(event) {
  const themes = event._themes || [];
  if (themes.includes('guerre')) {
    return "Le conflit a redessiné les frontières, bouleversé les sociétés concernées et laissé des traces durables dans les mémoires et les équilibres géopolitiques.";
  }
  if (themes.includes('invention') || normalizeText(event.category).includes('science')) {
    return "Cette découverte a ouvert la voie à de nouvelles applications et transformé, parfois en profondeur, la vie quotidienne et la pensée scientifique.";
  }
  if (themes.includes('religion')) {
    return "Elle a influencé les croyances, les institutions et la culture de nombreuses générations bien au-delà de son point de départ.";
  }
  if (themes.includes('exploration')) {
    return "De nouveaux contacts entre peuples, échanges commerciaux et bouleversements culturels en ont découlé, pour le meilleur comme pour le pire.";
  }
  return "Ses effets se sont prolongés dans le temps et ont contribué à façonner la suite de l'histoire.";
}

function renderRelatedEvents(event) {
  const section = document.getElementById('detailRelatedSection');
  const container = document.getElementById('detailRelated');
  if (!section || !container) return;

  const related = findRelatedEvents(event, 4);
  if (related.length === 0) {
    section.hidden = true;
    return;
  }

  container.innerHTML = related.map((rel) => `
    <button class="related-event" type="button" data-id="${escapeHtml(rel.id)}">
      <span class="related-date">${escapeHtml(rel.date)}</span>
      <span class="related-name">${escapeHtml(rel.name)}</span>
      <span class="related-cat ${getCategoryClass(rel.category)}">${escapeHtml(getCategoryLabel(rel.category))}</span>
    </button>
  `).join('');

  container.onclick = (clickEvent) => {
    const btn = clickEvent.target.closest('.related-event');
    if (btn && window.showDetail) window.showDetail(btn.dataset.id);
  };
  section.hidden = false;
}

let wikiRequestToken = 0;
function loadWikiEnrichment(event) {
  const figure = document.getElementById('detailFigure');
  const image = document.getElementById('detailImage');
  const caption = document.getElementById('detailImageCaption');
  const wikiSection = document.getElementById('detailWikiSection');
  const wikiExtract = document.getElementById('detailWikiExtract');

  // Réinitialise pendant le chargement
  if (figure) figure.hidden = true;
  if (wikiSection) wikiSection.hidden = true;

  const token = ++wikiRequestToken;
  fetchWikiInfo(event.name).then((info) => {
    if (token !== wikiRequestToken || !info) return; // une fiche plus récente est ouverte

    if (info.thumbnail && image && figure) {
      image.src = info.thumbnail;
      image.alt = info.title || event.name;
      if (caption) caption.textContent = info.title || '';
      figure.hidden = false;
    }
    if (info.extract && wikiSection && wikiExtract) {
      wikiExtract.textContent = info.extract;
      wikiSection.hidden = false;
    }
    // Lien Wikipédia direct vers la page trouvée
    const wikiLink = document.getElementById('detailWikipediaLink');
    if (wikiLink && info.pageUrl) {
      wikiLink.href = info.pageUrl;
      wikiLink.hidden = false;
    }
  });
}

export function showDetailPage(event) {
  const detailPage = document.getElementById('detailPage');
  if (!detailPage) return;
  if (typeof detailPage._cleanup === 'function') detailPage._cleanup();
  const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  // Enrichissement à la volée pour les fiches sans métadonnées (ex. événements pays)
  if (!event._themes) event._themes = detectEventThemes(event);
  if (event._year === undefined) {
    const parsed = parseHistoricalDate(event.date);
    event._year = parsed ? parsed.year : null;
  }

  const era = state.timelineData?.eras.find((entry) => entry.id === event.era);
  const badge = era ? era.icon : '📜';

  document.getElementById('detailBadge').textContent = badge;
  document.getElementById('detailCategory').textContent = getCategoryLabel(event.category);
  document.getElementById('detailCategory').className = `detail-category ${getCategoryClass(event.category)}`;
  document.getElementById('detailDate').textContent = event.date;
  const verificationNote = document.getElementById('detailDateVerification');
  const verificationSource = sanitizeExternalUrl(event.dateVerification?.source);
  verificationNote.hidden = !verificationSource;
  if (verificationSource) document.getElementById('detailDateVerificationLink').href = verificationSource;
  document.getElementById('detailTitle').textContent = event.name;
  document.getElementById('detailSummary').textContent = generateDetailedSummary(event);

  document.getElementById('detailCauses').textContent = generateCauses(event);
  document.getElementById('detailConsequences').textContent = generateConsequences(event);

  renderRelatedEvents(event);
  loadWikiEnrichment(event);

  const peopleSection = document.getElementById('detailPeopleSection');
  const peopleEl = document.getElementById('detailPeople');
  if (event.people && event.people.trim()) {
    peopleEl.textContent = event.people;
    peopleSection.hidden = false;
  } else {
    peopleSection.hidden = true;
  }

  const contextSection = document.getElementById('detailContextSection');
  const contextEl = document.getElementById('detailContext');
  if (event.context && event.context.length > 100) {
    contextEl.textContent = event.context;
    contextSection.hidden = false;
  } else {
    contextSection.hidden = true;
  }

  const searchQuery = encodeURIComponent(event.name);
  document.getElementById('detailSearchLink').href = `https://www.google.com/search?q=${searchQuery}`;

  const wikiLink = document.getElementById('detailWikipediaLink');
  if (typeof event.source?.eventQid === 'string' && /^Q\d{1,12}$/.test(event.source.eventQid)) {
    wikiLink.href = `https://fr.wikipedia.org/wiki/Special:EntityPage/${encodeURIComponent(event.source.eventQid)}`;
    wikiLink.hidden = false;
  } else {
    wikiLink.hidden = true;
  }

  const pressLinkEl = document.getElementById('detailPressLink');
  const possiblePressUrl = event.source?.pressUrl || event.source?.articleUrl || event.source?.url || event.pressUrl || event.articleUrl;
  const safePressUrl = sanitizeExternalUrl(possiblePressUrl);
  if (safePressUrl) {
    pressLinkEl.href = safePressUrl;
    pressLinkEl.hidden = false;
  } else {
    pressLinkEl.hidden = true;
  }

  const backBtn = document.getElementById('detailBackBtn');
  const closeDetail = () => {
    detailPage.classList.remove('active');
    detailPage.hidden = true;
    document.body.classList.remove('dialog-open');
    if (typeof detailPage._cleanup === 'function') detailPage._cleanup();
    returnFocusTo?.focus({ preventScroll: true });
    if (state.detailSource === 'timeline') {
      const safeId = globalThis.CSS?.escape ? CSS.escape(event.id) : String(event.id).replace(/["\\]/g, '\\$&');
      const eventEl = document.querySelector(`[data-id="${safeId}"]`);
      if (eventEl) eventEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (state.detailSource === 'country' && state.detailCountryId && typeof window.showCountryDetail === 'function') {
      window.showCountryDetail(state.detailCountryId);
    }
  };
  backBtn.onclick = closeDetail;

  const onKeydown = (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      closeDetail();
      return;
    }
    if (keyboardEvent.key !== 'Tab') return;
    const focusable = [...detailPage.querySelectorAll('button:not([disabled]), a[href]:not([hidden])')]
      .filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (keyboardEvent.shiftKey && document.activeElement === first) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  };
  document.addEventListener('keydown', onKeydown);
  detailPage._cleanup = () => {
    document.removeEventListener('keydown', onKeydown);
    detailPage._cleanup = null;
  };

  detailPage.hidden = false;
  document.body.classList.add('dialog-open');
  detailPage.classList.add('active');
  detailPage.scrollTop = 0;
  backBtn.focus({ preventScroll: true });
}
