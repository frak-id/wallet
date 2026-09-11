/** Returns `undefined` for anything the param cannot legally be. */
type InstallParamDecoder<T> = (raw: unknown) => T | undefined;

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
 * post-install probe fires. Deliberately not shared with `sharing`'s table
 * — the two key sets have nothing in common.
 */
export const INSTALL_PARAMS = {
    p: str,
    sid: str,
    probe: oneOf("ok", "disabled", "undeclared"),
    installed: oneOf("1"),
    dt: int,
    via: oneOf("overlay", "product"),
} as const satisfies Record<string, InstallParamDecoder<unknown>>;

export type InstallParamKey = keyof typeof INSTALL_PARAMS;

/** The decoded shape of a fragment activation. */
export type InstallActivation = {
    [K in InstallParamKey]?: ReturnType<(typeof INSTALL_PARAMS)[K]>;
};
