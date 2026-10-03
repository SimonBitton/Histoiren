export default async function handler(request, response) {
  const authorization = request.headers.authorization;
  if (process.env.CRON_SECRET && authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Authentification requise' });
  }

  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { synchronize } = await import('../scripts/day-in-history-sync.mjs');
  const result = await synchronize();
  if (result.error) return response.status(502).json({ error: result.error, preserved: true });
  return response.status(200).json({ ok: true, lastUpdate: result.lastUpdate, stats: result.stats });
}