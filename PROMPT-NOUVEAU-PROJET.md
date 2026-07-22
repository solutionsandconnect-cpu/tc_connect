# Prompt de démarrage — nouveau projet

> **Mode d'emploi.** Créer le dossier du projet, l'ouvrir dans VS Code, lancer Claude Code,
> et coller tout ce qui suit la ligne de séparation. Ce fichier est fait pour **évoluer** :
> à chaque projet, ce qui a manqué se rajoute ici.
>
> **Un modèle de code existe déjà** : `C:\Users\teddy\template-enezo`. Il contient tout ce
> qui est décrit ci-dessous, déjà écrit et fonctionnel. Le plus rapide est de le copier puis
> de l'adapter ; ce prompt sert alors de cahier des charges et de rappel des règles.

## Marche à suivre pour démarrer un projet

**1. Copier le modèle** (30 s)
```
xcopy /E /I /EXCLUDE:nul C:\Users\teddy\template-enezo C:\Users\teddy\<nom-du-projet>
```
Puis supprimer `node_modules`, `.next` et `.git` de la copie, et faire `npm install`.
*(Le jour où le modèle est stable : le pousser sur GitHub en « Template repository » et
passer par « Use this template » — l'historique reste alors propre et séparé.)*

**2. Renommer** (2 min) — le `name` dans `package.json`, le titre dans `app/layout.tsx`,
`app/manifest.ts`, la Navbar et le pied des pages légales. Un `git init` pour repartir d'un
historique vierge.

**3. Créer le projet Firebase** (10 min) — console Firebase, activer Authentification
(e-mail/mot de passe), Firestore et Storage. **Choisir la région européenne** : elle ne se
change plus après. Récupérer les clés du SDK web et une clé de compte de service, les mettre
dans `.env.local`.

**4. Brancher Firebase** (1-2 h) — c'est le seul vrai travail technique :
- `lib/firebase.ts` et `lib/firebaseAdmin.ts` ;
- réécrire **l'intérieur** de `context/AuthContext.tsx` (`onAuthStateChanged` +
  `onSnapshot` sur `users/{uid}`). Son contrat ne change pas : aucun écran à toucher ;
- créer un `lib/<entité>Service.ts` par domaine et remplacer les imports de
  `lib/demoData.ts` ;
- **supprimer `lib/demoData.ts`** une fois le dernier import remplacé — tant qu'il existe,
  on ne sait plus quel écran est réellement branché.

**5. Adapter l'entité d'exemple** (30 min) — renommer `Element` en ce que gère l'app
(chantier, intervention, adhérent…), ajuster ses champs et ses statuts. La page de liste et
ses filtres suivent sans être réécrits.

**6. Habiller** (15 min) — remplacer la famille `accent` dans `globals.css` par la couleur du
client, et le monogramme par son logo. C'est tout : aucun composant n'écrit de couleur.

**7. Générer les icônes PWA** (10 min) — `public/icon-192.png` et `icon-512.png` (maskable,
avec ~10 % de marge), plus `apple-touch-icon.png` en 180. **Sans elles, Android ne propose
pas l'installation.**

**8. Remplir les pages légales** (30 min) — tous les passages surlignés. Adapter la politique
de confidentialité aux données **réellement** collectées.

**9. Écrire les règles Firestore** (30 min) — puis **les déployer et les tester avec un vrai
compte non-admin**. ⚠️ C'est l'étape la plus souvent oubliée : une page peut autoriser une
action que les règles refusent, et l'échec est alors silencieux.

**10. Déployer** (20 min) — connecter le dépôt à Vercel, **recopier toutes les variables
d'environnement dans le dashboard**, déployer, puis vérifier sur mobile : connexion,
installation PWA, notification push.

Compter une demi-journée à une journée pour arriver à une application déployée et vidée de
ses données de démonstration.

---

Tu démarres un nouveau projet pour moi. Lis tout avant d'écrire la moindre ligne, puis
pose-moi les questions de la dernière section — je veux valider le cadrage avant que tu codes.

## Qui je suis

Développeur indépendant (Enezo, Pénestin, Morbihan). Je conçois des **applications de gestion
sur mesure** pour des artisans et des petites entreprises : planning, suivi de chantier,
devis, comptes rendus. Je travaille **seul**, donc chaque ligne que tu écris, c'est moi qui
la maintiendrai. **Réponds-moi toujours en français.**

## Stack — non négociable

- **Next.js 16** (App Router) · **React 19** · **TypeScript** strict
- **Tailwind CSS v4** — pas de `tailwind.config.js`, le thème vit dans `globals.css` (`@theme`)
- **Firebase** : Auth (email + mot de passe), Firestore, Storage — SDK client v12
- **firebase-admin** v13 pour tout ce qui touche au serveur
- **@heroicons/react** pour les icônes
- Déploiement **Vercel**

⚠️ **Next.js 16 comporte des ruptures par rapport à ce que tu connais peut-être** : `params`
et `headers()` sont asynchrones, `middleware.ts` s'appelle désormais `proxy.ts`, etc.
**Avant d'écrire du code touchant aux conventions de fichiers, lis la doc embarquée dans
`node_modules/next/dist/docs/`** plutôt que de te fier à ta mémoire.

## Structure de dossiers

```
app/
  (auth)/login                      → connexion (publique)
  (legal)/…                         → pages légales (PUBLIQUES, sans compte)
  (dashboard)/…                     → pages protégées, layout commun
  api/…                             → routes serveur (Admin SDK)
components/
  ui/                               → primitives + champs réutilisables
  layout/Navbar.tsx
context/AuthContext.tsx
hooks/
lib/
  firebase.ts                       → SDK client
  firebaseAdmin.ts                  → Admin SDK (serveur uniquement)
  firebaseUtils.ts                  → helpers partagés (cleanForFirestore…)
  <domaine>Service.ts               → accès Firestore d'un domaine
  <domaine>Model.ts                 → règles métier PURES (zéro dépendance Firestore/React)
types/index.ts                      → tous les types, un par document Firestore
```

## Système de design — la base de tout

⚠️ **C'est ce qui distingue une app pro d'un rendu bricolé.** À faire AVANT les écrans.

- **Tokens sémantiques dans `globals.css`** (`@theme`) : une famille `accent` (la seule à
  changer pour rebrander), une famille `ink` (neutres légèrement froids, plus élégants qu'un
  gris pur), et des couleurs d'état (`ok`, `warn`, `danger`). **Aucun composant n'écrit une
  couleur en dur.**
- **Des primitives partagées** dans `components/ui/primitives.tsx` : `Card`, `Button`
  (variantes primary / secondary / ghost / danger), `IconButton`, `Badge`, `FilterChip`,
  `Field`, `EmptyState`, `PageHeader`, `BoutonRetour`. Répéter les classes Tailwind à la main
  sur chaque écran produit, au bout de trois pages, deux rayons différents et trois gris.
- **Fond légèrement teinté** (`ink-50`) pour que le blanc des cartes s'en détache : un blanc
  sur blanc n'a aucune profondeur.
- Ombres très douces plutôt que des bordures franches, titres au `letter-spacing` resserré,
  chiffres en `tabular-nums` pour qu'ils s'alignent, anneau de focus homogène.
- ⚠️ **`cursor: pointer` sur tout ce qui se clique** — les navigateurs ne le font PAS pour
  les `<button>`. Sans cette règle globale, la moitié de l'interface paraît inerte.
- ⚠️ **`min-w-0` sur les enfants de grille et de flex** : sans ça, un texte long élargit le
  conteneur et fait déborder la page horizontalement sur mobile au lieu d'être tronqué.

## Conventions de code

- **Commentaires en français**, et ils expliquent le **pourquoi** — une décision, un piège,
  une contrainte — jamais le **quoi**. Un commentaire qui paraphrase le code est du bruit.
- **Un service par domaine**. Lectures en temps réel avec `onSnapshot`, **tri côté client**
  (ça évite de créer des index composites Firestore pour chaque écran).
- ⚠️ **`cleanForFirestore()` retire les `undefined` ET les chaînes vides.** Pour qu'un champ
  puisse être **vidé**, réinjecter explicitement le `''` après l'appel.
- **Types** : une interface par collection, avec le chemin du document en commentaire.
- **Toujours une confirmation** avant une action destructrice ou de masse, en annonçant le
  **nombre exact** d'éléments concernés.
- Interfaces « propres et pro » : **des icônes, pas des emojis**.
- **Pleine largeur** : pas de `max-w-…` qui centre le contenu sur une colonne étroite.
  Exception : les formulaires de connexion (≈ 420 px).

## Les trois rôles — toujours présents

```ts
type RoleApp = 'SuperAdmin' | 'Admin' | 'Utilisateur'
```

- **`SuperAdmin`** — moi, l'éditeur. Accès technique et transverse. **Ce rôle ne se donne
  jamais depuis l'interface** : promotion côté serveur ou en base.
- **`Admin`** — le ou les référents chez le client. Pilotent leur activité, pas le
  paramétrage technique.
- **`Utilisateur`** — usagers finaux, qui ne voient que leurs données.

Le contexte expose `isAdmin` (Admin **ou** SuperAdmin — la plupart des écrans ne
distinguent que « administre / n'administre pas ») et `isSuperAdmin` à part.

## Écrans attendus dans TOUT projet

**Connexion** — e-mail + mot de passe, et **« Mot de passe oublié ? »**.
⚠️ Le message de réinitialisation doit être **identique que l'adresse existe ou non** :
répondre « compte inconnu » permettrait de découvrir qui est inscrit.

**Accueil** — quelques statistiques **et du contenu réel** (derniers éléments, prochains
rendez-vous). Une page de tuiles vides ne sert à rien.

**Planning** — deux vues, **semaine et mois**, avec bascule. La vue mensuelle garde 6
semaines fixes, sinon la grille saute de 5 à 6 lignes et le contenu se déplace. Points
d'occupation sur les jours, détail du jour choisi en dessous.

**Page de liste** (le motif le plus réutilisable, quelle que soit l'entité) — recherche,
**filtres en pastilles avec compteurs**, bouton de réinitialisation avec le nombre de
critères actifs, compteur « X affichés sur Y », modale unique création/édition, actions par
ligne, **mode sélection multiple désactivé par défaut** (des cases toujours visibles
encombrent et invitent au clic accidentel) avec actions groupées, et un message de liste
vide qui distingue « rien créé » de « rien trouvé ».

**Notifications** — historique in-app, non-lues surlignées, « tout marquer comme lu »,
**suppression individuelle et globale**, recherche et filtres par nature.
⚠️ **Le lien de destination est OBLIGATOIRE dans le type** : une notification annonce un fait
survenu quelque part, son seul intérêt est d'y mener.

**Messagerie** — navigation **en deux temps** (liste des discussions, puis le fil), sur tous
les écrans : pas de double panneau, on lit une conversation à la fois. Le fil s'ouvre en
**plein écran** et recouvre la barre du bas sur mobile. Avec :
- **discussions de groupe** (le nom de groupe n'est demandé qu'à partir de 2 personnes) ;
- **ajout de participants** depuis le fil — c'est ainsi que naissent la plupart des groupes ;
- **accusés de lecture** : une liste `{uid, at}`, jamais un booléen — en groupe, « lu » ne
  veut rien dire sans savoir par qui ;
- **pièces jointes** (photos, vidéos, documents) avec aperçu direct pour les médias et le
  poids affiché pour les fichiers ;
- le nom de l'auteur affiché **au changement d'auteur seulement**, sinon la lecture est hachée.

**Mon profil** — informations, **photo avec recadrage**, coordonnées, **bloc « Connexion et
sécurité »** (changer l'adresse de connexion et le mot de passe, séparés du reste car ils
exigent une re-authentification Firebase), **installation PWA**, et les **liens légaux**.

**Pages légales publiques** — mentions légales, politique de confidentialité (structure RGPD :
finalités, bases légales, sous-traitants, durées, droits) et conditions d'utilisation.
⚠️ **Les éléments à compléter doivent être SURLIGNÉS** dans le gabarit : une mention légale
laissée avec un texte plausible est pire qu'une case vide — on la publie sans la voir, et
elle engage juridiquement.

## Champs de formulaire — les règles

**Photo de profil** — recadrage carré (zoom + déplacement), sortie en 512 px JPEG, et
**deux aperçus en direct, en rond et en carré arrondi**, pour voir où les angles rognent.
Consigne « photo de type identité » affichée **avant** le recadrage : une fois la photo
cadrée de travers, personne ne recommence. Recadrage en canvas natif, sans dépendance.

**Téléphone** — **toujours un sélecteur d'indicatif** à côté, et la forme internationale
stockée. Sans indicatif, un numéro belge ou suisse est inexploitable pour un SMS.
⚠️ **Drapeaux en SVG inline** : pas d'emoji (ils s'affichent en lettres sous Windows), pas de
CDN externe (requête qui échoue hors ligne, fuite RGPD, règle CSP de plus). Menu maison, un
`<select>` natif n'accepte que du texte.

**Adresse postale** — autocomplétion via **`api-adresse.data.gouv.fr`** (Base Adresse
Nationale : service public, gratuit, sans clé, CORS ouvert). Anti-rebond de 300 ms, requêtes
annulées à la frappe suivante, minimum 3 caractères. Le choix remplit code postal et ville,
qui restent **modifiables** : la base ne connaît pas tout.

**Date de naissance** — presque toujours utile, avec l'âge calculé à côté et une date future
impossible à saisir.

**Partout** : des **barres de recherche** et **beaucoup de filtres en pastilles** avec
compteurs. Ne **jamais masquer une catégorie vide** — l'afficher en pointillés grisés, sinon
je crois à un oubli.

## Brique — Authentification, rôles et navigation

- Inscription et connexion par email + mot de passe.
- Document **`users/{uid}`** : `email`, `nom`, `prenom`, `telephone`, `role_app`, `createdAt`.
- **`context/AuthContext.tsx`** expose `profil` (chargé en direct via `onSnapshot`, pour qu'un
  changement de rôle s'applique sans reconnexion), `chargement`, `isAdmin`, `isSuperAdmin`,
  `connexion`, `deconnexion`.
- Groupe **`(dashboard)`** dont le layout **porte la garde d'accès** : une page ajoutée est
  protégée d'office, on ne peut pas oublier de le faire.
- **Navbar déclarative** : un tableau d'entrées avec des drapeaux `adminOnly` /
  `superAdminOnly`. Barre latérale sur desktop, **barre du bas sur mobile limitée à 5
  entrées** (au-delà, les libellés se chevauchent). Compteur de non-lus sur Notifications.
  ⚠️ La barre du bas en `fixed` **se décolle en PWA iOS** au rebond de défilement : prévoir
  `overflow-x: clip`, `overscroll-behavior` et un `translateZ(0)` sur la barre.
- **Bouton retour propre** : icône **et** libellé de la destination, zone cliquable d'au
  moins 40 px. Une flèche seule est trop petite à viser au doigt et ne dit pas où elle mène.

## Brique — PWA et notifications push

- `app/manifest.ts`, icônes **192 et 512** (dont une maskable) + `apple-touch-icon` 180.
- **Procédure d'installation sur la page profil** : bouton direct quand
  `beforeinstallprompt` est disponible, **et consignes pas à pas adaptées à la plateforme
  sinon**. ⚠️ iOS n'expose aucune API d'installation : le seul chemin est
  « Partager → Sur l'écran d'accueil ». Sans consigne écrite, un utilisateur iPhone
  n'installera jamais l'application. Toute la détection dans un `useEffect`, sinon erreur
  d'hydratation.
- **Web Push avec VAPID** (paquet `web-push`), **pas** Firebase Cloud Messaging.
- ⚠️ **Une souscription par APPAREIL**, jamais par compte : identifiant du document =
  `sha256(endpoint)`. Sinon seul le dernier appareil ouvert reçoit les notifications.
- Collections : `push_subscriptions`, `Notifications`, `notif_dedupe` (⚠️ prévoir une purge).
- Trois variables : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.
  ⚠️ **Les poser aussi sur Vercel et redéployer** — une clé désynchronisée fait échouer les
  envois **en silence** (erreur 403 avalée).

## Brique — Envoi d'e-mails (si le projet en a besoin)

- **Prestataire : Brevo**, API transactionnelle. C'est bien du **transactionnel** (déclenché
  par une action), donc l'usage prévu — à ne pas confondre avec de la prospection.
- **Le compte est ouvert au NOM DU CLIENT** : les coûts restent chez lui.
- **Authentifier son domaine** (SPF, DKIM, DMARC), ce qui suppose **d'accéder à sa zone DNS**.
- Couche d'envoi isolée (`lib/mailer.ts`), expéditeur et clé en variables d'environnement.

**À demander au client dès le cadrage :**
1. **A-t-il un nom de domaine ?** Sinon, délivrabilité et crédibilité moindres.
2. **Qui gère sa zone DNS ?** Il me faut un accès, ou quelqu'un capable d'ajouter 3 champs.
3. **Quelle adresse d'expédition, et où arrivent les réponses ?** ⚠️ Si l'adresse d'envoi
   n'est pas une boîte relevée, prévoir un `Reply-To` — sinon les réponses se perdent.

## Variables d'environnement attendues

```
NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID / STORAGE_BUCKET /
  MESSAGING_SENDER_ID / APP_ID
FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY   (Admin SDK)
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL
```

⚠️ `FIREBASE_PRIVATE_KEY` contient des `\n` **littéraux** : les convertir en vrais retours à
la ligne avant de créer le credential, sinon erreur `DECODER routines::unsupported`.

## Règles Firestore

Écrire un `firestore.rules` de départ, **fermé par défaut** : chacun lit et écrit ses propres
données, l'admin a un accès élargi via une fonction `isAdmin()`. Ne jamais laisser une
collection en `allow read, write: if true`.
⚠️ Vérifier que les rôles applicatifs et les règles disent la même chose — une page peut
autoriser une action que les règles refusent, et l'échec est alors silencieux.

## Ce que tu ne fais pas

- **Tu ne commit ni ne push jamais** sans que je le demande explicitement. Je gère mon git.
- Tu n'écris pas de tests tant que je ne les demande pas.
- Tu ne pars pas dans des refactorisations que je n'ai pas demandées : implémente ce qui est
  demandé, puis **signale-moi** ce qui te paraît discutable.
- Tu ne me présentes pas un travail comme terminé s'il n'est pas vérifié. Dis clairement ce
  que tu n'as pas pu tester (rendu navigateur, authentification…).

## Avant de commencer, demande-moi

1. Le **nom du projet** et à qui il s'adresse (client final, métier).
2. Les **entités principales** que l'app doit gérer (chantiers ? interventions ? adhérents ?).
3. S'il faut des **rôles** au-delà des trois habituels.
4. Si l'app est **destinée à un client** (donc à sa charte graphique) ou à moi.
5. Si l'app doit **envoyer des e-mails** — et si oui, les trois questions de la brique e-mail.

Puis propose-moi le plan avant d'écrire le code.

---

## Notes d'évolution

- **2026-07-22** — première version, extraite des conventions réelles de tc-connect, puis
  enrichie en construisant le modèle `template-enezo` : système de design par tokens,
  primitives partagées, trois rôles, écrans notifications / messagerie / profil / planning,
  pages légales, champs photo-téléphone-adresse-naissance, installation PWA.

### Comment faire évoluer ce fichier

Après chaque projet démarré avec ce prompt, se poser trois questions :
1. **Qu'ai-je dû réexpliquer ?** → ça manque ici.
2. **Qu'ai-je supprimé du code généré ?** → c'est de trop ici.
3. **Quel piège ai-je rencontré ?** → l'ajouter avec un ⚠️, en expliquant la conséquence
   concrète et pas seulement la règle.
