import { DetailSheetFooter } from "@frak-labs/design-system/components/DetailSheet";
import { Text } from "@frak-labs/design-system/components/Text";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ButtonLink } from "@/module/common/component/ButtonLink";
import { useNativeBottomAction } from "@/module/native-glass/hook/useNativeBottomAction";
import { useNativeDetailChrome } from "@/module/native-glass/hook/useNativeDetailChrome";
import { useDetailSheetChromeVisible } from "@/module/native-glass/hook/useOverlayOpen";

type WelcomeDetailFooterProps = {
    onClose: () => void;
};

/** Terms caption: above the web CTA, at the end of the body on iOS 26. */
export function WelcomeDetailLegal() {
    return (
        <Text variant="caption" align="center">
            <Trans
                i18nKey="wallet.welcome.detail.legal"
                components={{
                    termsLink: (
                        <ExternalLink href="https://frak.id/terms">
                            {" "}
                        </ExternalLink>
                    ),
                }}
            />
        </Text>
    );
}

/**
 * Welcome detail's "Discover offers" CTA: a native prominent glass button on
 * iOS 26, the web footer elsewhere.
 */
export function WelcomeDetailFooter(props: WelcomeDetailFooterProps) {
    const native = useNativeDetailChrome();
    return native ? <NativeFooter {...props} /> : <WebFooter {...props} />;
}

function WebFooter({ onClose }: WelcomeDetailFooterProps) {
    const { t } = useTranslation();
    return (
        <DetailSheetFooter>
            <WelcomeDetailLegal />
            <ButtonLink
                to="/explorer"
                onClick={onClose}
                variant="primary"
                width="full"
                size="large"
                fontSize="s"
            >
                {t("wallet.welcome.detail.discoverOffers")}
            </ButtonLink>
        </DetailSheetFooter>
    );
}

function NativeFooter({ onClose }: WelcomeDetailFooterProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const navigate = useNavigate();
    const visible = useDetailSheetChromeVisible("bottom");

    // `<Link>`s preload on render; nothing renders here, so preload by hand.
    useEffect(() => {
        router.preloadRoute({ to: "/explorer" }).catch(() => {});
    }, [router]);

    useNativeBottomAction({
        title: t("wallet.welcome.detail.discoverOffers"),
        visible,
        // A tap can land in the round trip before native hears of a hide.
        onPress: () => {
            if (!visible) return;
            onClose();
            navigate({ to: "/explorer" });
        },
    });

    return null;
}
