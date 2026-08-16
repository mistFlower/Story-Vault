import { countAll, judge, remaining, THRESHOLDS, type Platform } from '../lib/count'

const LABEL: Record<Platform, string> = {
  novelpia: '노벨피아',
  joara: '조아라',
}

function Gauge({ platform, text }: { platform: Platform; text: string }) {
  const counts = countAll(text)
  const t = THRESHOLDS[platform]
  const verdict = judge(platform, counts)
  const value = platform === 'novelpia' ? counts.novelpia : counts.joaraKb
  const short = remaining(platform, counts)

  const shown =
    platform === 'novelpia'
      ? value.toLocaleString('ko-KR')
      : value.toFixed(1)

  // 목표 상한을 100%로 본 진행률.
  const pct = Math.min(100, (value / t.targetHigh) * 100)
  const minPct = Math.min(100, (t.min / t.targetHigh) * 100)

  return (
    <div className={`gauge ${verdict}`}>
      <div className="gauge-head">
        <span className="platform">{LABEL[platform]}</span>
        <span className="value">
          {shown}
          <span className="unit">{t.unit}</span>
        </span>
        <span className="verdict">
          {verdict === 'below' && `${platform === 'novelpia' ? Math.ceil(short).toLocaleString('ko-KR') : short.toFixed(1)}${t.unit} 부족`}
          {verdict === 'ok' && '목표 충족'}
          {verdict === 'above' && '목표 초과'}
        </span>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="min-mark" style={{ left: `${minPct}%` }} title={`플랫폼 최소 ${t.min}${t.unit}`} />
      </div>
      <div className="range">
        목표 {t.targetLow}–{t.targetHigh}
        {t.unit} · 최소 {t.min}
        {t.unit}
      </div>
    </div>
  )
}

export default function CountBar({ text }: { text: string }) {
  const counts = countAll(text)

  return (
    <footer className="countbar">
      <Gauge platform="novelpia" text={text} />
      <Gauge platform="joara" text={text} />
      <div className="raw">
        <div>
          <span>전체</span>
          {counts.raw.toLocaleString('ko-KR')}자
        </div>
        <div>
          <span>공백 제외</span>
          {counts.withoutSpaces.toLocaleString('ko-KR')}자
        </div>
        <div>
          <span>UTF-8</span>
          {(counts.utf8Bytes / 1024).toFixed(1)}KB
        </div>
      </div>
    </footer>
  )
}
