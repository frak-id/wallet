declare module "*.svg" {
    import type { ComponentType } from "preact";
    const SVG: ComponentType<JSX.SVGAttributes<SVGElement>>;
    export default SVG;
}
