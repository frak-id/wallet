/** Parsed dotted-quad, or `undefined` when `host` is not one. */
function ipv4Octets(host: string): number[] | undefined {
    const parts = host.split(".");
    if (parts.length !== 4) return undefined;
    const octets = parts.map((part) =>
        /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN
    );
    return octets.every((octet) => octet >= 0 && octet <= 255)
        ? octets
        : undefined;
}

function isPrivateIPv4(octets: number[]): boolean {
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
}

/**
 * Prefix matching rather than a parser: this only has to reject. Covers loopback,
 * unique-local (`fc00::/7`), link-local (`fe80::/10`) and `::ffff:` mapped IPv4.
 */
function isPrivateIPv6(host: string): boolean {
    const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
    if (bare === "::1" || bare === "::") return true;
    if (/^f[cd]/.test(bare)) return true;
    if (/^fe[89ab]/.test(bare)) return true;
    // `::ffff:a.b.c.d` — the embedded address is what actually routes. `URL` normalises it
    // to hex (`::ffff:a00:1`), so the last two groups have to be decoded as well.
    const mappedIndex = bare.indexOf("::ffff:");
    if (mappedIndex === 0) {
        const mapped = bare.slice("::ffff:".length);
        const dotted = ipv4Octets(mapped);
        if (dotted) return isPrivateIPv4(dotted);
        const groups = mapped.split(":");
        if (
            groups.length === 2 &&
            groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))
        ) {
            const high = Number.parseInt(groups[0], 16);
            const low = Number.parseInt(groups[1], 16);
            return isPrivateIPv4([
                high >> 8,
                high & 0xff,
                low >> 8,
                low & 0xff,
            ]);
        }
    }
    return false;
}

/**
 * Whether a host is safe to hand to a fetcher. The Tauri wallet fetches share preview
 * images from the user's own machine, so a private target would lend it that position.
 * Name-based only: a public name resolving to a private address still passes.
 */
export function isPublicHost(host: string): boolean {
    const normalized = host.toLowerCase();
    if (!normalized) return false;
    if (normalized === "localhost" || normalized.endsWith(".localhost")) {
        return false;
    }
    if (normalized.endsWith(".local") || normalized.endsWith(".internal")) {
        return false;
    }
    const octets = ipv4Octets(normalized);
    if (octets) return !isPrivateIPv4(octets);
    if (normalized.includes(":") || normalized.startsWith("[")) {
        return !isPrivateIPv6(normalized);
    }
    // A single-label host is a LAN name (`router`, `intranet`) or a search-domain completion,
    // never a public one. https-only makes it hard to exploit, not safe to allow.
    if (!normalized.includes(".")) return false;
    if (normalized.endsWith(".home.arpa") || normalized.endsWith(".lan")) {
        return false;
    }
    return true;
}
