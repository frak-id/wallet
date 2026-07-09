import { blurLayers } from "./index.css";

// Lightning CSS (Safari 14 target) strips `backdrop-filter` from the build, so
// it is injected at runtime — the same trick GlassButton uses. React hoists and
// de-dupes this by `href`, so it is emitted once no matter how many instances.
const backdropCss = blurLayers
    .map(
        ({ className, radius }) =>
            `.${className}{-webkit-backdrop-filter:blur(${radius}px);backdrop-filter:blur(${radius}px);}`
    )
    .join("");

type ScrollEdgeBlurProps = {
    /** Positions and sizes the band; must set `position` (its own layers pin to
     * it). */
    className?: string;
};

/**
 * iOS "scroll edge effect": a progressive backdrop blur that feathers from a
 * heavy top edge downward. Renders inside a positioned box the caller sizes via
 * `className`; only visible once content scrolls behind it.
 */
export function ScrollEdgeBlur({ className }: ScrollEdgeBlurProps) {
    return (
        <div className={className} aria-hidden="true">
            <style href="scroll-edge-blur" precedence="default">
                {backdropCss}
            </style>
            {blurLayers.map(({ className: layer }) => (
                <div key={layer} className={layer} />
            ))}
        </div>
    );
}
