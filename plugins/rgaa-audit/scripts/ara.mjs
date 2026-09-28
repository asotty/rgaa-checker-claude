#!/usr/bin/env node
// Client Ara (https://ara.numerique.gouv.fr). Node >= 18, zero dependance.
// Le uniqueId est le secret d'ecriture de l'audit : ne jamais le logguer ni le commiter.
//
//   node ara.mjs get     <uniqueId>              -> meta + pages (id, name, url, slug)
//   node ara.mjs results <uniqueId> [topic]      -> resultats stockes (filtre thematique optionnel)
//   node ara.mjs push    <uniqueId> <file.json>  -> PATCH /results par lots, puis verification
//   node ara.mjs verify  <uniqueId> <file.json>  -> diff intention vs stocke, sans ecrire
//   node ara.mjs create  <file.json>             -> POST /audits, imprime l'URL d'edition
//   node ara.mjs upload  <uniqueId> <topic> <criterium> <pageId> <image>
//   node ara.mjs publish <uniqueId>
//
// Format de <file.json> pour push/verify : soit un tableau d'items, soit { data: [ ... ] }.
// Item = { pageId, topic, criterium, status, compliantComment?, notApplicableComment?,
//          notCompliantItems?: [{ title?, comment?, userImpact?, quickWin? }] }

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const BASE = process.env.ARA_BASE_URL ?? "https://ara.numerique.gouv.fr/api";
const STATUSES = ["COMPLIANT", "NOT_COMPLIANT", "NOT_APPLICABLE", "NOT_TESTED"];
const IMPACTS = ["MINOR", "MAJOR", "BLOCKING"];
// Ara coupe la requete a ~5 s : les 500 observes tombent tous a 5,2 s pile, quel que soit le
// nombre d items. Mesure contre la production : 50 et 40 echouent (5,2 s), 30 passe (4,6 s),
// 20 passe (3,1 s). On reste a 20 pour garder de la marge sur les commentaires longs.
const BATCH = 20;

const die = (msg) => { console.error("erreur: " + msg); process.exit(1); };

async function api(method, path, body, isForm = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: isForm ? {} : body ? { "content-type": "application/json" } : {},
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) die(`${method} ${path.replace(/\/[A-Za-z0-9_-]{15,}/, "/<id>")} -> ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

const key = (r) => `${r.pageId}|${r.topic}.${r.criterium}`;

async function loadItems(file) {
  const raw = JSON.parse(await readFile(file, "utf8"));
  const items = Array.isArray(raw) ? raw : raw.data;
  if (!Array.isArray(items)) die(`${file}: attendu un tableau ou { data: [...] }`);
  const seen = new Set();
  items.forEach((it, i) => {
    const where = `${file}[${i}]`;
    for (const f of ["pageId", "topic", "criterium"])
      if (!Number.isInteger(it[f])) die(`${where}: ${f} doit etre un entier`);
    if (!STATUSES.includes(it.status)) die(`${where}: status invalide "${it.status}" (${STATUSES})`);
    if (it.status === "NOT_APPLICABLE" && !it.notApplicableComment?.trim())
      die(`${where}: NOT_APPLICABLE exige notApplicableComment (dire pourquoi)`);
    if (it.status === "NOT_COMPLIANT" && !it.notCompliantItems?.length)
      die(`${where}: NOT_COMPLIANT exige au moins un notCompliantItems`);
    for (const nc of it.notCompliantItems ?? [])
      if (nc.userImpact != null && !IMPACTS.includes(nc.userImpact))
        die(`${where}: userImpact invalide "${nc.userImpact}" (${IMPACTS})`);
    // notCompliantItems est @IsArray() SANS @IsOptional() cote Ara : absent, le lot entier est rejete en 400.
    if (!Array.isArray(it.notCompliantItems)) it.notCompliantItems = [];
    if (seen.has(key(it))) die(`${where}: doublon ${key(it)}`);
    seen.add(key(it));
  });
  return items;
}

// Compare l'intention au stocke. Retourne la liste des ecarts.
function diff(items, stored) {
  const byKey = new Map(stored.map((r) => [key(r), r]));
  const out = [];
  for (const it of items) {
    const got = byKey.get(key(it));
    if (!got) { out.push(`${key(it)} absent cote Ara`); continue; }
    if (got.status !== it.status) out.push(`${key(it)} status ${got.status} != ${it.status}`);
    const wantNc = it.notCompliantItems ?? [];
    const gotNc = got.notCompliantItems ?? [];
    if (wantNc.length !== gotNc.length)
      out.push(`${key(it)} ${gotNc.length} notCompliantItems != ${wantNc.length}`);
    for (const [f, want] of [["compliantComment", it.compliantComment], ["notApplicableComment", it.notApplicableComment]])
      if (want != null && (got[f] ?? "") !== want) out.push(`${key(it)} ${f} divergent`);
  }
  return out;
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "get": {
    const a = await api("GET", `/audits/${args[0]}`);
    console.log(JSON.stringify({
      procedureName: a.procedureName, auditType: a.auditType, auditorName: a.auditorName,
      publicationDate: a.publicationDate, pageElements: a.pageElements,
      transversePage: a.transverseElementsPage ?? a.auditTransverse ?? null,
      pages: (a.pages ?? []).map(({ id, order, name, url, slug }) => ({ id, order, name, url, slug }))
    }, null, 2));
    break;
  }
  case "results": {
    let r = await api("GET", `/audits/${args[0]}/results`);
    if (args[1]) r = r.filter((x) => String(x.topic) === String(args[1]));
    console.log(JSON.stringify(r, null, 2));
    break;
  }
  case "verify": {
    const items = await loadItems(args[1]);
    const ecarts = diff(items, await api("GET", `/audits/${args[0]}/results`));
    if (!ecarts.length) { console.log(`ok: ${items.length} resultats conformes a l'intention`); break; }
    console.log(`${ecarts.length} ecart(s) :`); ecarts.forEach((e) => console.log("  - " + e));
    process.exit(1);
  }
  case "push": {
    const items = await loadItems(args[1]);
    // Purge des notCompliantItems existants : sans id, l'API en recree -> doublons au rejeu.
    const stored = await api("GET", `/audits/${args[0]}/results`);
    const hadNc = new Set(stored.filter((r) => r.notCompliantItems?.length).map(key));
    const toClear = items.filter((it) => hadNc.has(key(it)) && it.notCompliantItems?.length)
      .map(({ pageId, topic, criterium }) => ({ pageId, topic, criterium, status: "NOT_TESTED", notCompliantItems: [] }));
    if (toClear.length) {
      console.log(`nettoyage de ${toClear.length} critere(s) deja pourvus d'items (anti-doublon)`);
      for (let i = 0; i < toClear.length; i += BATCH)
        await api("PATCH", `/audits/${args[0]}/results`, { data: toClear.slice(i, i + BATCH) });
    }
    for (let i = 0; i < items.length; i += BATCH) {
      const lot = items.slice(i, i + BATCH);
      await api("PATCH", `/audits/${args[0]}/results`, { data: lot });
      console.log(`ecrit ${Math.min(i + BATCH, items.length)}/${items.length}`);
    }
    const ecarts = diff(items, await api("GET", `/audits/${args[0]}/results`));
    if (ecarts.length) {
      console.log(`\nrelecture: ${ecarts.length} ecart(s) :`); ecarts.forEach((e) => console.log("  - " + e));
      process.exit(1);
    }
    console.log(`\nrelecture ok: ${items.length} resultats enregistres`);
    break;
  }
  case "create": {
    const a = await api("POST", "/audits", JSON.parse(await readFile(args[0], "utf8")));
    console.log(`edition: https://ara.numerique.gouv.fr/audits/${a.editUniqueId}/generation`);
    console.log(`uniqueId: ${a.editUniqueId}`);
    break;
  }
  case "upload": {
    const [id, topic, criterium, pageId, file] = args;
    const fd = new FormData();
    fd.set("topic", topic); fd.set("criterium", criterium); fd.set("pageId", pageId);
    fd.set("image", new Blob([await readFile(file)]), basename(file));
    console.log(JSON.stringify(await api("POST", `/audits/${id}/results/examples`, fd, true), null, 2));
    break;
  }
  // Auto-controle de la validation et du diff. Aucun appel reseau.
  case "selftest": {
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { execFileSync } = await import("node:child_process");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "ara-"));
    let n = 0;
    const w = (o) => { const f = join(dir, ++n + ".json"); writeFileSync(f, JSON.stringify(o)); return f; };
    const assert = (c, m) => { if (!c) die("selftest: " + m); };
    // rejete() relance ce meme script en sous-processus : loadItems sort via process.exit.
    const rejete = (o) => {
      try { execFileSync(process.execPath, [process.argv[1], "selftest-load", w(o)], { stdio: "pipe" }); return false; }
      catch { return true; }
    };
    const ok = { pageId: 1, topic: 1, criterium: 1, status: "COMPLIANT", compliantComment: "ok" };

    assert((await loadItems(w([ok]))).length === 1, "item valide refuse");
    assert(rejete([{ ...ok, status: "OUI" }]), "status invalide accepte");
    assert(rejete([{ ...ok, pageId: "1" }]), "pageId non entier accepte");
    assert(rejete([{ ...ok, topic: 1, criterium: 1, status: "NOT_APPLICABLE" }]), "NOT_APPLICABLE sans commentaire accepte");
    assert(rejete([{ ...ok, status: "NOT_COMPLIANT" }]), "NOT_COMPLIANT sans item accepte");
    assert(rejete([{ ...ok, notCompliantItems: [{ userImpact: "HUGE" }] }]), "userImpact invalide accepte");
    assert(rejete([ok, { ...ok }]), "doublon accepte");

    assert(diff([ok], [{ ...ok }]).length === 0, "diff identique non vide");
    assert(diff([ok], []).length === 1, "absence cote Ara non detectee");
    assert(diff([ok], [{ ...ok, status: "NOT_TESTED" }]).length === 1, "status divergent non detecte");
    assert(diff([ok], [{ ...ok, compliantComment: "autre" }]).length === 1, "commentaire divergent non detecte");
    assert(diff([{ ...ok, status: "NOT_COMPLIANT", notCompliantItems: [{ title: "a" }] }],
                [{ ...ok, status: "NOT_COMPLIANT", notCompliantItems: [] }]).length === 1,
           "notCompliantItems manquants non detectes");
    console.log("selftest ok");
    break;
  }
  case "selftest-load":
    await loadItems(args[0]);
    break;
  case "publish":
    await api("PUT", `/audits/${args[0]}/publish`);
    console.log("publie");
    break;
  default:
    console.log(await readFile(new URL(import.meta.url), "utf8").then((s) => s.split("\n").slice(1, 14).join("\n")));
    process.exit(cmd ? 1 : 0);
}
