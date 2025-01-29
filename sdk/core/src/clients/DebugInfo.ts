import type { FrakWalletSdkConfig, IFrameEvent } from "../types";

type IframeStatus = {
    loading: boolean;
    url: string | null;
    readyState: number;
    contentWindow: boolean;
    isConnected: boolean;
};

type DebugInfo = {
    timestamp: string;
    encodedUrl: string;
    navigatorInfo: string;
    encodedConfig: string;
    iframeStatus: string;
    lastRequest: string;
    lastResponse: string;
    clientStatus: string;
    error: string;
};

type NavigatorInfo = {
    userAgent: string;
    language: string;
    onLine: boolean;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
};

/** @ignore */
export class DebugInfoGatherer {
    private config?: FrakWalletSdkConfig;
    private iframe?: HTMLIFrameElement;
    private isSetupDone = false;
    private lastResponse: null | {
        event: IFrameEvent;
        origin: string;
        timestamp: number;
    } = null;
    private lastRequest: null | {
        event: IFrameEvent;
        target: string;
        timestamp: number;
    } = null;

    constructor(config?: FrakWalletSdkConfig, iframe?: HTMLIFrameElement) {
        this.config = config;
        this.iframe = iframe;
        this.lastRequest = null;
        this.lastResponse = null;
    }

    // Update communication logs
    public setLastResponse(event: MessageEvent<IFrameEvent>) {
        this.lastResponse = {
            event: event.data,
            origin: event.origin,
            timestamp: Date.now(),
        };
    }
    public setLastRequest(event: IFrameEvent, target: string) {
        this.lastRequest = { event, target, timestamp: Date.now() };
    }

    // Update connection status
    public updateSetupStatus(status: boolean) {
        this.isSetupDone = status;
    }

    private base64Encode(data: object): string {
        try {
            return btoa(JSON.stringify(data));
        } catch (err) {
            console.warn("Failed to encode debug data", err);
            return btoa("Failed to encode data");
        }
    }

    /**
     * Extract information from the iframe status
     */
    private getIframeStatus(): IframeStatus | null {
        if (!this.iframe) {
            return null;
        }
        return {
            loading: this.iframe.hasAttribute("loading"),
            url: this.iframe.src,
            readyState: this.iframe.contentDocument?.readyState
                ? this.iframe.contentDocument.readyState === "complete"
                    ? 1
                    : 0
                : -1,
            contentWindow: !!this.iframe.contentWindow,
            isConnected: this.iframe.isConnected,
        };
    }

    private getNavigatorInfo(): NavigatorInfo | null {
        if (!navigator) {
            return null;
        }
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            onLine: navigator.onLine,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            pixelRatio: window.devicePixelRatio,
        };
    }

    private gatherDebugInfo(error: Error | unknown): DebugInfo {
        const iframeStatus = this.getIframeStatus();
        const navigatorInfo = this.getNavigatorInfo();

        const debugInfo: DebugInfo = {
            timestamp: new Date().toISOString(),
            encodedUrl: btoa(window.location.href),
            encodedConfig: this.config
                ? this.base64Encode(this.config)
                : "no-config",
            navigatorInfo: navigatorInfo
                ? this.base64Encode(navigatorInfo)
                : "no-navigator",
            iframeStatus: iframeStatus
                ? this.base64Encode(iframeStatus)
                : "not-iframe",
            lastRequest: this.lastRequest
                ? this.base64Encode(this.lastRequest)
                : "No Frak request logged",
            lastResponse: this.lastResponse
                ? this.base64Encode(this.lastResponse)
                : "No Frak response logged",
            clientStatus: this.isSetupDone ? "setup" : "not-setup",
            error:
                error instanceof Error
                    ? error.message
                    : error instanceof String
                      ? error.toString()
                      : "Unknown",
        };

        return debugInfo;
    }

    public static empty(): DebugInfoGatherer {
        return new DebugInfoGatherer();
    }

    /**
     * Format Frak debug information
     */
    public formatDebugInfo(error: Error | unknown | string): string {
        const debugInfo = this.gatherDebugInfo(error);
        return `
  Debug Information:
  -----------------
  Timestamp: ${debugInfo.timestamp}
  URL: ${debugInfo.encodedUrl}
  Config: ${debugInfo.encodedConfig}
  Navigator Info: ${debugInfo.navigatorInfo}
  IFrame Status: ${debugInfo.iframeStatus}
  Last Request: ${debugInfo.lastRequest}
  Last Response: ${debugInfo.lastResponse}
  Client Status: ${debugInfo.clientStatus}
  Error: ${debugInfo.error}
      `.trim();
    }
}
