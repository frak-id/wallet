import { useEnvironment } from "../../root/hook/useEnvironment";

export function AnalyticsWrapper() {
    const { isProduction } = useEnvironment();

    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;

    if (isProduction && websiteId) {
        return (
            <script
                defer
                src="https://umami.frak.id/script.js"
                data-website-id={websiteId}
            />
        );
    }
    return null;
}
