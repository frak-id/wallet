import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { Login } from "@/module/login/component/Login";
import {
    ellipseBlueCorner,
    ellipseBlueTop,
    ellipseRed,
    ellipseWhite,
    main,
} from "./login.css";

export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    component: LoginPage,
});

function LoginPage() {
    return (
        <div>
            <div className={ellipseBlueCorner} />
            <div className={ellipseBlueTop} />
            <div className={ellipseWhite} />
            <div className={ellipseRed} />
            <main className={main}>
                <Login />
            </main>
        </div>
    );
}
