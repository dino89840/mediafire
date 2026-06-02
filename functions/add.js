// functions/add.js
// MediaFire link ပို့ → ID ထုတ်ပေး → permanent download link ပြန်ပေး
// ★ custom filename support (name parameter)

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

  // link extension — custom name ရှိရင် အဲ့ဒီ extension သုံး၊ မရှိရင် .mp4
  let ext = "mp4";
  if (finalName && finalName.includes(".")) {
    ext = finalName.substring(finalName.lastIndexOf(".") + 1);
  }

  const playLink = `${url.origin}/v/${id}.${ext}`;

  return new Response(
    JSON.stringify({ id, link: playLink, name: finalName || null }),
    { headers: cors }
  );
}
