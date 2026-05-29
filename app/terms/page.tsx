import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — TC Connect",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 26 mai 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de
              l'application TC Connect, éditée par Solutions &amp; Connect. En utilisant l'Application, vous
              acceptez ces CGU sans réserve.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description du service</h2>
            <p>
              TC Connect est une application de gestion destinée aux coachs sportifs professionnels et à leurs
              clients. Elle permet notamment :
            </p>
            <ul className="list-disc pl-6 space-y-1.5 mt-2">
              <li>La planification et le suivi des séances d'entraînement</li>
              <li>La gestion des programmes d'exercices</li>
              <li>Le suivi des abonnements et de la facturation</li>
              <li>La communication entre le coach et ses clients</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Inscription et compte</h2>
            <p>
              L'accès à l'Application nécessite la création d'un compte. Vous vous engagez à fournir des
              informations exactes, complètes et à jour lors de l'inscription et à maintenir la confidentialité
              de vos identifiants de connexion. Vous êtes responsable de toute activité effectuée depuis votre
              compte.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Utilisation acceptable</h2>
            <p>Vous vous engagez à ne pas :</p>
            <ul className="list-disc pl-6 space-y-1.5 mt-2">
              <li>Utiliser l'Application à des fins illégales ou frauduleuses</li>
              <li>Accéder aux données d'autres utilisateurs sans autorisation</li>
              <li>Perturber le fonctionnement de l'Application</li>
              <li>Tenter de contourner les mesures de sécurité</li>
              <li>Transmettre des contenus illicites, offensants ou trompeurs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Données de santé</h2>
            <p>
              L'Application peut recueillir des informations relatives à votre santé (antécédents médicaux,
              contre-indications) dans le cadre de votre suivi sportif personnalisé. Ces données sont
              considérées comme des données sensibles au sens du RGPD. Leur collecte est soumise à votre
              consentement explicite et ne sera utilisée qu'à des fins de suivi sportif par votre coach.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Propriété intellectuelle</h2>
            <p>
              L'ensemble des éléments de l'Application (code source, interfaces, logos, contenus) sont la
              propriété exclusive de Solutions &amp; Connect, protégés par le droit de la propriété
              intellectuelle. Toute reproduction ou utilisation non autorisée est interdite.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Disponibilité du service</h2>
            <p>
              Nous nous efforçons de maintenir l'Application disponible en permanence, mais ne pouvons garantir
              une disponibilité sans interruption. Des opérations de maintenance peuvent entraîner des
              interruptions temporaires.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Responsabilité</h2>
            <p>
              TC Connect est un outil de gestion et de communication. Les conseils sportifs et médicaux
              relèvent de la responsabilité exclusive du coach. Nous ne saurions être tenus responsables des
              dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser
              l'Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Résiliation</h2>
            <p>
              Vous pouvez supprimer votre compte à tout moment en nous contactant à{' '}
              <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>{' '}
              ou via la fonctionnalité de suppression de compte dans l'Application. La résiliation entraîne
              la suppression de vos données conformément à notre politique de confidentialité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux tribunaux
              compétents du ressort de domicile de l'éditeur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact</h2>
            <p>
              Pour toute question :{' '}
              <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
