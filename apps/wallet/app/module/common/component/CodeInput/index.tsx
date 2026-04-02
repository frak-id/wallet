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
    onChange,
    digitLabel,
    pasteLabel,
    error,
}: CodeInputProps) {
    const [digits, setDigits] = useState<string[]>(() =>
        Array.from({ length }, () => "")
    );
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Notify parent on change — ref avoids re-firing when callback identity changes
    useEffect(() => {
        onChangeRef.current?.(digits.join(""));
    }, [digits]);

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

            const digit = value.slice(-1);
            setDigit(index, digit);

            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        },
        [length, setDigit, sanitize]
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
            const text = await navigator.clipboard.readText();
            fillDigits(text);
        } catch {
            // Clipboard API not available or denied
        }
    }, [fillDigits]);

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
                        inputMode={mode === "numeric" ? "numeric" : "text"}
                        pattern={mode === "numeric" ? "[0-9]*" : undefined}
                        autoCapitalize={
                            mode === "alphanumeric" ? "characters" : undefined
                        }
                        maxLength={1}
                        value={digit}
                        placeholder={mode === "numeric" ? "0" : "A"}
                        className={`${styles.digitInput}${error ? ` ${styles.digitInputError}` : ""}`}
                        onChange={(e) => handleChange(index, e)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        aria-label={
                            digitLabel?.(index + 1) ?? `Digit ${index + 1}`
                        }
                    />
                ))}
            </div>
            {error && <p className={styles.errorMessage}>{error}</p>}
            {pasteLabel && (
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
