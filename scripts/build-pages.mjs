import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://histoiren.vercel.app';
const image = `${origin}/assets/histoiren-social.png`;
const description = 'Explorez les événements, les pays et les grandes dates de l’histoire mondiale dans un atlas clair et interactif.';

// One source of truth for the public routes served by both Vercel and the local server.
const pages = [
  {
    file: 'index.html',
    path: '/',
    title: 'Histoiren — Les repères du monde',
    description
  },
  {
    file: 'presentation.html',
    path: '/', // /presentation is an alias of the home page.
    title: 'Histoiren — Les repères du monde',
    description
  },
  {
    file: 'timeline.html',
    path: '/timeline',
    title: 'Événements historiques — Histoiren',
    description: 'Parcourez les événements qui ont façonné le monde, puis explorez l’histoire par époque, date et thème.'
  },
  {
    file: 'countries.html',
    path: '/countries',
    title: 'L’histoire des pays — Histoiren',
    description: 'Découvrez les grandes dates de chaque pays dans un atlas historique simple et interactif.'
  },
  {
    file: 'apprendre.html',
    path: '/apprendre',
    title: 'Apprendre l’histoire — Histoiren',
    description: 'Retenez les dates et les événements avec les quiz et les cartes de révision d’Histoiren.'
  }
];

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const meta = (name, content, property = false) => `  <meta ${property ? 'property' : 'name'}="${name}" content="${escapeHtml(content)}">`;

function metadata(page) {
  const url = `${origin}${page.path}`;
  return [
    `  <title>${escapeHtml(page.title)}</title>`,
    meta('description', page.description),
    meta('theme-color', '#254f42'),
    meta('robots', 'index, follow, max-image-preview:large'),
    `  <link rel="canonical" href="${url}">`,
    `  <link rel="icon" type="image/png" href="/favicon-histoiren.png">`,
    meta('og:title', page.title, true),
    meta('og:description', page.description, true),
    meta('og:url', url, true),
    meta('og:type', 'website', true),
    meta('og:site_name', 'Histoiren', true),
    meta('og:locale', 'fr_FR', true),
    meta('og:image', image, true),
    meta('og:image:width', '1200', true),
    meta('og:image:height', '630', true),
    meta('og:image:type', 'image/png', true),
    meta('og:image:alt', 'Histoiren, les repères du monde — atlas historique', true),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', page.title),
    meta('twitter:description', page.description),
    meta('twitter:image', image),
    meta('twitter:image:alt', 'Histoiren, les repères du monde — atlas historique')
  ].join('\n');
}

const template = await readFile(resolve(root, 'scripts/page-template.html'), 'utf8');
if (!template.includes('  <!-- SOCIAL_METADATA -->')) throw new Error('Missing metadata placeholder');

for (const page of pages) {
  await writeFile(resolve(root, page.file), template.replace('  <!-- SOCIAL_METADATA -->', metadata(page)));
}

const sitemapPaths = [...new Set(pages.map(page => page.path))];
await writeFile(resolve(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map(path => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(resolve(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);

// Vercel receives only the browser assets; maintenance scripts and local output stay out.
const output = resolve(root, 'public');
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const directory of ['src', 'css', 'assets']) {
  await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}
await mkdir(resolve(output, 'data'));
for (const file of ['timeline.json', 'countries.json', 'day-in-history.json']) {
  await cp(resolve(root, 'data', file), resolve(output, 'data', file));
}
for (const file of [...pages.map(page => page.file), 'favicon-histoiren.png',
  'googleb30d2623c064b63a.html', 'robots.txt', 'sitemap.xml']) {
  await cp(resolve(root, file), resolve(output, file));
}

console.log(`Generated ${pages.length} public HTML pages, SEO files and the public/ deployment directory`);
