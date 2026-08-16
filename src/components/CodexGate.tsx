import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { exit } from '@tauri-apps/plugin-process'

export interface CodexStatus {
  ok: boolean
  /** node | codex | run | login | ok */
  stage: string
  title: string
  message: string
  command: string | null
}

/**
 * 시작할 때 Codex 를 쓸 수 있는지 확인하는 관문.
 *
 * 이 앱은 Codex 로 원고를 쓴다. Codex 가 막혀 있으면 편집기만 남아
 * 할 수 있는 일이 없으므로, 무엇을 고쳐야 하는지 알려주고 종료한다.
 *
 * 원인을 뭉뚱그리지 않는다 — Node.js 가 없는 것과 로그인이 안 된 것은
 * 사용자가 해야 할 일이 전혀 다르다.
 */
export default function CodexGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<CodexStatus | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    invoke<CodexStatus>('codex_diagnose')
      .then(setStatus)
      .catch((e) =>
        // 진단 자체가 실패하면 통과시킨다. 진단 버그로 앱을 못 쓰게
        // 만드는 것이 더 나쁘다.
        {
          console.warn('Codex 진단 실패:', e)
          setStatus({ ok: true, stage: 'ok', title: '', message: '', command: null })
        },
      )
  }, [])

  // 진단 중에는 아무것도 그리지 않는다. 잠깐 편집기가 보였다가
  // 경고창이 덮는 것보다 낫다.
  if (!status) return null

  if (status.ok) return <>{children}</>

  return (
    <div className="gate-backdrop">
      <div className="gate">
        <h2>{status.title}</h2>
        <p className="msg">{status.message}</p>

        {status.command && (
          <div className="cmd">
            <code>{status.command}</code>
            <button
              className="ghost small"
              onClick={() => {
                void navigator.clipboard.writeText(status.command!)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
        )}

        <p className="tail">확인을 누르면 앱이 종료됩니다.</p>

        <button className="primary" onClick={() => void exit(0)} autoFocus>
          확인
        </button>
      </div>
    </div>
  )
}
