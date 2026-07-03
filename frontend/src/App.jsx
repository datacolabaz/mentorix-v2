import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import useAuthStore from './hooks/useAuth'

import AuthPage from './pages/auth/AuthPage'
import Landing from './pages/auth/Landing'
import VerifyEmail from './pages/auth/VerifyEmail'
import VerifyPhone from './pages/auth/VerifyPhone'
import ResetPassword from './pages/auth/ResetPassword'
import RoleOnboarding from './pages/auth/RoleOnboarding'
import { dashboardPathForRole } from './lib/postAuth'
import InstructorMapSearch from './pages/public/InstructorMapSearch'
import UniversityProgramSearch from './pages/public/UniversityProgramSearch'
import PublicSeoLanding from './pages/public/PublicSeoLanding'
import { PUBLIC_SEO_LANDINGS } from './lib/publicSeoLandings'
import PublicInstructorProfile from './pages/public/PublicInstructorProfile'
import LibraryInvite from './pages/public/LibraryInvite'
import MaterialInvite from './pages/public/MaterialInvite'
import MaterialPublicPreview from './pages/public/MaterialPublicPreview'
import MentorixLive from './pages/live/MentorixLive'
import LiveGuestJoin from './pages/live/LiveGuestJoin'
import LiveRecordingShare from './pages/live/LiveRecordingShare'
import InstructorLiveHistory from './pages/instructor/LiveHistory'
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
import AdminInstructorNav from './pages/admin/InstructorNav'
import AdminCategories from './pages/admin/AdminCategories'
import AdminUniversityPrograms from './pages/admin/AdminUniversityPrograms'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AnalyticsPageTracker from './components/analytics/AnalyticsPageTracker'
import PresenceHeartbeat from './components/analytics/PresenceHeartbeat'

import InstructorDashboard from './pages/instructor/Dashboard'
import InstructorStudents from './pages/instructor/Students'
import InstructorSchedule from './pages/instructor/Schedule'
import InstructorExams from './pages/instructor/Exams'
import InstructorAttendance from './pages/instructor/Attendance'
import InstructorAnalytics from './pages/instructor/Analytics'
import InstructorPayments from './pages/instructor/Payments'
import InstructorNotifications from './pages/instructor/Notifications'
import InstructorSettings from './pages/instructor/Settings'
import InstructorTeachingGroups from './pages/instructor/TeachingGroups'
import InstructorJoinRequests from './pages/instructor/JoinRequests'
import StudentInquiries from './pages/instructor/StudentInquiries'
import InstructorTasks from './pages/instructor/Tasks'
import InstructorMaterialsLibrary from './pages/instructor/MaterialsLibrary'
import InstructorUniversityPrograms from './pages/instructor/InstructorUniversityPrograms'
import PaymentSuccess from './pages/instructor/PaymentSuccess'
import PaymentFail from './pages/instructor/PaymentFail'
import PaymentPending from './pages/instructor/PaymentPending'
import CertificateVerify from './pages/public/CertificateVerify'
import StudentCertificates from './pages/student/Certificates'
import InstructorCertificates from './pages/instructor/Certificates'
import AdminBilling from './pages/admin/AdminBilling'
import AdminInventory from './pages/admin/AdminInventory'
import ParentNotifications from './pages/parent/Notifications'

import StudentDashboard from './pages/student/Dashboard'
import StudentExams from './pages/student/Exams'
import StudentPayments from './pages/student/Payments'
import StudentSchedule from './pages/student/Schedule'
import StudentTasks from './pages/student/Tasks'
import StudentMaterials from './pages/student/Materials'
import StudentNotifications from './pages/student/Notifications'
import StudentJoinClass from './pages/student/JoinClass'
import StudentJoinRedirect from './pages/student/StudentJoinRedirect'
import StudentExamInvite from './pages/student/ExamInvite'
import StudentTaskInvite from './pages/student/TaskInvite'
import StudentMyGroups from './pages/student/MyGroups'
import GroupChatPage from './pages/chat/GroupChatPage'
import DirectChatPage from './pages/chat/DirectChatPage'
import AssignmentChatPage from './pages/chat/AssignmentChatPage'
import { StudentGroupProvider } from './contexts/StudentGroupContext'
import ParentDashboard from './pages/parent/Dashboard'
import ParentAssignments from './pages/parent/Assignments'
import AssignmentAnalytics from './pages/instructor/AssignmentAnalytics'
import CourseDashboard from './pages/course/Dashboard'
import CourseTeachers from './pages/course/Teachers'
import CourseLeads from './pages/course/Leads'
import CourseStudents from './pages/course/Students'
import CourseGroups from './pages/course/Groups'
import CourseSchedule from './pages/course/Schedule'
import CourseFinance from './pages/course/Finance'
import CourseNotifications from './pages/course/Notifications'
import CourseSettings from './pages/course/Settings'
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
      if (path && path !== '/login' && path !== '/register') sessionStorage.setItem(RETURN_AFTER_LOGIN_KEY, path)
    } catch {
      /* ignore */
    }
    return <Navigate to="/login" replace />
  }
  if (!user.role) return <Navigate to="/onboarding/role" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />
  return children
}

function postLoginPath(user) {
  if (!user?.role) return '/onboarding/role'
  return dashboardPathForRole(user.role)
}

export default function App() {
  const { user } = useAuthStore()

  /** Bloklamadan: /auth/me ilə sessiyanı təsdiqlə; qapı gözləməsi sonsuz “Yüklənir”ə səbəb ola bilərdi */
  useEffect(() => {
    void useAuthStore.getState().bootstrapSession()
  }, [])

  return (
    <>
      <AnalyticsPageTracker />
      <PresenceHeartbeat />
      <Routes>
      <Route path="/search" element={<InstructorMapSearch />} />
      <Route path="/universities" element={<UniversityProgramSearch />} />
      {PUBLIC_SEO_LANDINGS.map((l) => (
        <Route key={l.path} path={l.path} element={<PublicSeoLanding />} />
      ))}
      <Route path="/muellim-paneli" element={<Navigate to="/muellimler-ucun" replace />} />
      <Route path="/teachers/:id" element={<PublicInstructorProfile />} />
      <Route path="/login" element={user ? <Navigate to={postLoginPath(user)} replace /> : <AuthPage />} />
      <Route path="/register" element={user ? <Navigate to={postLoginPath(user)} replace /> : <AuthPage />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/verify-phone"
        element={
          <ProtectedRoute>
            <VerifyPhone />
          </ProtectedRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/onboarding/role"
        element={
          <ProtectedRoute>
            {user?.role ? <Navigate to={`/${user.role}`} replace /> : <RoleOnboarding />}
          </ProtectedRoute>
        }
      />
      <Route path="/" element={user ? <Navigate to={postLoginPath(user)} replace /> : <Landing />} />

      <Route
        path="/join/:code"
        element={
          <StudentGroupProvider>
            <StudentJoinClass />
          </StudentGroupProvider>
        }
      />
      <Route path="/exam/:examId" element={<StudentExamInvite />} />
      <Route path="/task/:taskId" element={<StudentTaskInvite />} />
      <Route path="/library/material/:materialId" element={<MaterialInvite />} />
      <Route path="/m/:shareToken" element={<MaterialPublicPreview />} />
      <Route path="/lr/:shareToken" element={<LiveRecordingShare />} />
      <Route path="/live/join/:token" element={<LiveGuestJoin />} />
      <Route path="/c/:token" element={<CertificateVerify />} />
      <Route
        path="/live/:roomCode"
        element={
          <ProtectedRoute roles={['instructor', 'student']}>
            <MentorixLive />
          </ProtectedRoute>
        }
      />
      <Route path="/library/:groupId" element={<LibraryInvite />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="instructors" element={<AdminInstructors />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="classes" element={<AdminClasses />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="marketing/login" element={<AdminMarketingLogin />} />
        <Route path="instructor-nav" element={<AdminInstructorNav />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="university-programs" element={<AdminUniversityPrograms />} />
        <Route path="analytics" element={<AdminAnalytics />} />
      </Route>

      <Route path="/courses" element={<Navigate to="/instructor/teaching-groups" replace />} />
      <Route path="/courses/*" element={<Navigate to="/instructor/teaching-groups" replace />} />

      <Route path="/instructor" element={<ProtectedRoute roles={['instructor']}><InstructorLayout /></ProtectedRoute>}>
        <Route index element={<InstructorDashboard />} />
        <Route path="students" element={<InstructorStudents />} />
        <Route path="teaching-groups" element={<InstructorTeachingGroups />} />
        <Route path="chat" element={<GroupChatPage role="instructor" basePath="/instructor/chat" />} />
        <Route path="direct-chat" element={<DirectChatPage role="instructor" />} />
        <Route path="assignment-chat" element={<AssignmentChatPage role="instructor" />} />
        <Route path="join-requests" element={<InstructorJoinRequests />} />
        <Route path="inquiries" element={<StudentInquiries />} />
        <Route path="schedule" element={<InstructorSchedule />} />
        <Route path="exams" element={<InstructorExams />} />
        <Route path="certificates" element={<InstructorCertificates />} />
        <Route path="attendance" element={<InstructorAttendance />} />
        <Route path="analytics" element={<InstructorAnalytics />} />
        <Route path="tasks" element={<InstructorTasks />} />
        <Route path="materials" element={<InstructorMaterialsLibrary />} />
        <Route path="live/history" element={<InstructorLiveHistory />} />
        <Route path="university-programs" element={<InstructorUniversityPrograms />} />
        <Route path="materials/upload" element={<Navigate to="/instructor/materials" replace />} />
        <Route path="tasks/analytics" element={<AssignmentAnalytics />} />
        <Route path="assignments" element={<InstructorTasks />} />
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
        <Route path="join" element={<StudentJoinRedirect />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="chat" element={<GroupChatPage role="student" basePath="/student/chat" />} />
        <Route path="direct-chat" element={<DirectChatPage role="student" />} />
        <Route path="assignment-chat" element={<AssignmentChatPage role="student" />} />
        <Route path="exams" element={<StudentExams />} />
        <Route path="certificates" element={<StudentCertificates />} />
        <Route path="assignments" element={<StudentTasks />} />
        <Route path="materials" element={<StudentMaterials />} />
        <Route path="tasks" element={<Navigate to="/student/assignments" replace />} />
        <Route path="payments" element={<StudentPayments />} />
        {/* backward-compatible alias */}
        <Route path="payments/my" element={<Navigate to="/student/payments" replace />} />
        <Route path="notifications" element={<StudentNotifications />} />
      </Route>

      <Route path="/parent" element={<ProtectedRoute roles={['parent']}><ParentLayout /></ProtectedRoute>}>
        <Route index element={<ParentDashboard />} />
        <Route path="assignments" element={<ParentAssignments />} />
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
    </>
  )
}
