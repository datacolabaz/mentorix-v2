import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import useAuthStore from './hooks/useAuth'
import { MentorWorkspaceProvider, useIsMentorWorkspace } from './hooks/useMentorWorkspace.jsx'

const AuthPage = lazy(() => import('./pages/auth/AuthPage'))
const Landing = lazy(() => import('./pages/auth/Landing'))
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'))
const VerifyPhone = lazy(() => import('./pages/auth/VerifyPhone'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const PersonaOnboarding = lazy(() => import('./pages/auth/PersonaOnboarding'))
const GenericAppHome = lazy(() => import('./pages/app/Home'))
import {
  consumeReturnAfterLogin,
  dashboardPathForUser,
  isInviteResumePath,
  isSafeAppPath,
  peekReturnAfterLogin,
  rememberReturnAfterLogin,
  resolvePostAuthPath,
  userNeedsOnboarding,
  ONBOARDING_PATH,
} from './lib/postAuth'
const InstructorMapSearch = lazy(() => import('./pages/public/InstructorMapSearch'))
const UniversityProgramSearch = lazy(() => import('./pages/public/UniversityProgramSearch'))
const PublicSeoLanding = lazy(() => import('./pages/public/PublicSeoLanding'))
const MentorshipLanding = lazy(() => import('./pages/public/MentorshipLanding'))
const MentorshipGoals = lazy(() => import('./pages/public/MentorshipGoals'))
const MentorshipSafety = lazy(() => import('./pages/public/MentorshipSafety'))
const Favorites = lazy(() => import('./pages/account/Favorites'))
const LegalDocumentPage = lazy(() => import('./pages/public/LegalDocumentPage'))
import { PUBLIC_SEO_LANDINGS } from './lib/publicSeoLandings'
const PublicInstructorProfile = lazy(() => import('./pages/public/PublicInstructorProfile'))
const LibraryInvite = lazy(() => import('./pages/public/LibraryInvite'))
const MaterialInvite = lazy(() => import('./pages/public/MaterialInvite'))
const MaterialPublicPreview = lazy(() => import('./pages/public/MaterialPublicPreview'))
const MentorixLive = lazy(() => import('./pages/live/MentorixLive'))
const LiveGuestJoin = lazy(() => import('./pages/live/LiveGuestJoin'))
const LiveRecordingShare = lazy(() => import('./pages/live/LiveRecordingShare'))
const InstructorLiveHistory = lazy(() => import('./pages/instructor/LiveHistory'))
import AdminLayout from './layouts/AdminLayout'
import InstructorLayout from './layouts/InstructorLayout'
import StudentLayout from './layouts/StudentLayout'
import ParentLayout from './layouts/ParentLayout'
import OrgLayout from './layouts/OrgLayout'

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminInstructors = lazy(() => import('./pages/admin/Instructors'))
const AdminStudents = lazy(() => import('./pages/admin/Students'))
const AdminClasses = lazy(() => import('./pages/admin/Classes'))
const AdminPayments = lazy(() => import('./pages/admin/Payments'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))
const AdminMarketingLogin = lazy(() => import('./pages/admin/MarketingLogin'))
const AdminInstructorNav = lazy(() => import('./pages/admin/InstructorNav'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminUniversityPrograms = lazy(() => import('./pages/admin/AdminUniversityPrograms'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminCertifiedExamVerifications = lazy(() => import('./pages/admin/AdminCertifiedExamVerifications'))
import AnalyticsPageTracker from './components/analytics/AnalyticsPageTracker'
import PresenceHeartbeat from './components/analytics/PresenceHeartbeat'
import { DigitalMentorProvider } from './mentor/DigitalMentorProvider'
import DigitalMentorHost from './mentor/DigitalMentorHost'

const InstructorDashboard = lazy(() => import('./pages/instructor/Dashboard'))
const MentorDashboard = lazy(() => import('./pages/instructor/MentorDashboard'))
const MentorGoals = lazy(() => import('./pages/instructor/mentor/MentorGoals'))
const MentorSessions = lazy(() => import('./pages/instructor/mentor/MentorSessions'))
const MentorConnections = lazy(() => import('./pages/instructor/mentor/MentorConnections'))
const MentorRequests = lazy(() => import('./pages/instructor/mentor/MentorRequests'))
const MentorNotes = lazy(() => import('./pages/instructor/mentor/MentorNotes'))
const MentorOffers = lazy(() => import('./pages/instructor/mentor/MentorOffers'))
const MentorOutcomes = lazy(() => import('./pages/instructor/mentor/MentorOutcomes'))
const MentorResources = lazy(() => import('./pages/instructor/mentor/MentorResources'))
const InstructorStudents = lazy(() => import('./pages/instructor/Students'))
const InstructorSchedule = lazy(() => import('./pages/instructor/Schedule'))
const InstructorExams = lazy(() => import('./pages/instructor/Exams'))
const InstructorAttendance = lazy(() => import('./pages/instructor/Attendance'))
const InstructorAnalytics = lazy(() => import('./pages/instructor/Analytics'))
const InstructorPayments = lazy(() => import('./pages/instructor/Payments'))
const InstructorNotifications = lazy(() => import('./pages/instructor/Notifications'))
const InstructorSettings = lazy(() => import('./pages/instructor/Settings'))
const InstructorTeachingGroups = lazy(() => import('./pages/instructor/TeachingGroups'))
const InstructorJoinRequests = lazy(() => import('./pages/instructor/JoinRequests'))
const StudentInquiries = lazy(() => import('./pages/instructor/StudentInquiries'))
const InstructorTasks = lazy(() => import('./pages/instructor/Tasks'))
const InstructorAIQuestionGenerator = lazy(() => import('./pages/instructor/AIQuestionGenerator'))
const InstructorMaterialsLibrary = lazy(() => import('./pages/instructor/MaterialsLibrary'))
const InstructorPresentations = lazy(() => import('./pages/instructor/Presentations'))
const InstructorPresentationViewer = lazy(() => import('./pages/instructor/PresentationViewer'))
const InstructorPresentationPresent = lazy(() => import('./pages/instructor/PresentationPresent'))
const InstructorUniversityPrograms = lazy(() => import('./pages/instructor/InstructorUniversityPrograms'))
const PaymentSuccess = lazy(() => import('./pages/instructor/PaymentSuccess'))
const PaymentFail = lazy(() => import('./pages/instructor/PaymentFail'))
const PaymentPending = lazy(() => import('./pages/instructor/PaymentPending'))
const CertificateVerify = lazy(() => import('./pages/public/CertificateVerify'))
const CertifiedExamsCatalog = lazy(() => import('./pages/public/CertifiedExamsCatalog'))
const CertifiedExamCategoryPage = lazy(() => import('./pages/public/CertifiedExamCategoryPage'))
const CertifiedExamDetailPage = lazy(() => import('./pages/public/CertifiedExamDetailPage'))
const StudentCertificates = lazy(() => import('./pages/student/Certificates'))
const InstructorCertificates = lazy(() => import('./pages/instructor/Certificates'))
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'))
const AdminPartners = lazy(() => import('./pages/admin/AdminPartners'))
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'))
const ParentNotifications = lazy(() => import('./pages/parent/Notifications'))
const PartnerDashboard = lazy(() => import('./pages/partner/PartnerDashboard'))
const PartnerProgramLanding = lazy(() => import('./pages/partner/PartnerProgramLanding'))
const PartnerReferralLanding = lazy(() => import('./pages/PartnerReferralLanding'))

const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MentorshipDashboard = lazy(() => import('./pages/student/MentorshipDashboard'))
const StudentExams = lazy(() => import('./pages/student/Exams'))
const StudentPayments = lazy(() => import('./pages/student/Payments'))
const StudentSchedule = lazy(() => import('./pages/student/Schedule'))
const StudentTasks = lazy(() => import('./pages/student/Tasks'))
const StudentMaterials = lazy(() => import('./pages/student/Materials'))
const StudentNotifications = lazy(() => import('./pages/student/Notifications'))
const StudentJoinClass = lazy(() => import('./pages/student/JoinClass'))
const StudentJoinRedirect = lazy(() => import('./pages/student/StudentJoinRedirect'))
const StudentExamInvite = lazy(() => import('./pages/student/ExamInvite'))
const StudentTaskInvite = lazy(() => import('./pages/student/TaskInvite'))
const StudentMyGroups = lazy(() => import('./pages/student/MyGroups'))
const GroupChatPage = lazy(() => import('./pages/chat/GroupChatPage'))
const DirectChatPage = lazy(() => import('./pages/chat/DirectChatPage'))
const AssignmentChatPage = lazy(() => import('./pages/chat/AssignmentChatPage'))
import { StudentGroupProvider } from './contexts/StudentGroupContext'
import { parseJoinInviteInput } from './lib/joinInvite'
const ParentDashboard = lazy(() => import('./pages/parent/Dashboard'))
const ParentAssignments = lazy(() => import('./pages/parent/Assignments'))
const AssignmentAnalytics = lazy(() => import('./pages/instructor/AssignmentAnalytics'))
const OrgDashboard = lazy(() => import('./pages/org/Dashboard'))
const OrgParticipants = lazy(() => import('./pages/org/Participants'))
const OrgTeams = lazy(() => import('./pages/org/Teams'))
const OrgTeamDetail = lazy(() => import('./pages/org/Teams').then((module) => ({ default: module.OrgTeamDetail })))
const OrgGroups = lazy(() => import('./pages/org/Groups'))
const OrgTrainers = lazy(() => import('./pages/org/Trainers'))
const OrgExams = lazy(() => import('./pages/org/Exams'))
const OrgQuestionBank = lazy(() => import('./pages/org/Content').then((module) => ({ default: module.OrgQuestionBank })))
const OrgTests = lazy(() => import('./pages/org/Content').then((module) => ({ default: module.OrgTests })))
const OrgTemplates = lazy(() => import('./pages/org/Content').then((module) => ({ default: module.OrgTemplates })))
const OrgMaterials = lazy(() => import('./pages/org/Content').then((module) => ({ default: module.OrgMaterials })))
const OrgAnalytics = lazy(() => import('./pages/org/Analytics'))
const OrgMembers = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgMembers })))
const OrgRoles = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgRoles })))
const OrgProfile = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgProfile })))
const OrgBranding = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgBranding })))
const OrgIntegrations = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgIntegrations })))
const OrgNotifications = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgNotifications })))
const OrgAudit = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgAudit })))
const OrgSettings = lazy(() => import('./pages/org/Admin').then((module) => ({ default: module.OrgSettings })))
const RouteFallback = () => (
  <div className="min-h-[40vh] grid place-items-center p-6 text-sm text-gray-400" role="status">
    Yüklənir…
  </div>
)

const Placeholder = ({ title }) => (
  <div className="p-4 sm:p-6 min-w-0">
    <h1 className="font-display font-bold text-xl sm:text-2xl text-white break-words">{title}</h1>
    <p className="text-gray-400 mt-2">Tezliklə əlavə olunacaq</p>
  </div>
)

function ResumeAfterAuth() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const stored = peekReturnAfterLogin()
  const dest = resolvePostAuthPath(user, { nextQuery: searchParams.get('next'), stored })
  if (dest && dest !== ONBOARDING_PATH) consumeReturnAfterLogin()
  return <Navigate to={dest} replace />
}

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuthStore()
  const location = useLocation()
  if (!user) {
    const path = `${location.pathname || ''}${location.search || ''}`
    const inviteStored = isInviteResumePath(peekReturnAfterLogin())
    if (path && path !== '/login' && path !== '/register' && !inviteStored) {
      rememberReturnAfterLogin(path)
    }
    // ?next= — sessionStorage-dan əlavə olaraq return URL saxla (partner/admin kabinetləri)
    if (!inviteStored && path && isSafeAppPath(String(path).split(/[?#]/)[0])) {
      return <Navigate to={`/login?next=${encodeURIComponent(path)}`} replace />
    }
    return <Navigate to="/login" replace />
  }
  const invite = peekReturnAfterLogin()
  if (userNeedsOnboarding(user) && isInviteResumePath(invite)) {
    return <Navigate to={invite} replace />
  }
  if (userNeedsOnboarding(user)) return <Navigate to={ONBOARDING_PATH} replace />
  // Yanlış rol → /login yox, öz paneli (əks halda təşkilat/instructor loop + qarışıqlıq)
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={dashboardPathForUser(user)} replace />
  }
  return children
}

function OnboardingOrInvite() {
  const { user } = useAuthStore()
  const invite = peekReturnAfterLogin()
  if (isInviteResumePath(invite)) return <Navigate to={invite} replace />
  if (userNeedsOnboarding(user)) return <PersonaOnboarding />
  return <ResumeAfterAuth />
}

/** JoinClass render xətası olsa belə dəvət linki yadda qalsın (qeydiyyatdan sonra qayıtmaq üçün). */
function RememberJoinInvite() {
  const { code } = useParams()
  const parsed = parseJoinInviteInput(code || '')
  if (parsed) rememberReturnAfterLogin(`/join/${encodeURIComponent(parsed)}`)
  return null
}

function AuthedRoute({ children }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function ScrollToTop() {
  const { pathname, key } = useLocation()

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    window.scrollTo(0, 0)
  }, [pathname, key])

  return null
}

function InstructorOrMentorDashboard() {
  const isMentor = useIsMentorWorkspace()
  return isMentor ? <MentorDashboard key="mentor" /> : <InstructorDashboard key="instructor" />
}

function MentorOrInstructorPage({ mentor: MentorPage, instructor: InstructorPage }) {
  const isMentor = useIsMentorWorkspace()
  return isMentor ? <MentorPage /> : <InstructorPage />
}

export default function App() {
  const { user } = useAuthStore()

  /** Bloklamadan: /auth/me ilə sessiyanı təsdiqlə; qapı gözləməsi sonsuz “Yüklənir”ə səbəb ola bilərdi */
  useEffect(() => {
    void useAuthStore.getState().bootstrapSession()
  }, [])

  return (
    <DigitalMentorProvider>
      <ScrollToTop />
      <AnalyticsPageTracker />
      <PresenceHeartbeat />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/search" element={<InstructorMapSearch />} />
      <Route path="/universities" element={<UniversityProgramSearch />} />
      <Route path="/mentorship" element={<MentorshipLanding />} />
      <Route path="/mentorship/goals" element={<MentorshipGoals />} />
      <Route path="/mentorship/safety" element={<MentorshipSafety />} />
      <Route path="/account/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
      {PUBLIC_SEO_LANDINGS.map((l) => (
        <Route key={l.path} path={l.path} element={<PublicSeoLanding />} />
      ))}
      <Route path="/pricing" element={<Navigate to="/qiymetler" replace />} />
      <Route path="/muellim-paneli" element={<Navigate to="/muellimler-ucun" replace />} />
      <Route path="/teachers/:id" element={<PublicInstructorProfile />} />
      <Route path="/r/:code" element={<PartnerReferralLanding />} />
      <Route path="/partner" element={<PartnerProgramLanding />} />
      <Route path="/privacy" element={<LegalDocumentPage doc="privacy" />} />
      <Route path="/terms" element={<LegalDocumentPage doc="terms" />} />
      <Route
        path="/partner/dashboard"
        element={
          <ProtectedRoute>
            <PartnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/partner/apply" element={<Navigate to="/partner/dashboard" replace />} />
      <Route
        path="/login"
        element={user ? <ResumeAfterAuth /> : <AuthPage />}
      />
      <Route
        path="/register"
        element={user ? <ResumeAfterAuth /> : <AuthPage />}
      />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
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
        path="/onboarding"
        element={
          <AuthedRoute>
            <OnboardingOrInvite />
          </AuthedRoute>
        }
      />
      <Route path="/onboarding/role" element={<Navigate to={ONBOARDING_PATH} replace />} />
      <Route
        path="/app"
        element={
          <AuthedRoute>
            {isInviteResumePath(peekReturnAfterLogin()) ? (
              <Navigate to={peekReturnAfterLogin()} replace />
            ) : userNeedsOnboarding(user) ? (
              <Navigate to={ONBOARDING_PATH} replace />
            ) : (
              <GenericAppHome />
            )}
          </AuthedRoute>
        }
      />
      <Route path="/" element={<Landing />} />

      <Route
        path="/join/:code"
        element={
          <>
            <RememberJoinInvite />
            <StudentGroupProvider>
              <StudentJoinClass />
            </StudentGroupProvider>
          </>
        }
      />
      <Route path="/exam/:examId" element={<StudentExamInvite />} />
      <Route path="/task/:taskId" element={<StudentTaskInvite />} />
      <Route path="/library/material/:materialId" element={<MaterialInvite />} />
      <Route path="/m/:shareToken" element={<MaterialPublicPreview />} />
      <Route path="/lr/:shareToken" element={<LiveRecordingShare />} />
      <Route path="/live/join/:token" element={<LiveGuestJoin />} />
      <Route path="/c/:token" element={<CertificateVerify />} />
      <Route path="/sertifikatli-imtahanlar" element={<CertifiedExamsCatalog />} />
      <Route path="/sertifikatli-imtahanlar/:categorySlug/:examSlug" element={<CertifiedExamDetailPage />} />
      <Route path="/sertifikatli-imtahanlar/:slug" element={<CertifiedExamCategoryPage />} />
      <Route
        path="/live/:roomCode"
        element={
          <ProtectedRoute roles={['instructor', 'student']}>
            <MentorixLive />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor/presentations/:id/present"
        element={
          <ProtectedRoute roles={['instructor']}>
            <InstructorPresentationPresent />
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
        <Route path="partners" element={<AdminPartners />} />
        <Route path="partners/partners" element={<Navigate to="/admin/partners" replace />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="marketing/login" element={<AdminMarketingLogin />} />
        <Route path="instructor-nav" element={<AdminInstructorNav />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="university-programs" element={<AdminUniversityPrograms />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="certified-exams" element={<AdminCertifiedExamVerifications />} />
      </Route>

      <Route path="/courses" element={<Navigate to="/instructor/teaching-groups" replace />} />
      <Route path="/courses/*" element={<Navigate to="/instructor/teaching-groups" replace />} />

      <Route path="/instructor" element={<ProtectedRoute roles={['instructor']}><MentorWorkspaceProvider><InstructorLayout /></MentorWorkspaceProvider></ProtectedRoute>}>
        <Route index element={<InstructorOrMentorDashboard />} />
        <Route path="students" element={<MentorOrInstructorPage mentor={MentorConnections} instructor={InstructorStudents} />} />
        <Route path="teaching-groups" element={<MentorOrInstructorPage mentor={MentorOffers} instructor={InstructorTeachingGroups} />} />
        <Route path="chat" element={<GroupChatPage role="instructor" basePath="/instructor/chat" />} />
        <Route path="direct-chat" element={<DirectChatPage role="instructor" />} />
        <Route path="assignment-chat" element={<AssignmentChatPage role="instructor" />} />
        <Route path="join-requests" element={<InstructorJoinRequests />} />
        <Route path="inquiries" element={<MentorOrInstructorPage mentor={MentorRequests} instructor={StudentInquiries} />} />
        <Route path="schedule" element={<MentorOrInstructorPage mentor={MentorSessions} instructor={InstructorSchedule} />} />
        <Route path="exams" element={<InstructorExams />} />
        <Route path="certificates" element={<InstructorCertificates />} />
        <Route path="attendance" element={<InstructorAttendance />} />
        <Route path="analytics" element={<MentorOrInstructorPage mentor={MentorOutcomes} instructor={InstructorAnalytics} />} />
        <Route path="tasks" element={<MentorOrInstructorPage mentor={MentorNotes} instructor={InstructorTasks} />} />
        <Route path="ai-generator" element={<InstructorAIQuestionGenerator />} />
        <Route path="materials" element={<MentorOrInstructorPage mentor={MentorResources} instructor={InstructorMaterialsLibrary} />} />
        <Route path="presentations" element={<InstructorPresentations />} />
        <Route path="presentations/:id" element={<InstructorPresentationViewer />} />
        <Route path="live/history" element={<InstructorLiveHistory />} />
        <Route path="roadmap" element={<MentorGoals />} />
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
        <Route path="mentorship" element={<MentorshipDashboard />} />
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
        <Route path="universities" element={<UniversityProgramSearch embedded />} />
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

      <Route path="/org" element={<ProtectedRoute roles={['course']}><OrgLayout /></ProtectedRoute>}>
        <Route index element={<OrgDashboard />} />
        <Route path="participants" element={<OrgParticipants />} />
        <Route path="teams" element={<OrgTeams />} />
        <Route path="teams/:id" element={<OrgTeamDetail />} />
        <Route path="groups" element={<OrgGroups />} />
        <Route path="trainers" element={<OrgTrainers />} />
        <Route path="exams" element={<OrgExams />} />
        <Route path="assessments" element={<OrgExams assessmentView />} />
        <Route path="question-bank" element={<OrgQuestionBank />} />
        <Route path="tests" element={<OrgTests />} />
        <Route path="templates" element={<OrgTemplates />} />
        <Route path="materials" element={<OrgMaterials />} />
        <Route path="library" element={<OrgMaterials library />} />
        <Route path="analytics" element={<OrgAnalytics />} />
        <Route path="analytics/exams" element={<OrgAnalytics focus="exams" />} />
        <Route path="analytics/participants" element={<OrgAnalytics focus="participants" />} />
        <Route path="analytics/teams" element={<OrgAnalytics focus="teams" />} />
        <Route path="reports" element={<OrgAnalytics focus="reports" />} />
        <Route path="members" element={<OrgMembers />} />
        <Route path="roles" element={<OrgRoles />} />
        <Route path="profile" element={<OrgProfile />} />
        <Route path="branding" element={<OrgBranding />} />
        <Route path="integrations" element={<OrgIntegrations />} />
        <Route path="notifications" element={<OrgNotifications />} />
        <Route path="audit" element={<OrgAudit />} />
        <Route path="settings" element={<OrgSettings />} />
      </Route>

      <Route path="/course" element={<ProtectedRoute roles={['course']}><Navigate to="/org" replace /></ProtectedRoute>} />
      <Route path="/course/students" element={<Navigate to="/org/participants" replace />} />
      <Route path="/course/teachers" element={<Navigate to="/org/trainers" replace />} />
      <Route path="/course/groups" element={<Navigate to="/org/groups" replace />} />
      <Route path="/course/settings" element={<Navigate to="/org/settings" replace />} />
      <Route path="/course/notifications" element={<Navigate to="/org/notifications" replace />} />
      <Route path="/course/finance" element={<Navigate to="/org/reports" replace />} />
      <Route path="/course/schedule" element={<Navigate to="/org" replace />} />
      <Route path="/course/leads" element={<Navigate to="/org/participants" replace />} />
      <Route path="/course/*" element={<Navigate to="/org" replace />} />

      <Route path="*" element={<Placeholder title="404 — Tapılmadı" />} />
    </Routes>
      </Suspense>
    </DigitalMentorProvider>
  )
}
