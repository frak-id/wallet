export interface Env {
    [key: string]: string | undefined;
}

declare global {
    interface Window {
        ENV: Env;
    }
}
