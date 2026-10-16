# Core baza: təşkilat sərhədi, əlaqələr və backend icazə qatı (Mərhələ 1)

UI yoxdur. Mövcud cədvəl adları, istifadəçi və auth strukturu dəyişmir.

## Modellər (mövcud cədvəllər üzərində)

| Model | Cədvəl | Sahib (`created_by`) | Təşkilat |
| --- | --- | --- | --- |
| User | `users` + `user_roles` | — | `org_memberships` |
| Role | `users.role`, `user_roles.role`, `org_memberships.role_key` → platforma rolları (`config/accessRoles.js`) | — | — |
| Organization | `courses` (`is_organization = TRUE`) | `owner_user_id` | — |
| Group | `instructor_groups` | `instructor_id` | `organization_id` (238) |
| Subject | `instructor_subjects` | `instructor_id` | `organization_id` (238) |
| Topic | `question_bank_topics` (`parent_topic_id`) | `created_by` | `organization_id` (238) |
| Question / Exam / Material / Assignment | `bank_questions`, `exams`, `course_materials`, `assignments` | `created_by` / `instructor_id` | `organization_id` (238) |

`organization_id = NULL` müəllimin şəxsi iş sahəsidir (bütün köhnə sətirlər).

## Əlaqələr

- **user–organization:** `org_memberships (course_id, user_id, role_key)`.
- **user–group:** `group_memberships_v` view-u (`instructor_group_members` + cari `enrollments`), yalnız oxumaq üçün.
- **group–subject:** `instructor_groups.subject_id`. Trigger: təşkilat qrupu başqa təşkilatın fənnini istifadə edə bilməz.
- **topic–subject:** `question_bank_topics.subject_id` + `parent_topic_id`. Trigger: ən çox 5 səviyyə, dövr yoxdur, ana mövzu eyni təşkilatda olmalıdır.

## Miqrasiyalar

| Fayl | Nə edir | Rollback |
| --- | --- | --- |
| `238_core_organization_scope.sql` | 7 cədvələ nullable `organization_id` + FK + `(organization_id, created_by)` indeksləri. Backfill: yalnız **tək** təşkilatda müəllim olanların qrupları | `scripts/sql/rollback/238_…rollback.sql` (`organization_id` sütunlarını silir, sətirlər qalır) |
| `239_core_relations.sql` | `group_memberships_v`, mövzu ağacı və qrup–fənn trigger-ləri | `scripts/sql/rollback/239_…rollback.sql` (məlumat itkisi yoxdur) |

Geri qaytarma ardıcıllığı: əvvəl 239, sonra 238.

## Backend icazə qatı

`middleware/access.js` (`authenticate`-dən sonra):

- `requireAccess('teacher', 'organization_admin', …)` — server tərəfində hesablanan platforma rolu; `super_admin` həmişə keçir. Rədd: `403 ACCESS_ROLE_REQUIRED`.
- `requireOrgPermission('groups.edit')` — təşkilat ID-si `:orgId`, `body.organization_id` və ya `query.organization_id`-dən götürülür; icazə `config/orgPermissions.js`-dən. Rədd: `403 ORG_PERMISSION_REQUIRED`.
- `scopeFor(req)` → `services/accessScope.js`:
  - `scopeFilter(scope, { table, alias, permission, params })` — siyahı sorğularına `(sahib = mən OR organization_id = ANY(icazəli təşkilatlarım))` əlavə edir;
  - `assertCanModify(scope, row, { table, permission })` — başqa təşkilatın sətiri `404` qaytarır (mövcudluq sızmır);
  - `resolveWritableOrganization(scope, orgId, permission)` — yeni sətirə yazılan təşkilat mövcud olmalı, həqiqətən təşkilat olmalı və icazə verməlidir.

Mövcud route-lar dəyişməyib; sonrakı mərhələlərin yeni modulları bu qatdan istifadə edəcək.
