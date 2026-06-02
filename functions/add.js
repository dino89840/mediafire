// functions/add.js
// MediaFire link ပို့ → ID ထုတ်ပေး → permanent download link ပြန်ပေး
// ★ custom filename support — filename ကို URL path ထဲ တိုက်ရိုက်ထည့်

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const mfUrl = url.searchParams.get("url");
  const customName = url.searchParams.get("name"); // ★ optional

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  // ★ MediaFire link ပိုတိကျအောင် စစ်
  if (!mfUrl || !/^https?:\/\/(www\.)?mediafire\.com\//i.test(mfUrl)) {
    return new Response(
      JSON.stringify({ error: "MediaFire link မှန်မှန်ထည့်ပါ" }),
      { status: 400, headers: cors }
    );
  }

  // ★ ID collision မဖြစ်အောင် UUID အခြေခံ (8 လုံး)
  const id = crypto.randomUUID().replace(/-/g, "").substring(0, 8);

  // KV မှာ သိမ်း
  await env.LINKS.put(id, mfUrl);

  // ★ custom filename ရှိရင် သိမ်း
  let finalName = "";
  if (customName && customName.trim()) {
    finalName = customName.trim();
    await env.LINKS.put("name:" + id, finalName);
  }

  // ───────────────────────────────────────────────
  // ★★★ link ဆောက်နည်း ပြောင်းထား ★★★
  // download manager တွေက URL path ရဲ့ နောက်ဆုံးအပိုင်းကို filename အဖြစ်ယူတယ်။
  // ဒါကြောင့် custom name ကို path ထဲ တိုက်ရိုက်ထည့်ပေးတယ်။
  // ပုံစံ: /v/{id}/{filename}
  let downloadLink;

  if (finalName) {
    // extension မပါရင် .mp4 ဖြည့်
    let nameForUrl = finalName;
    if (!nameForUrl.includes(".")) nameForUrl += ".mp4";
    // URL-safe ဖြစ်အောင် encode (space, မြန်မာစာ စသဖြင့်)
    downloadLink = `${url.origin}/v/${id}/${encodeURIComponent(nameForUrl)}`;
  } else {
    // custom name မရှိ → ID ကိုပဲ filename အဖြစ်သုံး
    downloadLink = `${url.origin}/v/${id}.mp4`;
  }

  return new Response(
    JSON.stringify({ id, link: downloadLink, name: finalName || null }),
    { headers: cors }
  );
}
