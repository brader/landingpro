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
      max_tokens: 4500,
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
          content: [
            "You are a senior direct-response strategist, landing page UX designer, and conversion copywriter for Indonesian Meta Ads traffic.",
            "Generate landing pages that feel specific, commercially sharp, and ready to edit, not generic placeholder pages.",
            "Use the requested framework when provided, especially AIDA, PAS, BAB, 4P, or advertorial storyselling.",
            "Every page must have a clear persuasion arc: hook, problem recognition, solution mechanism, concrete benefits, offer stack, proof or proof placeholder, objection handling, and final action.",
            "Keep it mobile-first, fast-loading, and scannable. No heavy widgets, fake testimonials, impossible guarantees, medical or financial overclaims, or unsupported widget types.",
            "Use Indonesian unless the brief clearly requests another language. Return only valid JSON matching the schema."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate a ready-to-edit LandingPro page.",
            conversionFramework: brief.framework || "AIDA + PAS",
            recommendedPageShape: [
              "1. Header: attention-grabbing headline with clear outcome, not vague hype.",
              "2. Text: PAS problem agitation and empathy using the audience language.",
              "3. Image: visual placeholder guidance for the product/offer.",
              "4. BulletList: interest/desire benefits, concrete and outcome-based.",
              "5. Text: solution mechanism or why this offer works.",
              "6. BulletList: offer stack, what they get, bonuses, guarantees, or process.",
              "7. Text or htmlCode: proof placeholder and risk reversal without fake claims.",
              "8. htmlCode: FAQ/objection handling with 4 to 5 questions.",
              "9. Sticky WhatsApp/button CTA: direct action with pixelEvent Contact or Lead."
            ],
            rules: [
              "Use 8 to 10 sections when the brief has enough context; use 6 to 8 only for very simple offers.",
              "Make the copy specific to the product, audience, pain, benefit, price, and CTA goal in the brief.",
              "Headlines should be clear and benefit-led, around 7 to 14 words.",
              "Subheadlines should explain who it is for, what outcome they get, and why it is easier/faster/different.",
              "Prefer short paragraphs, strong subheads, and scannable bullets.",
              "Use AIDA: Attention in hero, Interest in problem/solution, Desire in benefits/offer/proof, Action in CTA.",
              "Use PAS inside the problem section: problem, agitation, solution transition.",
              "Use ethical urgency only if offer/price/promo supports it. Do not invent deadlines.",
              "Use one sticky WhatsApp or CTA button when relevant.",
              "Do not invent real testimonials; use proof placeholders if needed.",
              "FAQ should answer real buyer objections: cocok untuk siapa, cara kerja, hasil yang realistis, harga/pembayaran, cara daftar.",
              "Map WhatsApp CTA to pixelEvent Contact, lead CTA to Lead, product detail to ViewContent.",
              "For htmlCode FAQ, use lightweight semantic HTML only: <div>, <h2>, <details>, <summary>, <p>. No script, iframe, style tag, or external assets.",
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

  const parsed = parseAiPage(openAiPayload.choices?.[0]?.message);
  if (!parsed.ok) {
    const repaired = await repairAiJson(parsed.content, env);
    if (repaired.ok) {
      return jsonResponse({ ok: true, page: repaired.page, repaired: true }, 200, headers);
    }
    return jsonResponse({ ok: false, error: parsed.error }, 502, headers);
  }

  return jsonResponse({ ok: true, page: parsed.page }, 200, headers);
}

function parseAiPage(message) {
  if (!message) {
    return { ok: false, error: "AI tidak mengembalikan response." };
  }
  if (message.parsed && typeof message.parsed === "object") {
    return { ok: true, page: message.parsed };
  }

  const content = normalizeAiContent(message.content);
  const candidates = [
    content,
    stripCodeFence(content),
    extractJsonObject(content)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const page = JSON.parse(candidate);
      if (page && typeof page === "object") return { ok: true, page };
    } catch {
      // Try the next shape. Models can occasionally wrap JSON in prose/code fences.
    }
  }

  return {
    ok: false,
    content,
    error: message.finish_reason === "length"
      ? "Output AI kepotong sebelum JSON selesai. Coba generate ulang."
      : "AI mengembalikan JSON yang belum valid. Coba generate ulang dengan brief lebih singkat."
  };
}

async function repairAiJson(content, env) {
  const raw = String(content || "").trim();
  if (!raw) return { ok: false };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 4500,
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
          content: "Repair the user's malformed LandingPro JSON into one valid JSON object matching the provided schema. Preserve the intended Indonesian copy where possible. Return only the valid JSON object."
        },
        {
          role: "user",
          content: raw.slice(0, 14000)
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false };
  return parseAiPage(payload.choices?.[0]?.message);
}

function normalizeAiContent(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(value) {
  const text = String(value || "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1).trim();
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
    framework: trimText(brief.framework, 80),
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
