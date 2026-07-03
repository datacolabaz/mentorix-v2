/**
 * Full exam category hierarchy for Skill Assessment catalog.
 * parent: top-level landing cards
 * children: sub-groups; optional topics[] for leaf topic names (used as exam title seeds)
 */

const PARENTS = [
  {
    slug: 'beynelxalq-imtahanlar',
    icon: '🌍',
    name: 'International Exam Preparation',
    nameAz: 'Beynəlxalq İmtahanlara Hazırlıq',
    sort: 10,
    children: [
      {
        slug: 'dil-imtahanlari',
        name: 'Dil İmtahanları',
        topics: ['IELTS Preparation', 'TOEFL Preparation', 'TOEIC Preparation', 'PTE Academic Preparation', 'Duolingo English Test Preparation'],
      },
      {
        slug: 'universitet-qebulu',
        name: 'Universitet Qəbulu',
        topics: ['SAT Preparation', 'ACT Preparation', 'GRE Preparation', 'GMAT Preparation'],
      },
      {
        slug: 'alman-dili',
        name: 'Alman Dili',
        topics: ['Goethe A1', 'Goethe A2', 'Goethe B1', 'Goethe B2', 'TestDaF Preparation'],
      },
      {
        slug: 'fransiz-dili',
        name: 'Fransız Dili',
        topics: ['DELF', 'DALF'],
      },
    ],
  },
  {
    slug: 'it-proqramlasdirma',
    icon: '💻',
    name: 'IT & Programming',
    nameAz: 'İT və Proqramlaşdırma',
    sort: 20,
    children: [
      { slug: 'python', name: 'Python', topics: ['Python Fundamentals', 'Advanced Python', 'Python OOP'] },
      { slug: 'sql-it', name: 'SQL', topics: ['SQL Basics', 'SQL Intermediate', 'SQL Advanced'] },
      {
        slug: 'web-development',
        name: 'Web Development',
        topics: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'],
      },
      {
        slug: 'ai-it',
        name: 'AI',
        topics: ['AI Fundamentals', 'Prompt Engineering', 'Machine Learning Basics', 'Generative AI Basics'],
      },
    ],
  },
  {
    slug: 'data-analytics',
    icon: '📊',
    name: 'Data Analytics',
    nameAz: 'Data Analytics',
    sort: 25,
    children: [
      {
        slug: 'data-analytics-core',
        name: 'Data & Analytics',
        topics: [
          'Data Analytics Fundamentals',
          'Data Visualization',
          'Statistics Fundamentals',
          'Excel Fundamentals',
          'Advanced Excel',
          'Power BI',
          'Tableau',
        ],
      },
    ],
  },
  {
    slug: 'cloud-devops',
    icon: '☁️',
    name: 'Cloud & DevOps',
    nameAz: 'Cloud & DevOps',
    sort: 30,
    children: [
      {
        slug: 'cloud-platforms',
        name: 'Cloud Platforms',
        topics: ['AWS Fundamentals', 'Microsoft Azure Fundamentals', 'Google Cloud Basics'],
      },
      {
        slug: 'devops-tools',
        name: 'DevOps Tools',
        topics: ['Docker Basics', 'Kubernetes Basics', 'Linux Administration'],
      },
    ],
  },
  {
    slug: 'cyber-security',
    icon: '🔐',
    name: 'Cyber Security',
    nameAz: 'Cyber Security',
    sort: 40,
    children: [
      {
        slug: 'cyber-security-core',
        name: 'Security',
        topics: [
          'Cyber Security Fundamentals',
          'Network Security',
          'Ethical Hacking Basics',
          'SOC Analyst Basics',
        ],
      },
    ],
  },
  {
    slug: 'biznes-idareetme',
    icon: '📈',
    name: 'Business & Management',
    nameAz: 'Biznes və Layihə İdarəetməsi',
    sort: 50,
    children: [
      {
        slug: 'biznes-core',
        name: 'Management',
        topics: ['Agile Fundamentals', 'Scrum Fundamentals', 'Business Analysis', 'Project Management', 'Product Management'],
      },
    ],
  },
  {
    slug: 'ofis-bacariqlari',
    icon: '📊',
    name: 'Office Skills',
    nameAz: 'Ofis Bacarıqları',
    sort: 60,
    children: [
      {
        slug: 'microsoft-office',
        name: 'Microsoft Office',
        topics: ['Microsoft Excel', 'Word', 'PowerPoint', 'Outlook'],
      },
      {
        slug: 'google-workspace',
        name: 'Google Workspace',
        topics: ['Google Sheets', 'Google Docs'],
      },
    ],
  },
  {
    slug: 'dizayn',
    icon: '🎨',
    name: 'Design',
    nameAz: 'Dizayn',
    sort: 70,
    children: [
      {
        slug: 'design-tools',
        name: 'Design Tools',
        topics: ['Canva', 'Figma', 'Photoshop Basics', 'Illustrator Basics', 'UI Design Fundamentals'],
      },
    ],
  },
  {
    slug: 'reqemsal-marketinq',
    icon: '📱',
    name: 'Digital Marketing',
    nameAz: 'Rəqəmsal Marketinq',
    sort: 80,
    children: [
      {
        slug: 'marketing-core',
        name: 'Marketing',
        topics: ['Digital Marketing', 'SEO', 'Google Ads', 'Meta Ads', 'Email Marketing', 'Social Media Marketing'],
      },
    ],
  },
  {
    slug: 'maliyye-muhasibat',
    icon: '🧮',
    name: 'Finance & Accounting',
    nameAz: 'Maliyyə və Mühasibat',
    sort: 90,
    children: [
      {
        slug: 'finance-core',
        name: 'Finance',
        topics: ['Accounting Basics', 'Financial Analysis', 'Budget Planning', 'Tax Fundamentals'],
      },
    ],
  },
  {
    slug: 'diger-bacariqlar',
    icon: '🏥',
    name: 'Other Skills',
    nameAz: 'Digər Bacarıqlar',
    sort: 100,
    children: [
      {
        slug: 'other-core',
        name: 'Professional Skills',
        topics: ['First Aid Basics', 'Customer Service', 'Sales Fundamentals', 'HR Fundamentals', 'Public Speaking', 'Time Management'],
      },
    ],
  },
];

/** Map exam title keywords to level and certificate_type */
function inferExamMeta(title, parentSlug) {
  const t = title.toLowerCase();
  let level = 'beginner';
  if (/advanced|professional|skill assessment|b2|b1|intermediate|dalf|gre|gmat|testdaf/i.test(t)) {
    level = /advanced|professional|skill assessment|dalf|gre|gmat|testdaf/i.test(t) ? 'advanced' : 'intermediate';
  }
  if (/fundamentals|basics|a1|a2|html|css|introduction/i.test(t)) level = 'beginner';
  if (/skill assessment|professional certification|advanced|oop|kubernetes|ethical hacking/i.test(t)) {
    level = 'professional';
  }

  let certificate_type = 'professional';
  if (parentSlug === 'beynelxalq-imtahanlar' || /preparation|ielts|toefl|sat|act|gre|gmat|goethe|delf|dalf|testdaf|toeic|pte|duolingo/i.test(t)) {
    certificate_type = 'preparation';
  } else if (/fundamentals|basics|introduction/i.test(t)) {
    certificate_type = 'fundamentals';
  }

  return { level, certificate_type };
}

const CAREER_PATHS = [
  {
    slug: 'data-analyst',
    icon: '📊',
    name: 'Data Analyst',
    nameAz: 'Data Analyst',
    categorySlug: 'data-analytics',
    description: 'Excel-dən Power BI və statistikaya qədər tam data analyst yolu.',
    steps: [
      'Excel Fundamentals',
      'SQL Basics',
      'Python Fundamentals',
      'Data Analytics Fundamentals',
      'Power BI',
      'Statistics Fundamentals',
      'Data Analyst Skill Assessment',
    ],
  },
  {
    slug: 'frontend-developer',
    icon: '💻',
    name: 'Frontend Developer',
    nameAz: 'Frontend Developer',
    categorySlug: 'it-proqramlasdirma',
    description: 'HTML-dən React-ə qədər frontend inkişaf yolu.',
    steps: [
      'HTML',
      'CSS',
      'JavaScript',
      'React',
    ],
  },
];

module.exports = { PARENTS, CAREER_PATHS, inferExamMeta };
