/* Sonde RGAA — collecte des preuves dans la page courante. NE JUGE RIEN.
 *
 * A injecter tel quel via mcp__Claude_Browser__javascript_tool (la derniere
 * expression est la valeur retournee). Le jugement critere par critere est fait
 * ensuite, referentiel en main, par les sous-agents.
 *
 * Limites assumees, a lire avant d'interpreter la sortie :
 *  - le nom accessible est une approximation d'accname (aria-labelledby > aria-label
 *    > label/alt/title > texte), pas l'implementation complete de la spec ;
 *  - le contraste n'est calculable que sur fond uni opaque : tout fond image, degrade
 *    ou semi-transparent ressort avec bgUnknown=true et doit etre tranche a l'oeil ;
 *  - tout ce qui demande un jugement humain (pertinence d'un alt, d'un intitule de
 *    lien, d'un titre) n'est PAS evalue ici : le texte est remonte tel quel.
 */
// Double usage : valeur de retour pour javascript_tool, et window.__rgaa si charge via <script src>.
window.__rgaa = (() => {
  const MAX = 250;           // elements remontes par categorie
  const TXT = 160;           // troncature des textes

  const cut = (s, n = TXT) => {
    s = (s ?? "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
  };
  const all = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const cap = (arr) => (arr.length > MAX ? { tronque: arr.length, echantillon: arr.slice(0, MAX) } : arr);

  /** Selecteur CSS court et stable pour retrouver l'element. */
  const path = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      let p = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(p + "#" + n.id); break; }
      const cls = (n.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) p += "." + cls.join(".");
      const sibs = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : [];
      if (sibs.length > 1) p += `:nth-of-type(${sibs.indexOf(n) + 1})`;
      parts.unshift(p);
    }
    return parts.join(" > ");
  };

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  /** Masque aux technologies d'assistance (donc pas de nom accessible requis). */
  const hiddenFromAT = (el) => !!el.closest('[aria-hidden="true"],[hidden]') || !visible(el);

  /** Approximation du nom accessible. Voir limites en tete de fichier. */
  const accName = (el) => {
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
      if (t) return { value: cut(t), from: "aria-labelledby" };
    }
    const lbl = el.getAttribute("aria-label");
    if (lbl?.trim()) return { value: cut(lbl), from: "aria-label" };
    if (el.tagName === "IMG" || el.tagName === "AREA" || el.type === "image") {
      const alt = el.getAttribute("alt");
      if (alt !== null) return { value: cut(alt), from: "alt", vide: alt.trim() === "" };
    }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const lb = (el.labels && el.labels.length)
        ? Array.from(el.labels).map((l) => l.textContent).join(" ")
        : (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null);
      if (lb?.trim()) return { value: cut(lb), from: "label" };
      if (el.getAttribute("placeholder")) return { value: cut(el.getAttribute("placeholder")), from: "placeholder-seul" };
    }
    const svgTitle = el.tagName === "svg" ? el.querySelector(":scope > title")?.textContent : null;
    if (svgTitle?.trim()) return { value: cut(svgTitle), from: "svg>title" };
    const txt = cut(el.textContent);
    if (txt) return { value: txt, from: "contenu" };
    // Conteneur sans texte (lien/bouton icone) : le nom vient du contenu remplace —
    // alt d'une image enfant, aria-label d'un enfant, ou <title> d'un svg enfant.
    const parEnfant = Array.from(el.querySelectorAll("img[alt], [aria-label], svg > title"))
      .map((c) => (c.tagName === "title" ? c.textContent : c.getAttribute("alt") ?? c.getAttribute("aria-label")))
      .filter((v) => v && v.trim()).join(" ");
    if (parEnfant.trim()) return { value: cut(parEnfant), from: "contenu-remplace" };
    const t = el.getAttribute("title");
    if (t?.trim()) return { value: cut(t), from: "title" };
    return { value: "", from: "aucune", vide: true };
  };

  /* --- contraste ------------------------------------------------------- */
  const parseRGB = (c) => {
    const m = (c || "").match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  /** Remonte les ancetres jusqu'a un fond opaque. Signale image/degrade rencontre. */
  const effectiveBg = (el) => {
    for (let n = el; n && n !== document.documentElement.parentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none") return { unknown: true, raison: "background-image/degrade sur " + path(n) };
      const c = parseRGB(s.backgroundColor);
      if (c && c.a === 1) return { color: c };
      if (c && c.a > 0) return { unknown: true, raison: "fond semi-transparent sur " + path(n) };
    }
    return { color: { r: 255, g: 255, b: 255 } };
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };

  /** Ce qui se trouve reellement derriere un texte, dans la pile de rendu. */
  const pileSous = (el) => {
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height) return null;
    const y0 = scrollY;
    scrollTo(0, Math.max(0, y0 + rc.top - innerHeight / 2));
    const r2 = el.getBoundingClientRect();
    const x = Math.min(innerWidth - 2, Math.max(2, r2.left + Math.min(r2.width / 2, 40)));
    const y = Math.min(innerHeight - 2, Math.max(2, r2.top + r2.height / 2));
    const pile = document.elementsFromPoint(x, y);
    scrollTo(0, y0);
    const k = pile.indexOf(el);
    return k < 0 ? null : pile.slice(k + 1);
  };

  /**
   * Contraste d'un texte pose sur une image : on lit les vrais pixels du media sous-jacent
   * et on compose par-dessus les voiles semi-transparents intercales (le classique
   * `rgba(0,0,0,.5)` des bandeaux de carrousel), que la lecture de l'image seule ignore.
   * C'est ce qu'aucune extension de navigateur ne fait : WAVE et axe-core declarent
   * simplement le cas indecidable.
   * ponytail: ne traite que les <img>/<video>/<canvas> de meme origine. Un fond pose en
   * CSS background-image reste indecidable (il faudrait recalculer background-size/position).
   */
  const fondPixels = (el, seuil) => {
    const sous = pileSous(el);
    if (!sous) return { erreur: "element hors pile de rendu" };
    const iFond = sous.findIndex((q) => /^(IMG|CANVAS|VIDEO)$/i.test(q.tagName));
    if (iFond < 0) return { erreur: "aucun media sous le texte" };
    const fond = sous[iFond];
    const voiles = sous.slice(0, iFond)
      .map((q) => parseRGB(getComputedStyle(q).backgroundColor)).filter((c) => c && c.a > 0);
    const composer = (px) => {
      let out = px;
      for (let i = voiles.length - 1; i >= 0; i--) {
        const v = voiles[i];
        out = { r: v.r * v.a + out.r * (1 - v.a), g: v.g * v.a + out.g * (1 - v.a), b: v.b * v.a + out.b * (1 - v.a) };
      }
      return out;
    };
    const fr = fond.getBoundingClientRect();
    const nw = fond.naturalWidth || fond.videoWidth, nh = fond.naturalHeight || fond.videoHeight;
    if (!nw || !nh) return { erreur: "media non charge" };
    let sx = 0, sy = 0, sw = nw, sh = nh;
    if (getComputedStyle(fond).objectFit === "cover") {
      const e = Math.max(fr.width / nw, fr.height / nh);
      sw = fr.width / e; sh = fr.height / e; sx = (nw - sw) / 2; sy = (nh - sh) / 2;
    }
    const cv = document.createElement("canvas");
    cv.width = nw; cv.height = nh;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    try { ctx.drawImage(fond, 0, 0, nw, nh); }
    catch { return { erreur: "media d'un autre domaine, pixels non lisibles" }; }
    const fg = parseRGB(getComputedStyle(el).color);
    const rc = el.getBoundingClientRect();
    const ratios = [];
    for (let i = 0; i < 14; i++) for (let j = 0; j < 7; j++) {
      const cx = rc.left + (rc.width * (i + 0.5)) / 14, cy = rc.top + (rc.height * (j + 0.5)) / 7;
      const x = sx + ((cx - fr.left) / fr.width) * sw, y = sy + ((cy - fr.top) / fr.height) * sh;
      if (x < 0 || y < 0 || x >= nw || y >= nh) continue;
      let d;
      try { d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data; }
      catch { return { erreur: "pixels non lisibles (canvas contamine)" }; }
      ratios.push(ratio(fg, composer({ r: d[0], g: d[1], b: d[2] })));
    }
    if (!ratios.length) return { erreur: "aucun pixel echantillonne" };
    ratios.sort((a, b) => a - b);
    return {
      media: (fond.currentSrc || fond.src || "").split("/").pop().slice(0, 45),
      voiles: voiles.map((v) => `rgba(${v.r},${v.g},${v.b},${v.a})`),
      pixels: ratios.length, ratioMin: ratios[0],
      ratioMedian: ratios[Math.floor(ratios.length / 2)], ratioMax: ratios[ratios.length - 1],
      pctSousSeuil: Math.round((ratios.filter((r) => r < seuil).length / ratios.length) * 100)
    };
  };

  const textNodes = () => {
    const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      if (!n.nodeValue.trim() || !n.parentElement) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TITLE)$/.test(n.parentElement.tagName)) continue;
      if (!visible(n.parentElement)) continue;
      out.push(n);
    }
    return out;
  };

  const contrastes = () => {
    const vus = new Set(), out = [];
    for (const n of textNodes()) {
      const el = n.parentElement, k = path(el);
      if (vus.has(k)) continue;
      vus.add(k);
      const s = getComputedStyle(el);
      const fg = parseRGB(s.color);
      const bg = effectiveBg(el);
      const px = parseFloat(s.fontSize) || 16;
      const poids = parseInt(s.fontWeight, 10) || 400;
      const grand = px >= 24 || (px >= 18.66 && poids >= 700);
      const e = { selecteur: k, texte: cut(n.nodeValue, 60), couleur: s.color, taillePx: px, poids, grandTexte: grand,
                  seuilRequis: grand ? 3 : 4.5 };
      if (bg.unknown) { e.bgUnknown = true; e.raison = bg.raison; }
      else if (fg) { e.fond = `rgb(${bg.color.r}, ${bg.color.g}, ${bg.color.b})`; e.ratio = ratio(fg, bg.color); }
      // Texte superpose. Un titre de carrousel blanc pose sur une <img> SŒUR donne un ratio
      // faux (la chaine d'ancetres ne contient pas l'image). On regarde donc ce qu'il y a
      // reellement DERRIERE le texte dans la pile de rendu, puis on echantillonne les pixels.
      const sous = pileSous(el) ?? [];
      const media = sous.find((q) => /^(IMG|VIDEO|CANVAS|PICTURE|SVG)$/i.test(q.tagName));
      const fondCss = sous.find((q) => { const bi = getComputedStyle(q).backgroundImage; return bi && bi !== "none"; });
      if (media || fondCss) {
        const m = media ? fondPixels(el, e.seuilRequis) : { erreur: "fond pose en CSS background-image" };
        if (m.erreur) {
          e.bgIncertain = true;
          e.raison = (e.raison ? e.raison + " ; " : "") + `texte superpose : ${m.erreur}, mesurer a l'oeil`;
          delete e.ratio; delete e.fond;
        } else {
          // Mesure reelle : le ratio calcule sur le fond CSS etait faux, on le remplace.
          delete e.bgUnknown; delete e.bgIncertain;
          e.mesureSurPixels = m;
          e.ratio = m.ratioMin;                       // pire cas sur la surface du texte
          e.pctPixelsSousSeuil = m.pctSousSeuil;
          e.fond = `pixels de ${m.media}` + (m.voiles.length ? ` compose sous ${m.voiles.join(" + ")}` : "");
        }
      }
      // On ne remonte que ce qui est douteux. Sur un fond mesure au pixel, c'est la part de
      // surface reellement sous le seuil qui decide, pas le seul minimum.
      const echoue = e.mesureSurPixels ? e.pctPixelsSousSeuil > 0 : (e.ratio != null && e.ratio < e.seuilRequis);
      if (e.bgUnknown || e.bgIncertain || echoue) out.push(e);
    }
    return cap(out);
  };

  /**
   * Critere 3.3 — contraste des composants d'interface et des elements graphiques
   * porteurs d'information (seuil 3:1). Un composant est distinguable s'il l'est par sa
   * bordure OU par son fond : on garde donc le meilleur des deux contre l'environnement.
   * ponytail: ne mesure pas le contraste de l'indicateur de focus, qui demande un focus
   * clavier reel (`:focus-visible` ne s'applique pas a un focus pose par script) —
   * ce point reste a verifier a la main.
   */
  const composants = () => {
    const out = [];
    const fondDe = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = parseRGB(getComputedStyle(n).backgroundColor);
        if (c && c.a === 1) return c;
        if (getComputedStyle(n).backgroundImage !== "none") return null;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const sel = 'input:not([type=hidden]),select,textarea,button,[role="button"],[role="checkbox"],[role="switch"],[role="tab"]';
    for (const el of all(sel)) {
      if (!visible(el) || el.disabled) continue;
      const s = getComputedStyle(el);
      const autour = fondDe(el.parentElement);
      const interieur = parseRGB(s.backgroundColor);
      const bordure = parseRGB(s.borderTopColor);
      const aUneBordure = parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none";
      if (!autour) continue;                                   // environnement non calculable
      const cand = [];
      if (aUneBordure && bordure && bordure.a === 1) cand.push({ quoi: "bordure", r: ratio(bordure, autour) });
      if (interieur && interieur.a === 1) cand.push({ quoi: "fond du composant", r: ratio(interieur, autour) });
      if (!cand.length) continue;                              // composant sans limite visible propre
      const meilleur = cand.sort((a, b) => b.r - a.r)[0];
      if (meilleur.r < 3) out.push({
        selecteur: path(el), composant: el.tagName.toLowerCase() + (el.type ? `[${el.type}]` : ""),
        nom: accName(el).value.slice(0, 40), distingueParLe: meilleur.quoi, ratio: meilleur.r, seuilRequis: 3,
        couleurs: cand.map((c) => `${c.quoi} ${c.r}:1`).join(", "),
        environnement: `rgb(${autour.r}, ${autour.g}, ${autour.b})`
      });
    }
    // Icones vectorielles portant une information (dans un lien ou un bouton sans texte).
    for (const el of all("svg")) {
      if (!visible(el)) continue;
      const conteneur = el.closest("a,button");
      if (!conteneur || conteneur.textContent.trim()) continue; // icone accompagnee de texte : decorative
      const s = getComputedStyle(el);
      const trait = parseRGB(s.fill) || parseRGB(s.color);
      const autour = fondDe(el.parentElement);
      if (!trait || !autour || trait.a !== 1) continue;
      const r = ratio(trait, autour);
      if (r < 3) out.push({
        selecteur: path(el), composant: "svg (icone seule dans " + conteneur.tagName.toLowerCase() + ")",
        nom: accName(conteneur).value.slice(0, 40), distingueParLe: "couleur du trace", ratio: r, seuilRequis: 3,
        couleurs: `trace ${s.fill}`, environnement: `rgb(${autour.r}, ${autour.g}, ${autour.b})`
      });
    }
    return cap(out);
  };

  /* --- collectes ------------------------------------------------------- */
  const d = document, de = d.documentElement;

  const images = cap([
    ...all("img"), ...all("svg"), ...all('input[type="image"]'), ...all("area"),
    ...all('[role="img"]'), ...all("object[type^='image']"), ...all("canvas")
  ].map((el) => ({
    selecteur: path(el), balise: el.tagName.toLowerCase(), role: el.getAttribute("role"),
    src: cut(el.currentSrc || el.getAttribute("src") || el.getAttribute("data") || "", 120),
    alt: el.hasAttribute("alt") ? el.getAttribute("alt") : null,
    hasAlt: el.hasAttribute("alt"), ariaLabel: el.getAttribute("aria-label"),
    ariaLabelledby: el.getAttribute("aria-label" + "ledby"), title: el.getAttribute("title"),
    longdesc: el.getAttribute("longdesc"), ariaDescribedby: el.getAttribute("aria-describedby"),
    dansLien: !!el.closest("a,button"), texteDuLienParent: cut(el.closest("a,button")?.textContent ?? "", 80),
    masqueAT: hiddenFromAT(el), nomAccessible: accName(el),
    // Une image decorative dans un lien vide laisse le lien sans nom : cas classique.
    contexte: cut(el.parentElement?.textContent ?? "", 100)
  })));

  const titres = all("h1,h2,h3,h4,h5,h6,[role=heading]").map((el) => ({
    selecteur: path(el),
    niveau: el.getAttribute("aria-level") ? +el.getAttribute("aria-level") : +(el.tagName[1] || 0),
    balise: el.tagName.toLowerCase(), texte: cut(el.textContent), visible: visible(el)
  }));

  const liensRaw = all("a").map((el) => ({
    selecteur: path(el), href: cut(el.getAttribute("href") || "", 120),
    texte: cut(el.textContent), nomAccessible: accName(el), title: el.getAttribute("title"),
    cible: el.getAttribute("target"), contenuImageSeule: !el.textContent.trim() && !!el.querySelector("img,svg"),
    contexteParent: cut(el.parentElement?.textContent ?? "", 120),
    ouvreFichier: /\.(pdf|docx?|xlsx?|pptx?|zip|odt|ods|csv)(\?|$)/i.test(el.getAttribute("href") || ""),
    // Critere 6.1 : un intitule de cette liste n'est pas explicite hors contexte. Il n'est
    // conforme que si un title, un aria-label ou un texte masque vient le completer.
    intituleNonExplicite: /^(en savoir plus|lire la suite|cliquez ici|cliquer ici|ici|voir|voir plus|découvrir|telecharger|télécharger|plus|suite|read more|more|…|\.\.\.|>|<|»|«)$/i
      .test(cut(el.textContent, 40)) && !el.getAttribute("title") && !el.getAttribute("aria-label") && !el.querySelector(".sr-only")
  }));
  const liens = cap(liensRaw);

  const champs = all("input,select,textarea").filter((el) => el.type !== "hidden").map((el) => ({
    selecteur: path(el), balise: el.tagName.toLowerCase(), type: el.type,
    id: el.id || null, name: el.name || null, required: el.required, autocomplete: el.getAttribute("autocomplete"),
    nomAccessible: accName(el),
    labelPour: el.id ? !!d.querySelector(`label[for="${CSS.escape(el.id)}"]`) : false,
    labelEnglobant: !!el.closest("label"), placeholder: el.getAttribute("placeholder"),
    ariaDescribedby: el.getAttribute("aria-describedby"), ariaInvalid: el.getAttribute("aria-invalid"),
    fieldset: !!el.closest("fieldset"),
    legend: cut(el.closest("fieldset")?.querySelector("legend")?.textContent ?? "", 80)
  }));

  const tableaux = all("table").map((el) => {
    // Une matrice a double entree se reconnait a ses cellules de corps quasi vides
    // (croix, tirets, chiffres) : chacune depend alors de sa ligne ET de sa colonne,
    // donc la premiere colonne doit etre en-tete de ligne. Sans cela, critere 5.6 en echec.
    // Les lignes de corps : celles du tbody, ou toutes sauf la premiere s'il n'y a pas de thead.
    // Piege : el.rows inclut les lignes du thead, les inclure fait rater le defaut.
    const lignesCorps = el.tBodies.length
      ? Array.from(el.tBodies).flatMap((b) => Array.from(b.rows))
      : Array.from(el.rows).slice(1);
    const premieresCellules = lignesCorps.map((r) => r.cells[0]).filter(Boolean);
    const cellulesInternes = lignesCorps.flatMap((r) => Array.from(r.cells).slice(1));
    const marques = cellulesInternes.filter((c) => /^[\s✓✔x×•·\-–—o0-9]*$/.test(c.textContent.trim())).length;
    const matrice = cellulesInternes.length > 3 && marques / cellulesInternes.length > 0.6;
    return {
      selecteur: path(el), role: el.getAttribute("role"),
      caption: cut(el.querySelector("caption")?.textContent ?? ""), summary: el.getAttribute("summary"),
      lignes: el.rows.length, colonnes: el.rows[0]?.cells.length ?? 0,
      th: el.querySelectorAll("th").length,
      thEnTetesColonnes: el.querySelectorAll("thead th").length,
      thEnTetesLignes: el.querySelectorAll('th[scope="row"], tbody th').length,
      thSansScope: all("th", el).filter((t) => !t.getAttribute("scope") && !t.id).length,
      cellulesAvecHeaders: all("td", el).filter((t) => t.getAttribute("headers")).length,
      matriceADoubleEntree: matrice,
      // 5.6 : sur une matrice, des libelles de ligne en <td> = en-tetes de lignes non declares
      enTetesLignesManquants: matrice && premieresCellules.every((c) => c.tagName === "TD"),
      misEnForme: !el.querySelector("th") && !el.querySelector("caption"),
      apercu: cut(el.textContent, 200)
    };
  });

  const media = all("video,audio,object,embed,iframe").filter((el) =>
    /video|audio|object|embed/i.test(el.tagName) ||
    /youtube|vimeo|dailymotion|soundcloud|player/i.test(el.getAttribute("src") || "")
  ).map((el) => ({
    selecteur: path(el), balise: el.tagName.toLowerCase(),
    src: cut(el.currentSrc || el.getAttribute("src") || el.getAttribute("data") || "", 160),
    title: el.getAttribute("title"), ariaLabel: el.getAttribute("aria-label"),
    controls: el.hasAttribute("controls"), autoplay: el.hasAttribute("autoplay"),
    muted: el.muted === true, loop: el.hasAttribute("loop"),
    pistes: all("track", el).map((t) => ({ kind: t.kind, label: t.label, srclang: t.srclang, src: cut(t.src, 80) })),
    dureeS: Number.isFinite(el.duration) ? Math.round(el.duration) : null,
    // Un lecteur servi depuis un autre domaine (YouTube, Vimeo, Dailymotion) est une boite noire :
    // son DOM n'est pas lisible, et les criteres 4.11 (controles au clavier) et 4.13 (compatibilite
    // avec les technologies d'assistance) portent sur un composant que le site n'ecrit pas lui-meme.
    // Ce qu'on peut etablir depuis la page : que le cadre est bien dans l'ordre de tabulation.
    origineTierce: (() => {
      const s = el.getAttribute("src") || "";
      try { return new URL(s, location.href).origin !== location.origin; } catch { return false; }
    })(),
    dansOrdreTabulation: el.tagName === "IFRAME" && el.tabIndex >= 0
  }));

  const cadres = all("iframe,frame").map((el) => ({
    selecteur: path(el), src: cut(el.getAttribute("src") || "", 160),
    title: el.getAttribute("title"), ariaLabel: el.getAttribute("aria-label"),
    masqueAT: hiddenFromAT(el)
  }));

  const langues = cap(all("[lang]").filter((el) => el !== de).map((el) => ({
    selecteur: path(el), lang: el.getAttribute("lang"), texte: cut(el.textContent, 80)
  })));

  const focusablesRaw = all(
    'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"],summary'
  ).filter(visible).map((el, i) => ({
    ordre: i, selecteur: path(el), balise: el.tagName.toLowerCase(),
    tabindex: el.getAttribute("tabindex"), role: el.getAttribute("role"),
    nomAccessible: accName(el), disabled: el.disabled === true
  }));

  // Composants "faits main" : cliquables sans role ni acces clavier.
  const fauxBoutons = cap(all("[onclick],[data-toggle],[data-target]").filter((el) =>
    !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) &&
    !el.getAttribute("role") && el.getAttribute("tabindex") === null && visible(el)
  ).map((el) => ({ selecteur: path(el), balise: el.tagName.toLowerCase(), texte: cut(el.textContent, 80) })));

  const ariaCustom = cap(all("[role]").filter((el) =>
    /button|link|checkbox|radio|tab|tablist|tabpanel|dialog|menu|menuitem|combobox|listbox|option|slider|switch|tree/.test(el.getAttribute("role"))
  ).map((el) => ({
    selecteur: path(el), role: el.getAttribute("role"), tabindex: el.getAttribute("tabindex"),
    nomAccessible: accName(el),
    etats: Object.fromEntries(Array.from(el.attributes)
      .filter((a) => /^aria-/.test(a.name)).map((a) => [a.name, a.value]))
  })));

  /**
   * Criteres 7.1 et 7.3 — composants pilotes par script. On les inventorie par leur role de
   * widget OU par un marqueur de comportement (data-toggle, data-slide, aria-expanded…), puis
   * on verifie ce que le test 7.1.3 exige : un nom accessible, un role, et un nom qui contient
   * l'intitule visible. Un composant sans role ni balise native ET non focusable echoue aussi 7.3.
   */
  const composantsScriptes = () => {
    const sel = '[role=button],[role=tab],[role=tablist],[role=tabpanel],[role=dialog],[role=menu],' +
      '[role=menuitem],[role=combobox],[role=listbox],[role=switch],[role=checkbox],[role=slider],' +
      '[data-toggle],[data-slide],[data-slide-to],[data-target],[aria-expanded],[aria-controls],[onclick],' +
      '.slick-arrow,.slick-dots li,.carousel-control-prev,.carousel-control-next,.carousel-indicators li';
    return cap(all(sel).filter(visible).map((el) => {
      const n = accName(el);
      const vu = cut(el.textContent, 40);
      const natif = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName);
      return {
        selecteur: path(el), balise: el.tagName.toLowerCase(), role: el.getAttribute("role"),
        nomAccessible: n, intituleVisible: vu,
        nomContientIntitule: !vu || n.value.toLowerCase().includes(vu.toLowerCase()),
        baliseNative: natif, focusable: el.tabIndex >= 0,
        // Un div/li/span porteur d'un comportement, sans role et hors clavier : echoue 7.1.3 et 7.3.
        inactionnableAuClavier: !natif && !el.getAttribute("role") && el.tabIndex < 0,
        etats: Object.fromEntries(Array.from(el.attributes)
          .filter((a) => /^aria-(expanded|selected|pressed|checked|controls|current|haspopup|live)$/.test(a.name))
          .map((a) => [a.name, a.value]))
      };
    }));
  };

  /**
   * Critere 8.9 — balises detournees a des fins de presentation. Le signal le plus sur est
   * la balise de titre sans contenu : un titre qui ne titre rien n'est la que pour son rendu.
   * Les paragraphes vides sont remontes a part : ils meritent un nettoyage mais ne detournent
   * aucune semantique et ne sont pas restitues, donc ils ne suffisent pas a conclure.
   */
  const balisesDetournees = () => ({
    titresVides: all("h1,h2,h3,h4,h5,h6").filter((h) => !h.textContent.trim() && !h.querySelector("img,svg"))
      .map((h) => ({ selecteur: path(h), balise: h.tagName.toLowerCase(), visible: visible(h) })),
    paragraphesVides: all("p").filter((p) => !p.textContent.trim() && !p.querySelector("img,svg,input,br")).length,
    brConsecutifs: all("br").filter((b) => {
      let n = b.nextSibling;
      while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.nextSibling;
      return n && n.nodeType === 1 && n.tagName === "BR";
    }).length,
    balisesObsoletes: all("font,center,big,small,tt,strike,u,marquee,blink,basefont")
      .map((e) => ({ selecteur: path(e), balise: e.tagName.toLowerCase() })),
    citationsSansCite: all("blockquote,q").filter((e) => !e.getAttribute("cite")).length,
    listesUnSeulItem: all("ul,ol").filter((l) => l.querySelectorAll(":scope > li").length === 1).length
  });

  /**
   * Critere 8.7 — changements de langue non signales. Heuristique : on confronte chaque nœud de
   * texte a deux lexiques de mots outils, anglais et français, **prives de leur intersection** —
   * sans cela un mot ambigu comme « a » (article anglais, verbe français) fait rater le defaut.
   * La sonde propose des candidats ; le tri entre vrai changement de langue et terme metier
   * lexicalise (cas particulier du critere) reste un jugement a porter sur la sortie.
   */
  const languesSuspectes = () => {
    const EN = new Set("the and of to in for with you your our we is are this that on by from new window learn read more all about see click here download how what why when who home page site web contact us services products team news".split(" "));
    const FR = new Set("le la les des du de et a pour dans un une au aux en sur par nos notre votre vos plus avec est sont ce cette ses son leur tous toute nous vous qui que quoi web services".split(" "));
    for (const m of EN) if (FR.has(m)) { EN.delete(m); FR.delete(m); }
    const out = [];
    for (const n of textNodes()) {
      const t = cut(n.nodeValue, 90);
      if (t.split(" ").length < 3) continue;
      const p = n.parentElement;
      const porteur = p.closest("[lang]");
      if (porteur && porteur !== de) continue;                 // deja signale par un lang
      const mots = t.toLowerCase().replace(/[^a-zà-ÿ' ]/g, " ").split(/\s+/).filter(Boolean);
      const en = new Set(mots.filter((m) => EN.has(m)));
      const fr = mots.filter((m) => FR.has(m)).length;
      if (en.size >= 2 && en.size > fr) out.push({ selecteur: path(p), texte: t, motsAnglais: [...en].join(","), visible: visible(p) });
    }
    return cap(out);
  };

  /**
   * Thematique 10 — presentation. Tout ce qui se mesure sans redimensionner la fenetre.
   * Les criteres 10.4 (zoom 200 %), 10.11 (reflow 320 px) et 10.12 (espacement du texte)
   * demandent un viewport different : ils se jouent depuis la skill, pas ici.
   */
  const presentation10 = () => {
    const regles = () => Array.from(d.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules); } catch { return []; } });
    const ATTRS = ["align", "valign", "bgcolor", "background", "border", "cellpadding", "cellspacing",
                   "hspace", "vspace", "nowrap", "frameborder", "marginwidth", "marginheight"];

    // 10.1 — attributs de presentation (les balises sont dans balisesDetournees)
    const attributsPresentation = ATTRS.flatMap((a) =>
      all("[" + a + "]").map((e) => ({ selecteur: path(e), attribut: a, valeur: cut(e.getAttribute(a), 20) })));

    // 10.2 — texte injecte par un pseudo-element, qui disparaitrait sans CSS
    const texteParCss = regles().filter((r) => r.selectorText && /::?(before|after)/.test(r.selectorText))
      .map((r) => ({ selecteur: cut(r.selectorText, 60), content: r.style && r.style.content }))
      .filter((x) => x.content && x.content !== "none" && !/^["']\s*["']$/.test(x.content) && /[a-zA-ZÀ-ÿ]{3,}/.test(x.content))
      // Une regle qui ne correspond a aucun element de la page ne retire rien : on l'ecarte.
      .filter((x) => { try { return !!d.querySelector(x.selecteur.replace(/::?(before|after)[a-z-]*/g, "")); } catch { return false; } });

    // 10.3 — blocs sortis du flux : sans CSS ils reviennent a leur place DOM
    const horsFlux = cap(all("*").filter((e) => {
      const s = getComputedStyle(e);
      return (s.position === "absolute" || s.position === "fixed") && visible(e) && e.textContent.trim().length > 25;
    }).map((e) => ({ selecteur: path(e), position: getComputedStyle(e).position, texte: cut(e.textContent, 45) })));

    // 10.5 — on ne compte que les regles qui s'appliquent vraiment a un element de la page
    let colorSansFond = 0, fondSansColor = 0; const exemples = [];
    for (const r of regles()) {
      if (!r.style || !r.selectorText) continue;
      const c = r.style.getPropertyValue("color");
      const b = r.style.getPropertyValue("background-color") || r.style.getPropertyValue("background");
      if (!c && !b) continue;
      let applique = false;
      try { applique = !!d.querySelector(r.selectorText.replace(/::?(before|after|hover|focus|active|visited|focus-within|focus-visible)[a-z-]*/g, "")); } catch { applique = false; }
      if (!applique) continue;
      if (c && !b) { colorSansFond++; if (exemples.length < 8) exemples.push(cut(r.selectorText, 45)); }
      if (b && !c && !/^(none|transparent|inherit)/.test(b.trim())) { fondSansColor++; if (exemples.length < 8) exemples.push(cut(r.selectorText, 45)); }
    }

    // 10.6 — un lien "au sein d'un texte" a du texte propre autour de lui, hors navigation
    const texteProprE = (p) => Array.from(p.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(" ").trim();
    const liensDansTexte = all("p a, td a, blockquote a, li a").filter((a) =>
      visible(a) && !a.closest("nav,[role=navigation],footer") && texteProprE(a.parentElement).length > 3
    ).map((a) => {
      const sa = getComputedStyle(a), sp = getComputedStyle(a.parentElement);
      const ca = parseRGB(sa.color), cp = parseRGB(sp.color);
      const souligne = /underline/.test(sa.textDecorationLine) && !/underline/.test(sp.textDecorationLine);
      const graisse = parseInt(sa.fontWeight, 10) > parseInt(sp.fontWeight, 10);
      const bordure = parseFloat(sa.borderBottomWidth) > 0;
      const r = ca && cp ? ratio(ca, cp) : null;
      return { selecteur: path(a), texte: cut(a.textContent, 30), souligne, graisse, bordure, contrasteAvecTexte: r,
               distingue: souligne || graisse || bordure || (r !== null && r >= 3) || (ca && cp && ca.r === cp.r && ca.g === cp.g && ca.b === cp.b) };
    });

    // 10.8 — focusable mais non rendu : c'est elementFromPoint qui tranche, pas la boite
    const focusableNonRendu = cap(all('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').filter((e) => {
      if (e.tabIndex < 0) return false;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.display === "none" || ps.visibility === "hidden") return false;
      }
      if (e.closest('[aria-hidden="true"]')) return true;
      const r0 = e.getBoundingClientRect();
      if (!r0.width || !r0.height) return true;
      const y0 = scrollY;
      scrollTo(0, Math.max(0, y0 + r0.top - innerHeight / 2));
      const r = e.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, Math.max(2, r.left + Math.min(r.width / 2, 30)));
      const y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
      const top = d.elementFromPoint(x, y);
      scrollTo(0, y0);
      return !(top && (top === e || e.contains(top) || top.contains(e)));
    }).map((e) => ({ selecteur: path(e), nom: accName(e).value.slice(0, 40) })));

    // 10.10 — consignes sensorielles
    const SENS = /\b(ci-dessous|ci-dessus|ci-contre|à droite|à gauche|en haut|en bas|le bouton (vert|rouge|bleu|jaune|orange)|en rouge|en vert|encadré|colonne de (droite|gauche))\b/i;
    const indicationsSensorielles = textNodes().map((n) => ({ n, t: cut(n.nodeValue, 80) }))
      .filter((x) => x.t.length > 8 && SENS.test(x.t))
      .map((x) => ({ selecteur: path(x.n.parentElement), expression: x.t.match(SENS)[0], texte: x.t }));

    // 10.13 / 10.14 — contenus reveles au survol, et equivalent au focus ou non
    const REVELE = /display\s*:\s*(block|flex|grid|inline)|visibility\s*:\s*visible|opacity\s*:\s*1|max-height\s*:\s*(?!0)|height\s*:\s*(?!0)/;
    const auFocus = new Set(), auSurvol = [];
    for (const r of regles()) {
      if (!r.selectorText) continue;
      if (/:focus(-within)?/.test(r.selectorText) && REVELE.test(r.cssText))
        r.selectorText.split(",").forEach((s) => auFocus.add(s.replace(/:focus(-within)?/g, "").trim()));
      if (/:hover/.test(r.selectorText) && REVELE.test(r.cssText)) auSurvol.push(r.selectorText);
    }
    const survolSansEquivalentFocus = auSurvol.filter((h) =>
      !h.split(",").every((s) => auFocus.has(s.replace(/:hover/g, "").trim()))).slice(0, 10);

    return { attributsPresentation: cap(attributsPresentation), texteParCss, horsFlux,
             couleursDeclareesSeparement: { colorSansFond, fondSansColor, exemples },
             liensDansTexte, focusableNonRendu, indicationsSensorielles: cap(indicationsSensorielles),
             survolRevelant: auSurvol.length, survolSansEquivalentFocus };
  };

  const bodyStyle = getComputedStyle(d.body);
  const skipLinks = all('a[href^="#"]').slice(0, 10).filter((a) =>
    /aller|contenu|skip|navigation|menu|main/i.test(a.textContent + (a.getAttribute("aria-label") || ""))
  ).map((a) => {
    const href = a.getAttribute("href");
    let cible = false;
    try { cible = href.length > 1 && !!d.querySelector(href); } catch { cible = false; }
    return { texte: cut(a.textContent), href, cibleExiste: cible, visibleAuChargement: visible(a),
             premierFocusable: focusablesRaw[0]?.selecteur === path(a) };
  });

  // Feuilles de style desactivees : l'ordre du contenu doit rester coherent.
  const ordreSansCss = textNodes().slice(0, 60).map((n) => cut(n.nodeValue, 40));

  return {
    _sonde: "rgaa-probe/1", _limites: "voir en-tete probe.js : accname approxime, contraste non calculable sur fond image/degrade, aucune pertinence editoriale evaluee",
    url: location.href, titre: d.title, horodatage: new Date().toISOString(),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },

    document: {
      doctype: d.doctype ? d.doctype.name : null,
      lang: de.getAttribute("lang"), xmlLang: de.getAttribute("xml:lang"), dir: de.getAttribute("dir"),
      charset: d.characterSet,
      metaViewport: d.querySelector('meta[name="viewport"]')?.content ?? null,
      metaRefresh: d.querySelector('meta[http-equiv="refresh" i]')?.content ?? null,
      idsDupliques: (() => {
        const m = {}, dup = [];
        for (const el of all("[id]")) (m[el.id] = (m[el.id] || 0) + 1) === 2 && dup.push(el.id);
        return dup.slice(0, 50);
      })()
    },

    structure: {
      titres, nbH1: titres.filter((t) => t.niveau === 1).length,
      landmarks: all("header,nav,main,footer,aside,section,form,[role]").filter((el) =>
        /banner|navigation|main|contentinfo|complementary|search|form|region/.test(
          el.getAttribute("role") || { HEADER: "banner", NAV: "navigation", MAIN: "main", FOOTER: "contentinfo", ASIDE: "complementary" }[el.tagName] || "")
      ).map((el) => ({ selecteur: path(el), balise: el.tagName.toLowerCase(),
                       role: el.getAttribute("role"), nomAccessible: accName(el).value.slice(0, 60) })),
      nbListes: all("ul,ol,dl").length,
      listesFactices: cap(textNodes().filter((n) => /^\s*[-•*–]\s+\S/.test(n.nodeValue) && !n.parentElement.closest("li"))
        .map((n) => ({ selecteur: path(n.parentElement), texte: cut(n.nodeValue, 60) }))),
      citations: all("blockquote,q").map((el) => ({ selecteur: path(el), cite: el.getAttribute("cite"), texte: cut(el.textContent, 80) })),
      ordreLectureDom: ordreSansCss
    },

    images, liens, champs, tableaux, media, cadres, langues,
    balisesDetournees: balisesDetournees(),
    languesSuspectes: languesSuspectes(),
    formulaires: all("form").map((el) => ({ selecteur: path(el), action: cut(el.getAttribute("action") || "", 100),
                                            methode: el.method, nbChamps: el.elements.length,
                                            bouton: cut(el.querySelector('[type="submit"],button')?.textContent ?? "", 60) })),

    scripts: { fauxBoutons, ariaCustom, composantsScriptes: composantsScriptes(),
               ordreTabulation: cap(focusablesRaw),
               tabindexPositif: focusablesRaw.filter((f) => +f.tabindex > 0),
               nbHandlersInline: all("[onclick],[onmouseover],[onchange],[onkeydown]").length },

    navigation: {
      skipLinks,
      nbLiensNav: all("nav a").length,
      planDuSite: all("a").some((a) => /plan du site|sitemap/i.test(a.textContent)),
      recherche: all('input[type="search"],[role="search"]').length > 0,
      pagesObligatoires: Object.fromEntries(
        [["mentions", /mentions l[ée]gales/i], ["accessibilite", /accessibilit[ée]/i], ["contact", /contact/i], ["aide", /aide|faq/i]]
          .map(([k, re]) => [k, all("a").filter((a) => re.test(a.textContent)).map((a) => cut(a.getAttribute("href") || "", 80))[0] ?? null])
      )
    },

    presentation: {
      texteJustifie: cap(all("*").filter((el) => getComputedStyle(el).textAlign === "justify" && el.textContent.trim())
        .map((el) => ({ selecteur: path(el) }))),
      focusSupprime: cap(Array.from(d.styleSheets).flatMap((ss) => {
        try { return Array.from(ss.cssRules); } catch { return []; }
      }).filter((r) => r.selectorText && /:focus/.test(r.selectorText) && /outline\s*:\s*(none|0)/.test(r.cssText))
        .map((r) => r.selectorText)),
      ...presentation10(),
      lineHeightBody: bodyStyle.lineHeight, fontSizeBody: bodyStyle.fontSize,
      animations: cap(all("*").filter((el) => {
        const s = getComputedStyle(el);
        return (s.animationName !== "none" && parseFloat(s.animationDuration) > 0 && s.animationIterationCount === "infinite");
      }).map((el) => ({ selecteur: path(el), duree: getComputedStyle(el).animationDuration }))),
      scrollHorizontal: de.scrollWidth > innerWidth + 2,
      largeurDocument: de.scrollWidth
    },

    couleurs: { contrastesDouteux: contrastes(),
                composantsSousSeuil: composants(),
                indicationParCouleurSeule: "non evaluable automatiquement — verifier a l'oeil les consignes du type « champs en rouge »" },

    consultation: {
      liensFichiers: liensRaw.filter((l) => l.ouvreFichier).map((l) => ({ texte: l.texte, href: l.href })),
      nouvelleFenetre: liensRaw.filter((l) => l.cible === "_blank").map((l) => ({ texte: l.texte, nomAccessible: l.nomAccessible.value })),
      abbr: all("abbr,acronym").map((el) => ({ texte: cut(el.textContent, 40), title: el.getAttribute("title") })),
      limiteTemps: "non evaluable automatiquement — verifier session/carrousel/redirection"
    }
  };
})()
