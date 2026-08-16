import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import '@xterm/xterm/css/xterm.css'
import { PLATFORM_LABEL } from '../lib/platform'
import type { Platform } from '../lib/count'

/**
 * 앱 안에서 도는 Codex 터미널.
 *
 * Codex 는 전체 화면 TUI 라서 출력만 받아와서는 쓸 수 없다. Rust 쪽에서
 * PTY 를 열고 여기 xterm.js 와 양방향으로 연결한다.
 *
 * 셸을 거치지 않으므로 한국어 프롬프트의 따옴표가 깨지지 않는다.
 */
export default function CodexTerminal({
  root,
  platform,
  onClose,
}: {
  root: string
  platform: Platform | null
  onClose: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const term = new Terminal({
      fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      // 앱 테마와 맞춘다.
      theme: {
        background: '#16161a',
        foreground: '#e6e6ea',
        cursor: '#7c8cff',
        selectionBackground: '#3a4066',
      },
      // Codex 출력이 길어질 수 있다.
      scrollback: 10000,
      convertEol: false,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    // 키 입력을 PTY 로 보낸다.
    const inputSub = term.onData((data) => {
      void invoke('terminal_write', { data }).catch(() => {})
    })

    // 창 크기가 바뀌면 TUI 가 알아야 화면이 안 깨진다.
    const resizeSub = term.onResize(({ cols, rows }) => {
      void invoke('terminal_resize', { cols, rows }).catch(() => {})
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* 패널이 접혀 있으면 무시 */
      }
    })
    ro.observe(hostRef.current)

    const unlistenOut = listen<string>('terminal:output', (e) => {
      term.write(e.payload)
    })
    const unlistenExit = listen('terminal:exit', () => {
      setRunning(false)
      term.write('\r\n\x1b[2m[Codex 세션이 종료되었습니다]\x1b[0m\r\n')
    })

    // 실행
    ;(async () => {
      try {
        await invoke('terminal_spawn', {
          root,
          platform,
          cols: term.cols,
          rows: term.rows,
        })
        setRunning(true)
        term.focus()
      } catch (e) {
        setError(String(e))
      }
    })()

    return () => {
      inputSub.dispose()
      resizeSub.dispose()
      ro.disconnect()
      void unlistenOut.then((f) => f())
      void unlistenExit.then((f) => f())
      void invoke('terminal_kill').catch(() => {})
      term.dispose()
      termRef.current = null
    }
  }, [root, platform])

  async function restart() {
    const term = termRef.current
    if (!term) return
    term.clear()
    setError(null)
    try {
      await invoke('terminal_spawn', {
        root,
        platform,
        cols: term.cols,
        rows: term.rows,
      })
      setRunning(true)
      term.focus()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <section className="terminal-panel">
      <header className="terminal-head">
        <span className="title">Codex</span>
        <span className="ctx">
          {platform ? PLATFORM_LABEL[platform] : '플랫폼 미설정'} · {root.split(/[\\/]/).pop()}
        </span>
        <span className={running ? 'dot-run on' : 'dot-run'} title={running ? '실행 중' : '종료됨'} />
        <div className="spacer" />
        <button className="ghost small" onClick={() => void restart()}>
          {running ? '재시작' : '다시 실행'}
        </button>
        <button className="ghost small" onClick={onClose}>
          닫기
        </button>
      </header>
      {error && <div className="terminal-error">{error}</div>}
      <div className="terminal-host" ref={hostRef} />
    </section>
  )
}
