# rgaa-audit

Audit d'accessibilité RGAA 4.1 (106 critères / 258 tests) d'un site web, puis remplissage de l'audit
dans [Ara](https://ara.numerique.gouv.fr) via son API REST.

Le principe : on croise **le site en ligne** (ce que l'utilisateur rencontre) et **le code source**
(ce qui produit le défaut), on tranche ce qui est décidable, on **pose la question** pour le reste,
et on dit ce qu'on n'a pas pu tester.

## Commandes

    /rgaa-audit <url-edition-ara>      audit complet + écriture dans Ara
    /rgaa-probe <url>                  sonde une page, n'écrit rien

## Scripts

    node scripts/ara.mjs get|results|push|verify|create|upload|publish|selftest
    node scripts/rgaa.mjs topics|topic <n>|criterium <n.m>|plan <n|all> <pageIds>

## Vérifier que l'outil marche

    node scripts/ara.mjs selftest        # validation + diff, sans réseau

Sonde : servir `tests/fixture.html` en HTTP (elle charge `probe.js` depuis le même dossier), l'ouvrir
dans le navigateur, puis lire `window.__rgaa`. La page contient des défauts connus (alt manquant,
saut de niveau de titre, contraste faible, iframe sans title, champ sans étiquette, faux bouton…)
**et** des éléments corrects qui ne doivent pas remonter.

## Sécurité

L'API Ara n'authentifie pas les routes d'un audit : l'`editUniqueId` de l'URL d'édition **est** le
secret d'écriture. Il ne va dans aucun fichier, aucun log, aucun rapport.

`publish` n'est jamais appelé sans demande explicite : il publie le rapport.

## Modifier le plugin

La source est `~/rgaa-audit/plugins/rgaa-audit`. Claude Code travaille sur une copie installée :
après modification, incrémenter `version` dans `.claude-plugin/plugin.json` puis

    claude plugin update rgaa-audit@rgaa-audit

Le dépôt `~/rgaa-audit` est aussi sa propre marketplace (`.claude-plugin/marketplace.json`) : le
pousser sur un dépôt git suffit à l'installer ailleurs avec
`claude plugin marketplace add <url>` puis `claude plugin install rgaa-audit@rgaa-audit`.
