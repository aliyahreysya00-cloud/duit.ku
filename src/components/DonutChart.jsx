/**
 * DonutChart — SVG murni, zero dependency
 * Props:
 *   data: [{ label, value, color }]
 *   size?: number (default 160)
 *   centerLabel?: string
 *   centerValue?: string
 */
export default function DonutChart({ data = [], size = 160, centerLabel = 'Total', centerValue = '' }) {
  const radius      = 54
  const strokeWidth = 22
  const cx          = size / 2
  const cy          = size / 2
  const circumference = 2 * Math.PI * radius

  // Filter data yang > 0
  const filtered = data.filter((d) => d.value > 0)
  const total    = filtered.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Belum ada data">
          <circle cx={cx} cy={cy} r={radius}
            fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={strokeWidth} />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="rgba(255,255,255,.3)"
            fontSize="11" fontFamily="var(--ff)">Belum ada</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,.2)"
            fontSize="11" fontFamily="var(--ff)">pengeluaran</text>
        </svg>
      </div>
    )
  }

  // Hitung segments
  let offset = circumference * 0.25 // mulai dari atas (12 o'clock)
  const segments = filtered.map((d) => {
    const pct  = d.value / total
    const dash = pct * circumference
    const gap  = circumference - dash
    const seg  = { ...d, pct, dash, gap, offset }
    offset += dash + 2 // 2px gap antar segment
    return seg
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      {/* Chart */}
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
        aria-label="Donut chart pengeluaran per kategori"
        role="img"
      >
        {/* Track */}
        <circle cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="rgba(255,255,255,.06)"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-seg.offset + circumference * 0.25}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }}
          />
        ))}

        {/* Center text — rotate balik karena SVG diputar */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          fill="rgba(255,255,255,.5)"
          fontSize="10"
          fontFamily="var(--ff)"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
        >
          {centerLabel}
        </text>
        <text
          x={cx} y={cy + 10}
          textAnchor="middle"
          fill="white"
          fontSize="13"
          fontWeight="700"
          fontFamily="var(--ff)"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}
        >
          {centerValue}
        </text>
      </svg>

      {/* Legend */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: seg.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: '0.78rem', color: 'rgba(255,255,255,.7)' }}>
              {seg.label}
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {Math.round(seg.pct * 100)}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,.45)', minWidth: 60, textAlign: 'right' }}>
              {seg.formattedValue}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
