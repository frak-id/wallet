import type Resources from "./resources.d.ts";

declare module "i18next" {
    interface CustomTypeOptions {
        resources: Resources;
        defaultNS: "default";
    }
}
