// Vercel serverless function: GET /api/passcode?vid=1234
// Fetch source HTML situs asli secara server-side (tidak kena CORS browser),
// extract konstanta passcode-nya, lalu hitung kode yang berlaku sekarang.
// Jadi selalu sinkron sama live source, tanpa perlu update manual.

const SOURCE_URL = 'https://lngshot-au-unknown.rinai.workers.dev/';
const CACHE_MS = 5 * 60 * 1000; // cache source 5 menit biar nggak fetch tiap request
const RETRY_MS = 30 * 1000;
let cache = null; // { data, fetchedAt }
let lastFetchAttemptAt = 0;

function extract(html) {
  const num = (name) => {
    const m = html.match(new RegExp('\\bconst\\s+' + name + '\\s*=\\s*(\\d+(?:\\s*\\*\\s*\\d+)*)\\s*;'));
    if (!m) throw new Error('const tidak ditemukan: ' + name);
    const value = m[1].split('*').reduce((result, part) => result * Number(part.trim()), 1);
    if (!Number.isSafeInteger(value)) throw new Error('nilai const tidak valid: ' + name);
    return value;
  };
  const dateVal = (name) => {
    const m = html.match(new RegExp(name + "\\s*=\\s*Date\\.parse\\('([^']+)'\\)"));
    if (!m) throw new Error('const tidak ditemukan: ' + name);
    const value = Date.parse(m[1]);
    if (!Number.isFinite(value)) throw new Error('tanggal const tidak valid: ' + name);
    return value;
  };
  const PASS_START = dateVal('PASS_START');
  const PASS_STEP0 = num('PASS_STEP0');
  const PASS_START2 = dateVal('PASS_START2');
  const PASS_STEP = num('PASS_STEP');
  const SHUFFLE_SALT = num('SHUFFLE_SALT');
  const PASS_STEP2 = num('PASS_STEP2');

  const arrMatch = html.match(/const\s+PASSES\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!arrMatch) throw new Error('const tidak ditemukan: PASSES');
  // array literal berisi string saja (hint + kode) — dievaluasi sebagai literal JS
  const PASSES = new Function('return ' + arrMatch[1])();
  if (!Array.isArray(PASSES) || PASSES.length === 0 ||
      PASSES.some((row) => !Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string')) {
    throw new Error('format const PASSES tidak valid');
  }

  return { PASS_START, PASS_STEP0, PASS_START2, PASS_STEP, SHUFFLE_SALT, PASS_STEP2, PASSES };
}

function rng(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function computePass(c, vid, now) {
  const { PASS_START, PASS_STEP0, PASS_START2, PASS_STEP, SHUFFLE_SALT, PASS_STEP2, PASSES } = c;
  const PASS_N = PASSES.length;
  const PASS_N0 = Math.round((PASS_START2 - PASS_START) / PASS_STEP0);
  const PASS_C0_END = PASS_START2 + (PASS_N - PASS_N0) * PASS_STEP;
  const PASS_CYCLE = PASS_N * PASS_STEP2;

  const ORD = [Array.from({ length: PASS_N }, (_, i) => i)];
  function passOrder(cyc) {
    while (ORD.length <= cyc) {
      const n = ORD.length;
      const r = rng((Math.imul(n ^ vid, 2654435761) ^ SHUFFLE_SALT) >>> 0);
      const a = ORD[0].slice();
      const prevLast = ORD[n - 1][PASS_N - 1];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      if (a[0] === prevLast) [a[0], a[1]] = [a[1], a[0]];
      ORD.push(a);
    }
    return ORD[cyc];
  }
  function passIndex(t) {
    if (t < PASS_START2) return Math.max(0, Math.floor((t - PASS_START) / PASS_STEP0));
    if (t < PASS_C0_END) return PASS_N0 + Math.floor((t - PASS_START2) / PASS_STEP);
    const d = t - PASS_C0_END, cyc = 1 + Math.floor(d / PASS_CYCLE), pos = Math.floor((d % PASS_CYCLE) / PASS_STEP2);
    return passOrder(cyc)[pos];
  }
  const idx = passIndex(now);
  const row = PASSES[idx] || PASSES[0];
  return {
    code: row[1],
    hint: row[0],
    phase: now < PASS_START2 ? 1 : (now < PASS_C0_END ? 2 : 3),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      res.status(405).json({ error: 'method tidak didukung' });
      return;
    }

    if ((!cache || Date.now() - cache.fetchedAt > CACHE_MS) &&
        Date.now() - lastFetchAttemptAt >= RETRY_MS) {
      lastFetchAttemptAt = Date.now();
      try {
        const r = await fetch(SOURCE_URL, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new Error('situs sumber merespons HTTP ' + r.status);
        const html = await r.text();
        cache = { data: extract(html), fetchedAt: Date.now() };
      } catch (e) {
        if (!cache) throw e;
      }
    }
    if (!cache) throw new Error('belum ada data valid dari situs sumber');
    const vid = (+(req.query && req.query.vid)) >>> 0 || 1;
    const result = computePass(cache.data, vid, Date.now());
    res.setHeader('Cache-Control', 'no-store');
    const stale = Date.now() - cache.fetchedAt > CACHE_MS;
    res.status(200).json({ ...result, live: true, stale, source_checked: cache.fetchedAt });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
