const db = require('../utils/db');

async function findDuplicateGroups() {
  const { rows } = await db.query(
    `
    SELECT name, country, COUNT(*)::int AS cnt
    FROM universities
    GROUP BY name, country
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, name
    `,
  );
  return rows;
}

async function findDuplicateMembers(name, country) {
  const { rows } = await db.query(
    `
    SELECT
      u.id,
      u.name,
      u.country,
      u.slug,
      u.created_at,
      (SELECT COUNT(*)::int FROM programs p WHERE p.uni_id = u.id) AS program_count
    FROM universities u
    WHERE u.name = $1 AND u.country = $2
    ORDER BY program_count DESC, u.created_at ASC
    `,
    [name, country],
  );
  return rows;
}

async function mergeDuplicateGroup({ keeperId, removeId, dryRun = false }) {
  const stats = {
    keeper_id: keeperId,
    remove_id: removeId,
    programs_deleted_conflict: 0,
    programs_moved: 0,
    university_deleted: false,
  };

  if (dryRun) {
    const { rows: conflicts } = await db.query(
      `
      SELECT COUNT(*)::int AS n
      FROM programs dup
      WHERE dup.uni_id = $2
        AND EXISTS (
          SELECT 1 FROM programs keep
          WHERE keep.uni_id = $1
            AND keep.name = dup.name
            AND keep.degree_level = dup.degree_level
        )
      `,
      [keeperId, removeId],
    );
    const { rows: movable } = await db.query(
      `
      SELECT COUNT(*)::int AS n FROM programs WHERE uni_id = $1
      `,
      [removeId],
    );
    stats.programs_deleted_conflict = conflicts[0]?.n || 0;
    stats.programs_moved = Math.max(0, (movable[0]?.n || 0) - stats.programs_deleted_conflict);
    stats.university_deleted = true;
    return stats;
  }

  return db.transaction(async (client) => {
    const { rowCount: deletedConflicts } = await client.query(
      `
      DELETE FROM programs dup
      WHERE dup.uni_id = $2
        AND EXISTS (
          SELECT 1 FROM programs keep
          WHERE keep.uni_id = $1
            AND keep.name = dup.name
            AND keep.degree_level = dup.degree_level
        )
      `,
      [keeperId, removeId],
    );
    stats.programs_deleted_conflict = deletedConflicts;

    const { rowCount: moved } = await client.query(
      `
      UPDATE programs
      SET uni_id = $1, updated_at = NOW()
      WHERE uni_id = $2
      `,
      [keeperId, removeId],
    );
    stats.programs_moved = moved;

    const { rowCount: deletedUni } = await client.query(
      'DELETE FROM universities WHERE id = $1',
      [removeId],
    );
    stats.university_deleted = deletedUni > 0;

    return stats;
  });
}

async function dedupeUniversities({ dryRun = false } = {}) {
  const groups = await findDuplicateGroups();
  const stats = {
    duplicate_groups: groups.length,
    merged_groups: 0,
    universities_removed: 0,
    programs_moved: 0,
    programs_deleted_conflict: 0,
    details: [],
    errors: [],
  };

  for (const group of groups) {
    try {
      const members = await findDuplicateMembers(group.name, group.country);
      if (members.length < 2) continue;

      const keeper = members[0];
      const toRemove = members.slice(1);

      for (const dupe of toRemove) {
        const mergeStats = await mergeDuplicateGroup({
          keeperId: keeper.id,
          removeId: dupe.id,
          dryRun,
        });
        stats.merged_groups += 1;
        stats.universities_removed += mergeStats.university_deleted ? 1 : 0;
        stats.programs_moved += mergeStats.programs_moved;
        stats.programs_deleted_conflict += mergeStats.programs_deleted_conflict;
        stats.details.push({
          name: group.name,
          country: group.country,
          keeper_id: keeper.id,
          removed_id: dupe.id,
          keeper_programs: keeper.program_count,
          removed_programs: dupe.program_count,
          ...mergeStats,
        });
      }
    } catch (err) {
      stats.errors.push({
        name: group.name,
        country: group.country,
        message: err?.message || String(err),
      });
    }
  }

  return stats;
}

module.exports = {
  findDuplicateGroups,
  findDuplicateMembers,
  mergeDuplicateGroup,
  dedupeUniversities,
};
