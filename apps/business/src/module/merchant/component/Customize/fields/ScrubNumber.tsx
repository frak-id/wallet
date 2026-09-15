import clsx from "clsx";
import type { KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import * as styles from "../styleControls.css";

const SCRUB_THRESHOLD = 3;
const SCRUB_DIVISOR = 2;
const STEP_LARGE = 10;

type DragState = { originX: number; start: number; active: boolean };

export type ScrubNumberProps = {
    value: number | undefined;
    onChange: (next: number | undefined) => void;
    ariaLabel: string;
    min?: number;
    max?: number;
    testId?: string;
    tone?: "padding" | "margin";
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parse(raw: string, min: number, max: number): number | undefined {
    if (raw.trim() === "") return undefined;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : undefined;
}

/**
 * Compact numeric cell that also scrubs on horizontal drag. An empty value
 * means "inherit the theme", which is why it never falls back to zero.
 */
export function ScrubNumber({
    value,
    onChange,
    ariaLabel,
    min = 0,
    max = 200,
    testId,
    tone = "padding",
}: ScrubNumberProps) {
    const drag = useRef<DragState | null>(null);
    const [scrubbing, setScrubbing] = useState(false);

    function onPointerDown(event: PointerEvent<HTMLInputElement>) {
        if (event.button !== 0) return;
        drag.current = {
            originX: event.clientX,
            start: value ?? 0,
            active: false,
        };
    }

    function onPointerMove(event: PointerEvent<HTMLInputElement>) {
        const state = drag.current;
        if (!state) return;
        const delta = event.clientX - state.originX;
        if (!state.active) {
            if (Math.abs(delta) < SCRUB_THRESHOLD) return;
            state.active = true;
            setScrubbing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        // `user-select` does not apply to editable form controls, so the
        // native selection drag has to be cancelled here instead.
        event.preventDefault();
        onChange(
            clamp(state.start + Math.round(delta / SCRUB_DIVISOR), min, max)
        );
    }

    function onPointerUp(event: PointerEvent<HTMLInputElement>) {
        const state = drag.current;
        drag.current = null;
        if (!state?.active) return;
        setScrubbing(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        const direction =
            event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (direction === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? STEP_LARGE : 1;
        onChange(clamp((value ?? 0) + direction * step, min, max));
    }

    return (
        <input
            type="text"
            inputMode="numeric"
            className={clsx(
                styles.scrubInput,
                tone === "margin" && styles.scrubInputMargin,
                scrubbing && styles.scrubInputActive
            )}
            aria-label={ariaLabel}
            data-testid={testId}
            placeholder="–"
            value={value ?? ""}
            onChange={(event) => onChange(parse(event.target.value, min, max))}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
        />
    );
}
