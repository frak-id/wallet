declare module "*.svg" {
    import type { ComponentType, SVGProps } from "preact";

    const ReactComponent: ComponentType<SVGProps<SVGSVGElement>>;
    export default ReactComponent;
}
