import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('la page ne charge aucun JavaScript tiers et n’embarque aucun script inline', async () => {
  const html = await readProjectFile('index.html');
  const scriptTags = [...html.matchAll(/<script\b([^>]*)>/gi)].map((match) => match[1]);
  assert.ok(scriptTags.length >= 2);
  scriptTags.forEach((attributes) => {
    assert.match(attributes, /\bsrc="\/?src\/[^\"]+"/i);
    assert.doesNotMatch(attributes, /https?:\/\//i);
  });
});

test('les en-têtes de déploiement protègent scripts, framing et transport', async () => {
  const config = JSON.parse(await readProjectFile('vercel.json'));
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.match(headers['Content-Security-Policy'], /script-src 'self'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Strict-Transport-Security'], /max-age=63072000/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

test('les jeux de données restent dans les limites prévues par le chargeur', async () => {
  const timeline = JSON.parse(await readProjectFile('data/timeline.json'));
  const countries = JSON.parse(await readProjectFile('data/countries.json'));
  assert.ok(timeline.events.length > 0 && timeline.events.length <= 10_000);
  assert.ok(timeline.eras.length > 0 && timeline.eras.length <= 20);
  assert.ok(countries.length > 0 && countries.length <= 300);
  assert.ok(countries.flatMap((country) => country.events).length <= 10_000);
});
