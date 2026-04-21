export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = safeSlug(url.pathname.split("/").filter(Boolean)[0]);

    if (url.pathname === "/__landingpro/publish") {
      return publishPageToKv(request, url, env, ctx);
    }

    if (url.pathname === "/__landingpro/purge") {
      return purgePageCache(request, url, env);
    }

    if (!slug) {
      return new Response("LandingPro published pages", {
        headers: {
          "content-type": "text/plain;charset=utf-8",
          "cache-control": "public, max-age=60"
        }
      });
    }

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/${slug}/`, {
      method: "GET",
      headers: {
        accept: "text/html"
      }
    });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withHeader(cached, "x-landingpro-cache", "HIT");
    }

    const kvHtml = await env.LANDINGPRO_PAGES?.get(kvPageKey(slug));
    if (kvHtml) {
      const response = htmlResponseFromString(kvHtml, slug, "KV");
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/landing-pages/published/${encodeURIComponent(slug)}/index.html`;
    const htmlResponse = await fetch(storageUrl, {
      cf: {
        cacheEverything: true,
        cacheTtl: 300
      }
    });

    if (!htmlResponse.ok) {
      return new Response("Published HTML not found", { status: 404 });
    }

    const html = await htmlResponse.text();
    const response = htmlResponseFromString(html, slug, "STORAGE");

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    ctx.waitUntil(env.LANDINGPRO_PAGES?.put(kvPageKey(slug), html));
    return response;
  }
};

async function publishPageToKv(request, url, env, ctx) {
  const headers = corsHeaders(env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, headers);
  }

  const authResult = await verifySupabaseUser(request, env);
  if (!authResult.ok) {
    return jsonResponse({ ok: false, error: authResult.error }, 401, headers);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
  }

  const slug = safeSlug(body.slug);
  const html = String(body.html || "");
  if (!slug || !html) {
    return jsonResponse({ ok: false, error: "Missing slug or html" }, 400, headers);
  }
  if (!html.trim().toLowerCase().startsWith("<!doctype html")) {
    return jsonResponse({ ok: false, error: "Only full static HTML documents are allowed" }, 400, headers);
  }
  if (new TextEncoder().encode(html).length > 900000) {
    return jsonResponse({ ok: false, error: "HTML is too large for fast serving" }, 413, headers);
  }

  await env.LANDINGPRO_PAGES.put(kvPageKey(slug), html, {
    metadata: {
      userId: authResult.user.id,
      email: authResult.user.email || "",
      updatedAt: new Date().toISOString()
    }
  });

  const cacheKey = new Request(`${url.origin}/${slug}/`, {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });
  await caches.default.delete(cacheKey);
  ctx.waitUntil(fetch(cacheKey));

  return jsonResponse({ ok: true, slug, source: "KV" }, 200, headers);
}

async function purgePageCache(request, url, env) {
  const headers = corsHeaders(env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, headers);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, headers);
  }

  const slug = safeSlug(body.slug);
  if (!slug) {
    return jsonResponse({ ok: false, error: "Missing slug" }, 400, headers);
  }

  const cacheKey = new Request(`${url.origin}/${slug}/`, {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });
  const purged = await caches.default.delete(cacheKey);
  return jsonResponse({ ok: true, slug, purged }, 200, headers);
}

function corsHeaders(env) {
  return {
    "access-control-allow-origin": env.CORS_ORIGIN || "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400"
  };
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...headers,
      "content-type": "application/json;charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function safeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function kvPageKey(slug) {
  return `page:${slug}`;
}

async function verifySupabaseUser(request, env) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing authorization" };
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization
    }
  });

  if (!response.ok) {
    return { ok: false, error: "Invalid Supabase session" };
  }

  const user = await response.json();
  return { ok: true, user };
}

function htmlResponseFromString(html, slug, source) {
  return new Response(html, {
    status: 200,
    headers: pageHeaders(slug, source)
  });
}

function pageHeaders(slug, source) {
  return new Headers({
    "content-type": "text/html;charset=utf-8",
    "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    "cdn-cache-control": "public, max-age=300",
    "cloudflare-cdn-cache-control": "public, max-age=300",
    "x-landingpro-slug": slug,
    "x-landingpro-cache": "MISS",
    "x-landingpro-source": source,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin"
  });
}

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
