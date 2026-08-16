import { useCallback, useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import FileTree from './components/FileTree'
import CountBar from './components/CountBar'
import UpdateBanner from './components/UpdateBanner'
import LoginStatus from './components/LoginStatus'
import TemplateBanner from './components/TemplateBanner'
import {
  listTree,
  readFile,
  writeFile,
  isVault,
  findVaultRoot,
  loadSavedRoot,
  saveRoot,
  codexAvailable,
  launchCodex,
  inspectFolder,
  initVault,
  writePlatformGuide,
  type Entry,
} from './lib/vault'
import { parsePlatform, applyPlatform, PLATFORM_LABEL } from './lib/platform'
import type { Platform } from './lib/count'

const PLATFORM_FILE = 'PLATFORM.md'

export default function App() {
  const [root, setRoot] = useState<string | null>(null)
  const [tree, setTree] = useState<Entry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [hasCodex, setHasCodex] = useState(false)

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

  // 대상 플랫폼은 PLATFORM.md 에 있다. 앱과 집필 규칙이 같은 값을 봐야 한다.
  const loadPlatform = useCallback(async (r: string) => {
    try {
      setPlatform(parsePlatform(await readFile(r, PLATFORM_FILE)))
    } catch {
      setPlatform(null)
    }
  }, [])

  const changePlatform = useCallback(
    async (next: Platform) => {
      if (!root) return
      try {
        const current = await readFile(root, PLATFORM_FILE)
        await writeFile(root, PLATFORM_FILE, applyPlatform(current, next))

        // Codex 가 읽을 수 있도록 해당 플랫폼의 리서치 원문을 vault 에 넣는다.
        // vault 는 저장소 밖에 있을 수 있어 docs/research/ 를 참조할 수 없다.
        await writePlatformGuide(root, next)

        setPlatform(next)
        setStatus(`대상 플랫폼: ${PLATFORM_LABEL[next]} · 기준 문서 갱신`)
        setTimeout(() => setStatus(null), 2200)
        await refreshTree(root)

        // 열려 있는 파일이 PLATFORM.md 라면 화면도 갱신한다.
        if (selected === PLATFORM_FILE) {
          const updated = await readFile(root, PLATFORM_FILE)
          setText(updated)
          setSavedText(updated)
        }
      } catch (e) {
        setError(String(e))
      }
    },
    [root, selected, refreshTree],
  )

  useEffect(() => {
    codexAvailable().then(setHasCodex).catch(() => setHasCodex(false))
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
          void loadPlatform(saved)
        }
      })
      .catch(() => {})
  }, [refreshTree, loadPlatform])

  async function pickVault() {
    const picked = await open({ directory: true, title: 'vault 폴더 선택' })
    if (typeof picked !== 'string') return

    // 저장소 루트를 골라도 vault/ 하위를 찾아준다.
    let found = await findVaultRoot(picked)

    // vault 가 없으면 새로 만들 것인지 묻는다.
    // 빈 폴더를 골라 새 작품을 시작하는 것이 자연스러운 흐름이다.
    if (!found) {
      try {
        const info = await inspectFolder(picked)
        const preview = info.is_empty
          ? '이 폴더는 비어 있습니다.'
          : `이 폴더에는 이미 파일이 있습니다: ${info.existing.join(', ')}`

        if (
          !confirm(
            `${picked}\n\n${preview}\n\n` +
              '여기에 새 집필 vault를 만들까요?\n' +
              'AGENTS.md, canon/, plot/, state/, episodes/ 등이 생성됩니다.\n' +
              '기존 파일은 덮어쓰지 않습니다.',
          )
        ) {
          return
        }
        found = await initVault(picked)
      } catch (e) {
        setError(String(e))
        return
      }
    }

    setError(null)
    setRoot(found)
    saveRoot(found)
    setSelected(null)
    setText('')
    setSavedText('')
    await refreshTree(found)
    await loadPlatform(found)
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

  const runCodex = useCallback(async () => {
    if (!root) return
    // 저장하지 않은 원고가 있으면 Codex가 옛 내용을 읽는다.
    if (dirtyRef.current && !confirm('저장하지 않은 변경이 있습니다. 저장하고 실행할까요?')) {
      return
    }
    if (dirtyRef.current) await save()

    try {
      await launchCodex(root, platform)
      setStatus(
        platform
          ? `Codex 실행됨 (${PLATFORM_LABEL[platform]} 기준)`
          : 'Codex 실행됨 (플랫폼 미설정)',
      )
      setTimeout(() => setStatus(null), 2500)
    } catch (e) {
      setError(String(e))
    }
    // save 는 아래에서 정의되므로 의존성에서 제외한다 (ref 로 최신 상태를 읽는다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, platform])

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
          기존 vault를 열거나, <strong>빈 폴더를 선택해 새 작품을 시작</strong>할 수 있습니다.
          <br />
          새 폴더를 고르면 <code>AGENTS.md</code>와 집필 구조를 만들어 드립니다.
        </p>
      </div>
    )
  }

  return (
    <div className="app">
      <UpdateBanner />
      <TemplateBanner
        root={root}
        onUpgraded={() => {
          void refreshTree(root)
          // 열려 있는 파일이 갱신 대상이었다면 화면도 다시 읽는다.
          if (selected) void openFile(selected)
        }}
      />
      <header className="topbar">
        <span className="root" title={root}>
          {root.split(/[\\/]/).pop()}
        </span>

        <div className="platform-picker" role="group" aria-label="대상 플랫폼">
          {(['novelpia', 'joara'] as const).map((p) => (
            <button
              key={p}
              className={platform === p ? 'seg on' : 'seg'}
              onClick={() => void changePlatform(p)}
              title={`대상 플랫폼을 ${PLATFORM_LABEL[p]}로 설정 (PLATFORM.md 에 기록)`}
            >
              {PLATFORM_LABEL[p]}
            </button>
          ))}
          {platform === null && <span className="unset">미설정</span>}
        </div>

        <LoginStatus platform={platform} />

        <div className="spacer" />
        {status && <span className="status">{status}</span>}
        <button
          className="codex"
          onClick={() => void runCodex()}
          disabled={!hasCodex}
          title={
            hasCodex
              ? 'vault 폴더에서 Codex를 새 터미널 창으로 실행합니다.\n' +
                '승인 절차와 샌드박스가 꺼진 상태로 실행됩니다.'
              : 'Codex CLI가 설치되어 있지 않습니다 (npm i -g @openai/codex)'
          }
        >
          Codex 실행
        </button>
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

      <CountBar text={selected ? text : ''} platform={platform} />
    </div>
  )
}
