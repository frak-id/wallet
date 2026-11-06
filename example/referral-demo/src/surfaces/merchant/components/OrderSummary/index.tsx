import { ProductArt } from "@/art";
import { type Order, orderTotal, products } from "@/data/merchant";
import { useLang } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import * as checkout from "../checkout.css";
import { useMerchantT } from "../format";
import * as styles from "./orderSummary.css";

/** French prices include 20 % VAT; Shopify prints the included share. */
const VAT_RATE = 0.2;

/** Shopify order lines (thumb with quantity badge) followed by the totals. */
export function OrderSummary({ order }: { order: Order }) {
    const t = useMerchantT();
    const lang = useLang();
    const money = useFormatMoney();
    const total = orderTotal(order);
    const subtotal = total - order.shipping;
    const vat = Math.round((total - total / (1 + VAT_RATE)) * 100) / 100;

    return (
        <div className={styles.summary}>
            {order.lines.map((line) => {
                const product = products[line.productId];
                return (
                    <div key={line.productId} className={checkout.orderLine}>
                        <span className={checkout.lineThumb}>
                            <ProductArt
                                productId={line.productId}
                                variant="cutout"
                            />
                            <span className={checkout.qtyBadge}>
                                {line.quantity}
                            </span>
                        </span>
                        <span className={checkout.orderLineText}>
                            <span className={checkout.orderLineName}>
                                {product.name[lang]}
                            </span>
                            <span className={checkout.small}>
                                {product.size}
                            </span>
                        </span>
                        <span>{money(product.price * line.quantity)}</span>
                    </div>
                );
            })}
            <div className={checkout.totals}>
                <div className={checkout.totalRow}>
                    <span>{t("checkout.subtotal")}</span>
                    <span>{money(subtotal)}</span>
                </div>
                <div className={checkout.totalRow}>
                    <span>{t("checkout.shipping")}</span>
                    <span>
                        {order.shipping === 0
                            ? t("checkout.free")
                            : money(order.shipping)}
                    </span>
                </div>
                <div className={checkout.grandTotal}>
                    <span>{t("checkout.total")}</span>
                    <span>
                        <span className={checkout.currency}>EUR</span>
                        {money(total)}
                    </span>
                </div>
                <span className={checkout.small}>
                    {t("checkout.taxes", { amount: money(vat) })}
                </span>
            </div>
        </div>
    );
}
