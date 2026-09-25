/**
 * The contract between the deterministic collectors and everything downstream.
 *
 * A version that is not in the emitted inventory may never reach the report: the
 * agent explains deltas, it does not discover them. A collector that cannot
 * resolve something emits `latest: null` with `lookup-failed` rather than a guess.
 */

/** Which section of the report an item lands in. */
export type Surface = "npm" | "cargo" | "infra" | "ci";

export type Kind =
    | "npm"
    | "cargo"
    | "pulumi-provider"
    | "image"
    | "github-action";

/**
 * `research` items get a written entry. `appendix` items are rendered
 * mechanically by the upsert, never read by the agent — that is the npm minor
 * and patch tail.
 */
export type Tier = "research" | "appendix";

export type Delta = "major" | "minor" | "patch" | "none" | "unknown";

/**
 * A machine-checkable property of an item that matters regardless of version
 * delta. Any flag promotes the item to `research`.
 */
export type Flag =
    | "mutable-tag"
    | "unpinned-action"
    | "publishes-artifacts"
    | "deprecated"
    | "floor-coupled"
    | "paired"
    | "lookup-failed";

export type Location = { file: string; line: number };

export type InventoryItem = {
    /** Stable across runs, so a reader can diff against last week's issue. */
    id: string;
    kind: Kind;
    name: string;
    surface: Surface;
    current: string;
    latest: string | null;
    delta: Delta;
    needsUpdate: boolean;
    tier: Tier;
    flags: Flag[];
    /** Registry or repository the version was resolved against. */
    source: string;
    locations: Location[];
    /**
     * Workspace directories that declare this pin, `.` for the repo root. One
     * entry means the report writes it under that project; several mean it is a
     * cross-project pin, which for npm is a catalog entry.
     */
    projects?: string[];
    homepage?: string;
    meta?: Record<string, string>;
    /** Why `latest` is null, or why the pin is unresolvable. */
    note?: string;
    /** A repo rule that changes what this upgrade costs here. */
    trap?: string;
};

/**
 * A gated floor. Emitted as fact so the agent can flag a bump that would cross
 * one without scanning for it.
 */
export type Floor = {
    id: string;
    value: string;
    /** The command that fails when the floor is crossed. */
    gate: string;
    why: string;
};

export type Inventory = {
    generatedAt: string;
    repo: string;
    floors: Floor[];
    counts: {
        total: number;
        outdated: number;
        research: number;
        appendix: number;
        flagged: number;
        errors: number;
        bySurface: Record<Surface, number>;
    };
    items: InventoryItem[];
};

/** Strip a range operator so `^4.33.0` compares against `4.34.0`. */
export function stripRange(version: string): string {
    return version.replace(/^[\^~><=\s]+/, "").trim();
}

/**
 * Semver distance between two versions. `unknown` covers anything either side
 * cannot be read as numeric — a git ref, a tag series, a date stamp.
 */
export function semverDelta(current: string, latest: string): Delta {
    if (current === latest) return "none";
    const parse = (v: string): number[] | null => {
        const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(stripRange(v));
        if (!match) return null;
        return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
    };
    const a = parse(current);
    const b = parse(latest);
    if (!a || !b) return "unknown";
    if (a[0] !== b[0]) return "major";
    if (a[1] !== b[1]) return "minor";
    if (a[2] !== b[2]) return "patch";
    return "none";
}

/**
 * Flags that are a finding on their own. The rest (`floor-coupled`, `paired`)
 * only describe what an upgrade would cost, so they say nothing about an item
 * that is already current.
 */
const STANDALONE_FINDINGS: Flag[] = [
    "mutable-tag",
    "unpinned-action",
    "deprecated",
    "lookup-failed",
];

/**
 * The one place tiering is decided. npm and cargo are the only surfaces large
 * enough to drown the report, so they are the only ones whose routine bumps are
 * demoted to the mechanical appendix.
 */
export function tierFor(
    item: Pick<InventoryItem, "surface" | "delta" | "flags" | "needsUpdate">
): Tier {
    const standalone = item.flags.some((flag) =>
        STANDALONE_FINDINGS.includes(flag)
    );
    if (standalone) return "research";
    if (!item.needsUpdate) return "appendix";
    if (item.flags.length > 0) return "research";
    if (item.surface !== "npm" && item.surface !== "cargo") return "research";
    return item.delta === "major" || item.delta === "unknown"
        ? "research"
        : "appendix";
}
