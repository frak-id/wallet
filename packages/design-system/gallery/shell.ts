import { knownFindings } from "./specs/known-findings";

export const widths = ["320", "390", "768", "full"] as const;
export const backgrounds = ["page", "card"] as const;

export type ShellState = {
    section: string;
    width: (typeof widths)[number];
    bg: (typeof backgrounds)[number];
};

export const defaultShell: ShellState = {
    section: "all",
    width: "full",
    bg: "page",
};

function oneOf<T extends string>(
    options: readonly T[],
    value: string | null,
    fallback: T
): T {
    return options.find((option) => option === value) ?? fallback;
}

/** Unknown values fall back to the defaults, so a stale link never breaks the page. */
export function parseShell(
    hash: string,
    sectionIds: readonly string[]
): ShellState {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    return {
        section: oneOf(
            ["all", ...sectionIds],
            params.get("section"),
            defaultShell.section
        ),
        width: oneOf(widths, params.get("width"), defaultShell.width),
        bg: oneOf(backgrounds, params.get("bg"), defaultShell.bg),
    };
}

/** Defaults are omitted, so the bare gallery URL stays the "All" view. */
export function serialiseShell(state: ShellState): string {
    const params = new URLSearchParams();
    for (const key of ["section", "width", "bg"] as const) {
        if (state[key] !== defaultShell[key]) params.set(key, state[key]);
    }
    return `#${params}`;
}

export type Finding = {
    kind: "overflow" | "focus";
    caseName: string;
    reason: string;
};

/** Keys are `<kind>:<section id>:<case name>`; case names contain colons too. */
export function findingsFor(
    sectionId: string,
    findings: Record<string, string> = knownFindings
): Finding[] {
    return Object.entries(findings).flatMap(([key, reason]) => {
        const [kind, id, ...rest] = key.split(":");
        if (id !== sectionId || (kind !== "overflow" && kind !== "focus"))
            return [];
        return [{ kind, caseName: rest.join(":"), reason }];
    });
}

export type Markers = ReadonlyMap<string, readonly Finding["kind"][]>;

export function markersFor(findings: readonly Finding[]): Markers {
    const markers = new Map<string, Finding["kind"][]>();
    for (const { caseName, kind } of findings)
        markers.set(caseName, [...(markers.get(caseName) ?? []), kind]);
    return markers;
}
