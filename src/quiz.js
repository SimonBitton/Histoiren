import { state } from './state.js';
import { escapeHtml, getCategoryLabel } from './utils.js';

/* ══════════════════════════════════════════════════
   MODE APPRENTISSAGE — Quiz & Flashcards
   Génère des questions à partir de la base d'événements.
══════════════════════════════════════════════════ */

const QUESTION_COUNT = 10;
const BEST_SCORE_KEY = 'histoiren:bestScore';

const quiz = {
  mode: 'menu',       // menu | quiz | flashcards | result
  era: 'all',
  questions: [],
  index: 0,
  score: 0,
  answered: false
};

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pool() {
  const events = (state.timelineData?.events || []).filter((e) => e.date && e.name);
  const filtered = quiz.era === 'all' ? events : events.filter((e) => e.era === quiz.era);
  // Privilégie les événements marquants pour des questions pertinentes
  const majors = filtered.filter((e) => e.major);
  return (majors.length >= QUESTION_COUNT * 2 ? majors : filtered);
}

function eraName(eraId) {
  return state.timelineData?.eras.find((e) => e.id === eraId)?.name || eraId;
}

function buildQuestions() {
  const base = pool();
  if (base.length < 4) return [];

  const picks = shuffle(base).slice(0, QUESTION_COUNT);
  return picks.map((event) => {
    const type = Math.random() < 0.5 ? 'date' : 'event';

    if (type === 'date') {
      const distractors = shuffle(base.filter((e) => e.date !== event.date)).slice(0, 3).map((e) => e.date);
      return {
        prompt: `À quelle date a eu lieu cet événement ?`,
        subject: event.name,
        correct: event.date,
        options: shuffle([event.date, ...distractors])
      };
    }
    const distractors = shuffle(base.filter((e) => e.name !== event.name)).slice(0, 3).map((e) => e.name);
    return {
      prompt: `Quel événement correspond à : ${event.date} ?`,
      subject: getCategoryLabel(event.category),
      correct: event.name,
      options: shuffle([event.name, ...distractors])
    };
  });
}

function getBestScore() {
  try {
    return Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function root() {
  return document.getElementById('quizRoot');
}

function renderMenu() {
  const eras = [{ id: 'all', name: 'Toutes les époques', icon: '✨' }, ...(state.timelineData?.eras || [])];
  const best = getBestScore();
  root().innerHTML = `
    <div class="quiz-menu">
      <div class="quiz-intro">
        <p>Testez vos connaissances en ${QUESTION_COUNT} questions ou révisez à votre rythme avec les cartes.</p>
        ${best > 0 ? `<p class="quiz-best">Meilleur score : <strong>${best}/${QUESTION_COUNT}</strong></p>` : ''}
      </div>

      <div class="quiz-era-select">
        <p class="filter-label" id="quizEraLabel">Choisissez une époque</p>
        <div class="filter-chips" role="group" aria-labelledby="quizEraLabel">
          ${eras.map((era) => `
            <button class="filter-chip ${quiz.era === era.id ? 'active' : ''}" data-quiz-era="${escapeHtml(era.id)}" type="button" aria-pressed="${quiz.era === era.id}">
              ${escapeHtml(era.name)}
            </button>`).join('')}
        </div>
      </div>

      <div class="quiz-actions">
        <button class="quiz-start-btn primary" data-quiz-start="quiz" type="button">Lancer le quiz · 10 questions</button>
        <button class="quiz-start-btn" data-quiz-start="flashcards" type="button">Cartes de révision</button>
      </div>
    </div>
  `;
}

function renderQuiz() {
  const q = quiz.questions[quiz.index];
  if (!q) return renderResult();
  const progress = Math.round((quiz.index / quiz.questions.length) * 100);

  root().innerHTML = `
    <div class="quiz-card">
      <div class="quiz-progress"><div class="quiz-progress-bar" style="width:${progress}%"></div></div>
      <div class="quiz-meta">
        <span>Question ${quiz.index + 1} / ${quiz.questions.length}</span>
        <span>Score : ${quiz.score}</span>
      </div>
      <p class="quiz-prompt">${escapeHtml(q.prompt)}</p>
      <p class="quiz-subject" tabindex="-1">${escapeHtml(q.subject)}</p>
      <div class="quiz-options">
        ${q.options.map((opt) => `
          <button class="quiz-option" data-quiz-answer="${escapeHtml(opt)}" type="button">${escapeHtml(opt)}</button>
        `).join('')}
      </div>
      <p id="quizFeedback" class="quiz-feedback" role="status"></p>
      <button class="quiz-next" data-quiz-next type="button" hidden>Suivant →</button>
    </div>
  `;
}

function handleAnswer(value) {
  if (quiz.answered) return;
  quiz.answered = true;
  const q = quiz.questions[quiz.index];
  const correct = value === q.correct;
  if (correct) quiz.score += 1;

  root().querySelectorAll('.quiz-option').forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.quizAnswer === q.correct) btn.classList.add('correct');
    else if (btn.dataset.quizAnswer === value) btn.classList.add('wrong');
  });
  const feedback = root().querySelector('#quizFeedback');
  if (feedback) feedback.textContent = correct ? 'Bonne réponse !' : `La bonne réponse est : ${q.correct}`;
  const nextBtn = root().querySelector('[data-quiz-next]');
  if (nextBtn) {
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    nextBtn.textContent = quiz.index + 1 >= quiz.questions.length ? 'Voir le résultat →' : 'Suivant →';
  }
}

function nextQuestion() {
  quiz.index += 1;
  quiz.answered = false;
  if (quiz.index >= quiz.questions.length) renderResult();
  else {
    renderQuiz();
    root().querySelector('.quiz-subject')?.focus({ preventScroll: true });
  }
}

function renderResult() {
  const total = quiz.questions.length;
  const best = getBestScore();
  if (quiz.score > best) {
    try { localStorage.setItem(BEST_SCORE_KEY, String(quiz.score)); } catch { /* facultatif */ }
  }
  const isRecord = quiz.score > best;

  const pct = total ? Math.round((quiz.score / total) * 100) : 0;
  let message = 'Continue à explorer l\'histoire !';
  if (pct === 100) message = 'Parfait ! Tu es un véritable historien 🏛️';
  else if (pct >= 70) message = 'Excellent travail ! 👏';
  else if (pct >= 40) message = 'Pas mal, tu progresses !';

  root().innerHTML = `
    <div class="quiz-result">
      <div class="quiz-score-circle" style="--p:${pct}%"><strong>${quiz.score}</strong><span>/ ${total}</span></div>
      <p class="quiz-result-msg">${message}</p>
      ${isRecord ? '<p class="quiz-best">Nouveau record !</p>' : ''}
      <div class="quiz-actions">
        <button class="quiz-start-btn primary" data-quiz-start="quiz" type="button">Rejouer</button>
        <button class="quiz-start-btn" data-quiz-menu type="button">← Menu</button>
      </div>
    </div>
  `;
}

/* ─────────── Flashcards ─────────── */
function renderFlashcards() {
  const cards = shuffle(pool()).slice(0, 20);
  if (cards.length === 0) {
    root().innerHTML = '<p class="empty-state">Pas assez d\'événements pour cette époque.</p>';
    return;
  }
  let idx = 0;

  const draw = () => {
    const card = cards[idx];
    root().innerHTML = `
      <div class="flashcard-wrap">
        <div class="quiz-meta"><span>Carte ${idx + 1} / ${cards.length}</span><span>${escapeHtml(eraName(card.era))}</span></div>
        <div class="flashcard" data-flip tabindex="0" role="button" aria-label="Afficher la réponse" aria-pressed="false">
          <div class="flashcard-inner">
            <div class="flashcard-face flashcard-front">
              <span class="flashcard-hint">Quel est cet événement ?</span>
              <strong>${escapeHtml(card.date)}</strong>
            </div>
            <div class="flashcard-face flashcard-back">
              <strong>${escapeHtml(card.name)}</strong>
              <p>${escapeHtml(card.context || '')}</p>
            </div>
          </div>
        </div>
        <div class="quiz-actions">
          <button class="quiz-start-btn" data-flash-prev type="button" ${idx === 0 ? 'disabled' : ''}>← Précédent</button>
          <button class="quiz-start-btn" data-flash-next type="button" ${idx === cards.length - 1 ? 'disabled' : ''}>Suivant →</button>
          <button class="quiz-start-btn" data-quiz-menu type="button">Menu</button>
        </div>
      </div>
    `;
    const flashEl = root().querySelector('[data-flip]');
    const flip = () => {
      const flipped = flashEl.classList.toggle('flipped');
      flashEl.setAttribute('aria-pressed', String(flipped));
      flashEl.setAttribute('aria-label', flipped ? 'Afficher la question' : 'Afficher la réponse');
      flashEl.querySelector('.flashcard-front').setAttribute('aria-hidden', String(flipped));
      flashEl.querySelector('.flashcard-back').setAttribute('aria-hidden', String(!flipped));
    };
    flashEl?.querySelector('.flashcard-back').setAttribute('aria-hidden', 'true');
    flashEl?.addEventListener('click', flip);
    flashEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
    root().querySelector('[data-flash-prev]')?.addEventListener('click', () => { if (idx > 0) { idx--; draw(); } });
    root().querySelector('[data-flash-next]')?.addEventListener('click', () => { if (idx < cards.length - 1) { idx++; draw(); } });
  };
  draw();
}

function startQuiz() {
  quiz.questions = buildQuestions();
  quiz.index = 0;
  quiz.score = 0;
  quiz.answered = false;
  if (quiz.questions.length === 0) {
    root().innerHTML = '<p class="empty-state">Pas assez d\'événements pour générer un quiz sur cette époque.</p>';
    return;
  }
  renderQuiz();
}

export function renderLearn() {
  if (!root()) return;
  renderMenu();
}

export function initLearn() {
  const container = document.getElementById('view-apprendre');
  if (!container) return;

  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-quiz-era],[data-quiz-start],[data-quiz-answer],[data-quiz-next],[data-quiz-menu]');
    if (!target) return;

    if (target.dataset.quizEra) {
      quiz.era = target.dataset.quizEra;
      renderMenu();
      return;
    }
    if (target.dataset.quizStart === 'quiz') return startQuiz();
    if (target.dataset.quizStart === 'flashcards') return renderFlashcards();
    if (target.hasAttribute('data-quiz-menu')) return renderMenu();
    if (target.dataset.quizAnswer !== undefined && target.classList.contains('quiz-option')) {
      return handleAnswer(target.dataset.quizAnswer);
    }
    if (target.hasAttribute('data-quiz-next')) return nextQuestion();
  });
}
