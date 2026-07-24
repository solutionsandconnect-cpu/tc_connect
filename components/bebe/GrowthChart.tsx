'use client'

/**
 * Courbe de croissance (poids ou taille) — SVG à la main.
 *
 * Le projet n'embarque aucune librairie de graphiques et une courbe à 5-20 points
 * n'en justifie pas une (recharts ≈ 100 ko gzip pour ça). Le viewBox est fixe et
 * le SVG s'étire en largeur : les proportions sont conservées, le texte reste net.
 */

export interface GrowthPoint {
  /** Date de la mesure */
  date: Date
  /** Valeur dans l'unité affichée (kg ou cm) */
  value: number
  /** Repère « Naissance » : point d'origine repris des infos de naissance */
  origine?: boolean
}

interface Props {
  points: GrowthPoint[]
  /** Unité affichée sur l'axe (ex. « kg », « cm ») */
  unite: string
  /** Couleur de la courbe (valeur CSS) */
  couleur: string
  /** Décimales des valeurs affichées */
  decimales?: number
}

const W = 320, H = 150
const PAD = { top: 12, right: 10, bottom: 22, left: 34 }

const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

export function GrowthChart({ points, unite, couleur, decimales = 1 }: Props) {
  const fmt = (v: number) => v.toFixed(decimales).replace('.', ',')

  if (points.length === 0) {
    return <p className="text-sm text-gray-400 italic py-6 text-center">Aucune mesure pour l&apos;instant.</p>
  }

  const tris = [...points].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = tris[0].date.getTime()
  const t1 = tris[tris.length - 1].date.getTime()
  const vMin = Math.min(...tris.map(p => p.value))
  const vMax = Math.max(...tris.map(p => p.value))

  // Marge verticale de 10 % pour que la courbe ne colle ni au haut ni au bas.
  // Cas d'une seule valeur (ou valeurs identiques) : on ouvre une plage arbitraire
  // autour, sinon la division par zéro écrase tout sur une ligne.
  const span = vMax - vMin
  const marge = span > 0 ? span * 0.1 : Math.max(vMax * 0.05, 0.5)
  const yMin = vMin - marge
  const yMax = vMax + marge

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (d: Date) => PAD.left + (t1 === t0 ? innerW / 2 : ((d.getTime() - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const ligne = tris.map(p => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const graduations = [yMax, (yMax + yMin) / 2, yMin]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {/* Grille + valeurs de l'axe vertical */}
      {graduations.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{fmt(v)}</text>
        </g>
      ))}

      {/* Courbe */}
      {tris.length > 1 && (
        <polyline points={ligne} fill="none" stroke={couleur} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Points : la naissance est creuse pour la distinguer des mesures saisies */}
      {tris.map((p, i) => (
        <circle key={i} cx={x(p.date)} cy={y(p.value)} r={3}
          fill={p.origine ? '#fff' : couleur} stroke={couleur} strokeWidth={1.5} />
      ))}

      {/* Dernière valeur en clair */}
      <text x={W - PAD.right} y={PAD.top - 2} textAnchor="end" fontSize={9} fontWeight={600} fill={couleur}>
        {fmt(tris[tris.length - 1].value)} {unite}
      </text>

      {/* Axe horizontal : première et dernière date (au-delà, ça se chevauche) */}
      <text x={PAD.left} y={H - 6} fontSize={8} fill="#94a3b8">{fmtDate(tris[0].date)}</text>
      {tris.length > 1 && (
        <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={8} fill="#94a3b8">
          {fmtDate(tris[tris.length - 1].date)}
        </text>
      )}
    </svg>
  )
}
