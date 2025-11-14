import { Check, Copy, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfigCode } from "@/hooks/useConfigCode";
import styles from "./CodeOutput.module.css";

export function CodeOutput() {
    const { t } = useTranslation();
    const code = useConfigCode();
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const handleSave = () => {
        try {
            localStorage.setItem("frak-wallet-sdk-config", code);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save:", err);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t("configuration.codeOutput.title")}
                </h2>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.actionButton}
                        onClick={handleCopy}
                        title={t("configuration.codeOutput.copy")}
                    >
                        {copied ? (
                            <>
                                <Check size={16} />
                                {t("configuration.codeOutput.copied")}
                            </>
                        ) : (
                            <>
                                <Copy size={16} />
                                {t("configuration.codeOutput.copy")}
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        className={styles.actionButton}
                        onClick={handleSave}
                        title={t("configuration.codeOutput.save")}
                    >
                        {saved ? (
                            <>
                                <Check size={16} />
                                {t("configuration.codeOutput.saved")}
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {t("configuration.codeOutput.save")}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className={styles.codeBlock}>
                <pre className={styles.code}>
                    <code>{`window.FrakSetup = ${code}`}</code>
                </pre>
            </div>
        </div>
    );
}
