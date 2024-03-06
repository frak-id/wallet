/**
 * Preload an image with its src url
 * @param src
 */
export function preloadImage(src: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = src;
        image.onload = () => resolve(true);
        image.onerror = () => reject(false);
    });
}
