import { Button } from "@frak-labs/design-system/components/Button";
import { Children, type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import * as styles from "./index.css";

type OnboardingProps = {
    /** Text for the navigation button */
    buttonLabel: string;
    /** Optional text for the button on the first slide (falls back to buttonLabel if not provided) */
    firstButtonLabel?: string;
    /** Optional text for the button on the last slide (falls back to buttonLabel if not provided) */
    lastButtonLabel?: string;
    /** Called when user clicks button on the last slide */
    onFinish: () => void;
    /** Optional label for the login link shown on the first slide */
    loginLabel?: string;
    /** Called when user clicks the login link */
    onLoginClick?: () => void;
    /** The slide contents — each direct child = one slide */
    children: ReactNode;
};

export function Onboarding({
    buttonLabel,
    firstButtonLabel,
    lastButtonLabel,
    onFinish,
    loginLabel,
    onLoginClick,
    children,
}: OnboardingProps) {
    const { t } = useTranslation();
    const slidesCount = Children.count(children);
    const { currentIndex, goToIndex, goToNext, scrollContainerRef } =
        useSlideCarousel({
            slideCount: slidesCount,
        });

    const handleNext = useCallback(() => {
        if (currentIndex === slidesCount - 1) {
            onFinish();
            return;
        }

        goToNext();
    }, [currentIndex, goToNext, slidesCount, onFinish]);

    return (
        <PageLayout
            footer={
                <>
                    <Button onClick={handleNext}>
                        {currentIndex === 0 && firstButtonLabel
                            ? firstButtonLabel
                            : currentIndex === slidesCount - 1 &&
                                lastButtonLabel
                              ? lastButtonLabel
                              : buttonLabel}
                    </Button>
                    {currentIndex === 0 && loginLabel && onLoginClick && (
                        <Button variant="secondary" onClick={onLoginClick}>
                            {loginLabel}
                        </Button>
                    )}
                    {currentIndex === 0 && (
                        <Button size="small" variant="ghost">
                            {t("onboarding.recoveryCode")}
                        </Button>
                    )}
                </>
            }
        >
            <div ref={scrollContainerRef} className={styles.slides}>
                {Children.map(children, (child, index) => (
                    <div className={styles.slide} data-index={index}>
                        {child}
                        <div className={styles.dots}>
                            {Array.from({ length: slidesCount }).map(
                                (_, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={`${styles.dot}${index === currentIndex ? ` ${styles.dotActive}` : ""}`}
                                        aria-label={`Slide ${index + 1}`}
                                        onClick={() => goToIndex(index)}
                                    />
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </PageLayout>
    );
}
