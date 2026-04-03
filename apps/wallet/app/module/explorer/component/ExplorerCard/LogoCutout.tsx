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
                d="M29.4697 0C42.2574 0.00018245 52.6239 10.3666 52.624 23.1543C52.624 23.179 52.6231 23.2039 52.623 23.2285V27.3643C52.6231 30.8517 55.4511 33.6785 58.9385 33.6787H51.5713V33.6797H50.0947C46.262 41.1757 38.4668 46.3085 29.4697 46.3086C20.4725 46.3086 12.6765 41.1758 8.84375 33.6797H8.41992V33.6787H0C3.48755 33.6787 6.3154 30.8518 6.31543 27.3643V23.2285C6.31535 23.2039 6.31445 23.179 6.31445 23.1543C6.31457 10.3665 16.6819 0 29.4697 0Z"
                fill={fill}
            />
        </svg>
    );
}
