import type { loader as appLoader } from "app/routes/app";
import { useRouteLoaderData } from "react-router";

export function useThemeEditorUrl(): string {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    return `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
}
