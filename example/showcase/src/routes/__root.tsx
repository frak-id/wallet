import { createRootRoute, Outlet } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "sonner";
import i18n from "@/i18n/config";
import { useTheme } from "@/utils/theme";

function RootComponent() {
    const theme = useTheme();

    return (
        <I18nextProvider i18n={i18n}>
            <Outlet />
            {/* @ts-expect-error - Frak SDK web component */}
            <frak-button-wallet />
            <Toaster position="bottom-right" theme={theme} />
        </I18nextProvider>
    );
}

export const Route = createRootRoute({
    component: RootComponent,
});
