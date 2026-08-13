/** Where a param may arrive: `query` at load only, `both` also via the activation fragment. */
export type InstallParamTransport = "query" | "both";

export type InstallParamCodec<T> = {
    /** Returns `undefined` for anything the param cannot legally be. */
    decode: (raw: unknown) => T | undefined;
    transport: InstallParamTransport;
};

const str = (raw: unknown): string | undefined =>
    typeof raw === "string" ? raw : undefined;

const int = (raw: unknown): number | undefined => {
    const value = str(raw);
    if (value === undefined) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
};

/** A closed set of string values, for params that are enums rather than flags. */
const oneOf =
    <const T extends string>(...allowed: T[]) =>
    (raw: unknown): T | undefined => {
        const value = str(raw);
        return value !== undefined && allowed.includes(value as T)
            ? (value as T)
            : undefined;
    };

/**
 * The `/install` fragment contract: the SDK writes `p`/`sid`/`probe` once at
 * page load and rewrites the whole set plus `installed`/`dt`/`via` when its
 * post-install probe fires. See `03-sharing-and-install.md`, *Post-install
 * detection*. Deliberately not shared with `sharing`'s table — the two key
 * sets have nothing in common.
 */
export const INSTALL_PARAMS = {
    p: { decode: str, transport: "both" },
    sid: { decode: str, transport: "both" },
    probe: { decode: oneOf("ok", "disabled", "undeclared"), transport: "both" },
    installed: { decode: oneOf("1"), transport: "both" },
    dt: { decode: int, transport: "both" },
    via: { decode: oneOf("overlay", "product"), transport: "both" },
} as const satisfies Record<string, InstallParamCodec<unknown>>;

export type InstallParamKey = keyof typeof INSTALL_PARAMS;

/** The decoded shape of a fragment activation. */
export type InstallActivation = {
    [K in InstallParamKey]?: ReturnType<(typeof INSTALL_PARAMS)[K]["decode"]>;
};

export function installParamCodec(
    key: InstallParamKey
): InstallParamCodec<unknown> {
    return INSTALL_PARAMS[key];
}
