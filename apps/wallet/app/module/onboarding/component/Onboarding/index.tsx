import { Button } from "@frak-labs/design-system/components/Button";
import {
    Children,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
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

        const slideElements = container.querySelectorAll(`.${styles.slide}`);
        for (const slideEl of slideElements) {
            observer.observe(slideEl);
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
            `.${styles.slide}[data-index="${currentIndex + 1}"]`
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
            <div ref={scrollContainerRef} className={styles.slides}>
                {Children.map(children, (child, index) => (
                    <div className={styles.slide} data-index={index}>
                        {child}
                        <div className={styles.dots}>
                            {Array.from({ length: slidesCount }).map(
                                (_, index) => (
                                    <div
                                        key={index}
                                        className={`${styles.dot}${index === currentIndex ? ` ${styles.dotActive}` : ""}`}
                                    />
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.footer}>
                <Button onClick={handleNext} size="small">
                    {currentIndex === 0 && firstButtonLabel
                        ? firstButtonLabel
                        : currentIndex === slidesCount - 1 && lastButtonLabel
                          ? lastButtonLabel
                          : buttonLabel}
                </Button>
                {currentIndex === 0 && loginLabel && onLoginClick && (
                    <Button variant="ghost" size="small" onClick={onLoginClick}>
                        {loginLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
