| 6.1 | AUTO/HUMAIN | AUTO : `liens[].intituleNonExplicite` repere les intitules reputes flous hors contexte (« en savoir plus », « lire la suite », « cliquez ici », « telecharger », « voir », chevrons) **et non completes** par un `title`, un `aria-label` ou un texte masque. Un meme intitule complete est conforme : c'est la combinaison qui decide. HUMAIN : les intitules hors de cette liste qui seraient malgre tout ambigus || 5.6 | AUTO | `tableaux[].thEnTetesColonnes` et `thEnTetesLignes`. Le defaut le plus courant est invisible au premier regard : sur une **matrice a double entree**, les libelles de ligne sont laisses en `td`. `tableaux[].enTetesLignesManquants` le detecte — une cellule de corps quasi vide (croix, tiret, chiffre) trahit la matrice. Piege d'implementation : `table.rows` inclut les lignes du `thead`, il faut parcourir `tBodies` || 5.1 | AUTO/HUMAIN | `tableaux[].matriceADoubleEntree` signale les matrices. Nuance a tenir : une matrice a double entree **n'est pas** un tableau complexe au sens RGAA tant que `scope="col"` et `scope="row"` suffisent a associer les cellules. Le critere ne vise que les en-tetes fusionnes ou multiniveaux |# Décidabilité des 106 critères RGAA 4.1

Trois niveaux. Le but est de **savoir d'avance ce qu'on n'a pas le droit de conclure seul**.

- **AUTO** — la sonde (`probe.js`) ou un test navigateur suffit à trancher. Décider.
- **CODE** — il faut lire le source (template, composant, JS) en plus du DOM rendu.
  Sans accès au code : `NOT_TESTED` + raison.
- **HUMAIN** — jugement éditorial, sémantique ou perceptif. **Poser la question.**
  Sans réponse : `NOT_TESTED` + la manip à faire.

Quand un critère est mixte, la partie AUTO sert à détecter les cas ; la partie HUMAIN tranche la
pertinence. Un critère mixte ne passe jamais `COMPLIANT` sur la seule partie AUTO.

## 1. Images

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 1.1 | AUTO | présence d'une alternative (`alt`, `aria-label`, `aria-labelledby`, `title`) sur chaque image d'information → `images[].hasAlt` / `nomAccessible` |
| 1.2 | AUTO | décoration correctement ignorée : `alt=""` **et** pas d'`aria-label`/`title`, ou `aria-hidden="true"` |
| 1.3 | HUMAIN | **pertinence** de l'alternative. La sonde remonte le texte, elle ne sait pas s'il décrit l'image |
| 1.4 | HUMAIN | image-texte / CAPTCHA : l'alternative reprend-elle la même information ? |
| 1.5 | HUMAIN | CAPTCHA : existe-t-il une autre solution d'accès ? |
| 1.6 | HUMAIN | l'image nécessite-t-elle une description détaillée ? (juger « nécessaire ») |
| 1.7 | HUMAIN | pertinence de la description détaillée |
| 1.8 | HUMAIN | l'image-texte pourrait-elle être remplacée par du texte stylé ? (hors logo/marque) |
| 1.9 | AUTO | légende reliée : `figure`/`figcaption`, ou `aria-labelledby`/`role="figure"` |

## 2. Cadres

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 2.1 | AUTO | `cadres[].title` présent et non vide sur chaque `iframe`/`frame` non masqué |
| 2.2 | HUMAIN | le titre décrit-il vraiment le contenu du cadre ? |

## 3. Couleurs

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 3.1 | HUMAIN | information donnée par la couleur seule (« champs en rouge », statuts colorés, liens sans soulignement dans un texte) — **non détectable automatiquement** |
| 3.2 | AUTO | `couleurs.contrastesDouteux`. Sur fond uni, ratio calcule contre le fond opaque. **Sur un texte pose sur une image, la sonde lit les vrais pixels du media dans un canvas et compose les voiles semi-transparents intercales** (le `rgba(0,0,0,.5)` des bandeaux de carrousel), puis echantillonne 98 points sur la surface du texte : `ratioMin`, `ratioMedian`, `pctPixelsSousSeuil`. C est decidable — et c est plus que ce que font WAVE ou axe-core, qui declarent ces cas indecidables. Reste HUMAIN seulement si le media vient d un autre domaine (canvas contamine) ou si le fond est pose en `background-image` CSS |
| 3.3 | AUTO | `couleurs.composantsSousSeuil` : pour chaque champ, bouton et composant ARIA, contraste de sa **bordure** et de son **fond** contre l environnement, le meilleur des deux etant retenu (seuil 3:1). Couvre aussi les icones vectorielles seules dans un lien ou un bouton. **Ne couvre pas** le contraste de l indicateur de focus, qui exige un focus clavier reel — ce point precis reste HUMAIN |

## 4. Multimédia

Thématique la plus dépendante du jugement humain : la présence d'un fichier ne dit rien de sa qualité.

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 4.1 | AUTO/HUMAIN | `media[].pistes` détecte `<track>`, mais transcription textuelle et AD peuvent être ailleurs dans la page → confirmer |
| 4.2 | HUMAIN | pertinence de la transcription |
| 4.3 | AUTO/HUMAIN | présence de `track kind="captions"` ; synchronisation et exactitude → humain |
| 4.4 | HUMAIN | pertinence des sous-titres |
| 4.5 | HUMAIN | existence d'une audiodescription |
| 4.6 | HUMAIN | pertinence de l'audiodescription |
| 4.7 | HUMAIN | le média est-il clairement identifiable (titre, contexte) ? |
| 4.8 | HUMAIN | média non temporel (animation, applet) : alternative présente ? |
| 4.9 | HUMAIN | pertinence de cette alternative |
| 4.10 | AUTO | `media[].autoplay` + durée > 3 s + absence de `controls` → non conforme |
| 4.11 | AUTO partiel, puis HUMAIN | AUTO : `media[].dansOrdreTabulation` établit que le lecteur est atteignable au clavier, et un Tab réel confirme que le focus y entre. **Mur** quand `media[].origineTierce` est vrai : le pilotage automatisé ne peut délivrer ni frappe ni clic dans un cadre cross-origin — le harnais refuse l'événement (« could not be attributed to a frame »). Un échec observé dans ces conditions ne prouve **rien** sur le site. Le reste se teste à la main, au vrai clavier |
| 4.12 | TEST clavier | idem pour média non temporel |
| 4.13 | AUTO partiel, puis QUESTION | Trois voies essayées et fermées pour un lecteur tiers : le DOM du cadre n'est pas lisible depuis la page (cross-origin), l'arbre d'accessibilité du navigateur ne traverse pas le cadre, et ouvrir directement l'URL de l'embed est refusé par la plateforme (« Erreur de configuration du lecteur vidéo »). Ce qui reste automatisable : signaler via `media[].origineTierce` que le critère porte sur un composant que le site n'écrit pas lui-même |

### Lecteur vidéo tiers : poser la question, ne pas laisser en « non testé »

Quand `media[].origineTierce` est vrai (YouTube, Vimeo, Dailymotion…), les critères **4.11 et 4.13
portent sur le lecteur, pas sur le code du site**. La mesure est impossible, mais le laisser en
`NOT_TESTED` n'est pas la bonne réponse : un « non testé » ne peut porter aucun commentaire dans Ara,
donc la case paraît vide et personne ne sait pourquoi.

La bonne réponse est de **demander à l'auditeur** s'il retient la conformité du lecteur employé — une
appréciation professionnelle sur un composant connu est une preuve recevable, à condition d'être
consignée comme telle. Si oui, écrire un `compliantComment` qui dit explicitement : quel lecteur, ce
qu'il satisfait au regard du test, **et que la conformité est retenue sur appréciation de l'auditeur,
non sur une mesure automatisée**, en indiquant ce qui a bloqué la mesure et ce qui a tout de même été
établi (cadre dans l'ordre de tabulation, focus qui y entre).

Attention à la portée quand on l'annonce : cette conformité couvre le lecteur. Elle ne dit rien de
4.1, 4.3 et 4.5 — transcription, sous-titrage, audiodescription — qui relèvent du producteur du
contenu et se traitent séparément.

## 5. Tableaux

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 5.1 | HUMAIN | juger si le tableau est « complexe » (double entrée, en-têtes multiniveaux) → résumé requis |
| 5.2 | HUMAIN | pertinence du résumé |
| 5.3 | AUTO | tableau de mise en forme linéarisable : `tableaux[].apercu` dans l'ordre du DOM |
| 5.4 | AUTO | `tableaux[].caption` présent sur chaque tableau de données |
| 5.5 | HUMAIN | pertinence du titre |
| 5.6 | AUTO | `tableaux[].th` > 0 sur un tableau de données |
| 5.7 | AUTO | `thSansScope` = 0, ou `cellulesAvecHeaders` cohérent |
| 5.8 | AUTO | `misEnForme: true` → ni `th`, ni `caption`, ni `role` de tableau de données |

## 6. Liens

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 6.1 | AUTO/HUMAIN | AUTO : lien sans nom accessible, lien image-seule sans `alt`, « cliquez ici ». HUMAIN : le nom suffit-il **hors contexte** ? |
| 6.2 | AUTO | `liens[].nomAccessible.value` non vide pour tout lien visible |

## 7. Scripts

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 7.1 | AUTO | `scripts.composantsScriptes` inventorie tout composant piloté par script — par son rôle de widget ou par un marqueur de comportement (`data-toggle`, `data-slide`, `aria-expanded`…) — et donne exactement ce qu'exige le **test 7.1.3** : `nomAccessible`, `role`, et `nomContientIntitule`. Pour le **test 7.1.1**, le changement d'état se vérifie en déclenchant focus et survol puis en relisant `aria-expanded` / `aria-selected` / `aria-pressed` : si la valeur bascule, l'état est restitué. Reste HUMAIN : la conformité fine au motif WAI-ARIA d'un widget complexe |
| 7.2 | HUMAIN | pertinence de l'alternative d'un script |
| 7.3 | AUTO | `composantsScriptes[].inactionnableAuClavier` : un `div`, `li` ou `span` porteur d'un comportement, sans `role` et hors ordre de tabulation, échoue. Si la page n'en contient aucun et que tous ses composants scriptés sont des balises natives focusables, le critère est décidable en conforme. Reste HUMAIN : les gestes complexes et les composants à clavier non standard |
| 7.4 | AUTO | Se teste par simulation, sans rien envoyer : poser le focus sur chaque champ puis émettre `change`, en ayant instrumenté `form.submit()`, l'événement `submit` et `beforeunload`. Si rien ne se déclenche et que l'URL ne bouge pas, aucun changement de contexte n'est initié à la saisie ou à la prise de focus. Le cas classique — liste déroulante qui recharge la page — se détecte ainsi en une passe. Vérifier ensuite que les changements restants partent bien d'un bouton ou d'un lien explicite |
| 7.5 | CODE/HUMAIN | messages de statut : `role="status"`/`alert`/`aria-live` présents **et** utilisés au bon moment |

## 8. Éléments obligatoires

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 8.1 | AUTO | `document.doctype` = `html`, placé en tête |
| 8.2 | AUTO | validité du code : à confirmer via le validateur W3C (`validator.w3.org/nu/?out=json&doc=<url>`). Sinon `NOT_TESTED` |
| 8.3 | AUTO | `document.lang` présent |
| 8.4 | AUTO | code de langue valide et **cohérent avec la langue réelle du contenu** |
| 8.5 | AUTO | `titre` non vide |
| 8.6 | HUMAIN | le titre décrit-il la page ? est-il unique dans le site ? |
| 8.7 | AUTO propose, HUMAIN tranche | languesSuspectes confronte chaque noeud de texte a deux lexiques de mots outils anglais et francais, PRIVES DE LEUR INTERSECTION : sans cela un mot ambigu comme a (article anglais, verbe francais) fait rater le defaut. La sonde remonte des candidats ; le tri entre vrai changement de langue et terme metier lexicalise est un jugement a porter, le critere prevoyant un cas particulier pour les noms communs etrangers passes dans le langage commun (applicable seulement si l absence d indication provoque une incomprehension) |
| 8.8 | AUTO | codes de langue valides (`langues[].lang`) |
| 8.9 | AUTO | balisesDetournees. Le signal sur est le titre sans contenu : une balise de titre qui ne titre rien n est la que pour son rendu, et elle pollue en plus le plan du document (rejoint 9.1). Sont aussi releves : paragraphes vides servant d espaceur, suites de <br>, balises obsoletes (font, center, big, small, tt, strike, u, marquee), citations sans cite, listes a item unique. Nuance a tenir : un paragraphe vide merite un nettoyage mais ne detourne aucune semantique et n est pas restitue — il ne suffit pas a conclure non conforme |
| 8.10 | HUMAIN | sens de lecture : `dir` requis sur les contenus bidirectionnels |

## 9. Structuration de l'information

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 9.1 | AUTO/HUMAIN | AUTO : `structure.titres` — présence d'un `h1`, pas de saut de niveau. HUMAIN : la hiérarchie reflète-t-elle le plan du contenu ? |
| 9.2 | AUTO/HUMAIN | `structure.landmarks` : `banner`, `navigation`, `main`, `contentinfo` présents et uniques là où il faut |
| 9.3 | AUTO | `structure.listesFactices` : énumérations en texte brut non balisées |
| 9.4 | AUTO/HUMAIN | citations en `blockquote`/`q` (`structure.citations`) |

## 10. Présentation de l'information

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 10.1 | AUTO | `presentation.attributsPresentation` (align, valign, bgcolor, background, border, cellpadding, cellspacing, hspace, vspace, nowrap, **frameborder**, marginwidth, marginheight) + `balisesDetournees.balisesObsoletes`. Le `frameborder="0"` des intégrations vidéo est le cas le plus fréquent |
| 10.2 | AUTO | `presentation.texteParCss` : texte injecté par la propriété `content` d'un pseudo-élément, seul contenu qui disparaîtrait feuilles de style désactivées. Les règles qui ne correspondent à aucun élément de la page sont écartées — sans ce filtre, le CSS mort d'un framework fait remonter de faux défauts |
| 10.3 | AUTO/HUMAIN | `presentation.horsFlux` inventorie les blocs en `position: absolute`/`fixed` porteurs de texte. Décider revient à regarder si chacun est enfant direct de l'élément qu'il complète : remis dans le flux, il se replace alors au bon endroit. Vérifier aussi qu'aucun `order` flex ni `flex-direction: reverse` ne contredit l'ordre du DOM |
| 10.4 | AUTO, viewport à changer | Ramener la fenêtre à la moitié de ses dimensions (640x450 depuis 1280x900) puis vérifier `scrollWidth <= innerWidth` et l'absence de texte tronqué par `overflow: hidden`/`text-overflow: ellipsis`. Se joue depuis la skill, pas dans la sonde |
| 10.5 | AUTO | `presentation.couleursDeclareesSeparement` compte les règles déclarant `color` sans fond et l'inverse — **en ne retenant que celles qui s'appliquent réellement à un élément de la page**. Sans ce filtre, un Bootstrap non personnalisé produit des centaines de faux positifs sur du CSS mort |
| 10.6 | AUTO | `presentation.liensDansTexte` : un lien n'est « au sein d'un texte » que si son parent a du **texte propre** autour de lui et qu'il n'est pas dans une navigation. Sans cette double condition, tous les liens de menu remontent à tort. Est retenu comme distingué : soulignement, graisse, bordure, ou contraste ≥ 3:1 avec le texte environnant |
| 10.7 | AUTO/TEST | `presentation.focusSupprime` liste les `outline:none` ; vérifier ensuite au clavier qu'un focus reste visible |
| 10.8 | AUTO | `presentation.focusableNonRendu`. Le bon test n'est pas la boîte de l'élément mais `elementFromPoint` sur son centre : un lien dans un conteneur `height: 0; overflow: hidden` garde sa propre hauteur et passerait inaperçu autrement. Écarter d'abord `display: none` et `visibility: hidden`, qui ne sont pas focusables |
| 10.9 | HUMAIN | information portée par la seule forme, taille ou position. Le relevé lexical de 10.10 ne couvre pas ce cas : il faut regarder |
| 10.10 | AUTO | `presentation.indicationsSensorielles` : relevé lexical des tournures (« ci-dessous », « à droite », « le bouton vert », « en rouge », « colonne de gauche »…) sur tous les textes. Zéro occurrence vaut preuve positive pour ce critère |
| 10.11 | AUTO, viewport à changer | Fenêtre à 320 px, puis `scrollWidth <= innerWidth`. Attention aux faux positifs : les pistes internes de carrousel dépassent toujours, mais leur conteneur est en `overflow: hidden` — les exclure |
| 10.12 | AUTO | Injecter une feuille `*{line-height:1.5;letter-spacing:.12em;word-spacing:.16em}p{margin-bottom:2em}` puis chercher les éléments tronqués et le double défilement. Exclure les `.sr-only`, masqués par construction |
| 10.13 | AUTO | Un contenu révélé au survol satisfait « survolable » et « persistant » dès lors qu'il est **enfant** de la zone survolée : le pointeur peut s'y déplacer sans le faire disparaître. Se lit dans le sélecteur de la règle `:hover` |
| 10.14 | AUTO | `presentation.survolSansEquivalentFocus` : toute règle `:hover` qui révèle un contenu sans règle `:focus`/`:focus-within` jumelle. Compter ensuite les **éléments** concernés sur la page, pas seulement les règles — la feuille de style est commune à tout le site, les composants non |

## 11. Formulaires

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 11.1 | AUTO | `champs[].labelPour` / `labelEnglobant` / `nomAccessible`. Un `placeholder` seul (`from: "placeholder-seul"`) **ne vaut pas** étiquette |
| 11.2 | HUMAIN | l'étiquette décrit-elle la donnée attendue ? |
| 11.3 | HUMAIN | étiquettes identiques pour des champs de même nature à travers le site |
| 11.4 | HUMAIN | étiquette visuellement accolée au champ (à juger sur la capture) |
| 11.5 | HUMAIN | champs de même nature regroupés (adresse, date, choix multiple) |
| 11.6 | AUTO | chaque `fieldset` a une `legend` (`champs[].legend`) |
| 11.7 | HUMAIN | pertinence de la légende |
| 11.8 | AUTO/HUMAIN | `optgroup` là où les options se regroupent, avec `label` |
| 11.9 | HUMAIN | l'intitulé du bouton décrit-il l'action ? |
| 11.10 | TEST/HUMAIN | contrôle de saisie : erreurs signalées en texte, champ identifié, format attendu explicité |
| 11.11 | TEST/HUMAIN | suggestion de correction quand le format est connu |
| 11.12 | HUMAIN | saisie financière/juridique : modification, suppression ou confirmation possible |
| 11.13 | AUTO | `champs[].autocomplete` sur les champs d'identité de l'utilisateur |

## 12. Navigation

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 12.1 | AUTO multi-pages | deux systèmes parmi menu / plan du site / moteur de recherche (`navigation.*`) |
| 12.2 | AUTO multi-pages | menu et barre de navigation identiques d'une page à l'autre — comparer les `probe.json` |
| 12.3 | HUMAIN | le plan du site reflète-t-il l'organisation réelle ? |
| 12.4 | AUTO multi-pages | plan du site atteignable de façon identique partout |
| 12.5 | AUTO multi-pages | moteur de recherche atteignable de façon identique partout |
| 12.6 | AUTO | regroupements de liens dans des landmarks (`structure.landmarks`) |
| 12.7 | AUTO/TEST | `navigation.skipLinks` : présent, premier élément focusable, cible existante — **et testé au clavier** |
| 12.8 | AUTO | Journal de tabulation (voir SKILL.md) : la séquence réelle est confrontée à l'ordre visuel par bandes de 40 px. Vérifier aussi l'absence de `tabindex` positif. Ne pas compter comme défaut les écarts au passage d'une colonne à l'autre dans un pied de page — c'est un ordre de lecture légitime |
| 12.9 | AUTO | Journal de tabulation : si le cycle se referme sur son premier élément, rien ne retient le focus. Rejouer en `shift+Tab`. **Une modale qui confine le focus n'est pas un piège** tant qu'une sortie existe dans le cycle (bouton de fermeture) : chercher cette sortie avant de conclure. L'inefficacité d'Échap est une réserve à consigner, pas une non-conformité de ce critère |
| 12.10 | CODE/TEST | raccourcis à une touche désactivables ou remappables |
| 12.11 | AUTO | Deux sources convergentes : les entrées `rendu: false` du journal de tabulation (contenus focusables non visibles), et `presentation.survolSansEquivalentFocus` (contenus révélés au survol sans règle `:focus-within`). Compter les **éléments** concernés page par page, la feuille de style étant commune à tout le site |

## 13. Consultation

| Crit. | Niveau | Preuve requise |
|---|---|---|
| 13.1 | HUMAIN | limite de temps (session, redirection, `document.metaRefresh`) : contrôlable ou supprimable |
| 13.2 | AUTO/HUMAIN | `consultation.nouvelleFenetre` détecte `target="_blank"` ; l'ouverture doit être **annoncée** dans le nom accessible |
| 13.3 | HUMAIN | documents bureautiques (`consultation.liensFichiers`) : version accessible ou document accessible |
| 13.4 | HUMAIN | pertinence de cette version accessible |
| 13.5 | HUMAIN | contenu cryptique (ASCII art, émoticônes, abréviations) : alternative |
| 13.6 | HUMAIN | pertinence de l'alternative |
| 13.7 | HUMAIN/TEST | aucun flash > 3 Hz, aucun changement brusque de luminosité |
| 13.8 | AUTO/TEST | `presentation.animations` détecte les animations infinies ; vérifier qu'elles sont contrôlables (pause/stop/masquer) |
| 13.9 | AUTO | Trois vérifications : aucune règle `@media (orientation: …)` dans les feuilles chargées, aucun appel à `screen.orientation.lock()` dans le JS du site, puis chargement en portrait (375x812) et en paysage (812x375) avec **comparaison segment par segment** des textes visibles. Ne pas se fier à la longueur totale du texte : elle varie avec les répétitions de carrousel sans qu'aucun contenu ne manque — comparer des ensembles, pas des tailles |
| 13.10 | HUMAIN | gestes complexes (glisser, pincer, tracé) : alternative simple |
| 13.11 | CODE + AUTO | Les écouteurs posés par `addEventListener` ne sont pas inspectables depuis la page : chercher `mousedown`, `pointerdown`, `touchstart`, `MSPointerDown` dans les **fichiers JS écrits par le site** (exclure les bibliothèques minifiées, qui polluent le grep), et les attributs `onmousedown`/`ontouchstart` dans les gabarits. Confirmer ensuite au runtime : envoyer ces événements **seuls**, sans clic ni relâchement, sur un contrôle, un lien et un bouton, puis vérifier qu'aucune action ne s'est produite |
| 13.12 | CODE | fonctionnalités déclenchées par mouvement d'appareil : alternative + désactivation |

## Compte rendu attendu

À la fin de l'audit, annoncer les trois nombres :

- critères tranchés **automatiquement** (niveau AUTO, preuve dans la sonde) ;
- critères tranchés **par réponse de l'utilisateur** ;
- critères laissés **`NOT_TESTED`**, avec pour chacun la raison et la manip à faire.

Un audit où la troisième colonne est vide sur les thématiques 4, 10 et 13 est un audit qui ment.
