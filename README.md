# Histoiren — Les repères du monde

Atlas historique en français : événements classés par époque et par thème, carte des pays, fiches détaillées, quiz et cartes de révision. L’interface utilise uniquement le thème clair. La frise interactive et le tutoriel ont été retirés ; les anciennes adresses `/frise` et `/tuto` renvoient à l’accueil.

## Lancer le site

Node.js 22 ou plus récent :

```sh
npm start
```

Le serveur est disponible sur `http://localhost:8000`. Pour choisir un port :

```sh
PORT=4173 npm start
```

Le serveur local prend en charge les URL de l’application et les en-têtes de sécurité. Le site ne nécessite aucune dépendance d’exécution.

## Actualisation quotidienne

Le workflow `.github/workflows/daily-history.yml` s’exécute une fois par jour à **03 h 17 UTC**, soit 04 h 17 en hiver ou 05 h 17 en été à Paris. Il peut aussi être lancé depuis l’onglet Actions de GitHub. La planification fonctionne après publication du workflow sur la branche par défaut du dépôt et activation de GitHub Actions. GitHub peut retarder l’heure effective d’un déclenchement planifié.

Le job teste le pipeline, récupère les données, puis enregistre uniquement `data/day-in-history.json`. Les données sont donc versionnées et consultables sans clé API, sans base KV et sans appels externes supplémentaires par visiteur. Après publication initiale de cette version du site, les pages HTTPS lisent aussi le fichier du dépôt public `SimonBitton/Histoiren` et utilisent la collection valide la plus récente. Cela évite un redéploiement quotidien. En cas d’indisponibilité du dépôt, elles utilisent le fichier inclus dans le site. Le développement HTTP local utilise uniquement le fichier local. Aucun déploiement n’est effectué par le workflow.

Lancer une actualisation locale :

```sh
npm run sync:history
```

Deux traitements sont réunis dans une publication atomique :

1. **Événements du jour.** L’API publique Wikipédia en français fournit les événements, naissances et décès correspondant au jour à Paris. Les événements apparaissent sur l’accueil et dans la liste ; les naissances et décès sont conservés dans le fichier de données.
2. **Vérification des dates existantes.** L’API Wikidata est consultée par lots de titres français exacts pour les événements mondiaux et nationaux. Une date ne peut être appliquée que si l’entité correspond exactement, que sa date ponctuelle `P585` est unique, non dépréciée, sourcée, sans incertitude et exprimée dans le calendrier grégorien. Une année peut être précisée avec le mois et le jour quand ils sont établis. Les périodes, dates approximatives, correspondances absentes ou ambiguës et divergences avec les dates éditoriales sont signalées dans `verification.unresolved`, sans modification automatique risquée. Le rapport ne constitue donc pas une certification de toutes les dates.

Les corrections sûres sont conservées dans `verification.corrections` et appliquées au chargement, avec un lien vers Wikidata dans les fiches. Les fichiers éditoriaux `data/timeline.json` et `data/countries.json` ne sont pas réécrits. Une modification manuelle de la date d’origine désactive la correction correspondante. Le rapport indique le nombre total d’entrées, les correspondances exactes, les vérifications sûres, les précisions appliquées et les cas non résolus.

Si une requête échoue, si la réponse est incomplète ou si le flux est vide, la dernière version reste intacte. Une seconde exécution réussie le même jour ne refait aucun appel API. Les visiteurs voient la date réelle de la collection, y compris si une exécution quotidienne a échoué.

Audit local sans écriture :

```sh
npm run verify-dates
```

### API et licences

- [Wikifeeds / Wikipédia](https://www.mediawiki.org/wiki/Wikifeeds_API) : `https://fr.wikipedia.org/api/rest_v1/feed/onthisday/all/MM/DD`. L’URL actuelle a été testée. La documentation annonce une dépréciation progressive de Wikifeeds ; surveiller les futures URL de remplacement. L’adaptateur est isolé dans `scripts/history-api.mjs`.
- [API Wikibase / Wikidata](https://www.mediawiki.org/wiki/Wikibase/API) : `https://www.wikidata.org/w/api.php`, action `wbgetentities`. Seuls les titres exacts sont utilisés, sans recherche approximative susceptible de confondre des événements.
- Les requêtes sont identifiées par un `User-Agent` décrivant Histoiren et son dépôt. Les appels de vérification sont séquentiels, par lots limités en nombre et en longueur d’URL.
- Les textes Wikipédia sont réutilisés avec attribution, liens vers les articles et indication de la licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Les données structurées Wikidata sont sous [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing).

## Vérification

```sh
node --test tests/history.test.mjs
npm test
```

Les tests de synchronisation couvrent le fuseau de Paris, le nettoyage et la provenance, les précisions de dates, les calendriers et ambiguïtés, la conservation des données en cas d’échec, les corrections d’affichage et la limite d’une mise à jour par jour. La dépendance de développement Playwright permet les contrôles du navigateur.

## Organisation

- `index.html`, `css/`, `assets/` : interface.
- `src/` : navigation, chargement, événements, pays, fiches, quiz et visualisation de l’accueil.
- `scripts/history-api.mjs` : récupération du flux quotidien.
- `scripts/verify-dates-wikidata.mjs` : vérification prudente des dates.
- `scripts/day-in-history-sync.mjs` : orchestration et publication atomique.
- `src/history-updates.js` : application des corrections et conversion des événements du jour.
- `data/day-in-history.json` : dernière collection et rapport de vérification.
- `.github/workflows/daily-history.yml` : planification quotidienne.
- `vercel.json` : réécriture des URL de navigation pour l’hébergement Vercel.
