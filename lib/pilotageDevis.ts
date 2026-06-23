import type { PilotageContrat, FactureItem, DevisOption, Facture, Client } from '@/types'
import { computeTarif, stateFromEstimation, fmtEur } from '@/lib/pilotageEstimateur'

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
  if (frais > 0) {
    items.push({
      label: 'Mise en service',
      quantity: 1,
      price: frais,
      recurrence: 'unique',
      description: (projet?.livrables ?? []).filter((l) => l.trim()).join(' · ') || undefined,
    })
  }
  if (abo > 0) {
    items.push({
      label: 'Abonnement mensuel — hébergement & maintenance',
      quantity: 12,
      price: abo,
      recurrence: 'mensuel',
      description: 'Hébergement, maintenance corrective, support et petites évolutions. Engagement initial de 12 mois, reconductible.',
    })
  }
  if (items.length === 0) {
    items.push({ label: nomProjet || 'Prestation', quantity: 1, price: 0, recurrence: 'unique' })
  }
  const total = items.reduce((s, i) => s + i.quantity * i.price, 0)

  // ── Objet : contexte du projet (sinon objet juridique) ──
  const objet = (projet?.contexte?.trim() || legal?.objet?.trim()) || undefined

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

  // ── Bandeau « valeur » : depuis l'estimation validée du contrat ──
  const est =
    contrat.estimations?.find((e) => e.id === contrat.estimationSelectedId) ??
    contrat.estimations?.[0] ??
    contrat.estimation
  let valeurBanner: Facture['valeurBanner'] | undefined
  if (est) {
    const t = computeTarif(stateFromEstimation(est))
    const revente = est.mode === 'revente'
    if (t.valeurAn > 0) {
      const stats: { value: string; label: string }[] = [
        { value: `${Math.round(t.joursDev)} j`, label: 'de conception' },
        { value: `${est.features.length}`, label: 'modules' },
      ]
      if (t.paybackMois != null && t.paybackMois > 0) {
        stats.push({ value: `${Math.ceil(t.paybackMois)} mois`, label: 'de retour sur investissement' })
      }
      valeurBanner = {
        titre: 'Application sur-mesure, conçue pour votre activité',
        sousTitre: revente ? 'Un actif que vous pouvez exploiter et revendre' : 'Un outil construit pour vous, pas un logiciel générique',
        montant: `≈ ${fmtEur(t.valeurAn)}`,
        mention: revente ? 'REVENU POTENTIEL / AN' : 'VALEUR GÉNÉRÉE ESTIMÉE / AN',
        texte: revente
          ? `Estimation du revenu annuel potentiel sur la base des hypothèses de cadrage (${est.nbClientsFinaux} clients × ${fmtEur(est.prixReventeMensuel)}/mois). Le développement, déjà réalisé, représente une valeur de conception d'environ ${fmtEur(t.creationBas)} – ${fmtEur(t.setup)}.`
          : `Valeur estimée du temps gagné chaque année grâce à l'application, sur la base des hypothèses de cadrage. La conception sur-mesure représente une valeur d'environ ${fmtEur(t.creationBas)} – ${fmtEur(t.setup)}.`,
        stats,
      }
    }
  }

  // ── Options à la carte : depuis le contrat ──
  const options: DevisOption[] = (contrat.optionsDevis ?? []).filter((o) => (o.label ?? '').trim())

  // ── Modalités : depuis les mentions légales ──
  const modalites: { label: string; value: string }[] = []
  const addMod = (label: string, value?: string) => { if (value && value.trim()) modalites.push({ label, value: value.trim() }) }
  addMod('Durée', legal?.duree)
  addMod('Propriété / droits', legal?.etendueDroits)
  addMod('Exclusivité', legal?.exclusivite)
  addMod('Territoire', legal?.territoire)
  addMod('Ajustements inclus', legal?.ajustementsInclus)

  const client = opts.client
  return {
    userId: opts.userId,
    clientId: contrat.clientId ?? client?.id ?? '',
    clientName: contrat.clientNom,
    clientLinkedUserId: (client as { linkedUserId?: string } | null | undefined)?.linkedUserId ?? undefined,
    clientAddress: client?.adresse ?? legal?.clientAdresse ?? undefined,
    clientVille: client?.ville ?? undefined,
    clientCodePostal: client?.codePostal ?? undefined,
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
    modalites: modalites.length ? modalites : undefined,
  }
}
