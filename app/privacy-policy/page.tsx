import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — TC Connect',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 26 mai 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Présentation</h2>
            <p>
              TC Connect (ci-après « l'Application ») est une application de gestion destinée aux coachs sportifs
              et à leurs clients. Elle est éditée par Solutions &amp; Connect. La présente politique de
              confidentialité explique comment nous collectons, utilisons, conservons et protégeons vos données
              personnelles conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679)
              et à la loi Informatique et Libertés.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Responsable du traitement</h2>
            <p>
              <strong>Solutions &amp; Connect</strong><br />
              Contact : <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Données collectées</h2>
            <p>Nous collectons les catégories de données suivantes :</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Données d'identité</strong> : prénom, nom</li>
              <li><strong>Données de contact</strong> : adresse e-mail, numéro de téléphone</li>
              <li><strong>Données de compte</strong> : identifiant unique, rôle dans l'application</li>
              <li><strong>Données de suivi sportif</strong> : planning des séances, programme d'entraînement, compte rendus de séance, objectifs</li>
              <li><strong>Données de santé</strong> : antécédents médicaux, indications médicales (données sensibles — collectées uniquement avec votre consentement explicite)</li>
              <li><strong>Données de facturation</strong> : abonnements, historique des paiements</li>
              <li><strong>Données techniques</strong> : identifiant de l'appareil, logs de connexion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Finalités du traitement</h2>
            <p>Vos données sont traitées pour les finalités suivantes :</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Gestion de votre compte et authentification</li>
              <li>Fourniture du service de coaching sportif personnalisé</li>
              <li>Planification et suivi des séances d'entraînement</li>
              <li>Gestion des abonnements et de la facturation</li>
              <li>Communication entre le coach et le client</li>
              <li>Amélioration de l'application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Base légale du traitement</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Exécution d'un contrat</strong> : données nécessaires à la prestation de coaching</li>
              <li><strong>Consentement explicite</strong> : données de santé (article 9 RGPD)</li>
              <li><strong>Intérêt légitime</strong> : amélioration du service, sécurité</li>
              <li><strong>Obligation légale</strong> : conservation des données de facturation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Durée de conservation</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Données de compte</strong> : pendant la durée de la relation commerciale + 3 ans après la dernière connexion</li>
              <li><strong>Données de facturation</strong> : 10 ans (obligation légale)</li>
              <li><strong>Données de santé</strong> : durée de la relation de coaching, puis suppression sur demande</li>
              <li><strong>Logs techniques</strong> : 12 mois</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Destinataires des données</h2>
            <p>Vos données sont accessibles :</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Votre coach personnel (accès à votre profil et suivi sportif)</li>
              <li><strong>Google Firebase</strong> (infrastructure cloud — hébergement, authentification, base de données) — serveurs susceptibles d'être localisés hors UE, encadrés par les clauses contractuelles types de la Commission européenne</li>
            </ul>
            <p className="mt-2">Nous ne vendons, ne louons ni ne partageons vos données avec des tiers à des fins commerciales.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
              <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données (« droit à l'oubli »)</li>
              <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition</strong> : vous opposer à certains traitements</li>
              <li><strong>Droit à la limitation</strong> : limiter le traitement de vos données</li>
              <li><strong>Droit de retirer votre consentement</strong> à tout moment pour les traitements basés sur le consentement</li>
            </ul>
            <p className="mt-3">
              Pour exercer vos droits, contactez-nous à : <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>.
              Nous répondrons dans un délai de 30 jours. Vous pouvez également saisir la CNIL (
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.cnil.fr</a>).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos
              données contre l'accès non autorisé, la perte ou la destruction : chiffrement en transit (TLS),
              authentification sécurisée via Firebase Auth, accès limité aux données selon le rôle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Données des mineurs</h2>
            <p>
              L'Application n'est pas destinée aux personnes de moins de 16 ans. Si vous êtes parent ou tuteur
              d'un mineur dont les données auraient été collectées par erreur, contactez-nous pour les supprimer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Modifications</h2>
            <p>
              Nous pouvons mettre à jour cette politique. La date de « dernière mise à jour » en haut de page
              sera modifiée. Pour les changements significatifs, nous vous notifierons via l'application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
            <p>
              Pour toute question relative à cette politique ou à vos données personnelles :<br />
              <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
