/**
 * Load a css file
 * @param id
 * @param url
 */
export async function loadCSS(id: string, url: string) {
    if (document.getElementById(id)) {
        return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = url;
        link.onload = () => resolve(true);
        link.onerror = () => reject(new Error(`Script load error for ${url}`));

        document.head.appendChild(link);
    });
}
