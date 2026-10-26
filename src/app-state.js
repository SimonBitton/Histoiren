const APP_STATE_KEY = 'histoiren_app_state_v2';

const DEFAULT_APP_STATE = {
  hasVisited: false,
  lastView: 'presentation'
};

const VALID_VIEWS = new Set(['presentation', 'timeline', 'countries', 'apprendre']);

function safeParse(rawValue) {
  if (!rawValue) return { ...DEFAULT_APP_STATE };
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_APP_STATE };
    return {
      hasVisited: Boolean(parsed.hasVisited),
      lastView: VALID_VIEWS.has(parsed.lastView) ? parsed.lastView : DEFAULT_APP_STATE.lastView
    };
  } catch {
    return { ...DEFAULT_APP_STATE };
  }
}

export function readAppState() {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_STATE };
  return safeParse(window.localStorage.getItem(APP_STATE_KEY));
}

export function writeAppState(patch) {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_STATE, ...patch };
  const current = readAppState();
  const next = {
    hasVisited: patch.hasVisited === undefined ? current.hasVisited : Boolean(patch.hasVisited),
    lastView: VALID_VIEWS.has(patch.lastView) ? patch.lastView : current.lastView
  };
  try {
    window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(next));
  } catch {
    // Le stockage peut être indisponible en navigation privée : l'application
    // reste pleinement utilisable pour la session courante.
  }
  return next;
}

export function markAppVisited() {
  return writeAppState({
    hasVisited: true
  });
}

export function setLastView(viewName) {
  return writeAppState({
    lastView: viewName
  });
}
