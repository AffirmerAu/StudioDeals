import { useEffect, useRef, useState } from 'react'
import { TagPill } from '@/components/TagPill'
import { useToast } from '@/lib/toast-context'
import {
  attachTag,
  detachTag,
  findOrCreateTag,
  matchLabel,
  useTags,
  type TagTarget,
} from '@/lib/tags'
import type { TagRow } from '@/types/crm'

interface TagEditorProps {
  target: TagTarget
  tags: TagRow[]
  onChange: (tags: TagRow[]) => void
}

/**
 * The record's tags, with a picker for adding one. Writes are optimistic and
 * roll back on failure: a tag going on or coming off is a single row either
 * way, and waiting on the round trip makes it feel broken.
 */
export function TagEditor({ target, tags, onChange }: TagEditorProps) {
  const { showToast } = useToast()
  const { tags: vocabulary } = useTags()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const applied = new Set(tags.map((tag) => tag.id))
  const trimmed = query.trim()
  const available = vocabulary
    .filter((tag) => !applied.has(tag.id))
    .filter((tag) => !trimmed || tag.label.toLowerCase().includes(trimmed.toLowerCase()))

  // Only offered when nothing already carries that label, case-insensitively —
  // matching what findOrCreateTag would do, so the option never lies.
  const canCreate = trimmed.length > 0 && !matchLabel(vocabulary, trimmed)

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const add = async (tag: TagRow) => {
    close()
    onChange([...tags, tag].sort((a, b) => a.label.localeCompare(b.label)))
    try {
      await attachTag(target, tag.id)
    } catch (error) {
      onChange(tags)
      showToast(error instanceof Error ? error.message : 'Failed to add the tag', 'error')
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const tag = await findOrCreateTag(trimmed)
      // findOrCreateTag reuses an existing label, so the tag may already be on
      // this record — adding it again would duplicate the pill.
      if (applied.has(tag.id)) {
        close()
        return
      }
      await add(tag)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create the tag', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (tag: TagRow) => {
    onChange(tags.filter((t) => t.id !== tag.id))
    try {
      await detachTag(target, tag.id)
    } catch (error) {
      onChange(tags)
      showToast(error instanceof Error ? error.message : 'Failed to remove the tag', 'error')
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-wrap items-center gap-1.5"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) close()
      }}
    >
      {tags.map((tag) => (
        <TagPill key={tag.id} label={tag.label} onRemove={() => void remove(tag)} />
      ))}

      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="rounded-lg border border-dashed px-2 py-0.5 text-xs font-medium transition-colors duration-150"
        style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
      >
        + Tag
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                close()
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (available[0]) void add(available[0])
                else if (canCreate) void create()
              }
            }}
            placeholder="Find or create a tag…"
            aria-label="Find or create a tag"
            className="w-full border-b px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />

          <ul className="max-h-48 overflow-y-auto py-1">
            {available.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void add(tag)}
                  className="w-full px-3 py-1.5 text-left text-sm transition-colors duration-150"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {tag.label}
                </button>
              </li>
            ))}

            {canCreate && (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void create()}
                  className="w-full px-3 py-1.5 text-left text-sm font-medium transition-colors duration-150 disabled:opacity-60"
                  style={{ color: 'var(--color-brand-500)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {busy ? 'Creating…' : `Create “${trimmed}”`}
                </button>
              </li>
            )}

            {available.length === 0 && !canCreate && (
              <li className="px-3 py-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
                {trimmed ? 'Already applied' : 'Every tag is applied'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
