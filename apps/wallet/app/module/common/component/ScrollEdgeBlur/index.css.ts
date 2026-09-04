import { style } from "@vanilla-extract/css";

// Progressive blur: shorter masks at bigger radii concentrate the blur at the
// top edge. Static px radii compile fine through Lightning CSS (only
// `blur(var(--…))` gets mangled), and build-time CSS is required anyway: the
// Tauri production CSP blocks runtime-injected <style> tags (it hashes inline
// styles, which disables 'unsafe-inline').
//
// Only the unprefixed property is declared: Lightning CSS auto-generates the
// `-webkit-` prefix for the Safari floor. Declaring both makes it collapse
// the pair to `-webkit-` only, which Chrome ignores (no blur on web).
function blurLayer(maskStop: string, radius: number) {
    const mask = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${maskStop}, rgba(0,0,0,0) 100%)`;
    return style({
        position: "absolute",
        inset: 0,
        maskImage: mask,
        WebkitMaskImage: mask,
        backdropFilter: `blur(${radius}px)`,
    });
}

export const blurLayers = [
    blurLayer("60%", 4),
    blurLayer("35%", 12),
    blurLayer("18%", 24),
];
