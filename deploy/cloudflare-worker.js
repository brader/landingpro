export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = safeSlug(url.pathname.split("/").filter(Boolean)[0]);

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
        cacheTtl: 3600
      }
    });

    if (!htmlResponse.ok) {
      return new Response("Published HTML not found", { status: 404 });
    }

    const headers = new Headers({
      "content-type": "text/html;charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
      "cdn-cache-control": "public, max-age=3600",
      "cloudflare-cdn-cache-control": "public, max-age=3600",
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
