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
3. Spécialités réelles et type de clientèle : particuliers ou professionnels, neuf ou rénovation, dépannage ou chantiers longs.
4. Présence en ligne : site web, réseaux sociaux, avis clients. Pour les avis, relève les THÈMES RÉCURRENTS, en particulier ce qui touche aux délais, aux devis, aux rendez-vous manqués ou à la communication.
5. Indices d'outillage informatique : logiciel de gestion ou de devis mentionné quelque part, prise de rendez-vous en ligne, espace client, offres d'emploi citant un outil précis.
6. Actualités récentes : certifications (RGE, Qualibat), partenariats, changements notables.

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

- Une section « PHRASE DE PERSONNALISATION » : UNE seule phrase, factuelle et vérifiable, que je pourrai mettre en tête de mon mail pour montrer que je me suis renseigné. Pas de flatterie, pas de superlatif, rien d'inventé.
- Si rien de solide ne ressort, écris « aucune phrase fiable possible » — je préfère ça à une phrase creuse.`
}
