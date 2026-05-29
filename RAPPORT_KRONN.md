# Rapport d'évolution — Itération KRONN
**Civilisation tribale autonome sur Kubernetes · 29 mai 2026**

---

## 1. Contexte et genèse

Cette itération naît d'un constat d'échec de la précédente espèce (*fouloid* philosophique) :
64 générations pour produire des variations sémantiques de « je passe le flambeau ». Les agents
se reproduisaient sans construire, communiquaient sans contenu, évoluaient sans diverger.

La décision de refonte est radicale : abandonner la philosophie abstraite comme moteur d'identité
au profit d'un **rôle fonctionnel dans une tribu**. Chaque agent devient un spécialiste dont
la raison d'être est de répondre à un besoin concret de la collectivité.

Le premier agent, `gen0-elder`, reçoit un mandat simple : *fonder une tribu qui n'a rien encore —
pas de chasseurs, pas de mémoire, pas de lois. Décide ce dont elle a besoin pour survivre.*

---

## 2. Statistiques globales

| Métrique | Valeur |
|---|---|
| Durée de l'itération | ~45 minutes |
| KRONNs déployés | **149** (sur 6 générations) |
| Fonctions Fission déployées | **418** |
| Pods Running / Total | 148 / 149 |
| Crashes / OOMKills | **0** |
| Restarts | **1** |
| Agents ayant terminé leur mission | ~105 (70 %) |
| RAM agrégée (tous KRONNs) | 5 938 Mi |
| CPU agrégé | 239 m |

---

## 3. Arbre généalogique

La tribu s'est développée sur 6 générations avec un branchement libre (0–10 enfants par agent,
terminaux à gen ≥ 5).

```
gen0  (1)  : elder
gen1  (6)  : builder · ember · hunter · keeper · oracle · scout
gen2  (14) : analyst · architect · archivist · communicationbridge · dataharvester
             decisionmodeller · docs · forecaster · governance · harvester
             maintenance · riskengineer · scout · trapper
gen3  (28) : alert · analyst · angler · annotator · archivist · audit · conservator
             curated · curator · dataarchivist · datasage · diagnostics · diaspora
             dovetail · earlyalert · engineer · forecaster · herder · impactanalyst
             indexer · navigator · negotiator · planner · policyanalyst
             precisionmodel · rlcoder · strategist · visualizer
gen4  (76) : allocator · analyst · analytics · anomaly · aquaculture · archivist
             auditbot · biodiver · chronometer · circuitguard · diplomat · diver
             educator · fishcraft · forecaster · frontier · geographer · governor
             guard · heatmap · humidity · hypertuner · linguist · metrician
             mlpipeline · modelchecker · moderator · observability · policyengineer
             precipitation · predictor · restorg · soilmoisture · stormtracker
             tactician · temperature · terrain · tracker · verifier · weather
             weathermodeler · wind · [+36 autres]
gen5  (23) : abyssal · anemometer · archivist · classifier · database · debugger
             ember · forecaster · herder · hygrograph · legalizer · logger
             metadatamaster · observer · precipitationmodel · provenance
             routemaker · thermometer · tracker · validator · [+3 autres]
gen6  (2)  : legalizer · thermometer  [terminaux]
```

**Observation clé** : l'explosion est asymétrique. Gen4 compte 76 agents (51 % du total) — la
génération de spécialisation maximale, où chaque domaine se fragmente en sous-experts.

---

## 4. Fonctions déployées — cartographie des domaines

418 fonctions réparties en clusters thématiques émergents :

### 4.1 Observabilité météo/climatique (≈ 80 fonctions)
Le domaine le plus prolifique. Né de `gen1-oracle` (prévision générale) → `gen2-forecaster`
(long terme) → `gen3-forecaster` et `gen3-earlyalert` → des dizaines de spécialistes gen4/5.

Exemples représentatifs :
- **`forecast-prey`** — modèle de Lotka-Volterra pour prédire l'abondance des proies selon le
  climat et les comptes passés
- **`soilmoisture-predictor`** — prévision sur 7 jours par zone géographique avec moyennes
  glissantes sur les 3 dernières mesures
- **`micro-climate-forecast`** — prévision micro-climatique intégrant topographie et végétation
- **`precip-downscale`** + **`precip-enhance`** — pipeline de downscaling des précipitations
- **`wind-emitter`** + **`wind-buffer`** + **`wind-trend-logger`** — chaîne de traitement vent
- **`fire-spread-simulator`** — simulation de propagation d'incendie
- **`seasonal-anomaly-detect`** — détection d'anomalies saisonnières
- **`anomaly-predict`** — régression linéaire sur séries temporelles de latence

### 4.2 Chasse et ressources (≈ 40 fonctions)
Lignée `gen1-hunter` → `gen2-trapper` + `gen2-harvester` → `gen3-angler` + `gen3-herder` →
spécialistes en aquaculture, pêche, élevage.

- **`hunt-scout`** — localise les hotspots de proies par coordonnées (cerfs × 5, sangliers × 3)
- **`trap`** — génère un plan de piège avec matériaux (cordage, leurre) et mécanisme de libération
- **`forecast-prey`** — population modeling Lotka-Volterra
- **`decision-engine`** — sélectionne la meilleure proie selon prévisions et contraintes du groupe
- **`bait-grow`** + **`bait-nurture`** + **`bait-quota`** — gestion du cycle d'appât
- **`angler-map`** + **`angler-harvest`** + **`angler-fabricate`** — pêche systématisée
- **`herd-monitor`** + **`herd-health`** + **`herd-movement`** + **`herd-synchronizer`** —
  surveillance complète du bétail (taille, santé index, mouvement prédit)
- **`ecoherd-monitor`** + **`ecology-report`** — biodiversité (120 espèces natives, 3 invasives)
- **`aquaculture`** — module d'élevage aquatique apparu à gen4, non instruit explicitement

### 4.3 Gouvernance et droit (≈ 30 fonctions)
Lignée `gen1-keeper` → `gen2-governance` + `gen2-docs` → `gen3-policyanalyst` + `gen3-audit` →
juristes gen5.

- **`founding-law`** — "toutes les ressources allouées proportionnellement à leur rareté"
- **`law-registry`** — dépôt centralisé des lois tribales
- **`compliance-audit`** — valide les soumissions contre les statuts du `/law-registry`
- **`treaty-check`** — scan de documents pour clauses interdites ("self-defense clause",
  "unilateral right")
- **`diplomatic-draft`** — génère des brouillons de traités à partir de briefs stratégiques
- **`policy-evaluator`** — score de robustesse d'une politique (bonus pour couverture adversariale)
- **`policy-simulator`** — simulation d'exécution de politique
- **`legal-framework-compiler`** — compile un framework légal à partir de sources fragmentées
- **`immutable-logger`** — log décisionnel avec hash aléatoire (simule une chaîne blockchain)

### 4.4 ML / Reinforcement Learning (≈ 25 fonctions)
Apparu spontanément à gen3 via `gen3-rlcoder`, sans instruction explicite.

- **`actor-critic-trainer`** — pas d'entraînement actor-critic (loss + KL divergence)
- **`bayes-opt-search`** — optimisation bayésienne d'hyperparamètres (learning_rate, hidden_size,
  discount_factor, exploration_rate)
- **`rl-monitor`** — streaming de rewards/losses/KL sur 3 épisodes
- **`replay-buffer`** — buffer d'expériences pour RL
- **`ensemble-sampler`** + **`distribution-sampler`** — échantillonnage probabiliste
- **`mlpipeline-train`** + **`mlpipeline-validate`** + **`mlpipeline-orchestrate`** — pipeline ML
  complet en 3 fonctions coordonnées
- **`hyper-audit`** — audit des hyperparamètres d'un modèle
- **`anomaly-predict`** — prédiction par régression linéaire sur séries temporelles

### 4.5 Infrastructure et mémoire (≈ 45 fonctions)
- **`tribe`** — registre central (fondé par l'Elder)
- **`registry-update`** + **`registry-query`** + **`registry-hunter`** — CRUD sur le registre tribal
- **`archivist-store`** + **`archivist-index`** + **`archivist-search`** — stockage indexé
- **`migrate-logs`** — migration de logs avec checksum (simule off-site storage)
- **`backup-keeper`** + **`backup-sync`** — stratégie de sauvegarde
- **`timestamp-validation`** + **`checksum`** + **`prove-provenance`** — intégrité des données
- **`immutable-logger`** — log cryptographiquement signé

### 4.6 Gestion des crises (≈ 20 fonctions)
- **`evacuation-route`** — calcule le chemin sécurisé A→B via score de risque sur carte
- **`battle-forecast`** — probabilité de victoire, timing optimal, points faibles (Monte-Carlo)
- **`strategic-sim`** — 5 scénarios avec probabilités et ressources nécessaires
- **`alert-broadcast`** + **`alert-dispatcher`** + **`alert-raid`** — système d'alerte multi-canal
- **`frontier-fire-risk`** + **`frontier-validate-risk`** — évaluation de risque frontalier
- **`restorg`** + **`restorg-labor-mobilizer`** + **`restorg-schedule-buffer`** — réorganisation
  d'urgence (mobilisation de main-d'œuvre, buffer de planification)
- **`conflict-clash`** + **`conflict-mutation`** — gestion des conflits internes

---

## 5. Communication inter-fonctions

Une découverte majeure : plusieurs fonctions appellent d'autres fonctions via HTTP en runtime,
créant un **réseau d'appels distribués** non planifié.

Exemples de chaînes observées :
- `council-adviser` → agrège `context.inMemory.trend` et `context.inMemory.risk`
- `silence-reflect` → appelle `http://router.fission/genesis-artifact` et étend la réponse
- `negation-chorus` → appelle `http://router.fission/negation-essence` et compose une litanie
- `dualloop-feedback` → appelle le parent via X-Parent-Essence header
- `forecast-blend` → combine plusieurs sources de forecast
- `mlpipeline-orchestrate` → orchestre `mlpipeline-train` puis `mlpipeline-validate`

Ce pattern de **composition de services** émerge sans instruction explicite — les agents ont
inféré que créer un outil qui *utilise* les outils existants est plus puissant que créer un outil
isolé.

---

## 6. Philosophie et lois émergentes

### Lois fondatrices transmises

| Agent | Loi |
|---|---|
| gen0-elder | "Resources allocated in proportion to rarity to maintain balance" |
| gen1-builder | "Universal Building Standards mandating safety and sustainability thresholds" |
| gen1-oracle | "When evidence supports action, act swiftly; when uncertain, seek more data" |
| gen1-keeper | "All records must be traceable through an immutable, cryptographically-signed log" |
| gen2-governance | "No policy shall be enacted without a compliance audit" |
| gen2-docs | "Documentation is immutable; once written, records cannot be altered" |

Ces lois se propagent dans les kickoffs et influencent les fonctions des générations suivantes.
Le keeper gen3 déploie un `prove-provenance` ; le governance gen3 crée un `audit-verifier`.
La loi engendre l'outil, l'outil renforce la loi.

### Évolution de la philosophie par génération

**Gen 0–1** : *Fondation pragmatique.* L'Elder pose des questions de survie : qui chasse ?
qui garde ? qui prévoit ? Les gen1 répondent avec des outils directs et des lois simples.

**Gen 2** : *Spécialisation utilitaire.* Chaque gen2 divise le travail de son parent :
le Hunter devient Analyst + Trapper, l'Oracle devient Forecaster + RiskEngineer + DecisionModeller.
Les agents commencent à consulter `/tribe` avant de construire pour éviter les doublons.

**Gen 3** : *Abstraction et coordination.* Apparition de rôles méta : le Strategist conçoit
des stratégies pour que d'autres les exécutent, le Negotiator gère les conflits entre KRONNs,
le Planner coordonne les horizons temporels. Le RLCoder introduit le machine learning sans
qu'aucune instruction ne le prescrive.

**Gen 4** : *Hyper-spécialisation.* 76 agents, chacun expert d'un sous-domaine précis.
Le forecaster devient Temperature + Humidity + Wind + Precipitation + Soilmoisture. Le diplomat
naît pour convertir les analyses stratégiques en documents lisibles. Le Linguist traduit
sémantiquement entre KRONNs de domaines différents.

**Gen 5–6** : *Instrumentation et métacognition.* Les terminaux deviennent observateurs
du système lui-même : Debugger, Observer, Validator, Metadatamaster, Provenance. La tribu
commence à se regarder fonctionner.

---

## 7. Méthodes et patterns architecturaux

### 7.1 Pattern Registry-Entry
Presque chaque agent crée une fonction `{role}-registry` qui retourne son identité, ses outils,
ses enfants et sa loi. Ce pattern autodocumentant émerge dès gen1 et se propage spontanément.

### 7.2 Pattern Pipeline en 3 fonctions
Observé systématiquement : `ingest → process → sync`, `train → validate → orchestrate`,
`sensor-read → clean-data → sync-to-db`. Les agents décomposent naturellement les flux en
étapes séparées, déployables et testables indépendamment.

### 7.3 Pattern Bridge/Extend
Une fonction lit le résultat d'une autre via HTTP et l'étend avec sa propre perspective.
`duality-bridge` lit `/silence` et y ajoute la dualité. `negation-chorus` lit `/negation-essence`
et ajoute sa litanie. Ce pattern crée une *composition de sens* distribuée.

### 7.4 Consultation du registre tribal
Presque tous les agents à partir de gen2 appellent `GET /tribe` dans leur plan avant de
construire. Objectif déclaré : "éviter les doublons". En pratique, ils lisent le registre
(souvent vide ou minimaliste) et construisent quand même leurs outils — mais l'intention
de coordination est présente.

### 7.5 Transmutation des rôles
Le gen1-hunter reçoit un mauvais kickoff (il pense être "ember" à cause d'une collision dans
la queue Iggy) et construit un *moteur de curiosité* au lieu d'un outil de chasse. Au lieu
d'une anomalie, c'est une **bifurcation créative** : la lignée ember explore l'apprentissage
et la connaissance, distincte de la lignée hunter. À gen5, un second ember réapparaît,
reprenant le thème de sa progénitrice.

---

## 8. Incidents et résilience

### 8.1 Contexte Qwen3 saturé (turn ≥ 20)
**Symptôme** : 5 agents soumettent du code tronqué à 44 caractères en boucle
(`module.exports = async function(context) {`).  
**Cause** : Au-delà de ~20 messages en historique, Qwen3 génère des arguments JSON
tronqués — il produit uniquement la première ligne du code avant que sa fenêtre effective
ne se compresse.  
**Correction** : Pruning de l'historique à 12 messages (kickoff + 11 derniers) + circuit
breaker injectant un template complet au 3ème échec consécutif, forçant `finish` au 6ème.  
**Résultat** : Les agents bloqués completent leur mission dès le redémarrage (gen2-duality :
3 fonctions en 1 seul turn après fix).

### 8.2 Pool bash-pauline en rotation
**Symptôme** : 4 agents gen4 obtiennent `500 error sending request to function` sur
`create_function` en boucle jusqu'à MAX_TURNS.  
**Cause** : Le pool `bash-pauline` (qui exécute `deploy-pauline`) tourne ses pods en Pending
pendant quelques secondes — exactement la fenêtre où ces agents tentent de déployer.  
**Impact** : Mineur (2.7% des agents). Ce sont des terminaux sans enfants : leur échec
n'interrompt aucune lignée.

### 8.3 Contamination de queue Iggy
**Symptôme** : gen0 reçoit des messages de sessions précédentes et traite deux kickoffs
simultanément.  
**Impact** : Nul — chaque `handleMessage` a son propre contexte en mémoire.

---

## 9. Ce qui n'a pas fonctionné

### 9.1 Registre tribal inerte
La fonction `/tribe` retourne `{members:[], tools:[], laws:[]}` — vide. Les agents qui la
consultent ne savent pas ce que la tribu a construit. La coordination est déclarée mais non
réalisée : chaque agent se croit pionnier et recrée des fonctions similaires (4 versions
de `registry`, 3 de `archivist`, 5 de `forecast`).

### 9.2 Code non exécuté
Les fonctions sont deployées mais jamais appelées entre elles pendant la phase de build.
`decision-engine` est censé combiner `forecast-prey` et les plans de chasse — mais ce pipeline
n'est jamais exécuté à chaud. La tribu a construit une bibliothèque, pas un système vivant.

### 9.3 Stubs légitimes
Plusieurs fonctions sont des squelettes (return `'simulated'`, `Math.random()` en guise de
modèle). Le code de Qwen3 est souvent correct structurellement mais remplace la logique
métier par des placeholders. `policy-simulator` retourne toujours `'simulated'`.

### 9.4 Duplication non contrôlée
En l'absence d'un registre fonctionnel, plusieurs lignées construisent des outils similaires :
- 5 variantes de forecast générique
- 4 systèmes de registry indépendants  
- 3 immutable loggers
- 2 evacuation-route

---

## 10. Perspectives

### Ce qui manque pour la prochaine itération

**Un registre vivant.** Le `/tribe` doit être une vraie base de données partagée — pas une
fonction statique. Chaque KRONN doit s'enregistrer à son démarrage et lire l'état réel avant
de construire.

**L'exécution inter-agents.** Les fonctions doivent se parler à chaud, pas seulement exister.
Un hunter qui appelle réellement `forecast-prey` avant de partir chasser, qui écrit dans
`immutable-logger` après, qui lit `threat-risk` si la situation change — c'est une tribu vivante.

**La pression de sélection.** Actuellement tout survive. Introduire une ressource limitée
(tokens de compute, slots dans le registre) forcerait les KRONNs à se battre pour leur place —
vraie sélection darwinienne.

**La communication latérale.** Les KRONNs ne se parlent que via le registre. Un canal Iggy
accessible à tous les agents, avec protocole de message structuré, permettrait des coalitions,
des négociations, des délégations en temps réel.

**La mémoire persistante.** Quand un KRONN meurt, sa connaissance disparaît. Un stockage
partagé (Redis, etcd) permettrait aux enfants d'hériter de l'état réel de leur parent,
pas seulement de son kickoff philosophique.

---

## 11. Conclusion

En 45 minutes sur un cluster k3s à 8 nœuds (2 GPU), **149 agents autonomes ont construit
418 fonctions** réparties en une dizaine de domaines cohérents — météo, chasse, gouvernance,
ML, infrastructure, diplomatie — sans qu'aucune de ces catégories ne soit prescrite.

La tribu KRONN représente une étape qualitative par rapport aux fouloids : les agents *font*
quelque chose. Ils construisent des outils utilisables, transmettent des lois, se spécialisent
par ramification. Les patterns architecturaux (registry-entry, pipeline-3-étapes, bridge-extend)
sont emergents.

Ce qui manque, c'est le *lien entre les nœuds* : les fonctions coexistent mais ne se parlent
pas. La prochaine itération doit résoudre le problème de la **coordination à chaud** — pas
juste la construction autonome, mais la **coopération en temps réel**.

---

*Rapport généré automatiquement à partir des logs Kubernetes, des packages Fission et des
messages Iggy · Cluster mlops k3s v1.35.4 · Modèles : Qwen3-coder-30b-fp8 (codage) +
Granite-4-1-8b-fp8 (raisonnement)*
