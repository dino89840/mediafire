// functions/v/[id].js
// direct link ကို KV မှာ ၅ မိနစ် cache လုပ်ထားသည်

const CACHE_TTL = 300; // 5 မိနစ် (စက္ကန့်)

export async function onRequest(context) {
  const { request, params, env } = context;

  let id = params.id;
  if (id.includes(".")) id = id.substring(0, id.lastIndexOf("."));

  // MediaFire link ရှာ
  const mfUrl = await env.LINKS.get(id);
  if (!mfUrl) {
    return new Response("ID ရှာမတွေ့ပါ", { status: 404 });
  }

  // ★ cache အရင်စစ် — resolve လုပ်ထားတဲ့ direct link ရှိပြီးသားလား
  const cacheKey = "direct:" + id;
  let direct = await env.LINKS.get(cacheKey);

  if (!direct) {
    // cache မှာ မရှိ → MediaFire ကို အသစ်ပြန် resolve
    try {
      direct = await resolveMediafire(mfUrl);
    } catch (e) {
      return new Response("Resolve error: " + e.message, { status: 502 });
    }
    if (!direct) {
      return new Response("Direct link ရှာမတွေ့ပါ", { status: 502 });
    }
    // ရလာတဲ့ direct link ကို ၅ မိနစ် cache (link string ပဲမို့ byte အနည်းငယ်)
    await env.LINKS.put(cacheKey, direct, { expirationTtl: CACHE_TTL });
  }

  // Range request forward (seek support)
  const fwdHeaders = new Headers();
  const range = request.headers.get("Range");
  if (range) fwdHeaders.set("Range", range);
  fwdHeaders.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  );

  let upstream = await fetch(direct, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: fwdHeaders,
    redirect: "follow",
  });

  // ★ cache ထဲက link expire ဖြစ်နေရင် (403/410) → ပြန် resolve ပြီး တစ်ခါ ထပ်ကြိုး
  if (upstream.status === 403 || upstream.status === 410 || upstream.status === 404) {
    const fresh = await resolveMediafire(mfUrl);
    if (fresh) {
      direct = fresh;
      await env.LINKS.put(cacheKey, direct, { expirationTtl: CACHE_TTL });
      upstream = await fetch(direct, {
        method: request.method === "HEAD" ? "HEAD" : "GET",
        headers: fwdHeaders,
        redirect: "follow",
      });
    }
  }

  const respHeaders = new Headers();
  for (const h of [
    "content-type", "content-length", "content-range",
    "accept-ranges", "last-modified", "etag",
  ]) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set("Accept-Ranges", "bytes");
  if (!respHeaders.has("content-type")) respHeaders.set("content-type", "video/mp4");
  respHeaders.set("Content-Disposition", "inline");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

async function resolveMediafire(mfUrl) {
  const res = await fetch(mfUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  const html = await res.text();

  let m = html.match(/id="downloadButton"[^>]*href="([^"]+)"/i);
  if (m && m[1]) return m[1];

  m = html.match(/href="(https?:\/\/download[^"]+)"/i);
  if (m && m[1]) return m[1];

  m = html.match(/data-scrambled-url="([^"]+)"/i);
  if (m && m[1]) {
    try {
      const decoded = atob(m[1]);
      if (decoded.startsWith("http")) return decoded;
    } catch (_) {}
  }

  m = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
  if (m && m[1] && m[1].startsWith("http")) return m[1];

  return null;
}
