import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    type ChangeEvent,
    type ClipboardEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import * as styles from "./index.css";

type CodeInputMode = "numeric" | "alphanumeric";

type CodeInputProps = {
    /** Number of characters (default: 6) */
    length?: number;
    /** Input mode: "numeric" for digits only, "alphanumeric" for letters + digits (default: "numeric") */
    mode?: CodeInputMode;
    /** Pre-filled value — when set the inputs become read-only display boxes */
    value?: string;
    /** Called whenever the code value changes */
    onChange?: (code: string) => void;
    /** Accessible label for each input cell (receives 1-based index) */
    digitLabel?: (index: number) => string;
    /** If provided, renders a clipboard paste button with this label */
    pasteLabel?: string;
    /** Error message — renders red borders + message below inputs */
    error?: string;
};

/**
 * Code input with individual character boxes.
 *
 * Supports numeric-only and alphanumeric modes.
 * Handles auto-advance, backspace navigation, and paste (both via keyboard and clipboard API).
 */
export function CodeInput({
    length = 6,
    mode = "numeric",
    value,
    onChange,
    digitLabel,
    pasteLabel,
    error,
}: CodeInputProps) {
    const readOnly = value !== undefined;
    const [digits, setDigits] = useState<string[]>(() =>
        readOnly
            ? Array.from({ length }, (_, i) => value[i] ?? "")
            : Array.from({ length }, () => "")
    );
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Notify parent on change — ref avoids re-firing when callback identity changes
    useEffect(() => {
        onChangeRef.current?.(digits.join(""));
    }, [digits]);

    // Sync digits when external value changes
    useEffect(() => {
        if (value !== undefined) {
            setDigits(Array.from({ length }, (_, i) => value[i] ?? ""));
        }
    }, [value, length]);

    const sanitize = useCallback(
        (raw: string) =>
            mode === "numeric"
                ? raw.replace(/\D/g, "")
                : raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
        [mode]
    );

    const setDigit = useCallback((index: number, value: string) => {
        setDigits((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    }, []);

    const fillDigits = useCallback(
        (raw: string) => {
            const cleaned = sanitize(raw).slice(0, length);
            if (!cleaned) return;

            const newDigits = Array.from(
                { length },
                (_, i) => cleaned[i] ?? ""
            );
            setDigits(newDigits);

            const nextEmpty = newDigits.findIndex((d) => !d);
            const focusIndex = nextEmpty === -1 ? length - 1 : nextEmpty;
            inputRefs.current[focusIndex]?.focus();
        },
        [length, sanitize]
    );

    const handleChange = useCallback(
        (index: number, e: ChangeEvent<HTMLInputElement>) => {
            const value = sanitize(e.target.value);
            if (!value) return;

            // Multi-character input (paste, autofill) → distribute across inputs
            if (value.length > 1) {
                fillDigits(value);
                return;
            }

            setDigit(index, value);

            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        },
        [length, setDigit, sanitize, fillDigits]
    );

    const handleKeyDown = useCallback(
        (index: number, e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace") {
                if (digits[index]) {
                    setDigit(index, "");
                } else if (index > 0) {
                    setDigit(index - 1, "");
                    inputRefs.current[index - 1]?.focus();
                }
            }
        },
        [digits, setDigit]
    );

    const handlePaste = useCallback(
        (e: ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            fillDigits(e.clipboardData.getData("text"));
        },
        [fillDigits]
    );

    const handlePasteFromClipboard = useCallback(async () => {
        try {
            let text: string;
            if (isTauri()) {
                const { readText } = await import(
                    "@tauri-apps/plugin-clipboard-manager"
                );
                text = await readText();
            } else {
                text = await navigator.clipboard.readText();
            }
            fillDigits(text);
        } catch {
            // Clipboard API unavailable or denied — focus first input for manual paste
            inputRefs.current[0]?.focus();
        }
    }, [fillDigits]);

    const inputMode = readOnly
        ? undefined
        : mode === "numeric"
          ? "numeric"
          : "text";
    const placeholder = readOnly ? undefined : mode === "numeric" ? "0" : "A";
    const digitClassName = `${styles.digitInput}${error ? ` ${styles.digitInputError}` : ""}${readOnly ? ` ${styles.digitInputReadOnly}` : ""}`;

    return (
        <>
            <div className={styles.container}>
                {digits.map((digit, index) => (
                    <input
                        key={index}
                        ref={(el) => {
                            inputRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode={inputMode}
                        pattern={mode === "numeric" ? "[0-9]*" : undefined}
                        autoCapitalize={
                            mode === "alphanumeric" ? "characters" : undefined
                        }
                        maxLength={length}
                        value={digit}
                        readOnly={readOnly}
                        tabIndex={readOnly ? -1 : undefined}
                        placeholder={placeholder}
                        className={digitClassName}
                        onChange={
                            readOnly ? undefined : (e) => handleChange(index, e)
                        }
                        onKeyDown={
                            readOnly
                                ? undefined
                                : (e) => handleKeyDown(index, e)
                        }
                        onPaste={readOnly ? undefined : handlePaste}
                        onFocus={
                            readOnly ? undefined : (e) => e.target.select()
                        }
                        aria-label={
                            digitLabel?.(index + 1) ?? `Digit ${index + 1}`
                        }
                    />
                ))}
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
        </>
    );
}
