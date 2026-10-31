// Vercel serverless function: GET /api/passcode?vid=1234
// Fetch source HTML situs asli secara server-side (tidak kena CORS browser),
// extract konstanta passcode-nya, lalu hitung kode yang berlaku sekarang.
// Jadi selalu sinkron sama live source, tanpa perlu update manual.

const SOURCE_URL = 'https://lngshot-au-unknown.rinai.workers.dev/';
const CACHE_MS = 5 * 60 * 1000; // cache source 5 menit biar nggak fetch tiap request
let cache = null; // { data, fetchedAt }

function extract(html) {
  const num = (name) => {
    const m = html.match(new RegExp(name + '\\s*=\\s*(\\d+)'));
    if (!m) throw new Error('const tidak ditemukan: ' + name);
    return +m[1];
  };
  const dateVal = (name) => {
    const m = html.match(new RegExp(name + "\\s*=\\s*Date\\.parse\\('([^']+)'\\)"));
    if (!m) throw new Error('const tidak ditemukan: ' + name);
    return Date.parse(m[1]);
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
    if (!cache || Date.now() - cache.fetchedAt > CACHE_MS) {
      const r = await fetch(SOURCE_URL, { cache: 'no-store' });
      const html = await r.text();
      cache = { data: extract(html), fetchedAt: Date.now() };
    }
    const vid = (+req.query.vid) >>> 0 || 1;
    const result = computePass(cache.data, vid, Date.now());
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ...result, live: true, source_checked: cache.fetchedAt });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
