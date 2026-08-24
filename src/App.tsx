export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">StudioDeals</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Scaffold ready. Next: Phase 1 — app shell, auth guard, sidebar
          navigation, and theme toggle.
        </p>
        <p className="mt-6 tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
          React 19 · Vite 8 · Tailwind 4 · Supabase
        </p>
      </div>
    </div>
  )
}
