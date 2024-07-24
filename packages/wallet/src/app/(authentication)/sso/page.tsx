import { Sso } from "@/module/authentication/component/Sso";

/**
 * SSO page exposing:
 *  - Register, login, and recovery
 *  - Saving some query params inside an atom
 *      - redirectUri?
 *      - directExit?
 * @constructor
 */
export default function SsoPage() {
    return <Sso />;
}
