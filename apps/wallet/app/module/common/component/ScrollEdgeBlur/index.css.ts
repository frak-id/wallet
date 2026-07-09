import { style } from "@vanilla-extract/css";

// Progressive blur: shorter masks at bigger radii concentrate the blur at the
// top edge. `backdrop-filter` is added at runtime (see index.tsx) because
// Lightning CSS (Safari 14 target) strips it from the build. Must stay a single
// (non-composed) class so the runtime backdrop-filter selector is compound.
function blurLayer(maskStop: string) {
    const mask = `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${maskStop}, rgba(0,0,0,0) 100%)`;
    return style({
        position: "absolute",
        inset: 0,
        maskImage: mask,
        WebkitMaskImage: mask,
    });
}

export const blurLayers = [
    { className: blurLayer("60%"), radius: 4 },
    { className: blurLayer("35%"), radius: 12 },
    { className: blurLayer("18%"), radius: 24 },
];
