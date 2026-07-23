// Prompt de recherche préalable à un envoi de prospection.
//
// L'app sait ce que dit le registre (effectif en tranche, activité, état) ; elle
// ne sait rien du réel — combien de personnes travaillent vraiment là, si le
// patron a déjà un logiciel, ce que disent ses clients. Ce prompt sert à confier
// cette recherche à un assistant IA, puis à en tirer la ligne de personnalisation.
//
// ⚠️ Le garde-fou anti-invention n'est pas décoratif : la phrase produite part
// dans un vrai mail, à une vraie entreprise, qui saura immédiatement si on lui
// prête un chantier ou une certification qu'elle n'a pas. Une personnalisation
// fausse est pire que pas de personnalisation du tout.

import { libelleEffectif } from '@/lib/sirene'
import type { Prospect } from '@/types'

export function construirePromptRecherche(p: Prospect): string {
  const connu: string[] = [`- Raison sociale : ${p.societe}`]
  if (p.ville || p.codePostal) {
    connu.push(`- Localisation : ${[p.codePostal, p.ville].filter(Boolean).join(' ')}`)
  }
  if (p.siret) connu.push(`- SIRET : ${p.siret}`)
  else if (p.siren) connu.push(`- SIREN : ${p.siren}`)
  if (p.metier) connu.push(`- Corps de métier ciblé : ${p.metier}`)
  if (p.activiteNaf) connu.push(`- Code d'activité (NAF) : ${p.activiteNaf}`)
  if (p.effectifCode) {
    connu.push(`- Tranche d'effectif déclarée à l'INSEE : ${libelleEffectif(p.effectifCode)}`
      + (p.effectifAnnee ? ` (${p.effectifAnnee})` : ''))
  }
  if (p.email) connu.push(`- Adresse de contact connue : ${p.email}`)
  if (p.telephone) connu.push(`- Téléphone connu : ${p.telephone}`)
  if (p.logicielActuel) connu.push(`- Logiciel déjà identifié : ${p.logicielActuel}`)

  return `Tu m'aides à préparer une prise de contact commerciale auprès d'une entreprise du bâtiment.
Je développe des outils de gestion sur mesure (plannings, suivi de chantier, devis, comptes rendus client).

CE QUE JE SAIS DÉJÀ
${connu.join('\n')}

CE QUE JE CHERCHE
1. Taille et organisation réelles. C'est le point le plus important, parce qu'il décide du message que je vais écrire :
   - combien de personnes travaillent dans l'entreprise, et combien sur le terrain ;
   - y a-t-il un bureau distinct des équipes de chantier ?
   - y a-t-il quelqu'un dont c'est le métier de planifier, gérer les devis ou l'administratif (assistante, chargé de planning, responsable d'exploitation, conjoint(e) qui gère la gestion), ou bien le dirigeant fait-il tout lui-même ?
   - qui répond au téléphone et qui reçoit les mails : le dirigeant, ou quelqu'un d'autre ?
2. Ancienneté, dirigeant(s), et signes de croissance récente (recrutements en cours, nouveaux locaux, nouvelle agence).

3. Santé et trajectoire économiques, si les comptes sont publiés (INPI, Pappers, Societe.com, Infogreffe) :
   - le CHIFFRE D'AFFAIRES annuel, et surtout son ÉVOLUTION sur les 3 derniers exercices : en croissance, stable, en recul ?
   - l'évolution du NOMBRE DE SALARIÉS sur la même période ;
   - le ratio CHIFFRE D'AFFAIRES PAR SALARIÉ, et sa tendance. Le chiffre d'affaires seul ne dit pas grand-chose : 800 000 € à trois personnes ou à douze, ce n'est pas la même entreprise.
   Ce que je cherche à lire là-dedans : une entreprise qui embauche plus vite que son chiffre d'affaires ne progresse est en train de perdre en efficacité — c'est souvent le moment où l'organisation craque et où un outil devient nécessaire. À l'inverse, un chiffre d'affaires par salarié qui monte indique une entreprise qui tient sa croissance.
   ⚠️ Beaucoup de TPE ne déposent pas leurs comptes, ou en demandent la confidentialité : dans ce cas écris « comptes non publiés » et n'invente aucun chiffre. Ne compare à une moyenne de secteur que si tu peux la sourcer.
4. Spécialités réelles et type de clientèle : particuliers ou professionnels, neuf ou rénovation, dépannage ou chantiers longs.
5. Présence en ligne : site web, réseaux sociaux, avis clients. Pour les avis, relève les THÈMES RÉCURRENTS, en particulier ce qui touche aux délais, aux devis, aux rendez-vous manqués ou à la communication.
6. Indices d'outillage informatique : logiciel de gestion ou de devis mentionné quelque part, prise de rendez-vous en ligne, espace client, offres d'emploi citant un outil précis.
7. Actualités récentes : certifications (RGE, Qualibat), partenariats, changements notables.

RÈGLES STRICTES
- Ne donne que ce que tu peux SOURCER. Indique l'URL à côté de chaque information.
- Si tu ne trouves pas une information, écris « non trouvé ». N'invente rien et ne déduis rien de « plausible » : une donnée vraisemblable mais fausse me fera écrire une bêtise à un vrai chef d'entreprise.
- Sépare clairement ce qui est CONFIRMÉ par une source de ce qui n'est qu'une HYPOTHÈSE.
- Attention aux homonymes : beaucoup d'entreprises du bâtiment portent le même nom dans des départements différents. Vérifie que ce que tu trouves correspond bien à la localisation ci-dessus, et signale-le si tu as un doute.

CE QUE JE VEUX EN SORTIE
- Une fiche courte et factuelle, point par point.

- Une section « ANGLE À PRIVILÉGIER ». Mon message par défaut parle de la SURCHARGE DU DIRIGEANT : le planning refait le soir, le téléphone qui sonne toute la journée depuis les chantiers, le temps qui se perd entre les chantiers plutôt que sur les chantiers. Cet angle porte tant que le patron fait tout lui-même — c'est le cas de la grande majorité des artisans.
  Mais dès qu'il y a un bureau et quelqu'un dont c'est le métier de planifier, cet angle tombe à plat : cette entreprise a déjà réglé le problème de la surcharge, elle a un problème de CIRCULATION DE L'INFORMATION — le planning fait au bureau que le chantier ne voit pas, les heures reconstituées en fin de mois sur des feuilles papier, le coût réel d'un chantier connu une fois qu'il est terminé.
  Dis-moi donc lequel des deux angles colle à CETTE entreprise, et sur quel élément factuel tu t'appuies pour le dire. Si tu n'as pas assez d'éléments sur son organisation, dis « je ne sais pas » : je partirai sur l'angle par défaut, qui est le bon dans le doute.

- ENFIN, tout à la fin de ta réponse, ajoute un BLOC RÉCAPITULATIF que je vais copier-coller tel quel dans mon logiciel pour remplir la fiche automatiquement. Respecte EXACTEMENT ce format : les deux délimiteurs chacun sur leur propre ligne, une clé par ligne, et chaque valeur tenant sur UNE SEULE ligne (condense si besoin, ne va JAMAIS à la ligne à l'intérieur d'une valeur — ni tableau, ni puce, ni saut de ligne). N'écris rien après le bloc. Ne reprends dans ce bloc QUE ce que ta fiche a établi plus haut. Si une information est inconnue, mets « inconnu » (ou « aucun » pour logiciel/site/réseaux/certifications). Pour "angle", un seul mot : surcharge, circulation ou inconnu.

===ENEZO-FICHE===
dirigeant: <nom de la personne à qui écrire, ou "inconnu">
angle: <surcharge | circulation | inconnu>
effectif: <ex: 8 personnes dont 6 sur le terrain, ou "inconnu">
organisation: <ex: le dirigeant gère tout | bureau d'études + conduite de travaux + terrain, ou "inconnu">
anciennete: <année de création et/ou ancienneté, ou "inconnu">
zone: <zone géographique d'intervention, ou "inconnu">
specialites: <spécialités et types de chantiers, ou "inconnu">
croissance: <signes de croissance ou trajectoire récente, ou "inconnu">
sante: <santé économique SI les comptes sont publiés, sinon "comptes non publiés">
logiciel: <logiciel de gestion/devis/chantier en place, ou "aucun">
site: <url du site principal, ou "aucun">
reseaux: <réseaux sociaux et plateformes d'avis, ou "aucun">
certifications: <RGE, Qualibat, labels, agréments, ou "aucun">
avis: <thèmes récurrents des avis clients (surtout délais / devis / communication), ou "aucun">
resume: <2 ou 3 phrases factuelles résumant l'entreprise, sur une seule ligne>
===FIN-FICHE===`
}

export type FicheEtude = {
  personnalisation?: string
  dirigeant?: string
  angle?: 'surcharge' | 'circulation' | 'inconnu'
  logicielActuel?: string
  etudeResume?: string
}

// Valeurs que l'IA écrit quand elle n'a rien trouvé : à traiter comme « vide ».
const VALEURS_VIDES = new Set(['', 'aucun', 'aucune', 'inconnu', 'inconnue', 'non trouvé', 'non trouve', 'n/a', 'na', '-', '—', '?'])

function estVide(v: string): boolean {
  return VALEURS_VIDES.has(v.trim().toLowerCase())
}

/**
 * Extrait la fiche du RÉCAPITULATIF collé (réponse complète de l'IA ou juste le
 * bloc). Tolérant : on isole le bloc `===ENEZO-FICHE=== … ===FIN-FICHE===` s'il
 * est là, sinon on parse le texte entier ligne à ligne. Renvoie null si rien
 * d'exploitable — l'app pourra alors prévenir plutôt que d'écrire du vide.
 */
export function parserFicheEtude(texte: string): FicheEtude | null {
  if (!texte?.trim()) return null
  const bloc = texte.match(/===\s*ENEZO-FICHE\s*===([\s\S]*?)===\s*FIN-?FICHE\s*===/i)
  const corps = bloc ? bloc[1] : texte

  const paires = new Map<string, string>()
  for (const ligne of corps.split(/\r?\n/)) {
    const m = ligne.match(/^\s*[-*]?\s*([A-Za-zÀ-ſ_]+)\s*:\s*(.+?)\s*$/)
    if (!m) continue
    const cle = m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (!paires.has(cle)) paires.set(cle, m[2].trim())
  }
  if (paires.size === 0) return null

  const val = (k: string) => {
    const v = paires.get(k)
    return v && !estVide(v) ? v : undefined
  }

  const fiche: FicheEtude = {}
  const perso = val('personnalisation')
  if (perso) fiche.personnalisation = perso

  const dirigeant = val('dirigeant')
  if (dirigeant) fiche.dirigeant = dirigeant

  const angleRaw = (paires.get('angle') ?? '').toLowerCase()
  if (angleRaw.includes('surcharge')) fiche.angle = 'surcharge'
  else if (angleRaw.includes('circulation')) fiche.angle = 'circulation'
  else if (angleRaw.includes('inconnu')) fiche.angle = 'inconnu'

  const logiciel = val('logiciel')
  if (logiciel) fiche.logicielActuel = logiciel

  // Fiche compilée : le résumé d'abord, puis chaque rubrique renseignée. Tout ce
  // que le bloc ramène est conservé — c'est ce qui manquait avant.
  const lignes: string[] = []
  const ajoute = (cle: string, prefixe: string) => {
    const v = val(cle)
    if (v) lignes.push(prefixe ? `${prefixe} : ${v}` : v)
  }
  ajoute('resume', '')
  ajoute('effectif', 'Effectif')
  ajoute('organisation', 'Organisation')
  ajoute('anciennete', 'Ancienneté')
  ajoute('zone', 'Zone')
  ajoute('specialites', 'Spécialités')
  ajoute('croissance', 'Croissance')
  ajoute('sante', 'Santé éco')
  ajoute('site', 'Site')
  ajoute('reseaux', 'Réseaux')
  ajoute('certifications', 'Certifications')
  ajoute('avis', 'Avis')
  if (lignes.length) fiche.etudeResume = lignes.join('\n')

  if (
    !fiche.personnalisation && !fiche.dirigeant && !fiche.angle &&
    !fiche.logicielActuel && !fiche.etudeResume
  ) {
    return null
  }
  return fiche
}
