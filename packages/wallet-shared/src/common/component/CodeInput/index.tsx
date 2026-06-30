import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Button } from "@frak-labs/design-system/components/Button";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import {
    type ChangeEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import * as styles from "./index.css";

type CodeInputMode = "numeric" | "alphanumeric";

type CodeInputCommonProps = {
    /** Number of characters (default: 6) */
    length?: number;
    /** Input mode: "numeric" for digits only, "alphanumeric" for letters + digits (default: "numeric") */
    mode?: CodeInputMode;
    /**
     * Seeds the editable input with an initial code (e.g. a magic-link code)
     * while keeping it editable. Ignored in read-only mode.
     */
    defaultValue?: string;
    /** Called whenever the code value changes */
    onChange?: (code: string) => void;
    /** If provided, renders a clipboard paste button with this label */
    pasteLabel?: string;
    /**
     * Message shown when the clipboard read fails (denied / unavailable) —
     * without it the paste button fails silently.
     */
    pasteErrorLabel?: string;
    /** Error message — renders red borders + message below inputs */
    error?: string;
    /** When true, cells flex-grow to fill the row width (instead of fixed 41px) */
    fill?: boolean;
};

/**
 * `value` (read-only display) and the editable input are mutually exclusive:
 * editable mode requires `label` for an accessible name, read-only mode takes
 * none (its value is exposed to AT separately).
 */
type CodeInputProps = CodeInputCommonProps &
    (
        | {
              /** Pre-filled value — renders read-only display cells */
              value: string;
              label?: never;
          }
        | {
              value?: undefined;
              /** Accessible label for the editable code field (required) */
              label: string;
          }
    );

/**
 * Code input rendered as individual character boxes.
 *
 * In editable mode a single transparent `<input autocomplete="one-time-code">`
 * is overlaid on the boxes so the browser/OS can autofill verification codes
 * (iOS 17+ surfaces email-delivered codes) and handle caret/paste natively.
 * The boxes themselves are presentational and mirror the input's value.
 */
export function CodeInput({
    length = 6,
    mode = "numeric",
    value,
    defaultValue,
    onChange,
    label,
    pasteLabel,
    pasteErrorLabel,
    error,
    fill,
}: CodeInputProps) {
    const readOnly = value !== undefined;
    const sanitize = useCallback(
        (raw: string) =>
            (mode === "numeric"
                ? raw.replace(/\D/g, "")
                : raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
            ).slice(0, length),
        [mode, length]
    );

    const [code, setCode] = useState<string>(() =>
        sanitize(readOnly ? value : (defaultValue ?? ""))
    );
    const [clipboardFailed, setClipboardFailed] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Notify parent on change — ref avoids re-firing when callback identity changes
    useEffect(() => {
        onChangeRef.current?.(code);
    }, [code]);

    // Sync when external value changes
    useEffect(() => {
        if (value !== undefined) {
            setCode(sanitize(value));
        }
    }, [value, sanitize]);

    const handleChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setClipboardFailed(false);
            setCode(sanitize(e.target.value));
        },
        [sanitize]
    );

    const handlePasteFromClipboard = useCallback(async () => {
        try {
            let text: string;
            if (IS_TAURI) {
                const { readText } = await import(
                    "@tauri-apps/plugin-clipboard-manager"
                );
                text = await readText();
            } else {
                text = await navigator.clipboard.readText();
            }
            setClipboardFailed(false);
            setCode(sanitize(text));
            inputRef.current?.focus();
        } catch {
            // Clipboard API unavailable or denied — surface a hint and focus
            // the field so the user can paste/type manually.
            setClipboardFailed(true);
            inputRef.current?.focus();
        }
    }, [sanitize]);

    const placeholder = mode === "numeric" ? "0" : "A";
    // The cell awaiting input — null once the code is complete (no empty cell).
    const activeIndex = code.length < length ? code.length : null;
    const boxClassName = `${styles.digitBox}${error ? ` ${styles.digitBoxError}` : ""}${fill ? ` ${styles.digitBoxFill}` : ""}`;
    const containerClassName = `${styles.container}${fill ? ` ${styles.containerFill}` : ""}`;

    return (
        <>
            <div className={containerClassName}>
                {readOnly && code && (
                    // The display boxes are aria-hidden; expose the code to
                    // screen readers as spaced characters (read out one by one).
                    <span className={visuallyHidden}>
                        {code.split("").join(" ")}
                    </span>
                )}
                {!readOnly && (
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode={mode === "numeric" ? "numeric" : "text"}
                        pattern={mode === "numeric" ? "[0-9]*" : undefined}
                        autoComplete="one-time-code"
                        autoCapitalize={
                            mode === "alphanumeric" ? "characters" : undefined
                        }
                        // Suppress iOS autocorrect / QuickType suggestion bubble
                        // ("AS ✕") — a code is not a word to be corrected.
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={length}
                        value={code}
                        onChange={handleChange}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        aria-label={label}
                        aria-invalid={error ? true : undefined}
                        className={styles.hiddenInput}
                    />
                )}
                {Array.from({ length }, (_, index) => {
                    const char = code[index] ?? "";
                    const isActive =
                        !readOnly && focused && index === activeIndex;
                    return (
                        <div
                            key={index}
                            aria-hidden="true"
                            className={`${boxClassName}${isActive ? ` ${styles.digitBoxActive}` : ""}`}
                        >
                            {char ||
                                (!readOnly ? (
                                    <span className={styles.placeholder}>
                                        {placeholder}
                                    </span>
                                ) : (
                                    ""
                                ))}
                        </div>
                    );
                })}
            </div>
            {error && <p className={styles.errorMessage}>{error}</p>}
            {!readOnly && pasteLabel && (
                <Button
                    variant="secondary"
                    size="small"
                    width="auto"
                    className={styles.pasteButton}
                    onClick={handlePasteFromClipboard}
                >
                    {pasteLabel}
                </Button>
            )}
            {clipboardFailed && pasteErrorLabel && (
                <p className={styles.errorMessage}>{pasteErrorLabel}</p>
            )}
        </>
    );
}
