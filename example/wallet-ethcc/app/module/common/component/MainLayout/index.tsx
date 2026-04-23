import type { ReactNode } from "react";
import { inner, main } from "./index.css";

export function MainLayout({ children }: { children: ReactNode }) {
    return (
        <main className={main}>
            <div className={inner}>{children}</div>
        </main>
    );
}
