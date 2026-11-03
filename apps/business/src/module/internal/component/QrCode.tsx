import { Stack } from "@frak-labs/design-system/components/Stack";
import { encodeQR } from "qr";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CopyableValue } from "@/module/common/component/CopyableValue";
import { frakCodeUrl } from "../format";
import { linkButton, qrFrame } from "../internal.css";

/** The QR, its link and an SVG download; the injected markup is `qr`'s own output for a code we issued. */
export function FrakCodeQr({ code }: { code: string }) {
    const { t } = useTranslation();
    const url = frakCodeUrl(code);
    const svg = useMemo(() => encodeQR(url, "svg", { ecc: "medium" }), [url]);
    return (
        <Stack space="s">
            <div
                className={qrFrame}
                role="img"
                aria-label={url}
                dangerouslySetInnerHTML={{
                    __html: svg.replace(
                        "<svg ",
                        '<svg style="display:block;width:100%;height:100%" '
                    ),
                }}
            />
            <a
                className={linkButton}
                href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
                download={`${code}.svg`}
            >
                {t("internal.codes.downloadQr")}
            </a>
            <CopyableValue
                value={url}
                helper={t("internal.codes.issue.issued")}
            />
        </Stack>
    );
}
