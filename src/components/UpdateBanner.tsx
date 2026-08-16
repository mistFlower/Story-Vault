import { useEffect, useState } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

type State =
  | { kind: 'idle' }
  | { kind: 'available'; update: Update }
  | { kind: 'downloading'; pct: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    // 시작 시 한 번만 확인한다. 실패해도 앱 사용을 막지 않는다.
    check()
      .then((update) => {
        if (update) setState({ kind: 'available', update })
      })
      .catch((e) => {
        console.warn('업데이트 확인 실패:', e)
      })
  }, [])

  if (state.kind === 'idle') return null

  async function install(update: Update) {
    let downloaded = 0
    let total = 0
    setState({ kind: 'downloading', pct: 0 })
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          setState({
            kind: 'downloading',
            pct: total ? Math.round((downloaded / total) * 100) : 0,
          })
        } else if (event.event === 'Finished') {
          setState({ kind: 'ready' })
        }
      })
      await relaunch()
    } catch (e) {
      setState({ kind: 'error', message: String(e) })
    }
  }

  return (
    <div className="update-banner">
      {state.kind === 'available' && (
        <>
          <span>새 버전 {state.update.version} 이 있습니다.</span>
          <button onClick={() => install(state.update)}>업데이트</button>
          <button className="ghost" onClick={() => setState({ kind: 'idle' })}>
            나중에
          </button>
        </>
      )}
      {state.kind === 'downloading' && <span>내려받는 중… {state.pct}%</span>}
      {state.kind === 'ready' && <span>설치 완료. 재시작합니다…</span>}
      {state.kind === 'error' && (
        <>
          <span>업데이트 실패: {state.message}</span>
          <button className="ghost" onClick={() => setState({ kind: 'idle' })}>
            닫기
          </button>
        </>
      )}
    </div>
  )
}
