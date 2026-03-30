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

type CodeInputProps = {
    /** Number of digits (default: 6) */
    length?: number;
    /** Called whenever the code value changes */
    onChange?: (code: string) => void;
    /** Accessible label for each digit input (receives 1-based index) */
    digitLabel?: (index: number) => string;
    /** If provided, renders a clipboard paste button with this label */
    pasteLabel?: string;
    /** Error message — renders red borders + message below digits */
    error?: string;
};

/**
 * Numeric code input with individual digit boxes.
 *
 * Handles auto-advance, backspace navigation, and paste (both via keyboard and clipboard API).
 */
export function CodeInput({
    length = 6,
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

    const setDigit = useCallback((index: number, value: string) => {
        setDigits((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    }, []);

    const fillDigits = useCallback(
        (raw: string) => {
            const cleaned = raw.replace(/\D/g, "").slice(0, length);
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
        [length]
    );

    const handleChange = useCallback(
        (index: number, e: ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value.replace(/\D/g, "");
            if (!value) return;

            const digit = value.slice(-1);
            setDigit(index, digit);

            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        },
        [length, setDigit]
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
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        placeholder="0"
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
