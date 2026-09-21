/**
 * GitHub Actions pins across `.github/workflows` and the two composite actions.
 *
 * Every pin here is tag-pinned but one, so the finding is rarely a version
 * delta — it is which of them run in a workflow holding a signing key.
 */
import { readFileSync } from "node:fs";
import {
    githubLatestRelease,
    hasGithubToken,
    log,
    mapLimit,
    parseTag,
    resolveTagSha,
    trackedFiles,
} from "./registry";
import { PUBLISH_SECRET } from "./traps";
import {
    type Flag,
    type InventoryItem,
    type Location,
    semverDelta,
    tierFor,
} from "./types";

type PinStyle = "sha" | "tag" | "mutable";

type UsesRef = {
    /** `owner/repo`, with any action subpath dropped. */
    slug: string;
    ref: string;
    /** A trailing `# v1.2.3` on the same line, which is all a sha pin records. */
    comment?: string;
};

export type Pin = UsesRef & {
    locations: Location[];
    /** Files carrying a publishing credential that this pin runs inside. */
    publishingWorkflows: string[];
};

const USES = /^\s*(?:-\s+)?uses:\s*(['"]?)([^'"\s#]+)\1(?:\s*#\s*(\S+))?\s*$/;

/** The raw `uses:` value, quotes stripped. Null when the line is not a `uses:` key. */
function usesTarget(line: string): { target: string; comment?: string } | null {
    const match = USES.exec(line);
    if (!match) return null;
    const target = match[2] ?? "";
    const comment = match[3];
    return { target, ...(comment ? { comment } : {}) };
}

function isLocalUses(target: string): boolean {
    return target.startsWith("./") || target.startsWith("../");
}

/** Null for a local composite reference, which has no upstream to resolve. */
function parseUses(line: string): UsesRef | null {
    const found = usesTarget(line);
    if (!found || isLocalUses(found.target)) return null;

    const at = found.target.lastIndexOf("@");
    if (at < 0) return null;
    const [owner, repo] = found.target.slice(0, at).split("/");
    if (!owner || !repo) return null;

    return {
        slug: `${owner}/${repo}`,
        ref: found.target.slice(at + 1),
        ...(found.comment ? { comment: found.comment } : {}),
    };
}

function pinStyleOf(ref: string): PinStyle {
    if (/^[0-9a-f]{40}$/.test(ref)) return "sha";
    return parseTag(ref) ? "tag" : "mutable";
}

type TagVerdict = { needsUpdate: boolean; note?: string };

/**
 * A single-component pin (`@v6`) follows the moving tag, so only a major bump
 * is an action here. A fuller pin (`@v1.1.5`) is exact and any move counts.
 */
export function compareTagPin(ref: string, latestTag: string): TagVerdict {
    const current = parseTag(ref);
    const latest = parseTag(latestTag);
    if (!current || !latest) {
        return {
            needsUpdate: false,
            note: `cannot compare \`${ref}\` against \`${latestTag}\``,
        };
    }
    if (current.numbers.length > 1) {
        return { needsUpdate: ref !== latestTag };
    }
    if (current.numbers[0] !== latest.numbers[0]) {
        return { needsUpdate: true };
    }
    return ref === latestTag
        ? { needsUpdate: false }
        : {
              needsUpdate: false,
              note: `floating tag \`${ref}\` already tracks ${latestTag}`,
          };
}

type PinClassification = {
    pinStyle: PinStyle;
    flags: Flag[];
    trap?: string;
};

/**
 * A tag is mutable, so its author can move it onto a commit that reads whatever
 * secrets the job holds. That only matters for the workflows that hold any.
 */
export function classifyPin(
    ref: string,
    publishingWorkflows: string[]
): PinClassification {
    const pinStyle = pinStyleOf(ref);
    const flags: Flag[] = [];
    if (pinStyle === "mutable") flags.push("mutable-tag");

    if (publishingWorkflows.length === 0) {
        return {
            pinStyle,
            flags,
            ...(pinStyle === "mutable"
                ? {
                      trap: `\`${ref}\` is not a version, so what runs can change with no commit in this repo.`,
                  }
                : {}),
        };
    }

    flags.push("publishes-artifacts");
    if (pinStyle !== "sha") flags.push("unpinned-action");

    const where = publishingWorkflows.join(", ");
    return {
        pinStyle,
        flags,
        trap:
            pinStyle === "sha"
                ? `Runs in ${where}, which hold publishing credentials. Keep it sha-pinned.`
                : `Runs in ${where}, which hold publishing credentials. A moved tag would execute new code against those secrets.`,
    };
}

export function scanUses(files: Array<{ file: string; source: string }>): {
    pins: Pin[];
    localRefs: number;
} {
    const pins = new Map<string, Pin>();
    let localRefs = 0;

    for (const { file, source } of files) {
        const publishes = PUBLISH_SECRET.test(source);
        source.split("\n").forEach((line, index) => {
            const found = usesTarget(line);
            if (!found) return;
            if (isLocalUses(found.target)) {
                localRefs++;
                return;
            }
            const parsed = parseUses(line);
            if (!parsed) return;

            // Keyed by the literal ref: the same action pinned by sha in one
            // file and by tag in another is two findings, not one.
            const key = `${parsed.slug}@${parsed.ref}`;
            const pin = pins.get(key) ?? {
                ...parsed,
                locations: [],
                publishingWorkflows: [],
            };
            pin.locations.push({ file, line: index + 1 });
            if (publishes && !pin.publishingWorkflows.includes(file)) {
                pin.publishingWorkflows.push(file);
            }
            pins.set(key, pin);
        });
    }

    return { pins: [...pins.values()], localRefs };
}

async function applyLatest(
    item: InventoryItem,
    pin: Pin,
    pinStyle: PinStyle,
    latestTag: string
): Promise<void> {
    item.latest = latestTag;

    if (pinStyle === "mutable") {
        item.note = `\`${pin.ref}\` is a mutable ref; the newest release is ${latestTag}`;
        return;
    }

    if (pinStyle === "tag") {
        const verdict = compareTagPin(pin.ref, latestTag);
        item.needsUpdate = verdict.needsUpdate;
        if (verdict.note) item.note = verdict.note;
        item.delta = verdict.needsUpdate
            ? semverDelta(pin.ref, latestTag)
            : "none";
        // Resolved for tag pins too: the recommendation on a flagged pin is to move
        // to a sha, and the agent may not go discover one for itself.
        if (item.flags.includes("unpinned-action")) {
            const target = await resolveTagSha(pin.slug, latestTag);
            if (target) item.meta = { ...item.meta, latestSha: target };
        }
        return;
    }

    const sha = await resolveTagSha(pin.slug, latestTag);
    if (!sha) {
        item.flags.push("lookup-failed");
        item.note = "could not resolve the tag to a commit sha";
        return;
    }
    item.meta = { ...item.meta, latestSha: sha };
    item.needsUpdate = sha !== pin.ref;
    // A sha pin carries no version of its own; the trailing comment is the only claim.
    item.delta = item.needsUpdate
        ? semverDelta(pin.comment ?? "", latestTag)
        : "none";
}

async function resolvePin(pin: Pin): Promise<InventoryItem> {
    const { pinStyle, flags, trap } = classifyPin(
        pin.ref,
        pin.publishingWorkflows
    );
    const publishes = pin.publishingWorkflows.length > 0;

    const item: InventoryItem = {
        id: `action:${pin.slug}@${pinStyle === "sha" ? "sha" : pin.ref}`,
        kind: "github-action",
        name: pin.slug,
        surface: "ci",
        current:
            pinStyle === "sha"
                ? `${pin.ref.slice(0, 8)} (${pin.comment ?? "untagged"})`
                : pin.ref,
        latest: null,
        delta: pinStyle === "mutable" ? "unknown" : "none",
        needsUpdate: false,
        tier: "appendix",
        flags,
        source: `https://github.com/${pin.slug}`,
        homepage: `https://github.com/${pin.slug}/releases`,
        locations: pin.locations,
        meta: {
            pinStyle,
            currentRef: pin.ref,
            ...(pin.comment ? { commentedTag: pin.comment } : {}),
            ...(publishes
                ? { publishingWorkflows: pin.publishingWorkflows.join(", ") }
                : {}),
        },
        ...(trap ? { trap } : {}),
    };

    const latestTag = await githubLatestRelease(pin.slug);
    if (latestTag) {
        await applyLatest(item, pin, pinStyle, latestTag);
    } else {
        item.flags.push("lookup-failed");
        item.note = hasGithubToken()
            ? "no published release found"
            : "GitHub API lookup failed (set GITHUB_TOKEN)";
    }

    item.tier = tierFor(item);
    return item;
}

export async function collectCi(): Promise<InventoryItem[]> {
    log("→ GitHub Actions pins (.github/workflows, .github/actions)");
    const files = trackedFiles(
        ".github/workflows/*.yml",
        ".github/workflows/*.yaml",
        ".github/actions/**/action.yml",
        ".github/actions/**/action.yaml"
    ).map((file) => ({ file, source: readFileSync(file, "utf-8") }));

    const { pins, localRefs } = scanUses(files);
    log(
        `  ${pins.length} distinct pin(s) in ${files.length} file(s), ${localRefs} local composite reference(s) skipped`
    );

    return mapLimit(pins, 4, resolvePin);
}
