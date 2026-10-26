/* Run with npm run test:e2e. Starts an isolated local server automatically. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');

(async () => {
  const port = '8137';
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: port }, stdio: 'pipe' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch(base)).ok; } catch { /* Server is starting. */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Local server must start');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('.collection-summary');
    await page.fill('#homeSearchInput', 'Napoléon');
    await page.click('#homeSearchForm button');
    await page.waitForSelector('.event');
    const searchedCount = await page.locator('.event').count();
    assert(searchedCount > 0, 'Home search must return events');
    assert.match(page.url(), /\/timeline$/);
    assert.equal(await page.inputValue('#searchInput'), 'Napoléon');
    await page.selectOption('#eraFilter', 'prehist');
    await page.waitForSelector('.empty-state');
    assert.equal(await page.locator('.event').count(), 0, 'Search and era must combine');
    assert.equal(await page.locator('#eraFilter').evaluate(el => el === document.activeElement), true, 'Filter keeps keyboard focus');
    await page.click('[data-reset-filters]');
    assert.equal(await page.inputValue('#searchInput'), '');
    assert((await page.locator('.event').count()) > searchedCount);
    await page.fill('#searchInput', '1789');
    await page.waitForTimeout(400);
    const title = await page.locator('.event-name').first().innerText();
    await page.locator('.event').first().click();
    await page.waitForSelector('#detailPage:not([hidden])');
    assert.equal(await page.locator('#detailTitle').innerText(), title);
    await page.click('#detailBackBtn');
    assert.equal(await page.inputValue('#searchInput'), '1789', 'Back preserves the search');

    await page.click('#tab-countries');
    await page.fill('#countrySearchInput', 'France');
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.country-card').count(), 1);
    await page.locator('.country-card').click();
    await page.waitForSelector('.country-modal');
    await page.keyboard.press('Escape');
    await page.locator('.map-disclosure summary').click();
    await page.locator('[data-continent="europe"]').click();
    await page.waitForSelector('#continentBanner:not([hidden])');
    await page.click('[data-continent-reset]');
    await page.fill('#countrySearchInput', '');
    await page.waitForTimeout(400);

    await page.click('#tab-apprendre');
    await page.click('[data-quiz-start="quiz"]');
    for (let i = 0; i < 10; i++) {
      await page.locator('.quiz-option').first().click();
      assert((await page.locator('#quizFeedback').innerText()).length > 0, 'Each answer needs text feedback');
      await page.click('[data-quiz-next]');
    }
    await page.waitForSelector('.quiz-result');
    await page.click('[data-quiz-menu]');
    await page.click('[data-quiz-start="flashcards"]');
    await page.locator('[data-flip]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-flip]').getAttribute('aria-pressed'), 'true');
    await page.click('[data-flash-next]');
    assert.equal(await page.locator('[data-flip]').getAttribute('aria-pressed'), 'false');

    for (const [width, height] of [[1440, 1000], [768, 1024], [375, 812], [812, 375]]) {
      await page.setViewportSize({ width, height });
      for (const view of ['presentation', 'timeline', 'countries', 'apprendre']) {
        await page.click(`#tab-${view}`);
        assert.equal(await page.locator(`#tab-${view}`).getAttribute('aria-current'), 'page');
        assert.equal(await page.locator('.view-container.active').getAttribute('id'), `view-${view}`);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert(scrollWidth <= width, `${view} must fit ${width}px`);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${base}/timeline`);
    await page.waitForSelector('.event');
    assert.equal(await page.locator('.view-container.active').evaluate(el => getComputedStyle(el).animationName), 'none');
    // Jump between distant eras while the compact navigation stays visible.
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${base}/timeline`);
      await page.waitForSelector('#timelineJump');
      await page.selectOption('#timelineJump', 'era-moyen-age');
      await page.waitForTimeout(80);
      assert((await page.evaluate(() => scrollY)) > 1000, 'Jump reaches the middle of the chronology');
      const navigation = await page.locator('.timeline-navigation').boundingBox();
      const heading = await page.locator('#era-moyen-age h2').boundingBox();
      assert(navigation.y >= 0 && navigation.y + navigation.height < viewport.height, 'Sticky shortcuts stay on screen');
      assert(heading.y >= navigation.y + navigation.height, 'Era heading is not obscured by navigation');
      assert.equal(await page.locator('#era-moyen-age h2').evaluate(el => el === document.activeElement), true);
      await page.selectOption('#timelineJump', 'era-modernes');
      await page.waitForTimeout(80);
      assert.equal(await page.inputValue('#timelineJump'), 'era-modernes');
      await page.locator('#era-antiquite').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await page.waitForTimeout(80);
      assert.equal(await page.inputValue('#timelineJump'), 'era-antiquite', 'Manual scrolling updates the current era');
      await page.click('[data-timeline-top]');
      assert.equal(await page.evaluate(() => scrollY), 0, 'Back to top reaches the search');
      assert.equal(await page.locator('#searchInput').evaluate(el => el === document.activeElement), true);
      await page.selectOption('#eraFilter', 'modernes');
      assert.equal(await page.locator('#timelineJump option').count(), 1, 'Jump options respect active filters');
      await page.fill('#searchInput', 'zzzzzzzzzzzz');
      await page.waitForSelector('.empty-state');
      assert.equal(await page.locator('.timeline-navigation').count(), 0, 'No navigation without results');
    }
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${base}/timeline`);
      await page.waitForSelector('#themeFilter');
      if (await page.evaluate(() => CSS.supports('appearance', 'base-select'))) {
        await page.click('#themeFilter');
        assert.equal(await page.locator('#themeFilter').evaluate(el => el.matches(':open')), true);
        assert.equal(await page.locator('#themeFilter').evaluate(el => getComputedStyle(el, '::picker(select)').backgroundColor), 'rgb(255, 255, 255)', 'Picker stays light under a dark OS theme');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#themeFilter').evaluate(el => el.matches(':open')), false);
        await page.click('#themeFilter');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        assert.equal(await page.inputValue('#themeFilter'), 'guerre', 'Open picker supports keyboard selection');
      }
    }
    await page.goto(base);
    await page.waitForSelector('.collection-summary');
    assert.equal(await page.locator('.home-header h1').innerText(), 'L’histoire à portée de main.');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('✓ Search, combined filters, empty state, reset, detail/back, countries, map, full quiz, keyboard flashcards, four viewport sizes, deep link and reduced motion.');
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
