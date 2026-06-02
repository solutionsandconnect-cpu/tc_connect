# Feature : Calculateur de points — Belote

## Contexte du projet

Cette feature s'intègre dans une application **Next.js + React** existante.
La persistance des données est gérée via **Firebase (Firestore)** déjà configuré dans le projet.
L'accès multi-utilisateurs doit être supporté (lecture/écriture partagée via Firestore).

---

## Objectif

Créer un module complet de gestion de parties de belote, accessible depuis l'app existante, permettant de :

- Créer et réutiliser des équipes avec leurs joueurs
- Paramétrer et jouer une partie tour par tour
- Calculer automatiquement les scores selon les règles de la belote classique
- Cumuler les scores sur plusieurs parties et consulter l'historique

---

## Architecture des données Firestore

### Collection `belote_teams`

```ts
{
  id: string,
  name: string,                  // généré automatiquement depuis les prénoms des joueurs
  players: [
    { firstName: string, lastName: string },
    { firstName: string, lastName: string }
  ],
  createdAt: Timestamp
}
```

### Collection `belote_games`

```ts
{
  id: string,
  team1Id: string,               // référence à belote_teams
  team2Id: string,
  team1Name: string,             // dénormalisé pour affichage rapide
  team2Name: string,
  endCondition: 'rounds' | 'score',
  endValue: number,              // nombre de tours OU score cible
  status: 'in_progress' | 'finished',
  winnerId: string | null,
  totalScore: {
    team1: number,
    team2: number
  },
  createdAt: Timestamp,
  finishedAt: Timestamp | null
}
```

### Collection `belote_rounds`

```ts
{
  id: string,
  gameId: string,
  roundNumber: number,
  dealer: string,                // prénom+nom ou id joueur
  trumpTaker: string,            // prénom+nom ou id joueur
  teamTaker: 'team1' | 'team2', // équipe qui a pris l'atout

  // Saisie brute
  rawScoreNous: number,          // points saisis pour "Nous" (0-162)
  rawScoreEux: number,           // points saisis pour "Eux"

  // Événements spéciaux
  capot: boolean,                // une équipe fait tous les plis
  capotTeam: 'team1' | 'team2' | null,
  dedans: boolean,               // l'équipe qui a pris ne réalise pas son contrat
  beloteRebelote: boolean,       // 20 points bonus à l'équipe concernée
  beloteRebeloteTeam: 'team1' | 'team2' | null,

  // Scores calculés après application des règles
  finalScore: {
    team1: number,
    team2: number
  },

  createdAt: Timestamp
}
```

---

## Règles métier de la belote classique

### Calcul des points par tour

1. **Total des points d'un tour** : toujours 162 (dont 10 pour le dernier pli)
2. **Validation** : `rawScoreNous + rawScoreEux` doit être égal à 162
3. **Capot** : une équipe fait tous les plis → elle marque 162 points, l'autre 0
4. **Dedans** : l'équipe qui a pris l'atout ne réalise pas son contrat (score < 82) → elle marque 0, l'adversaire prend les 162 points
5. **Belote & Rebelote** : +20 points pour l'équipe qui la détient (s'ajoute à son score final)
6. **Arrondi** : les scores sont arrondis à la dizaine la plus proche (règle classique, configurable)

### Fin de partie

- **Par nombre de tours** : la partie s'arrête après N tours, l'équipe avec le plus de points gagne
- **Par score** : la première équipe à atteindre le score cible gagne

---

## Structure des fichiers à créer

```
app/
  belote/
    page.tsx                        # Page principale / dashboard belote
    nouvelle-partie/
      page.tsx                      # Création d'une nouvelle partie
    [gameId]/
      page.tsx                      # Vue d'une partie en cours
      nouveau-tour/
        page.tsx                    # Saisie d'un tour
    historique/
      page.tsx                      # Historique de toutes les parties

components/
  belote/
    TeamSelector.tsx                # Sélection/création d'équipe avec autocomplete
    GameSetup.tsx                   # Formulaire paramétrage partie
    RoundForm.tsx                   # Formulaire saisie d'un tour
    ScoreBoard.tsx                  # Affichage score en temps réel
    GameHistory.tsx                 # Liste des parties passées
    RoundHistory.tsx                # Détail des tours d'une partie

lib/
  belote/
    rules.ts                        # Logique métier : calcul des scores, règles belote
    firebase.ts                     # Fonctions CRUD Firestore pour belote
    types.ts                        # Types TypeScript

hooks/
  useBeloteGame.ts                  # Hook : état d'une partie, ajout de tours
  useBeloteTeams.ts                 # Hook : liste des équipes, création
```

---

## Comportements UX attendus

### Création / sélection d'équipe

- Champ de recherche avec **autocomplete** sur les équipes existantes (par nom d'équipe ou prénom joueur)
- Si l'équipe est sélectionnée depuis l'autocomplete → les 2 noms de joueurs se remplissent automatiquement
- Le **nom de l'équipe est auto-généré** depuis les prénoms : ex. "Marie & Pierre"
- Possibilité de créer une nouvelle équipe à la volée si elle n'existe pas

### Saisie d'un tour

- Sélection du **distributeur** parmi les 4 joueurs de la partie (dropdown ou toggle)
- Sélection du **preneur d'atout** parmi les 4 joueurs
- Champs **Nous / Eux** pour les points bruts (validation que la somme = 162, sauf si capot)
- Toggles clairs pour : **Capot**, **Dedans**, **Belote & Rebelote**
- Si Capot → masquer les champs Nous/Eux et afficher quelle équipe a fait le capot
- Si Dedans → masquer les champs Nous/Eux
- **Prévisualisation du score calculé** avant validation

### Tableau de scores

- Affichage permanent du score cumulé des 2 équipes
- Barre de progression si fin de partie par score
- Indication du tour actuel / nombre de tours restants si fin par tours
- Historique des tours avec détail (distributeur, preneur, points, événements)

### Accès partagé

- Les parties et équipes stockées dans Firestore sont accessibles à tous les utilisateurs connectés
- Pas besoin de système de "partage" spécifique si l'auth Firebase est déjà en place

---

## Contraintes techniques

- **TypeScript strict** sur tous les fichiers
- **Pas de bibliothèque UI supplémentaire** sauf si déjà utilisée dans le projet (vérifier package.json)
- Utiliser les **conventions de nommage et structure existantes** du projet
- Les fonctions Firebase doivent utiliser le SDK déjà initialisé dans le projet (ne pas recréer une initialisation)
- Gérer les **états de chargement et erreurs** proprement (loading skeletons, messages d'erreur)
- Design **mobile-first** : l'app sera utilisée sur téléphone pendant les parties

---

## Extensibilité prévue

Cette feature est conçue pour être le premier module d'un système générique de comptage de points pour jeux de cartes/société. Prévoir :

- Les types et hooks assez génériques pour être réutilisés (ex. `GameSession`, `Round`, `Team`)
- La logique métier isolée dans `lib/belote/rules.ts` pour être facilement remplacée par d'autres règles de jeu
- Un pattern de routing clair : `/[jeu]/` pour accueillir d'autres jeux plus tard (uno, skyjo, tarot...)
