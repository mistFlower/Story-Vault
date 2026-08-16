import { useCallback, useEffect, useState } from 'react'
import { openLoginWindow, isLoggedIn } from '../lib/vault'
import { PLATFORM_LABEL } from '../lib/platform'
import type { Platform } from '../lib/count'

/**
 * 플랫폼 로그인 상태 표시.
 *
 * 두 플랫폼 모두 공개 API 와 토큰 발급이 없어, 로그인은 WebView 창에서
 * 사용자가 직접 한다. 여기서는 세션이 잡혔는지만 보여준다.
 */
export default function LoginStatus({ platform }: { platform: Platform | null }) {
  const [logged, setLogged] = useState(false)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    if (!platform) {
      setLogged(false)
      return
    }
    setChecking(true)
    try {
      setLogged(await isLoggedIn(platform))
    } catch {
      setLogged(false)
    } finally {
      setChecking(false)
    }
  }, [platform])

  useEffect(() => {
    void check()
  }, [check])

  // 로그인 창에서 로그인이 끝나는 시점을 알 수 없으므로 주기적으로 본다.
  useEffect(() => {
    if (!platform || logged) return
    const id = setInterval(() => void check(), 3000)
    return () => clearInterval(id)
  }, [platform, logged, check])

  if (!platform) return null

  return (
    <div className="login-status">
      <span className={logged ? 'badge on' : 'badge'}>
        {logged ? '로그인됨' : '로그아웃'}
      </span>
      <button
        className="ghost small"
        onClick={() => void openLoginWindow(platform)}
        title={`${PLATFORM_LABEL[platform]} 로그인 창을 엽니다. 로그인은 직접 하셔야 합니다.`}
      >
        {logged ? '계정 확인' : `${PLATFORM_LABEL[platform]} 로그인`}
      </button>
      {checking && <span className="checking">확인 중…</span>}
    </div>
  )
}
