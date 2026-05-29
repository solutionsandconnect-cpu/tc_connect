export const sendInvoiceEmail = async (email: string, pdfUrl: string) => {
  await fetch("/api/send-invoice", {
    method: "POST",
    body: JSON.stringify({
      to: email,
      subject: "Votre facture",
      pdfUrl,
    }),
  });
};