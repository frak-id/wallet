import { useFormatNumber, useMerchantT } from "../format";
import { StarIcon } from "../icons";
import * as styles from "./rating.css";

const STARS = [1, 2, 3, 4, 5] as const;

/** Five stars, then "4,8 · 1 284 avis" (or "(1 284)" when `compact`, for product cards). */
export function Rating({
    rating,
    reviews,
    size = 12,
    compact = false,
}: {
    rating: number;
    reviews: number;
    size?: number;
    compact?: boolean;
}) {
    const t = useMerchantT();
    const number = useFormatNumber();
    const count = number(reviews);
    return (
        <span className={styles.rating}>
            <span className={styles.stars}>
                {STARS.map((star) => (
                    <StarIcon key={star} size={size} />
                ))}
            </span>
            <span>
                {compact
                    ? t("rating.compact", { count })
                    : t("rating.reviews", { rating: number(rating), count })}
            </span>
        </span>
    );
}
