# Sual Bankı — mərhələ 2: API və qiymətləndirmə

Frontend bu mərhələyə daxil deyil. Baza `/api/question-bank`-dır; mövcud
Bearer JWT, aktiv hesab yoxlaması və `instructor`/`admin`/`student` rolları işləyir.
Yeni login, istifadəçi, imtahan və ya ikinci attempt sistemi yoxdur.
Schema üçün [database sənədinə](question-bank-database.md) baxın.

## Səlahiyyət və cavab formatı

- Müəllim və admin yalnız **öz** fənn, mənbə, sual, kolleksiya, imtahan və
  həmin imtahanların nəticələrini idarə edir. Admin avtomatik başqa müəllimi təqlid etmir.
- Tələbə yalnız ona təyin edilmiş imtahanı başlayır və öz cəhd/fayl/nəticəsini oxuyur.
- Müəllim yazıları mövcud aktiv abunə yoxlamasından keçir. İmtahan yaratma
  mövcud telefon təsdiqi və imtahan limiti ilə qorunur.
- JSON cavablarında `success: true` olur; siyahı/obyekt açarları aşağıdadır.
  Səhvdə `{success:false, code, message}` qaytarılır. Ownership pozuntusu 404,
  validation 400, role 403, state/əlaqə konflikti 409-dur. Fayl və quota xətaları
  413 ola bilər. SQL mətni və daxili stack tələbəyə göndərilmir.
- Cavablar `private, no-store` və `nosniff` ilə gəlir. UUID-lər və ISO 8601
  tarixləri istifadə edilir; tarixdə saat qurşağı (`Z` və ya offset) məcburidir.
- Səhifələmə `limit` (1–100, default 25) və `offset` (0–1,000,000) ilədir.
  PostgreSQL `NUMERIC` aqreqatları/bəzi müəllim metadata sahələri JSON-da string
  ola bilər; frontend onları rəqəmə çevirərək formatlamalıdır.

## Müəllim endpoint-ləri

| Metod və yol | Body / query | JSON açarı |
| --- | --- | --- |
| `GET /meta` | bütün 3 rol üçün | `question_types`, `schema_version`, `max_file_bytes`, `max_question_count` |
| `GET /subjects` | — | `subjects` |
| `POST /subjects` | `name` | `subject` |
| `GET /topics` | `subject_id?` | `topics` |
| `POST /topics` | `subject_id`, `name`, `parent_topic_id?` | `topic` |
| `PUT /topics/:id` | `subject_id`, `name`, `parent_topic_id?` | `topic` |
| `DELETE /topics/:id` | istifadə olunan əlaqə varsa 409 | — |
| `POST /sources` | `material_id`, `subject_id` | `source` |
| `GET /sources` | `subject_id?`, səhifələmə | `sources` |
| `GET /sources/:id/file` | müəllimə məxsus PDF | binary PDF |
| `GET /questions` | aşağıdakı filtrlər | `items`, `total`, `limit`, `offset` |
| `POST /questions` | tam sual obyekti | `question` |
| `GET /questions/:id` | — | `question` |
| `PUT /questions/:id` | tam əvəzləmə, PATCH deyil | `question` |
| `DELETE /questions/:id` | fiziki silmir, `archived` edir | — |
| `GET /banks` | səhifələmə | `banks` |
| `POST /banks` | `name`, `description?`, `saved_filters?` | `bank` |
| `PUT /banks/:id` | `name`, `description?`, `saved_filters?` | `bank` |
| `DELETE /banks/:id` | yalnız kolleksiyanı və üzvlüyünü silir; suallar qalır | — |
| `POST /banks/:id/items` | `question_ids: UUID[]` | — |
| `DELETE /banks/:id/items` | JSON `question_ids: UUID[]` | — |
| `GET /exams` | səhifələmə | `exams` |
| `POST /exams` | aşağıdakı builder body-si | `exam` |
| `GET /exams/:id` | private snapshot-lar, say/bal və təyinatlar | `exam` |
| `PATCH /exams/:id` | yalnız göndərilən sahələri dəyişir | `exam` |
| `DELETE /exams/:id` | soft archive; nəticələr DB-də qalır | — |
| `GET /exams/:id/results` | `pending_only=true?`, səhifələmə | `results` |
| `GET /exams/:id/attempts/:attemptId` | yalnız həmin imtahanın cəhdi | root result sahələri |
| `PATCH /exams/:id/attempts/:attemptId/answers/:questionId` | `awarded_points`, `teacher_feedback?` | root result sahələri |
| `GET /analytics` | `exam_id?` | `analytics` |

Sual filtrləri: `subject_id`, `topic_id`, `include_descendants` (default true),
`question_type`, `difficulty`, `teacher_id` (yalnız cari müəllim), `status`,
`bank_id`, `q` (mətn axtarışı). Status göndərilməyəndə arxiv sualları göstərilmir.
Kolleksiyanın saxlanmış filtri avtomatik tətbiq edilmir: frontend onu query-yə
çevirir; `bank_id` həmin kolleksiyaya faktiki əlavə edilmiş sualları seçir.
`saved_filters` yalnız `subject_id`, `topic_id`, `question_type`, `difficulty`,
`status`, `q`, `include_descendants` sahələrini saxlayır.

### PDF axını

1. Mövcud `POST /api/materials` multipart upload-u ilə private PDF yükləyin.
   Qrup/tələbə paylaşımı parametrlərini göndərməyin.
2. Material ID-si və eyni müəllim/fənn ilə `POST /sources` çağırın.
3. Qayıdan `file_url` mövcud Bearer auth ilə açılan yeni protected PDF yoludur.
   Viewer üçün authenticated fetch → Blob URL istifadə edin; JWT-ni URL-ə yazmayın.
4. PDF solda, sual forması sağda olacaq frontend sonrakı mərhələdir.

PDF ayrıca kopyalanmır. Byte signature və real PDF parse yoxlanır; maksimum
25 MiB və 10,000 səhifədir. Eyni materialı eyni fənnə təkrar qeyd etmək idempotentdir.
`source_page` real səhifə sayından böyük ola bilməz. Avtomatik AI çıxarışı yoxdur.

### Sual müqaviləsi

Ümumi body:

```json
{
  "subject_id": "<uuid>",
  "topic_id": null,
  "source_pdf_id": null,
  "source_page": null,
  "question_text": "Sualın mətni",
  "question_type": "true_false",
  "difficulty": "medium",
  "points": 2,
  "explanation": "Müəllimin izahatı",
  "answer_key": {"value": false},
  "options": [],
  "status": "published"
}
```

`difficulty`: `easy|medium|hard`; status: `draft|published|archived`.
Bal müsbət, maksimum 999999.99 və iki onluq dəqiqliklidir.
Option: `{id?:UUID, option_text:string, is_correct?:boolean, metadata?:object}`.
Sıra göndərilən array sırasıdır. Yeni sualın option UUID-ləri başqa bank sualının
option ID-ləri ilə təkrar istifadə edilməməlidir.

| Tip | `answer_key` | Tələbənin `answer_data` dəyəri |
| --- | --- | --- |
| `single_choice` | `{option_id: UUID}` | option UUID string |
| `multiple_choice` | `{option_ids: UUID[]}` | UUID array |
| `true_false` | `{value: boolean}` | boolean (`false` da cavabdır) |
| `short_answer` | `{accepted_answers: string[], case_sensitive?:boolean}` | string |
| `numeric` | `{accepted_values: number[], tolerance?:number}` | number və ya decimal string (`0` da cavabdır) |
| `matching` | `{pairs: {leftUUID:rightUUID}}` | eyni map, autosave zamanı natamam ola bilər |
| `ordering` | `{order: UUID[]}` | UUID array, autosave zamanı natamam ola bilər |
| `open_answer` | `{}` | string |
| `file_upload` | `{}` | upload endpoint-in saxladığı `{file_ids: UUID[]}` |

Single/multiple üçün açar boşdursa option-ların `is_correct` flag-lərindən
qurulur. Matching option-larında `metadata.side` `left|right` olmalıdır və açar
tam one-to-one xəritədir. Ordering açarı hər option-u bir dəfə ehtiva edir.
Bu tiplər üçün frontend əvvəl UUID yarada və ya draft saxlayıb qayıdan ID-lərlə
publish edə bilər. Draft açarsız saxlanıla bilər, amma natamam draft publish edilmir.

### İmtahan builder-i

```json
{
  "title": "Mövzu yoxlaması",
  "subject_id": "<uuid>",
  "question_ids": ["<published-own-question-uuid>"],
  "points_overrides": {"<question-uuid>": 3},
  "duration_minutes": 30,
  "available_from": "2026-11-01T10:00:00+04:00",
  "available_until": "2026-11-01T12:00:00+04:00",
  "allow_finish_after_until": true,
  "status": "scheduled",
  "exam_type": "exam",
  "shuffle_questions": true,
  "shuffle_options": true,
  "display_mode": "step",
  "result_visibility_mode": "after_manual_grading",
  "results_release_at": null,
  "student_ids": ["<own-active-student-uuid>"],
  "group_ids": ["<own-group-uuid>"]
}
```

- 1–500 özünə məxsus, eyni fənndən **published** sual; maksimum 2000 təyinat.
  Frontend filtr nəticəsindən konkret ID-ləri seçir. Say və ümumi bal serverdə
  həmin seçimdən hesablanır; client-in ayrıca `total_points` dəyərinə etibar edilmir.
- `duration_minutes` 1–1440; status `draft|scheduled` (default draft);
  `display_mode` `all|step`. Default result policy `after_manual_grading`-dir.
- Qrup üzvləri yaradılma/redaktə anında təyin edilir; sonrakı qrup dəyişiklikləri
  bu siyahını avtomatik yeniləmir. Mövcud link-access/late-access axını qala bilər.
- Builder exam/settings, legacy public placeholder, private snapshot və təyinatı
  bir transaction-da yazır. Bankın sonrakı redaktəsi snapshot-a təsir etmir.
- İlk cəhddən sonra struktur, sual, bal, vaxt, təyinat və shuffle dəyişiklikləri
  `QB_EXAM_FROZEN` verir. Yalnız `title`, `result_visibility_mode`,
  `results_release_at` dəyişə bilər. İmtahanın fənni həmişə sabitdir.
- Cəhddən əvvəl sual/bal dəyişmək üçün `question_ids`-i bütöv göndərin; override
  map-i yalnız onunla birgə işləyir. Təyinat göndərilirsə, yeni birləşmiş siyahı
  əvvəlkini əvəz edir.

## Tələbə endpoint-ləri

| Metod və yol | Body / nəticə |
| --- | --- |
| `GET /student/exams` | səhifələmə; `exams`, yalnız təyin edilmiş/əvvəl başladığı bank imtahanları |
| `POST /exams/:id/start` | `attempt`, `exam`, `questions`, `answers`, `files`, `server_time`; başlayır və ya eyni cəhdi davam etdirir |
| `GET /attempts/:id` | eyni təhlükəsiz runner forması; deadline keçibsə lazımi finalizasiya |
| `PATCH /attempts/:id/answers` | `{answers: {"<exam-question-id>": answer_data}}`; qismən autosave |
| `POST /attempts/:id/submit` | `{answers?: {...}, auto_submit?:boolean}`; idempotent finalizasiya |
| `GET /attempts/:id/result` | root result sahələri; release qaydasına görə score/breakdown gizlədilir |
| `POST /attempts/:id/answers/:questionId/file` | multipart, yalnız `file` sahəsi; `file` metadata |
| `DELETE /files/:id` | yalnız öz aktiv cəhdinin faylı |
| `GET /files/:id` | öz faylı və ya imtahanın sahibi müəllim; private attachment |

`questionId` burada **exam question ID**-dir, bank question ID-si deyil.
Runner yalnız açıq mətn, tip, bal, option ID/mətn/side, sabit sıralar və tələbənin
öz cavab/fayllarını verir. Açar, explanation, option `is_correct`, source PDF və
private snapshot göndərilmir. Yekunlaşmış runner sual/cavabları geri göndərmir;
nəticə üçün ayrıca result endpoint-i işlədilir.

Sual/variant sırası ilk start-da yazılır və resume-də dəyişmir. Matching və
ordering düzgün sıranı mövqedən açıqlamamaq üçün həmişə qarışdırılır.
Başlama/struktur redaktəsi exam row lock; save/submit/review isə eyni lock sırası
və attempt row lock ilə seriallaşdırılır. Paralel start/retry ikinci cəhd yaratmır.
Yeni retake siyasəti bu mərhələyə daxil deyil; mövcud void/late-access qorunur.

Deadline şəxsi müddətdir; `allow_finish_after_until=false` olduqda qlobal/tələbəyə
verilmiş gec giriş bitişi ilə məhdudlaşır. Mövcud 10 saniyə autosave tolerantlığı,
60 saniyə gecikmə grace-i saxlanır. Grace-dən sonra submit payload-ı qəbul
edilmir: yalnız əvvəl saxlanmış cavablar qiymətləndirilir. Cron da eyni finalizatoru
işlədir; cavabsız cəhd `expired`, cavablı cəhd auto-submitted olur.

### Qiymətləndirmə və görünüş

- Yeddi avtomatik tipdə tam düzgün cavaba tam bal, digərinə 0 verilir.
  Mənfi bal və avtomatik qismən bal yoxdur. Multiple choice set equality,
  matching tam xəritə, ordering dəqiq sıra ilə qiymətləndirilir.
- Short answer NFKC, whitespace və optional case normalization-dan sonra
  qəbul edilən cavabla **dəqiq** müqayisə edilir, substring/AI istifadə edilmir.
  Numeric qəbul edilən dəyərlərdən hər hansı birinə `tolerance` daxilində olmalıdır.
- `open_answer` və `file_upload` hətta boş olduqda `pending_review` qalır;
  AI növbəsinə girmir. Müəllim 0–sualın maksimum balı aralığında iki onluq
  dəqiqlikli bal və feedback verir. Avtomatik sualı bu endpoint-lə yenidən
  qiymətləndirmək olmaz.
- Cavablar, `raw_score`, legacy faiz `exam_results.score`, grading və
  `exam_student_progress` eyni transaction-da yazılır. Bir neçə manual cavabdan
  yalnız birinin yoxlanması pending state-i bağlamır. Notification hook-ları commit-dən sonradır.
- Attempt-in legacy status-u `completed` ola bilər, amma `grading_pending=true`
  və cavabın `pending_review` status-u UI-də gözləyən kimi göstərilməlidir.
  `raw_score/max_score` bal, `score` 0–100 faizdir.
- Mövcud `immediate_full_review`, `after_exam_window`, `after_manual_grading`,
  `score_only`, `wrong_answers_only` rejimləri serverdə tətbiq edilir.
  Score-only cavab/açar/feedback vermir; wrong-only yalnız bal itirilən sualları
  göstərir. Açar/izahat yalnız icazə verilən review-da gəlir.
  Köhnə result-mode feature flag-i bank imtahanının pending/delayed balını aça bilməz.
- Analitika hər tələbə/imtahanın son submitted, void edilməmiş cəhdindən hesablanır.
  Mövzu/tip üzrə answer, pending, mistake sayları və graded bal cəmi qaytarılır;
  pending cavablar səhv sayına qatılmır.

### Fayl cavabları

Bir suala bir fayl, maksimum 25 MiB; PDF, PNG, JPEG, UTF-8 TXT. MIME/extension-a
tək etibar edilmir, signature/text bytes yoxlanır; bu antivirus zəmanəti deyil.
İstifadəçi filename-i saxlanma/response header üçün istifadə edilmir.
Fayl yalnız aktiv cəhdin öz `file_upload` cavabına bağlanır, server file ID-ni
özü yazır. Başqa fayl ID-sini autosave ilə əlavə etmək mümkün deyil.

Bloblar private `exam_answer_files`-dadır; public upload URL-si yoxdur.
Replacement eyni transaction-da edilir: yeni fayl/quota yoxlaması uğursuzdursa
köhnə fayl/cavab qalır. Deadline/submit-dən sonra upload/delete bağlanır.
Müəllimin material/presentation quota hesabına bu faylların ölçü və sayı da
daxildir; tələbə faylları həmin müəllim üçün advisory lock altında seriallaşdırılır.
Mövcud müəllim material upload mexanizmi ayrıca işləyir, bütün köhnə upload
yollarına yeni qlobal concurrency zəmanəti əlavə edilməyib.

## Legacy uyğunluğu və frontend keçidi

`GET /api/exams/my` və müəllim siyahıları `question_bank_enabled` marker-i verir.
Frontend bu marker üçün yeni runner/builder/review-a yönəlməlidir.
Legacy question/submit/autosave/review/results/regrade/mutation endpoint-ləri bank
imtahanında `409 QUESTION_BANK_API_REQUIRED` və `api_base` qaytarır.
Bulk və PostgreSQL-in qəbul etdiyi alternativ UUID formaları da qorunur.
Adi köhnə imtahanlar əvvəlki axında qalır.

Legacy expiry və açıq sual AI işçisi bank cəhdlərini istisna edir.
Mövcud cron yeni bank finalizatorunu ayrıca çağırır. Yeni frontend qoşulana
qədər bu branch-i production-a buraxmayın: köhnə UI bank runner-i göstərə bilməz.
Ödəniş, token, görüş, təşkilat modulu və AI PDF extraction əlavə edilməyib.

## Yoxlama və rollout

```sh
cd backend
node --test src/services/questionBankRules.test.js
# Yalnız disposable LOCAL PostgreSQL; production DATABASE_URL istifadə etməyin.
env -u DATABASE_URL TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" npm test
```

`questionBankApi.db.test.js` localhost DB-də unikal schema yaradır, minimal legacy
boundary fixture + real 178/217/220/236 migration-ları tətbiq edir, həqiqi HTTP və
SQL transaction-ları yoxlayır, sonda schema-nı silir. User seçimi və ödəniş/telefon
gate-ləri testdə inject edilir: bu test production JWT/OAuth və billing
integration smoke-test-i deyil. Role və ownership qaydaları real işləyir.

Əhatə: 9 tip; PDF/page/filter/collection ownership; concurrent start/save/submit;
private/kvotalı fayl və uğursuz replacement; auto/manual bal; qismən review state-i;
deadline/sweep; release redaksiyası, o cümlədən legacy list və söndürülmüş flag;
legacy/AI bypass blokları; səhv daxil edilərək transaction rollback; analitika.

Yerli tam backend run-u: **774 test, 773 passed, 0 failed, 1 skipped**.
Skip mövcud dashboard parity testi üçündür (`DASHBOARD_PARITY_DATABASE_URL` verilməyib).
Bu, bütün tarixi migration chain-inin tam production clone-da yoxlanması,
deploy və ya UI E2E təsdiqi deyil.

Staging-də backup, mövcud məlumatla migration 236, real JWT/entitlement/storage
konfiqurasiyası və cron yoxlanmalıdır. Sonra ayrıca frontend branch-ında AZ/EN/RU
PDF editor, sual bankı, builder, runner, müəllim review və nəticə səhifələri
inteqrasiya edilməlidir. Main-ə merge, production migration və deploy edilməyib.
