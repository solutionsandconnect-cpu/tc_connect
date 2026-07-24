// Mailing — assemblage du mail et de la brochure à partir d'un kit métier.
//
// Reprend la logique des gabarits AppSheet (mail = accroche, brochure = détail)
// en corrigeant ce qui posait problème :
//  - mise en page en <table> : `display:flex` est ignoré par Outlook (moteur Word),
//    qui domine chez les artisans — la disposition 💢/👉 y cassait ;
//  - aucun pixel de traçage : signal spam, et le suivi d'ouverture est considéré
//    en France comme nécessitant un consentement. On mesure les réponses ;
//  - lien de désinscription + mention de l'origine des données, absents de
//    l'ancien gabarit alors qu'ils conditionnent la base « intérêt légitime » ;
//  - images servies depuis le domaine de l'app, plus depuis Google Drive dont
//    les URL `thumbnail?id=` sont fréquemment bloquées ou limitées ;
//  - boucle sur les sections au lieu de sept blocs copiés-collés.

import type { MailingMetier, Prospect } from '@/types'
import { sectionsPourBrochure, sectionsPourMail } from '@/lib/mailingModel'
import { publicLinkOrigin } from '@/lib/brand'

const PETROL = '#377587'
const OR = '#D2A244'
const ENCRE = '#333333'

export interface Expediteur {
  nom: string
  societe: string
  /** Ligne de métier sous le nom — ce que fait la société, en cinq mots. */
  accroche?: string
  lieu?: string
  email: string
  telephone?: string
  siteUrl?: string
  logoUrl?: string
  /**
   * Une phrase de présentation, en tête du mail court : elle répond au « c'est
   * qui ? » avant que le message ne soit classé en démarchage. Volontairement
   * ancrée localement, et en langage courant — « TPE » est un mot de comptable,
   * pas de chantier.
   */
  presentation?: string
}

/** Logo par défaut : le wordmark, seul lisible à 150 px de large dans un mail. */
const LOGO_ENEZO = '/enezo-logo-full.png'

export const EXPEDITEUR_ENEZO: Expediteur = {
  nom: 'Teddy',
  societe: 'Enezo',
  accroche: "Studio de développement d'applications",
  lieu: 'Pénestin (56)',
  email: 'contact@enezo.fr',
  telephone: '+33 6 79 40 82 54',
  siteUrl: 'https://enezo.fr',
  presentation:
    'Je suis développeur à Pénestin (Morbihan), je travaille avec des artisans et des entreprises de la région.',
}

export interface RenderContexte {
  metier: MailingMetier
  prospect: Prospect
  personnalisation: string
  /** Base URL de l'app — sert au lien de désinscription et au logo. */
  origin: string
  expediteur?: Expediteur
}

/** Échappement HTML : tout le contenu vient de saisies libres. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function lienDesinscription(origin: string, token: string): string {
  // Prospection Enezo : le lien de désinscription part chez de vrais destinataires,
  // il doit TOUJOURS pointer vers le domaine public de l'app Enezo (`app.enezo.fr`),
  // jamais vers `localhost` ni le domaine coaching selon d'où le mail a été copié.
  const base = publicLinkOrigin('enezo', origin)
  return `${base.replace(/\/+$/, '')}/desinscription/${token}`
}

/**
 * Le kit est-il passé au format court ? Les trois champs vont ensemble : un
 * mail sans sa question finale n'appellerait aucune réponse, et c'est
 * précisément ce qu'on corrige. Tant qu'ils ne sont pas tous remplis, le kit
 * continue de produire l'ancien mail — c'est ce qui permet de migrer un métier
 * à la fois sans toucher aux autres.
 */
export function estMailCourt(metier: MailingMetier): boolean {
  return !!(metier.mailScene?.trim() && metier.mailExemples?.trim() && metier.mailQuestion?.trim())
}

/**
 * Kit EFFECTIF pour un prospect donné : les blocs réécrits pour lui
 * (`prospect.mailPerso`) prennent le pas sur ceux du métier.
 *
 * À appeler AVANT `renderMailHtml` / `renderMailTexte` / `sujetMail` — tout le
 * reste du moteur continue de ne connaître qu'un kit, et la mise en forme
 * (tableaux compatibles Outlook) reste produite par le moteur, pas saisie à la main.
 */
export function metierPourProspect(metier: MailingMetier, prospect: Prospect): MailingMetier {
  const p = prospect.mailPerso
  if (!p) return metier
  return {
    ...metier,
    objet:        p.objet?.trim()    || metier.objet,
    mailScene:    p.scene?.trim()    || metier.mailScene,
    mailExemples: p.exemples?.trim() || metier.mailExemples,
    mailQuestion: p.question?.trim() || metier.mailQuestion,
  }
}

/** Paragraphes d'un texte saisi librement (une ligne vide = un paragraphe). */
function paragraphes(texte: string, style: string): string {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<tr><td style="${style}">${esc(p).replace(/\n/g, '<br>')}</td></tr>`)
    .join('\n')
}

export function sujetMail(metier: MailingMetier, prospect: Prospect): string {
  const base = metier.objet?.trim() || `Simplifier la gestion de votre activité`
  return base.replace(/\{societe\}/gi, prospect.societe ?? '').trim()
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

export function renderMailHtml(ctx: RenderContexte): string {
  const { metier, prospect, personnalisation, origin } = ctx
  const exp = ctx.expediteur ?? EXPEDITEUR_ENEZO
  const sections = sectionsPourMail(metier)
  const desinscription = lienDesinscription(origin, prospect.optoutToken)

  const themes = sections
    .map(
      (s, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;">
      <tr>
        <td style="padding-bottom:6px;font-weight:700;color:${PETROL};font-size:15px;">${i + 1}. ${esc(s.theme)}</td>
      </tr>
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="24" valign="top" style="color:${PETROL};font-size:15px;line-height:22px;">&#128162;</td>
              <td valign="top" style="color:${PETROL};font-size:14px;line-height:22px;">${esc(s.problemeMail)}</td>
            </tr>
            <tr>
              <td width="24" valign="top" style="font-size:15px;line-height:22px;">&#128073;</td>
              <td valign="top" style="color:${ENCRE};font-size:14px;line-height:22px;">${esc(s.solutionMail)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,
    )
    .join('\n')

  const perso = personnalisation?.trim()
    ? `<p style="margin:0 0 14px;">${esc(personnalisation.trim())}</p>`
    : ''

  const origineTxt = prospect.origine?.trim()
    ? `Vous recevez ce message à votre adresse professionnelle, identifiée via ${esc(prospect.origine.trim())}.`
    : `Vous recevez ce message à votre adresse professionnelle, collectée dans un annuaire professionnel public.`

  // ── Corps : format court si le kit a été migré, ancien format sinon ────────
  // Seul le corps change ; en-tête, signature et mentions RGPD sont communs
  // (le lien de désinscription conditionne la base légale, il ne bouge jamais).
  const corpsCourt = `
        ${exp.presentation ? `<tr><td style="padding-bottom:14px;">${esc(exp.presentation)}</td></tr>` : ''}

        <tr>
          <td style="padding:2px 0 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="border-left:3px solid ${OR};">
              <tr>
                <td style="padding:2px 0 2px 13px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${paragraphes(metier.mailScene ?? '', 'padding-bottom:8px;')}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${/* `paragraphes` produit déjà des <tr> : les envelopper dans une <table>
             ici les sortirait du tableau parent (HTML invalide) et le texte
             s'afficherait hors de sa place. */ ''}
        ${paragraphes(metier.mailExemples ?? '', 'padding-bottom:16px;')}

        ${/* Lien vers le site dans le CORPS (en plus de la signature), à la
             demande de Teddy. Volontairement en TEXTE et non en bouton, et placé
             AVANT la question : un second bouton entrerait en concurrence avec
             l'appel à l'action, et devant deux choix on en prend souvent un
             troisième — ne rien faire. */ ''}
        ${exp.siteUrl
          ? `<tr>
               <td style="padding-bottom:16px;">
                 Retrouvez plus d'infos également sur
                 <a href="${esc(exp.siteUrl)}" style="color:${PETROL};font-weight:600;">${esc(exp.siteUrl.replace(/^https?:\/\//, ''))}</a>.
               </td>
             </tr>`
          : ''}

        <tr>
          <td style="padding-bottom:20px;font-weight:bold;color:${PETROL};">
            ${esc(metier.mailQuestion ?? '')}
          </td>
        </tr>

`

  const corpsLong = `
        <tr>
          <td style="padding-bottom:14px;">
            Nous nous permettons de vous contacter pour vous proposer nos services : un outil qui
            centralise vos données pour simplifier vos tâches quotidiennes et gagner en productivité.
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:18px;">
            Nous savons que gérer une entreprise de <strong>${esc(metier.metier)}</strong> implique de
            jongler ${esc(metier.problematiques)}, et que chaque heure compte. Voici quelques problèmes
            fréquents et la manière dont nous pouvons vous aider à les résoudre.
          </td>
        </tr>

        <tr><td>${themes}</td></tr>

        <tr>
          <td style="padding:4px 0 18px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                   style="background:#f6f9fa;border-left:3px solid ${OR};">
              <tr>
                <td style="padding:12px 14px;font-size:13px;line-height:20px;">
                  Cette liste <strong>n'est pas exhaustive</strong> : la brochure jointe détaille d'autres
                  exemples, et tout reste adaptable — nous partons de <em>votre</em> façon de travailler.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:14px;">
            <strong>En résumé</strong> : nos outils vous font gagner du temps, donc de l'argent. Nous créons
            des outils sur mesure, <strong style="color:${PETROL};">développés uniquement pour votre entreprise
            et selon votre façon de travailler</strong> — pas un logiciel rigide, un outil qui évolue avec vous.
          </td>
        </tr>

        <tr>
          <td style="padding-bottom:20px;">
            Nous serions ravis d'en discuter avec vous de vive voix, et restons disponibles pour toute
            information complémentaire.
          </td>
        </tr>

        <tr><td style="padding-bottom:6px;">Cordialement,</td></tr>
`

  const corps = estMailCourt(metier) ? corpsCourt : corpsLong

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
  <tr>
    <td style="padding:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${ENCRE};">

        <tr><td style="padding-bottom:14px;">Bonjour,</td></tr>

        <tr><td>${perso}</td></tr>

        ${corps}

        ${/* Pas de bloc signature ici : le mail est collé dans la boîte de Teddy,
             qui ajoute déjà sa propre signature. En remettre une ferait doublon. */ ''}

        <tr>
          <td style="padding-top:22px;border-top:1px solid #e5e7eb;color:#8b95a1;font-size:11px;line-height:17px;">
            ${origineTxt}
            Conformément au RGPD, vous pouvez vous opposer à tout nouveau message et demander la suppression
            de vos données&nbsp;:
            <a href="${esc(desinscription)}" style="color:#8b95a1;text-decoration:underline;">me retirer de cette liste</a>.
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/**
 * Version texte brut.
 * Un mail HTML sans alternative texte est un signal négatif de plus — et
 * certains destinataires lisent en texte seul.
 */
export function renderMailTexte(ctx: RenderContexte): string {
  const { metier, prospect, personnalisation, origin } = ctx
  const exp = ctx.expediteur ?? EXPEDITEUR_ENEZO
  const sections = sectionsPourMail(metier)

  const themes = sections
    .map((s, i) => `${i + 1}. ${s.theme}\n   Problème : ${s.problemeMail}\n   Solution : ${s.solutionMail}`)
    .join('\n\n')

  const pied = [
    '',
    '---',
    prospect.origine?.trim()
      ? `Vous recevez ce message à votre adresse professionnelle, identifiée via ${prospect.origine.trim()}.`
      : 'Vous recevez ce message à votre adresse professionnelle, collectée dans un annuaire professionnel public.',
    `Pour ne plus être contacté : ${lienDesinscription(origin, prospect.optoutToken)}`,
  ]

  if (estMailCourt(metier)) {
    return [
      'Bonjour,',
      '',
      personnalisation?.trim() ?? '',
      personnalisation?.trim() ? '' : null,
      exp.presentation ?? null,
      exp.presentation ? '' : null,
      metier.mailScene?.trim() ?? '',
      '',
      metier.mailExemples?.trim() ?? '',
      '',
      exp.siteUrl ? `Vous pouvez voir ce que je fais sur ${exp.siteUrl}` : null,
      exp.siteUrl ? '' : null,
      metier.mailQuestion?.trim() ?? '',
      // Pas de signature (nom/société/contacts) : la boîte de Teddy ajoute la sienne.
      ...pied,
    ]
      .filter((l) => l !== null)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  }

  return [
    'Bonjour,',
    '',
    personnalisation?.trim() ?? '',
    personnalisation?.trim() ? '' : null,
    'Nous nous permettons de vous contacter pour vous proposer nos services : un outil qui centralise vos données pour simplifier vos tâches quotidiennes et gagner en productivité.',
    '',
    `Nous savons que gérer une entreprise de ${metier.metier} implique de jongler ${metier.problematiques}, et que chaque heure compte. Voici quelques problèmes fréquents et la manière dont nous pouvons vous aider à les résoudre.`,
    '',
    themes,
    '',
    "Cette liste n'est pas exhaustive : la brochure jointe détaille d'autres exemples, et tout reste adaptable — nous partons de votre façon de travailler.",
    '',
    "En résumé : nos outils vous font gagner du temps, donc de l'argent. Nous créons des outils sur mesure, développés uniquement pour votre entreprise et selon votre façon de travailler — pas un logiciel rigide, un outil qui évolue avec vous.",
    '',
    "Nous serions ravis d'en discuter avec vous de vive voix, et restons disponibles pour toute information complémentaire.",
    '',
    'Cordialement,',
    // Pas de signature (nom/société/contacts) : la boîte de Teddy ajoute la sienne.
    '',
    '---',
    prospect.origine?.trim()
      ? `Vous recevez ce message à votre adresse professionnelle, identifiée via ${prospect.origine.trim()}.`
      : 'Vous recevez ce message à votre adresse professionnelle, collectée dans un annuaire professionnel public.',
    `Pour ne plus être contacté : ${lienDesinscription(origin, prospect.optoutToken)}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

/* ------------------------------------------------------------------ */
/* Brochure                                                            */
/* ------------------------------------------------------------------ */

export interface BrochureContexte {
  metier: MailingMetier
  origin: string
  expediteur?: Expediteur
  /** Logo en data URL : html2canvas ne peut pas capturer une image distante. */
  logoDataUrl?: string | null
}

/**
 * Brochure : un thème par bloc, problématiques à gauche et réponses à droite.
 * Contrairement au mail (une accroche par thème), on déroule ici l'intégralité —
 * c'est la répartition des gabarits d'origine, et elle est bonne.
 *
 * Largeur fixée à 794 px (210 mm @ 96 dpi) et mise en page en <table> : le PDF
 * passe par html2canvas, qui reproduit les tableaux plus fidèlement que les
 * dispositions modernes. Les classes `.theme` / `.theme-head` servent de points
 * de coupe au paginateur (cf. lib/htmlToPdf.ts).
 */
export function renderBrochureHtml(ctx: BrochureContexte): string {
  const { metier, origin } = ctx
  const exp = ctx.expediteur ?? EXPEDITEUR_ENEZO
  const sections = sectionsPourBrochure(metier)
  const logo = ctx.logoDataUrl ?? exp.logoUrl ?? `${origin.replace(/\/+$/, '')}${LOGO_ENEZO}`

  const puces = (items: string[], couleur: string) =>
    items
      .filter((t) => t?.trim())
      .map(
        (t) => `
            <tr>
              <td class="bullet" style="color:${couleur};">&#9679;</td>
              <td class="btext">${esc(t)}</td>
            </tr>`,
      )
      .join('')

  const blocs = sections
    .map(
      (s, i) => `
  <div class="theme">
    <div class="theme-head">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td class="num">${i + 1}</td>
          <td class="ttl">${esc(s.theme)}</td>
        </tr>
      </table>
    </div>
    <table class="cols" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td class="col colprob">
          <div class="colhead colheadprob">Ce que vous vivez</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${puces(s.problemesBrochure ?? [], '#b91c1c')}
          </table>
        </td>
        <td class="sep">&#10230;</td>
        <td class="col colsol">
          <div class="colhead colheadsol">Ce que nous vous proposons</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${puces(s.solutionsBrochure ?? [], PETROL)}
          </table>
        </td>
      </tr>
    </table>
  </div>`,
    )
    .join('\n')

  const lignesContact = [
    exp.telephone ? esc(exp.telephone) : '',
    esc(exp.email),
    exp.lieu ? esc(exp.lieu) : '',
  ]
    .filter(Boolean)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { margin:0; background:#ffffff; }
  .brochure {
    width: 794px; padding: 44px 46px 40px;
    font-family: Arial, Helvetica, sans-serif; color: ${ENCRE};
    -webkit-font-smoothing: antialiased;
  }
  .head { border-bottom: 3px solid ${PETROL}; padding-bottom: 16px; margin-bottom: 6px; }
  .head h1 { font-size: 27px; line-height: 32px; margin: 0; color: ${PETROL}; letter-spacing: -0.4px; }
  .head .kicker {
    font-size: 11px; letter-spacing: 1.4px; text-transform: uppercase;
    color: ${OR}; font-weight: 700; margin-bottom: 6px;
  }
  .head .sub { font-size: 13px; color: #6b7280; margin-top: 5px; }
  .intro {
    font-size: 13px; line-height: 21px; color: #4b5563;
    background: #f4f8f9; border-left: 3px solid ${OR};
    padding: 12px 16px; margin: 20px 0 22px;
  }
  .theme { margin-bottom: 18px; border: 1px solid #e3ebee; border-radius: 6px; overflow: hidden; }
  .theme-head { background: ${PETROL}; padding: 0; }
  .theme-head .num {
    width: 40px; text-align: center; color: ${OR};
    font-size: 17px; font-weight: 700; padding: 11px 0;
  }
  .theme-head .ttl {
    color: #ffffff; font-size: 15px; font-weight: 700; padding: 11px 14px 11px 0;
  }
  .cols { table-layout: fixed; }
  .col { width: 46%; vertical-align: top; padding: 14px 16px 16px; }
  .colprob { background: #fbfbfc; }
  .colsol  { background: #ffffff; }
  .sep { width: 8%; text-align: center; vertical-align: middle; font-size: 21px; color: ${OR}; }
  .colhead {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    padding-bottom: 9px; margin-bottom: 4px; border-bottom: 1px solid #e8edef;
  }
  .colheadprob { color: #9ca3af; }
  .colheadsol  { color: ${PETROL}; }
  .bullet { width: 14px; vertical-align: top; font-size: 8px; padding: 5px 0 0; line-height: 14px; }
  .btext { font-size: 12.5px; line-height: 18px; padding: 3px 0 3px 6px; color: #3f4650; }
  /* Bas de brochure : fond clair, un simple filet petrol en écho au titre.
     C'est un appel à l'action, pas un bandeau — la couleur pleine écrasait la
     page et jurait avec le reste. Couleurs pleines (pas de rgba) : html2canvas
     les restitue plus fidèlement. */
  footer { margin-top: 26px; border-top: 2px solid ${PETROL}; padding-top: 18px; }
  .ctabloc { text-align: center; }
  .ctatitle { font-size: 16px; font-weight: 700; color: ${PETROL}; line-height: 21px; }
  .ctaname { font-size: 13.5px; font-weight: 700; color: #1f2937; line-height: 19px; padding-top: 9px; }
  .ctarole { font-weight: 400; color: ${PETROL}; }
  .ctaline { font-size: 12px; line-height: 19px; color: #6b7280; padding-top: 3px; }
  .ctasite { font-size: 12px; line-height: 19px; color: ${PETROL}; font-weight: 700; padding-top: 3px; }
</style>
</head>
<body>
<div class="brochure">

  <table class="head" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td valign="top">
        <div class="kicker">${esc(exp.accroche ?? exp.societe)}</div>
        <h1>${esc(metier.metier)}</h1>
        <div class="sub">Des outils pensés pour votre métier, pas un logiciel loué à tout le monde.</div>
      </td>
      <td valign="top" align="right" width="170">
        <img src="${esc(logo)}" width="150" alt="${esc(exp.societe)}"
             style="display:block;border:0;width:150px;height:auto;">
      </td>
    </tr>
  </table>

  ${metier.problematiques?.trim()
    ? `<div class="intro">
    Gérer une entreprise de <strong>${esc(metier.metier)}</strong> implique de jongler
    ${esc(metier.problematiques)}. Voici, thème par thème, ce que nous voyons le plus souvent
    sur le terrain — et ce que nous mettons en face.
  </div>`
    : '<div style="height:10px;"></div>'}

${blocs}

  <footer>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center" class="ctabloc">
          <div class="ctatitle">Parlons de votre besoin</div>
          <div class="ctaname">
            ${esc(exp.societe)}${exp.accroche ? ` <span class="ctarole">— ${esc(exp.accroche)}</span>` : ''}
          </div>
          <div class="ctaline">${lignesContact}</div>
          ${exp.siteUrl
            ? `<div class="ctasite">${esc(exp.siteUrl.replace(/^https?:\/\//, ''))}</div>`
            : ''}
        </td>
      </tr>
    </table>
  </footer>

</div>
</body>
</html>`
}
