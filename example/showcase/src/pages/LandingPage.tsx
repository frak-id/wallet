import { ComponentList } from "@/components/landing/ComponentList";
import { Header } from "@/components/landing/Header";
import { LearnMore } from "@/components/landing/LearnMore";
import styles from "./LandingPage.module.css";

/**
 * LandingPage
 *
 * Main landing page showcasing Frak SDK components and features
 *
 * @returns {JSX.Element} The rendered landing page
 */
export function LandingPage() {
    return (
        <div className={styles.container}>
            <Header />
            <ComponentList />
            <LearnMore />
        </div>
    );
}
