import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    applyTheme,
    getInitialTheme,
    setStoredTheme,
    type Theme,
} from "@/utils/theme";
import styles from "./Header.module.css";

export function Header() {
    const { t } = useTranslation();
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        const initialTheme = getInitialTheme();
        setTheme(initialTheme);
        applyTheme(initialTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme: Theme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        applyTheme(newTheme);
        setStoredTheme(newTheme);
    };

    return (
        <header className={styles.header}>
            <h1 className={styles.h1}>{t("common.h1")}</h1>
            <button
                className={styles.themeToggle}
                onClick={toggleTheme}
                aria-label="Toggle theme"
                type="button"
            >
                <Sun className={styles.sunIcon} data-theme={theme} size={20} />
                <Moon
                    className={styles.moonIcon}
                    data-theme={theme}
                    size={20}
                />
                <span className={styles.srOnly}>Toggle theme</span>
            </button>
        </header>
    );
}
