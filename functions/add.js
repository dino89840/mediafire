// functions/add.js
// MediaFire link ပို့ → ID ထုတ်ပေး → permanent .mp4 link ပြန်ပေး

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const mfUrl = url.searchParams.get("url");

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (!mfUrl || !mfUrl.includes("mediafire.com")) {
    return new Response(
      JSON.stringify({ error: "MediaFire link မှန်မှန်ထည့်ပါ" }),
      { status: 400, headers: cors }
    );
  }

  // ကျပန်း ID ထုတ် (8 လုံး)
  const id = Math.random().toString(36).substring(2, 10);

  // KV မှာ သိမ်း
  await env.LINKS.put(id, mfUrl);

  const playLink = `${url.origin}/v/${id}.mp4`;

  return new Response(
    JSON.stringify({ id, link: playLink }),
    { headers: cors }
  );
}
