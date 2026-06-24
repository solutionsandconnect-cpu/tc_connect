import type { PilotageContrat, FactureItem, DevisOption, Facture, Client, ChartGraphique } from '@/types'
import { computeTarif, stateFromEstimation, fmtEur } from '@/lib/pilotageEstimateur'
import { itemNetTotal } from '@/lib/invoiceHtml'

// Libellé d'offre lisible depuis le type de projet + plateformes de la charte.
function offreTypeLabel(charte?: ChartGraphique): string {
  const t = charte?.typeProjet
  if (t === 'site_web' || t === 'app_web') return 'site web'
  if (t === 'autre') return charte?.typeAutre?.trim() || 'solution numérique'
  const plats = charte?.plateformes ?? []
  const web = plats.includes('web')
  const mob = plats.includes('ios') || plats.includes('android')
  const suffix = web && mob ? ' web & mobile' : mob ? ' mobile' : web ? ' web' : ''
  return `application${suffix}`
}

// Objet « offre » généré quand le contrat n'a pas d'objet de devis saisi.
// Décrit CE QU'ON VEND (et non le contexte/besoin du client), façon devis Diambars.
export function buildObjetAuto(contrat: PilotageContrat): string {
  const charte = contrat.charte
  const nom = charte?.nomProjet?.trim() || contrat.clientNom || 'votre projet'
  const type = offreTypeLabel(charte)
  const cible = charte?.publicCible?.trim()
  const frais = contrat.fraisMiseEnPlace ?? 0
  const abo = contrat.abonnementMensuel ?? 0

  const verbe = abo > 0 ? 'Mise en service et exploitation' : 'Conception et mise en service'
  const p1 = `${verbe} de « ${nom} » — ${type}${cible ? ` à destination de ${cible}` : ''}.`

  let structure: string
  if (frais > 0 && abo > 0)
    structure = "La présente offre porte sur une mise en service forfaitaire, suivie d'un abonnement mensuel incluant l'hébergement et la maintenance."
  else if (abo > 0)
    structure = "La présente offre porte sur un abonnement mensuel incluant l'hébergement et la maintenance."
  else
    structure = 'La présente offre porte sur une prestation forfaitaire de conception et de mise en service.'

  return `${p1}\n\n${structure}`
}

// Bandeau « valeur » auto (ROI) depuis l'estimation validée du contrat — null si pas d'estimation
// exploitable. Sert de défaut à la génération ET de placeholder dans l'UI. Les jours de
// conception et le nb de modules sont volontairement absents des stats (« sous-vendent »).
export function buildValeurBannerAuto(contrat: PilotageContrat): NonNullable<Facture['valeurBanner']> | null {
  const est =
    contrat.estimations?.find((e) => e.id === contrat.estimationSelectedId) ??
    contrat.estimations?.[0] ??
    contrat.estimation
  if (!est) return null
  const t = computeTarif(stateFromEstimation(est))
  if (t.valeurAn <= 0) return null
  const revente = est.mode === 'revente'
  const stats: { value: string; label: string }[] = []
  if (t.paybackMois != null && t.paybackMois > 0) {
    stats.push({ value: `${Math.ceil(t.paybackMois)} mois`, label: 'de retour sur investissement' })
  }
  // L'ancrage « valeur de conception » (creationBas–setup, = jours×TJM ± marge) n'aide
  // que s'il est NETTEMENT supérieur au prix payé (mise en service) : sinon il égale le
  // prix et devient contre-productif. On ne l'affiche donc qu'au-delà de ×1,5.
  const prix = contrat.fraisMiseEnPlace ?? 0
  const showConception = t.creationBas >= prix * 1.5
  const concept = showConception ? `${fmtEur(t.creationBas)} – ${fmtEur(t.setup)}` : ''
  return {
    titre: 'Application sur-mesure, conçue pour votre activité',
    sousTitre: revente ? 'Un actif que vous pouvez exploiter et revendre' : 'Un outil construit pour vous, pas un logiciel générique',
    montant: `≈ ${fmtEur(t.valeurAn)}`,
    mention: revente ? 'REVENU POTENTIEL / AN' : 'VALEUR GÉNÉRÉE ESTIMÉE / AN',
    texte: revente
      ? `Estimation du revenu annuel potentiel sur la base des hypothèses de cadrage (${est.nbClientsFinaux} clients × ${fmtEur(est.prixReventeMensuel)}/mois).${concept ? ` Le développement, déjà réalisé, représente une valeur de conception d'environ ${concept}.` : ''}`
      : `Valeur estimée du temps gagné chaque année grâce à l'application, sur la base des hypothèses de cadrage.${concept ? ` La conception sur-mesure représente une valeur d'environ ${concept}.` : ''}`,
    stats,
  }
}

// Construit le payload d'un devis de prestation à partir d'un contrat Pilotage.
// Toutes les données viennent du contrat (objet, lignes, inclus, options, modalités) → aucune ressaisie.
// Renvoie l'objet attendu par createFacture (sans id/number/status/createdAt/updatedAt).
export function buildDevisFromContrat(
  contrat: PilotageContrat,
  opts: { userId: string; client?: Client | null; companyId?: string; companyNom?: string },
): Omit<Facture, 'id' | 'number' | 'status' | 'createdAt' | 'updatedAt'> {
  const projet = contrat.projet
  const legal = contrat.legal
  const charte = contrat.charte
  const nomProjet = charte?.nomProjet?.trim() || contrat.clientNom

  // ── Lignes : mise en service (one-off) + abonnement (récurrent) ──
  const items: FactureItem[] = []
  const frais = contrat.fraisMiseEnPlace ?? 0
  const abo = contrat.abonnementMensuel ?? 0
  const remMS = contrat.remiseMiseEnPlacePct ?? 0   // remise % sur la mise en service
  const remAbo = contrat.remiseAbonnementPct ?? 0   // remise % sur l'abonnement
  if (frais > 0) {
    items.push({
      label: 'Mise en service',
      quantity: 1,
      price: frais,
      recurrence: 'unique',
      ...(remMS > 0 ? { discountType: 'percent' as const, discountValue: remMS } : {}),
      description:
        contrat.miseEnServiceDesc?.trim() ||
        (projet?.livrables ?? []).filter((l) => l.trim()).join(' · ') ||
        undefined,
    })
  }
  if (abo > 0) {
    items.push({
      label: 'Abonnement mensuel — hébergement & maintenance',
      quantity: 12,
      price: abo,
      recurrence: 'mensuel',
      ...(remAbo > 0 ? { discountType: 'percent' as const, discountValue: remAbo } : {}),
      description:
        contrat.abonnementDesc?.trim() ||
        'Hébergement, maintenance corrective, support et petites évolutions. Engagement initial de 12 mois, reconductible.',
    })
  }
  if (items.length === 0) {
    items.push({ label: nomProjet || 'Prestation', quantity: 1, price: 0, recurrence: 'unique' })
  }
  const total = items.reduce((s, i) => s + itemNetTotal(i), 0)   // net après remise

  // ── Objet : champ dédié saisi, sinon phrase d'offre générée (PAS le contexte brut) ──
  const objet = contrat.objetDevis?.trim() || buildObjetAuto(contrat)

  // ── Ce qui est inclus ──
  // Checklist « modules livrés » = fonctionnalités du projet.
  const inclus = (projet?.fonctionnalites ?? [])
    .map((f) => f.description?.trim() || f.categorie?.trim() || '')
    .filter((s) => s)
  // Panneaux titrés : Mise en service (livrables) + Abonnement (si récurrent).
  const livrables = (projet?.livrables ?? []).filter((l) => l.trim())
  const inclusPanels: { titre: string; items: string[] }[] = []
  if (livrables.length) inclusPanels.push({ titre: 'Mise en service', items: livrables })
  if (abo > 0) {
    inclusPanels.push({
      titre: 'Abonnement mensuel',
      items: [
        "Hébergement de l'application",
        'Maintenance corrective & mises à jour de sécurité',
        'Monitoring & sauvegardes',
        "Support & correction d'anomalies",
        'Petites évolutions au fil de l\'eau',
      ],
    })
  }

  // ── Bandeau « valeur » (ROI) : auto depuis l'estimation, simplement masquable ──
  const valeurBanner: Facture['valeurBanner'] | undefined =
    contrat.valeurBannerOverride?.masque ? undefined : (buildValeurBannerAuto(contrat) ?? undefined)

  // ── Options à la carte : depuis le contrat ──
  const options: DevisOption[] = (contrat.optionsDevis ?? []).filter((o) => (o.label ?? '').trim())

  // ── Modalités : paiement (étalement = moins « impressionnant ») puis mentions légales ──
  const modalites: { label: string; value: string }[] = []
  const addMod = (label: string, value?: string) => { if (value && value.trim()) modalites.push({ label, value: value.trim() }) }
  if (frais > 0) addMod('Paiement — mise en service', 'Forfait payable à la mise en service.')
  if (abo > 0) addMod('Paiement — abonnement', `Mensuel (${fmtEur(abo)}/mois), sur engagement initial de 12 mois. Hébergement & maintenance inclus.`)
  if (abo > 0) addMod('Reconduction & résiliation', "À l'issue de l'engagement initial, reconduction par périodes de 12 mois, sauf résiliation par l'une des parties avec un préavis de 2 mois. Révision tarifaire annuelle possible, communiquée à l'avance.")
  if (abo > 0) {
    const inclus = contrat.hebergement?.utilisateursInclus ?? charte?.usersMax
    const audela = contrat.hebergement?.depassement?.trim()
      || "les coûts d'infrastructure supplémentaires sont refacturés au réel ou l'abonnement est réajusté, après information préalable."
    addMod('Hébergement & quotas', `L'abonnement inclut l'hébergement et l'usage normal de l'application${inclus ? ` (jusqu'à ${inclus} utilisateurs actifs)` : ''}. Au-delà, ${audela}`)
  }
  // Dérivées des mentions légales (ne s'affichent que si renseignées dans le contrat).
  addMod('Délai', legal?.duree)
  addMod('Propriété intellectuelle', legal?.etendueDroits)
  addMod('Exclusivité', legal?.exclusivite)
  addMod('Territoire', legal?.territoire)
  addMod('Ajustements inclus', legal?.ajustementsInclus)
  // RGPD : uniquement si le contrat décrit un traitement de données personnelles.
  if (legal?.finalites?.trim() || legal?.donneesTraitees?.trim()) {
    addMod('RGPD', `Le Client est responsable de traitement ; ${opts.companyNom || 'le Prestataire'} intervient comme sous-traitant technique. Conformité RGPD essentielle incluse.`)
  }
  // Valeurs standard, toujours présentes (enrichissent le devis sans ressaisie).
  addMod('Réversibilité des données', 'En fin de contrat, les données sont exportées dans un format réutilisable (CSV / JSON) ; elles restent la propriété du Client.')
  addMod('Prérequis client', 'Accès (ou délégation) aux services techniques nécessaires (hébergement, nom de domaine), contenus et données à intégrer, et un référent unique pour les validations et la recette.')
  if (abo > 0) addMod('Garantie & support', "Correction des anomalies incluse pendant toute la durée de l'abonnement.")
  addMod('Validité', 'Devis valable 30 jours ; prix nets de TVA (TVA non applicable, art. 293 B du CGI) ; révisable si le périmètre ou les hypothèses évoluent.')

  const client = opts.client
  const clientIndicatif = (client as { indicatif_tel?: string } | null | undefined)?.indicatif_tel
  const factureTelephone = client?.telephone ? `${clientIndicatif ? clientIndicatif + ' ' : ''}${client.telephone}`.trim() : undefined
  return {
    userId: opts.userId,
    clientId: contrat.clientId ?? client?.id ?? '',
    clientName: contrat.clientNom,
    clientLinkedUserId: (client as { linkedUserId?: string } | null | undefined)?.linkedUserId ?? undefined,
    clientAddress: client?.adresse ?? legal?.clientAdresse ?? undefined,
    clientVille: client?.ville ?? undefined,
    clientCodePostal: client?.codePostal ?? undefined,
    factureEmail: client?.email ?? undefined,
    factureTelephone,
    companyId: opts.companyId,
    companyNom: opts.companyNom,
    abonnementId: contrat.abonnementId ?? undefined,
    abonnementTitre: contrat.abonnementTitre ?? undefined,
    type: 'devis',
    items,
    total,
    objet,
    contratId: contrat.id,
    inclus: inclus.length ? inclus : undefined,
    inclusPanels: inclusPanels.length ? inclusPanels : undefined,
    valeurBanner,
    options: options.length ? options : undefined,
    // Si « masquer du devis » est coché, on ne transmet PAS l'évolution au devis (elle
    // reste visible sur la Fiche négo interne, qui lit contrat.evolution directement).
    evolution: contrat.evolution?.masqueDevis ? undefined : contrat.evolution,
    modalites: modalites.length ? modalites : undefined,
  }
}
