import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openLoginWindow } from '../lib/vault'
import { PLATFORM_LABEL, PLATFORM_ORDER } from '../lib/platform'
import type { Platform } from '../lib/count'
import NovelpiaLogin, { type Session } from './NovelpiaLogin'

/**
 * 선택된 플랫폼마다 로그인 상태를 보여준다.
 *
 * 두 곳을 고르면 조아라 → 노벨피아 순으로 안내한다. 조아라가 먼저인
 * 이유는 분량 기준이 더 길어 먼저 맞춰야 하는 쪽이기 때문이다.
 *
 * 조아라는 로그인에 reCAPTCHA v3 가 걸려 있어 직접 인증이 불가능하다.
 * 실제 브라우저 창에서 로그인하게 하고 세션만 가져온다.
 */
export default function LoginPanel({ platforms }: { platforms: Platform[] }) {
  const [session, setSession] = useState<Session | null>(null)
  const [joaraLogged, setJoaraLogged] = useState(false)

  // 보관된 세션을 먼저 띄운다. 로그인 창을 열지 않아도 보여야 한다.
  useEffect(() => {
    invoke<Session | null>('current_session')
      .then(setSession)
      .catch(() => setSession(null))
  }, [])

  // 세션이 아직 살아 있는지 주기적으로 확인한다.
  // 요청 자체가 세션 유지 역할도 한다. 만료됐으면 서버가 알려주고
  // Rust 쪽에서 보관본을 지운다.
  useEffect(() => {
    if (!platforms.includes('novelpia')) return

    const tick = () =>
      invoke<Session | null>('verify_session')
        .then(setSession)
        // 네트워크 실패는 만료가 아니다. 상태를 건드리지 않는다.
        .catch(() => {})

    void tick()
    const id = setInterval(tick, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [platforms])

  // 조아라는 쿠키 존재 여부로만 느슨하게 본다.
  useEffect(() => {
    if (!platforms.includes('joara')) return
    const check = () =>
      invoke<boolean>('is_logged_in', { platform: 'joara' })
        .then(setJoaraLogged)
        .catch(() => setJoaraLogged(false))
    void check()
    const id = setInterval(check, 3000)
    return () => clearInterval(id)
  }, [platforms])

  if (!platforms.length) return null

  const ordered = PLATFORM_ORDER.filter((p) => platforms.includes(p))

  return (
    <div className="login-panel">
      {ordered.map((p, i) => (
        <div key={p} className="slot">
          {ordered.length > 1 && <span className="step">{i + 1}</span>}
          {p === 'novelpia' ? (
            <NovelpiaLogin session={session} onSession={setSession} />
          ) : (
            <div className="np-login">
              <span className={joaraLogged ? 'badge on' : 'badge'}>
                {joaraLogged ? '로그인됨' : '로그아웃'}
              </span>
              <button
                className="ghost small"
                onClick={() => void openLoginWindow('joara')}
                title={
                  '조아라 로그인 창을 엽니다.\n' +
                  '조아라는 로그인에 reCAPTCHA 가 걸려 있어 직접 인증이 불가능합니다.\n' +
                  '창에서 평소대로 로그인하시면 앱이 세션을 가져옵니다.'
                }
              >
                {PLATFORM_LABEL[p]} 로그인
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
