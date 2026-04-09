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
import InstructorExams from './pages/instructor/Exams'
import InstructorAttendance from './pages/instructor/Attendance'
import InstructorAnalytics from './pages/instructor/Analytics'

import StudentDashboard from './pages/student/Dashboard'
import StudentExams from './pages/student/Exams'
import ParentDashboard from './pages/parent/Dashboard'

const Placeholder = ({ title }) => (
  <div className="p-6">
    <h1 className="font-display font-bold text-2xl text-white">{title}</h1>
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
        <Route path="exams" element={<InstructorExams />} />
        <Route path="attendance" element={<InstructorAttendance />} />
        <Route path="analytics" element={<InstructorAnalytics />} />
        <Route path="tasks" element={<Placeholder title="Tapşırıqlar" />} />
        <Route path="payments" element={<Placeholder title="Ödənişlər" />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<Placeholder title="Tənzimləmələr" />} />
      </Route>

      <Route path="/student" element={<ProtectedRoute roles={['student']}><StudentLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="exams" element={<StudentExams />} />
        <Route path="payments" element={<Placeholder title="Ödəniş" />} />
        <Route path="notifications" element={<AdminNotifications />} />
      </Route>

      <Route path="/parent" element={<ProtectedRoute roles={['parent']}><ParentLayout /></ProtectedRoute>}>
        <Route index element={<ParentDashboard />} />
        <Route path="payments" element={<Placeholder title="Ödəniş" />} />
        <Route path="notifications" element={<AdminNotifications />} />
      </Route>

      <Route path="*" element={<Placeholder title="404 — Tapılmadı" />} />
    </Routes>
  )
}
