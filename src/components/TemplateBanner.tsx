import { useCallback, useEffect, useState } from 'react'
import { checkTemplates, upgradeTemplates, type TemplateStatus } from '../lib/vault'

/**
 * 집필 규칙 템플릿 갱신 안내.
 *
 * 앱을 업데이트해도 이미 만들어진 vault 의 AGENTS.md 는 그대로 남는다.
 * init_vault 가 기존 파일을 건드리지 않기 때문이다. 낡은 규칙으로 계속
 * 쓰면 앱이 아는 기준과 Codex 가 따르는 기준이 어긋나므로 여기서 알린다.
 *
 * 말없이 덮어쓰지는 않는다 — 사용자가 규칙을 고쳐 뒀을 수 있다.
 */
export default function TemplateBanner({
  root,
  onUpgraded,
}: {
  root: string
  onUpgraded: () => void
}) {
  const [status, setStatus] = useState<TemplateStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    try {
      setStatus(await checkTemplates(root))
    } catch {
      setStatus(null)
    }
  }, [root])

  useEffect(() => {
    setDismissed(false)
    void check()
  }, [check])

  if (!status || dismissed || status.outdated.length === 0) return null

  const { outdated, modified } = status

  async function upgrade() {
    setBusy(true)
    try {
      await upgradeTemplates(root, outdated)
      setDismissed(true)
      onUpgraded()
      await check()
    } catch (e) {
      alert(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="template-banner">
      <div className="msg">
        <strong>집필 규칙이 갱신되었습니다.</strong>{' '}
        {outdated.join(', ')} 을(를) 최신으로 바꿀 수 있습니다.
        {modified.length > 0 && (
          <div className="warn">
            {modified.join(', ')} 은(는) 직접 수정하신 것으로 보입니다. 갱신하면 지금
            내용은 <code>archive/</code> 에 백업됩니다.
          </div>
        )}
      </div>
      <button onClick={() => void upgrade()} disabled={busy}>
        {busy ? '갱신 중…' : '갱신'}
      </button>
      <button className="ghost" onClick={() => setDismissed(true)} disabled={busy}>
        나중에
      </button>
    </div>
  )
}
