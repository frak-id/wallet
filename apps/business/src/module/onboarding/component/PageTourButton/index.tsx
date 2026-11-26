import { useLocation } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { resolveTourId } from "@/module/onboarding/tours";
import { onboardingTourStore } from "@/stores/onboardingTourStore";

/** Opens the tour that describes the current page. */
export function PageTourButton({
    size = "small",
}: {
    size?: ComponentProps<typeof Button>["size"];
}) {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const tourId = resolveTourId(pathname);
    const isOpen = onboardingTourStore((s) => s.activeTour !== null);
    const startTour = onboardingTourStore((s) => s.startTour);

    if (!tourId) return null;

    return (
        <Button
            variant="secondary"
            size={size}
            icon={<CircleHelp size={16} aria-hidden="true" />}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            data-tour="page-tour-button"
            onClick={() => startTour(tourId)}
        >
            {t("onboarding.pageTour.button")}
        </Button>
    );
}
