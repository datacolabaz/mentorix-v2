# Sual Bankı və İmtahan Sistemi — mərhələ 1 (database)

Bu dəyişiklik **yalnız schema** hazırlayır. Yeni API, frontend, avtomatik
qiymətləndirmə alqoritmi, PDF-dən AI çıxarışı və production migration icrası daxil deyil.
Mövcud təşkilat `/course/questions` görünüşü dəyişmir.

## Mövcud modellərlə uyğunluq

| İstənilən model | Saxlanma |
| --- | --- |
| Subject | Mövcud `instructor_subjects` (müəllimə məxsus fənn) |
| Topic | `question_bank_topics`; eyni fənn/müəllim daxilində parent/alt-mövzu |
| Question | `bank_questions`; 9 canonical tip, çətinlik, bal, açar, izahat, mənbə, status |
| QuestionOption | `question_options`; sabit UUID, mətn, düzgünlük, sıra, əlavə display məlumatı |
| QuestionBank | `question_banks` + `question_bank_items`; kolleksiya və saxlanmış filter |
| SourcePDF | `source_pdfs` → mövcud `course_materials` + `course_material_blobs` |
| Exam | Mövcud `exams` + `exam_bank_settings` |
| ExamQuestion | Mövcud `exam_questions` + `exam_bank_questions` (sabit, private nüsxə) |
| ExamAttempt | Mövcud `exam_results` + `exam_attempt_details` (bal və shuffle nüsxəsi) |
| ExamAnswer | `exam_answers`; manual feedback və qiymətləndirmə statusu |
| Fayl cavabı | `exam_answer_files`; private BYTEA, maksimum 25 MiB |

Mövcud `exam_student_progress` tələbə × imtahan aqreqatı olaraq qalır.
İkinci `users`, `exams`, `exam_attempts` və ya alternativ login sistemi yaradılmır.

SourcePDF-nin `file_url` və `file_name` sahələri API-də `course_materials.file_url`
və `COALESCE(original_filename, title)` ilə oxunacaq. Fayl ikinci dəfə saxlanmır və
avtomatik tələbəyə paylaşılmır. Mənbə PDF ilə imtahan attachment-i fərqli anlayışlardır.
PDF səhifə sayı/sərhəd yoxlaması gələcək upload API-də olacaq; DB `source_page > 0`
və mənbə əlaqəsini qoruyur.

## Uyğunluq və təhlükəsizlik

- Köhnə cədvəllərin sütunları, enum/CHECK-ləri və məlumatları dəyişmir.
  Yalnız composite FK-lər üçün 5 əlavə unikal indeks yaradılır.
- Fənn, mövzu, mənbə, kolleksiya və exam linkləri müəllim scope-unu composite
  foreign key ilə qoruyur. Bir müəllimin ID-sini digərinin məlumatı ilə qoşmaq mümkün deyil.
- Parent mövzu eyni fənnə/müəllimə aiddir. Cycle yoxlaması eyni fənnin tree
  redaktələrini transaction advisory lock ilə seriallaşdırır (adi READ COMMITTED).
- İstifadədə olan fənn/mövzu/mənbə/bank sualının fiziki silinməsi məhdudlaşdırılır.
  İstifadədə olan sual üçün `archived` tətbiq edilməlidir.
- Mənbə materialı müəllimə məxsus `application/pdf` olmalıdır. URL və MIME
  məlumatına etibar edib təhlükəsizlik yoxlamasını buraxmaq olmaz: API upload zamanı
  faylın məzmununu da yoxlamalıdır.
- Bankın sonrakı redaktəsi `exam_bank_questions.snapshot`-ı yeniləmir.
  Snapshot-da `question_text`, `question_type`, `answer_key`, `options` tələb olunur;
  `explanation` və mənbə metadata-sı da builder tərəfindən kopyalanmalıdır.
- `exam_bank_questions.points` artıq override tətbiq edilmiş imtahan balıdır.
  `Exam.total_points` həmin sətirlərin cəmi kimi hesablanır; stale cəmi saxlamaq üçün
  ikinci sütun yaradılmır. Vaxt/müddət/status `exams`-in mövcud sahələrində qalır.
- `exam_attempt_details.max_score` başlanğıcdakı cəmə bərabər olmalıdır.
  `raw_score` absolute baldır; mövcud `exam_results.score` semantikası dəyişdirilmir.
- Cəhdin sual sırası hər exam sualını yalnız bir dəfə ehtiva edir. `option_order`
  sual UUID → sabit option UUID siyahısı şəklində API tərəfindən doldurulacaq.
- `open_answer`/`file_upload` üçün `auto_graded` DB səviyyəsində qadağandır.
  Autosave `answered`, submit `pending_review`, müəllim təsdiqi `reviewed` yazmalıdır.
  Bu cavablar mövcud AI grading növbəsinə qoşulmamalıdır.
- Fayl blobunu yalnız cəhdin tələbəsi `file_upload` sualına bağlaya bilər.
  Fayl ölçüsü BYTEA ilə tutuşdurulur. API deadline, finalizasiya və fayl təhlükəsizliyi
  yoxlamalarını ayrıca etməlidir.

## Növbəti backend mərhələsi üçün vacib sərhədlər

Schema özü istifadəçi səlahiyyəti vermir və qiymətləndirmə alqoritmi deyil.
Yeni endpoint-lər mövcud `authenticate`/`authorize`, müəllim ownership,
qrup/tələbə təyinatı və storage quota middleware-lərindən istifadə etməlidir.
İndiki mərhələdə bu cədvəllərə istifadəçi trafiki yazılmamalıdır.

1. Bütün type-specific answer-key/option strukturları publish vaxtı yoxlanmalıdır
   (tək/çox seçim, qəbul edilən qısa/numeric cavablar, matching və ordering).
2. Exam builder bir transaction-da settings, köhnə uyğun question sətirləri və
   private snapshot-ları yaratmalıdır. Köhnə `closed/open/multiple/sequence` adları
   ilə yeni canonical tiplər arasında adapter API/renderer hazır olanda qurulmalıdır.
3. Cəhd başladıqdan sonra exam/snapshot redaktəsi bağlanmalıdır; bank redaktəsi sərbəstdir.
   Başlatma/submit/autosave eyni cəhd üzrə row lock və mövcud deadline qaydasını saxlamalıdır.
4. Student payload-ları explicit allowlist ilə qurulmalıdır. `answer_key`,
   `is_correct` option-ları, source PDF və tam snapshot tələbəyə imtahan zamanı verilməməlidir.
5. Auto/manual grading cavabları, cəhdin raw/legacy balı və progress aqreqatı eyni
   transaction-da yenilənməlidir. Nəticə görünüşündə mövcud release qaydaları saxlanmalıdır.
6. AZ/EN/RU UI, filtrlər, səhifələmə və mövzu/tip analitikası sonrakı mərhələlərdir.

## Migration və rollout

`backend/src/models/migrations/236_question_bank_foundation.sql` mövcud runner-in
transaction-ında işləyir; ayrıca BEGIN/COMMIT və data backfill yoxdur. Təkrar
tətbiq edilə bilir. Mövcud `schema.sql` tarixi baseline olaraq dəyişdirilməyib.

Bu branch production-a merge/deploy edilməyib. Mövcud `npm start` migration-ları
avtomatik işlətdiyi üçün merge/deploy-dan əvvəl migration staging-də yoxlanmalıdır.
Yeni indekslər iri cədvəlləri skan edə bilər; böyük bazada maintenance pəncərəsi
və ya eyni adlı/eyni tərifli indekslərin əvvəlcədən `CREATE UNIQUE INDEX CONCURRENTLY`
ilə hazırlanması planlanmalıdır. `CONCURRENTLY` migration transaction-ına yazılmamalıdır.

Manual rollback:
`backend/scripts/sql/rollback/236_question_bank_foundation.sql`.
Bu script **yeni modulun məlumatlarını və tələbə fayllarını silir**. Əvvəl API/UI
geri alınmalı, lazım olan məlumat export edilməli və operator təsdiqi alınmalıdır.
Köhnə fənn, material, imtahan, sual və nəticə sətirləri saxlanır.

## Yoxlama

```sh
cd backend
node --test src/models/questionBankSchema.test.js
# Yalnız ayrıca LOCAL test bazası; production DATABASE_URL istifadə edilmir:
TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" node --test src/models/questionBankSchema.test.js
```

Test dependency əlavə etmir; Node built-in test runner və `psql` istifadə edir.
İnteqrasiya testi minimal legacy boundary fixture ilə unikal schema yaradır,
migration-u iki dəfə tətbiq edir, constraint/tenant/type/manual-review/shuffle
və legacy-data yoxlamaları aparır, rollback + reinstall edir, sonda bütün test
transaction-ını geri alır. Bu, layihənin bütün tarixi migration chain-inin
production məlumatları üzərində test edilməsi və ya API/UI testi demək deyil.
