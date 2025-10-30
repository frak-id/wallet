import { type ReactNode, useEffect } from "react";
import { DemoModeSync } from "@/module/common/component/DemoModeSync";
import { Header } from "@/module/common/component/Header";
import { MainLayout } from "@/module/common/component/MainLayout";
import { Navigation } from "@/module/common/component/Navigation";
import "@/styles/restricted.css";

export function RestrictedLayout({ children }: { children: ReactNode }) {
    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.page = "restricted";
        }

        return () => {
            rootElement.removeAttribute("data-page");
        };
    }, []);

    return (
        <>
            <DemoModeSync />
            <Header />
            <Navigation />
            <MainLayout>{children}</MainLayout>
        </>
    );
}
