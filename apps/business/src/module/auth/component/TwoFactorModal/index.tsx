import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    TwoFactorChallengePanel,
    type TwoFactorHeadingSlot,
} from "@/module/auth/component/TwoFactorChallengePanel";
import { useTwoFactorStore } from "@/stores/twoFactorStore";

// Bind the panel's headings to Radix so the step-up dialog gets an accessible
// name/description; `asChild` keeps the same visible `Text` styling as the
// inline `/login/2fa` presentation.
const DialogTitleSlot: TwoFactorHeadingSlot = ({ children }) => (
    <DialogTitle asChild>
        <Text as="h2" variant="heading4">
            {children}
        </Text>
    </DialogTitle>
);

const DialogDescriptionSlot: TwoFactorHeadingSlot = ({ children }) => (
    <DialogDescription asChild>
        <Text as="p" variant="bodySmall" color="secondary">
            {children}
        </Text>
    </DialogDescription>
);

/**
 * Global 2FA challenge/verify modal — driven by `useTwoFactorStore`. Only for
 * a stale-session step-up (`stepUpAwareFetch` 401 retry, §4.5): the
 * `/login/2fa` pending-login completion renders `TwoFactorChallengePanel`
 * inline in the branded login shell instead (no modal over a blank page),
 * flagged by `presentation: "inline"` on the store request.
 */
export function TwoFactorModal() {
    const request = useTwoFactorStore((state) => state.request);
    const resolveVerification = useTwoFactorStore(
        (state) => state.resolveVerification
    );
    const cancelVerification = useTwoFactorStore(
        (state) => state.cancelVerification
    );

    if (!request || request.presentation === "inline") return null;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) cancelVerification();
            }}
        >
            <DialogContent>
                <TwoFactorChallengePanel
                    methods={request.methods}
                    onVerified={resolveVerification}
                    onDismiss={cancelVerification}
                    Title={DialogTitleSlot}
                    Description={DialogDescriptionSlot}
                />
            </DialogContent>
        </Dialog>
    );
}
