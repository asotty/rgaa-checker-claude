#!/usr/bin/env node
// Decoupe du referentiel RGAA 4.1 officiel (references/criteres-4.1.json).
//   node rgaa.mjs topics                 -> les 13 thematiques et leur nombre de criteres
//   node rgaa.mjs topic <n>              -> criteres + tests d'une thematique (a donner au sous-agent)
//   node rgaa.mjs criterium <n.m>        -> un critere precis
//   node rgaa.mjs plan <n|all> <pageIds> -> squelette JSON pour ara.mjs push (tout en NOT_TESTED)
import { readFile } from "node:fs/promises";

const ref = JSON.parse(await readFile(new URL("../skills/rgaa-audit/references/criteres-4.1.json", import.meta.url), "utf8"));
const topics = ref.topics ?? ref;
const [cmd, a, b] = process.argv.slice(2);
const findTopic = (n) => topics.find((t) => String(t.number) === String(n));

switch (cmd) {
  case "topics":
    console.log(topics.map((t) => `${t.number}. ${t.topic} — ${t.criteria.length} criteres`).join("\n"));
    break;
  case "topic": {
    const t = findTopic(a);
    if (!t) { console.error("thematique inconnue: " + a); process.exit(1); }
    console.log(JSON.stringify(t, null, 2));
    break;
  }
  case "criterium": {
    const [tn, cn] = String(a).split(".");
    const c = findTopic(tn)?.criteria.find((x) => String(x.criterium.number) === cn);
    if (!c) { console.error("critere inconnu: " + a); process.exit(1); }
    console.log(JSON.stringify(c, null, 2));
    break;
  }
  case "plan": {
    const sel = a === "all" ? topics : [findTopic(a)].filter(Boolean);
    const pages = (b ?? "").split(",").filter(Boolean).map(Number);
    if (!sel.length || !pages.length) { console.error("usage: plan <n|all> <pageId,pageId,...>"); process.exit(1); }
    const out = [];
    for (const p of pages)
      for (const t of sel)
        for (const c of t.criteria)
          out.push({ pageId: p, topic: t.number, criterium: c.criterium.number, status: "NOT_TESTED" });
    console.log(JSON.stringify(out, null, 2));
    break;
  }
  default:
    console.log("usage: topics | topic <n> | criterium <n.m> | plan <n|all> <pageIds>");
    process.exit(cmd ? 1 : 0);
}
