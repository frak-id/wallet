import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
    canvas,
    categoryHeading,
    chip,
    count,
    findingList,
    frame,
    frameBg,
    frameFixed,
    group,
    kind as kindChip,
    link,
    main,
    navLink,
    panel,
    search,
    sectionBox,
    shell,
    sidebar,
    toolbar,
    toolbarTitle,
} from "./gallery.css";
import { FindingMarkers } from "./markers";
import { categories, type GallerySection, sections } from "./sections";
import {
    backgrounds,
    findingsFor,
    markersFor,
    parseShell,
    type ShellState,
    serialiseShell,
    widths,
} from "./shell";

const ids = sections.map((s) => s.id);
const findings = new Map(sections.map((s) => [s.id, findingsFor(s.id)]));
const total = [...findings.values()].reduce((sum, f) => sum + f.length, 0);

function subscribe(onChange: () => void) {
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
}

function useShellState() {
    const hash = useSyncExternalStore(
        subscribe,
        () => window.location.hash,
        () => ""
    );
    return useMemo(() => parseShell(hash, ids), [hash]);
}

const hrefFor = (state: ShellState, patch: Partial<ShellState>) =>
    serialiseShell({ ...state, ...patch });

function Sidebar({ state }: { state: ShellState }) {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matches = (s: GallerySection) =>
        s.title.toLowerCase().includes(needle);
    const current = (id: string) =>
        state.section === id ? ("page" as const) : undefined;
    return (
        <aside className={sidebar}>
            <Box as="h1">
                <Text as="span" variant="heading3">
                    Design system gallery
                </Text>
            </Box>
            <label>
                <Text as="span" variant="bodySmall" color="secondary">
                    Filter sections
                </Text>
                <input
                    className={search}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </label>
            <nav aria-label="Sections">
                <a
                    className={navLink}
                    href={hrefFor(state, { section: "all" })}
                    aria-current={current("all")}
                >
                    All
                </a>
                {categories.map((category) => {
                    const items = sections.filter(
                        (s) => s.category === category && matches(s)
                    );
                    if (items.length === 0) return null;
                    return (
                        <section key={category}>
                            <h2 className={categoryHeading}>{category}</h2>
                            <ul>
                                {items.map(({ id, title }) => {
                                    const n = findings.get(id)?.length ?? 0;
                                    return (
                                        <li key={id}>
                                            <a
                                                className={navLink}
                                                href={hrefFor(state, {
                                                    section: id,
                                                })}
                                                aria-current={current(id)}
                                            >
                                                {title}
                                                {n > 0 && (
                                                    <span
                                                        className={count}
                                                        role="img"
                                                        aria-label={`${n} known finding${n === 1 ? "" : "s"}`}
                                                    >
                                                        {n}
                                                    </span>
                                                )}
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
                {!sections.some(matches) && (
                    <Text as="p" variant="bodySmall" color="secondary">
                        No sections match
                    </Text>
                )}
            </nav>
        </aside>
    );
}

function Choice<T extends string>({
    label,
    options,
    value,
    format = (option) => option,
    onChange,
}: {
    label: string;
    options: readonly T[];
    value: T;
    format?: (option: T) => string;
    onChange: (option: T) => void;
}) {
    return (
        <fieldset className={group} aria-labelledby={`${label}-label`}>
            <span id={`${label}-label`}>{label}</span>
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    className={chip}
                    aria-pressed={option === value}
                    onClick={() => onChange(option)}
                >
                    {format(option)}
                </button>
            ))}
        </fieldset>
    );
}

function Toolbar({ state, title }: { state: ShellState; title: string }) {
    const update = (patch: Partial<ShellState>) => {
        window.location.hash = hrefFor(state, patch);
    };
    const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1);
    return (
        <div className={toolbar}>
            <h2 className={toolbarTitle}>{title}</h2>
            <Choice
                label="Width"
                options={widths}
                value={state.width}
                format={capitalise}
                onChange={(width) => update({ width })}
            />
            <Choice
                label="Background"
                options={backgrounds}
                value={state.bg}
                format={capitalise}
                onChange={(bg) => update({ bg })}
            />
            {state.section !== "all" && (
                <a className={link} href={`?only=${state.section}`}>
                    Open alone
                </a>
            )}
        </div>
    );
}

function CanvasSection({
    id,
    title,
    render,
    titled,
}: GallerySection & { titled: boolean }) {
    const markers = useMemo(() => markersFor(findings.get(id) ?? []), [id]);
    return (
        <FindingMarkers.Provider value={markers}>
            <section
                className={titled ? sectionBox : undefined}
                data-gallery-section={id}
                aria-labelledby={titled ? `${id}-title` : undefined}
                aria-label={titled ? undefined : title}
            >
                <Stack space="l">
                    {titled && (
                        <Box as="h2" id={`${id}-title`}>
                            <Text as="span" variant="heading3">
                                {title}
                            </Text>
                        </Box>
                    )}
                    <Stack space="xl">{render()}</Stack>
                </Stack>
            </section>
        </FindingMarkers.Provider>
    );
}

function FindingsPanel({ sectionId }: { sectionId: string }) {
    if (sectionId === "all")
        return (
            <div className={panel}>
                {total} known findings across {sections.length} sections. Select
                a section to list them.
            </div>
        );
    const list = findings.get(sectionId) ?? [];
    return (
        <details className={panel} key={sectionId} open={list.length > 0}>
            <summary>Known findings ({list.length})</summary>
            {list.length === 0 ? (
                <p>None recorded for this section.</p>
            ) : (
                <ul className={findingList}>
                    {list.map(({ kind, caseName, reason }) => (
                        <li key={`${kind}:${caseName}`}>
                            <span className={kindChip}>{kind}</span>
                            <strong>{caseName}</strong>: {reason}
                        </li>
                    ))}
                </ul>
            )}
        </details>
    );
}

export function Shell() {
    const state = useShellState();
    const shown =
        state.section === "all"
            ? sections
            : sections.filter((s) => s.id === state.section);
    return (
        <div className={shell}>
            <Sidebar state={state} />
            <div className={main}>
                <Toolbar
                    state={state}
                    title={
                        state.section === "all"
                            ? "All sections"
                            : (shown[0]?.title ?? "")
                    }
                />
                <section
                    key={state.section}
                    className={canvas}
                    aria-label="Canvas"
                >
                    <div
                        className={[
                            frame,
                            frameBg[state.bg],
                            state.width !== "full" && frameFixed,
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        style={{
                            width:
                                state.width === "full"
                                    ? "100%"
                                    : Number(state.width),
                        }}
                    >
                        <Stack space="xxl">
                            {shown.map((s) => (
                                <CanvasSection
                                    key={s.id}
                                    {...s}
                                    titled={state.section === "all"}
                                />
                            ))}
                        </Stack>
                    </div>
                </section>
                <FindingsPanel sectionId={state.section} />
            </div>
        </div>
    );
}
