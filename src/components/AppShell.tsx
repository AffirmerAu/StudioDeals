import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'

export function AppShell() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:pl-56 pb-16 md:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
