/**
 * verify-listener: serve a listener build behind a hermetic two-origin
 * server, drive named flows in headless Chromium, write evidence.
 *
 *   bun scripts/run.ts (--dist <path> | --build) [--flow boot|modal-login|sharing|all]
 *                      [--runs N] [--label NAME] [--evidence DIR] [--repo PATH]
 *
 * Exit 0 only when every run passed.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type DriveResult, driveFlow, FLOWS, type Flow } from "./drive.ts";
import { type LoggedRequest, startServer } from "./server.ts";

const { values: opts } = parseArgs({
    options: {
        dist: { type: "string" },
        build: { type: "boolean", default: false },
        flow: { type: "string", default: "all" },
        runs: { type: "string", default: "1" },
        label: { type: "string", default: "run" },
        evidence: { type: "string" },
        repo: { type: "string" },
    },
});

function die(msg: string): never {
    console.error(`verify-listener: ${msg}`);
    process.exit(2);
}

const repo = resolve(opts.repo ?? join(import.meta.dir, "../../../.."));
if (!existsSync(join(repo, "apps/listener")))
    die(`not a wallet checkout: ${repo} (pass --repo)`);
if (Boolean(opts.dist) === opts.build)
    die("pass exactly one of --dist <path> or --build");
const flows: Flow[] = opts.flow === "all" ? [...FLOWS] : [opts.flow as Flow];
if (!flows.every((f) => FLOWS.includes(f))) die(`unknown flow: ${opts.flow}`);
const runs = Number(opts.runs);
if (!Number.isInteger(runs) || runs < 1) die(`bad --runs: ${opts.runs}`);

let dist = opts.dist ? resolve(opts.dist) : join(repo, "apps/listener/dist");
if (opts.build) {
    console.log("== building apps/listener");
    const code = await Bun.spawn(["bun", "run", "build"], {
        cwd: join(repo, "apps/listener"),
        stdout: "inherit",
        stderr: "inherit",
    }).exited;
    if (code !== 0) die(`listener build exited ${code}`);
    dist = join(repo, "apps/listener/dist");
}
if (!existsSync(join(dist, "index.html"))) die(`no index.html in ${dist}`);
const sdkDir = join(repo, "sdk/components/cdn");
if (!existsSync(join(sdkDir, "loader.js")))
    die(`no ${sdkDir}/loader.js: run bun run build:sdk`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceRoot = resolve(
    opts.evidence ??
        join(repo, ".pi/verify-evidence", `${stamp}-listener-${opts.label}`)
);
if (existsSync(evidenceRoot)) die(`evidence dir exists: ${evidenceRoot}`);
mkdirSync(evidenceRoot, { recursive: true });
const evidenceBase = join(repo, ".pi/verify-evidence");
if (existsSync(evidenceBase))
    writeFileSync(join(evidenceBase, ".gitignore"), "*\n");

// The repo's Playwright, whatever directory this script lives in.
const { chromium } = createRequire(join(repo, "apps/wallet/package.json"))(
    "@playwright/test"
) as typeof import("@playwright/test");

type RunSummary = {
    flow: Flow;
    run: number;
    pass: boolean;
    error?: string;
    js: { path: string; rawBytes: number; gzBytes: number }[];
    jsGzTotal: number;
    jsRawTotal: number;
    failedRequests: string[];
    unstubbedCalls: string[];
    consoleErrors: string[];
};

const isAsset = (r: LoggedRequest) =>
    r.path.startsWith("/listener") || r.path.startsWith("/sdk/");

async function runOnce(
    flow: Flow,
    run: number,
    dir: string
): Promise<RunSummary> {
    const server = startServer({ dist, sdkDir });
    const browser = await chromium.launch({ headless: true });
    let cut: number | null = null;
    const drive: DriveResult = { consoleLines: [], browserFailures: [] };
    let error: string | undefined;
    try {
        await driveFlow({
            browser,
            result: drive,
            flow,
            merchantUrl: server.merchantUrl,
            walletUrl: server.walletUrl,
            evidenceDir: dir,
            onUiShown: () => {
                cut = server.log.length;
            },
        });
    } catch (err) {
        error = String(err instanceof Error ? err.message : err).split("\n")[0];
    } finally {
        await browser.close();
        await server.stop();
    }
    const window = server.log.slice(0, cut ?? server.log.length);
    const js = window
        .filter(
            (r) =>
                r.origin === "wallet" &&
                r.kind === "listener" &&
                r.path.endsWith(".js")
        )
        .map(({ path, rawBytes, gzBytes }) => ({ path, rawBytes, gzBytes }));
    const failedRequests = [
        ...server.log
            .filter((r) => isAsset(r) && r.status >= 400)
            .map((r) => `${r.status} ${r.path}`),
        ...drive.browserFailures,
    ];
    const summary: RunSummary = {
        flow,
        run,
        pass: !error && failedRequests.length === 0,
        error,
        js,
        jsGzTotal: js.reduce((s, r) => s + r.gzBytes, 0),
        jsRawTotal: js.reduce((s, r) => s + r.rawBytes, 0),
        failedRequests,
        unstubbedCalls: server.log
            .filter((r) => !isAsset(r) && r.kind === "notfound")
            .map(
                (r) =>
                    `${r.status} ${r.method} ${r.forwardedFrom ?? ""}${r.path}`
            ),
        consoleErrors: drive.consoleLines.filter((l) =>
            /^\[(error|pageerror)\]/.test(l)
        ),
    };
    writeFileSync(
        join(dir, "console.log"),
        `${drive.consoleLines.join("\n")}\n`
    );
    writeFileSync(
        join(dir, "requests.jsonl"),
        `${server.log
            .map((r, i) =>
                JSON.stringify({ ...r, afterUiShown: cut !== null && i >= cut })
            )
            .join("\n")}\n`
    );
    writeFileSync(
        join(dir, "js.txt"),
        `${[
            ...js.map((r) => `${r.gzBytes}\t${r.rawBytes}\t${r.path}`),
            `${summary.jsGzTotal}\t${summary.jsRawTotal}\tTOTAL (gz, raw bytes; page load to UI shown)`,
        ].join("\n")}\n`
    );
    return summary;
}

const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
const line = (s: RunSummary) =>
    `${s.pass ? "PASS" : "FAIL"} ${s.flow} run ${s.run}: ${s.js.length} js, gz ${kib(s.jsGzTotal)}, ` +
    `${s.failedRequests.length} failed, ${s.consoleErrors.length} console errors` +
    (s.error ? ` — ${s.error}` : "");

const results: RunSummary[] = [];
for (let run = 1; run <= runs; run++) {
    for (const flow of flows) {
        const dir = join(evidenceRoot, flow, `run-${run}`);
        mkdirSync(dir, { recursive: true });
        const s = await runOnce(flow, run, dir);
        results.push(s);
        console.log(line(s));
    }
}

const allPass = results.every((r) => r.pass);
writeFileSync(
    join(evidenceRoot, "summary.json"),
    `${JSON.stringify({ pass: allPass, dist, repo, label: opts.label, results }, null, 2)}\n`
);
writeFileSync(
    join(evidenceRoot, "summary.txt"),
    `${[
        `${allPass ? "PASS" : "FAIL"} ${opts.label} dist=${dist}`,
        ...results.map(line),
    ].join("\n")}\n`
);
console.log(`evidence: ${evidenceRoot}`);
process.exit(allPass ? 0 : 1);
