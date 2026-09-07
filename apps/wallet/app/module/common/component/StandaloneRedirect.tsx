import { useEffect } from "react";
import type { InstallView as RealInstallView } from "../../install/component/InstallView";
import type { SharingView as RealSharingView } from "../../sharing/component/SharingView";

/**
 * Web-build stand-ins for `SharingView` and `InstallView`.
 *
 * On the web those two pages are served by their own Vite build
 * (`vite.standalone.config.ts`), and the SPA routes in
 * `app/routes/{sharing,install}.tsx` exist only for Tauri, which has no nginx
 * in front of it and navigates to them client-side. So `vite.config.ts` swaps
 * the real views for these on every non-Tauri build.
 *
 * That does two things. It keeps ~40 KB of view code — and the `sonner`,
 * `CodeInput` and pending-action trees behind it — out of the `feature-social`
 * chunk, which is *also* what every `_protected-fullscreen` route (pairing,
 * profile, recovery, devices, favorites) pulls, so web users stop downloading
 * a page they can never reach. And it makes the slow path unreachable: a
 * `<Link to="/install">` added to the SPA later cannot silently bypass the
 * standalone build, because on the web it now lands on a document navigation
 * to the fast page instead of rendering the SPA copy.
 *
 * The type-only imports below are relative on purpose: `@/module/...` is what
 * `vite.config.ts` aliases, and a relative specifier can never match it, so
 * these keep pointing at the real modules. They are erased at build time and
 * pull no runtime code.
 */

/**
 * Leave the SPA for the standalone document at `pathname`, preserving the
 * query and fragment both pages read their parameters from.
 *
 * This cannot loop. `pathname` is the canonical path nginx exact-matches, and
 * that location `=404`s rather than falling back to the SPA — so the only two
 * outcomes are the standalone document (which never boots the SPA) or a hard
 * 404. A non-canonical spelling such as `/sharing/` misses the exact-match
 * block and renders the SPA once, then normalises here and is served by it.
 */
function useStandaloneRedirect(pathname: string) {
    useEffect(() => {
        window.location.replace(
            pathname + window.location.search + window.location.hash
        );
    }, [pathname]);
}

/** Web stand-in for `SharingView` — see the module doc. */
export function SharingView(
    _props: Parameters<typeof RealSharingView>[0]
): null {
    useStandaloneRedirect("/sharing");
    return null;
}

/** Web stand-in for `InstallView` — see the module doc. */
export function InstallView(
    _props: Parameters<typeof RealInstallView>[0]
): null {
    useStandaloneRedirect("/install");
    return null;
}
