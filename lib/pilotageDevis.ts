import type { PilotageContrat, FactureItem, DevisOption, Facture, Client } from '@/types'

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

  // ── Ce qui est inclus : livrables ──
  const inclus = (projet?.livrables ?? []).filter((l) => l.trim())

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
    options: options.length ? options : undefined,
    modalites: modalites.length ? modalites : undefined,
  }
}
