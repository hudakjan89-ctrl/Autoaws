#!/usr/bin/env node
/**
 * Kompletní test scénářů — všechny varianty + kontrola odkazů
 */
const BASE = process.argv[2] || "http://localhost:3000";

async function getCsrf() {
    const r = await fetch(BASE + "/api/csrf-token");
    return (await r.json()).token;
}

async function chat(message, sessionId) {
    const token = await getCsrf();
    const r = await fetch(BASE + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ message, session_id: sessionId, language: "cs" })
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()));
    return r.json();
}

const results = [];

function test(name, fn) {
    return fn().then(function () {
        results.push({ name: name, ok: true });
        console.log("OK  ", name);
    }).catch(function (e) {
        results.push({ name: name, ok: false, err: e.message });
        console.log("FAIL", name, "—", e.message);
    });
}

function assert(c, msg) { if (!c) throw new Error(msg); }

(async () => {
    console.log("=== Kompletní test scénářů @ " + BASE + " ===\n");

    // ── AUTO: elektro město ──
    await test("Auto: elektro + město → e-up", async function () {
        let d = await chat("Hledám auto", null);
        let sid = d.session_id;
        assert(!d.recommended_links || d.recommended_links.length === 0, "krok1 bez odkazů");
        assert(/palivo/i.test(d.response) && /převodov|prevodov/i.test(d.response), "krok1 více otázek");
        d = await chat("do 500 tisíc, elektro, automat, do města, VW", sid);
        assert(/e-up|379/.test(d.response), "doporučí e-up");
        assert(d.recommended_links && d.recommended_links.length >= 1, "odkaz na konci");
    });

    // ── AUTO: diesel kombi ──
    await test("Auto: diesel + kombi → Passat", async function () {
        let d = await chat("Chci auto", null);
        let sid = d.session_id;
        d = await chat("do 500 tisíc, diesel, automat, kombi na delší trasy", sid);
        assert(/passat|447/.test(d.response.toLowerCase()), "doporučí Passat");
    });

    // ── AUTO: SUV benzín ──
    await test("Auto: SUV + benzín → Ateca", async function () {
        let d = await chat("Potřebuji vybrat auto", null);
        let sid = d.session_id;
        d = await chat("do 650 tisíc, benzín, automat, SUV, rodinné", sid);
        assert(/ateca|614/.test(d.response.toLowerCase()), "doporučí Ateca");
    });

    // ── AUTO: sport elektro ──
    await test("Auto: sport elektro → Cupra Born", async function () {
        let d = await chat("Co doporučíte za auto?", null);
        let sid = d.session_id;
        d = await chat("do 600 tisíc, elektro, automat, kompaktní sportovní", sid);
        assert(/born|cupra|569/.test(d.response.toLowerCase()), "doporučí Born");
    });

    // ── AUTO: částečná odpověď → doplnění ──
    await test("Auto: částečná odpověď → doplnění", async function () {
        let d = await chat("Hledám auto do 400 tisíc", null);
        let sid = d.session_id;
        assert(/palivo|převodov|typ/i.test(d.response), "zeptá se na zbytek");
        d = await chat("elektro, automat, do města", sid);
        assert(/e-up|379/.test(d.response), "doporučí po doplnění");
    });

    // ── FIN: přímo s autem ──
    await test("Financování: Passat přímo", async function () {
        let d = await chat("Zajímá mě financování", null);
        let sid = d.session_id;
        assert(!d.recommended_links || d.recommended_links.length === 0, "bez odkazu v intake");
        assert(/konkrétní auto|passat|e-up/i.test(d.response), "chce auto");
        d = await chat("Passat, bez akontace, nižší splátka", sid);
        assert(/passat/i.test(d.response), "zmíní Passat");
        assert(/447/.test(d.response), "cena Passatu");
        assert(/moneta/i.test(d.response), "Moneta");
        assert(d.recommended_links && d.recommended_links.some(l => l.url.includes("financovani")), "odkaz financování");
    });

    // ── FIN: e-up přímo ──
    await test("Financování: e-up přímo", async function () {
        let d = await chat("Chci financovat auto", null);
        let sid = d.session_id;
        d = await chat("e-up, bez akontace, rychlejší splacení", sid);
        assert(/e-up|379/.test(d.response), "e-up cena");
        assert(/moneta/i.test(d.response), "Moneta");
    });

    // ── FIN: propojení s výběrem auta ──
    await test("Propojení: auto → financování stejné auto", async function () {
        let d = await chat("Hledám auto", null);
        let sid = d.session_id;
        d = await chat("do 500 tisíc, elektro, automat, do města, VW", sid);
        assert(/e-up/.test(d.response.toLowerCase()), "vybral e-up");
        d = await chat("Dá se to financovat?", sid);
        assert(/e-up|379/.test(d.response), "financování k e-up");
        assert(/moneta/i.test(d.response), "Moneta");
        d = await chat("bez akontace, nižší splátka", sid);
        assert(/379/.test(d.response), "cena e-up ve finále");
        assert(/moneta/i.test(d.response) && /100/.test(d.response), "podmínky");
    });

    // ── FAQ nezasahuje do scénáře ──
    await test("FAQ: nabízíte financování? (ne scénář)", async function () {
        let d = await chat("Nabízíte financování?", null);
        assert(/moneta/i.test(d.response), "FAQ odpověď");
        assert(/100/.test(d.response) && /84/.test(d.response), "podmínky");
        assert(!/napište mi prosím do jedné zprávy/i.test(d.response), "ne intake scénář");
    });

    const ok = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    console.log("\n=== VÝSLEDEK: " + ok + "/" + results.length + " OK" + (fail ? " (" + fail + " FAIL)" : "") + " ===");
    process.exit(fail > 0 ? 1 : 0);
})();
