import {
    useApi,
    useSettings,
} from "@shopify/ui-extensions/checkout/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function ThankYouExtension() {
    const settings = useSettings();
    const { orderConfirmation } = useApi<"purchase.thank-you.block.render">();

    // Thank You page only provides orderId (no customer/token)
    const orderData = {
        orderId: orderConfirmation.value?.order.id,
    };

    return <PostPurchaseCard settings={settings} orderData={orderData} />;
}

export default function extension() {
    render(<ThankYouExtension />, document.body);
}
