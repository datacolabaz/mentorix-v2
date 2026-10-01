/**
 * URLs of the retired mentorship product (single source of truth).
 * frontend/vercel.json mirrors this list server-side (301 redirects, 410 for retired pages);
 * retiredRoutes.test.jsx keeps both in sync and checks there are no redirect loops.
 * A trailing `/*` matches every sub-path (Vercel: `/:rest+`).
 */

/** Old URL -> page that does the same job today. Served as 301 by Vercel. */
export const RETIRED_REDIRECTS = Object.freeze([
  { from: '/mentor', to: '/instructor' },
  { from: '/mentor/dashboard', to: '/instructor' },
  { from: '/mentor-dashboard', to: '/instructor' },
  { from: '/mentor-profile', to: '/instructor/settings' },
  { from: '/become-mentor', to: '/muellimler-ucun' },
  { from: '/become-a-mentor', to: '/muellimler-ucun' },
  { from: '/mentor-ol', to: '/muellimler-ucun' },
  { from: '/mentorship', to: '/muellimler-ucun' },
  { from: '/mentorship/*', to: '/muellimler-ucun' },
  { from: '/mentoring', to: '/muellimler-ucun' },
  { from: '/mentorluq', to: '/muellimler-ucun' },
  { from: '/mentors', to: '/muellimler-ucun' },
  { from: '/find-mentor', to: '/muellimler-ucun' },
  { from: '/find-a-mentor', to: '/muellimler-ucun' },
  { from: '/mentor-tap', to: '/muellimler-ucun' },
])

/**
 * In-app deep links with no equivalent (a redirect would be misleading):
 * "Bu səhifə artıq mövcud deyil" (HTTP 410 from Vercel).
 */
export const RETIRED_PAGES = Object.freeze([
  '/mentor/*',
  '/mentor-booking',
  '/mentor-sessions',
  '/student/mentorship',
  '/instructor/roadmap',
])
