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

## References

[1]: https://helphub.mentorloop.com/hc/en-us/articles/4929793709199-Setting-SMART-Goals "Setting SMART Goals"
[2]: https://catalyst.harvard.edu/mentorship-in-clinical-and-translational-research/implementation-guidance-mentors-mentoring-program-leaders/ "Implementation Guidance for Mentors and Mentoring Program Leaders"
[3]: https://chronus.com/blog/guide-measuring-mentoring-program-success "How to Set and Measure Mentoring Program Objectives"
[4]: https://www.togetherplatform.com/ "Together Mentoring Software"
