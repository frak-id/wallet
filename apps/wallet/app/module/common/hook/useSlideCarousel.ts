import type { RefObject } from "react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

type UseSlideCarouselOptions = {
    slideCount: number;
};

type UseSlideCarouselReturn = {
    currentIndex: number;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    goToIndex: (index: number) => void;
    goToNext: () => void;
};

export function useSlideCarousel({
    slideCount,
}: UseSlideCarouselOptions): UseSlideCarouselReturn {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;

                    const index = Number(
                        (entry.target as HTMLElement).dataset.index
                    );

                    if (!Number.isNaN(index)) {
                        setCurrentIndex(index);
                    }
                }
            },
            {
                root: container,
                threshold: 0.5,
            }
        );

        const slideElements = container.querySelectorAll("[data-index]");
        for (const slideElement of slideElements) {
            observer.observe(slideElement);
        }

        return () => {
            observer.disconnect();
        };
    }, [slideCount]);

    useLayoutEffect(() => {
        if (slideCount === 0 || currentIndex < slideCount) return;

        const nextIndex = slideCount - 1;
        const container = scrollContainerRef.current;

        setCurrentIndex(nextIndex);

        if (!container) return;

        const frameId = requestAnimationFrame(() => {
            const slideElement = container.querySelector(
                `[data-index="${nextIndex}"]`
            ) as HTMLElement | null;

            if (!slideElement) return;

            container.scrollTo({
                left: slideElement.offsetLeft,
                behavior: "auto",
            });
        });

        return () => {
            cancelAnimationFrame(frameId);
        };
    }, [currentIndex, slideCount]);

    const goToIndex = useCallback(
        (index: number) => {
            if (index < 0 || index >= slideCount) return;

            const container = scrollContainerRef.current;
            if (!container) return;

            const nextSlide = container.querySelector(
                `[data-index="${index}"]`
            ) as HTMLElement | null;

            if (!nextSlide) return;

            setCurrentIndex(index);
            container.scrollTo({
                left: nextSlide.offsetLeft,
                behavior: "smooth",
            });
        },
        [slideCount]
    );

    const goToNext = useCallback(() => {
        goToIndex(currentIndex + 1);
    }, [currentIndex, goToIndex]);

    return {
        currentIndex,
        scrollContainerRef,
        goToIndex,
        goToNext,
    };
}
