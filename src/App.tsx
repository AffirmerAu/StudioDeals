import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PipelinePage } from '@/pages/PipelinePage'
import { ContactsPage } from '@/pages/ContactsPage'
import { OrganisationsPage } from '@/pages/OrganisationsPage'
import { OrganisationDetailPage } from '@/pages/OrganisationDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="contacts/:contactId" element={<ContactsPage />} />
          <Route path="organisations" element={<OrganisationsPage />} />
          <Route path="organisations/:id" element={<OrganisationDetailPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
