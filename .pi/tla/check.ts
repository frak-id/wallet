#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const TLC_VERSION = "1.7.4";
const TLC_URL = `https://github.com/tlaplus/tlaplus/releases/download/v${TLC_VERSION}/tla2tools.jar`;
const TLC_SHA256 = "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88";

type Verdict = "holds" | "breaks";
type Edit = { find: string; replace: string };
type Mutant = { name: string; code: string; expect: Record<string, Verdict>; edits: Edit[] };
type Run = { broken: string | null; trace: string; log: string };

const args = process.argv.slice(2);
const modelArg = args.find((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--out");
if (!modelArg) {
    console.error("usage: bun .pi/tla/check.ts <model dir> [--mutants] [--out <dir>]");
    process.exit(2);
}
const modelDir = resolve(modelArg);
const specFile = readdirSync(modelDir).find((name) => name.endsWith(".tla"));
if (!specFile) throw new Error(`No .tla file in ${modelDir}`);
const specName = basename(specFile, ".tla");
const spec = await Bun.file(join(modelDir, specFile)).text();
const baseCfg = await Bun.file(join(modelDir, `${specName}.cfg`)).text();
const expected: Record<string, Verdict> = await Bun.file(join(modelDir, "expected.json")).json();

async function tlcJar(): Promise<string> {
    const cacheRoot = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
    const jar = join(cacheRoot, "frak-tla", `tla2tools-${TLC_VERSION}.jar`);
    if (!existsSync(jar)) {
        console.log(`Downloading TLC ${TLC_VERSION}…`);
        const response = await fetch(TLC_URL);
        if (!response.ok) throw new Error(`TLC download failed: HTTP ${response.status}`);
        mkdirSync(join(cacheRoot, "frak-tla"), { recursive: true });
        await Bun.write(jar, await response.arrayBuffer());
    }
    const digest = new Bun.CryptoHasher("sha256").update(await Bun.file(jar).arrayBuffer()).digest("hex");
    if (digest !== TLC_SHA256) throw new Error(`${jar} does not match the pinned sha256; delete it and rerun.`);
    return jar;
}

/** Each step as its action name plus only the variables that changed. */
function condense(log: string): string {
    const steps = log
        .split(/^State \d+: /m)
        .slice(1)
        .map((step) => step.split(/\n\s*\n/)[0]);
    let previous: Record<string, string> = {};
    return steps
        .map((step, index) => {
            const action = step.match(/^<(\w+)/)?.[1] ?? "?";
            const current: Record<string, string> = {};
            for (const entry of step.split(/^\/\\ /m).slice(1)) {
                const [name, ...rest] = entry.split(" = ");
                current[name.trim()] = rest.join(" = ").replace(/\s+/g, " ").trim();
            }
            const changed = Object.entries(current).filter(([k, v]) => previous[k] !== v);
            previous = current;
            const shown = index === 0 ? "" : changed.map(([k, v]) => `\n      ${k} = ${v}`).join("");
            return `  ${index + 1}. ${action}${shown}`;
        })
        .join("\n");
}

function runTlc(jar: string, source: string, rules: string[], workDir: string, label: string): Run {
    const dir = join(workDir, label);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, specFile as string), source);
    writeFileSync(join(dir, "run.cfg"), `${baseCfg}INVARIANTS ${rules.join(" ")}\n`);
    const result = Bun.spawnSync(
        [
            "java",
            "-XX:+UseParallelGC",
            "-cp",
            jar,
            "tlc2.TLC",
            "-config",
            "run.cfg",
            // One worker when a break is expected: TLC's trace is the shortest only then.
            "-workers",
            rules.length === 1 ? "1" : "auto",
            "-deadlock",
            "-cleanup",
            "-metadir",
            join(dir, "states"),
            specFile as string,
        ],
        { cwd: dir }
    );
    const log = result.stdout.toString() + result.stderr.toString();
    writeFileSync(join(dir, "tlc.out"), log);
    const broken = log.match(/Error: Invariant (\w+) is violated/)?.[1] ?? null;
    if (!broken && !log.includes("Model checking completed. No error has been found.")) {
        throw new Error(`TLC did not finish on ${label}; see ${join(dir, "tlc.out")}`);
    }
    return { broken, trace: broken ? condense(log) : "", log: join(dir, "tlc.out") };
}

function verdictsFor(jar: string, source: string, rules: Record<string, Verdict>, workDir: string, prefix: string) {
    const verdicts: Record<string, { verdict: Verdict; run: Run }> = {};
    let unchecked = Object.keys(rules).filter((rule) => rules[rule] === "holds");
    // TLC stops at the first broken rule, so rerun the rest without it.
    while (unchecked.length > 0) {
        const run = runTlc(jar, source, unchecked, workDir, `${prefix}holds-${unchecked.length}`);
        if (!run.broken) {
            for (const rule of unchecked) verdicts[rule] = { verdict: "holds", run };
            break;
        }
        verdicts[run.broken] = { verdict: "breaks", run };
        unchecked = unchecked.filter((rule) => rule !== run.broken);
    }
    for (const rule of Object.keys(rules).filter((r) => rules[r] === "breaks")) {
        const run = runTlc(jar, source, [rule], workDir, `${prefix}${rule}`);
        verdicts[rule] = { verdict: run.broken ? "breaks" : "holds", run };
    }
    return verdicts;
}

function applyEdits(source: string, mutant: Mutant): string {
    return mutant.edits.reduce((text, edit) => {
        const count = text.split(edit.find).length - 1;
        if (count !== 1) {
            throw new Error(`Mutant ${mutant.name}: expected one match, found ${count}. Update mutants.json.`);
        }
        return text.replace(edit.find, edit.replace);
    }, source);
}

const jar = await tlcJar();
const outIndex = args.indexOf("--out");
const workDir = outIndex >= 0 ? resolve(args[outIndex + 1]) : mkdtempSync(join(tmpdir(), `${specName}-`));
let mismatches = 0;

if (args.includes("--mutants")) {
    const mutants: Mutant[] = await Bun.file(join(modelDir, "mutants.json")).json();
    for (const mutant of mutants) {
        const source = applyEdits(spec, mutant);
        console.log(`${mutant.name}\n     code: ${mutant.code}`);
        const verdicts = verdictsFor(jar, source, mutant.expect, workDir, `${mutant.name}-`);
        for (const [rule, want] of Object.entries(mutant.expect)) {
            const { verdict } = verdicts[rule];
            const ok = verdict === want;
            if (!ok) mismatches++;
            console.log(`  ${ok ? "ok  " : "FAIL"} ${rule}: ${verdict} (want ${want})`);
        }
    }
} else {
    const verdicts = verdictsFor(jar, spec, expected, workDir, "");
    for (const [rule, want] of Object.entries(expected)) {
        const { verdict, run } = verdicts[rule];
        const ok = verdict === want;
        if (!ok) mismatches++;
        const tag = ok ? (verdict === "breaks" ? "known" : "ok   ") : "FAIL ";
        console.log(`${tag} ${rule}: ${verdict}${ok ? "" : ` (expected ${want})`}`);
        if (verdict === "breaks") console.log(`${run.trace}\n      full trace: ${run.log}\n`);
    }
}

console.log(`\nTLC ${TLC_VERSION}, output in ${workDir}`);
process.exit(mismatches === 0 ? 0 : 1);
