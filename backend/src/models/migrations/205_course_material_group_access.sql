-- A material may be available to more than one teaching group.
-- Keep course_materials.group_id as the legacy/primary group during the transition.

BEGIN;

CREATE TABLE IF NOT EXISTS course_material_groups (
  material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES instructor_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (material_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_course_material_groups_group
  ON course_material_groups (group_id, material_id);

-- Existing material permissions continue to work after this release.
INSERT INTO course_material_groups (material_id, group_id)
SELECT id, group_id
FROM course_materials
WHERE group_id IS NOT NULL
ON CONFLICT (material_id, group_id) DO NOTHING;

COMMIT;
