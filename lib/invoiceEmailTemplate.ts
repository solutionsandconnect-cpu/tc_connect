// Template d'email pour l'envoi d'une facture / devis.
// La version HTML est prête pour un envoi serveur (SendGrid / Resend) — voir lib/sendInvoice.ts.
// La version texte est utilisée par le bouton "Email" (mailto:) en attendant.

export interface InvoiceEmailVars {
  clientName: string;   // "NOM Prénom"
  docLabel: string;     // "Facture" | "Devis"
  number: string;       // ex: FAC_001_010126
  dateEnvoi: string;    // date formatée fr-FR
  pdfUrl?: string;      // lien vers le PDF stocké
}

const TEL = "+33 6 79 40 82 54";
const MAIL = "contact@enezo.fr";

export function buildInvoiceEmailHtml({ clientName, docLabel, number, dateEnvoi, pdfUrl }: InvoiceEmailVars): string {
  const label = docLabel.toLowerCase();
  const pdfBlock = pdfUrl
    ? `<div class="section">Vous pouvez consulter votre ${label} en cliquant ici : <a href="${pdfUrl}" style="color:#1a73e8;">${docLabel} ${number}</a>.</div>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body, table, td, a { margin: 0; padding: 0; border: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    table { border-collapse: collapse !important; }
    body { font-family: Arial, sans-serif; padding: 40px; color: black; background-color: #ffffff; font-size: 13px; }
    .section { margin-top:10px; margin-bottom:10px; }
    .traitnoir { width: 100%; height: 1px; background-color: black; }
  </style>
</head>
<body>

<div class="section">Bonjour ${clientName},</div>

<div class="section">Voici, ci-joint, la ${label} ${number} pour l'échéance : ${dateEnvoi}.</div>
<br>
<div class="section">Dans le cas où le paiement n'est pas encore réalisé, cette ${label} est à régler dès réception.</div>
${pdfBlock}
<br>

<div class="traitnoir"></div>

<div class="section">
Pour toute question ou assistance, n'hésitez pas à revenir vers nous :<br>
<b>📞 ${TEL}</b><br>
<b>📧 ${MAIL}</b>
</div>
<br>

<p>Cordialement</p>
<br>

<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: middle; font-size: medium; font-family: Arial; min-width: 375px; width: 100%;">
  <tbody>
    <tr>
      <td style="text-align: center;">
        <img src="https://drive.google.com/thumbnail?id=1o_AiTLSFIXoEsmr7YKdJT7oGxPcv_I_l" width="130" style="max-width: 130px; display: inline-block;" alt="Logo">
      </td>
    </tr>
    <tr><td height="10"></td></tr>
    <tr>
      <td style="text-align: center;">
        <h2 style="margin: 0; font-size: 18px; color: #000001; font-weight: 600;">Enezo</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px 0;">
        <hr style="border: 0; border-bottom: 1px solid #000001; margin: 0;">
      </td>
    </tr>
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial;">
          <tbody>
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0" style="font-family: Arial;">
                  <tr style="height: 25px;">
                    <td width="30"><img src="https://drive.google.com/thumbnail?id=11QxuNd6t3ZnPyEpaF-AYRICvAdAa6KmY" alt="telephone" width="20"></td>
                    <td><a href="tel:+33679408254" style="text-decoration: none; color: #000001; font-size: 14px;">${TEL}</a></td>
                  </tr>
                  <tr style="height: 25px;">
                    <td width="30"><img src="https://drive.google.com/thumbnail?id=1k-67I-BTJChKh2qw7a-RW2p4ro9ebXZa" alt="email" width="20"></td>
                    <td><a href="mailto:${MAIL}" style="text-decoration: none; color: #000001; font-size: 14px;">${MAIL}</a></td>
                  </tr>
                </table>
              </td>
              <td style="text-align: right;">
                <a href="https://www.facebook.com/share/14SVaPgDpL/?mibextid=wwXIfr" style="display: inline-block; margin-right: 5px;"><img src="https://drive.google.com/thumbnail?id=1keeN2l14ufTvY5hHUQOGJwSADT-9KWhg" width="24" style="border-radius: 50%;"></a>
                <a href="https://www.instagram.com/solutionsandconnect/" style="display: inline-block; margin-right: 5px;"><img src="https://drive.google.com/thumbnail?id=14oeulhQPW-JDld8qJSorg5m6IcM7EX5z" width="24" style="border-radius: 50%;"></a>
                <a href="https://wa.me/33679408254" style="display: inline-block;"><img src="https://drive.google.com/thumbnail?id=1yJQUZRvuNFRBZhvTlo341nF5R6SmSpLy" width="24" style="border-radius: 50%;"></a>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px 0;">
        <hr style="border: 0; border-bottom: 1px solid #000001; margin: 0;">
      </td>
    </tr>
    <tr>
      <td style="text-align: center; font-size: 12px; max-width: 300px; margin: auto; padding-top: 1rem;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Enezo</p>
      </td>
    </tr>
  </tbody>
</table>

</body>
</html>`;
}

// Version texte (mailto:) — reprend la structure du template, sans HTML
export function buildInvoiceEmailText({ clientName, docLabel, number, dateEnvoi, pdfUrl }: InvoiceEmailVars): string {
  const label = docLabel.toLowerCase();
  return [
    `Bonjour ${clientName},`,
    ``,
    `Voici, ci-joint, la ${label} ${number} pour l'échéance : ${dateEnvoi}.`,
    ``,
    `Dans le cas où le paiement n'est pas encore réalisé, cette ${label} est à régler dès réception.`,
    ...(pdfUrl ? [``, `${docLabel} ${number} : ${pdfUrl}`] : []),
    ``,
    `————————————————————`,
    ``,
    `Pour toute question ou assistance, n'hésitez pas à revenir vers nous :`,
    `📞 ${TEL}`,
    `📧 ${MAIL}`,
    ``,
    `Cordialement,`,
    `Enezo`,
  ].join("\n");
}
