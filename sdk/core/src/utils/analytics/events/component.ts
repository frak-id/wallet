export type SdkComponentEventMap = {
    share_button_clicked: { placement?: string };
    wallet_button_clicked: {
        placement?: string;
        state?: "logged-in" | "logged-out";
    };
    open_in_app_clicked: undefined;
    open_in_app_login_clicked: undefined;
    app_not_installed: undefined;
    share_modal_error: {
        error?: string;
        [key: string]: unknown;
    };
    banner_impression: { placement: string };
    banner_clicked: { placement: string };
};
