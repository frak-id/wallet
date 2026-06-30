import { continents, getCountryDataList } from "countries-list";

export type ContinentCode = keyof typeof continents;
export type Country = { code: string; name: string; continent: ContinentCode };

/**
 * Country list keyed by ISO-3166 alpha-2 code — the canonical value stored in
 * `metadata.territories`. Names are display-only.
 */
export const COUNTRIES: Country[] = getCountryDataList()
    .map((c) => ({
        code: c.iso2,
        name: c.name,
        continent: c.continent as ContinentCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const NAME_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]));

/** Display name for an ISO-3166 alpha-2 code (falls back to the code). */
export function getCountryName(code: string): string {
    return NAME_BY_CODE.get(code) ?? code;
}

/** Countries grouped by continent — one pass, O(1) lookup by code. */
export const COUNTRIES_BY_CONTINENT = (() => {
    const map = new Map<ContinentCode, Country[]>(
        (Object.keys(continents) as ContinentCode[]).map((c) => [c, []])
    );
    for (const country of COUNTRIES) {
        map.get(country.continent)?.push(country);
    }
    return map;
})();
