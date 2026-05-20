const urlRegex =
    /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,})+\/?$/i;

export function validateUrl(url: string): boolean {
    return urlRegex.test(url);
}
