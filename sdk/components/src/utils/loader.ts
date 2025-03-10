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
} as const;

const observer = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
        // Convert NodeList to Array before iteration
        for (const node of Array.from(addedNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                discover(node as Element);
            }
        }
    }
});

/**
 * Discover elements in the root element.
 * @param root The root element to discover elements in.
 */
async function discover(root: Element | ShadowRoot) {
    const rootTagName =
        root instanceof Element ? root.tagName.toLowerCase() : "";
    const isFrakElement = rootTagName?.startsWith("frak-");
    // Convert NodeList to Array
    const tags = Array.from(root.querySelectorAll(":not(:defined)"))
        .map((el) => el.tagName.toLowerCase())
        .filter((tag) => tag.startsWith("frak-"));

    // If the root element is an undefined Frak component, add it to the list
    if (isFrakElement && !customElements.get(rootTagName)) {
        tags.push(rootTagName);
    }

    // Make the list unique
    const tagsToRegister = [...new Set(tags)];

    await Promise.allSettled(
        tagsToRegister.map((tagName) => register(tagName))
    );
}

/**
 * Register an element by tag name.
 * @param tagName The tag name of the element to register.
 */
async function register(tagName: string) {
    // If custom element is already defined, early return
    if (customElements.get(tagName)) {
        return Promise.resolve();
    }

    try {
        // Remove the frak- prefix
        const componentName = tagName.replace(/^frak-/i, "");

        // Check if the component is supported
        if (!(componentName in COMPONENTS_MAP)) {
            throw new Error(`Component ${tagName} is not supported.`);
        }

        // Load the component
        await COMPONENTS_MAP[componentName as keyof typeof COMPONENTS_MAP]();
    } catch (error) {
        console.error(error);
    }
}

// Initial discovery
discover(document.body);

// Observe the document for new elements
observer.observe(document.documentElement, { subtree: true, childList: true });
