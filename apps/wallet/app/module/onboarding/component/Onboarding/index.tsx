import { Box } from "@frak-labs/ui/component/Box";
import { Button } from "@frak-labs/ui/component/Button";
import { cx } from "class-variance-authority";
import {
    Children,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import styles from "./index.module.css";

type OnboardingProps = {
    /** Text for the navigation button */
    buttonLabel: string;
    /** Optional text for the button on the last slide (falls back to buttonLabel if not provided) */
    lastButtonLabel?: string;
    /** Called when user clicks button on the last slide */
    onFinish: () => void;
    /** The slide contents — each direct child = one slide */
    children: ReactNode;
};

export function Onboarding({
    buttonLabel,
    lastButtonLabel,
    onFinish,
    children,
}: OnboardingProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const slidesCount = Children.count(children);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const index = Number(
                            (entry.target as HTMLElement).dataset.index
                        );
                        if (!Number.isNaN(index)) {
                            setCurrentIndex(index);
                        }
                    }
                }
            },
            {
                root: container,
                threshold: 0.5,
            }
        );

        const slideElements = container.querySelectorAll(
            `.${styles.onboarding__slide}`
        );
        for (const slide of slideElements) {
            observer.observe(slide);
        }

        return () => {
            observer.disconnect();
        };
    }, [slidesCount]);

    const handleNext = useCallback(() => {
        if (currentIndex === slidesCount - 1) {
            onFinish();
            return;
        }

        const container = scrollContainerRef.current;
        if (!container) return;

        const nextSlide = container.querySelector(
            `.${styles.onboarding__slide}[data-index="${currentIndex + 1}"]`
        ) as HTMLElement;

        if (nextSlide) {
            container.scrollTo({
                left: nextSlide.offsetLeft,
                behavior: "smooth",
            });
        }
    }, [currentIndex, slidesCount, onFinish]);

    return (
        <div className={styles.onboarding}>
            <div ref={scrollContainerRef} className={styles.onboarding__slides}>
                {Children.map(children, (child, index) => (
                    <div
                        className={styles.onboarding__slide}
                        data-index={index}
                    >
                        {child}
                    </div>
                ))}
            </div>

            <Box gap="l" padding="none" className={styles.onboarding__footer}>
                <div className={styles.onboarding__dots}>
                    {Array.from({ length: slidesCount }).map((_, index) => (
                        <div
                            key={index}
                            className={cx(
                                styles.onboarding__dot,
                                index === currentIndex &&
                                    styles["onboarding__dot--active"]
                            )}
                        />
                    ))}
                </div>

                <Button width={"full"} size={"medium"} onClick={handleNext}>
                    {currentIndex === slidesCount - 1 && lastButtonLabel
                        ? lastButtonLabel
                        : buttonLabel}
                </Button>
            </Box>
        </div>
    );
}
