import { AuthRestricted } from "@/module/common/component/AuthRestricted";
import { GlobalLayout } from "@/module/common/component/GlobalLayout";
import { Header } from "@/module/common/component/Header";
import type { PropsWithChildren } from "react";

export function AuthenticationLayout({ children }: PropsWithChildren) {
    return (
        <AuthRestricted requireAuthenticated={false}>
            <GlobalLayout>
                <Header navigation={false} />
                {children}
            </GlobalLayout>
        </AuthRestricted>
    );
}
