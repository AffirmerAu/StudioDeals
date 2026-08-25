import { useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'
import {
  ContactsIcon,
  DashboardIcon,
  MoonIcon,
  OrganisationsIcon,
  PipelineIcon,
  SignOutIcon,
  SunIcon,
} from '@/components/icons'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/pipeline', label: 'Pipeline', icon: PipelineIcon, end: false },
  { to: '/contacts', label: 'Contacts', icon: ContactsIcon, end: false },
  { to: '/organisations', label: 'Organisations', icon: OrganisationsIcon, end: false },
] as const

function navLinkStyle(isActive: boolean): CSSProperties {
  return {
    color: isActive ? 'var(--color-brand-500)' : 'var(--text-muted)',
    background: isActive ? 'var(--surface-hover)' : 'transparent',
  }
}

export function Sidebar() {
  const { signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 border-r"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <img src="/assets/studiodeals/icon-rounded.svg" alt="" className="size-6 rounded-lg" />
          <span className="text-sm font-semibold tracking-tight">StudioDeals</span>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: ItemIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150"
              style={({ isActive }) => navLinkStyle(isActive)}
            >
              <ItemIcon className="size-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t space-y-0.5" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {theme === 'dark' ? <SunIcon className="size-[18px] shrink-0" /> : <MoonIcon className="size-[18px] shrink-0" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <SignOutIcon className="size-[18px] shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-10 flex items-center border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        {NAV_ITEMS.map(({ to, label, icon: ItemIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150"
            style={({ isActive }) => navLinkStyle(isActive)}
          >
            <ItemIcon className="size-5" />
            {label}
          </NavLink>
        ))}
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150"
          style={{ color: 'var(--text-muted)' }}
        >
          <SignOutIcon className="size-5" />
          Sign out
        </button>
      </nav>
    </>
  )
}

function ThemeToggleButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150"
      style={{ color: 'var(--text-muted)' }}
    >
      {theme === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
