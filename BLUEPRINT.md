# LandingPro Blueprint

LandingPro adalah aplikasi Landing Page Builder khusus untuk kebutuhan iklan Meta, yaitu Facebook Ads dan Instagram Ads. Fokusnya bukan membuat website kompleks, tetapi membuat landing page campaign yang cepat dibuat, cepat dibuka, mobile-first, dan conversion-oriented.

## 1. Tujuan Produk

Masalah utama yang diselesaikan:
- Advertiser sering butuh landing page cepat untuk testing offer, audience, dan angle iklan.
- Page builder umum terlalu berat, terlalu bebas, dan sering menghasilkan halaman lambat.
- Banyak user non-teknis ingin publish halaman tanpa coding, tanpa setup hosting rumit, dan tanpa memikirkan optimasi teknis.

Target user:
- UMKM yang menjalankan Meta Ads.
- Performance marketer dan media buyer.
- Agensi kecil.
- Seller produk fisik.
- Creator produk digital.
- Bisnis lead generation seperti klinik, properti, kursus, jasa, dan konsultasi.

Perbedaannya dari builder umum:
- Scope dibatasi hanya untuk landing page campaign.
- Section sudah dipilih untuk funnel iklan, bukan halaman website lengkap.
- Output harus ringan, mobile-first, dan mudah diduplikasi per campaign.
- Editor menuntun user ke struktur conversion, bukan kanvas bebas tanpa arah.

Kenapa simple + fast load penting untuk Meta Ads:
- Mayoritas traffic berasal dari mobile.
- User dari iklan cenderung cold audience dan mudah bounce.
- Loading lambat membuat biaya iklan terbuang sebelum pesan terbaca.
- Halaman sederhana membantu user scan offer dan CTA dengan cepat.

## 2. Positioning Produk

LandingPro bukan website builder kompleks, bukan CMS, dan bukan toko online penuh.

LandingPro adalah builder khusus landing page iklan yang:
- Cepat dibuat.
- Cepat dibuka.
- Mudah diduplikasi untuk campaign baru.
- Fokus pada CTA, lead, WhatsApp, checkout, atau conversion event lain.

Keunggulan utama:
- Speed.
- Simplicity.
- Conversion focus.

## 3. Fitur Utama MVP

Wajib ada di MVP:
- Create new landing page.
- Template library.
- Drag-and-drop atau reorder section builder sederhana.
- Edit teks, gambar, tombol, dan warna dasar.
- Form lead sederhana.
- Sticky CTA button.
- Testimoni section.
- FAQ section.
- Price atau offer section.
- Countdown timer opsional.
- Custom subdomain atau hosted subpath.
- Publish page.
- Duplicate page.
- Preview desktop dan mobile.
- Basic analytics.
- Meta Pixel dan conversion script injection.
- SEO basic settings.
- Image compression otomatis.
- Fast-loading asset management.

Sebaiknya ditunda:
- A/B testing kompleks.
- AI copywriter tingkat lanjut.
- Payment checkout internal.
- CRM penuh.
- Marketplace template.
- Multi-user permission detail.
- Heatmap dan session replay.
- Animation timeline.
- Integrasi terlalu banyak.

## 4. Batasan Produk

Jangan dimasukkan di awal:
- Blog engine.
- Website multi-page kompleks.
- Ecommerce catalog besar.
- Membership atau LMS.
- Visual editor bebas total seperti design tool.
- Video background autoplay.
- Widget pihak ketiga tanpa kontrol.

Hal yang membuat builder berat:
- Terlalu banyak font dan icon library.
- Animasi scroll/parallax.
- Slider/carousel besar.
- Script tracking terlalu banyak.
- Image original tanpa resize.
- Render halaman published memakai bundle editor.

Fitur terlihat keren tapi kurang penting untuk Meta Ads:
- Parallax.
- Section dekoratif berlebihan.
- Layout desktop rumit.
- Efek hover kompleks.
- Live chat berat.
- Custom CSS bebas untuk semua user.

## 5. User Flow

1. User login/register.
2. User masuk dashboard.
3. User klik create new page.
4. User pilih template.
5. User edit section.
6. User isi copywriting dan visual.
7. User pasang Meta Pixel atau conversion script.
8. User preview mobile dan desktop.
9. User publish.
10. User mendapat link landing page.
11. User memasukkan link ke Meta Ads.

## 6. Struktur Halaman Aplikasi

- Login/register.
- Dashboard.
- List landing page.
- Create new page.
- Editor.
- Template gallery.
- Analytics page.
- Domain/settings page.
- Billing page.

Billing relevan setelah produk punya limit plan seperti jumlah page, custom domain, analytics retention, dan team member.

## 7. Blok / Section Builder

Hero section:
- Headline.
- Subheadline.
- CTA text.
- CTA link.
- Image.
- Background color.

Image + benefit:
- Image.
- Title.
- Description.
- Bullet benefits.
- Layout direction.

Product highlights:
- Section title.
- Highlight items.
- Icon optional.
- Short description.

Social proof / testimonial:
- Customer name.
- Quote.
- Result/context.
- Rating optional.

CTA section:
- Title.
- Supporting copy.
- Button text.
- Button link.
- Variant normal/sticky.

Form lead:
- Fields.
- Submit button.
- Success message.
- Webhook or email destination.

FAQ:
- Question.
- Answer.
- Sort order.

Price / offer:
- Price.
- Discount text.
- Bonus list.
- Guarantee text.
- CTA.

Countdown:
- Deadline.
- Label.
- CTA.
- Hide/show after expired.

Footer sederhana:
- Brand name.
- Contact.
- Privacy link.
- Disclaimer.

## 8. Prinsip Desain

- Mobile-first.
- Clean UI.
- Tidak ramai.
- Editor mudah dipahami user awam.
- Output landing page sangat ringan.
- Hindari dekorasi berlebihan.
- Prioritaskan load speed.
- Prioritaskan kemudahan scanning.
- Satu halaman idealnya punya satu goal utama.

## 9. Struktur Database

users:
- id.
- name.
- email.
- password_hash.
- plan.
- created_at.
- updated_at.

landing_pages:
- id.
- user_id.
- template_id.
- name.
- slug.
- status.
- seo_title.
- seo_description.
- pixel_id.
- custom_head_script.
- custom_body_script.
- published_url.
- published_at.
- created_at.
- updated_at.

templates:
- id.
- name.
- category.
- thumbnail_url.
- schema_json.
- is_public.
- created_at.

sections:
- id.
- landing_page_id.
- type.
- sort_order.
- content_json.
- style_json.
- created_at.
- updated_at.

assets:
- id.
- user_id.
- landing_page_id.
- original_url.
- optimized_url.
- mime_type.
- size_bytes.
- width.
- height.
- alt_text.
- created_at.

domains:
- id.
- user_id.
- hostname.
- status.
- dns_target.
- verified_at.
- created_at.

analytics_events:
- id.
- landing_page_id.
- visitor_id.
- session_id.
- event_name.
- event_value.
- utm_json.
- referrer.
- device.
- browser.
- created_at.

form_submissions:
- id.
- landing_page_id.
- payload_json.
- source.
- utm_json.
- created_at.

Relasi utama:
- user memiliki banyak landing_pages, assets, domains.
- landing_page memiliki banyak sections, analytics_events, form_submissions.
- template menjadi basis awal landing_page.
- asset bisa terkait user dan landing_page.

## 10. Logika Teknis Fast Load

Strategi praktis:
- Halaman published dirender sebagai static HTML atau pre-rendered output, bukan membawa bundle editor.
- CSS untuk halaman published diperkecil dan critical CSS bisa di-inline.
- JavaScript published hanya untuk form, CTA event, countdown, dan tracking minimal.
- Gambar di-resize saat upload, dikompresi ke WebP/AVIF, dan dibuat varian mobile.
- Gambar di bawah fold memakai lazy loading.
- Font memakai system font atau satu webfont dengan subset.
- Script pihak ketiga dibatasi melalui whitelist, misalnya Meta Pixel dan Google Tag Manager jika benar-benar perlu.
- CDN digunakan untuk HTML, CSS, JS, dan assets.
- Cache halaman published agresif, purge otomatis setelah publish ulang.
- HTML section dibuat sederhana dan semantic.
- Hindari framework runtime besar pada hasil publish.

## 11. Tech Stack

Versi simpel dan cepat dibangun:
- Frontend app: React + Vite atau Next.js.
- Backend: Next.js API routes atau Node.js Fastify.
- Database: Supabase Postgres.
- Storage: Supabase Storage atau Cloudflare R2.
- Deployment: Vercel atau Cloudflare Pages.
- Analytics: table analytics_events di Postgres untuk MVP.
- Domain handling: Cloudflare DNS API atau manual CNAME verification.

Versi scalable:
- Frontend app: Next.js atau Remix.
- Backend: NestJS/Fastify service terpisah.
- Database: Postgres.
- Cache/queue: Redis + BullMQ.
- Analytics: ClickHouse.
- Storage: S3/R2.
- Image processing: worker queue dengan Sharp.
- Deployment: Cloudflare Pages/Workers + container backend.
- Domain handling: Cloudflare for SaaS.

## 12. Analytics & Tracking

Event relevan:
- page_view.
- unique_visitor.
- cta_click.
- form_submit.
- scroll_25.
- scroll_50.
- scroll_75.
- conversion.
- whatsapp_click.
- outbound_click.

Dimensi data:
- UTM source, medium, campaign, content, term.
- Device.
- Browser.
- Referrer.
- Landing page slug.
- CTA location.
- Template type.

## 13. Template Strategy

Template lead generation:
- Hero, benefit, proof, form, FAQ, sticky CTA.

Template produk fisik:
- Hero product, benefit, highlights, offer, testimonial, countdown, WhatsApp CTA, FAQ.

Template produk digital:
- Hero, outcome, curriculum/highlights, bonus, pricing, proof, FAQ, CTA.

Template advertorial:
- Headline story, problem, discovery, solution, proof, offer, CTA.

Template katalog singkat:
- Hero, product grid mini, best seller, offer, lead/WhatsApp CTA.

Template WhatsApp conversion:
- Hero, benefit, proof, guarantee, sticky WhatsApp CTA, FAQ.

