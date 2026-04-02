/**
 * Load a script
 * @param id
 * @param url
 */
export async function loadScript(
    id: string,
    url: string,
    type: "module" | "text/javascript" = "text/javascript"
) {
    if (document.getElementById(id)) {
        return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = id;
        script.src = url;
        script.defer = true;
        script.type = type;
        script.onload = () => resolve(true);
        script.onerror = () =>
            reject(new Error(`Script load error for ${url}`));

        document.head.appendChild(script);
    });
}
