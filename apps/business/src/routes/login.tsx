import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/middleware/auth";
import { Login } from "@/module/login/component/Login";
import styles from "./login.module.css";

export const Route = createFileRoute("/login")({
    beforeLoad: redirectIfAuthenticated,
    component: LoginPage,
});

function LoginPage() {
    return (
        <div>
            <div className={styles["ellipse-blue-corner"]} />
            <div className={styles["ellipse-blue-top"]} />
            <div className={styles["ellipse-white-1"]} />
            <div className={styles["ellipse-red-1"]} />
            <main className={styles.main}>
                <Login />
            </main>
        </div>
    );
}
