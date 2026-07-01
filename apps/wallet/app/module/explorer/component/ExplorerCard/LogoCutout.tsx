/**
 * SVG shape that creates the "inverted border radius" effect around the logo.
 * A white background with a circular cutout + concave scoops on both sides.
 * Exported from Figma's "Subtract" boolean operation.
 */
export function LogoCutout({
    width = 59,
    height = 47,
    fill = "white",
}: {
    width?: number;
    height?: number;
    fill?: string;
}) {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 59 47"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M29.47 0C42.26 0 52.62 10.37 52.62 23.15C52.62 23.18 52.62 23.2 52.62 23.23V27.36C52.62 30.85 55.45 33.68 58.94 33.68H51.57V33.68H50.09C46.26 41.18 38.47 46.31 29.47 46.31C20.47 46.31 12.68 41.18 8.84 33.68H8.42V33.68H0C3.49 33.68 6.32 30.85 6.32 27.36V23.23C6.32 23.2 6.31 23.18 6.31 23.15C6.31 10.37 16.68 0 29.47 0Z"
                fill={fill}
            />
        </svg>
    );
}
