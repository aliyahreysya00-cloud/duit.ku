/**
 * Maskot duit.ku — ayam kecil yang bereaksi sesuai mood
 * mood: 'happy' | 'neutral' | 'sad' | 'excited'
 */
export default function Mascot({ mood = 'neutral', size = 64, className = '' }) {
  const expressions = {
    happy:   { eyes: '≧◡≦', color: '#FFB347', message: 'Yeay nabung terus! 🎉' },
    excited: { eyes: '★◡★', color: '#FF8C69', message: 'Wihh, target tercapai! 🥳' },
    neutral: { eyes: '•‿•',  color: '#FFB347', message: 'Hai, gimana keuanganmu hari ini?' },
    sad:     { eyes: '◕︵◕', color: '#C4A882', message: 'Eh, jajannya agak banyak nih... 🥺' },
  }

  const { eyes, color } = expressions[mood] || expressions.neutral

  return (
    <div
      className={`mascot mascot--${mood} ${className}`}
      aria-label={`Maskot duit.ku sedang ${mood}`}
      role="img"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Badan */}
        <ellipse cx="50" cy="62" rx="28" ry="25" fill={color} />
        {/* Kepala */}
        <circle cx="50" cy="35" r="22" fill={color} />
        {/* Jengger */}
        <path d="M44 15 Q47 8 50 13 Q53 6 56 13 Q59 8 60 15" fill="#FF6B6B" />
        {/* Paruh */}
        <path d="M46 40 Q50 45 54 40" fill="#FF8C00" strokeWidth="1" />
        {/* Sayap kiri */}
        <ellipse
          cx="24"
          cy="65"
          rx="10"
          ry="7"
          fill={color}
          transform="rotate(-20 24 65)"
          opacity="0.85"
        />
        {/* Sayap kanan */}
        <ellipse
          cx="76"
          cy="65"
          rx="10"
          ry="7"
          fill={color}
          transform="rotate(20 76 65)"
          opacity="0.85"
        />
        {/* Kaki */}
        <line x1="42" y1="86" x2="38" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />
        <line x1="58" y1="86" x2="62" y2="95" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" />
        {/* Mata — berubah sesuai mood */}
        {mood === 'sad' ? (
          <>
            <path d="M40 32 Q43 29 46 32" stroke="#5C3D1E" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M54 32 Q57 29 60 32" stroke="#5C3D1E" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* air mata */}
            <ellipse cx="41" cy="35" rx="2" ry="3" fill="#AED9F0" opacity="0.8" />
          </>
        ) : mood === 'excited' ? (
          <>
            <text x="38" y="38" fontSize="10" fill="#5C3D1E">★</text>
            <text x="52" y="38" fontSize="10" fill="#5C3D1E">★</text>
          </>
        ) : mood === 'happy' ? (
          <>
            <path d="M38 31 Q41 28 44 31" stroke="#5C3D1E" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M56 31 Q59 28 62 31" stroke="#5C3D1E" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="42" cy="33" r="3.5" fill="#5C3D1E" />
            <circle cx="58" cy="33" r="3.5" fill="#5C3D1E" />
            <circle cx="43" cy="32" r="1" fill="white" />
            <circle cx="59" cy="32" r="1" fill="white" />
          </>
        )}
      </svg>
    </div>
  )
}
