import { cssSource as sharedBaseCss } from "../styles/sharedBaseCss.css";
import { styleManager } from "../styles/styleManager";
import { onDocumentReady } from "../utils/browser/onDocumentReady";
import { initFrakSdk } from "./initFrakSdk";

// The reset rules + theme tokens are injected here once for the whole SDK:
// no component bundles them in its own cssSource (see sharedBaseCss.css.ts).
styleManager.injectBase("shared", sharedBaseCss);

// Prevent FOUCE: hide undefined custom elements until they're registered
styleManager.injectBase(
    "fouce",
    "frak-button-share:not(:defined), frak-button-wallet:not(:defined), frak-open-in-app:not(:defined), frak-post-purchase:not(:defined), frak-banner:not(:defined) { display: none !important; }"
);

onDocumentReady(initFrakSdk);

/**
 * Map of component tag names to their chunk paths.
 */
const COMPONENTS_MAP = {
    "button-share": () =>
        import(
            /* webpackChunkName: "button-share" */ "../components/ButtonShare"
        ),
    "button-wallet": () =>
        import(
            /* webpackChunkName: "button-wallet" */ "../components/ButtonWallet"
        ),
    "open-in-app": () =>
        import(
            /* webpackChunkName: "open-in-app" */ "../components/OpenInAppButton"
        ),
    "post-purchase": () =>
        import(
            /* webpackChunkName: "post-purchase" */ "../components/PostPurchase"
        ),
    banner: () =>
        import(/* webpackChunkName: "banner" */ "../components/Banner"),
} as const;

const observer = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
        for (const node of Array.from(addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                discover(node as Element);
            }
        }
    }
});

/**
 * Discover and register every undefined `frak-*` element under `root`.
 */
async function discover(root: Element | ShadowRoot) {
    const rootTagName =
        root instanceof Element ? root.tagName.toLowerCase() : "";
    const isFrakElement = rootTagName?.startsWith("frak-");
    const tags = Array.from(root.querySelectorAll(":not(:defined)"))
        .map((el) => el.tagName.toLowerCase())
        .filter((tag) => tag.startsWith("frak-"));

    // If the root element is an undefined Frak component, add it to the list
    if (isFrakElement && !customElements.get(rootTagName)) {
        tags.push(rootTagName);
    }

    const tagsToRegister = [...new Set(tags)];

    await Promise.allSettled(
        tagsToRegister.map((tagName) => register(tagName))
    );
}

/**
 * Register an element by tag name.
 */
async function register(tagName: string) {
    if (customElements.get(tagName)) {
        return Promise.resolve();
    }

    const componentName = tagName.replace(/^frak-/i, "");
    if (!(componentName in COMPONENTS_MAP)) {
        console.error(`Component ${tagName} is not supported.`);
        return;
    }

    try {
        await COMPONENTS_MAP[componentName as keyof typeof COMPONENTS_MAP]();
    } catch (error) {
        console.error(error);
    }
}

// Initial discovery
discover(document.body);

// Observe the document for new elements
observer.observe(document.documentElement, { subtree: true, childList: true });
