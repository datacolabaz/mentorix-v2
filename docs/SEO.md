# Mentorix SEO (mentorix.io)

## Artıq layihədə (kod)

- `frontend/public/robots.txt` — panel yolları `Disallow`, `/login` və `/search` `Allow`
- `frontend/public/sitemap.xml` — `/`, `/login`, `/search` (+ `lastmod`)
- `frontend/public/google83ecddbedfa0e978.html` — Search Console HTML doğrulama
- `frontend/index.html` — meta description, canonical, Open Graph, JSON-LD `WebSite`
- `frontend/src/lib/pageSeo.js` — login və axtarış səhifələrində dinamik title/description

---

## Search Console — sitemap və indeksləmə (5 dəqiqə)

**Property:** `https://mentorix.io/` (URL prefix, doğrulanmış olmalıdır)

### 1. Sitemap göndərin

1. [Google Search Console](https://search.google.com/search-console) açın
2. Sol menyudan **Sitemaps** (və ya **Indexing → Sitemaps**)
3. **Add a new sitemap** / **Yeni sitemap əlavə et**
4. Yalnız bu hissəni yazın (tam URL yox): `sitemap.xml`
5. **Submit** / **Göndər**
6. Bir neçə dəqiqə sonra status **Success** olmalıdır (bəzən 1–2 gün “Pending” qala bilər)

Tam URL: `https://mentorix.io/sitemap.xml`

### 2. `/search` üçün indeksləmə sorğusu

1. Sol üstdə **URL inspection** (URL yoxlaması)
2. Qutu: `https://mentorix.io/search` → Enter
3. **URL is not on Google** görsəniz → **Request indexing** / **İndeksləmə sorğusu**
4. Eyni addımı `https://mentorix.io/login` üçün təkrarlayın (istəyə görı)

Gündə çox sorğu göndərməyin — əsas səhifə **/search**-dir.

### 3. Nəticəni yoxlayın (1–7 gün sonra)

Google-da axtarın:

```
site:mentorix.io
```

və ya

```
site:mentorix.io/search
```

Search Console → **Pages** / **Performance** — trafik və indekslənmiş URL-lər görünəcək.

---

## Qeydlər

- Əsas tətbiq (müəllim/tələbə paneli) giriş tələb edir; indeks üçün ən vacib ictimai səhifə **/search** (müəllim xəritəsi) və **/login** (landing).
- Doğrulama **HTML file** ilə edilib; DNS TXT lazım deyil.
- İndeksləmə = Google-da görünmək; yüksək sıra (“repetitor Bakı”) ayrıca məzmun və vaxt tələb edir.

İstəyə görı: GA4 `VITE_GA_MEASUREMENT_ID`, blog/məqalə səhifələri.
