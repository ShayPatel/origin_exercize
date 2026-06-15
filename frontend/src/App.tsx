import { AdminPanel } from '@/components/AdminPanel'
import { ChatPanel } from '@/components/chat/ChatPanel'

function App() {
  return (
    <div className="grid grid-cols-[1fr_400px] h-screen overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <AdminPanel />
      <ChatPanel />
    </div>
  )
}

export default App
