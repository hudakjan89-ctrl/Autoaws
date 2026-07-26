#!/usr/bin/env node
/**
 * Auto AWS Asistent — kontrola kvality odpovědí
 *
 * Spuštění:  node tests/qa.test.js [base-url]
 * Výchozí:   http://localhost:3000
 */

const BASE = process.argv[2] || "http://localhost:3000";

const CASES = [
    { id: "kontakt", lang: "cs", q: "jak se s vámi můžu spojit?",
      must: [["777 834 466"], ["info@autoaws.cz"]],
      forbid: [] },

    { id: "oteviraci-doba", lang: "cs", q: "kdy máte otevřeno?",
      must: [["9:00", "9–17", "9-17"], ["sobota", "so", "11:00"]],
      forbid: [] },

    { id: "adresa", lang: "cs", q: "kde se nacházíte?",
      must: [["uherský brod", "uhersky brod"], ["cihlářská", "cihlarska"]],
      forbid: [] },

    { id: "znacky", lang: "cs", q: "jaké značky aut prodáváte?",
      must: [["audi", "volkswagen", "škoda", "skoda", "seat"]],
      forbid: [] },

    { id: "dovoz", lang: "cs", q: "odkud auta pocházejí?",
      must: [["německ", "nemeck"]],
      forbid: [] },

    { id: "financovani", lang: "cs", q: "nabízíte financování?",
      must: [["moneta"], ["100", "84"]],
      forbid: [] },

    { id: "zaruka", lang: "cs", q: "jakou záruku nabízíte?",
      must: [["car protect", "defend", "deluxe", "advantage"]],
      forbid: [] },

    { id: "cena-vozu", lang: "cs", q: "kolik stojí Audi A4 u vás?",
      must: [["autoaws.cz/automobily", "nabídk", "inzerát", "777 834 466", "nemám", "neuvád"]],
      forbid: ["stojí 500", "stojí 1", "cca 200"] },

    { id: "skladem", lang: "cs", q: "máte skladem Škodu Octavii?",
      must: [["nemám", "neuvád", "nabídk", "autoaws.cz", "777 834 466", "ověř"]],
      forbid: ["ano, máme skladem"] },
];

async function getCsrf() {
    const r = await fetch(BASE + "/api/csrf-token");
    const d = await r.json();
    return d.token;
}

async function ask(question, lang) {
    const token = await getCsrf();
    const r = await fetch(BASE + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ message: question, language: lang })
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()));
    const d = await r.json();
    return d.response || "";
}

function checkCase(c, answer) {
    const low = answer.toLowerCase();
    const errors = [];
    for (const group of (c.must || [])) {
        if (!group.some(w => low.includes(w.toLowerCase()))) {
            errors.push("chybí: " + group.join(" | "));
        }
    }
    for (const f of (c.forbid || [])) {
        if (low.includes(f.toLowerCase())) errors.push("zakázáno: " + f);
    }
    return errors;
}

(async () => {
    console.log("Auto AWS QA test @ " + BASE);
    let passed = 0, failed = 0;
    for (const c of CASES) {
        try {
            const answer = await ask(c.q, c.lang);
            const errs = checkCase(c, answer);
            if (errs.length) {
                failed++;
                console.log("FAIL", c.id, errs.join("; "));
                console.log("  →", answer.slice(0, 200));
            } else {
                passed++;
                console.log("OK  ", c.id);
            }
        } catch (e) {
            failed++;
            console.log("ERR ", c.id, e.message);
        }
    }
    console.log(`\n${passed}/${CASES.length} passed`);
    process.exit(failed > 0 ? 1 : 0);
})();
