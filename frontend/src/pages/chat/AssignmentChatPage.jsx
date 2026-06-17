import ChatWorkspace from '../../components/chat/ChatWorkspace'
import { useStudentGroups } from '../../contexts/StudentGroupContext'

function StudentAssignmentChatInner() {
  const { activeEnrollmentId } = useStudentGroups()
  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden px-0 md:px-4 py-0 md:py-3 flex flex-col">
      <ChatWorkspace role="student" mode="assignment" enrollmentId={activeEnrollmentId} />
    </div>
  )
}

function InstructorAssignmentChatInner() {
  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden px-0 md:px-4 py-0 md:py-3 flex flex-col">
      <ChatWorkspace role="instructor" mode="assignment" />
    </div>
  )
}

export default function AssignmentChatPage({ role }) {
  if (role === 'student') return <StudentAssignmentChatInner />
  return <InstructorAssignmentChatInner />
}
