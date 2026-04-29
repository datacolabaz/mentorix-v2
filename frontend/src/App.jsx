import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './hooks/useAuth'

import Login from './pages/auth/Login'
import AdminLayout from './layouts/AdminLayout'
import InstructorLayout from './layouts/InstructorLayout'
import StudentLayout from './layouts/StudentLayout'
import ParentLayout from './layouts/ParentLayout'

import AdminDashboard from './pages/admin/Dashboard'
import AdminInstructors from './pages/admin/Instructors'
import AdminPayments from './pages/admin/Payments'
import AdminNotifications from './pages/admin/Notifications'
import AdminSettings from './pages/admin/Settings'

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
import ParentNotifications from './pages/parent/Notifications'

import StudentDashboard from './pages/student/Dashboard'
import StudentExams from './pages/student/Exams'
import StudentPayments from './pages/student/Payments'
import StudentSchedule from './pages/student/Schedule'
import StudentTasks from './pages/student/Tasks'
import StudentNotifications from './pages/student/Notifications'
import ParentDashboard from './pages/parent/Dashboard'

const Placeholder = ({ title }) => (
  <div className="p-4 sm:p-6 min-w-0">
    <h1 className="font-display font-bold text-xl sm:text-2xl text-white break-words">{title}</h1>
    <p className="text-gray-400 mt-2">Tezliklə əlavə olunacaq</p>
  </div>
)

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
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
      <Route path="/login" element={user ? <Navigate to={`/${user.role}`} /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? `/${user.role}` : '/login'} />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="instructors" element={<AdminInstructors />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
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

      <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
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

      <Route path="*" element={<Placeholder title="404 — Tapılmadı" />} />
    </Routes>
  )
}
