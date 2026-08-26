import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'

// Each page is its own chunk, which also strands its heavy dependencies with
// it: recharts only ships with the dashboard, @dnd-kit only with the pipeline.
// LoginPage stays eager — it's small and it's the first paint for anyone
// signed out, so a second round trip there is the one place it would hurt.
// AppShell holds the Suspense boundary.
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PipelinePage = lazy(() => import('@/pages/PipelinePage').then((m) => ({ default: m.PipelinePage })))
const DealsPage = lazy(() => import('@/pages/DealsPage').then((m) => ({ default: m.DealsPage })))
const DealDetailPage = lazy(() =>
  import('@/pages/DealDetailPage').then((m) => ({ default: m.DealDetailPage })),
)
const ContactsPage = lazy(() => import('@/pages/ContactsPage').then((m) => ({ default: m.ContactsPage })))
const ContactDetailPage = lazy(() =>
  import('@/pages/ContactDetailPage').then((m) => ({ default: m.ContactDetailPage })),
)
const OrganisationsPage = lazy(() =>
  import('@/pages/OrganisationsPage').then((m) => ({ default: m.OrganisationsPage })),
)
const OrganisationDetailPage = lazy(() =>
  import('@/pages/OrganisationDetailPage').then((m) => ({ default: m.OrganisationDetailPage })),
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="deals/:dealId" element={<DealDetailPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:contactId" element={<ContactDetailPage />} />
          <Route path="organisations" element={<OrganisationsPage />} />
          <Route path="organisations/:id" element={<OrganisationDetailPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
