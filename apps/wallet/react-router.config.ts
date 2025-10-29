import type { Config } from "@react-router/dev/config";

export default {
    // Disable SSR (client-side only), but enable prerendering for static shells
    ssr: false,

    // Prerender routes at build time to generate static HTML shells
    // This shows content immediately while JS loads, improving perceived performance
    async prerender() {
        return [
            "/", // Home page
            "/sso", // SSO page shell (data will hydrate client-side)
            "/login",
            "/register",
        ];
    },
} satisfies Config;
