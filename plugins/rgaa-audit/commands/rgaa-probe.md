---
description: Sonde une seule page et affiche les preuves RGAA collectées, sans rien écrire dans Ara
argument-hint: <url>
---

Sonde la page $ARGUMENTS, sans toucher à Ara.

1. Ouvrir l'URL dans le navigateur (`tabs_create` puis `navigate`), attendre le chargement,
   traiter la bannière cookies en choisissant l'option la plus protectrice.
2. Lire `${CLAUDE_PLUGIN_ROOT}/scripts/probe.js` et injecter son contenu tel quel via `javascript_tool`.
3. Enregistrer le retour dans `<scratchpad>/rgaa/<slug>.probe.json` et prendre une capture.
4. Restituer une synthèse lisible : ce qui est manifestement non conforme, ce qui est douteux, et ce
   que la sonde ne peut pas voir (voir les limites en tête de `probe.js` et `references/decidabilite.md`).

Ne rien conclure sur les critères marqués HUMAIN dans la table de décidabilité : les lister comme
restant à vérifier.
