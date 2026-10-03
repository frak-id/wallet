import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { ShareIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { useNativeDetailChrome } from "../../hook/useNativeDetailChrome";
import { useNativeToolbar } from "../../hook/useNativeToolbar";
import { useDetailSheetChromeVisible } from "../../hook/useOverlayOpen";

type GlassDetailActionsProps = {
    /** Native toolbar id; one per sheet. */
    id: string;
    onClose: () => void;
    closeLabel?: string;
    /** Omit to hide the share button. */
    onShare?: () => void;
    shareLabel?: string;
};

/**
 * Close + share buttons of a detail sheet's `DetailSheetActions`: native
 * Liquid Glass on iOS 26, the web glass buttons everywhere else.
 */
export function GlassDetailActions(props: GlassDetailActionsProps) {
    const native = useNativeDetailChrome();
    return native ? (
        <NativeDetailActions {...props} />
    ) : (
        <WebDetailActions {...props} />
    );
}

function WebDetailActions({
    onClose,
    closeLabel,
    onShare,
    shareLabel,
}: GlassDetailActionsProps) {
    const { t } = useTranslation();
    return (
        <>
            <GlassCloseButton onClick={onClose} label={closeLabel} />
            {onShare && (
                <GlassButton
                    as="button"
                    icon={<ShareIcon width={20} height={20} />}
                    onClick={onShare}
                    aria-label={shareLabel ?? t("common.share")}
                />
            )}
        </>
    );
}

function NativeDetailActions({
    id,
    onClose,
    closeLabel,
    onShare,
    shareLabel,
}: GlassDetailActionsProps) {
    const { t } = useTranslation();
    const visible = useDetailSheetChromeVisible("top");

    useNativeToolbar(id, {
        leading: [
            {
                id: "close",
                icon: "glass-close",
                label: closeLabel ?? t("common.close"),
            },
        ],
        trailing: onShare
            ? [
                  {
                      id: "share",
                      icon: "glass-share",
                      label: shareLabel ?? t("common.share"),
                  },
              ]
            : [],
        visible,
        onAction: (itemId) => {
            if (itemId === "close") onClose();
            if (itemId === "share") onShare?.();
        },
    });

    return null;
}
