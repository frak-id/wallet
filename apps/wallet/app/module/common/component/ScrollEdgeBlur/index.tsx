import { blurLayers } from "./index.css";

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
            {blurLayers.map((layer) => (
                <div key={layer} className={layer} />
            ))}
        </div>
    );
}
