# Histoiren — Frise chronologique mondiale premium

Site statique (un seul `index.html`) qui présente une **frise chronologique interactive** de l'histoire mondiale, avec :
- 📜 Chronologie complète de la Préhistoire à nos jours
- 🕰️ **Frise interactive zoomable** (glisser / zoomer / cliquer pour ouvrir une fiche)
- 🌍 Histoire organisée par pays
- 🎓 **Mode apprentissage** : quiz, flashcards et score de progression
- 🌙 **Mode sombre** (avec mémorisation du choix)
- 🔍 **Recherche & filtres avancés** : par personnage, pays, date, thème, époque
- 🔗 **Événements liés** pour suivre les chaînes historiques
- 🖼️ **Images & extraits Wikipédia** récupérés automatiquement dans les fiches
- 📊 Statistiques et analyses
- 📱 Interface responsive
- 🏆 Top 50 des dates les plus importantes
- 📖 **Fiches détaillées** : résumé, causes, conséquences, personnages, contexte

## Nouveautés de cette version

- **Frise interactive** (`src/frise.js`) — bande chronologique à échelle signée-logarithmique : zoom (boutons ou Ctrl+molette), déplacement par glisser, points cliquables.
- **Filtres avancés** — barre de filtres par époque et par thème (guerres, inventions, personnages, religion, art, exploration, politique) au-dessus de la chronologie.
- **Recherche multi-champ** — la recherche couvre désormais le nom, le contexte, les personnages, la date, la catégorie et le thème.
- **Mode apprentissage** (`src/quiz.js`) — quiz de 10 questions générées depuis la base, flashcards, score et meilleur score mémorisé.
- **Mode sombre** (`src/theme.js`) — bascule en haut à droite, sans clignotement au chargement (script anti-FOUC).
- **Fiches enrichies** — images et extraits réels via l'API Wikipédia (`src/wiki.js`), causes/conséquences, et **événements liés** (`src/related.js`).
- **Animations au défilement** — apparition progressive des sections.

## Fonctionnalités principales

### 1. Résumés détaillés
Chaque événement dispose désormais d'un résumé complet d'au moins 5 lignes comprenant :
- Contexte historique et période
- Description détaillée de l'événement
- Personnages clés impliqués
- Signification historique
- Impact et héritage

### 2. Vérification des dates
Les dates peuvent être vérifiées automatiquement via l'API WikiData :
```bash
npm run verify-dates
```

### 3. Ajout massif d'événements
Possibilité d'ajouter des centaines de milliers d'événements depuis WikiData :
```bash
npm run add-massive-events
```

## Technologies utilisées

- **HTML5** (structure sémantique)
- **CSS3** (styles, responsive, animations)
- **JavaScript (vanilla)** (interactions, filtres, navigation)
- **WikiData API** (vérification et enrichissement des données)

## Structure du projet

```text
histoiren/
├── index.html              # Page principale unique
├── package.json            # Configuration du projet
├── README.md               # Ce fichier
├── css/
│   ├── base.css           # Styles de base
│   ├── components.css     # Composants UI
│   ├── layout.css         # Mise en page
│   ├── variables.css      # Variables CSS
│   └── views.css          # Styles spécifiques aux vues
├── src/
│   ├── main.js            # Point d'entrée principal
│   ├── detail-view.js     # Vue détail événement
│   ├── country-modal.js   # Modal pays + navigation vers détail
│   ├── router.js          # Gestion de la navigation
│   ├── state.js           # Gestion de l'état
│   ├── data-manager.js    # Chargement des données
│   ├── ui-renderer.js     # Rendu de l'interface
│   ├── sidebar.js         # Navigation latérale
│   └── utils.js           # Fonctions utilitaires
├── data/
│   ├── timeline.json      # Données de la chronologie
│   └── countries.json     # Données par pays
├── scripts/
│   ├── add-timeline-events.mjs    # Ajout d'événements manuels
│   ├── generate-countries-from-csv.mjs # Génération countries.json depuis C.csv
│   ├── import-csv-events.mjs      # Import CSV vers timeline.json
│   ├── add-massive-events.mjs     # Ajout massif depuis WikiData
│   └── verify-dates-wikidata.mjs  # Vérification des dates
└── tests/
    └── run-e2e.js         # Tests end-to-end
```

## Lancer le site

### Option 1 — Ouvrir directement le fichier

- Ouvre `index.html` dans ton navigateur.

### Option 2 — Servir en local (recommandé)

Depuis la racine du projet :

```bash
# Avec Python
python3 -m http.server 8000

# Ou avec npm
npm start
```

Puis ouvre `http://localhost:8000` dans ton navigateur.

## Scripts disponibles

```bash
# Lancer le serveur de développement
npm start

# Ajouter des événements manuels à la chronologie
npm run add-events

# Ajouter massivement des événements depuis WikiData (100k+)
npm run add-massive-events

# Vérifier les dates avec WikiData
npm run verify-dates

# Générer les événements par pays depuis C.csv
npm run build:countries

# Importer C.csv vers la timeline globale
npm run import:csv-timeline

# Lancer les tests end-to-end
npm run test:e2e
```

## Organisation des époques

Le projet couvre 5 grandes périodes historiques :

1. **Préhistoire** (≈ 3 300 000 av. J.-C. → ≈ 3 200 av. J.-C.)
2. **Antiquité** (≈ 3 200 av. J.-C. → 476 ap. J.-C.)
3. **Moyen Âge** (476 → 1492)
4. **Temps Modernes** (1492 → 1789)
5. **Époque Contemporaine** (1789 → nos jours)

## Catégories d'événements

- **Politique** : Guerres, traités, révolutions, lois
- **Science** : Découvertes, inventions, avancées scientifiques
- **Culture** : Art, littérature, philosophie, religion
- **Exploration** : Voyages, découvertes géographiques

## Contribution

1. Fork le projet
2. Crée ta branche (`git checkout -b feature/amélioration`)
3. Commit tes changements (`git commit -am 'Ajoute nouvelle fonctionnalité'`)
4. Push ta branche (`git push origin feature/amélioration`)
5. Ouvre une Pull Request

## Licence

Ce projet est open source et peut être utilisé librement.

---

Fait avec passion pour l'histoire ❤️
