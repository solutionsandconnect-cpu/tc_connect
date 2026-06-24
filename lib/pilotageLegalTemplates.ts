import type { PilotageDocumentType, LegalFields } from '@/types'

// LegalFields centralisé dans @/types (réutilisé ici)
export type { LegalFields } from '@/types'

export function defaultLegalFields(over: Partial<LegalFields> = {}): LegalFields {
  return {
    prestataireNom: 'Solutions & Connect',
    prestataireStatut: 'micro-entreprise (entrepreneur individuel)',
    prestataireSiret: '',
    prestataireAdresse: '',
    prestataireEmail: 'solutionsandconnect@gmail.com',
    prestataireTel: '+33 6 79 40 82 54',
    prestataireRepresentant: '',
    clientNom: '', clientRepresentant: '', clientAdresse: '', clientSiret: '',
    date: '', lieu: '', objet: '', prixCreation: '', prixAbo: '',
    donneesTraitees: '', finalites: '', personnesConcernees: '', dureeConservation: '', sousTraitantsUlterieurs: '',
    etendueDroits: '', exclusivite: '', territoire: '', duree: '',
    ajustementsInclus: '', reconduction: '',
    ...over,
  }
}

// ── Schéma de saisie (pour générer le formulaire d'édition) ─────────────────
export interface LegalFieldDef { key: keyof LegalFields; label: string; placeholder?: string; multiline?: boolean; help?: string }
export interface LegalFieldGroup { titre: string; champs: LegalFieldDef[] }

const GROUP_PRESTATAIRE: LegalFieldGroup = {
  titre: 'Prestataire (toi) — auto-rempli depuis ta Société',
  champs: [
    { key: 'prestataireNom', label: 'Raison sociale', help: 'Le nom de ta société.' },
    { key: 'prestataireStatut', label: 'Statut juridique', help: 'Ta forme juridique : micro-entreprise / EI / SASU…' },
    { key: 'prestataireSiret', label: 'SIRET', help: 'Ton numéro SIRET (14 chiffres).' },
    { key: 'prestataireAdresse', label: 'Adresse', help: 'Adresse de ton siège.' },
    { key: 'prestataireRepresentant', label: 'Représenté par', help: 'La personne qui signe pour ta société (toi).' },
    { key: 'prestataireEmail', label: 'Email', help: 'Ton email de contact.' },
    { key: 'prestataireTel', label: 'Téléphone', help: 'Ton téléphone.' },
  ],
}
const GROUP_CLIENT: LegalFieldGroup = {
  titre: 'Client',
  champs: [
    { key: 'clientNom', label: 'Raison sociale / nom', help: "Le nom de l'entreprise cliente (ex : Climat & Confort Moreau)." },
    { key: 'clientRepresentant', label: 'Représenté par', help: 'La personne qui signe côté client (gérant, dirigeant).' },
    { key: 'clientAdresse', label: 'Adresse', help: 'Adresse du siège du client (auto depuis la fiche client).' },
    { key: 'clientSiret', label: 'SIRET / SIREN', help: 'Numéro du client — trouvable gratuitement sur Pappers ou societe.com.' },
  ],
}
const GROUP_GENERAL: LegalFieldGroup = {
  titre: 'Document',
  champs: [
    { key: 'lieu', label: 'Fait à (lieu)' },
    { key: 'date', label: 'Date de signature' },
    { key: 'objet', label: "Objet / description du projet", multiline: true },
  ],
}

export function legalFieldGroups(type: PilotageDocumentType): LegalFieldGroup[] {
  if (type === 'prestation') {
    return [
      GROUP_PRESTATAIRE, GROUP_CLIENT,
      { titre: 'Conditions', champs: [
        { key: 'prixCreation', label: 'Prix de création (€)' },
        { key: 'prixAbo', label: 'Abonnement mensuel (€)' },
        { key: 'duree', label: 'Durée / délais' },
      ] },
      GROUP_GENERAL,
    ]
  }
  if (type === 'dpa_rgpd') {
    return [
      GROUP_PRESTATAIRE, GROUP_CLIENT,
      { titre: 'Traitement des données', champs: [
        { key: 'finalites', label: 'Finalités du traitement', multiline: true },
        { key: 'donneesTraitees', label: 'Catégories de données traitées', multiline: true },
        { key: 'personnesConcernees', label: 'Personnes concernées', placeholder: 'ex : salariés, clients du Client' },
        { key: 'dureeConservation', label: 'Durée de conservation' },
        { key: 'sousTraitantsUlterieurs', label: 'Sous-traitants ultérieurs', placeholder: 'ex : Google Firebase (hébergement)', multiline: true },
      ] },
      GROUP_GENERAL,
    ]
  }
  // licence
  return [
    GROUP_PRESTATAIRE, GROUP_CLIENT,
    { titre: 'Droits concédés', champs: [
      { key: 'etendueDroits', label: 'Étendue', placeholder: "ex : licence d'utilisation / cession exclusive" },
      { key: 'exclusivite', label: 'Exclusivité', placeholder: 'exclusive / non exclusive' },
      { key: 'territoire', label: 'Territoire', placeholder: 'ex : France / monde entier' },
      { key: 'duree', label: 'Durée', placeholder: "ex : durée des droits d'auteur" },
      { key: 'prixCreation', label: 'Rémunération / prix (€)' },
      { key: 'prixAbo', label: 'Redevance mensuelle (€)' },
    ] },
    GROUP_GENERAL,
  ]
}

// Tous les champs légaux en un seul formulaire (pour la saisie centralisée sur le contrat)
export function legalFieldGroupsAll(): LegalFieldGroup[] {
  return [
    GROUP_PRESTATAIRE,
    GROUP_CLIENT,
    {
      titre: 'Conditions',
      champs: [
        // (L'objet du contrat reprend automatiquement le « Contexte » de l'onglet Contenu projet.)
        { key: 'prixCreation', label: 'Prix de création (€)', help: 'Montant total de la création (mise en place).' },
        { key: 'prixAbo', label: 'Abonnement / redevance mensuelle (€)', help: 'Le mensuel : maintenance + hébergement + support.' },
        { key: 'duree', label: 'Durée / délais', placeholder: 'ex : 4 mois ; 12 mois reconductible', help: 'Délai de réalisation ou durée d’engagement.' },
        { key: 'ajustementsInclus', label: 'Ajustements inclus (après validation maquette)', placeholder: "ex : 2 jours d'ajustements inclus", help: 'Forfait de retouches compris ; au-delà, c’est un avenant.' },
        { key: 'reconduction', label: 'Reconduction & résiliation', multiline: true, placeholder: "ex : Reconduction par périodes de 12 mois, résiliation avec préavis de 1 mois. Révision tarifaire annuelle plafonnée à l'évolution de l'indice Syntec.", help: 'Modalité affichée sur le devis. Vide = texte standard (préavis 2 mois, révision annuelle possible). Ajuste ici le préavis (1 ou 2 mois) et le plafond de révision tarifaire.' },
        { key: 'lieu', label: 'Fait à (lieu)', help: 'La ville où le contrat est signé.' },
        { key: 'date', label: 'Date de signature', help: 'Date de signature du contrat.' },
      ],
    },
    {
      titre: 'RGPD (accord DPA — obligatoire si données personnelles)',
      champs: [
        { key: 'finalites', label: 'Finalités du traitement', multiline: true, placeholder: 'ex : gérer les interventions, suivre les chantiers', help: 'À quoi servent les données dans l’app.' },
        { key: 'donneesTraitees', label: 'Catégories de données traitées', multiline: true, placeholder: 'ex : nom, email, téléphone, adresse, photos de chantier', help: 'Quelles données personnelles l’app manipule.' },
        { key: 'personnesConcernees', label: 'Personnes concernées', placeholder: 'ex : salariés et clients du Client', help: 'De qui sont les données.' },
        { key: 'dureeConservation', label: 'Durée de conservation', placeholder: 'ex : durée du contrat + 12 mois', help: 'Combien de temps les données sont gardées.' },
        { key: 'sousTraitantsUlterieurs', label: 'Sous-traitants ultérieurs', placeholder: 'ex : Google Firebase, SendGrid, Twilio', multiline: true, help: 'Les services tiers qui hébergent/traitent les données.' },
      ],
    },
    {
      titre: 'Licence / droits',
      champs: [
        { key: 'etendueDroits', label: 'Étendue', placeholder: "licence d'utilisation / cession exclusive", help: "Simple droit d'usage, ou cession complète des droits au client." },
        { key: 'exclusivite', label: 'Exclusivité', placeholder: 'exclusive / non exclusive', help: 'Non exclusive = tu peux revendre l’app à d’autres clients.' },
        { key: 'territoire', label: 'Territoire', placeholder: 'ex : France / monde entier', help: 'Où le client peut exploiter l’app.' },
      ],
    },
  ]
}

// ── Structure d'un contrat rendu ────────────────────────────────────────────
export interface LegalArticle { titre: string; paragraphes: string[] }
export interface LegalDocStruct {
  titre: string
  intro: string[]
  articles: LegalArticle[]
  cloture: string[]
}

const g = (f: LegalFields, k: keyof LegalFields, fb = '[à compléter]') => (f[k] && String(f[k]).trim()) || fb

export function buildLegalDoc(type: PilotageDocumentType, f: LegalFields): LegalDocStruct | null {
  if (type === 'prestation') return buildPrestation(f)
  if (type === 'dpa_rgpd') return buildDPA(f)
  if (type === 'licence') return buildLicence(f)
  return null
}

function entreLesSoussignes(f: LegalFields, rolePresta: string, roleClient: string): string[] {
  return [
    `Entre les soussignés :`,
    `${g(f, 'prestataireNom')}, ${g(f, 'prestataireStatut')}, immatriculée sous le numéro SIRET ${g(f, 'prestataireSiret')}, dont le siège est situé ${g(f, 'prestataireAdresse')}, représentée par ${g(f, 'prestataireRepresentant')}, ci-après « ${rolePresta} » ;`,
    `Et ${g(f, 'clientNom')}, dont le siège est situé ${g(f, 'clientAdresse')}, immatriculée sous le numéro ${g(f, 'clientSiret')}, représentée par ${g(f, 'clientRepresentant')}, ci-après « ${roleClient} » ;`,
    `Il a été convenu ce qui suit.`,
  ]
}

function buildPrestation(f: LegalFields): LegalDocStruct {
  return {
    titre: 'Contrat de prestation de services',
    intro: entreLesSoussignes(f, 'le Prestataire', 'le Client'),
    articles: [
      { titre: 'Article 1 — Objet', paragraphes: [
        `Le présent contrat a pour objet la réalisation par le Prestataire, au profit du Client, de la prestation suivante : ${g(f, 'objet')}.`,
        `Le périmètre détaillé est défini dans le cahier des charges annexé, qui fait partie intégrante du présent contrat.`,
      ] },
      { titre: 'Article 2 — Livrables et périmètre', paragraphes: [
        `Le Prestataire s'engage à livrer une application fonctionnelle conforme au cahier des charges, accompagnée d'une documentation d'utilisation et d'une formation initiale.`,
        `Après validation de la maquette, le périmètre est figé. Un forfait d'ajustements (${g(f, 'ajustementsInclus')}) est compris au titre des retouches mineures. Toute nouvelle fonctionnalité ou demande hors de ce périmètre fait l'objet d'un avenant chiffré séparément.`,
      ] },
      { titre: 'Article 3 — Durée et délais', paragraphes: [
        `Le planning prévisionnel est défini au cahier des charges. Délais : ${g(f, 'duree')}.`,
        `Les délais sont donnés à titre indicatif et peuvent être ajustés en cas de retard du Client dans la fourniture des éléments nécessaires.`,
      ] },
      { titre: 'Article 4 — Prix et modalités de paiement', paragraphes: [
        `Le prix de la création est fixé à ${g(f, 'prixCreation')} €. Un abonnement mensuel de ${g(f, 'prixAbo')} € est dû pour l'hébergement, la maintenance et le support.`,
        `Le paiement s'effectue selon l'échéancier figurant sur le devis accepté. Tout retard de paiement entraîne des pénalités au taux légal en vigueur.`,
      ] },
      { titre: 'Article 5 — Obligations du Prestataire', paragraphes: [
        `Le Prestataire s'engage à exécuter la prestation avec diligence et dans les règles de l'art. Il est tenu d'une obligation de moyens.`,
      ] },
      { titre: 'Article 6 — Obligations du Client', paragraphes: [
        `Le Client s'engage à fournir en temps utile l'ensemble des informations, contenus et accès nécessaires à la bonne exécution de la prestation, et à collaborer activement (validations, retours).`,
      ] },
      { titre: 'Article 7 — Propriété intellectuelle', paragraphes: [
        `Les droits relatifs au code et aux livrables sont régis par un contrat de licence / cession distinct. À défaut, le Prestataire conserve la propriété du code et concède au Client un droit d'usage.`,
      ] },
      { titre: 'Article 8 — Maintenance et support', paragraphes: [
        `Pendant la durée de l'abonnement, le Prestataire assure la correction des anomalies, les mises à jour techniques et un support par email et téléphone.`,
      ] },
      { titre: 'Article 9 — Responsabilité', paragraphes: [
        `La responsabilité du Prestataire est limitée aux dommages directs et plafonnée au montant total payé par le Client au titre du présent contrat. Le Prestataire ne saurait être tenu responsable des dommages indirects.`,
      ] },
      { titre: 'Article 10 — Confidentialité', paragraphes: [
        `Chaque partie s'engage à garder confidentielles les informations échangées dans le cadre du présent contrat.`,
      ] },
      { titre: 'Article 11 — Données personnelles', paragraphes: [
        `Le traitement des données personnelles est encadré par un accord de sous-traitance (DPA) conclu conformément à l'article 28 du RGPD.`,
      ] },
      { titre: 'Article 12 — Résiliation', paragraphes: [
        `En cas de manquement grave non réparé sous 30 jours après mise en demeure, chaque partie peut résilier le contrat. L'abonnement peut être résilié par chaque partie avec un préavis d'un mois.`,
      ] },
      { titre: 'Article 13 — Droit applicable et litiges', paragraphes: [
        `Le présent contrat est soumis au droit français. À défaut d'accord amiable, tout litige sera porté devant les tribunaux compétents.`,
      ] },
    ],
    cloture: clotureSignatures(f, 'Le Prestataire', 'Le Client'),
  }
}

function buildDPA(f: LegalFields): LegalDocStruct {
  return {
    titre: 'Accord de sous-traitance des données personnelles (DPA)',
    intro: [
      ...entreLesSoussignes(f, 'le Sous-traitant', 'le Responsable de traitement'),
      `Le présent accord est conclu en application de l'article 28 du Règlement (UE) 2016/679 (RGPD).`,
    ],
    articles: [
      { titre: 'Article 1 — Objet', paragraphes: [
        `Le Sous-traitant traite des données à caractère personnel pour le compte du Responsable de traitement, dans le cadre de la prestation : ${g(f, 'objet')}.`,
      ] },
      { titre: 'Article 2 — Description du traitement', paragraphes: [
        `Finalités : ${g(f, 'finalites')}.`,
        `Catégories de données : ${g(f, 'donneesTraitees')}.`,
        `Personnes concernées : ${g(f, 'personnesConcernees')}.`,
        `Durée de conservation : ${g(f, 'dureeConservation')}.`,
      ] },
      { titre: 'Article 3 — Obligations du Sous-traitant', paragraphes: [
        `Le Sous-traitant traite les données uniquement sur instruction documentée du Responsable de traitement.`,
        `Il garantit la confidentialité des données et veille à ce que les personnes autorisées s'engagent à la confidentialité.`,
        `Il assiste le Responsable de traitement dans la réponse aux demandes d'exercice des droits des personnes concernées.`,
        `Il met à disposition du Responsable les informations nécessaires pour démontrer le respect de ses obligations et permettre des audits.`,
      ] },
      { titre: 'Article 4 — Sécurité', paragraphes: [
        `Le Sous-traitant met en œuvre les mesures techniques et organisationnelles appropriées au sens de l'article 32 du RGPD (chiffrement, contrôle d'accès, sauvegardes, journalisation).`,
      ] },
      { titre: 'Article 5 — Sous-traitants ultérieurs', paragraphes: [
        `Le Responsable autorise le recours aux sous-traitants ultérieurs suivants : ${g(f, 'sousTraitantsUlterieurs')}. Le Sous-traitant impose à ces derniers les mêmes obligations de protection des données.`,
      ] },
      { titre: 'Article 6 — Transferts hors UE', paragraphes: [
        `Tout transfert de données en dehors de l'Union européenne est encadré par des garanties appropriées (clauses contractuelles types ou décision d'adéquation).`,
      ] },
      { titre: 'Article 7 — Violation de données', paragraphes: [
        `Le Sous-traitant notifie au Responsable toute violation de données dans les meilleurs délais après en avoir pris connaissance, et l'assiste dans ses obligations de notification.`,
      ] },
      { titre: 'Article 8 — Sort des données', paragraphes: [
        `Au terme de la prestation, le Sous-traitant restitue ou supprime, au choix du Responsable, l'ensemble des données et copies existantes, sauf obligation légale de conservation.`,
      ] },
      { titre: 'Article 9 — Durée', paragraphes: [
        `Le présent accord s'applique pendant toute la durée du traitement réalisé pour le compte du Responsable de traitement.`,
      ] },
    ],
    cloture: clotureSignatures(f, 'Le Sous-traitant', 'Le Responsable de traitement'),
  }
}

function buildLicence(f: LegalFields): LegalDocStruct {
  return {
    titre: 'Contrat de licence / cession de droits',
    intro: entreLesSoussignes(f, 'le Concédant', 'le Bénéficiaire'),
    articles: [
      { titre: 'Article 1 — Objet', paragraphes: [
        `Le présent contrat porte sur les droits relatifs au logiciel / à l'application : ${g(f, 'objet')}.`,
        `Nature de l'opération : ${g(f, 'etendueDroits')}.`,
      ] },
      { titre: 'Article 2 — Étendue des droits', paragraphes: [
        `Sont concédés / cédés les droits de reproduction, de représentation, d'utilisation et, le cas échéant, d'adaptation du logiciel, dans les limites définies au présent contrat.`,
      ] },
      { titre: 'Article 3 — Exclusivité', paragraphes: [
        `Les droits sont concédés à titre : ${g(f, 'exclusivite')}.`,
      ] },
      { titre: 'Article 4 — Territoire et durée', paragraphes: [
        `Territoire : ${g(f, 'territoire')}. Durée : ${g(f, 'duree')}.`,
      ] },
      { titre: 'Article 5 — Code source', paragraphes: [
        `Sauf stipulation contraire, le code source reste la propriété du Concédant, qui en concède un droit d'usage. Toute cession de propriété du code doit être expressément prévue ci-dessus.`,
      ] },
      { titre: 'Article 6 — Rémunération', paragraphes: [
        `En contrepartie, le Bénéficiaire verse au Concédant la somme de ${g(f, 'prixCreation')} €${g(f, 'prixAbo', '') ? `, ainsi qu'une redevance mensuelle de ${g(f, 'prixAbo')} €` : ''}.`,
      ] },
      { titre: 'Article 7 — Garanties', paragraphes: [
        `Le Concédant garantit être titulaire des droits cédés et garantit le Bénéficiaire contre tout trouble de jouissance du fait d'un tiers.`,
      ] },
      { titre: 'Article 8 — Droit applicable', paragraphes: [
        `Le présent contrat est soumis au droit français. Tout litige relève des tribunaux compétents.`,
      ] },
    ],
    cloture: clotureSignatures(f, 'Le Concédant', 'Le Bénéficiaire'),
  }
}

function clotureSignatures(f: LegalFields, rolePresta: string, roleClient: string): string[] {
  return [
    `Fait à ${g(f, 'lieu')}, le ${g(f, 'date')}, en deux exemplaires originaux.`,
    `${rolePresta}                                              ${roleClient}`,
    `(signature, précédée de la mention « lu et approuvé »)`,
  ]
}
