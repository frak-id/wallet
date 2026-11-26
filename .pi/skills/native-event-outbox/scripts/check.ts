#!/usr/bin/env bun
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const TLC_VERSION = "1.7.4";
const TLC_URL = `https://github.com/tlaplus/tlaplus/releases/download/v${TLC_VERSION}/tla2tools.jar`;
const TLC_SHA256 =
    "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88";

const modelDir = resolve(import.meta.dir, "../model");
const spec = await Bun.file(join(modelDir, "EventOutbox.tla")).text();
const baseCfg = await Bun.file(join(modelDir, "EventOutbox.cfg")).text();
const expected: Record<string, Verdict> = await Bun.file(
    join(modelDir, "expected.json")
).json();

type Verdict = "holds" | "breaks";
type Edit = { find: string; replace: string };
type Mutant = {
    name: string;
    code: string;
    rule: string;
    expect: Verdict;
    edits: Edit[];
};
type Run = { broken: string | null; trace: string; log: string };

async function tlcJar(): Promise<string> {
    const cacheRoot = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
    const jar = join(cacheRoot, "frak-tla", `tla2tools-${TLC_VERSION}.jar`);
    if (!existsSync(jar)) {
        console.log(`Downloading TLC ${TLC_VERSION}…`);
        const response = await fetch(TLC_URL);
        if (!response.ok)
            throw new Error(`TLC download failed: HTTP ${response.status}`);
        mkdirSync(join(cacheRoot, "frak-tla"), { recursive: true });
        await Bun.write(jar, await response.arrayBuffer());
    }
    const digest = new Bun.CryptoHasher("sha256")
        .update(await Bun.file(jar).arrayBuffer())
        .digest("hex");
    if (digest !== TLC_SHA256)
        throw new Error(
            `${jar} does not match the pinned sha256; delete it and rerun.`
        );
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
                current[name.trim()] = rest
                    .join(" = ")
                    .replace(/\s+/g, " ")
                    .trim();
            }
            const changed = Object.entries(current).filter(
                ([k, v]) => previous[k] !== v
            );
            previous = current;
            const shown =
                index === 0
                    ? ""
                    : changed.map(([k, v]) => `\n      ${k} = ${v}`).join("");
            return `  ${index + 1}. ${action}${shown}`;
        })
        .join("\n");
}

function runTlc(
    jar: string,
    source: string,
    rules: string[],
    workDir: string,
    label: string
): Run {
    const dir = join(workDir, label);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "EventOutbox.tla"), source);
    writeFileSync(
        join(dir, "run.cfg"),
        `${baseCfg}INVARIANTS ${rules.join(" ")}\n`
    );
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
            "EventOutbox.tla",
        ],
        { cwd: dir }
    );
    const log = result.stdout.toString() + result.stderr.toString();
    writeFileSync(join(dir, "tlc.out"), log);
    const broken = log.match(/Error: Invariant (\w+) is violated/)?.[1] ?? null;
    if (
        !broken &&
        !log.includes("Model checking completed. No error has been found.")
    ) {
        throw new Error(
            `TLC did not finish on ${label}; see ${join(dir, "tlc.out")}`
        );
    }
    return {
        broken,
        trace: broken ? condense(log) : "",
        log: join(dir, "tlc.out"),
    };
}

function verdictsFor(
    jar: string,
    source: string,
    rules: Record<string, Verdict>,
    workDir: string,
    prefix: string
) {
    const verdicts: Record<string, { verdict: Verdict; run: Run }> = {};
    const holding = Object.keys(rules).filter(
        (rule) => rules[rule] === "holds"
    );
    let unchecked = holding;
    // TLC stops at the first broken rule, so rerun the rest without it.
    while (unchecked.length > 0) {
        const run = runTlc(
            jar,
            source,
            unchecked,
            workDir,
            `${prefix}holds-${unchecked.length}`
        );
        if (!run.broken) {
            for (const rule of unchecked)
                verdicts[rule] = { verdict: "holds", run };
            break;
        }
        verdicts[run.broken] = { verdict: "breaks", run };
        unchecked = unchecked.filter((rule) => rule !== run.broken);
    }
    for (const rule of Object.keys(rules).filter(
        (r) => rules[r] === "breaks"
    )) {
        const run = runTlc(jar, source, [rule], workDir, `${prefix}${rule}`);
        verdicts[rule] = { verdict: run.broken ? "breaks" : "holds", run };
    }
    return verdicts;
}

function applyEdits(source: string, mutant: Mutant): string {
    return mutant.edits.reduce((text, edit) => {
        const count = text.split(edit.find).length - 1;
        if (count !== 1)
            throw new Error(
                `Mutant ${mutant.name}: expected one match, found ${count}. Update mutants.json.`
            );
        return text.replace(edit.find, edit.replace);
    }, source);
}

const jar = await tlcJar();
const workDir = process.argv.includes("--out")
    ? resolve(process.argv[process.argv.indexOf("--out") + 1])
    : mkdtempSync(join(tmpdir(), "native-event-outbox-"));
let mismatches = 0;

if (process.argv.includes("--mutants")) {
    const mutants: Mutant[] = await Bun.file(
        join(modelDir, "mutants.json")
    ).json();
    for (const mutant of mutants) {
        const run = runTlc(
            jar,
            applyEdits(spec, mutant),
            [mutant.rule],
            workDir,
            mutant.name
        );
        const verdict: Verdict = run.broken ? "breaks" : "holds";
        const ok = verdict === mutant.expect;
        if (!ok) mismatches++;
        console.log(
            `${ok ? "ok  " : "FAIL"} ${mutant.name}: ${mutant.rule} ${verdict} (want ${mutant.expect})`
        );
        console.log(`     code: ${mutant.code}`);
    }
} else {
    const verdicts = verdictsFor(jar, spec, expected, workDir, "");
    for (const [rule, want] of Object.entries(expected)) {
        const { verdict, run } = verdicts[rule];
        const ok = verdict === want;
        if (!ok) mismatches++;
        const tag = ok ? (verdict === "breaks" ? "known" : "ok   ") : "FAIL ";
        console.log(
            `${tag} ${rule}: ${verdict}${ok ? "" : ` (expected ${want})`}`
        );
        if (verdict === "breaks")
            console.log(`${run.trace}\n      full trace: ${run.log}\n`);
    }
}

console.log(`\nTLC ${TLC_VERSION}, output in ${workDir}`);
process.exit(mismatches === 0 ? 0 : 1);
