import { Button } from "@frak-labs/design-system/components/Button";
import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    CloseCircleIcon,
    CloseIcon,
    ErrorFilledIcon,
    SearchIcon,
} from "@frak-labs/design-system/icons";
import { continents } from "countries-list";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    COUNTRIES,
    COUNTRIES_BY_CONTINENT,
    type ContinentCode,
    NAME_BY_CODE,
} from "./countries";
import * as styles from "./countrySelect.css";

/** Continents in the order the map declares them, each with its countries. */
const CONTINENT_GROUPS = (Object.keys(continents) as ContinentCode[]).map(
    (code) => ({
        code,
        name: continents[code],
        countries: COUNTRIES_BY_CONTINENT.get(code) ?? [],
    })
);

type ContinentState = boolean | "indeterminate";

/** Per-continent tri-state (off / all / partial) for the current selection. */
function computeContinentStates(
    selected: Set<string>
): Map<ContinentCode, ContinentState> {
    const states = new Map<ContinentCode, ContinentState>();
    for (const group of CONTINENT_GROUPS) {
        const total = group.countries.length;
        let count = 0;
        for (const c of group.countries) {
            if (selected.has(c.code)) count++;
        }
        const state: ContinentState =
            count === 0 ? false : count === total ? true : "indeterminate";
        states.set(group.code, state);
    }
    return states;
}

type CountrySelectProps = {
    value: string[];
    onChange: (value: string[]) => void;
    error?: boolean;
};

export function CountrySelect({ value, onChange, error }: CountrySelectProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<ContinentCode>>(new Set());

    const selected = useMemo(() => new Set(value), [value]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return null;
        return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
    }, [search]);

    function toggleCountry(code: string) {
        const next = new Set(selected);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        onChange([...next]);
    }

    /** Continent tri-state, recomputed only when the selection changes. */
    const continentStates = useMemo(
        () => computeContinentStates(selected),
        [selected]
    );

    function toggleContinent(continent: ContinentCode) {
        const countries = COUNTRIES_BY_CONTINENT.get(continent);
        if (!countries) return;
        const allSelected = countries.every((c) => selected.has(c.code));
        const next = new Set(selected);
        for (const c of countries) {
            if (allSelected) next.delete(c.code);
            else next.add(c.code);
        }
        onChange([...next]);
    }

    function toggleExpand(continent: ContinentCode) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(continent)) next.delete(continent);
            else next.add(continent);
            return next;
        });
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div
                    className={`${styles.trigger}${error ? ` ${styles.triggerError}` : ""}`}
                >
                    <div
                        className={`${styles.triggerContent}${value.length > 0 ? ` ${styles.triggerContentFilled}` : ""}`}
                    >
                        {value.length > 0 && (
                            <span className={styles.fieldLabel}>
                                {t(
                                    "campaigns.create.territory.card.placeholder"
                                )}
                            </span>
                        )}
                        {value.length === 0 ? (
                            <span className={styles.placeholder}>
                                {t(
                                    "campaigns.create.territory.card.placeholder"
                                )}
                            </span>
                        ) : (
                            <div className={styles.chips}>
                                {value.map((code) => (
                                    <span key={code} className={styles.chip}>
                                        <Text
                                            variant="bodySmall"
                                            color="primary"
                                        >
                                            {NAME_BY_CODE.get(code) ?? code}
                                        </Text>
                                        <button
                                            type="button"
                                            className={styles.chipRemove}
                                            aria-label={`Remove ${NAME_BY_CODE.get(code) ?? code}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCountry(code);
                                            }}
                                        >
                                            <CloseIcon width={12} height={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <span className={styles.right}>
                        {error && (
                            <ErrorFilledIcon
                                width={24}
                                height={24}
                                className={styles.errorIcon}
                            />
                        )}
                        {value.length > 0 && (
                            <button
                                type="button"
                                className={styles.clearButton}
                                aria-label={t("common.clearAll")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange([]);
                                }}
                            >
                                <CloseCircleIcon width={24} height={24} />
                            </button>
                        )}
                        {open ? (
                            <ChevronUpIcon width={24} height={24} />
                        ) : (
                            <ChevronDownIcon width={24} height={24} />
                        )}
                    </span>
                </div>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={8}
                className={styles.content}
            >
                <div className={styles.searchRow}>
                    <input
                        className={styles.searchInput}
                        aria-label={t("campaigns.create.territory.card.search")}
                        placeholder={t(
                            "campaigns.create.territory.card.search"
                        )}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <SearchIcon
                        width={24}
                        height={24}
                        className={styles.searchIcon}
                    />
                </div>
                <div className={styles.list}>
                    {filtered ? (
                        filtered.length > 0 ? (
                            filtered.map((c) => (
                                <label
                                    key={c.code}
                                    htmlFor={`country-${c.code}`}
                                    className={styles.countryLabel}
                                >
                                    <Checkbox
                                        id={`country-${c.code}`}
                                        size="l"
                                        checked={selected.has(c.code)}
                                        onCheckedChange={() =>
                                            toggleCountry(c.code)
                                        }
                                    />
                                    <Text variant="body">{c.name}</Text>
                                </label>
                            ))
                        ) : (
                            <div className={styles.empty}>
                                <Stack space="m" align="center">
                                    <div className={styles.emptyBadge}>
                                        <SearchIcon width={24} height={24} />
                                    </div>
                                    <Stack space="xs" align="center">
                                        <Text variant="heading2" align="center">
                                            {t(
                                                "campaigns.create.territory.card.noResults.title"
                                            )}
                                        </Text>
                                        <Text
                                            variant="body"
                                            color="secondary"
                                            align="center"
                                        >
                                            {t(
                                                "campaigns.create.territory.card.noResults.description",
                                                { query: search.trim() }
                                            )}
                                        </Text>
                                    </Stack>
                                </Stack>
                                <Button
                                    variant="primary"
                                    size="large"
                                    width="auto"
                                    onClick={() => setSearch("")}
                                >
                                    {t(
                                        "campaigns.create.territory.card.noResults.clear"
                                    )}
                                </Button>
                            </div>
                        )
                    ) : (
                        CONTINENT_GROUPS.map((group) => (
                            <div key={group.code}>
                                <div className={styles.row}>
                                    <Checkbox
                                        size="l"
                                        checked={
                                            continentStates.get(group.code) ??
                                            false
                                        }
                                        onCheckedChange={() =>
                                            toggleContinent(group.code)
                                        }
                                    />
                                    <button
                                        type="button"
                                        className={styles.expandButton}
                                        onClick={() => toggleExpand(group.code)}
                                    >
                                        {expanded.has(group.code) ? (
                                            <ChevronUpIcon
                                                width={16}
                                                height={16}
                                            />
                                        ) : (
                                            <ChevronDownIcon
                                                width={16}
                                                height={16}
                                            />
                                        )}
                                        <Text variant="body">{group.name}</Text>
                                    </button>
                                </div>
                                {expanded.has(group.code) &&
                                    group.countries.map((c) => (
                                        <label
                                            key={c.code}
                                            htmlFor={`country-${c.code}`}
                                            className={`${styles.row} ${styles.rowCountry}`}
                                        >
                                            <Checkbox
                                                id={`country-${c.code}`}
                                                size="l"
                                                checked={selected.has(c.code)}
                                                onCheckedChange={() =>
                                                    toggleCountry(c.code)
                                                }
                                            />
                                            <Text variant="body">{c.name}</Text>
                                        </label>
                                    ))}
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
