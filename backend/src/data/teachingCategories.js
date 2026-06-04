/**
 * Mentorix teaching category tree (source of truth for seed + API).
 * Unlimited nesting via subcategories[]; leaf nodes should have slug for URLs.
 */

const TEACHING_CATEGORY_TREE = [
  {
    id: 'school-subjects',
    slug: 'school-subjects',
    name_az: 'Məktəb Fənləri',
    icon: 'GraduationCap',
    is_popular: true,
    subcategories: [
      { id: 'math', slug: 'riyaziyyat', name_az: 'Riyaziyyat', is_popular: true },
      { id: 'az-lang', slug: 'azerbaycan-dili', name_az: 'Azərbaycan dili' },
      { id: 'eng-school', slug: 'ingilis-dili-mekteb', name_az: 'İngilis dili', is_popular: true },
      { id: 'rus-school', slug: 'rus-dili-mekteb', name_az: 'Rus dili' },
      { id: 'ger-school', slug: 'alman-dili-mekteb', name_az: 'Alman dili' },
      { id: 'physics', slug: 'fizika', name_az: 'Fizika' },
      { id: 'chemistry', slug: 'kimya', name_az: 'Kimya' },
      { id: 'biology', slug: 'biologiya', name_az: 'Biologiya' },
      { id: 'geography', slug: 'cografiya', name_az: 'Coğrafiya' },
      { id: 'history', slug: 'tarix', name_az: 'Tarix' },
      { id: 'cs-school', slug: 'informatika', name_az: 'İnformatika' },
    ],
  },
  {
    id: 'state-exams',
    slug: 'dovlet-imtahanlari',
    name_az: 'Dövlət İmtahanlarına Hazırlıq',
    icon: 'FileText',
    is_popular: true,
    subcategories: [
      { id: 'abituriyent', slug: 'abituriyent', name_az: 'Abituriyent', is_popular: true },
      { id: 'driving', slug: 'suruculuk', name_az: 'Sürücülük' },
      { id: 'civil-service', slug: 'dovlet-gullugu', name_az: 'Dövlət Qulluğu' },
      { id: 'miq', slug: 'miq', name_az: 'MİQ', is_popular: true },
      { id: 'magistr-local', slug: 'magistratura-dovlet', name_az: 'Magistratura' },
      { id: 'phd-local', slug: 'doktorantura', name_az: 'Doktorantura' },
      { id: 'exams-other', slug: 'diger-imtahanlar', name_az: 'Digər' },
    ],
  },
  {
    id: 'study-abroad',
    slug: 'xaricde-tehsil',
    name_az: 'Xaricdə Təhsil',
    icon: 'Globe',
    is_popular: true,
    subcategories: [
      {
        id: 'english-exams',
        slug: 'ingilis-dili-imtahanlari',
        name_az: 'İngilis dili imtahanları',
        subcategories: [
          { id: 'ielts', slug: 'ielts', name_az: 'IELTS', is_popular: true },
          { id: 'toefl', slug: 'toefl', name_az: 'TOEFL' },
          { id: 'pte', slug: 'pte-academic', name_az: 'PTE Academic' },
          { id: 'duolingo', slug: 'duolingo-test', name_az: 'Duolingo English Test' },
        ],
      },
      {
        id: 'usa-exams',
        slug: 'abs-imtahanlari',
        name_az: 'ABŞ',
        subcategories: [
          { id: 'sat', slug: 'sat', name_az: 'SAT', is_popular: true },
          { id: 'act', slug: 'act', name_az: 'ACT' },
          { id: 'ap', slug: 'ap-placement', name_az: 'AP' },
        ],
      },
      {
        id: 'grad-exams',
        slug: 'magistratura-xaric',
        name_az: 'Magistratura (Xaric)',
        subcategories: [
          { id: 'gre', slug: 'gre', name_az: 'GRE' },
          { id: 'gmat', slug: 'gmat', name_az: 'GMAT' },
        ],
      },
      {
        id: 'turkey-exams',
        slug: 'turkiye-imtahanlari',
        name_az: 'Türkiyə',
        subcategories: [{ id: 'yos', slug: 'yos', name_az: 'YÖS' }],
      },
      {
        id: 'germany-exams',
        slug: 'almaniya-imtahanlari',
        name_az: 'Almaniya',
        subcategories: [
          { id: 'testas', slug: 'testas', name_az: 'TestAS' },
          { id: 'dsh', slug: 'dsh', name_az: 'DSH' },
          { id: 'testdaf', slug: 'testdaf', name_az: 'TestDaF' },
        ],
      },
      {
        id: 'china-exams',
        slug: 'cin-imtahanlari',
        name_az: 'Çin',
        subcategories: [
          { id: 'hsk', slug: 'hsk', name_az: 'HSK' },
          { id: 'hskk', slug: 'hskk', name_az: 'HSKK' },
        ],
      },
      {
        id: 'france-exams',
        slug: 'fransa-imtahanlari',
        name_az: 'Fransa',
        subcategories: [
          { id: 'delf', slug: 'delf', name_az: 'DELF' },
          { id: 'dalf', slug: 'dalf', name_az: 'DALF' },
        ],
      },
      {
        id: 'russia-exams',
        slug: 'rusiya-imtahanlari',
        name_az: 'Rusiya',
        subcategories: [{ id: 'torfl', slug: 'torfl-trki', name_az: 'TORFL (ТРКИ)' }],
      },
      {
        id: 'intl-school-programs',
        slug: 'beynelxalq-mekteb',
        name_az: 'Beynəlxalq Məktəb Proqramları',
        subcategories: [
          { id: 'ib', slug: 'ib-program', name_az: 'IB' },
          { id: 'a-level', slug: 'a-level', name_az: 'A-Level' },
        ],
      },
    ],
  },
  {
    id: 'it-programming',
    slug: 'it-proqramlasdirma',
    name_az: 'İT və Proqramlaşdırma',
    icon: 'Code',
    is_popular: true,
    subcategories: [
      { id: 'python', slug: 'python', name_az: 'Python', is_popular: true },
      { id: 'java', slug: 'java', name_az: 'Java', is_popular: true },
      { id: 'javascript', slug: 'javascript', name_az: 'JavaScript' },
      { id: 'typescript', slug: 'typescript', name_az: 'TypeScript' },
      { id: 'csharp', slug: 'csharp', name_az: 'C#' },
      { id: 'php', slug: 'php', name_az: 'PHP' },
      { id: 'go', slug: 'golang', name_az: 'Go' },
      { id: 'sql', slug: 'sql-db', name_az: 'SQL' },
      { id: 'backend', slug: 'backend-dev', name_az: 'Backend Development', is_popular: true },
      { id: 'frontend', slug: 'frontend-dev', name_az: 'Frontend Development' },
      { id: 'fullstack', slug: 'fullstack-dev', name_az: 'Full Stack Development' },
      { id: 'mobile-dev', slug: 'mobile-development', name_az: 'Mobile Development' },
      { id: 'devops', slug: 'devops', name_az: 'DevOps' },
      { id: 'cyber-security', slug: 'cyber-security', name_az: 'Cyber Security' },
      { id: 'cloud', slug: 'cloud-computing', name_az: 'Cloud Computing' },
      { id: 'sys-design', slug: 'system-design', name_az: 'System Design' },
      { id: 'computer-science', slug: 'computer-science', name_az: 'Computer Science' },
      { id: 'qa', slug: 'software-testing-qa', name_az: 'Software Testing (QA)' },
    ],
  },
  {
    id: 'data-ai',
    slug: 'data-shuni-intellekt',
    name_az: 'Data və Süni İntellekt',
    icon: 'Cpu',
    is_popular: true,
    subcategories: [
      { id: 'excel', slug: 'excel', name_az: 'Excel', is_popular: true },
      { id: 'statistics', slug: 'statistics', name_az: 'Statistics' },
      { id: 'data-analysis', slug: 'data-analysis', name_az: 'Data Analysis', is_popular: true },
      { id: 'data-science', slug: 'data-science', name_az: 'Data Science' },
      { id: 'bi', slug: 'business-intelligence', name_az: 'Business Intelligence' },
      { id: 'powerbi', slug: 'power-bi', name_az: 'Power BI' },
      { id: 'tableau', slug: 'tableau', name_az: 'Tableau' },
      { id: 'ml', slug: 'machine-learning', name_az: 'Machine Learning' },
      { id: 'dl', slug: 'deep-learning', name_az: 'Deep Learning' },
      { id: 'ai', slug: 'artificial-intelligence', name_az: 'Artificial Intelligence', is_popular: true },
      { id: 'prompt-eng', slug: 'prompt-engineering', name_az: 'Prompt Engineering' },
      { id: 'data-eng', slug: 'data-engineering', name_az: 'Data Engineering' },
    ],
  },
  {
    id: 'design-multimedia',
    slug: 'dizayn-multimedia',
    name_az: 'Dizayn və Multimedia',
    icon: 'Palette',
    subcategories: [
      { id: 'ui-ux', slug: 'ui-ux-design', name_az: 'UI/UX Design', is_popular: true },
      { id: 'graphic-design', slug: 'graphic-design', name_az: 'Graphic Design' },
      { id: 'motion-design', slug: 'motion-design', name_az: 'Motion Design' },
      { id: 'video-editing', slug: 'video-editing', name_az: 'Video Editing' },
      { id: '3d-design', slug: '3d-design', name_az: '3D Design' },
      { id: 'figma', slug: 'figma', name_az: 'Figma', is_popular: true },
      { id: 'photoshop', slug: 'adobe-photoshop', name_az: 'Adobe Photoshop' },
      { id: 'illustrator', slug: 'adobe-illustrator', name_az: 'Adobe Illustrator' },
      { id: 'after-effects', slug: 'adobe-after-effects', name_az: 'Adobe After Effects' },
      { id: 'premiere', slug: 'premiere-pro', name_az: 'Premiere Pro' },
      { id: 'blender', slug: 'blender', name_az: 'Blender' },
    ],
  },
  {
    id: 'business-marketing',
    slug: 'biznes-marketinq',
    name_az: 'Biznes və Marketinq',
    icon: 'TrendingUp',
    subcategories: [
      { id: 'digital-marketing', slug: 'digital-marketing', name_az: 'Digital Marketing', is_popular: true },
      { id: 'smm', slug: 'smm', name_az: 'SMM' },
      { id: 'seo', slug: 'seo', name_az: 'SEO' },
      { id: 'google-ads', slug: 'google-ads', name_az: 'Google Ads' },
      { id: 'meta-ads', slug: 'meta-ads', name_az: 'Meta Ads' },
      { id: 'sales', slug: 'sales', name_az: 'Sales' },
      { id: 'e-commerce', slug: 'e-commerce', name_az: 'E-commerce' },
      { id: 'project-management', slug: 'project-management', name_az: 'Project Management' },
      { id: 'product-management', slug: 'product-management', name_az: 'Product Management' },
      { id: 'entrepreneurship', slug: 'entrepreneurship', name_az: 'Entrepreneurship' },
    ],
  },
  {
    id: 'languages',
    slug: 'xarici-diller',
    name_az: 'Xarici Dillər',
    icon: 'Languages',
    is_popular: true,
    subcategories: [
      { id: 'lang-eng', slug: 'ingilis-dili', name_az: 'İngilis dili', is_popular: true },
      { id: 'lang-rus', slug: 'rus-dili', name_az: 'Rus dili', is_popular: true },
      { id: 'lang-ger', slug: 'alman-dili', name_az: 'Alman dili' },
      { id: 'lang-fre', slug: 'fransiz-dili', name_az: 'Fransız dili' },
      { id: 'lang-spa', slug: 'ispan-dili', name_az: 'İspan dili' },
      { id: 'lang-chi', slug: 'cin-dili', name_az: 'Çin dili' },
      { id: 'lang-tur', slug: 'turk-dili', name_az: 'Türk dili' },
      { id: 'lang-ara', slug: 'ereb-dili', name_az: 'Ərəb dili' },
      { id: 'lang-kor', slug: 'koreya-dili', name_az: 'Koreya dili' },
      { id: 'lang-jap', slug: 'yapon-dili', name_az: 'Yapon dili' },
    ],
  },
  {
    id: 'arts-development',
    slug: 'incesenet-sexsi-inkisaf',
    name_az: 'İncəsənət və Şəxsi İnkişaf',
    icon: 'Smile',
    subcategories: [
      { id: 'chess', slug: 'sahmat', name_az: 'Şahmat', is_popular: true },
      { id: 'music', slug: 'musiqi', name_az: 'Musiqi' },
      { id: 'guitar', slug: 'gitara', name_az: 'Gitara' },
      { id: 'piano', slug: 'piano', name_az: 'Piano' },
      { id: 'drawing', slug: 'resm', name_az: 'Rəsm' },
      { id: 'photography', slug: 'fotoqrafiya', name_az: 'Fotoqrafiya' },
      { id: 'public-speaking', slug: 'natiqlik', name_az: 'Natiqlik' },
      { id: 'logic-personal', slug: 'mentiq-sexsi', name_az: 'Məntiq' },
      { id: 'leadership', slug: 'liderlik', name_az: 'Liderlik' },
    ],
  },
  {
    id: 'early-education',
    slug: 'mektebeqeder-ibtidai',
    name_az: 'Məktəbəqədər və İbtidai Təhsil',
    icon: 'Baby',
    subcategories: [
      { id: 'preschool-prep', slug: 'mektebe-hazirliq', name_az: 'Məktəbə Hazırlıq', is_popular: true },
      { id: 'logic-early', slug: 'mentiq-ibtidai', name_az: 'Məntiq' },
      { id: 'fast-reading', slug: 'suretli-oxu', name_az: 'Sürətli Oxu' },
      { id: 'mental-arithmetic', slug: 'mental-arifmetika', name_az: 'Mental Arifmetika' },
      { id: 'early-dev', slug: 'erken-inkisaf', name_az: 'Erkən İnkişaf' },
    ],
  },
  {
    id: 'other',
    slug: 'diger',
    name_az: 'Digər',
    icon: 'MoreHorizontal',
    subcategories: [],
  },
  {
    id: 'home-tutoring',
    slug: 'evde-hazirliq',
    name_az: 'Evdə Hazırlıq',
    icon: 'Home',
    is_virtual_category: true,
    subcategories: [
      { id: 'home-school', target_category_id: 'school-subjects', name_az: 'Məktəb Fənləri' },
      { id: 'home-languages', target_category_id: 'languages', name_az: 'Xarici Dillər' },
      { id: 'home-it', target_category_id: 'it-programming', name_az: 'İT və Proqramlaşdırma' },
      { id: 'home-abroad', target_category_id: 'study-abroad', name_az: 'Xaricdə Təhsil' },
      { id: 'home-exams', target_category_id: 'state-exams', name_az: 'Dövlət İmtahanları' },
      { id: 'home-other', target_category_id: 'other', name_az: 'Digər' },
    ],
  },
];

function slugOrId(node) {
  if (node.slug) return String(node.slug).trim();
  return String(node.id).trim().replace(/_/g, '-');
}

/** Flat rows for DB upsert: parent_id chain preserved */
function flattenTeachingCategories(tree = TEACHING_CATEGORY_TREE, parentId = null, sortBase = 0) {
  const rows = [];
  let order = sortBase;
  for (const node of tree) {
    const id = String(node.id);
    const slug = node.target_category_id ? null : slugOrId(node);
    rows.push({
      id,
      parent_id: parentId,
      slug,
      name_az: node.name_az,
      icon: node.icon || null,
      is_popular: Boolean(node.is_popular),
      is_virtual_category: Boolean(node.is_virtual_category),
      target_category_id: node.target_category_id || null,
      sort_order: order++,
    });
    if (Array.isArray(node.subcategories) && node.subcategories.length) {
      rows.push(...flattenTeachingCategories(node.subcategories, id, order));
      order += node.subcategories.length * 10;
    }
  }
  return rows;
}

/** Nested API tree from flat DB rows */
function buildCategoryTree(rows) {
  const byId = new Map();
  for (const r of rows) {
    byId.set(r.id, { ...r, subcategories: [] });
  }
  const roots = [];
  const sortFn = (a, b) => {
    if (a.is_popular !== b.is_popular) return a.is_popular ? -1 : 1;
    return (a.sort_order || 0) - (b.sort_order || 0) || String(a.name_az).localeCompare(String(b.name_az), 'az');
  };
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).subcategories.push(node);
    } else if (!node.parent_id) {
      roots.push(node);
    }
  }
  const sortRecursive = (list) => {
    list.sort(sortFn);
    for (const n of list) {
      if (n.subcategories?.length) sortRecursive(n.subcategories);
    }
  };
  sortRecursive(roots);
  return roots;
}

function toPublicCategoryNode(node) {
  return {
    id: node.id,
    slug: node.slug,
    name_az: node.name_az,
    icon: node.icon,
    is_popular: node.is_popular,
    is_virtual_category: node.is_virtual_category,
    target_category_id: node.target_category_id,
    subcategories: (node.subcategories || []).map(toPublicCategoryNode),
  };
}

module.exports = {
  TEACHING_CATEGORY_TREE,
  flattenTeachingCategories,
  buildCategoryTree,
  toPublicCategoryNode,
};
