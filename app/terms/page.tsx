import type { Metadata } from 'next'
import { getServerBrand } from '@/lib/brandServer'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getServerBrand()
  const nomApp = brand === 'enezo' ? 'Enezo' : 'TC Connect'
  return { title: `Conditions Générales d'Utilisation — ${nomApp}` }
}

export default async function TermsPage() {
  const brand = await getServerBrand()
  const nomApp = brand === 'enezo' ? 'Enezo' : 'TC Connect'
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full px-6 md:px-10 lg:px-16 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions Générales d'Utilisation</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 10 juillet 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          {brand === 'enezo' ? <EnezoTermsBody nomApp={nomApp} /> : <CoachingTermsBody nomApp={nomApp} />}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────  COACHING (texte d'origine, INCHANGÉ)  ───────────────────────── */
function CoachingTermsBody({ nomApp }: { nomApp: string }) {
  return (
    <>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de
          l'application {nomApp}, éditée par Enezo (Teddy BLOUET, entrepreneur individuel). En utilisant l'Application, vous
          acceptez ces CGU sans réserve.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description du service</h2>
        <p>
          {nomApp} est une application de gestion destinée aux coachs sportifs professionnels et à leurs
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
          propriété exclusive de Teddy BLOUET (Enezo), protégés par le droit de la propriété
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
          {nomApp} est un outil de gestion et de communication. Les conseils sportifs et médicaux
          relèvent de la responsabilité exclusive du coach. Nous ne saurions être tenus responsables des
          dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser
          l'Application.
        </p>
      </section>

      <TermsTailCommon startAt={9} />
    </>
  )
}

/* ─────────────────────────  ENEZO (studio de dev d'apps sur mesure)  ───────────────────────── */
function EnezoTermsBody({ nomApp }: { nomApp: string }) {
  return (
    <>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Objet</h2>
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de
          l'application {nomApp}, espace client d'Enezo, éditée par Enezo (Teddy BLOUET, entrepreneur
          individuel). En utilisant l'Application, vous acceptez ces CGU sans réserve.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description du service</h2>
        <p>
          {nomApp} est l'espace client d'Enezo, studio de développement d'applications sur mesure. Elle
          permet notamment :
        </p>
        <ul className="list-disc pl-6 space-y-1.5 mt-2">
          <li>Le suivi des projets et des prestations de développement</li>
          <li>La consultation des devis, contrats et documents</li>
          <li>Le suivi des abonnements et de la facturation</li>
          <li>La communication avec Enezo</li>
          <li>L'accès à des applications proposées par abonnement (boutique)</li>
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
        <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Abonnements et boutique d'applications</h2>
        <p>
          L'Application donne accès à des applications proposées par abonnement. L'accès à ces applications
          est conditionné à un abonnement actif. Certaines applications peuvent recueillir des données
          personnelles, y compris des <strong>données sensibles au sens du RGPD</strong> (par exemple des
          données relatives à la santé ou à un enfant), dans le cadre de leur fonctionnement. Ces données
          sont collectées uniquement avec votre <strong>consentement explicite</strong> et ne sont utilisées
          qu'aux fins de la fonctionnalité de l'application concernée, conformément à notre{' '}
          <a href="/privacy-policy" className="text-blue-600 hover:underline">politique de confidentialité</a>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Propriété intellectuelle</h2>
        <p>
          L'ensemble des éléments de l'Application (code source, interfaces, logos, contenus) sont la
          propriété exclusive de Teddy BLOUET (Enezo), protégés par le droit de la propriété
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
          {nomApp} est un outil de gestion, de suivi de prestations et de communication. Les applications
          proposées via la boutique sont fournies « en l'état ». Nous ne saurions être tenus responsables des
          dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser
          l'Application.
        </p>
      </section>

      <TermsTailCommon startAt={9} />
    </>
  )
}

/* Sections communes (résiliation, droit applicable, contact) — identiques aux deux marques. */
function TermsTailCommon({ startAt }: { startAt: number }) {
  return (
    <>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{startAt}. Résiliation</h2>
        <p>
          Vous pouvez supprimer votre compte à tout moment en nous contactant à{' '}
          <a href="mailto:contact@enezo.fr" className="text-blue-600 hover:underline">contact@enezo.fr</a>{' '}
          ou via la fonctionnalité de suppression de compte dans l'Application. La résiliation entraîne
          la suppression de vos données conformément à notre politique de confidentialité.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{startAt + 1}. Droit applicable</h2>
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux tribunaux
          compétents du ressort de domicile de l'éditeur.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-3">{startAt + 2}. Contact</h2>
        <p>
          Pour toute question :{' '}
          <a href="mailto:contact@enezo.fr" className="text-blue-600 hover:underline">contact@enezo.fr</a>
        </p>
      </section>
    </>
  )
}
