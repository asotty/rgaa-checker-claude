/* Rapport RGAA : markdown -> HTML mis en forme, converti ensuite en .docx par LibreOffice.
   Usage : node rapport-docx.js <rapport.md> <sortie.html>
   Puis : soffice --headless --convert-to 'docx:MS Word 2007 XML' --outdir <dir> <sortie.html>

   Deux pieges appris a la dure :
   - LibreOffice ignore width:100% en CSS sur les tables. Utiliser l attribut HTML width et un
     <colgroup>, sinon les tableaux sont ecrases sur un tiers de la page.
   - page-break-after sur une div n est pas respecte : poser un <p style="page-break-before:always">.
   Et lancer soffice depuis un chemin sans nom court Windows (~1), sinon il ne charge pas le fichier. */
const fs = require("fs");
const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) { console.error("usage: node rapport-docx.js <rapport.md> <sortie.html>"); process.exit(1); }

const JAUNE = "#FEDA00", GRIS = "#626B69", ENCRE = "#1A1A1A", CLAIR = "#F6F6F4", BORD = "#D9D9D9";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* markdown en ligne */
function inline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#0B5FA5">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, '<span style="font-family:Consolas,monospace;font-size:9pt;color:#8A3B00">$1</span>');
}
const cellules = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

const md = fs.readFileSync(SRC, "utf8").split("\n");
const h = [];
let i = 0;
while (i < md.length) {
  const l = md[i];
  if (!l.trim()) { i++; continue; }
  // Le titre et les lignes de metadonnees figurent deja sur la page de garde. Les ignorer
  // partout dans le flux : une ligne vide les separe du titre, une boucle immediate les raterait.
  if (/^# /.test(l) || l.startsWith("**Date") || l.startsWith("**Échantillon")) { i++; continue; }
  if (/^---+$/.test(l)) { h.push(`<p style="border-bottom:1.5pt solid ${JAUNE};margin:14pt 0 14pt 0">&nbsp;</p>`); i++; continue; }
  if (/^## /.test(l)) { h.push(`<h1 style="font-size:17pt;color:${ENCRE};margin:22pt 0 8pt 0;page-break-after:avoid">${inline(l.slice(3))}</h1>`); i++; continue; }
  if (/^### /.test(l)) { h.push(`<h2 style="font-size:13pt;color:${GRIS};margin:16pt 0 6pt 0;page-break-after:avoid">${inline(l.slice(4))}</h2>`); i++; continue; }
  if (/^\|/.test(l)) {
    const bloc = []; while (i < md.length && /^\|/.test(md[i])) bloc.push(md[i++]);
    const ent = cellules(bloc[0]), corps = bloc.slice(2).map(cellules);
    const th = ent.map((c) => `<th style="background-color:${JAUNE};border:0.5pt solid ${BORD};padding:5pt 7pt;text-align:left;font-size:9.5pt">${inline(c)}</th>`).join("");
    const tr = corps.map((r, n) => "<tr>" + r.map((c) =>
      `<td style="border:0.5pt solid ${BORD};padding:5pt 7pt;font-size:9.5pt;background-color:${n % 2 ? CLAIR : "#FFFFFF"}">${inline(c)}</td>`).join("") + "</tr>").join("");
    const larg = ent.length===2 ? ["34%","66%"] : ent.map(()=>Math.round(100/ent.length)+"%");
    const cols = "<colgroup>"+larg.map(w=>`<col width="${w}">`).join("")+"</colgroup>";
    // Un tableau markdown peut n'avoir que des en-tetes vides (| | |) : la bande jaune serait alors
    // une barre sans texte. On la supprime dans ce cas.
    const ligneEntete = ent.some((c) => c.trim()) ? `<tr>${th}</tr>` : "";
    h.push(`<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:6pt 0 14pt 0;table-layout:fixed">${cols}${ligneEntete}${tr}</table>`);
    continue;
  }
  if (/^> /.test(l)) {
    const bloc = []; while (i < md.length && /^> ?/.test(md[i])) bloc.push(md[i++].replace(/^> ?/, ""));
    h.push(`<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:8pt 0 14pt 0"><colgroup><col width="1%"><col width="99%"></colgroup><tr>
      <td style="width:4pt;background-color:${JAUNE};padding:0">&nbsp;</td>
      <td style="background-color:${CLAIR};padding:8pt 12pt;font-size:10pt">${inline(bloc.join(" "))}</td></tr></table>`);
    continue;
  }
  if (/^[-*] /.test(l)) {
    const items = []; while (i < md.length && /^[-*] /.test(md[i])) items.push(md[i++].slice(2));
    h.push("<ul style=\"margin:4pt 0 12pt 0\">" + items.map((t) => `<li style="font-size:10.5pt;margin-bottom:3pt">${inline(t)}</li>`).join("") + "</ul>");
    continue;
  }
  // Progression garantie : on prend toujours au moins la ligne courante. Sans cela, une ligne
  // commencant par #, -, * ou | sans correspondre a aucun motif ne serait jamais consommee.
  const p = [md[i++]];
  while (i < md.length && md[i].trim() && !/^(#{1,6} |[|>]|[-*] |---+$)/.test(md[i])) p.push(md[i++]);
  h.push(`<p style="font-size:10.5pt;text-align:justify;margin:0 0 9pt 0;line-height:1.35">${inline(p.join(" "))}</p>`);
}

/* La page de garde se remplit depuis le rapport lui-meme : rien n'est code en dur ici.
   - le domaine vient du titre « # Audit RGAA 4.1 — <domaine> »
   - date, referentiel et echantillon viennent des lignes **Date** / **Échantillon**
   - les chiffres viennent du premier tableau a deux colonnes du rapport             */
const brut = fs.readFileSync(SRC, "utf8");
const sansBalise = (t) => t.replace(/\*\*/g, "").replace(/`/g, "").trim();
const titre = (brut.match(/^#\s+(.+)$/m) || [, "Audit RGAA"])[1];
// Ne couper que sur un tiret separateur entoure d'espaces : sans cela « eurogerm-france.com »
// serait tronque en « france.com ».
const domaine = sansBalise(titre.split(/\s[—–-]\s/).pop() || titre);

const meta = {};
for (const m of brut.matchAll(/\*\*([^*]+)\*\*\s*:\s*([^·\n]+)/g)) meta[sansBalise(m[1])] = sansBalise(m[2]);

const faits = [];
const tableauSynthese = brut.match(/\n\|[^\n]*\|\n\|[-: |]+\|\n((?:\|[^\n]*\|\n)+)/);
if (tableauSynthese) {
  for (const ligne of tableauSynthese[1].trim().split("\n")) {
    const c = ligne.replace(/^\||\|$/g, "").split("|").map((x) => sansBalise(x));
    if (c.length === 2 && c[0] && c[1]) faits.push([c[0], c[1]]);
  }
}
for (const k of ["Référentiel", "Échantillon", "Date", "Auditeur", "Type"])
  if (meta[k]) faits.push([k, meta[k]]);
faits.push(["Outil", "Ara — ara.numerique.gouv.fr"]);

const garde = `
<div style="page-break-after:always">
  <p style="margin-top:120pt;font-size:12pt;color:${GRIS};letter-spacing:2pt"><b>AUDIT D'ACCESSIBILITÉ</b></p>
  <p style="font-size:40pt;color:${ENCRE};margin:0"><b>RGAA 4.1</b></p>
  <p style="border-bottom:3pt solid ${JAUNE};margin:6pt 0 26pt 0">&nbsp;</p>
  <p style="font-size:22pt;color:${ENCRE};margin:0 0 34pt 0"><b>${esc(domaine)}</b></p>
  <table width="640" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed"><colgroup><col width="250"><col width="390"></colgroup>
   ${faits.map(([k, v]) => `<tr>
     <td width="250" style="padding:5pt 0;font-size:10pt;color:${GRIS}">${esc(k)}</td>
     <td width="390" style="padding:5pt 0;font-size:10pt;color:${ENCRE}"><b>${esc(v)}</b></td></tr>`).join("")}
  </table>
</div>`;

fs.writeFileSync(OUT, `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title></head>
<body style="font-family:Calibri,sans-serif;color:${ENCRE}">
${garde}
<p style="page-break-before:always;margin:0;font-size:1pt">&nbsp;</p>
${h.join("\n")}
</body></html>`, "utf8");
console.log("HTML ecrit :", OUT, "(" + Math.round(fs.statSync(OUT).size / 1024) + " Ko,", h.length, "blocs)");
