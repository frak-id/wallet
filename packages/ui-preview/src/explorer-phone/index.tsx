import { CloseIcon, ShareIcon } from "@frak-labs/design-system/icons";
import { useEffect, useRef, useState } from "react";
import heroPlaceholderUrl from "./assets/hero-placeholder.webp";
import phoneFrame2xUrl from "./assets/phone-frame@2x.webp";
import phoneFrameUrl from "./assets/phone-frame.webp";
import statusLevelsUrl from "./assets/status-levels.svg";
import * as styles from "./explorer-phone.css";

export type ExplorerPhonePreviewProps = {
    /**
     * Merchant / shop name displayed as the sheet title.
     */
    name: string;
    /**
     * Hero image URL filling the top of the screen.
     * Falls back to a checkered placeholder when absent.
     */
    heroImageUrl?: string;
    /**
     * Additional hero images, swipeable after the main one like the
     * wallet's hero carousel.
     */
    heroImageUrls?: string[];
    /**
     * Merchant logo URL shown as a round avatar in the sheet.
     * Falls back to a "Logo" placeholder when absent.
     */
    logoUrl?: string;
    /**
     * Short merchant description shown in the white card.
     * Falls back to a default marketing line when absent.
     */
    description?: string;
    /**
     * Reward line under the merchant name (e.g. "1€ par parrainage").
     * Static example text by default — pass the real campaign reward when
     * the consumer has it.
     */
    rewardText?: string;
};

const DEFAULT_DESCRIPTION =
    "Découvrez nos offres exclusives et partagez-les avec vos amis pour gagner des récompenses.";

/**
 * Phone-frame preview showing how a merchant appears in the Frak Explorer
 * app. The device frame and chrome are exported artwork; the hero image
 * shows through the frame's transparent screen window and the merchant
 * sheet content is overlaid on its screen body. Purely presentational and
 * `position: static` — the consuming page handles any fixed positioning.
 */
export function ExplorerPhonePreview({
    name,
    heroImageUrl,
    heroImageUrls,
    logoUrl,
    description,
    rewardText = "1€ par parrainage",
}: ExplorerPhonePreviewProps) {
    const [slideIndex, setSlideIndex] = useState(0);
    const heroTrackRef = useRef<HTMLDivElement>(null);
    const isHoveredRef = useRef(false);

    const heroImages = [heroImageUrl, ...(heroImageUrls ?? [])].filter(
        (url): url is string => Boolean(url)
    );
    const heroCount = heroImages.length;

    // Auto-advance the carousel (desktop mice can't swipe a snap track);
    // pauses while hovered, loops back to the first slide.
    useEffect(() => {
        if (heroCount < 2) return;
        const id = setInterval(() => {
            const el = heroTrackRef.current;
            if (!el || isHoveredRef.current || document.hidden) return;
            const next =
                (Math.round(el.scrollLeft / el.clientWidth) + 1) % heroCount;
            el.scrollTo({
                left: next * el.clientWidth,
                behavior: "smooth",
            });
        }, 3000);
        return () => clearInterval(id);
    }, [heroCount]);

    return (
        <div className={styles.phoneShell}>
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

            <div className={styles.screen}>
                {/* Hero carousel, drawn over the frame's screen window */}
                <div
                    ref={heroTrackRef}
                    className={styles.hero}
                    onScroll={(e) => {
                        const el = e.currentTarget;
                        setSlideIndex(
                            Math.round(el.scrollLeft / el.clientWidth)
                        );
                    }}
                    onPointerEnter={() => {
                        isHoveredRef.current = true;
                    }}
                    onPointerLeave={() => {
                        isHoveredRef.current = false;
                    }}
                >
                    {heroImages.length > 0 ? (
                        heroImages.map((url) => (
                            <div
                                key={url}
                                className={`${styles.heroSlide} ${styles.heroDimmed}`}
                                style={{ backgroundImage: `url(${url})` }}
                            />
                        ))
                    ) : (
                        <div
                            className={styles.heroSlide}
                            style={{
                                backgroundImage: `url(${heroPlaceholderUrl})`,
                            }}
                        />
                    )}
                </div>
                {heroImages.length > 1 && (
                    <span className={styles.heroCount}>
                        {Math.min(slideIndex + 1, heroImages.length)} /{" "}
                        {heroImages.length}
                    </span>
                )}
                {/* Status bar + glass controls over the hero */}
                <div className={styles.toolbar}>
                    <div className={styles.statusBar}>
                        <span className={styles.statusTime}>9:41</span>
                        <img
                            src={statusLevelsUrl}
                            alt=""
                            className={styles.statusLevels}
                        />
                    </div>
                    <div className={styles.controls}>
                        <span className={styles.glassButton}>
                            <CloseIcon width={18} height={18} />
                        </span>
                        <span className={styles.glassButton}>
                            <ShareIcon width={16.5} height={16.5} />
                        </span>
                    </div>
                </div>
                <div className={styles.notch} />

                {/* Bottom sheet, ending above the frame's baked CTA */}
                <div className={styles.sheet}>
                    <div className={styles.sheetHeader}>
                        <div className={styles.sheetTitles}>
                            <span className={styles.merchantName}>{name}</span>
                            <span className={styles.rewardText}>
                                {rewardText}
                            </span>
                        </div>
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={`${name} logo`}
                                className={styles.logo}
                            />
                        ) : (
                            <div className={styles.logoPlaceholder}>Logo</div>
                        )}
                    </div>

                    <div className={styles.descriptionCard}>
                        <span className={styles.descriptionText}>
                            {description ?? DEFAULT_DESCRIPTION}
                        </span>
                        <span className={styles.readMore}>Lire la suite</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
