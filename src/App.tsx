import { useCallback, useEffect, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import FileTree from './components/FileTree'
import CountBar from './components/CountBar'
import UpdateBanner from './components/UpdateBanner'
import LoginPanel from './components/LoginPanel'
import PlatformSetup from './components/PlatformSetup'
import TemplateBanner from './components/TemplateBanner'
import CodexTerminal from './components/CodexTerminal'
import {
  listTree,
  readFile,
  writeFile,
  isVault,
  findVaultRoot,
  loadSavedRoot,
  saveRoot,
  codexAvailable,
  inspectFolder,
  initVault,
  writePlatformGuides,
  type Entry,
} from './lib/vault'
import { parsePlatforms, applyPlatforms, describe } from './lib/platform'
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
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [needSetup, setNeedSetup] = useState(false)
  const [hasCodex, setHasCodex] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)

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
  // DB 를 두지 않고 md 파일 하나를 진실의 원천으로 삼는다.
  const loadPlatforms = useCallback(async (r: string) => {
    try {
      const found = parsePlatforms(await readFile(r, PLATFORM_FILE))
      setPlatforms(found)
      // 아직 안 정했으면 설정 화면을 띄운다.
      setNeedSetup(found.length === 0)

      // 기준 문서가 없으면 채워 넣는다.
      //
      // 예전에는 설정 대화상자에서 확정할 때만 썼는데, 그러면 이미
      // 플랫폼이 정해진 vault 에는 영영 생기지 않았다. Codex 가
      // reference/novelpia.md 를 못 찾는 원인이 이것이었다.
      // 내용이 같으면 Rust 쪽에서 건너뛰므로 매번 불러도 된다.
      if (found.length) {
        await writePlatformGuides(r, found)
        setTree(await listTree(r))
      }
    } catch {
      setPlatforms([])
      setNeedSetup(false)
    }
  }, [])

  /**
   * 플랫폼을 확정한다. 한 번만 부를 수 있다 — 이미 정해져 있으면 거부한다.
   * 노벨피아는 글자 수, 조아라는 KB 라 산정 단위가 달라서, 연재 도중
   * 바꾸면 이미 쓴 회차가 기준에서 어긋난다.
   */
  const confirmPlatforms = useCallback(
    async (picked: Platform[]) => {
      if (!root || !picked.length) return
      try {
        const current = await readFile(root, PLATFORM_FILE)
        if (parsePlatforms(current).length > 0) {
          setError('이미 플랫폼이 정해져 있어 변경할 수 없습니다.')
          setNeedSetup(false)
          return
        }

        await writeFile(root, PLATFORM_FILE, applyPlatforms(current, picked))

        // Codex 가 읽을 수 있도록 해당 플랫폼의 리서치 원문을 vault 에 넣는다.
        // vault 는 저장소 밖에 있을 수 있어 docs/research/ 를 참조할 수 없다.
        await writePlatformGuides(root, picked)

        setPlatforms(picked)
        setNeedSetup(false)
        setStatus(`연재 플랫폼: ${describe(picked)}`)
        setTimeout(() => setStatus(null), 2500)
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
          void loadPlatforms(saved)
        }
      })
      .catch(() => {})
  }, [refreshTree, loadPlatforms])

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
    await loadPlatforms(found)
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

    // 앱 안의 터미널에서 띄운다. 패널이 마운트되면서 PTY 를 연다.
    setShowTerminal(true)
    // save 는 아래에서 정의되므로 의존성에서 제외한다 (ref 로 최신 상태를 읽는다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, platforms])

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
      {needSetup && (
        <PlatformSetup
          vaultName={root.split(/[\/]/).pop() ?? root}
          onConfirm={(ps) => void confirmPlatforms(ps)}
          onCancel={() => setNeedSetup(false)}
        />
      )}
      <header className="topbar">
        <span className="root" title={root}>
          {root.split(/[\\/]/).pop()}
        </span>

        {/* 플랫폼은 작품 시작 시 한 번 정하고 바꾸지 않는다. 표시만 한다. */}
        <span
          className={platforms.length ? 'platform-fixed' : 'platform-fixed unset'}
          title={
            platforms.length
              ? '연재 플랫폼은 작품 시작 시 확정되며 변경할 수 없습니다.\n' +
                '분량 산정 단위가 달라 도중에 바꾸면 기존 회차가 어긋납니다.'
              : '아직 정해지지 않았습니다.'
          }
        >
          {platforms.length ? '🔒 ' : ''}
          {describe(platforms)}
        </span>

        <LoginPanel platforms={platforms} />

        <div className="spacer" />
        {status && <span className="status">{status}</span>}
        <button
          className={showTerminal ? 'codex on' : 'codex'}
          onClick={() => (showTerminal ? setShowTerminal(false) : void runCodex())}
          disabled={!hasCodex}
          title={
            hasCodex
              ? 'vault 폴더에서 Codex를 앱 안의 터미널로 실행합니다.\n' +
                '승인 절차와 샌드박스가 꺼진 상태로 실행됩니다.'
              : 'Codex CLI가 설치되어 있지 않습니다 (npm i -g @openai/codex)'
          }
        >
          {showTerminal ? 'Codex 닫기' : 'Codex 실행'}
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
          {showTerminal && (
            <CodexTerminal
              root={root}
              platforms={platforms}
              onClose={() => setShowTerminal(false)}
            />
          )}
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

      <CountBar text={selected ? text : ''} platforms={platforms} />
    </div>
  )
}
