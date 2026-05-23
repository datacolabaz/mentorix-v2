# Mentorix SEO (mentorix.io)

## Artıq layihədə

- `frontend/public/robots.txt` — panel yolları `Disallow`, `/login` və `/search` `Allow`
- `frontend/public/sitemap.xml` — `/`, `/login`, `/search`
- `frontend/index.html` — meta description, canonical, Open Graph, JSON-LD `WebSite`
- `frontend/src/lib/pageSeo.js` — login və axtarış səhifələrində dinamik title/description

## Sizin addımlar (Google)

1. [Google Search Console](https://search.google.com/search-console) → mülkiyyət əlavə et → `https://mentorix.io`
2. Doğrulama: DNS TXT və ya HTML meta — `frontend/index.html` `<head>`-ə əlavə edin, deploy edin, yoxlayın
3. Sitemap göndərin: `https://mentorix.io/sitemap.xml`
4. URL yoxlaması: `https://mentorix.io/search` və `https://mentorix.io/login`

## Qeyd

Əsas tətbiq (müəllim/tələbə paneli) giriş tələb edir; indeks üçün ən vacib ictimai səhifə **/search** (müəllim xəritəsi) və **/login** (landing).

İstəyə görı: GA4 `VITE_GA_MEASUREMENT_ID`, blog/məqalə səhifələri, Search Console performans izləmə.
