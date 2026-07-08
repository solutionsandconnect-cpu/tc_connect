# CONTEXTE — Application (ex « TC Connect »)

> Ce document explique le **contexte et l'objectif global** du projet, pour que tu comprennes le sens avant que je te donne des consignes précises.
> **Commence par explorer le code existant** pour comprendre ce qui est déjà en place, puis attends mes instructions détaillées (ce qu'il faut masquer, adapter, renommer). Ne refactore rien sans validation.

---

## 1. En bref

Je suis **Teddy**, entrepreneur solo avec **deux activités distinctes** :
- **Teddy Coaching** — coaching / préparation physique (marque connue depuis 2019).
- **Enezo** — studio de **développement d'applications sur mesure**. ⚠️ **Enezo est le nouveau nom de ce qui s'appelait « Solutions & Connect ».** Partout où le code ou l'app mentionne « Solutions & Connect » (ou « S&C ») pour l'activité dev, c'est désormais **Enezo**.

Cette application est mon **outil central** : je gère **les deux sociétés et leurs clients depuis une seule app**. Elle est hébergée sur **Vercel**. Son nom actuel « TC Connect » est amené à disparaître de la vue des clients (voir §7).

---

## 2. L'application, aujourd'hui

C'est une plateforme transverse qui sert **deux publics différents**. Selon les cas, elle permet (à confirmer selon l'existant) :
- accès aux **séances** (côté coaching),
- **signature de devis / contrats**,
- une **boutique d'applications**,
- des accès et espaces clients,
- du back-office de gestion pour moi.

Le confort, pour moi, c'est d'avoir **une seule app** pour tout piloter. Mais côté client, les deux mondes ne doivent **pas** se mélanger.

---

## 3. Le principe directeur : « une app, deux portes »

Une seule application derrière, mais **deux expériences étanches**, une par marque. Un client ne doit **jamais** voir le contenu de l'autre marque. Chaque public reste dans un univers cohérent :

- **Client Teddy Coaching** → voit uniquement : séances, contrats/devis, suivi. **Pas** la boutique d'apps, pas l'univers dev.
- **Client Enezo** → voit l'univers dev : ses projets/documents, et **la boutique d'apps est de ce côté** (voir §5).

L'app doit donc **détecter le contexte** (marque d'entrée / profil utilisateur) et **afficher ou masquer** les bonnes sections en conséquence.

---

## 4. La boutique d'apps

Objectif : donner de la visibilité à des applications (potentiellement payantes). Mais elle n'a **aucun sens pour les clients coaching** (mauvaise audience). Elle appartient à l'univers **Enezo** :
- la **masquer** pour les clients coaching,
- la montrer côté Enezo (espace client Enezo, et/ou vitrine publique `enezo.fr`).

---

## 5. Marque & apparence

Quand c'est le contexte **Enezo**, appliquer sa charte :
- Petrol `#377684` (couleur principale), Petrol foncé `#2B5E6A`
- Or `#D2A244` (accent rare)
- Encre `#141A1A`, gris froid `#EEF1F1`, blanc
- Typos : **Montserrat** (titres) + **Inter** (texte)
- Logo Enezo (fourni séparément)

Le contexte **coaching** garde son propre habillage (marque Teddy Coaching). L'idée : **même app, deux visages**, pour que chaque client se sente chez « sa » marque.

---

## 6. Domaines (hébergement Vercel)

Une même app Vercel peut répondre sur **plusieurs domaines**. Le plan :
- `app.enezo.fr` → entrée des clients **Enezo**
- `espace.teddycoaching.fr` (ou équivalent) → entrée des clients **coaching**
- **Les deux pointent vers cette même app.** Le contexte d'entrée (domaine) peut servir à déterminer quelle marque/quel habillage afficher.

Sur chaque site vitrine, le lien s'appellera simplement **« Espace client »**.

---

## 7. Nom de l'app

« TC Connect » est à retirer de la vue des clients : « TC » = Teddy Coaching, ça n'a pas de sens côté Enezo. L'app est un **outil neutre au-dessus des deux marques**. On ne la renomme pas d'après une seule marque. À terme : soit un **nom neutre** dédié, soit simplement l'afficher comme **« Espace client »** sur chaque site. (Décision non figée — ne rien renommer sans mon feu vert.)

---

## 8. Ce que j'attends de toi maintenant

1. **Explore** le projet et fais-moi un point rapide sur l'existant : structure, où sont gérés les profils/rôles, où vit la boutique d'apps, où le nom « Solutions & Connect » / « TC » apparaît.
2. **Attends mes consignes précises** avant de modifier (je te dirai quoi masquer par public, quoi renommer, comment gérer le contexte par domaine).
3. Ne casse pas l'existant : propose, montre, on valide ensemble étape par étape.
