INSERT INTO site_marketing_configs (slug, payload, updated_at)
VALUES (
  'instructor_nav',
  '{
    "version": 1,
    "sections": [
      {
        "id": "management",
        "title": "MANAGEMENT",
        "enabled": true,
        "itemKeys": [
          "dashboard",
          "teaching_groups",
          "students",
          "join_requests",
          "inquiries",
          "schedule",
          "attendance",
          "exams",
          "tasks"
        ]
      },
      {
        "id": "analytics",
        "title": "ANALYTICS",
        "enabled": true,
        "itemKeys": ["analytics", "payments"]
      },
      {
        "id": "system",
        "title": "SYSTEM",
        "enabled": true,
        "itemKeys": ["notifications", "settings"]
      }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
