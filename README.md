# LandingPro

LandingPro adalah aplikasi Landing Page Builder ringan untuk kebutuhan Meta Ads. Versi ini memakai React + Vite, Supabase Auth, Supabase Database, dan Supabase Storage.

## Cara Menjalankan

```bash
npm install
npm run dev
```

Buka:

```text
http://127.0.0.1:5173
```

Jika preview Vite tidak bisa diakses:

```bash
npm run build
npm run preview:static
```

Buka:

```text
http://127.0.0.1:8090
```

## Supabase

1. Buat project Supabase.
2. Aktifkan Email Auth.
3. Jalankan isi `supabase/schema.sql` di Supabase SQL Editor.
4. Buat `.env`:

```bash
cp .env.example .env
```

5. Isi:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_WORKSPACE_ID=novamos
VITE_PUBLIC_LP_DOMAIN=lp.novamos.id
```

6. Restart dev server.

## Alur Internal Tim

Untuk penggunaan sendiri bersama tim, setup dibuat sederhana:

- Builder/editor berjalan di hosting frontend.
- Semua landing page publish memakai satu domain utama: `lp.novamos.id`.
- Saat klik `Publish`, app membuat static HTML dan upload ke Supabase Storage bucket `landing-pages`.
- Format path Storage:

```text
landing-pages/{auth.uid()}/{slug}/index.html
```

- Format URL publik:

```text
https://lp.novamos.id/{slug}/
```

## Serve Published Pages

Gunakan template Cloudflare Worker:

```text
deploy/cloudflare-worker.js
```

Worker ini membaca slug dari URL, mencari `storage_path` di tabel `landing_pages`, lalu mengembalikan HTML dari Supabase Storage.

Secrets Cloudflare Worker:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Jangan masukkan `SUPABASE_SERVICE_ROLE_KEY` ke frontend `.env`.

## Deploy Frontend Builder

Frontend builder bisa dideploy sebagai static React app.

Cloudflare Pages:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

Environment variables di Cloudflare Pages:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_SUPABASE_WORKSPACE_ID=novamos
VITE_PUBLIC_LP_DOMAIN=lp.novamos.id
```

Untuk Cloudflare Workers/Pages mode baru, SPA fallback ditangani oleh konfigurasi platform. Tidak perlu menambahkan file `_redirects`.

## Isi Aplikasi

- Supabase login/register.
- Dashboard campaign.
- List landing page.
- Template gallery.
- Editor mirip Elementor.
- Drag-and-drop widget dan navigator.
- Upload image dengan auto resize/compress.
- Preview mobile/tablet/desktop.
- Export static HTML.
- Publish static HTML ke Supabase Storage.
- Basic analytics mock.
- Domain publish utama di Settings.

## Catatan Produksi

Untuk versi internal tim, kamu tidak perlu Cloudflare for SaaS atau custom hostname API. Cukup siapkan `lp.novamos.id` sekali di Cloudflare Worker. Nanti kalau produk dibuka untuk banyak customer dengan domain masing-masing, baru tambahkan kembali fitur custom domain otomatis.
