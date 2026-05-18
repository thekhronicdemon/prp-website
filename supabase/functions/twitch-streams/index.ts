const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let cachedToken = "";
let cachedTokenExpiresAt = 0;

async function getTwitchToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const clientId = Deno.env.get("TWITCH_CLIENT_ID");
  const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Missing Twitch credentials");
  }

  const tokenUrl = new URL("https://id.twitch.tv/oauth2/token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("grant_type", "client_credentials");

  const tokenResponse = await fetch(tokenUrl.toString(), { method: "POST" });

  if (!tokenResponse.ok) {
    throw new Error(`Twitch token request failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();

  cachedToken = tokenData.access_token;
  cachedTokenExpiresAt = now + (tokenData.expires_in || 3600) * 1000;

  return cachedToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    const url = new URL(req.url);
    const users = (url.searchParams.get("users") || "")
      .split(",")
      .map((user) => user.trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase())
      .filter(Boolean)
      .slice(0, 100);

    if (!clientId) {
      throw new Error("Missing Twitch client ID");
    }

    if (users.length === 0) {
      return new Response(JSON.stringify({ data: [], streams: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getTwitchToken();
    const streamsUrl = new URL("https://api.twitch.tv/helix/streams");

    users.forEach((user) => {
      streamsUrl.searchParams.append("user_login", user);
    });

    const streamsResponse = await fetch(streamsUrl.toString(), {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!streamsResponse.ok) {
      throw new Error(`Twitch streams request failed: ${streamsResponse.status}`);
    }

    const streamsData = await streamsResponse.json();

    return new Response(
      JSON.stringify({
        data: streamsData.data || [],
        streams: streamsData.data || [],
        fetchedAt: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "public, max-age=30",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Twitch lookup failed",
        data: [],
        streams: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
