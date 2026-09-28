---
name: rgaa-audit
description: Audit d'accessibilité RGAA 4.1 complet (106 critères / 258 tests) d'un site web, puis remplissage de l'audit dans Ara (ara.numerique.gouv.fr) via son API REST — statuts, commentaires, impacts utilisateur, quick-wins, captures. À utiliser dès qu'il s'agit d'auditer l'accessibilité d'un site, de remplir ou compléter un audit Ara, de produire une déclaration d'accessibilité, ou quand l'utilisateur parle de RGAA, d'accessibilité numérique, d'a11y, de WCAG, d'Ara, de conformité accessibilité, ou de taux de conformité.
---

# Audit RGAA 4.1 + remplissage Ara

Deux sources de vérité, jamais l'une sans l'autre : **le site en ligne** (ce que l'utilisateur
rencontre vraiment) et **le code source** (ce qui produit le défaut, donc ce qu'on corrige).
Le référentiel officiel est dans `references/criteres-4.1.json` — on ne paraphrase jamais un test
de mémoire, on le lit.

## Règles non négociables

1. **Aucun `COMPLIANT` sans preuve positive.** « Je n'ai rien vu de cassé » n'est pas une preuve.
   Si la sonde n'a rien collecté sur un critère, c'est `NOT_TESTED`, pas `COMPLIANT`.
2. **Aucun `NOT_APPLICABLE` sans `notApplicableComment`** disant pourquoi
   (« aucun tableau de données sur cette page », « aucun média temporel »). Jamais vide.
3. **Aucun `NOT_COMPLIANT` sans au moins un `notCompliantItems`** portant : où (sélecteur CSS),
   quoi (le test RGAA échoué, cité par son numéro), et si le code est accessible, le fichier source.
4. **Ce qui demande un jugement humain est posé en question**, pas deviné.
   `references/decidabilite.md` dit, critère par critère, ce qui est décidable par machine et ce qui
   ne l'est pas. Si l'utilisateur ne tranche pas : `NOT_TESTED` + commentaire expliquant la manip à
   faire. Jamais un `COMPLIANT` par défaut.
5. **Le rapport final annonce la couverture réelle** : N décidés automatiquement / M par question /
   K laissés non testés, et pourquoi.
6. **Le `uniqueId` de l'audit est un secret d'écriture.** Il ne va dans aucun fichier du dépôt,
   aucun log, aucun commentaire. Il reste en argument de commande.

## Déroulé

### 1. Cadrage

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ara.mjs" get <uniqueId>
```

Donne `procedureName`, `auditType` (`FAST` 25 critères / `COMPLEMENTARY` 50 / `FULL` 106), et surtout
la liste des pages **avec leurs `id` numériques** — c'est le `pageId` de tous les écrits.
Ara ajoute une page « Éléments transverses » pour ce qui vaut pour tout le site.

Pas encore d'audit ? Construire le payload et `ara.mjs create`. Vérifier d'abord l'échantillon
contre `references/echantillon.md` et **signaler à l'utilisateur ce qui manque** (page d'aide,
authentification, résultats de recherche… sont souvent oubliées).

Renseigner correctement `pageElements` (`multimedia`, `form`, `table`, `frame`) : Ara s'en sert pour
présélectionner les thématiques non applicables.

### 2. Repérage du code

Pour chaque URL de l'échantillon, trouver les fichiers qui produisent le markup. Ce qui compte n'est
pas la page mais **la source du défaut** : un composant partagé cassé, c'est une correction, pas
douze. Chercher les templates/partiels/composants, les menus (souvent dupliqués par langue), les
gabarits de formulaire, la couche de thème.

Pas d'accès au code → **mode boîte noire** : tout continue, mais les critères marqués `CODE` dans
`decidabilite.md` sont traités à partir du DOM rendu uniquement, et ceux qui l'exigent vraiment
passent en `NOT_TESTED` avec la raison.

### 3. Sonde

Pour chaque page, dans le navigateur :

1. `navigate` vers l'URL, attendre le chargement complet, accepter/refuser la bannière cookies
   (choisir l'option la plus protectrice) — et **auditer aussi la bannière**, elle fait partie du site.
2. Injecter `scripts/probe.js` via `javascript_tool` (lire le fichier, envoyer son contenu tel quel :
   la dernière expression retourne l'objet de preuves, et il est aussi posé sur `window.__rgaa`).
3. Écrire le retour dans `<scratchpad>/rgaa/<slug>.probe.json`.
4. Capture d'écran pleine page.
5. Les **tests que le DOM ne donne pas**, à faire à la main avec les outils navigateur :
   - parcours clavier complet (Tab / Shift+Tab) : ordre cohérent, focus toujours visible, aucun piège ;
   - `resize_window` mobile (375) et 320 px : pas de double défilement, contenu complet ;
   - zoom 200 % ;
   - composants interactifs : menus, onglets, accordéons, modales, carrousels — ouvrables et
     utilisables au clavier, focus correctement déplacé et restitué ;
   - contenus au survol : accessibles au clavier, persistants, masquables ;
   - CSS désactivé : l'ordre du contenu reste compréhensible.

La sonde **ne juge rien**, elle collecte. Elle a des limites explicites, listées en tête de
`probe.js` — les lire avant d'interpréter sa sortie.

#### Le journal de tabulation : tout le parcours clavier en deux appels

Ne tabulez pas pas à pas. Posez un écouteur qui journalise, puis envoyez cent Tab d'un coup :

```js
window.__journal = [];
document.addEventListener("focusin", (ev) => {
  const e = ev.target; if (e === document.body) return;
  const r = e.getBoundingClientRect();
  window.__journal.push({ sel: selecteurDe(e), nom: nomDe(e),
    x: Math.round(r.left), y: Math.round(r.top + scrollY),
    // ce que voit vraiment l'utilisateur : rendu, ou clippe par un ancetre ?
    rendu: (() => { const t = document.elementFromPoint(r.left + Math.min(r.width / 2, 30), r.top + r.height / 2);
                    return !!(t && (t === e || e.contains(t) || t.contains(e))); })() });
}, true);
document.body.setAttribute("tabindex", "-1"); document.body.focus();
```

Puis `computer` avec `{ action: "key", text: "Tab", repeat: 100 }`, et relire `window.__journal`.
Ce seul journal tranche trois critères d'un coup :

- **12.9** — le cycle se referme-t-il sur son premier élément ? Si oui, rien ne retient le focus.
  Rejouer avec `shift+Tab` pour le sens inverse. Une modale qui confine le focus n'est un piège que
  si **aucune** sortie n'existe : chercher un bouton de fermeture dans le cycle avant de conclure,
  et tester Échap à part — son inefficacité est une réserve à consigner, pas une non-conformité 12.9.
- **12.8** — comparer la séquence à l'ordre visuel en regroupant les `y` par bandes de 40 px.
  Les écarts au passage d'une colonne à l'autre d'un pied de page sont un ordre de lecture légitime,
  pas un défaut. Vérifier au passage qu'aucun `tabindex` positif ne traîne.
- **10.8 / 12.11** — les entrées dont `rendu` est faux reçoivent le focus sans être visibles :
  contenu masqué laissé dans l'ordre de tabulation.

Le journal enregistre aussi les composants qui s'ouvrent en cours de route : il reflète le parcours
réel, pas une liste théorique de focusables.

### 4. Instruction par thématique

Lancer les sous-agents `rgaa-thematique`, par lots de 3 ou 4 en parallèle, un par thématique RGAA.
Chacun reçoit : sa thématique (`node scripts/rgaa.mjs topic <n>`), les `*.probe.json` de toutes les
pages, les captures, les notes de tests manuels, et le chemin du code.

Il rend, par page et par critère : `status`, un commentaire en français citant le numéro du test RGAA
échoué et l'élément concerné, l'`userImpact`, le `quickWin`, plus la liste de ce qu'il ne peut pas
trancher avec la question exacte.

### 5. Questions

Regrouper les points non décidables **par thématique** et les poser par lots via `AskUserQuestion`
(4 questions maximum par appel) — jamais une question par critère. Chaque question porte sa preuve :
le texte exact, la capture, l'extrait de code, et ce qui bascule selon la réponse.
Si l'utilisateur passe : `NOT_TESTED` + commentaire.

### 6. Écriture dans Ara

Assembler un seul fichier `resultats.json` (tableau d'items), puis :

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ara.mjs" push <uniqueId> resultats.json
```

`push` purge d'abord les `notCompliantItems` déjà présents sur les critères qu'il réécrit (sinon
l'API en recrée à chaque passage → doublons), écrit par lots, **puis relit tout et vérifie**.
Il sort en erreur au moindre écart. Ensuite, captures sur les non-conformités qui le justifient :

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ara.mjs" upload <uniqueId> <topic> <criterium> <pageId> capture.png
```

La route d'upload est marquée « deprecated » côté Ara : si elle échoue, ouvrir l'audit dans le
navigateur, faire un ajout d'image à la main et lire la vraie requête avec `read_network_requests`,
puis corriger `ara.mjs`. **Ne pas inventer d'endpoint.**

Ne **jamais** appeler `publish` sans demande explicite de l'utilisateur : cela publie le rapport.

### 7. Rapport

Un fichier local `rgaa-<date>.md` :

- taux de conformité (conformes / (conformes + non conformes), les NA exclus) ;
- **non-conformités groupées par fichier source**, pas par page — un composant cassé = une entrée,
  avec la liste des pages touchées ;
- quick-wins en tête ;
- section **« Non testé »** : chaque critère laissé ouvert, la raison, et la manip exacte à faire ;
- la phrase de couverture : N automatiques / M par question / K non testés sur 106 × pages.

## Impacts utilisateur

`BLOCKING` — l'utilisateur ne peut pas accomplir la tâche (piège clavier, formulaire inutilisable,
CAPTCHA sans alternative, contenu inatteignable).
`MAJOR` — tâche possible mais fortement dégradée (image d'information sans alternative, champ sans
étiquette, contraste très insuffisant).
`MINOR` — gêne réelle mais contournable (hiérarchie de titres imparfaite, `title` redondant).

`quickWin: true` = corrigeable en une ligne sans arbitrage éditorial ni redesign (ajouter `lang`,
`title` sur une iframe, `scope` sur un `th`, `alt=""` sur une décoration).

## Fichiers du plugin

| Chemin | Rôle |
|---|---|
| `scripts/ara.mjs` | client Ara : `get`, `results`, `push`, `verify`, `create`, `upload`, `publish`, `selftest` |
| `scripts/rgaa.mjs` | découpe du référentiel : `topics`, `topic <n>`, `criterium <n.m>`, `plan` |
| `scripts/probe.js` | sonde DOM à injecter dans la page |
| `references/criteres-4.1.json` | référentiel officiel RGAA 4.1 (DISIC) |
| `references/ara-api.md` | contrat d'API Ara, formats, énumérations |
| `references/decidabilite.md` | les 106 critères : décidable par machine, par le code, ou par l'humain |
| `references/echantillon.md` | règles de constitution de l'échantillon |
| `tests/fixture.html` | page à défauts connus pour vérifier la sonde |

## Livrer le rapport en Word

`scripts/rapport-docx.js` convertit le rapport markdown en HTML mis en forme (page de garde,
tableaux, encadrés), que LibreOffice transforme ensuite en `.docx` :

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/rapport-docx.js" rgaa-<date>.md /chemin/sans/espace/rapport.html
soffice --headless --norestore --convert-to 'docx:MS Word 2007 XML' --outdir <dir> <dir>/rapport.html
soffice --headless --norestore --convert-to pdf --outdir <dir> <dir>/rapport.docx   # pour relire
```

Quatre pièges, tous rencontrés :

- **Lancer soffice depuis un chemin sans nom court Windows** (`UTILIS~1`) : sinon « source file
  could not be loaded ». Passer par un dossier de travail au chemin simple.
- **Le filtre de sortie contient des espaces** : `'docx:MS Word 2007 XML'` doit rester un seul
  argument. PowerShell l'éclate — utiliser bash, ou le filtre est tronqué en « MS ».
- **LibreOffice ignore `width:100%` en CSS sur les tables.** Sans l'attribut HTML `width` et un
  `<colgroup>`, tous les tableaux sont écrasés sur un tiers de la largeur.
- **`page-break-after` sur une `div` n'est pas respecté** : poser un
  `<p style="page-break-before:always">` sur l'élément suivant.

Relire le PDF page par page avant de livrer (`pdftoppm -jpeg -r 80`) : c'est là qu'on voit les
tableaux écrasés et les sauts de page manqués.
