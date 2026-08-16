import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import SocialLoginFlow from './SocialLoginFlow'

export interface Session {
  platform: string
  name: string
  masked: string
}

/**
 * 국내 노벨피아 직접 로그인.
 *
 * 노벨피아는 공개 API 가 없다. 오픈소스 구현들에서 확인된 비공식
 * 엔드포인트를 쓰므로 사이트가 개편되면 예고 없이 깨진다.
 *
 * 비밀번호는 로그인 요청에만 쓰고 저장하지 않는다. 앱이 보관하는 것은
 * 발급된 LOGINKEY 뿐이며, 그 값도 프런트엔드로 내려오지 않는다.
 *
 * 소셜(네이버·카카오) 계정은 이 경로로 로그인할 수 없다.
 */
type Mode = 'email' | 'social'

export default function NovelpiaLogin({
  session,
  onSession,
}: {
  session: Session | null
  onSession: (s: Session | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const s = await invoke<Session>('novelpia_login', { email, password })
      onSession(s)
      // 성공 즉시 화면에서 비운다. 메모리에 오래 둘 이유가 없다.
      setPassword('')
      setOpen(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await invoke('clear_session')
    onSession(null)
  }

  if (session) {
    return (
      <div className="np-login">
        <span className="badge on">로그인됨</span>
        <span className="key" title={`${session.name} 세션 보유 중`}>
          {session.name} {session.masked}
        </span>
        <button className="ghost small" onClick={() => void logout()}>
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className="np-login">
      <span className="badge">로그아웃</span>
      <button className="ghost small" onClick={() => setOpen(!open)}>
        노벨피아 로그인
      </button>

      {open && (
        <div className="np-popover">
          <div className="tabs" role="tablist">
            <button
              className={mode === 'email' ? 'tab on' : 'tab'}
              onClick={() => setMode('email')}
              role="tab"
              aria-selected={mode === 'email'}
            >
              이메일 로그인
            </button>
            <button
              className={mode === 'social' ? 'tab on' : 'tab'}
              onClick={() => setMode('social')}
              role="tab"
              aria-selected={mode === 'social'}
            >
              소셜 로그인
            </button>
          </div>

          {mode === 'social' ? (
            <SocialLoginFlow
              onSession={(s) => {
                onSession(s)
                setOpen(false)
              }}
              onCancel={() => setOpen(false)}
            />
          ) : (
          <>
          <form onSubmit={submit}>
            <label>
              이메일
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {error && <p className="err">{error}</p>}

            <div className="row">
              <button type="submit" className="primary small" disabled={busy}>
                {busy ? '로그인 중…' : '로그인'}
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                취소
              </button>
            </div>
          </form>

          <p className="note">
            비밀번호는 로그인 요청에만 쓰고 저장하지 않습니다. 보관하는 것은 발급된
            LOGINKEY 뿐입니다.
          </p>
          <p className="note">
            네이버·카카오 등 <strong>소셜 계정은 이 방식으로 로그인할 수 없습니다.</strong>{' '}
            <button type="button" className="linklike" onClick={() => setMode('social')}>
              소셜 로그인으로 전환
            </button>
          </p>
          </>
          )}
        </div>
      )}
    </div>
  )
}
