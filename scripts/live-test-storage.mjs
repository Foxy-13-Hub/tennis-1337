// Isolated PostgREST test double. Exercises the real Supabase SDK/HTTP store,
// including conditional updates. Never connects to a Supabase project.
import { createServer } from 'node:http';
export async function startTestStorage() {
  let row = null;
  let failNextWrite = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    const reply = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    if (url.pathname.endsWith('/audit_events')) return reply(201, null);
    if (!url.pathname.endsWith('/tournament_state')) return reply(404, {});
    if (req.method === 'GET') return reply(200, row ? [row] : []);
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (failNextWrite) { failNextWrite = false; return reply(503, { message: 'Test storage unavailable' }); }
    if (req.method === 'POST') {
      row ??= { ...body, updated_at: new Date().toISOString() };
      return reply(201, null);
    }
    if (req.method === 'PATCH') {
      if (!row || url.searchParams.get('updated_at') !== `eq.${row.updated_at}`) return reply(200, []);
      row = { ...row, ...body }; return reply(200, [{ updated_at: row.updated_at }]);
    }
    reply(405, {});
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, snapshot: () => structuredClone(row),
    failWrite: () => { failNextWrite = true; }, close: () => new Promise(resolve => server.close(resolve)) };
}
