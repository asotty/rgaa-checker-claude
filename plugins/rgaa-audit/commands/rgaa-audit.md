---
description: Audit RGAA 4.1 complet d'un site et remplissage de l'audit dans Ara
argument-hint: <url-edition-ara | uniqueId> [--pages url,url] [--topics 1,5,11]
---

Lance un audit RGAA 4.1 en suivant la skill `rgaa-audit` (méthode, règles d'honnêteté, format d'écriture).

Cible : $ARGUMENTS

Marche à suivre :

1. Extraire l'`uniqueId` de l'argument (c'est le segment après `/audits/` dans l'URL d'édition).
   Le traiter comme un secret : ne jamais l'écrire dans un fichier ni le répéter dans le rapport.
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/ara.mjs" get <uniqueId>` pour récupérer le type d'audit et les
   pages avec leurs `id`. Confronter l'échantillon à `references/echantillon.md` et signaler les manques.
3. Sonder chaque page, instruire les thématiques, poser les questions par lots, écrire dans Ara,
   vérifier la relecture, produire le rapport — comme décrit dans la skill.

`--pages` restreint aux URL indiquées, `--topics` aux thématiques indiquées. Sans option : tout
l'échantillon et toutes les thématiques du type d'audit.

Ne jamais publier l'audit (`publish`) sans demande explicite.
