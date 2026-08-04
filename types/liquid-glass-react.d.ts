/**
 * The published package's "exports" map has no "types" condition, so
 * `moduleResolution: "bundler"` cannot reach its bundled `dist/index.d.ts`.
 * Declare the surface we use instead of pointing `paths` at a hoisted path,
 * which only resolves when the dep happens to land in the root node_modules.
 */
declare module "@tinymomentum/liquid-glass-react" {
    import type {
        CSSProperties,
        ForwardRefExoticComponent,
        HTMLAttributes,
        ReactNode,
        RefAttributes,
    } from "react";

    export type LiquidGlassBaseProps = {
        elementType?: "div" | "button" | "a" | "span" | "p";
        href?: string;
        target?: "_self" | "_blank" | "_parent" | "_top";
        rel?: string;
        download?: string | boolean;
        width?: number;
        height?: number;
        borderRadius?: number;
        innerShadowColor?: string;
        innerShadowBlur?: number;
        innerShadowSpread?: number;
        glassTintColor?: string;
        glassTintOpacity?: number;
        frostBlurRadius?: number;
        noiseFrequency?: number;
        noiseStrength?: number;
        children?: ReactNode;
        style?: CSSProperties;
        className?: string;
    } & HTMLAttributes<HTMLElement>;

    export const LiquidGlassBase: ForwardRefExoticComponent<
        LiquidGlassBaseProps & RefAttributes<HTMLElement>
    >;
}
