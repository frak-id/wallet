import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { clsx } from "clsx";
import { PersonaAvatar } from "@/art";
import { stepMessages } from "@/core/messages";
import {
    type ScenarioId,
    STEP_IDS,
    type StepId,
    scenarioOf,
    stepIndex,
} from "@/core/stepIds";
import { steps } from "@/core/steps";
import { type FrameMode, useDemoNav, useDemoStore } from "@/core/store";
import { personas } from "@/data/personas";
import { LANGS, useT } from "@/i18n";
import { shellMessages } from "../messages";
import { useOfflineStore } from "../pwa";
import * as styles from "./director.css";

const FRAMES: readonly FrameMode[] = ["auto", "on", "off"];

const groups: { scenario: ScenarioId; ids: StepId[] }[] = [
    {
        scenario: "referrer",
        ids: STEP_IDS.filter((id) => scenarioOf(id) === "referrer"),
    },
    {
        scenario: "referee",
        ids: STEP_IDS.filter((id) => scenarioOf(id) === "referee"),
    },
];

function NowPlaying() {
    const t = useT(stepMessages);
    const ts = useT(shellMessages);
    const stepId = useDemoStore((s) => s.stepId);
    const { next, prev } = useDemoNav();
    const persona = steps[stepId].persona;

    return (
        <section className={styles.now}>
            <div className={styles.nowMeta}>
                <span>
                    {ts("director.step", {
                        current: stepIndex(stepId) + 1,
                        total: STEP_IDS.length,
                    })}
                </span>
                {persona && (
                    <span className={styles.phoneOf}>
                        <PersonaAvatar persona={persona} size={18} />
                        {ts("director.phoneOf", {
                            name: personas[persona].firstName,
                        })}
                    </span>
                )}
            </div>
            <h2 className={styles.nowTitle}>{t(`${stepId}.title`)}</h2>
            <p className={styles.nowNote}>{t(`${stepId}.note`)}</p>
            <div className={styles.navRow}>
                <button
                    type="button"
                    className={styles.navButton({ tone: "ghost" })}
                    onClick={prev}
                    disabled={stepId === STEP_IDS[0]}
                >
                    ← {ts("director.prev")}
                </button>
                <button
                    type="button"
                    className={styles.navButton({ tone: "solid" })}
                    onClick={next}
                    disabled={stepId === STEP_IDS[STEP_IDS.length - 1]}
                >
                    {ts("director.next")} →
                </button>
            </div>
        </section>
    );
}

function Timeline({ onJump }: { onJump?: () => void }) {
    const t = useT(stepMessages);
    const ts = useT(shellMessages);
    const current = useDemoStore((s) => s.stepId);
    const { goTo } = useDemoNav();
    const jump = (id: StepId) => {
        goTo(id);
        onJump?.();
    };

    return (
        <nav className={styles.timeline}>
            {groups.map(({ scenario, ids }) => {
                const persona = scenario === "referrer" ? "lea" : "chloe";
                return (
                    <div key={scenario} className={styles.group}>
                        <div className={styles.groupHeader}>
                            <PersonaAvatar persona={persona} size={24} />
                            {ts(`director.scenario.${scenario}`)}
                        </div>
                        <ol className={styles.stepList}>
                            {ids.map((id) => (
                                <li key={id}>
                                    <button
                                        type="button"
                                        className={styles.stepItem({
                                            state:
                                                id === current
                                                    ? "current"
                                                    : stepIndex(id) <
                                                        stepIndex(current)
                                                      ? "done"
                                                      : "todo",
                                        })}
                                        onClick={() => jump(id)}
                                    >
                                        {t(`${id}.title`)}
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </div>
                );
            })}
            <button
                type="button"
                className={styles.stepItem({
                    state: current === "finale" ? "current" : "todo",
                })}
                onClick={() => jump("finale")}
            >
                {ts("director.finale")}
            </button>
        </nav>
    );
}

function Settings() {
    const ts = useT(shellMessages);
    const lang = useDemoStore((s) => s.lang);
    const setLang = useDemoStore((s) => s.setLang);
    const frame = useDemoStore((s) => s.frame);
    const setFrame = useDemoStore((s) => s.setFrame);
    const restart = useDemoStore((s) => s.restart);
    const ready = useOfflineStore((s) => s.ready);
    const updateReady = useOfflineStore((s) => s.updateReady);

    return (
        <section className={styles.settings}>
            <div className={styles.settingRow}>
                <span>{ts("director.language")}</span>
                <span className={styles.segmented}>
                    {LANGS.map((code) => (
                        <button
                            key={code}
                            type="button"
                            className={styles.segment({
                                active: code === lang,
                            })}
                            onClick={() => setLang(code)}
                        >
                            {code.toUpperCase()}
                        </button>
                    ))}
                </span>
            </div>
            <div className={styles.settingRow}>
                <span>{ts("director.frame")}</span>
                <span className={styles.segmented}>
                    {FRAMES.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={styles.segment({
                                active: mode === frame,
                            })}
                            onClick={() => setFrame(mode)}
                        >
                            {ts(`director.frame.${mode}`)}
                        </button>
                    ))}
                </span>
            </div>
            <div className={styles.settingRow}>
                <span
                    className={clsx(
                        styles.offline,
                        ready && styles.offlineReady
                    )}
                >
                    ●{" "}
                    {ts(
                        ready
                            ? "director.offline.ready"
                            : "director.offline.pending"
                    )}
                </span>
                <button
                    type="button"
                    className={styles.navButton({ tone: "ghost" })}
                    onClick={restart}
                >
                    ↺ {ts("director.restart")}
                </button>
            </div>
            {updateReady && (
                <button
                    type="button"
                    className={styles.navButton({ tone: "solid" })}
                    onClick={() => window.location.reload()}
                >
                    {ts("director.update")}
                </button>
            )}
            <p className={styles.hint}>{ts("director.shortcuts")}</p>
        </section>
    );
}

/** Presenter controls: where we are, what to say, where to jump. */
export function DirectorContent({ onJump }: { onJump?: () => void }) {
    const ts = useT(shellMessages);
    return (
        <div className={styles.content}>
            <header className={styles.brand}>
                <LogoFrakWithName height={22} width={58} />
                <span>{ts("director.title")}</span>
            </header>
            <NowPlaying />
            <Timeline onJump={onJump} />
            <Settings />
        </div>
    );
}
