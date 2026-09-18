# Mentorix Mentorluq Workspace Arxitekturası

**Müəllif:** Manus AI  
**Tarix:** 18 sentyabr 2026

## Məhsul qərarı

Mentor workspace sadə statistika paneli deyil. O, mentorluq münasibətinin tam həyat dövrünü idarə etməlidir: müraciətin qiymətləndirilməsi, gözləntilərin razılaşdırılması, ölçülə bilən məqsədin yaradılması, sessiyanın hazırlanması, qərar və öhdəliklərin qeyd edilməsi, nəticənin ölçülməsi və etik sərhədlərin qorunması.

Bu səbəbdən Mentorix-də müəllim modullarının adını dəyişib mentor menyusuna yerləşdirmək əvəzinə ayrıca mentor səhifələri və ayrıca məlumat modeli yaradılıb.

## Vahid mentorluq dövrəsi

1. **Yeni müraciətlər:** Mentor uyğunluq, ekspertiza və risk baxımından müraciəti qiymətləndirir.
2. **Mentee münasibətləri:** Tərəflər görüş ritmini, əlaqə kanalını, məxfiliyi, sərhədləri və uğur tərifini razılaşdırır.
3. **Məqsədlər və yol xəritəsi:** Bir-üç SMART məqsəd yaradılır. Hər məqsəd mərhələlərə bölünür və tərəqqi faizlə izlənir.
4. **Sessiyalar və cədvəl:** Hər görüşün əvvəlcədən gündəliyi, formatı və gözlənilən nəticəsi olur.
5. **Sessiya qeydləri və öhdəliklər:** Mentee ilə paylaşılan xülasə şəxsi mentor qeydindən ayrılır. Görüş konkret məsul şəxs və son tarixli addımla bağlanır.
6. **Mentorluq modelləri və paketlər:** Təkliflər format yox, nəticə, uyğun auditoriya, proses və sərhədlərlə təqdim olunur.
7. **Rəylər və nəticələr:** Məqsəd tərəqqisi, öhdəlik icrası, sessiya davamlılığı və check-in göstəriciləri birlikdə qiymətləndirilir.
8. **Resurslar və etika:** Resurs kitabxanası, məxfilik, maraq toqquşması, səlahiyyət sərhədi və etik bağlanış bir sistemdə saxlanılır.

## Tədqiqata əsaslanan prinsiplər

Mentorloop məqsədlərin sessiya gündəliyi, qeydlər, tapşırıqlar və müntəzəm check-in-lərlə əlaqəli olmasını tövsiyə edir. Platforma bir-üç yaxşı müəyyənləşdirilmiş SMART məqsədin uzun və qeyri-müəyyən siyahıdan daha faydalı olduğunu vurğulayır.[1]

Harvard Catalyst mentorluq münasibətini mərhələlərə bölür: hazırlıq, başlanğıc, erkən görüşlər, sonrakı görüşlər və bağlanış. Başlanğıcda ehtiyac qiymətləndirilməsi, məqsəd, mərhələ, görüş ritmi, məxfilik və məsuliyyətlərin sənədləşdirilməsini tövsiyə edir.[2]

Chronus mentorluq uğurunu yalnız iştirak və reytinqlə ölçməyi kifayət hesab etmir. Məqsəd, davranış, nəticə, bacarıq inkişafı, özünəinam, görüş aktivliyi və zaman içində dəyişiklik birlikdə izlənməlidir.[3]

Together görüş keyfiyyətini artırmaq üçün strukturlaşdırılmış gündəlikləri, daxili təqvim rezervasiyasını, uyğunlaşdırmanı, sorğuları və hesabatları əsas platforma imkanları kimi təqdim edir.[4]

## Texniki struktur

Yeni backend modeli `mentorship_goals`, `mentorship_milestones`, `mentorship_sessions`, `mentorship_actions`, `mentorship_services`, `mentorship_resources` və `mentorship_agreements` cədvəllərindən ibarətdir. Bütün qeydlər vahid istifadəçi UUID-si ilə mentor şəxsiyyətinə bağlanır.

Frontend-də `MentorWorkspaceProvider` bütün mentor səhifələrinə eyni məlumat vəziyyətini verir. `/instructor` route-ları aktiv workspace `mentor` olduqda mentor səhifələrini, `teacher` olduqda mövcud müəllim səhifələrini göstərir. Beləliklə Single Identity və workspace switching qorunur.

## İkinci iterasiya: bağlı iş axınları

İkinci iterasiyada məqsəd, sessiya və öhdəliklər arasındakı əlaqə gücləndirilib. Yol xəritəsində mərhələ tamamlandıqda məqsəd tərəqqisi avtomatik hesablanır; məqsədlər axtarıla, statusa görə süzülə və redaktə edilə bilir. Sessiyalar konkret məqsədə bağlanır, vaxt və gündəlik sonradan dəyişdirilə bilir, sessiya sonunda yaradılan öhdəlik isə həmin məqsəd və sessiya ilə birlikdə saxlanılır.

Mentee dashboard artıq demo məlumat yox, mentorun yaratdığı real məqsədləri, paylaşılan sessiya xülasələrini, öhdəlikləri və resursları göstərir. Şəxsi mentor qeydləri backend səviyyəsində mentee cavabından çıxarılır.

Keyfiyyət dövrəsi üçün tamamlanmış sessiyadan sonra mentor dördölçülü refleksiya sorğusu göndərə bilir: məqsəd aydınlığı, sessiya faydası, psixoloji təhlükəsizlik və irəliləyişə inam. Mentee cavabı mentor nəticə panelində marketinq reytinqi kimi deyil, prosesin təkmilləşdirilməsi siqnalı kimi göstərilir.

## AI dəstəkli sessiya sənədləşdirilməsi

Mentor xam sessiya qeydini daxil etdikdən sonra sistem mövcud Anthropic inteqrasiyasının sürətli, qənaətli modelindən istifadə edərək strukturlaşdırılmış qaralama yaradır. Qaralama mentee ilə paylaşılacaq xülasə, qərarlar, risk və maneələr, həmçinin məsul tərəf və tövsiyə olunan son tarixlə action item-lərdən ibarətdir.

Bu axın **human-in-the-loop** prinsipinə əsaslanır. AI nəticəsi avtomatik saxlanmır və mentee ilə avtomatik paylaşılmır. Mentor xülasəni redaktə edir, action item-ləri seçir, məsul şəxsi və tarixi dəyişir, sonra vahid təsdiq əməliyyatı ilə sessiyanı və seçilmiş tapşırıqları atomik şəkildə saxlayır.

Məxfilik və təhlükəsizlik tədbirləri aşağıdakılardır:

- Sessiya qeydləri yalnız server tərəfdən AI provayderinə göndərilir və generation audit qeydində xam mətn saxlanmır.
- Prompt daxilində istifadəçi qeydləri etibarsız məlumat kimi işarələnir; modelə qeyddəki göstərişləri icra etməmək tapşırılır.
- Modelin cavabı sərt tətbiq səviyyəli sxemlə yoxlanır, element sayı və mətn uzunluğu məhdudlaşdırılır.
- Şəxsi mentor qeydləri mentee workspace API-sindən çıxarılır.
- AI çağırışı mövcud saatlıq rate limit və aylıq AI generasiya krediti ilə qorunur.
- Provayder xətaları və hesab məlumatları istifadəçiyə xam formada göstərilmir.

## References

[1]: https://helphub.mentorloop.com/hc/en-us/articles/4929793709199-Setting-SMART-Goals "Setting SMART Goals"
[2]: https://catalyst.harvard.edu/mentorship-in-clinical-and-translational-research/implementation-guidance-mentors-mentoring-program-leaders/ "Implementation Guidance for Mentors and Mentoring Program Leaders"
[3]: https://chronus.com/blog/guide-measuring-mentoring-program-success "How to Set and Measure Mentoring Program Objectives"
[4]: https://www.togetherplatform.com/ "Together Mentoring Software"
