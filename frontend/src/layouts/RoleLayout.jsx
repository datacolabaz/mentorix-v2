import useAuthStore from '../hooks/useAuth'
import AdminLayout from './AdminLayout'
import InstructorLayout from './InstructorLayout'
import StudentLayout from './StudentLayout'
import ParentLayout from './ParentLayout'
import OrgLayout from './OrgLayout'

/** Shell for role-independent pages (`/notifications`, `/settings/notifications`): the user's own panel layout. */
export default function RoleLayout() {
  const role = String(useAuthStore((s) => s.user?.role) || '').toLowerCase()
  switch (role) {
    case 'admin':
      return <AdminLayout />
    case 'instructor':
      return <InstructorLayout />
    case 'parent':
      return <ParentLayout />
    case 'course':
      return <OrgLayout />
    default:
      return <StudentLayout />
  }
}
