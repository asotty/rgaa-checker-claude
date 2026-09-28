# rgaa-audit — marketplace Claude Code

Un plugin Claude Code qui réalise un **audit d'accessibilité RGAA 4.1 complet** d'un site web et
**remplit l'audit dans [Ara](https://ara.numerique.gouv.fr)** via son API : statuts, commentaires,
impacts utilisateur, quick-wins.

## Installation

```bash
claude plugin marketplace add <url-de-ce-depot>
claude plugin install rgaa-audit@rgaa-audit
```

Redémarrer Claude Code, puis :

```
/rgaa-audit https://ara.numerique.gouv.fr/audits/<identifiant>/generation/…
/rgaa-probe https://exemple.fr/une-page
```

## Ce qu'il fait

Il croise **le site en ligne** et **le code source**, mesure ce qui est mesurable, pose la question
quand un jugement humain est requis, et dit ce qu'il n'a pas pu établir. Trois règles non
négociables, écrites dans la skill :

- aucun critère conforme sans preuve positive — « je n'ai rien vu de cassé » n'en est pas une ;
- aucun non-applicable sans motif écrit ;
- aucun non-conforme sans le test RGAA cité, le sélecteur fautif et, si le code est accessible, le
  fichier source.

Il va plus loin que les extensions de navigateur sur plusieurs points, parce qu'il pilote le
navigateur au lieu d'y être enfermé :

| | |
|---|---|
| **Contraste sur image** | Lit les pixels réels du média dans un canvas et **compose les voiles semi-transparents** posés par-dessus. WAVE et axe-core classent ces cas « indécidables » |
| **Contraste des composants** | Bordure et fond de chaque champ, bouton et composant ARIA contre leur environnement |
| **Parcours clavier** | Un écouteur `focusin` plus cent Tab envoyés d'un coup : le journal tranche d'un seul coup l'ordre de tabulation, les pièges au clavier et les contenus focusables mais invisibles |
| **Reflow, zoom, espacement** | Rejoués à 320 px, 200 % et aux valeurs d'espacement exigées |
| **Changement de contexte** | Détecté par simulation, sans rien envoyer : `form.submit()`, l'événement `submit` et `beforeunload` sont instrumentés |

## Contenu

```
plugins/rgaa-audit/
  skills/rgaa-audit/SKILL.md            la méthode et les règles d'honnêteté
  skills/rgaa-audit/references/
    criteres-4.1.json                   le référentiel officiel (DISIC)
    decidabilite.md                     les 106 critères : mesurable, à lire dans le code, ou à juger
    ara-api.md                          le contrat d'API d'Ara et ses pièges
    echantillon.md                      comment constituer un échantillon valable
  scripts/probe.js                      la sonde DOM injectée dans la page
  scripts/ara.mjs                       le client Ara (get, push, verify, publish, selftest)
  scripts/rgaa.mjs                      découpe du référentiel
  scripts/rapport-docx.js               le rapport markdown vers Word
  tests/fixture.html                    page à défauts connus, pour vérifier la sonde
```

## Vérifier que l'outil fonctionne

```bash
node plugins/rgaa-audit/scripts/ara.mjs selftest     # validation et diff, sans réseau
```

Pour la sonde : servir `plugins/rgaa-audit/tests/fixture.html` en HTTP, l'ouvrir, puis lire
`window.__rgaa`. La page contient des défauts connus **et** des éléments corrects qui ne doivent pas
remonter — c'est cette seconde moitié qui attrape les faux positifs.

## Licence

Le référentiel RGAA (`criteres-4.1.json`) provient de
[DISIC/accessibilite.numerique.gouv.fr](https://github.com/DISIC/accessibilite.numerique.gouv.fr)
et reste sous sa licence d'origine.
