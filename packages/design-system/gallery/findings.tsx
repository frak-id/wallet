import { Badge } from "@frak-labs/design-system/components/Badge";
import { type ReactNode, useMemo } from "react";
import { findingList, findingsSummary, kindBadge } from "./gallery.css";
import { FindingMarkers } from "./markers";
import { sections } from "./sections";
import { findingsFor, markersFor } from "./shell";

const findings = new Map(sections.map((s) => [s.id, findingsFor(s.id)]));

export const totalFindings = [...findings.values()].reduce(
    (sum, f) => sum + f.length,
    0
);

export const findingCount = (sectionId: string) =>
    findings.get(sectionId)?.length ?? 0;

/** Lets every Case in the section show the kinds of known finding it has. */
export function SectionMarkers({
    sectionId,
    children,
}: {
    sectionId: string;
    children: ReactNode;
}) {
    const markers = useMemo(
        () => markersFor(findings.get(sectionId) ?? []),
        [sectionId]
    );
    return (
        <FindingMarkers.Provider value={markers}>
            {children}
        </FindingMarkers.Provider>
    );
}

export function FindingsDetails({
    sectionId,
    className,
    open,
}: {
    sectionId: string;
    className?: string;
    open?: boolean;
}) {
    const list = findings.get(sectionId) ?? [];
    return (
        <details className={className} key={sectionId} open={open}>
            <summary className={findingsSummary}>
                Known findings ({list.length})
            </summary>
            {list.length === 0 ? (
                <p>None recorded for this section.</p>
            ) : (
                <ul className={findingList}>
                    {list.map(({ kind, caseName, reason }) => (
                        <li key={`${kind}:${caseName}`}>
                            <Badge className={kindBadge}>{kind}</Badge>
                            <strong>{caseName}</strong>: {reason}
                        </li>
                    ))}
                </ul>
            )}
        </details>
    );
}
