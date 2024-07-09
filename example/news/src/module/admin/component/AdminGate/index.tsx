import { isAdmin } from "@/context/admin/action/authenticate";
import { AdminLogin } from "@/module/admin/component/Login";
import type { ReactNode } from "react";

export async function AdminGate({ children }: { children: ReactNode }) {
    const isCurrentlyAdmin = await isAdmin();

    if (!isCurrentlyAdmin) {
        return <AdminLogin />;
    }

    return <>{children}</>;
}
