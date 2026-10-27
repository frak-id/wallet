import { brand, zIndex } from "@frak-labs/design-system/tokens";
import { useEffect } from "react";

const colors = [
    brand.colors.primary[500],
    brand.colors.primary[300],
    brand.colors.success[500],
    brand.colors.warning[400],
    brand.colors.error[400],
];
// Over the win screen, which sits at modal level.
const CONFETTI_Z_INDEX = zIndex.modal + 1;

/** Fires one celebratory burst on mount; the library is lazy-loaded. */
export function useConfettiBurst() {
    useEffect(() => {
        let cancelled = false;
        let reset: (() => void) | undefined;

        import("canvas-confetti")
            .then(({ default: confetti }) => {
                if (cancelled) return;
                // The default instance draws from a blob: worker, which the Tauri CSP refuses.
                const fire = confetti.create(undefined, {
                    resize: true,
                    disableForReducedMotion: true,
                });
                reset = () => fire.reset();
                const cannon = {
                    colors,
                    particleCount: 70,
                    spread: 70,
                    startVelocity: 55,
                    zIndex: CONFETTI_Z_INDEX,
                    disableForReducedMotion: true,
                };
                fire({ ...cannon, angle: 60, origin: { x: 0, y: 0.75 } });
                fire({ ...cannon, angle: 120, origin: { x: 1, y: 0.75 } });
            })
            .catch(() => {});

        return () => {
            cancelled = true;
            reset?.();
        };
    }, []);
}
