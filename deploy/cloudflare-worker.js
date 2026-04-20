export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const slug = url.pathname.split("/").filter(Boolean)[0];

    if (!slug) {
      return new Response("LandingPro published pages", {
        headers: { "content-type": "text/plain;charset=utf-8" }
      });
    }

    const pageResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/landing_pages?slug=eq.${encodeURIComponent(slug)}&status=eq.Published&select=storage_path,published_url,updated_at&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!pageResponse.ok) {
      return new Response("Failed to query landing page", { status: 502 });
    }

    const pages = await pageResponse.json();
    const page = pages[0];

    if (!page?.storage_path) {
      return new Response("Landing page not found", { status: 404 });
    }

    const storageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/landing-pages/${page.storage_path}`;
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
      "cache-control": "public, max-age=300, stale-while-revalidate=86400",
      "x-landingpro-slug": slug,
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });

    return new Response(htmlResponse.body, {
      status: 200,
      headers
    });
  }
};
