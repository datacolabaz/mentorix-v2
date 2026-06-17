import ChatWorkspace from '../../components/chat/ChatWorkspace'

export default function DirectChatPage({ role }) {
  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-hidden px-0 md:px-4 py-0 md:py-3 flex flex-col">
      <ChatWorkspace role={role} mode="direct" />
    </div>
  )
}
