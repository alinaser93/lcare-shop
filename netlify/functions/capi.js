/* ════════════════════════════════════════════════════════════════
   Meta Conversions API (CAPI) — متجر LCARE
   يستقبل الأحداث من المتصفح ويرسلها server-to-server إلى Meta.
   التوكن يُقرأ من متغير البيئة META_ACCESS_TOKEN (محمي، ليس في الكود).
   نفس event_id المُرسل من الـ Pixel → منع التكرار (deduplication).
════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

const PIXEL_ID = '3613882612094743';
const API_VERSION = 'v21.0';

// تشفير البيانات الحساسة (هاتف/إيميل) بـ SHA-256 كما تتطلب Meta
function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!TOKEN) {
    // لا نكشف التفاصيل — فقط نخبر أن الإعداد ناقص
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'CAPI not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      event_name,
      event_id,
      event_source_url,
      custom_data = {},
      user_data = {},
      test_event_code
    } = body;

    if (!event_name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_name required' }) };
    }

    // معلومات العميل من ترويسات الطلب (لتحسين المطابقة)
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      undefined;
    const userAgent = event.headers['user-agent'] || undefined;

    const ud = {
      client_ip_address: clientIp,
      client_user_agent: userAgent
    };
    if (user_data.fbp) ud.fbp = user_data.fbp;
    if (user_data.fbc) ud.fbc = user_data.fbc;
    if (user_data.em) ud.em = sha256(user_data.em);
    if (user_data.ph) ud.ph = sha256(user_data.ph);
    if (user_data.fn) ud.fn = sha256(user_data.fn);
    if (user_data.ln) ud.ln = sha256(user_data.ln);
    if (user_data.ct) ud.ct = sha256(user_data.ct);
    if (user_data.country) ud.country = sha256(user_data.country);
    if (user_data.external_id) ud.external_id = sha256(user_data.external_id);

    const payload = {
      data: [{
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,                       // ← نفس معرّف الـ Pixel = منع التكرار
        action_source: 'website',
        event_source_url,
        user_data: ud,
        custom_data
      }]
    };
    if (test_event_code) payload.test_event_code = test_event_code;

    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, fb: result }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'server_error' }) };
  }
};
