import { useState } from 'react'
import type { Entry } from '../lib/vault'

interface Props {
  entries: Entry[]
  selected: string | null
  dirty: boolean
  onSelect: (path: string) => void
}

function Node({
  entry,
  depth,
  selected,
  dirty,
  onSelect,
}: {
  entry: Entry
  depth: number
  selected: string | null
  dirty: boolean
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth < 1)

  if (entry.is_dir) {
    return (
      <li>
        <button
          className="node dir"
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span className="caret">{open ? '▾' : '▸'}</span>
          {entry.name}
        </button>
        {open && (
          <ul>
            {entry.children.map((c) => (
              <Node
                key={c.path}
                entry={c}
                depth={depth + 1}
                selected={selected}
                dirty={dirty}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const isSelected = entry.path === selected
  return (
    <li>
      <button
        className={`node file${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: depth * 12 + 20 }}
        onClick={() => onSelect(entry.path)}
      >
        {entry.name.replace(/\.md$/i, '')}
        {isSelected && dirty && <span className="dot" title="저장되지 않음" />}
      </button>
    </li>
  )
}

export default function FileTree({ entries, selected, dirty, onSelect }: Props) {
  return (
    <nav className="tree">
      <ul>
        {entries.map((e) => (
          <Node
            key={e.path}
            entry={e}
            depth={0}
            selected={selected}
            dirty={dirty}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  )
}
