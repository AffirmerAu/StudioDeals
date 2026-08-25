import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { SkeletonBlock } from '@/components/Skeleton'

/** Every page is a lazy chunk, so the shell holds the boundary — the sidebar
 * stays put while the next route downloads instead of blanking the screen. */
function PageFallback() {
  return (
    <div className="space-y-5 p-8">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonBlock className="h-72" />
        <SkeletonBlock className="h-72" />
      </div>
    </div>
  )
}

export function AppShell() {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:pl-56 pb-16 md:pb-0">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
