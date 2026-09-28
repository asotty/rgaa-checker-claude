# API Ara

Base : `https://ara.numerique.gouv.fr/api` (surchargeable par `ARA_BASE_URL`).
Source : [DISIC/Ara](https://github.com/DISIC/Ara), `confiture-rest-api/src/audits/`.

## Authentification

Les routes d'un audit **ne sont pas protégées par un jeton** : c'est l'`editUniqueId` de l'URL
d'édition qui fait office de secret. Conséquences directes :

- qui a l'identifiant peut lire **et écrire** l'audit ;
- il ne doit jamais être écrit dans un fichier du dépôt, un log, un commentaire, un rapport ;
- `GET /audits` (liste du tableau de bord) est la seule route gardée : elle répond 403 sans session.

## Routes utilisées

| Verbe | Chemin | Usage |
|---|---|---|
| `GET` | `/audits/:uniqueId` | métadonnées + `pages[]` **avec leurs `id`** (= le `pageId` des résultats) |
| `GET` | `/audits/:uniqueId/results` | résultats stockés |
| `PATCH` | `/audits/:uniqueId/results` | écriture par lots — `{ data: UpdateResultsItem[] }` |
| `POST` | `/audits` | création ; renvoie `editUniqueId` |
| `PUT` | `/audits/:uniqueId` | mise à jour des métadonnées et de l'échantillon |
| `PUT` | `/audits/:uniqueId/publish` | **publication du rapport** — jamais sans demande explicite |
| `GET` | `/audits/:uniqueId/exports/csv` | export CSV |
| `POST` | `/audits/:uniqueId/results/examples` | capture sur un critère (multipart, champ `image`) — marquée *deprecated* |
| `POST`/`PATCH`/`DELETE` | `/audits/:uniqueId/pages/:slug/results/:topic.:criterium/not-compliant-items[/:itemId]` | gestion à l'unité des points non conformes |

## Format d'écriture

```jsonc
{ "data": [
  { "pageId": 42,              // id numérique lu dans GET /audits/:uniqueId
    "topic": 1,                // 1..13
    "criterium": 1,            // le couple (topic, criterium) est validé contre le RGAA
    "status": "NOT_COMPLIANT", // COMPLIANT | NOT_COMPLIANT | NOT_APPLICABLE | NOT_TESTED
    "compliantComment": null,
    "notApplicableComment": null,
    "notCompliantItems": [
      { "title": "Image d'illustration sans alternative",
        "comment": "Test 1.1.1 — `img.hero__visuel` (templates/modules/module3/module3_1_1.html.twig:12) n'a pas d'attribut alt.",
        "userImpact": "MAJOR",   // MINOR | MAJOR | BLOCKING
        "quickWin": true }
    ] }
] }
```

`AuditType` : `FAST` (25 critères) · `COMPLEMENTARY` (50) · `FULL` (106).

## Pièges vérifiés

- **Doublons.** Un `notCompliantItems` envoyé sans `id` est **créé**, pas remplacé. Rejouer un push
  empile les points. `ara.mjs push` remet donc à zéro les critères concernés avant de réécrire.
- **`pageId`, pas slug.** Les résultats s'écrivent par `pageId` numérique ; les routes
  `not-compliant-items` utilisent le `slug`. Les deux viennent de `GET /audits/:uniqueId`.
- **Éléments transverses.** Ara gère une page à part pour ce qui vaut pour tout le site : elle a son
  propre `id`, à utiliser pour les critères de navigation et les éléments obligatoires communs.
- **Validation stricte.** Un couple `(topic, criterium)` inexistant fait échouer **tout le lot**.
- **`pageElements`** (`multimedia`, `form`, `table`, `frame`) pilote les non-applicables proposés par
  l'interface : le renseigner correctement à la création.

## Gérer l'échantillon : passer par l'interface

`PUT /audits/:uniqueId` **ne crée pas de page de façon fiable** depuis un client externe : testé
contre l'audit réel, il répond tantôt 500, tantôt 200 sans rien persister, alors que le corps
respecte exactement `UpdateAuditDto`. La reconstitution de la requête depuis les seuls DTO n'a pas
abouti.

Donc : **ajouter ou retirer des pages se fait dans l'interface d'Ara**, page « Paramètres »
(`/audits/<uniqueId>/parametres`) → « Ajouter une page » → « Enregistrer les modifications ».
Ensuite `ara.mjs get` relit les `id` des nouvelles pages et l'écriture des résultats reprend
normalement. C'est deux minutes par site, une seule fois.

Deux pièges rencontrés en pilotant cette page :

- **Ne pas émuler de viewport pendant les clics.** Avec `resize_window` actif, les coordonnées
  envoyées ne tombent pas sur les éléments et les clics sont silencieusement perdus. Réserver
  l'émulation aux tests de reflow, et repasser en `desktop` avant toute interaction.
- Les champs sont pilotés par Vue : écrire la valeur avec le setter natif de `HTMLInputElement`
  puis émettre `input` et `change`, sinon le modèle ne voit rien.
- **`notCompliantItems` est obligatoire sur chaque item**, y compris pour un critère conforme ou non
  applicable : le DTO le déclare `@IsArray()` sans `@IsOptional()`. S'il manque sur une seule entrée,
  l'API rejette **tout le lot** en 400. `ara.mjs` force donc un tableau vide par défaut.
- **Un statut `NOT_TESTED` ne peut pas porter de commentaire** : l'API n'expose que `compliantComment`,
  `notApplicableComment` et `notCompliantItems`. Les raisons d'un « non testé » n'ont donc pas leur place
  dans Ara critère par critère — elles vont dans le rapport livré à côté, et éventuellement dans le champ
  `notes` de l'audit, rempli depuis l'interface.
- **Ara coupe toute requête à ~5 secondes.** Les 500 observés sur `PATCH /results` tombent tous à
  5,2 s pile : c'est un délai dépassé, pas une limite de volume. Mesuré contre la production —
  50 items échouent (5,2 s), 30 passent (4,6 s), 20 passent (3,1 s). `ara.mjs` écrit donc par lots
  de 20. Un audit complet (106 critères × 10 pages = 1060 résultats) prend une cinquantaine de
  requêtes, environ trois minutes.
