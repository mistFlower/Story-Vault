import { useState } from 'react'
import { PLATFORM_LABEL, PLATFORM_ORDER } from '../lib/platform'
import type { Platform } from '../lib/count'

/**
 * 폴더를 처음 열 때 한 번 나오는 플랫폼 선택.
 *
 * 한 번 정하면 바꿀 수 없다. 노벨피아는 글자 수, 조아라는 KB 로 분량
 * 산정 단위가 달라서, 연재 중에 바꾸면 이미 쓴 회차들이 기준에서
 * 어긋나 버리기 때문이다.
 */
const NOTE: Record<Platform, string> = {
  novelpia: '글자 수 기준 · 회차당 3,300~4,200자',
  joara: 'KB 용량 기준 · 회차당 10KB 이상, 평균 12KB 이상',
}

export default function PlatformSetup({
  vaultName,
  onConfirm,
  onCancel,
}: {
  vaultName: string
  onConfirm: (platforms: Platform[]) => void
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<Platform[]>([])
  const [busy, setBusy] = useState(false)

  const toggle = (p: Platform) =>
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  const both = picked.length === 2

  return (
    <div className="setup-backdrop">
      <div className="setup">
        <h2>연재 플랫폼 선택</h2>
        <p className="sub">
          <code>{vaultName}</code> 을(를) 어느 플랫폼에 연재하시나요?
        </p>

        <div className="choices">
          {PLATFORM_ORDER.map((p) => (
            <label key={p} className={picked.includes(p) ? 'choice on' : 'choice'}>
              <input
                type="checkbox"
                checked={picked.includes(p)}
                onChange={() => toggle(p)}
              />
              <span className="name">{PLATFORM_LABEL[p]}</span>
              <span className="desc">{NOTE[p]}</span>
            </label>
          ))}
        </div>

        {both && (
          <p className="info">
            두 곳에 동시 연재하면 한 회차가 <strong>양쪽 기준을 모두</strong> 만족해야
            합니다. 조아라 기준이 더 길어서, 조아라를 맞추면 노벨피아는 대체로 넘습니다.
          </p>
        )}

        <p className="warn">
          <strong>한 번 정하면 앱에서 바꿀 수 없습니다.</strong> 두 플랫폼은 분량 산정
          단위가 달라, 연재 도중 바꾸면 이미 쓴 회차가 기준에서 어긋납니다.
        </p>

        <div className="row">
          <button
            className="primary"
            disabled={picked.length === 0 || busy}
            onClick={() => {
              setBusy(true)
              onConfirm(picked)
            }}
          >
            {busy ? '설정 중…' : '확정'}
          </button>
          <button className="ghost" onClick={onCancel} disabled={busy}>
            나중에
          </button>
        </div>
      </div>
    </div>
  )
}
