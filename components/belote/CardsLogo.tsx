'use client'

/** Logo "jeu de cartes" : deux cartes superposées (pique + cœur) */
export default function CardsLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Carte arrière (inclinée) */}
      <g transform="rotate(-12 16 26)">
        <rect x="6" y="12" width="22" height="30" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Pique noir */}
        <path d="M17 19c-2.4 2.6-4.4 4-4.4 6.1 0 1.5 1.1 2.5 2.4 2.5.8 0 1.5-.4 2-1 .5.6 1.2 1 2 1 1.3 0 2.4-1 2.4-2.5 0-2.1-2-3.5-4.4-6.1z" fill="#1f2937" />
        <path d="M17 26.5c0 1.5-.4 2.6-1.4 3.4h2.8c-1-.8-1.4-1.9-1.4-3.4z" fill="#1f2937" />
      </g>
      {/* Carte avant */}
      <g transform="rotate(8 30 26)">
        <rect x="20" y="10" width="22" height="30" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Cœur rouge */}
        <path d="M31 30c-3.2-2.6-5.2-4.3-5.2-6.6 0-1.6 1.2-2.7 2.7-2.7 1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3 1.5 0 2.7 1.1 2.7 2.7 0 2.3-2 4-5.2 6.6z" fill="#ef4444" />
      </g>
    </svg>
  )
}
