import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/use-debounced-value'

interface ComboboxProps<T> {
  value: T | null
  onChange: (value: T | null) => void
  search: (query: string) => Promise<T[]>
  getLabel: (item: T) => string
  getKey: (item: T) => string
  placeholder?: string
  id?: string
}

export function Combobox<T>({ value, onChange, search, getLabel, getKey, placeholder, id }: ComboboxProps<T>) {
  const [query, setQuery] = useState(value ? getLabel(value) : '')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    search(debouncedQuery)
      .then((results) => {
        if (cancelled) return
        setOptions(results)
        setActiveIndex(results.length > 0 ? 0 : -1)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open])

  useEffect(() => {
    if (!open) setQuery(value ? getLabel(value) : '')
  }, [value, open, getLabel])

  const selectOption = (option: T) => {
    onChange(option)
    setQuery(getLabel(option))
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && activeIndex >= 0 && options[activeIndex]) selectOption(options[activeIndex])
    } else if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          if (value) onChange(null)
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border py-1 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {loading && (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              Searching…
            </li>
          )}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              No matches
            </li>
          )}
          {!loading &&
            options.map((option, index) => (
              <li key={getKey(option)}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className="w-full px-3 py-2 text-left text-sm transition-colors duration-150"
                  style={{
                    background: index === activeIndex ? 'var(--surface-hover)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  {getLabel(option)}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
