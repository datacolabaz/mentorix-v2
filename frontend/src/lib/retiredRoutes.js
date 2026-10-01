/**
 * URLs of the retired mentorship product (single source of truth).
 * frontend/vercel.json mirrors this list server-side (301 redirects, 410 for retired pages);
 * retiredRoutes.test.jsx keeps both in sync and checks there are no redirect loops.
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
])

/** Old URLs with no equivalent feature: "Bu səhifə artıq mövcud deyil" (HTTP 410 from Vercel). */
export const RETIRED_PAGES = Object.freeze([
  '/mentorship',
  '/mentorship/*',
  '/mentoring',
  '/mentorluq',
  '/mentors',
  '/mentor/*',
  '/find-mentor',
  '/find-a-mentor',
  '/mentor-tap',
  '/mentor-booking',
  '/mentor-sessions',
  '/student/mentorship',
  '/instructor/roadmap',
])
