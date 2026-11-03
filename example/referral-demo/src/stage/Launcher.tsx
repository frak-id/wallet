import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { PersonaAvatar } from "@/art";
import { useDemoNav, useDemoStore } from "@/core/store";
import type { PersonaId } from "@/data/personas";
import { LANGS, useT } from "@/i18n";
import { isIos, isStandalone, useOfflineStore } from "@/shell/pwa";
import { stageMessages } from "./messages";
import * as styles from "./stage.css";

export function LangToggle() {
    const lang = useDemoStore((s) => s.lang);
    const setLang = useDemoStore((s) => s.setLang);
    return (
        <span className={styles.langToggle}>
            {LANGS.map((code) => (
                <button
                    key={code}
                    type="button"
                    className={styles.langButton({ active: code === lang })}
                    onClick={() => setLang(code)}
                >
                    {code.toUpperCase()}
                </button>
            ))}
        </span>
    );
}

function ScenarioCard({
    persona,
    scenario,
    onClick,
}: {
    persona: PersonaId;
    scenario: "referrer" | "referee";
    onClick: () => void;
}) {
    const t = useT(stageMessages);
    return (
        <button type="button" className={styles.scenarioCard} onClick={onClick}>
            <PersonaAvatar persona={persona} size={52} ring="story" />
            <span className={styles.cardText}>
                <span className={styles.cardLabel}>
                    {t(`launcher.${scenario}.label`)}
                </span>
                <span className={styles.cardTitle}>
                    {t(`launcher.${scenario}.title`)}
                </span>
                <span className={styles.cardPath}>
                    {t(`launcher.${scenario}.path`)}
                </span>
            </span>
            <span className={styles.arrow} aria-hidden="true">
                →
            </span>
        </button>
    );
}

/** Entry screen: pick a scenario. */
export function Launcher() {
    const t = useT(stageMessages);
    const { goTo } = useDemoNav();
    const ready = useOfflineStore((s) => s.ready);
    const installPrompt = useOfflineStore((s) => s.installPrompt);

    return (
        <div className={styles.screen}>
            <div className={styles.topBar}>
                <LogoFrakWithName width={68} height={26} />
                <LangToggle />
            </div>

            <div className={styles.hero}>
                <span className={styles.overline}>
                    {t("launcher.overline")}
                </span>
                <h1 className={styles.title}>{t("launcher.title")}</h1>
                <p className={styles.lede}>{t("launcher.lede")}</p>
            </div>

            <div className={styles.cards}>
                <ScenarioCard
                    persona="lea"
                    scenario="referrer"
                    onClick={() => goTo("referrer.intro")}
                />
                <ScenarioCard
                    persona="chloe"
                    scenario="referee"
                    onClick={() => goTo("referee.intro")}
                />
            </div>

            <button
                type="button"
                className={styles.textLink}
                onClick={() => goTo("finale")}
            >
                {t("launcher.finale")} →
            </button>

            <footer className={styles.footer}>
                <span className={styles.offline({ ready })}>
                    ●{" "}
                    {t(ready ? "launcher.offline" : "launcher.offlinePending")}
                </span>
                {installPrompt ? (
                    <button
                        type="button"
                        className={styles.installButton}
                        onClick={() => {
                            // The browser's deferred prompt can only be shown once.
                            useOfflineStore.setState({ installPrompt: null });
                            installPrompt.prompt().catch(() => undefined);
                        }}
                    >
                        {t("launcher.installCta")}
                    </button>
                ) : (
                    isIos() &&
                    !isStandalone() && <span>{t("launcher.install")}</span>
                )}
            </footer>
        </div>
    );
}
