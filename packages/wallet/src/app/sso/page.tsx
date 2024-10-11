import { Sso } from "@/module/authentication/component/Sso";
import { SsoHeader } from "@/module/authentication/component/Sso/SsoHeader";
import "./page.global.css";

/**
 * SSO page exposing:
 *  - Register, login, and recovery
 *  - Saving some query params inside an atom
 *      - redirectUri?
 *      - directExit?
 * @constructor
 */
export default function SsoPage() {
    return (
        <>
            <SsoHeader />
            <Sso />
        </>
    );
}
