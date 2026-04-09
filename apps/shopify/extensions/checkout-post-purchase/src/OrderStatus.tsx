import {
    useCustomer,
    useOrder,
    useSettings,
} from "@shopify/ui-extensions/customer-account/preact";
import { render } from "preact";
import { PostPurchaseCard } from "./PostPurchaseCard";

function OrderStatusExtension() {
    const settings = useSettings();
    const order = useOrder();
    const customer = useCustomer();

    // Order Status page provides full order + customer data
    const orderData = {
        orderId: order?.id,
        customerId: customer?.id,
    };

    return <PostPurchaseCard settings={settings} orderData={orderData} />;
}

export default function extension() {
    render(<OrderStatusExtension />, document.body);
}
