import { LogoFrak } from "@frak-labs/design-system/icons";
import { Cuer } from "cuer";
import * as styles from "./index.css";

export type PairingQrCodeProps = {
    value: string;
    /** QR code edge length in pixels. Defaults to 224 (Figma full-page layout). */
    size?: number;
    /**
     * QR error correction level (Cuer / QR spec).
     *
     * Higher levels tolerate more damage but pack more (smaller) modules,
     * which hurts scannability at small render sizes. Pick per call-site:
     *  - small QR (~200px) → "medium" keeps modules readable
     *  - large QR (~224px+) → "quartile"/"high" lets the arena overlay
     *    safely cover the centre
     */
    errorCorrection?: "low" | "medium" | "quartile" | "high";
};

/**
 * Brand QR code: a Cuer code with the Frak-blue rounded arena overlay.
 *
 * The arena covers ~25-28% of the centre, so callers must pick an
 * `errorCorrection` level that tolerates the overlay at their render size.
 * Shared by `LaunchPairing` (size 200, "medium") and `PairingView`
 * (size 224, "quartile").
 */
export function PairingQrCode({
    value,
    size = 224,
    errorCorrection,
}: PairingQrCodeProps) {
    return (
        <div className={styles.qrCode}>
            <Cuer value={value} size={size} errorCorrection={errorCorrection} />
            <span className={styles.arena}>
                <LogoFrak width={30} height={30} />
            </span>
        </div>
    );
}
