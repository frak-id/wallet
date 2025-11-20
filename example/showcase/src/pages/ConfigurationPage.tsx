import { Moon, Sun } from "lucide-react";
import { BaseConfigForm } from "@/components/configuration/BaseConfigForm";
import { CodeOutput } from "@/components/configuration/CodeOutput";
import { CustomizationForm } from "@/components/configuration/CustomizationForm";
import { WizardNavigation } from "@/components/configuration/WizardNavigation";
import { useWizardStore } from "@/stores/wizardStore";
import {
    applyTheme,
    setStoredTheme,
    type Theme,
    useTheme,
} from "@/utils/theme";
import styles from "./ConfigurationPage.module.css";

/**
 * ConfigurationPage
 *
 * Multi-step wizard for configuring the Frak SDK
 * Allows users to customize SDK settings and generate integration code
 *
 * @returns {JSX.Element} The rendered configuration wizard page
 */
export function ConfigurationPage() {
    const currentStep = useWizardStore((state) => state.currentStep);
    const theme = useTheme();

    const toggleTheme = () => {
        const newTheme: Theme = theme === "light" ? "dark" : "light";
        applyTheme(newTheme);
        setStoredTheme(newTheme);
    };

    return (
        <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
            <header className={styles.header}>
                <h1 className={styles.title}>Frak SDK Configuration</h1>
                <button
                    className={styles.themeToggle}
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    type="button"
                >
                    <Sun
                        className={styles.sunIcon}
                        data-theme={theme}
                        size={20}
                    />
                    <Moon
                        className={styles.moonIcon}
                        data-theme={theme}
                        size={20}
                    />
                    <span className={styles.srOnly}>Toggle theme</span>
                </button>
            </header>

            <WizardNavigation />

            {currentStep === 1 && <BaseConfigForm />}
            {currentStep === 2 && <CustomizationForm />}
            {currentStep === 3 && <CodeOutput />}
        </div>
    );
}
