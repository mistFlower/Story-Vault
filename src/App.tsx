import { useCallback, useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import FileTree from './components/FileTree'
import CountBar from './components/CountBar'
import UpdateBanner from './components/UpdateBanner'
import {
  listTree,
  readFile,
  writeFile,
  isVault,
  loadSavedRoot,
  saveRoot,
  type Entry,
} from './lib/vault'

export default function App() {
  const [root, setRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<Entry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const dirty = text !== savedText
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const refreshTree = useCallback(async (r: string) => {
    try {
      setTree(await listTree(r))
    } catch (e) {
      setError(String(e))
    }
  }, [])

  // 저장된 vault 경로를 복원한다. 폴더가 사라졌으면 조용히 무시한다.
  useEffect(() => {
    const saved = loadSavedRoot()
    if (!saved) return
    isVault(saved)
      .then((ok) => {
        if (ok) {
          setRoot(saved)
          void refreshTree(saved)
        }
      })
      .catch(() => {})
  }, [refreshTree])

  async function pickVault() {
    const picked = await open({ directory: true, title: 'vault 폴더 선택' })
    if (typeof picked !== 'string') return

    if (!(await isVault(picked))) {
      setError('AGENTS.md 가 없습니다. vault 폴더를 선택해 주세요.')
      return
    }
    setError(null)
    setRoot(picked)
    saveRoot(picked)
    setSelected(null)
    setText('')
    setSavedText('')
    await refreshTree(picked)
  }

  async function openFile(path: string) {
    if (!root) return
    if (dirtyRef.current && !confirm('저장하지 않은 변경이 있습니다. 버리고 이동할까요?')) {
      return
    }
    try {
      const content = await readFile(root, path)
      setSelected(path)
      setText(content)
      setSavedText(content)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const save = useCallback(async () => {
    if (!root || !selected) return
    try {
      await writeFile(root, selected, text)
      setSavedText(text)
      setStatus('저장됨')
      setTimeout(() => setStatus(null), 1500)
    } catch (e) {
      setError(String(e))
    }
  }, [root, selected, text])

  // Ctrl+S 저장
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // 저장하지 않은 채 창을 닫는 것을 막는다.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  if (!root) {
    return (
      <div className="empty">
        <UpdateBanner />
        <h1>Story Vault</h1>
        <p>집필 vault 폴더를 열어 시작합니다.</p>
        <button className="primary" onClick={pickVault}>
          vault 폴더 열기
        </button>
        {error && <p className="error">{error}</p>}
        <p className="hint">
          <code>AGENTS.md</code> 가 있는 폴더가 vault 루트입니다.
        </p>
      </div>
    )
  }

  return (
    <div className="app">
      <UpdateBanner />
      <header className="topbar">
        <span className="root" title={root}>
          {root.split(/[\\/]/).pop()}
        </span>
        <div className="spacer" />
        {status && <span className="status">{status}</span>}
        <button onClick={() => void save()} disabled={!selected || !dirty}>
          저장 {dirty && '•'}
        </button>
        <button className="ghost" onClick={() => void refreshTree(root)}>
          새로고침
        </button>
        <button className="ghost" onClick={pickVault}>
          폴더 변경
        </button>
      </header>

      <div className="body">
        <aside className="sidebar">
          <FileTree
            entries={tree}
            selected={selected}
            dirty={dirty}
            onSelect={(p) => void openFile(p)}
          />
        </aside>

        <main className="main">
          {selected ? (
            <>
              <div className="filename">
                {selected}
                {dirty && <span className="dot" />}
              </div>
              <textarea
                className="editor"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder="원고를 작성하세요."
              />
            </>
          ) : (
            <div className="placeholder">왼쪽에서 파일을 선택하세요.</div>
          )}
        </main>
      </div>

      {error && (
        <div className="error-bar">
          {error}
          <button className="ghost" onClick={() => setError(null)}>
            닫기
          </button>
        </div>
      )}

      <CountBar text={selected ? text : ''} />
    </div>
  )
}
