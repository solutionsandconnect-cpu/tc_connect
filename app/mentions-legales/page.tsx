import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mentions légales — TC Connect',
}

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mentions légales</h1>
        <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : 2 juillet 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Éditeur de l'application</h2>
            <p>
              L'application <strong>TC Connect</strong> est éditée par :
            </p>
            <p className="mt-2">
              <strong>Solutions &amp; Connect</strong> — entreprise individuelle (micro-entreprise)<br />
              Exploitant : Teddy BLOUET<br />
              16 rue des Violettes, 56760 Pénestin, France<br />
              SIRET : 851 982 058 00014<br />
              Téléphone : <a href="tel:+33679408254" className="text-blue-600 hover:underline">06 79 40 82 54</a><br />
              E-mail : <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              TVA non applicable, article 293 B du Code général des impôts (franchise en base de TVA).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Directeur de la publication</h2>
            <p>
              Le directeur de la publication est <strong>Teddy BLOUET</strong>, en qualité d'exploitant de
              l'entreprise individuelle Solutions &amp; Connect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Hébergement</h2>
            <p>L'application et ses données sont hébergées par :</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>
                <strong>Vercel Inc.</strong> (hébergement de l'application web)<br />
                340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis<br />
                <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vercel.com</a>
              </li>
              <li>
                <strong>Google Cloud / Firebase</strong> — Google Ireland Limited (authentification, base de données, stockage)<br />
                Gordon House, Barrow Street, Dublin 4, Irlande<br />
                <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">firebase.google.com</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Propriété intellectuelle</h2>
            <p>
              L'ensemble des éléments de l'application (code source, interfaces, logos, textes, contenus) sont la
              propriété exclusive de Solutions &amp; Connect, sauf mention contraire. Toute reproduction,
              représentation ou utilisation, totale ou partielle, sans autorisation écrite préalable, est
              interdite et constitue une contrefaçon sanctionnée par le Code de la propriété intellectuelle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Données personnelles</h2>
            <p>
              Le traitement des données personnelles est décrit dans notre{' '}
              <a href="/privacy-policy" className="text-blue-600 hover:underline">politique de confidentialité</a>,
              conforme au Règlement Général sur la Protection des Données (RGPD — UE 2016/679). Vous pouvez
              exercer vos droits à tout moment à l'adresse{' '}
              <a href="mailto:solutionsandconnect@gmail.com" className="text-blue-600 hover:underline">solutionsandconnect@gmail.com</a>,
              ou saisir la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.cnil.fr</a>).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Conditions d'utilisation</h2>
            <p>
              L'utilisation de l'application est régie par nos{' '}
              <a href="/terms" className="text-blue-600 hover:underline">Conditions Générales d'Utilisation</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact</h2>
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
