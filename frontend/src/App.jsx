import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import useAuthStore from './hooks/useAuth'

import Login from './pages/auth/Login'
import VerifyEmail from './pages/auth/VerifyEmail'
import RoleOnboarding from './pages/auth/RoleOnboarding'
import InstructorMapSearch from './pages/public/InstructorMapSearch'
import AdminLayout from './layouts/AdminLayout'
import InstructorLayout from './layouts/InstructorLayout'
import StudentLayout from './layouts/StudentLayout'
import ParentLayout from './layouts/ParentLayout'
import CourseLayout from './layouts/CourseLayout'

import AdminDashboard from './pages/admin/Dashboard'
import AdminInstructors from './pages/admin/Instructors'
import AdminStudents from './pages/admin/Students'
import AdminClasses from './pages/admin/Classes'
import AdminPayments from './pages/admin/Payments'
import AdminNotifications from './pages/admin/Notifications'
import AdminSettings from './pages/admin/Settings'
import AdminMarketingLogin from './pages/admin/MarketingLogin'

import InstructorDashboard from './pages/instructor/Dashboard'
import InstructorStudents from './pages/instructor/Students'
import InstructorSchedule from './pages/instructor/Schedule'
import InstructorExams from './pages/instructor/Exams'
import InstructorAttendance from './pages/instructor/Attendance'
import InstructorAnalytics from './pages/instructor/Analytics'
import InstructorPayments from './pages/instructor/Payments'
import InstructorNotifications from './pages/instructor/Notifications'
import InstructorSettings from './pages/instructor/Settings'
import InstructorTasks from './pages/instructor/Tasks'
import PaymentSuccess from './pages/instructor/PaymentSuccess'
import PaymentFail from './pages/instructor/PaymentFail'
import PaymentPending from './pages/instructor/PaymentPending'
import AdminBilling from './pages/admin/AdminBilling'
import ParentNotifications from './pages/parent/Notifications'

import StudentDashboard from './pages/student/Dashboard'
import StudentExams from './pages/student/Exams'
import StudentPayments from './pages/student/Payments'
import StudentSchedule from './pages/student/Schedule'
import StudentTasks from './pages/student/Tasks'
import StudentNotifications from './pages/student/Notifications'
import StudentJoinClass from './pages/student/JoinClass'
import StudentMyGroups from './pages/student/MyGroups'
import { StudentGroupProvider } from './contexts/StudentGroupContext'
import ParentDashboard from './pages/parent/Dashboard'
import CourseDashboard from './pages/course/Dashboard'
import CourseTeachers from './pages/course/Teachers'
import CourseLeads from './pages/course/Leads'
import CourseStudents from './pages/course/Students'
import CourseGroups from './pages/course/Groups'
import CourseSchedule from './pages/course/Schedule'
import CourseFinance from './pages/course/Finance'
import CourseNotifications from './pages/course/Notifications'
import CourseSettings from './pages/course/Settings'
import CourseCatalogList from './pages/courses/CourseList'
import CourseCatalogDetail from './pages/courses/CourseDetail'

const Placeholder = ({ title }) => (
  <div className="p-4 sm:p-6 min-w-0">
    <h1 className="font-display font-bold text-xl sm:text-2xl text-white break-words">{title}</h1>
    <p className="text-gray-400 mt-2">Tezliklə əlavə olunacaq</p>
  </div>
)

const RETURN_AFTER_LOGIN_KEY = 'mx_return_after_login'

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuthStore()
  const location = useLocation()
  if (!user) {
    try {
      const path = `${location.pathname || ''}${location.search || ''}`
      if (path && path !== '/login') sessionStorage.setItem(RETURN_AFTER_LOGIN_KEY, path)
    } catch {
      /* ignore */
    }
    return <Navigate to="/login" replace />
  }
  if (!user.role) return <Navigate to="/onboarding/role" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user } = useAuthStore()

  /** Bloklamadan: /auth/me ilə sessiyanı təsdiqlə; qapı gözləməsi sonsuz “Yüklənir”ə səbəb ola bilərdi */
  useEffect(() => {
    void useAuthStore.getState().bootstrapSession()
  }, [])

  return (
    <Routes>
      <Route path="/search" element={<InstructorMapSearch />} />
      <Route path="/login" element={user ? <Navigate to={user?.role ? `/${user.role}` : '/onboarding/role'} replace /> : <Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/onboarding/role"
        element={
          <ProtectedRoute>
            {user?.role ? <Navigate to={`/${user.role}`} replace /> : <RoleOnboarding />}
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={user ? (user?.role ? `/${user.role}` : '/onboarding/role') : '/login'} />} />

      <Route
        path="/join/:code"
        element={
          <StudentGroupProvider>
            <StudentJoinClass />
          </StudentGroupProvider>
        }
      />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="instructors" element={<AdminInstructors />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="classes" element={<AdminClasses />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="marketing/login" element={<AdminMarketingLogin />} />
      </Route>

      <Route path="/courses" element={<ProtectedRoute roles={['instructor']}><InstructorLayout /></ProtectedRoute>}>
        <Route index element={<CourseCatalogList />} />
        <Route path=":id" element={<CourseCatalogDetail />} />
      </Route>

      <Route path="/instructor" element={<ProtectedRoute roles={['instructor']}><InstructorLayout /></ProtectedRoute>}>
        <Route index element={<InstructorDashboard />} />
        <Route path="students" element={<InstructorStudents />} />
        <Route path="schedule" element={<InstructorSchedule />} />
        <Route path="exams" element={<InstructorExams />} />
        <Route path="attendance" element={<InstructorAttendance />} />
        <Route path="analytics" element={<InstructorAnalytics />} />
        <Route path="tasks" element={<InstructorTasks />} />
        <Route path="payments" element={<InstructorPayments />} />
        <Route path="notifications" element={<InstructorNotifications />} />
        <Route path="settings" element={<InstructorSettings />} />
      </Route>

      <Route path="/payment" element={<ProtectedRoute roles={['instructor']}><InstructorLayout /></ProtectedRoute>}>
        <Route path="success" element={<PaymentSuccess />} />
        <Route path="fail" element={<PaymentFail />} />
        <Route path="pending" element={<PaymentPending />} />
      </Route>

      <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="groups" element={<StudentMyGroups />} />
        <Route path="join" element={<StudentJoinClass />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="exams" element={<StudentExams />} />
        <Route path="assignments" element={<StudentTasks />} />
        <Route path="tasks" element={<Navigate to="/student/assignments" replace />} />
        <Route path="payments" element={<StudentPayments />} />
        {/* backward-compatible alias */}
        <Route path="payments/my" element={<Navigate to="/student/payments" replace />} />
        <Route path="notifications" element={<StudentNotifications />} />
      </Route>

      <Route path="/parent" element={<ProtectedRoute roles={['parent']}><ParentLayout /></ProtectedRoute>}>
        <Route index element={<ParentDashboard />} />
        <Route path="payments" element={<Placeholder title="Ödəniş" />} />
        <Route path="notifications" element={<ParentNotifications />} />
      </Route>

      <Route path="/course" element={<ProtectedRoute roles={['course']}><CourseLayout /></ProtectedRoute>}>
        <Route index element={<CourseDashboard />} />
        <Route path="leads" element={<CourseLeads />} />
        <Route path="teachers" element={<CourseTeachers />} />
        <Route path="students" element={<CourseStudents />} />
        <Route path="groups" element={<CourseGroups />} />
        <Route path="schedule" element={<CourseSchedule />} />
        <Route path="finance" element={<CourseFinance />} />
        <Route path="notifications" element={<CourseNotifications />} />
        <Route path="settings" element={<CourseSettings />} />
      </Route>

      <Route path="*" element={<Placeholder title="404 — Tapılmadı" />} />
    </Routes>
  )
}
