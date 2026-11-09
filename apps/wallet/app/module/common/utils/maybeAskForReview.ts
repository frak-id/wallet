import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    isProdStage,
    sessionStore,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { biometricsStore } from "@/module/biometrics/stores/biometricsStore";
import { modalStore } from "@/module/stores/modalStore";
import {
    type ReviewTrigger,
    reviewPromptStore,
} from "@/module/stores/reviewPromptStore";
import { shouldAskForReview } from "./reviewDecision";
import { requestStoreReview } from "./storeReview";

/** Lets the closing screen settle so the native prompt does not land on a transition. */
const SETTLE_MS = 1_500;

const LAUNCH_COUNTED_KEY = "frak_review_launch_counted";

/** The native call is async: a second trigger in the same window must see it still running. */
let requestInFlight = false;

function shouldAsk(trigger: ReviewTrigger) {
    return shouldAskForReview(
        reviewPromptStore.getState(),
        trigger,
        Date.now()
    );
}

function isBlocked() {
    return (
        sessionStore.getState().session === null ||
        modalStore.getState().modal !== null ||
        biometricsStore.getState().isLocked
    );
}

async function ask(trigger: ReviewTrigger) {
    if (requestInFlight || !shouldAsk(trigger) || isBlocked()) return;
    requestInFlight = true;
    try {
        if (!(await requestStoreReview())) return;
        reviewPromptStore.getState().markAsked(Date.now());
        trackEvent("store_review_requested", { trigger });
    } finally {
        requestInFlight = false;
    }
}

export function maybeAskForReview(trigger: ReviewTrigger): void {
    if (!(IS_TAURI && isProdStage && shouldAsk(trigger))) return;
    setTimeout(() => void ask(trigger), SETTLE_MS);
}

/** Once per app start: a webview reload keeps `sessionStorage`, an app restart does not. */
export function registerAppLaunch(): void {
    if (sessionStorage.getItem(LAUNCH_COUNTED_KEY) !== null) return;
    sessionStorage.setItem(LAUNCH_COUNTED_KEY, "1");
    reviewPromptStore.getState().recordLaunch();
    maybeAskForReview("app_launch");
}
