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

    if (url.pathname === "/__landingpro/ai/generate-page") {
      return generateAiLandingPage(request, env);
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

async function generateAiLandingPage(request, env) {
  const headers = corsHeaders(env);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, headers);
  }

  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ ok: false, error: "OPENAI_API_KEY belum diset di Worker secret." }, 503, headers);
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

  const brief = sanitizeBrief(body.brief || {});
  if (!brief.product || !brief.audience || !brief.problem) {
    return jsonResponse({ ok: false, error: "Isi minimal produk, target audience, dan masalah utama." }, 400, headers);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.7,
      max_tokens: 1800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "landingpro_ai_page",
          strict: true,
          schema: aiPageSchema()
        }
      },
      messages: [
        {
          role: "system",
          content: "You are an expert direct response landing page copywriter for Meta Ads traffic in Indonesia. Generate concise, mobile-first, high-conversion landing pages for a simple no-code builder. Return only valid JSON matching the schema. Avoid heavy sections, fake testimonials, impossible guarantees, medical or financial overclaims, and unsupported widget types. Use Indonesian unless the brief clearly requests another language."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate a ready-to-edit LandingPro page.",
            rules: [
              "Use 6 to 8 sections only.",
              "Prefer short paragraphs and scannable bullets.",
              "Use one sticky WhatsApp or CTA button when relevant.",
              "Do not invent real testimonials; use proof placeholders if needed.",
              "Map WhatsApp CTA to pixelEvent Contact, lead CTA to Lead, product detail to ViewContent.",
              "Supported section types: header, text, bulletList, image, divider, button, whatsappButton, htmlCode."
            ],
            brief
          })
        }
      ]
    })
  });

  const openAiPayload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return jsonResponse({ ok: false, error: openAiPayload.error?.message || "OpenAI request gagal." }, 502, headers);
  }

  const content = openAiPayload.choices?.[0]?.message?.content || "";
  let page = null;
  try {
    page = JSON.parse(content);
  } catch {
    return jsonResponse({ ok: false, error: "AI mengembalikan JSON yang tidak valid." }, 502, headers);
  }

  return jsonResponse({ ok: true, page }, 200, headers);
}

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

function sanitizeBrief(brief) {
  return {
    pageType: trimText(brief.pageType, 60),
    product: trimText(brief.product, 160),
    audience: trimText(brief.audience, 220),
    problem: trimText(brief.problem, 500),
    benefit: trimText(brief.benefit, 500),
    offer: trimText(brief.offer, 220),
    price: trimText(brief.price, 80),
    ctaGoal: trimText(brief.ctaGoal, 100),
    tone: trimText(brief.tone, 80),
    currentPage: brief.currentPage || null
  };
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function aiPageSchema() {
  const styleSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      background: { type: "string" },
      textColor: { type: "string" },
      accentColor: { type: "string" },
      align: { type: "string", enum: ["left", "center", "right"] },
      padding: { type: "number" },
      radius: { type: "number" },
      hidden: { type: "boolean" }
    },
    required: ["background", "textColor", "accentColor", "align", "padding", "radius", "hidden"]
  };

  const sectionSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["header", "text", "bulletList", "image", "divider", "button", "whatsappButton", "htmlCode"] },
      title: { type: "string" },
      body: { type: "string" },
      level: { type: "string", enum: ["h1", "h2", "h3"] },
      items: { type: "array", items: { type: "string" } },
      icon: { type: "string" },
      cta: { type: "string" },
      link: { type: "string" },
      phone: { type: "string" },
      message: { type: "string" },
      pixelEvent: { type: "string", enum: ["ViewContent", "Lead", "Contact", "CompleteRegistration", "AddToCart", "InitiateCheckout", "Purchase", "Subscribe"] },
      sticky: { type: "boolean" },
      src: { type: "string" },
      image: { type: "string" },
      caption: { type: "string" },
      imageSize: { type: "number" },
      thickness: { type: "number" },
      dividerStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
      style: styleSchema
    },
    required: ["type", "title", "body", "level", "items", "icon", "cta", "link", "phone", "message", "pixelEvent", "sticky", "src", "image", "caption", "imageSize", "thickness", "dividerStyle", "style"]
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      pageName: { type: "string" },
      slug: { type: "string" },
      template: { type: "string" },
      seoTitle: { type: "string" },
      seoDescription: { type: "string" },
      sections: {
        type: "array",
        minItems: 5,
        maxItems: 10,
        items: sectionSchema
      }
    },
    required: ["pageName", "slug", "template", "seoTitle", "seoDescription", "sections"]
  };
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
