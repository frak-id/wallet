import { LinkIcon } from "@frak-labs/design-system/icons";
import clsx from "clsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarginKey, PaddingKey } from "../style/styleCodec";
import * as styles from "../styleControls.css";
import type { ButtonShareStyleValues, SpacingUnit } from "../types";
import { ScrubNumber } from "./ScrubNumber";

const MARGIN_MAX = 120;
const PADDING_MAX = 80;
const PERCENT_MAX = 100;

type Patch = Partial<
    Pick<
        ButtonShareStyleValues,
        "py" | "px" | "pu" | "mt" | "mb" | "ml" | "mr" | "mu"
    >
>;

type MarginSide = MarginKey;
type PaddingAxis = PaddingKey;
type Edge = "top" | "bottom" | "left" | "right";

function ceiling(unit: SpacingUnit, pixelMax: number): number {
    return unit === "%" ? PERCENT_MAX : pixelMax;
}

const MARGIN_LABELS = {
    mt: "customize.components.style.marginTop",
    mb: "customize.components.style.marginBottom",
    ml: "customize.components.style.marginLeft",
    mr: "customize.components.style.marginRight",
} as const;

// Each axis renders on two opposite edges, so the labels name the edge the
// control sits on rather than announcing one axis name twice.
const PADDING_LABELS = {
    top: "customize.components.style.paddingTop",
    bottom: "customize.components.style.paddingBottom",
    left: "customize.components.style.paddingLeft",
    right: "customize.components.style.paddingRight",
} as const;

export type BoxModelControlProps = {
    values: ButtonShareStyleValues;
    onChange: (patch: Patch) => void;
    /** Rendered in the core cell so spacing is judged against real wording. */
    previewLabel: string;
    /** Scopes the link toggles, which are per-placement UI state. */
    tier: string;
};

type LinkOverride = { tier: string; padding: boolean; margin: boolean };

function LinkToggle({
    pressed,
    onToggle,
    label,
    className,
    testId,
}: {
    pressed: boolean;
    onToggle: () => void;
    label: string;
    className: string;
    testId: string;
}) {
    return (
        <button
            type="button"
            className={clsx(styles.linkToggle, className)}
            aria-pressed={pressed}
            aria-label={label}
            title={label}
            data-testid={testId}
            onClick={onToggle}
        >
            <LinkIcon width={12} height={12} />
        </button>
    );
}

function allEqual(entries: (number | undefined)[]): boolean {
    return entries.every((entry) => entry === entries[0]);
}

function UnitToggle({
    unit,
    onToggle,
    label,
    className,
    testId,
}: {
    unit: SpacingUnit;
    onToggle: (next: SpacingUnit) => void;
    label: string;
    className: string;
    testId: string;
}) {
    return (
        <button
            type="button"
            className={clsx(styles.unitToggle, className)}
            aria-label={label}
            title={label}
            data-testid={testId}
            onClick={() => onToggle(unit === "px" ? "%" : "px")}
        >
            {unit}
        </button>
    );
}

/**
 * Padding and margin as one box-model widget. Padding is axis-only because
 * that is what the codec stores, so an edge edits the axis it belongs to.
 */
export function BoxModelControl({
    values,
    onChange,
    previewLabel,
    tier,
}: BoxModelControlProps) {
    const { t } = useTranslation();

    // Equality is the default reading; a deliberate toggle sticks, but only
    // for the tier it was made on. Re-derived rather than initialised once,
    // because the form re-syncs a placement's values after the render that
    // switched to it.
    const [override, setOverride] = useState<LinkOverride | null>(null);
    const linked =
        override?.tier === tier
            ? override
            : {
                  padding: values.py === values.px,
                  margin: allEqual([
                      values.mt,
                      values.mb,
                      values.ml,
                      values.mr,
                  ]),
              };
    const { padding: paddingLinked, margin: marginLinked } = linked;
    const setLinked = (next: Partial<Omit<LinkOverride, "tier">>) =>
        setOverride({ tier, ...linked, ...next });

    const paddingUnit = values.pu ?? "px";
    const marginUnit = values.mu ?? "px";
    const paddingMax = ceiling(paddingUnit, PADDING_MAX);
    const marginMax = ceiling(marginUnit, MARGIN_MAX);

    const setPadding = (axis: PaddingAxis, next: number | undefined) =>
        onChange(paddingLinked ? { py: next, px: next } : { [axis]: next });

    const setMargin = (side: MarginSide, next: number | undefined) =>
        onChange(
            marginLinked
                ? { mt: next, mb: next, ml: next, mr: next }
                : { [side]: next }
        );

    // Switching to % narrows the range, so anything above it is pulled down
    // rather than silently emitting an out-of-range declaration.
    const capped = (value: number | undefined, max: number) =>
        value === undefined ? undefined : Math.min(value, max);

    const setPaddingUnit = (pu: SpacingUnit) => {
        const max = ceiling(pu, PADDING_MAX);
        onChange({
            pu,
            py: capped(values.py, max),
            px: capped(values.px, max),
        });
    };

    const setMarginUnit = (mu: SpacingUnit) => {
        const max = ceiling(mu, MARGIN_MAX);
        onChange({
            mu,
            mt: capped(values.mt, max),
            mb: capped(values.mb, max),
            ml: capped(values.ml, max),
            mr: capped(values.mr, max),
        });
    };

    const margin = (side: MarginSide) => (
        <ScrubNumber
            tone="margin"
            value={values[side]}
            onChange={(next) => setMargin(side, next)}
            ariaLabel={t(MARGIN_LABELS[side])}
            testId={`boxModel-${side}`}
            max={marginMax}
        />
    );

    const padding = (axis: PaddingAxis, edge: Edge, testId: string) => (
        <ScrubNumber
            value={values[axis]}
            onChange={(next) => setPadding(axis, next)}
            ariaLabel={t(PADDING_LABELS[edge])}
            testId={testId}
            max={paddingMax}
        />
    );

    return (
        <div className={styles.marginBox} data-testid="boxModel">
            <span className={styles.boxCaption}>
                {t("customize.components.style.boxMargin")}
            </span>
            <LinkToggle
                pressed={marginLinked}
                onToggle={() => setLinked({ margin: !marginLinked })}
                label={t("customize.components.style.linkMargin")}
                className={styles.marginLink}
                testId="boxModel-margin-link"
            />
            <UnitToggle
                unit={marginUnit}
                onToggle={setMarginUnit}
                label={t("customize.components.style.unitMargin")}
                className={styles.marginUnit}
                testId="boxModel-margin-unit"
            />

            <div className={styles.cellTop}>{margin("mt")}</div>
            <div className={styles.cellLeft}>{margin("ml")}</div>
            <div className={styles.cellRight}>{margin("mr")}</div>
            <div className={styles.cellBottom}>{margin("mb")}</div>

            <div className={styles.paddingBox}>
                <span className={styles.boxCaption}>
                    {t("customize.components.style.boxPadding")}
                </span>
                <LinkToggle
                    pressed={paddingLinked}
                    onToggle={() => setLinked({ padding: !paddingLinked })}
                    label={t("customize.components.style.linkPadding")}
                    className={styles.paddingLink}
                    testId="boxModel-padding-link"
                />
                <UnitToggle
                    unit={paddingUnit}
                    onToggle={setPaddingUnit}
                    label={t("customize.components.style.unitPadding")}
                    className={styles.paddingUnit}
                    testId="boxModel-padding-unit"
                />

                <div className={styles.cellTop}>
                    {padding("py", "top", "boxModel-py")}
                </div>
                <div className={styles.cellLeft}>
                    {padding("px", "left", "boxModel-px")}
                </div>
                <div className={styles.cellRight}>
                    {padding("px", "right", "boxModel-px-mirror")}
                </div>
                <div className={styles.cellBottom}>
                    {padding("py", "bottom", "boxModel-py-mirror")}
                </div>

                <div className={styles.boxCore}>{previewLabel}</div>
            </div>
        </div>
    );
}
