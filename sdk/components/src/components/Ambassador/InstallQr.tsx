import { useEffect, useState } from "preact/hooks";

// 768 = design-system `tablet` (packages/design-system/src/breakpoints.ts); phones must never load the encoder.
const WIDE_QUERY = "(min-width: 768px)";
// Scanners need 4 white modules around the symbol (ISO/IEC 18004); qr's default border is only 2.
const QUIET_ZONE = 4;
// 200px clears the ~180px scan floor for a realistic ~330-char install URL.
const QR_SIZE = 200;

type InstallQrProps = {
    url?: string;
    label: string;
    caption: string;
    class?: string;
    captionClass?: string;
};

export function InstallQr({
    url,
    label,
    caption,
    class: className,
    captionClass,
}: InstallQrProps) {
    const [query] = useState(readWideQuery);
    const [wide, setWide] = useState(() => query?.matches ?? false);
    const [grid, setGrid] = useState<boolean[][] | null>(null);

    useEffect(() => {
        if (!query) return;
        const onChange = (event: MediaQueryListEvent) => setWide(event.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, [query]);

    useEffect(() => {
        if (!wide || !url) return;
        let cancelled = false;
        import("qr")
            .then(({ encodeQR }) => {
                if (cancelled) return;
                setGrid(encodeQR(url, "raw", { border: QUIET_ZONE }));
            })
            .catch(() => {
                // Non-critical UI: a failed encoder load or encode just leaves the QR absent.
            });
        return () => {
            cancelled = true;
        };
    }, [wide, url]);

    if (!wide || !url || !grid) return null;

    const edge = grid.length;
    return (
        <figure class={className}>
            <svg
                width={QR_SIZE}
                height={QR_SIZE}
                viewBox={`0 0 ${edge} ${edge}`}
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label={label}
                focusable="false"
            >
                <rect width={edge} height={edge} fill="#fff" />
                <path d={modulesPath(grid)} fill="#000" />
            </svg>
            <figcaption class={captionClass}>{caption}</figcaption>
        </figure>
    );
}

function readWideQuery(): MediaQueryList | null {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    ) {
        return null;
    }
    return window.matchMedia(WIDE_QUERY);
}

function modulesPath(grid: boolean[][]): string {
    let path = "";
    for (let row = 0; row < grid.length; row++) {
        const cells = grid[row];
        for (let col = 0; col < cells.length; col++) {
            if (cells[col]) {
                path += `M${col},${row}h1v1h-1z`;
            }
        }
    }
    return path;
}
