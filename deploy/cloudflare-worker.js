export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = safeSlug(url.pathname.split("/").filter(Boolean)[0]);

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

    const headers = new Headers({
      "content-type": "text/html;charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "cdn-cache-control": "public, max-age=300",
      "cloudflare-cdn-cache-control": "public, max-age=300",
      "x-landingpro-slug": slug,
      "x-landingpro-cache": "MISS",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });

    const response = new Response(htmlResponse.body, {
      status: 200,
      headers
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};

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
    "access-control-allow-headers": "content-type",
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

function withHeader(response, name, value) {
  const headers = new Headers(response.headers);
  headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
