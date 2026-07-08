import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Suppression de compte — TC Connect',
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Suppression de compte et données</h1>
        <p className="text-sm text-gray-500 mb-8">Conformément au RGPD et aux politiques des stores</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Droit à l'effacement</h2>
            <p className="text-blue-800">
              Vous avez le droit de demander la suppression de votre compte et de l'ensemble de vos données
              personnelles à tout moment, conformément à l'article 17 du RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Comment supprimer votre compte</h2>
            <p className="mb-4">Vous pouvez demander la suppression de votre compte et de vos données par e-mail :</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-600 mb-1">Envoyez un e-mail à :</p>
              <a
                href="mailto:contact@enezo.fr?subject=Demande de suppression de compte TC Connect&body=Bonjour,%0D%0A%0D%0AJe souhaite supprimer mon compte TC Connect et l'ensemble de mes données personnelles.%0D%0A%0D%0AMon adresse e-mail de compte : [votre email]%0D%0A%0D%0ACordialement"
                className="text-lg font-semibold text-blue-600 hover:underline"
              >
                contact@enezo.fr
              </a>
              <p className="text-sm text-gray-500 mt-2">
                Objet : <em>Demande de suppression de compte TC Connect</em>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Délai de traitement</h2>
            <p>
              Nous traiterons votre demande dans un délai maximum de <strong>30 jours</strong> à compter de
              sa réception. Vous recevrez une confirmation par e-mail une fois la suppression effectuée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Données supprimées</h2>
            <p className="mb-3">Suite à votre demande, les données suivantes seront supprimées :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Votre profil (nom, prénom, e-mail, téléphone)</li>
              <li>Votre historique de séances et planning</li>
              <li>Vos données de santé et indications médicales</li>
              <li>Votre programme d'exercices personnalisé</li>
              <li>Vos informations d'abonnement</li>
              <li>Votre compte d'authentification</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Données conservées</h2>
            <p className="mb-3">Certaines données peuvent être conservées pour des obligations légales :</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Données de facturation</strong> : conservées 10 ans conformément aux obligations
                comptables françaises (article L123-22 du Code de commerce), sous forme anonymisée si possible
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions ?</h2>
            <p>
              Pour toute question sur la gestion de vos données personnelles, consultez notre{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:underline">Politique de confidentialité</a>{' '}
              ou contactez-nous à{' '}
              <a href="mailto:contact@enezo.fr" className="text-blue-600 hover:underline">contact@enezo.fr</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
