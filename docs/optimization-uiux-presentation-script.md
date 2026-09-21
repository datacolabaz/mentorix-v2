# Mentorix: Bundle Optimization və UI/UX Refactoring
## Təqdimat skripti və deployment runbook-u

**Təqdimat müddəti:** 6–8 dəqiqə  
**Auditoriya:** Product, engineering və operations komandaları  
**Status:** Kod dəyişiklikləri lokal repository-də hazırlanıb; production deploy hələ icra edilməyib.

## 1. Açılış — məqsəd və nəticə

Salam. Bu təqdimatda Mentorix-də üç paralel işi yekunlaşdırıram: frontend bundle ölçüsünün azaldılması, instructor workspace navigation-un məhsul məqsədlərinə görə yenidən qurulması və public instructor profilinin ilk viewport conversion axınının gücləndirilməsi.

Əsas nəticə budur: tətbiq sıfırdan yazılmadan ilkin JavaScript yüklənməsi təxminən 4.3 MB-dan 1.0 MB-a endirilib. Profil səhifəsində qiymət, availability və əsas booking CTA-ları eyni qərar blokunda görünür. Sidebar isə texniki modulların əvəzinə istifadəçinin gündəlik iş modelinə uyğunlaşdırılıb.

## 2. Problem — əvvəlki vəziyyət

Əvvəlki frontend quruluşunda çoxsaylı səhifələr `App.jsx` daxilində static import olunurdu. Nəticədə istifadəçi yalnız bir route-a daxil olsa belə, admin, student, instructor, organization, live lesson və presentation modullarının əhəmiyyətli hissəsi ilkin bundle-a daxil olurdu.

Build ölçüsü təxminən 4.32 MB idi və gzip-dən sonra 1.20 MB təşkil edirdi. Bu, xüsusilə mobil istifadəçilər üçün first load müddətini və interaction-a qədər olan vaxtı artırırdı.

İkinci problem instructor sidebar-ın texniki struktur göstərməsi idi. `Management`, `Materials`, `Analytics` və `System` bölmələri daxili modul sərhədlərini izah edirdi, lakin müəllim üçün növbəti əsas işi aydın göstərmirdi.

Üçüncü problem public instructor profilində əsas conversion məlumatlarının parçalanması idi. Qiymət və availability ilk viewport-da kifayət qədər dominant deyildi. İstifadəçi sınaq dərsi və əlaqə addımlarına keçməzdən əvvəl daha çox scroll etməli olurdu.

## 3. Həll — route-level code splitting

Birinci dəyişiklik `frontend/src/App.jsx` faylında tətbiq edildi. Page-level komponentlər `React.lazy()` ilə dinamik import olunur. Route ağacı `Suspense` ilə əhatə edilir və chunk yüklənərkən lokalizə edilmiş loading vəziyyəti göstərilir.

Bu yanaşma shell komponentlərini eager saxlayır. Layout, auth state və əsas provider-lər dərhal mövcud olur. Ağır və ya nadir istifadə olunan səhifələr isə yalnız həmin route açıldıqda yüklənir.

Named export verən organization modulları üçün ayrıca lazy wrapper-lər yaradılıb. Beləliklə, route-lar davranışını saxlayır, lakin ilkin bundle-a məcburi daxil olmur.

### Ölçülə bilən nəticə

| Göstərici | Əvvəl | Sonra |
|---|---:|---:|
| Əsas JS bundle | 4.32 MB | 1.02 MB |
| Əsas JS gzip | 1.20 MB | 343.67 kB |
| Public instructor profile | əsas bundle daxilində | 21 kB route chunk |
| Build | uğurlu | uğurlu, 15.57 saniyə |

Bu, ilkin JS yükündə təxminən 76% raw və təxminən 71% gzip azalma deməkdir.

## 4. Həll — instructor sidebar IA

İkinci dəyişiklik `frontend/src/constants/instructorNav.jsx` faylında edildi. Instructor navigation artıq beş məhsul qrupuna normallaşdırılır:

- **Bu gün:** dashboard, cədvəl, qoşulma sorğuları və canlı dərslər;
- **Tədris:** qruplar, tələbələr, tapşırıqlar, imtahanlar, AI generator, təqdimatlar və materiallar;
- **Əlaqə:** axtarış müraciətləri və bildirişlər;
- **Nəticələr:** davamiyyət, sertifikatlar və analitika;
- **Biznes:** ödənişlər və tənzimləmələr.

Əhəmiyyətli məqam budur ki, bu, yalnız default görünüşə tətbiq edilmir. Serverdən gələn köhnə navigation configuration da client tərəfində bu beş məhsul qrupuna normallaşdırılır. Beləliklə, mövcud admin konfiqurasiyası saxlanır, lakin istifadəçinin gördüyü struktur daha aydın olur.

Mentor workspace üçün mövcud ayrıca navigation modeli qorunub.

## 5. Həll — public instructor profile

Üçüncü dəyişiklik `frontend/src/pages/public/PublicInstructorProfile.jsx` faylında edildi.

Profilin ilk viewport-u artıq iki əsas hissədən ibarətdir. Sol tərəfdə müəllimin kimliyi, subject, rating, verification və təcrübə məlumatları var. Sağ tərəfdə isə qərar və hərəkət paneli yerləşir.

Bu paneldə saatlıq qiymət, növbəti boş vaxt və availability statusu görünür. Backend cavabında cavab müddəti varsa, o da göstərilir. Əsas CTA sınaq dərsi müraciətidir. WhatsApp isə ikinci əlaqə seçimi kimi saxlanılıb.

Backend-də availability və response time sahələri olmadıqda səhifə boş qalmır. Fallback mətnləri istifadəçiyə availability üçün müraciət etməyi bildirir.

## 6. API contract yoxlaması

Bu dəyişikliklər backend endpoint-lərinin formasını dəyişmir. Navigation dəyişiklikləri yalnız client-side presentation və grouping qatındadır. Profil dəyişiklikləri artıq mövcud olan public instructor response sahələrini oxuyur.

Backend test suite ilk icrada uğursuz oldu, lakin səbəb kod müqaviləsi deyildi. Lokal mühitdə backend `node_modules` qovluğu yox idi və `pg` modulu tapılmırdı. Dependency installation tamamlandıqdan sonra test suite yenidən icra edilməlidir. Final nəticə deployment-dan əvvəl test output-u ilə qeyd olunmalıdır.

## 7. Production deployment planı

### 7.1. Branch və pull request

Dəyişiklikləri ayrıca branch-də commit edin:

```bash
git checkout -b feat/performance-ia-profile-conversion
git add frontend/src/App.jsx \
  frontend/src/constants/instructorNav.jsx \
  frontend/src/pages/public/PublicInstructorProfile.jsx \
  frontend/api/health.js \
  frontend/api/share-html.js \
  frontend/vercel.json
git commit -m "feat: split routes and improve instructor conversion flow"
git push -u origin feat/performance-ia-profile-conversion
```

Pull request təsvirində build ölçülərini və smoke-test nəticələrini əlavə edin. Bu repository üçün GitHub connector aktiv olmadığından branch push və PR yaradılması bu runbook-un operator addımıdır.

### 7.2. Vercel project settings

Vercel project-in **Root Directory** dəyəri `frontend` olmalıdır. Build command `npm run build`, install command `npm ci`, output directory isə `dist` olmalıdır.

Production environment variables bölməsində aşağıdakı dəyişən təyin olunmalıdır:

```text
MENTORIX_API_ORIGIN=https://api.edupanel.co
```

Bu dəyişən `frontend/api/health.js` və server-rendered SEO handler tərəfindən istifadə olunur. Dəyişənin yalnız Production environment üçün deyil, Preview üçün də test məqsədilə ayrıca təyin edilməsi tövsiyə olunur.

Deploy Vercel dashboard-dan və ya CLI ilə edilə bilər:

```bash
cd frontend
npm ci
npm run build
vercel --prod
```

CLI istifadə olunursa, əvvəlcə düzgün Vercel project-ə link verildiyini yoxlayın. Production deploy-dan əvvəl Preview deployment-da smoke test aparın.

### 7.3. Vercel smoke tests

Deploy-dan sonra aşağıdakı yoxlamalar aparılmalıdır:

```bash
curl -i https://mentorix.io/api/health
curl -s https://mentorix.io/teachers/<real-instructor-uuid> | grep -E '<title>|canonical|og:url|application/ld\+json'
curl -sI https://mentorix.io/search
```

Health endpoint 200 qaytarmalı və upstream statusunu göstərməlidir. Teacher profile HTML response-unda fərdi title, canonical URL, Open Graph URL və `Person` JSON-LD olmalıdır. Real UUID istifadə olunmalıdır; numeric ID backend tərəfindən qəbul edilmir.

Brauzerdə əlavə yoxlama aparılmalıdır:

1. `/` açıldıqda yalnız landing chunk-ları yüklənməlidir.
2. `/teachers/<uuid>` açıldıqda public profile chunk-u yüklənməlidir.
3. Auth tələb edən instructor route-a keçiddə Suspense fallback göstərilməlidir.
4. Sidebar beş yeni qrup ilə görünməlidir.
5. Sınaq dərsi CTA-sı auth modalını və ya inquiry modalını açmalıdır.

### 7.4. Rollback planı

Əgər health endpoint yenə 503 qaytarırsa, əvvəlcə Vercel Production environment-də `MENTORIX_API_ORIGIN` dəyərini yoxlayın və redeploy edin. Əgər frontend runtime problemi yaranırsa, Vercel deployment history-dən əvvəlki stabil deployment-a rollback edin. Backend deploy bu frontend dəyişiklikləri üçün tələb olunmur; backend test suite yalnız contract regression yoxlaması üçündür.

## 8. Bağlanış

Nəticə olaraq, dəyişikliklər məhsulu yenidən yazmadan üç əsas problemi həll edir. İlkin frontend yükü nəzərəçarpacaq dərəcədə azalıb. Instructor sidebar texniki modul xəritəsindən gündəlik fəaliyyət xəritəsinə çevrilib. Public profile isə qiymət, availability və əsas booking hərəkətlərini ilk viewport-da birləşdirir.

Növbəti ölçüləcək metriklər first contentful interaction, route chunk error rate, instructor inquiry conversion, trial request completion və sidebar-dan ilk faydalı hərəkətə qədər keçən vaxtdır.

## References

[1]: https://github.com/datacolabaz/mentorix-v2 "Mentorix v2 repository"
[2]: https://vercel.com/docs/deployments/overview "Vercel deployments overview"
[3]: https://vercel.com/docs/project-configuration/vercel-json "Vercel project configuration"
[4]: https://react.dev/reference/react/lazy "React lazy reference"
