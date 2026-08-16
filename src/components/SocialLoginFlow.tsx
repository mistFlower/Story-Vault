import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Session } from './NovelpiaLogin'

type Step = 'idle' | 'waiting' | 'done' | 'failed'

/**
 * 소셜(네이버·카카오) 계정 로그인 흐름.
 *
 * 이메일/비밀번호 경로는 소셜 계정에 쓸 수 없다. 대신 노벨피아 로그인
 * 페이지를 창으로 띄워 사용자가 평소대로 로그인하게 하고, 그 창의
 * LOGINKEY 쿠키를 가져온다.
 *
 * 결과물은 이메일 로그인과 똑같은 LOGINKEY 라서 이후 동작은 동일하다.
 * 캡차·2단계 인증도 사용자가 직접 처리하므로 우회가 없다.
 */
export default function SocialLoginFlow({
  onSession,
  onCancel,
}: {
  onSession: (s: Session) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<Step>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  // 로그인 창에서 언제 로그인이 끝나는지 알 수 없으므로 주기적으로 확인한다.
  useEffect(() => {
    if (step !== 'waiting') return

    const started = Date.now()
    const id = window.setInterval(async () => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
      try {
        const s = await invoke<Session | null>('capture_session', {
          platform: 'novelpia',
        })
        if (s) {
          setStep('done')
          onSession(s)
        }
      } catch {
        /* 창이 닫혔거나 아직 쿠키가 없다 — 계속 기다린다 */
      }
    }, 2000)
    timer.current = id
    return () => window.clearInterval(id)
  }, [step, onSession])

  async function start() {
    setError(null)
    setElapsed(0)
    try {
      await invoke('open_login_window', { platform: 'novelpia' })
      setStep('waiting')
    } catch (e) {
      setError(String(e))
      setStep('failed')
    }
  }

  if (step === 'done') {
    return (
      <div className="social-flow">
        <p className="ok">로그인되었습니다.</p>
      </div>
    )
  }

  return (
    <div className="social-flow">
      <ol className="steps">
        <li className={step === 'waiting' ? 'done' : 'now'}>
          <strong>로그인 창 열기</strong>
          <span>노벨피아 로그인 페이지가 새 창으로 뜹니다.</span>
        </li>
        <li className={step === 'waiting' ? 'now' : ''}>
          <strong>평소대로 로그인</strong>
          <span>네이버·카카오 버튼을 눌러 진행하세요. 앱은 비밀번호를 보지 않습니다.</span>
        </li>
        <li>
          <strong>자동으로 완료</strong>
          <span>로그인이 감지되면 창을 닫으셔도 됩니다.</span>
        </li>
      </ol>

      {error && <p className="err">{error}</p>}

      {step === 'waiting' ? (
        <div className="waiting">
          <span className="spinner" />
          로그인 대기 중… {elapsed}초
          {elapsed > 40 && (
            <p className="hint">
              로그인을 마쳤는데도 감지되지 않으면, 창에서 노벨피아 메인으로 한 번
              이동해 보세요. 쿠키가 그때 설정되는 경우가 있습니다.
            </p>
          )}
        </div>
      ) : (
        <div className="row">
          <button className="primary small" onClick={() => void start()}>
            로그인 창 열기
          </button>
          <button className="ghost small" onClick={onCancel}>
            취소
          </button>
        </div>
      )}

      {step === 'waiting' && (
        <div className="row">
          <button
            className="ghost small"
            onClick={() => {
              if (timer.current) window.clearInterval(timer.current)
              setStep('idle')
              onCancel()
            }}
          >
            그만두기
          </button>
        </div>
      )}
    </div>
  )
}
