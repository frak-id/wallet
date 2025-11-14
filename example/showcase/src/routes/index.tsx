import { createFileRoute } from "@tanstack/react-router";
import { ComponentList } from "@/components/landing/ComponentList";
import { Header } from "@/components/landing/Header";
import { LearnMore } from "@/components/landing/LearnMore";
import styles from "./index.module.css";

function LandingPage() {
    return (
        <div className={styles.container}>
            <Header />
            <ComponentList />
            <LearnMore />
        </div>
    );
}

export const Route = createFileRoute("/")({
    component: LandingPage,
});
