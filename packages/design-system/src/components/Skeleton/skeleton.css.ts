import { keyframes, styleVariants } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias } from "@/tokens.css";

const shimmer = keyframes({
    "0%": { backgroundPosition: "-200px 0" },
    "100%": { backgroundPosition: "calc(200px + 100%) 0" },
});

const base = {
    display: "inline-block" as const,
    backgroundColor: vars.surface.muted,
    backgroundImage: `linear-gradient(90deg, ${vars.surface.muted} 0px, ${vars.surface.tertiary} 40px, ${vars.surface.muted} 80px)`,
    backgroundSize: "200px 100%" as const,
    backgroundRepeat: "no-repeat" as const,
    // biome-ignore lint/suspicious/noExplicitAny: vanilla-extract keyframes type incompatibility
    animationName: shimmer as any,
    animationDuration: "1.5s" as const,
    animationTimingFunction: "ease-in-out" as const,
    animationIterationCount: "infinite" as const,
};

export const skeletonVariants = styleVariants({
    text: {
        ...base,
        height: "16px" as const,
        borderRadius: alias.cornerRadius.s,
        width: "100%" as const,
    },
    circle: {
        ...base,
        borderRadius: alias.cornerRadius.full,
    },
    rect: {
        ...base,
        borderRadius: alias.cornerRadius.m,
        width: "100%" as const,
    },
});
