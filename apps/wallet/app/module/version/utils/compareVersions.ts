/**
 * Compares two dotted version strings (`major.minor.patch[.build]`).
 *
 * Returns `-1` when `a < b`, `0` when equal, `1` when `a > b`. Components
 * are compared as integers so `"1.10.0" > "1.9.0"`. Missing trailing
 * components default to `0` (`"1.0" === "1.0.0"`). Non-numeric pieces sort
 * to `0` rather than throwing — versioning across platforms (e.g. Play's
 * monotonic `versionCode` integer) must remain comparable.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const aParts = a.split(".");
    const bParts = b.split(".");
    const length = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < length; i++) {
        const aNum = Number.parseInt(aParts[i] ?? "0", 10);
        const bNum = Number.parseInt(bParts[i] ?? "0", 10);
        const aSafe = Number.isNaN(aNum) ? 0 : aNum;
        const bSafe = Number.isNaN(bNum) ? 0 : bNum;
        if (aSafe < bSafe) return -1;
        if (aSafe > bSafe) return 1;
    }
    return 0;
}

export function isBelow(current: string, threshold: string): boolean {
    return compareVersions(current, threshold) < 0;
}
