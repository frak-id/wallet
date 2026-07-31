/**
 * Mobile app identifier shape, shared by the dashboard's input gate and the
 * backend route that stores it.
 *
 * Covers both an Android package name (`com.example.myapp`) and an iOS bundle
 * id, including the optional team-id prefix (`57DZ6Z2235.com.example.MyApp`).
 * At least two dot-separated segments: a single bare word resolves to nothing
 * and is always a typo.
 *
 * Tested against the lowercased form, since ids are lowercased on write and on
 * read — an id is case-sensitive in principle, but admins typo case and the
 * failure mode is a 404 that looks exactly like a broken SDK.
 */
export const PACKAGE_ID_REGEX = /^[a-z0-9_]+(\.[a-z0-9_-]+)+$/;

/**
 * Whitespace- and case-tolerant validity check, applying the same `trim()` and
 * lowercasing the backend does before storing.
 */
export function isValidPackageId(value: string): boolean {
    return PACKAGE_ID_REGEX.test(value.trim().toLowerCase());
}
