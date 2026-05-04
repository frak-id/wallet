import { useState } from "react";

/**
 * Renders a merchant logo only after it has successfully loaded.
 *
 * Keeps the `<img>` mounted so `onLoad` can fire, but hides it via
 * `display: none` until the image is ready — avoiding any flash of a
 * broken-image icon when the merchant didn't provide a logo or the URL
 * is invalid.
 */
export function MerchantLogo({
    src,
    alt,
    className,
}: {
    src?: string;
    alt: string;
    className: string;
}) {
    const [loaded, setLoaded] = useState(false);
    if (!src) return null;
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={{ display: loaded ? undefined : "none" }}
            onLoad={() => setLoaded(true)}
        />
    );
}
