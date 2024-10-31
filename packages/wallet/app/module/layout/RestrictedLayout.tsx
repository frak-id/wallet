import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Header } from "@/module/common/component/Header";
import type { PropsWithChildren } from "react";

export function RestrictedLayout({ children }: PropsWithChildren) {
    return (
        <AuthRestricted requireAuthenticated={true}>
            <GlobalLayout>
                <Header />
                {children}
            </GlobalLayout>
        </AuthRestricted>
    );
}
