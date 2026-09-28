# Sosial paylaşım və WhatsApp link preview sistemi

Brend adı konfiqurasiyadan gəlir (`BRAND_NAME`, default **Mentorix**). Nümunələrdə `{Brand}` yazılıb.

Paylaşılan hər public link WhatsApp, Telegram, Facebook, LinkedIn, Discord, Slack,
iMessage və s. platformalarda brendli, dinamik preview kartı ilə görünür. Preview kartı
1200×630 PNG şəkildir: sol hissə sabit brend zonası (ad `BRAND_NAME`-dən gəlir, default Mentorix), sağ hissə linkin məlumatıdır.

WhatsApp kartın öz yerləşimini (mətn, şəkil ölçüsü) özü idarə edir. "Brend solda"
qaydası **şəklin içində** tətbiq olunur. Bəzi WhatsApp versiyaları kiçik kvadrat thumbnail
göstərir və şəklin mərkəzini kəsir. Bu halda əsasən sağ hissədəki başlıq görünür, amma
`og:site_name` və `og:title` yenə də brend adını daşıyır.

## 1. Memarlıq

```text
Crawler (WhatsApp/…) ──► Vercel rewrite (vercel.json)
                              │
                              ▼
                 api/share-html.js  ──► GET {API}/api/public/share-preview?path=/exam/<id>
                              │               (backend allowlist + privacy qaydaları)
                              ▼
         index.html + server-side <title>, description, canonical, og:*, twitter:*
                              │
                              └── og:image = {site}/api/og?path=/exam/<id>&v=<version>
                                                  │
                                                  ▼
                                   api/og.js (Satori → PNG, Inter şrifti)
                                   yenə eyni backend endpoint-dən oxuyur
```

| Hissə | Fayl | Vəzifə |
|---|---|---|
| Qaydalar (təmiz funksiyalar) | `backend/src/services/sharePreviewRules.js` | allowlist, mətn şablonları, tarix formatı, kəsmə, versiya |
| Data oxuma | `backend/src/services/sharePreviewService.js` | hər tip üçün yalnız icazəli sütunları oxuyur |
| Endpoint | `GET /api/public/share-preview?path=` | JSON: `title`, `description`, `canonical_path`, `card`, `version` |
| HTML meta | `frontend/api/share-html.js` | bütün köhnə meta tag-ları silib vahid blok yazır |
| Şəkil | `frontend/api/og.js` | 1200×630 PNG, 25–60 KB |
| Ümumi köməkçilər | `frontend/api/_lib/sharePreview.js` | fetch, fallback, meta injeksiyası |
| Statik fallback | `frontend/public/og-default.png` | JS/backend işləməsə ana səhifə şəkli |

Meta tag-lar **ilkin HTML cavabında** gəlir. Crawler JavaScript icra etməsə də preview işləyir.

### Şəkil URL-i niyə yalnız `path` qəbul edir

`/api/og` mətni query string-dən götürmür, yalnız allowlist-dəki path-i qəbul edir və məlumatı
backend-dən özü oxuyur. Beləliklə, heç kim bizim brendimizlə istədiyi mətni yazıb saxta
kart yarada bilməz.

## 2. Marşrut qaydaları (allowlist)

| Link | Tip | `og:title` | `og:description` | Kartın sağ hissəsi |
|---|---|---|---|---|
| `/` | home | {Brand} — İmtahan, qiymətləndirmə və nəticə analizi | Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması. | Tagline + təsvir |
| `/exam/:id` | exam | İmtahana dəvət — {examTitle} | {fənn} · {N} sual · {M} dəqiqə | İmtahana dəvət, ad, fənn, sual/vaxt, gələcək başlama tarixi |
| `/task/:id` | task | Yeni tapşırıq — {title} | Son tarix: {tarix} | Yeni tapşırıq, ad, son tarix |
| `/library/material/:id`, `/m/:token` | material | Yeni material — {title} | {PDF/Video/…} · {fənn} | Yeni tədris materialı, ad, tip |
| `/live/join/:token`, `/lr/:token` | live | Canlı dərs — {title} | {tarix} · {saat} | Canlı dərs / Canlı dərs yazısı |
| `/join/:code`, `/library/:groupId` | group | {Brand} qrupuna dəvət | {qrup} qrupuna qoşulun | Qrupa dəvət, qrup adı, fənn, public müəllim adı |
| `/teachers/:id` | teacher | {ad} — {Brand} müəllim profili | {fənlər} üzrə imtahanlar, materiallar və tapşırıqlar | Ad, fənlər, təcrübə və ya bio-nun ilk cümləsi |
| `/sertifikatli-imtahanlar/…` | certified | {ad} — Sertifikatlı imtahan | QR kodu ilə doğrulanan sertifikat · Keçid balı | Sertifikatlı imtahan |
| `/c/:token` | certificate | {Brand} sertifikatı | Sertifikatı doğrulamaq üçün linki açın. | Generic |
| `/student/*`, `/parent/*` | result | {Brand} nəticəsi | Nəticənizi təhlükəsiz şəkildə görüntüləmək üçün linki açın. | Generic |

Qeydlər:
- Allowlist-də olmayan bütün path-lər ana səhifə kartını alır.
- Entity tapılmasa, silinibsə və ya müddəti bitibsə (məsələn, dəvət kodu, guest link, ləğv olunmuş canlı dərs), həmin tipin generic kartı göstərilir. Başlıq və ID göstərilmir.
- `/`, `/sertifikatli-imtahanlar`, `/student/*` və `/parent/*` yalnız crawler User-Agent-i gələndə serverless funksiyaya yönləndirilir. Adi istifadəçilər statik SPA-nı alır, ona görə performansa təsir yoxdur.
- `/student/*` və `/parent/*` üçün kanonik URL həmişə `/student` və ya `/parent` olur. Alt-path (məsələn, imtahan ID-si) preview-a düşmür.

## 3. Privacy qaydaları

Preview-a yalnız `sharePreviewService.js` içində açıq şəkildə seçilmiş sütunlar düşə bilər.

Heç vaxt göstərilməyənlər:
- tələbə adı, balı, faizi, səhv və ya düzgün cavabları, müəllim qeydləri;
- nəticə səhifələrində qrup adı və imtahanın adı;
- müəllimin telefonu, emaili, tələbə sayı, private qrupları;
- dəvət kodu, access code, token, daxili ID. Bunlar yalnız linkin özündə (`og:url`) qalır, çünki link onsuz açılmaz.

Başqa qaydalar:
- Qrup kartında müəllim adı yalnız müəllimin public profili açıqdırsa (`map_visible`) göstərilir.
- İmtahanın başlama tarixi yalnız gələcəkdədirsə göstərilir.
- Nəticə və sertifikat tipləri bazadan heç nə oxumur.

Testlər: `backend/src/services/sharePreviewRules.test.js`. Test sızma yoxlaması aparır: ad, bal, qrup və token preview mətnində olmamalıdır.

## 4. Şəkil şablonu

- Kətan: 1200×630 (1.91:1), PNG, adətən 25–60 KB.
- Fon: tünd göy `#0B1733`. Brend zonası: `#081028`, eni 420 px, sağında nazik ayırıcı xətt.
- Sol hissə: ◉ loqo işarəsi, brend adı (Inter 800, 60 px), `BRAND_PREVIEW_TAGLINE` (default "İmtahan • Nəticə • Analitika") və aşağıda domen.
- Sağ hissə:
  - yaşıl etiket (`eyebrow`);
  - başlıq, uzunluğa görə 60→40 px, maksimum 3 sətir və "…";
  - 2 əlavə sətir, hər biri maksimum 2 sətir;
  - aşağıda vaxt kimi vacib məlumat (footnote).
- Şrift: Inter latin + latin-ext (`@fontsource/inter`). Latin-ext ayrıca `InterExt` adı ilə yüklənir ki, ə, ğ, ş, ç, ö, ü, ı, İ bütün qalınlıqlarda düzgün çıxsın.
- Fallback: render alınmasa əvvəlcə generic kart, o da alınmasa `/og-default.png` (`npm run og:default` ilə yenidən yaradılır).

## 5. Keş və versiyalama

- `v` = `sha1(TEMPLATE_VERSION + kind + card + brand)`. Brend adı dəyişəndə də bütün şəkillər yenilənir. Başlıq, tarix və ya dizayn dəyişəndə URL dəyişir və crawler yeni şəkli çəkir.
- Versiyalı şəkillər: `s-maxage=31536000, immutable`. Fallback şəkillər: 5 dəqiqə.
- HTML: `s-maxage=300`, yəni dəyişiklik ən gec 5 dəqiqəyə görünür.
- Dizayn dəyişəndə `sharePreviewRules.js` içində `TEMPLATE_VERSION` artırılır.
- WhatsApp preview-u öz tərəfində keşləyir. Artıq göndərilmiş mesajdakı kart yenilənmir, yeni göndərilən mesajda yeni kart görünür.

## 6. Domen: mentorix.io → yeni domen

1. Vercel → Project → Settings → Domains bölməsində yeni domeni əlavə edin və DNS-i qurun.
2. `mentorix.io` üçün **Redirect to → yeni domen (308)** seçin. Vercel path və query-ni saxlayır, yəni `/exam/123?x=1` → `https://<yeni-domen>/exam/123?x=1`.
3. Vercel və Railway env: `PUBLIC_SITE_ORIGIN=https://<yeni-domen>`, `BRAND_NAME`, `BRAND_DOMAIN`. Sonra `BRAND_NAME=... npm run og:default` ilə statik şəkli yeniləyin.
4. Yenidən deploy edin.

Domen qoşulana qədər `PUBLIC_SITE_ORIGIN` boş qalmalıdır. O zaman `og:url` sorğunun gəldiyi host-u (`mentorix.io`) göstərir, şəkil URL-i isə həmişə sorğunun gəldiyi host-dan qurulur. Beləliklə, preview heç vaxt işləməyən domenə işarə etmir.

## 7. Test planı

| Yoxlama | Necə |
|---|---|
| Unit testlər | `cd backend && npm test`, `cd frontend && node --test api/_lib/sharePreview.test.js` |
| Server-side meta | `curl -A "WhatsApp/2.23" https://mentorix.io/exam/<id> \| grep og:` |
| Şəkil | `og:image` URL-ini brauzerdə açın: 1200×630 PNG olmalıdır |
| Facebook / WhatsApp / Instagram | https://developers.facebook.com/tools/debug/. "Scrape Again" düyməsi Meta keşini yeniləyir |
| LinkedIn | https://www.linkedin.com/post-inspector/ |
| Telegram | @WebpageBot-a linki göndərin (keşi yeniləyir) |
| Slack, Discord, iMessage | Linki özünüzə göndərin |
| WhatsApp | Linki özünüzə və ya test qrupuna göndərin. Linkə `?v=2` əlavə etsəniz, WhatsApp onu yeni link kimi yenidən çəkir |
| Şəkilsiz / tapılmayan entity | `/exam/<olmayan-uuid>` → generic "İmtahana dəvət" kartı |
| Uzun başlıq | 120+ simvollu imtahan adı → 3 sətir + "…" |
| Azərbaycan hərfləri | ə ğ ş ç ö ü ı İ, qalın və adi şriftdə |
| Nəticə privacy | `/student/exams/...` crawler UA ilə → yalnız "{Brand} nəticəsi" |
| Köhnə linklər | domen keçidindən sonra `curl -I https://mentorix.io/exam/<id>` → 308 yeni domen |
| Keş yenilənməsi | imtahan adını dəyişin, 5 dəqiqə gözləyin → `v=` dəyişməlidir |

## 8. Nümunə metadata

```text
/                     Mentorix — İmtahan, qiymətləndirmə və nəticə analizi
                      Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması.
/exam/<id>            İmtahana dəvət — Riyaziyyat — Faizlər
                      Riyaziyyat · 20 sual · 30 dəqiqə          (kartda: Başlama: 29 sentyabr, 19:00)
/task/<id>            Yeni tapşırıq — Esse yaz
                      Son tarix: 5 oktyabr
/library/material/<id> Yeni material — Düsturlar
                      PDF · Cəbr
/live/join/<token>    Canlı dərs — Həndəsə
                      29 sentyabr · 19:00
/join/<code>          Mentorix qrupuna dəvət
                      11-ci sinif qrupuna qoşulun
/teachers/<id>        Günel Əliyeva — Mentorix müəllim profili
                      Kimya üzrə imtahanlar, materiallar və tapşırıqlar
/student/...          Mentorix nəticəsi
                      Nəticənizi təhlükəsiz şəkildə görüntüləmək üçün linki açın.
```
