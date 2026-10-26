/* Keep chronological navigation within reach without changing active filters. */
let disposeNavigation = () => {};

export function bindTimelineNavigation(container) {
  disposeNavigation();
  const navigation = container.querySelector('.timeline-navigation');
  const jump = container.querySelector('#timelineJump');
  if (!navigation || !jump) return;

  const controller = new AbortController();
  const { signal } = controller;
  const sections = [...container.querySelectorAll('.era-section')];
  const mainNavigation = document.querySelector('.main-nav');
  let frame = 0;

  const update = () => {
    frame = 0;
    if (!container.closest('.view-container.active')) return;
    const edge = navigation.getBoundingClientRect().bottom + 48;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= edge) current = section;
      else break;
    }
    if (current) jump.value = current.id;
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const measureHeader = () => {
    const isBottomNavigation = window.matchMedia('(max-width: 767px)').matches;
    const height = isBottomNavigation ? 0 : (mainNavigation?.getBoundingClientRect().height || 80);
    container.style.setProperty('--main-nav-height', `${height}px`);
    scheduleUpdate();
  };
  const resizeObserver = new ResizeObserver(measureHeader);
  if (mainNavigation) resizeObserver.observe(mainNavigation);

  jump.addEventListener('change', () => {
    const target = sections.find(section => section.id === jump.value);
    if (!target) return;
    const toolbarHeight = navigation.getBoundingClientRect().height;
    const offset = Number.parseFloat(container.style.getPropertyValue('--main-nav-height')) + toolbarHeight + 24;
    // Instant jumps keep very distant eras reachable without a long animated scroll.
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - offset, behavior: 'instant' });
    target.querySelector('h2')?.focus({ preventScroll: true });
    scheduleUpdate();
  }, { signal });
  navigation.querySelector('[data-timeline-top]')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('searchInput')?.focus({ preventScroll: true });
    scheduleUpdate();
  }, { signal });
  window.addEventListener('scroll', scheduleUpdate, { passive: true, signal });
  window.addEventListener('resize', measureHeader, { passive: true, signal });
  measureHeader();

  disposeNavigation = () => {
    controller.abort();
    resizeObserver.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
