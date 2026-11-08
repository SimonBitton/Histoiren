import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const origin = 'https://histoiren.vercel.app';
const routes = [
  ['index.html', '/'],
  ['presentation.html', '/'],
  ['timeline.html', '/timeline'],
  ['countries.html', '/countries'],
  ['apprendre.html', '/apprendre']
];

test('each public route exposes coherent metadata in its initial HTML', async () => {
  for (const [file, path] of routes) {
    const html = (await read(file)).toString('utf8');
    const url = `${origin}${path}`;
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^\"]+">/);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`));
    assert.ok(html.includes('<meta property="og:type" content="website">'));
    assert.ok(html.includes('<meta property="og:locale" content="fr_FR">'));
    assert.ok(html.includes(`<meta property="og:image" content="${origin}/assets/histoiren-social.png">`));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
    assert.ok(html.includes('<meta property="og:image:width" content="1200">'));
    assert.ok(html.includes('<meta property="og:image:height" content="630">'));
    assert.equal((html.match(/<meta property="og:title"/g) || []).length, 1);
  }
});

test('the OG image is a public 1200 × 630 PNG', async () => {
  const image = await read('assets/histoiren-social.png');
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test('the sitemap lists canonical routes only', async () => {
  const sitemap = (await read('sitemap.xml')).toString('utf8');
  for (const [, path] of routes) assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 4);
  assert.ok((await read('robots.txt')).toString('utf8').includes(`${origin}/sitemap.xml`));
});
