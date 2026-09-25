import type { Currency } from "@frak-labs/core-sdk";
import { useEffect, useRef, useState } from "react";
import phoneFrame2xUrl from "../explorer-phone/assets/phone-frame@2x.webp";
import phoneFrameUrl from "../explorer-phone/assets/phone-frame.webp";
import { replaceVariables, SAMPLE_AMOUNT } from "../utils/variables";
import * as styles from "./ambassador-phone.css";

/**
 * Resolved copy keyed like the ambassador page's texts. Tokens (`{BRAND}`,
 * `{REWARD}`) are still unfilled: this component samples the amounts.
 */
export type AmbassadorPhoneTexts = {
    heroEyebrow: string;
    heroTitle: string;
    heroLede: string;
    heroCtaLabel: string;
    heroFacesCaption: string;
    heroRewardCaption: string;
    heroPill: string;
    rewardEyebrow: string;
    rewardHeading: string;
    rewardEstimateCaption: string;
    rewardLede: string;
    rewardCtaLabel: string;
    rewardFooterCaption: string;
    explainerTitle: string;
    explainerLede: string;
    explainerStep1Title: string;
    explainerStep1Description: string;
    explainerStep2Title: string;
    explainerStep2Description: string;
    explainerStep3Title: string;
    explainerStep3Description: string;
    winWinHeading: string;
    winWinLede: string;
    winWinCard1Title: string;
    winWinCard1Description: string;
    winWinCard2Title: string;
    winWinCard2Description: string;
    referralHeading: string;
    referralLede: string;
    referralCtaLabel: string;
    storeHeading: string;
    storeLede: string;
    storeQrCaption: string;
    faqHeading: string;
    faq1Question: string;
    faq1Answer: string;
    faq2Question: string;
    faq2Answer: string;
    faq3Question: string;
    faq3Answer: string;
    faq4Question: string;
    faq4Answer: string;
    faq5Question: string;
    /** The whole answer; the live page's inline Frak link is drawn as text. */
    faq5Answer: string;
    attributionBeforeLink: string;
    attributionLinkText: string;
};

export type AmbassadorPhoneFocus = {
    /** Copy key of the focused text, or `hero` for the photo choice. */
    slot: string;
    /** Bumped on every focus; a re-render with the same counter re-highlights nothing. */
    counter: number;
};

export type AmbassadorPhonePreviewProps = {
    texts: AmbassadorPhoneTexts;
    currency: Currency;
    shopName: string;
    /** Merchant hero photo; absent collapses the 4:5 frame around the tag. */
    imageUrl?: string;
    focus?: AmbassadorPhoneFocus;
};

const FRIEND_AMOUNT = 10;

/** The friend's slots fill `{REWARD}` with the friend's sample amount. */
const FRIEND_SLOTS = new Set([
    "heroPill",
    "winWinCard2Description",
    "faq3Answer",
]);

/**
 * Whole mobile ambassador page drawn inside the Explorer phone artwork:
 * seven sections in the page's order, sample amounts, every control inert.
 * Scrolls only its own screen area on focus — never `scrollIntoView`, which
 * would move the dashboard window.
 */
export function AmbassadorPhonePreview({
    texts,
    currency,
    shopName,
    imageUrl,
    focus,
}: AmbassadorPhonePreviewProps) {
    const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
    const lastCounter = useRef<number | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    useEffect(() => {
        if (!focus || focus.counter === lastCounter.current) return;
        lastCounter.current = focus.counter;
        setHighlightedSlot(focus.slot);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(
            () => setHighlightedSlot(null),
            styles.highlightMs
        );
        const container = scrollRef.current;
        const target = container?.querySelector(`[data-slot="${focus.slot}"]`);
        if (!container || !(target instanceof HTMLElement)) return;
        const section = target.closest<HTMLElement>("[data-section]");
        container.scrollTop =
            (section ?? target).getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop -
            12;
    }, [focus]);

    const fill = (text: string, slot?: string) =>
        replaceVariables(
            text,
            currency,
            shopName,
            slot && FRIEND_SLOTS.has(slot) ? FRIEND_AMOUNT : SAMPLE_AMOUNT
        );

    const mark = (base: string, slot: string) => {
        const lit = highlightedSlot === slot;
        return {
            className: lit ? `${base} ${styles.highlighted}` : base,
            "data-slot": slot,
            ...(lit ? { "data-highlighted": "true" } : {}),
        };
    };

    const faqs = [
        { question: "faq1Question", answer: "faq1Answer" },
        { question: "faq2Question", answer: "faq2Answer" },
        { question: "faq3Question", answer: "faq3Answer" },
        { question: "faq4Question", answer: "faq4Answer" },
        { question: "faq5Question", answer: "faq5Answer" },
    ] as const;
    const openFaq = Math.max(
        0,
        faqs.findIndex(
            (faq) => faq.question === focus?.slot || faq.answer === focus?.slot
        )
    );

    return (
        <div
            className={styles.phoneShell}
            aria-hidden="true"
            data-testid="ambassador-phone-preview"
        >
            <img
                src={phoneFrameUrl}
                srcSet={`${phoneFrameUrl} 1x, ${phoneFrame2xUrl} 2x`}
                alt=""
                width={353}
                height={735}
                decoding="async"
                fetchPriority="low"
                className={styles.frameImage}
            />
            <div
                ref={scrollRef}
                className={styles.screen}
                data-testid="ambassador-phone-scroll"
            >
                <div className={styles.notch} />

                <section className={styles.heroSection} data-section="hero">
                    <p className={styles.eyebrow}>
                        {fill(texts.heroEyebrow, "heroEyebrow")}
                    </p>
                    <p {...mark(styles.heading, "heroTitle")}>
                        {fill(texts.heroTitle, "heroTitle")}
                    </p>
                    <p {...mark(styles.muted, "heroLede")}>
                        {fill(texts.heroLede, "heroLede")}
                    </p>
                    <span {...mark(styles.cta, "heroCtaLabel")}>
                        {fill(texts.heroCtaLabel, "heroCtaLabel")}
                    </span>
                    <p className={styles.muted}>
                        {fill(texts.heroFacesCaption, "heroFacesCaption")}
                    </p>
                    <div
                        {...mark(
                            imageUrl
                                ? `${styles.heroArt} ${styles.heroArtFramed}`
                                : styles.heroArt,
                            "hero"
                        )}
                    >
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt=""
                                className={styles.heroImage}
                            />
                        ) : null}
                        <div className={styles.heroTag}>
                            <b data-testid="hero-amount">
                                {fill("{REWARD}", "heroRewardCaption")}
                            </b>{" "}
                            <span {...mark("", "heroRewardCaption")}>
                                {fill(
                                    texts.heroRewardCaption,
                                    "heroRewardCaption"
                                )}
                            </span>
                            <span className={styles.heroPill}>
                                {fill(texts.heroPill, "heroPill")}
                            </span>
                        </div>
                    </div>
                </section>

                <section className={styles.rewardSection} data-section="reward">
                    <p className={styles.eyebrow}>
                        {fill(texts.rewardEyebrow, "rewardEyebrow")}
                    </p>
                    <p {...mark(styles.heading, "rewardHeading")}>
                        {fill(texts.rewardHeading, "rewardHeading")}
                    </p>
                    <p className={styles.muted}>
                        {fill(
                            texts.rewardEstimateCaption,
                            "rewardEstimateCaption"
                        )}
                    </p>
                    <p {...mark(styles.muted, "rewardLede")}>
                        {fill(texts.rewardLede, "rewardLede")}
                    </p>
                    <span {...mark(styles.cta, "rewardCtaLabel")}>
                        {fill(texts.rewardCtaLabel, "rewardCtaLabel")}
                    </span>
                    <p className={styles.muted}>
                        {fill(texts.rewardFooterCaption, "rewardFooterCaption")}
                    </p>
                </section>

                <section className={styles.stepsSection} data-section="steps">
                    <h2 className={styles.heading}>
                        {fill(texts.explainerTitle, "explainerTitle")}
                    </h2>
                    <p className={styles.muted}>
                        {fill(texts.explainerLede, "explainerLede")}
                    </p>
                    <div className={styles.stepsGrid}>
                        {([1, 2, 3] as const).map((step) => (
                            <div key={step} className={styles.step}>
                                <span className={styles.stepNumber}>
                                    {step}
                                </span>
                                <p className={styles.stepTitle}>
                                    {fill(
                                        texts[
                                            `explainerStep${step}Title` as const
                                        ],
                                        `explainerStep${step}Title`
                                    )}
                                </p>
                                <p className={styles.muted}>
                                    {fill(
                                        texts[
                                            `explainerStep${step}Description` as const
                                        ],
                                        `explainerStep${step}Description`
                                    )}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.winWinSection} data-section="winWin">
                    <h2 className={styles.heading}>
                        {fill(texts.winWinHeading, "winWinHeading")}
                    </h2>
                    <p className={styles.muted}>
                        {fill(texts.winWinLede, "winWinLede")}
                    </p>
                    <div className={styles.winWinCards}>
                        <div className={styles.winWinCard}>
                            <p className={styles.muted}>
                                {fill(
                                    texts.winWinCard1Title,
                                    "winWinCard1Title"
                                )}
                            </p>
                            <p className={styles.winWinCardAmount}>
                                {fill("{REWARD}", "winWinCard1Title")}
                            </p>
                            <p
                                {...mark(
                                    styles.muted,
                                    "winWinCard1Description"
                                )}
                            >
                                {fill(
                                    texts.winWinCard1Description,
                                    "winWinCard1Description"
                                )}
                            </p>
                        </div>
                        <div className={styles.winWinCard}>
                            <p className={styles.muted}>
                                {fill(
                                    texts.winWinCard2Title,
                                    "winWinCard2Title"
                                )}
                            </p>
                            <p
                                className={styles.winWinCardAmount}
                                data-testid="friend-amount"
                            >
                                {fill("{REWARD}", "winWinCard2Description")}
                            </p>
                            <p
                                {...mark(
                                    styles.muted,
                                    "winWinCard2Description"
                                )}
                            >
                                {fill(
                                    texts.winWinCard2Description,
                                    "winWinCard2Description"
                                )}
                            </p>
                        </div>
                    </div>
                </section>

                <section
                    className={styles.referralSection}
                    data-section="referral"
                >
                    <h2 className={styles.heading}>
                        {fill(texts.referralHeading, "referralHeading")}
                    </h2>
                    <p {...mark(styles.muted, "referralLede")}>
                        {fill(texts.referralLede, "referralLede")}
                    </p>
                    <span {...mark(styles.cta, "referralCtaLabel")}>
                        {fill(texts.referralCtaLabel, "referralCtaLabel")}
                    </span>
                </section>

                <section className={styles.storeSection} data-section="store">
                    <h2 className={styles.heading}>
                        {fill(texts.storeHeading, "storeHeading")}
                    </h2>
                    <p className={styles.muted}>
                        {fill(texts.storeLede, "storeLede")}
                    </p>
                    <div className={styles.storeBadges}>
                        <span className={styles.storeBadge}>App Store</span>
                        <span className={styles.storeBadge}>Google Play</span>
                    </div>
                    <p className={styles.muted}>
                        {fill(texts.storeQrCaption, "storeQrCaption")}
                    </p>
                </section>

                <section className={styles.faqSection} data-section="faq">
                    <h2 className={styles.heading}>
                        {fill(texts.faqHeading, "faqHeading")}
                    </h2>
                    {faqs.map((faq, index) => (
                        <div key={faq.question} className={styles.faqItem}>
                            <p {...mark(styles.faqQuestion, faq.question)}>
                                {fill(texts[faq.question], faq.question)}
                            </p>
                            {openFaq === index ? (
                                <p {...mark(styles.faqAnswer, faq.answer)}>
                                    {fill(texts[faq.answer], faq.answer)}
                                </p>
                            ) : null}
                        </div>
                    ))}
                    <p className={styles.attribution}>
                        {fill(
                            texts.attributionBeforeLink,
                            "attributionBeforeLink"
                        )}
                        {fill(texts.attributionLinkText, "attributionLinkText")}
                    </p>
                </section>
            </div>
        </div>
    );
}
