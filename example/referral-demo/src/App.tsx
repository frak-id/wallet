import { useEffect } from "react";
import * as styles from "@/app.css";
import { PersonaAvatar } from "@/art";
import { steps } from "@/core/steps";
import { useDemoStore } from "@/core/store";
import { personas } from "@/data/personas";
import { clock } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { FullScreenDevice, PhoneFrame } from "@/shell/Device";
import {
    DirectorFab,
    DirectorPanel,
    useDirectorShortcuts,
} from "@/shell/Director";
import { useFramed, useWide } from "@/shell/layout";
import { shellMessages } from "@/shell/messages";
import { RotateHint } from "@/shell/RotateHint";
import { StepStage } from "@/shell/StepStage";
import { useWakeLock } from "@/shell/useWakeLock";
import { DeskFinale } from "@/stage/Finale";

/** Keeps the browser/OS chrome colour and the document language in sync. */
function useDocumentSync() {
    const stepId = useDemoStore((s) => s.stepId);
    const lang = useLang();
    const tone = steps[stepId].statusBar;

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        meta?.setAttribute("content", tone === "dark" ? "#ffffff" : "#060b1f");
    }, [tone]);
}

function PersonaCaption() {
    const t = useT(shellMessages);
    const lang = useLang();
    const stepId = useDemoStore((s) => s.stepId);
    const persona = steps[stepId].persona;
    if (!persona) return <div className={styles.caption} />;
    const { firstName, role } = personas[persona];

    return (
        <div className={styles.caption}>
            <PersonaAvatar persona={persona} size={28} />
            <span className={styles.captionName}>
                {t("director.phoneOf", { name: firstName })}
            </span>
            <span className={styles.captionRole}>{role[lang]}</span>
        </div>
    );
}

export function App() {
    const framed = useFramed();
    const wide = useWide();
    const stepId = useDemoStore((s) => s.stepId);
    const { statusBar: tone, persona, clock: stepClock } = steps[stepId];
    useDirectorShortcuts();
    useDocumentSync();
    useWakeLock();

    if (!framed) {
        return (
            <>
                <FullScreenDevice>
                    <StepStage />
                </FullScreenDevice>
                <DirectorFab />
                <RotateHint />
            </>
        );
    }

    return (
        <div className={styles.desk}>
            <main className={styles.deskMain}>
                {stepId === "finale" ? (
                    <DeskFinale />
                ) : (
                    <>
                        <PersonaCaption />
                        <div className={styles.phoneSlot}>
                            <PhoneFrame
                                tone={tone}
                                time={
                                    stepClock ??
                                    (persona ? clock[persona] : undefined)
                                }
                            >
                                <StepStage />
                            </PhoneFrame>
                        </div>
                    </>
                )}
            </main>
            {wide ? <DirectorPanel /> : <DirectorFab />}
        </div>
    );
}
