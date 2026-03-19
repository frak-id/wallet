import { Box } from "../Box";
import { leafRotations, leafStyles, spinnerStyles } from "./spinner.css";

type SpinnerSize = "s" | "m" | "l";

type SpinnerProps = {
    size?: SpinnerSize;
    className?: string;
};

export function Spinner({ size = "m", className }: SpinnerProps) {
    const sizeClass = spinnerStyles[size];
    const combinedClassName = [sizeClass, className].filter(Boolean).join(" ");

    const leafRotationKeys = [
        "leaf0",
        "leaf1",
        "leaf2",
        "leaf3",
        "leaf4",
        "leaf5",
        "leaf6",
        "leaf7",
    ] as const;

    return (
        <Box as="span" className={combinedClassName}>
            {leafRotationKeys.map((key) => (
                <Box
                    key={key}
                    as="span"
                    className={`${leafStyles} ${leafRotations[key]}`}
                />
            ))}
        </Box>
    );
}
