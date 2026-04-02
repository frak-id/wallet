import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import { IntroSlide } from "./component/IntroSlide";
import { NotificationSlide } from "./component/NotificationSlide";
import { useWelcomeNotificationSlide } from "./hook/useWelcomeNotificationSlide";
import * as styles from "./index.css";
import {
    getDismissedSlides,
    persistDismissedSlides,
} from "./utils/dismissedSlides";
import type { WelcomeSlide, WelcomeSlideId } from "./utils/types";
import { WelcomeDetail } from "./WelcomeDetail";

export function WelcomeCard() {
    const { t } = useTranslation();
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const notificationSlide = useWelcomeNotificationSlide();
    const [dismissedSlides, setDismissedSlides] =
        useState<WelcomeSlideId[]>(getDismissedSlides);
    const slides: WelcomeSlide[] = [
        {
            id: "intro",
            kind: "intro",
            title: t("wallet.welcome.title"),
            items: [
                t("wallet.welcome.check1"),
                t("wallet.welcome.check2"),
                t("wallet.welcome.check3"),
            ],
        },
        ...(notificationSlide ? [notificationSlide] : []),
    ];
    const visibleSlides = slides.filter(
        (slide) => !dismissedSlides.includes(slide.id)
    );
    const hasMultipleSlides = visibleSlides.length > 1;
    const { currentIndex, scrollContainerRef } = useSlideCarousel({
        slideCount: visibleSlides.length,
    });

    const handleDismiss = (event: MouseEvent) => {
        event.stopPropagation();
        const currentSlide = visibleSlides[currentIndex] ?? visibleSlides[0];
        if (!currentSlide) return;

        setDismissedSlides((previousDismissedSlides) => {
            const nextDismissedSlides = [
                ...new Set([...previousDismissedSlides, currentSlide.id]),
            ];

            persistDismissedSlides(nextDismissedSlides);
            return nextDismissedSlides;
        });
    };

    const handleIntroClick = () => {
        setIsDetailOpen(true);
    };

    const handleKeyDown = (callback: (() => void) | undefined) => (event: KeyboardEvent) => {
        if (callback && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            callback();
        }
    };

    if (visibleSlides.length === 0) {
        return null;
    }

    return (
        <>
            <Box display="flex" flexDirection="column" gap="xs">
                <Box
                    className={
                        hasMultipleSlides
                            ? styles.slider.multiple
                            : styles.slider.single
                    }
                    ref={scrollContainerRef}
                >
                    {visibleSlides.map((slide, index) => (
                        <Box
                            key={slide.id}
                            className={
                                hasMultipleSlides
                                    ? styles.slide.multiple
                                    : styles.slide.single
                            }
                            data-index={index}
                        >
                            <Card
                                variant="secondary"
                                padding="none"
                                className={styles.cardContainer}
                                role="button"
                                tabIndex={0}
                                onClick={
                                    slide.kind === "intro"
                                        ? handleIntroClick
                                        : slide.onAction
                                }
                                onKeyDown={handleKeyDown(
                                    slide.kind === "intro"
                                        ? handleIntroClick
                                        : slide.onAction
                                )}
                                style={{ cursor: "pointer" }}
                            >
                                {index === currentIndex && (
                                    <CloseButton
                                        onClick={handleDismiss}
                                        ariaLabel={t("common.close")}
                                        className={styles.dismissButton}
                                    />
                                )}
                                {slide.kind === "intro" ? (
                                    <IntroSlide
                                        title={slide.title}
                                        items={slide.items}
                                    />
                                ) : (
                                    <NotificationSlide
                                        title={slide.title}
                                        actionI18nKey={slide.actionI18nKey}
                                    />
                                )}
                            </Card>
                        </Box>
                    ))}
                </Box>
            </Box>
            {isDetailOpen && (
                <WelcomeDetail onClose={() => setIsDetailOpen(false)} />
            )}
        </>
    );
}
