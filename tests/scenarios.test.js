#!/usr/bin/env node
/**
 * Test vícekrokových scénářů (výběr auta, financování)
 * Spuštění: node tests/scenarios.test.js [base-url]
 */

const BASE = process.argv[2] || "http://localhost:3000";

async function getCsrf() {
    const r = await fetch(BASE + "/api/csrf-token");
    return (await r.json()).token;
}

async function chat(message, sessionId, lang) {
    const token = await getCsrf();
    const r = await fetch(BASE + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ message: message, session_id: sessionId, language: lang || "cs" })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

(async () => {
    console.log("Scénáře test @ " + BASE);
    let passed = 0, failed = 0;

    // ── Scénář 1: výběr auta (1 doptávací zpráva + doporučení) ──
    try {
        let sid = null;
        let d = await chat("Hledám auto", sid);
        sid = d.session_id;
        assert(/palivo/i.test(d.response), "krok1: měl zmínit palivo");
        assert(/převodov|prevodov/i.test(d.response), "krok1: měl zmínit převodovku");
        assert(/rozpočet|cenu|tisíc/i.test(d.response), "krok1: měl zmínit rozpočet");
        assert(/jedné zprávy|jedne zpravy/i.test(d.response), "krok1: měl požádat o jednu zprávu");
        assert(!d.recommended_links || d.recommended_links.length === 0, "krok1: žádné přesměrování");

        d = await chat("do 500 tisíc, elektro, automat, do města, VW, max 100 tisíc km", sid);
        assert(/e-up|379/i.test(d.response), "krok2: měl doporučit e-up");
        assert(d.recommended_links && d.recommended_links.length >= 1, "krok2: přesměrování až na konci");
        console.log("OK  car-finder (2 kroky)");
        passed++;
    } catch (e) {
        console.log("FAIL car-finder", e.message);
        failed++;
    }

    // ── Scénář 2: financování s konkrétním autem ──
    try {
        let sid = null;
        let d = await chat("Zajímá mě financování auta", sid);
        sid = d.session_id;
        assert(/konkrétní auto|konkretni auto|passat|e-up/i.test(d.response), "fin1: měl chtít konkrétní auto");
        assert(/akontac/i.test(d.response), "fin1: měl zmínit akontaci");
        assert(/splátk|splatk/i.test(d.response), "fin1: měl zmínit splátky");
        assert(!d.recommended_links || d.recommended_links.length === 0, "fin1: žádné přesměrování");

        d = await chat("Passat, bez akontace, nižší splátka", sid);
        assert(/passat/i.test(d.response), "fin2: měl zmínit Passat");
        assert(/447|tisíc/i.test(d.response), "fin2: měl uvést cenu Passatu");
        assert(/moneta/i.test(d.response), "fin2: měl zmínit Moneta");
        assert(d.recommended_links && d.recommended_links.some(function (l) {
            return l.url && l.url.indexOf("financovani") !== -1;
        }), "fin2: odkaz na financování až na konci");
        console.log("OK  financing (2 kroky)");
        passed++;
    } catch (e) {
        console.log("FAIL financing", e.message);
        failed++;
    }

    // ── Propojení: auto → financování stejné session ──
    try {
        let sid = null;
        let d = await chat("Hledám auto do 500 tisíc", sid);
        sid = d.session_id;
        d = await chat("elektro, automat, do města, VW", sid);
        assert(/e-up/i.test(d.response), "link1: doporučil auto");

        d = await chat("Dá se to financovat?", sid);
        assert(/e-up|379/i.test(d.response), "link2: financování k e-up");
        assert(/moneta/i.test(d.response), "link2: Moneta");

        d = await chat("bez akontace, nižší splátka", sid);
        assert(/379|e-up/i.test(d.response), "link3: cena e-up");
        assert(/moneta/i.test(d.response), "link3: Moneta");
        console.log("OK  car-then-finance");
        passed++;
    } catch (e) {
        console.log("FAIL car-then-finance", e.message);
        failed++;
    }

    console.log("\n" + passed + "/3 passed");
    process.exit(failed > 0 ? 1 : 0);
})();
