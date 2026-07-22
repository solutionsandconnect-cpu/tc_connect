# Prompt de démarrage — nouveau projet

> **Mode d'emploi.** Créer le dossier du projet, l'ouvrir dans VS Code, lancer Claude Code,
> et coller tout ce qui suit la ligne de séparation. Ce fichier est fait pour **évoluer** :
> à chaque projet, ce qui a manqué se rajoute ici.

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
  (auth)/login, (auth)/register     → pages publiques
  (dashboard)/…                     → pages protégées, avec layout commun
  api/…                             → routes serveur (Admin SDK)
components/
  ui/                               → briques réutilisables (Modal, AutoTextarea…)
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

## Conventions de code

- **Commentaires en français**, et ils expliquent le **pourquoi** — une décision, un piège,
  une contrainte — jamais le **quoi**. Un commentaire qui paraphrase le code est du bruit.
- **Un service par domaine**. Lectures en temps réel avec `onSnapshot`, **tri côté client**
  (ça évite de créer des index composites Firestore pour chaque écran).
- ⚠️ **`cleanForFirestore()` retire les `undefined` ET les chaînes vides.** Pour qu'un champ
  puisse être **vidé**, réinjecter explicitement le `''` après l'appel. Ce piège m'a déjà
  coûté plusieurs corrections : un champ effacé dans l'UI qui restait en base.
- **Types** : une interface par collection, dans `types/index.ts`, avec un commentaire
  indiquant le chemin du document (`prospects/{id}`).
- **Modales** : un composant `components/ui/Modal.tsx` (`isOpen`, `onClose`, `title`, `size`).
- **Filtres** : des **pastilles avec compteur**, jamais de menu déroulant — je veux voir l'état
  de la liste d'un coup d'œil. **Ne jamais masquer une catégorie vide** : l'afficher grisée en
  pointillés, sinon je crois à un oubli.
- **Toujours une confirmation** avant une action destructrice ou de masse, en annonçant le
  **nombre exact** d'éléments concernés.
- Interfaces « propres et pro » : **des icônes, pas des emojis**.
- **Pleine largeur** : pas de `max-w-…` qui centre le contenu sur une colonne étroite.
- **Responsive dès le départ.** ⚠️ Mettre `min-w-0` sur les enfants de grille et de flex :
  sans ça, un texte long élargit le conteneur et fait déborder la page horizontalement sur
  mobile — au lieu d'être tronqué.

## Brique 1 — Authentification, rôles et navigation

- Inscription et connexion par email + mot de passe.
- À l'inscription, création du document **`users/{uid}`** : `email`, `nom`, `prenom`,
  `role_app: 'Admin' | 'Utilisateur'`, `createdAt`.
- **`context/AuthContext.tsx`** expose `currentUser`, `userProfile` (chargé en direct via
  `onSnapshot`, pour qu'un changement de rôle s'applique sans reconnexion), `isAdmin`,
  `login`, `register`, `logout`, `loading`.
- Groupe de routes **`(dashboard)`** avec un layout qui redirige si non connecté.
- **Navbar déclarative** : un tableau de sections, chaque entrée portant des drapeaux
  `adminOnly` / `nonAdminOnly`. Sidebar sur desktop, **barre du bas sur mobile**.
  ⚠️ La barre du bas en `fixed` **se décolle en PWA iOS** au rebond de défilement :
  prévoir `overflow-x: clip`, `overscroll-behavior` et un `translateZ(0)` sur la barre.

## Brique 2 — PWA et notifications push

- `app/manifest.ts`, icônes **192 et 512** (dont une maskable) + `apple-touch-icon` 180.
- **Web Push avec VAPID** (paquet `web-push`), **pas** Firebase Cloud Messaging.
- ⚠️ **Une souscription par APPAREIL**, jamais par compte : identifiant du document =
  `sha256(endpoint)`. Avec une souscription par compte, seul le dernier appareil ouvert
  reçoit les notifications — j'ai perdu du temps à diagnostiquer ça.
- Collections : `push_subscriptions`, `Notifications` (historique in-app), `notif_dedupe`
  (⚠️ prévoir une purge, sinon la déduplication finit par tout bloquer).
- Trois variables d'environnement : `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_EMAIL`. ⚠️ **Les poser aussi sur Vercel et redéployer** — une variable ne se commit
  pas, et une clé désynchronisée fait échouer les envois **en silence** (erreur 403 avalée).

## Brique 3 — Le squelette d'une page de liste

C'est le motif qui revient dans **tous** mes projets, quelle que soit l'entité (chantiers,
adhérents, interventions, produits…). Construis-le une fois, proprement et **générique**,
puis décline-le. Une page de liste comprend :

- **Une barre de recherche** en texte libre (nom, email, ville… selon l'entité).
- **Des filtres en pastilles** avec compteur sur chacune, combinables entre eux.
- **Un bouton « Réinitialiser les filtres »** qui n'apparaît que s'il y a quelque chose à
  remettre à zéro, avec le **nombre de critères actifs** — sur cinq ou six filtres
  combinables, on ne sait vite plus lequel masque la moitié de la liste.
- **Un compteur de résultats** au-dessus de la liste : « **247** affichés sur 1072 ». Le
  total rappelle ce que les filtres écartent.
- **Une modale de création / édition**, la même pour les deux usages.
- **Des actions par ligne** (modifier, supprimer, et les actions propres au métier).
- **Un mode sélection multiple, désactivé par défaut**, activé par un bouton
  « Sélectionner ». ⚠️ Des cases à cocher affichées en permanence encombrent la lecture et
  invitent au clic accidentel. Une fois actif : case par ligne, « Tout sélectionner (N) »
  portant sur les **éléments filtrés** (c'est ce qui rend le couple filtres + sélection
  vraiment utile), et une barre d'actions groupées.
- **Une confirmation avant chaque action groupée**, annonçant le nombre exact, avec une
  barre de progression pendant le traitement.
- **Un message de liste vide qui distingue les deux cas** : « aucun élément, commence par en
  créer un » n'a rien à voir avec « aucun résultat avec ces filtres ».

⚠️ **Responsive** : sur mobile, la ligne doit passer **en colonne** — les informations sur
toute la largeur, puis les actions en dessous. En gardant tout sur une seule rangée, les
boutons mangent la place et le nom se réduit à « 2… ».

## Brique 4 — Envoi d'e-mails (si le projet en a besoin)

Beaucoup d'applications doivent envoyer des e-mails : confirmation d'inscription,
réinitialisation de mot de passe, notification d'une nouvelle demande, envoi d'un devis…

- **Prestataire retenu : Brevo**, via son API transactionnelle. Ici c'est bien de l'e-mail
  **transactionnel** (déclenché par une action de l'utilisateur), donc l'usage prévu par le
  service — à ne pas confondre avec de la prospection.
- **Le compte Brevo est ouvert au NOM DU CLIENT**, pas au mien : les coûts d'usage restent
  chez lui et je ne porte aucun risque sur son volume d'envoi.
- **Authentifier le domaine du client** (SPF, DKIM, DMARC) : sans ça, les mails partent en
  indésirables ou sont refusés. ⚠️ **Cela suppose d'accéder à la zone DNS de son domaine**.
- Prévoir une **couche d'envoi isolée** (`lib/mailer.ts`) avec l'expéditeur et la clé d'API
  en variables d'environnement, pour pouvoir changer de prestataire sans toucher au reste.
- ⚠️ Une variable d'environnement **ne se commit pas** : la poser aussi sur Vercel **et
  redéployer**, sinon les envois échouent en silence.

**À demander au client dès le cadrage, avant de s'engager sur des délais :**
1. **A-t-il un nom de domaine ?** Sinon, les mails partiront d'une adresse générique, avec
   une délivrabilité et une crédibilité moindres.
2. **Qui gère sa zone DNS ?** (son hébergeur, son bureau d'enregistrement, son informaticien)
   — il me faut soit un accès, soit quelqu'un capable d'ajouter trois enregistrements.
3. **Quelle adresse d'expédition** doit apparaître, et **où doivent arriver les réponses** ?
   ⚠️ Si l'adresse d'envoi n'est pas une vraie boîte relevée, prévoir un `Reply-To` vers une
   adresse qui l'est — sinon les réponses des clients se perdent.

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
3. S'il faut des **rôles** au-delà d'Admin / Utilisateur.
4. Si l'app est **destinée à un client** (donc à sa charte graphique) ou à moi.
5. Si l'app doit **envoyer des e-mails** — et si oui, poser les trois questions de la brique 4
   (nom de domaine, accès à la zone DNS, adresse d'expédition et de réponse).

Puis propose-moi le plan avant d'écrire le code.

---

## Notes d'évolution

*À compléter au fil des projets : ce qui a manqué, ce qui a été inutile, les pièges rencontrés.*

- 2026-07-22 — première version, extraite des conventions réelles de tc-connect.
  Trois briques retenues : auth/rôles/navbar, PWA/push, squelette de page de liste.
  Écartée pour l'instant : facturation et PDF (ne revient pas dans tous les projets).

### Comment faire évoluer ce fichier

Après chaque projet démarré avec ce prompt, se poser trois questions :
1. **Qu'ai-je dû réexpliquer ?** → ça manque ici.
2. **Qu'ai-je supprimé du code généré ?** → c'est de trop ici.
3. **Quel piège ai-je rencontré ?** → l'ajouter avec un ⚠️, en expliquant la conséquence
   concrète et pas seulement la règle.

Le jour où ce fichier sera stable, l'étape suivante est d'en faire un **vrai dépôt template**
(code réel, testé, cloné à chaque projet) — ce fichier en deviendra le `CLAUDE.md`.
