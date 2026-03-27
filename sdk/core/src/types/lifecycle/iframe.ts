/**
 * Event related to the iframe lifecycle
 * @ignore
 */
export type IFrameLifecycleEvent =
    | {
          iframeLifecycle: "connected" | "show" | "hide" | "remove-backup";
          data?: never;
      }
    | DoBackupEvent
    | RedirectRequestEvent;

type DoBackupEvent = {
    iframeLifecycle: "do-backup";
    data: { backup?: string };
};

type RedirectRequestEvent = {
    iframeLifecycle: "redirect";
    data: {
        /**
         * The base url to redirect to
         *  If it contain a query param `u`, the client need will suffix the current url to the base url
         */
        baseRedirectUrl: string;
        /**
         * Optional merge token for anonymous identity merging
         * When provided, appended as ?fmt= query parameter to the final redirect URL
         * Used when redirecting out of social browsers to preserve identity across contexts
         */
        mergeToken?: string;
    };
};
