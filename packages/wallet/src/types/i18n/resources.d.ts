interface Resources {
    translation: {
        authent: {
            create: {
                alreadyRegistered: "You already have a registered wallet. Click the login button below to log in.";
                error: "Error during registration, please try again";
                inProgress: "Wallet creation in progress";
            };
            sso: {
                btn: {
                    create: "Use biometrics to prove you're not a robot";
                    login: "Connect an existing wallet";
                };
                description: "Before continuing, please make sure you are using a device that belongs to you.<br />Frak is a solution allowing <strong>{{productName}}</strong> to reward its community for the help provided in promoting its offers. <strong>Frak is a decentralized and open-source solution, which does not store any personal or biometric data.</strong><br />To learn more about <strong>{{productName}}</strong>, please review our Privacy Policy and Terms of Use.";
                header: {
                    title: "Login with Frak Wallet";
                };
                recover: "Recover wallet from file";
                redirect: "You will be redirected to {{ productName }} in a few seconds.";
                redirectNow: "Redirect now";
                subTitle: "to immediately receive your winnings from <pLink>{{productName}}</pLink>.";
                title: "Create your wallet";
            };
        };
        common: {
            amountRequired: "Amount is required";
            at: "at";
            authenticator: "Authenticator:";
            balance: "Balance";
            copied: "Copied!";
            copyAddress: "Copy address";
            enterAddress: "Enter address";
            interactions: "Interactions";
            logout: "Logout";
            notifications: "Notifications";
            receive: "Receive";
            rewards: "Rewards";
            send: "Send";
            to: "To";
            transactionHash: "Transaction Hash:";
            transactionLink: "Transaction Link";
            transactionSuccess: "Transaction Success!";
            wallet: "Wallet:";
            walletAddressRequired: "Wallet address is required";
            walletInvalid: "Invalid wallet address";
        };
        sdk: {
            modal: {
                default: {
                    dismissBtn: "Continue without Frak";
                };
                final: {
                    default: {
                        title: "Success";
                        title_reward: "Gains";
                        title_sharing: "Share";
                    };
                };
                login: {
                    default: {
                        description: "Connect to your Frak account to get the best experience on this platform.";
                        primaryAction: "I create my wallet under 30sec";
                        secondaryAction: "I already have a wallet";
                        title: "Connection";
                    };
                    success: "Connection successful";
                };
                openSession: {
                    default: {
                        description: "Start a rewarding session to earn as you interact anonymously on this site. Enjoy benefits without sharing personal details. \nLearn more in our privacy policy.";
                        primaryAction: "I activate my wallet";
                        title: "Activation";
                    };
                };
                sendTransaction: {
                    default: {
                        description: "To complete, authorize this transaction in your wallet. This ensures secure processing.";
                        primaryAction_one: "Send transaction";
                        primaryAction_other: "Send transactions";
                        title: "Transaction";
                    };
                };
                siweAuthenticate: {
                    default: {
                        description: "Please authenticate with your wallet to proceed securely. Your signature confirms your identity.";
                        primaryAction: "Authenticate";
                        title: "Authentication";
                    };
                };
                stepper: {
                    final: "Success";
                    final_reward: "Gains";
                    final_sharing: "Share";
                    login: "Connection";
                    openSession: "Activation";
                    sendTransaction: "Transaction";
                    siweAuthenticate: "Authentication";
                };
            };
        };
        sharing: {
            btn: {
                copy: "Copy link";
                copySuccess: "Link copied";
                share: "Share";
                shareSuccess: "Shared";
            };
            default: {
                text: "Discover this amazing product!";
                title: "{{productName}} invite link";
            };
        };
        wallet: {
            activateNotifications: "<strong>Enable notifications</strong> <br /> to be notified when your gains are paid";
            biometryInfos: "Biometry informations";
            installWebApp: "<strong>Install wallet on home screen</strong> <br /> to find your gains at any time";
            interaction: {
                CREATE_REFERRAL_LINK: "Created share link";
                OPEN_ARTICLE: "Opened article";
                PURCHASE_COMPLETED: "Completed purchase";
                PURCHASE_STARTED: "Started purchase";
                READ_ARTICLE: "Read article";
                REFERRED: "Referred";
                WEBSHOP_OPENNED: "Opened webshop";
            };
            session: {
                closed: "Your wallet is not activated. You can’t be rewarded.";
                open: "Your wallet is activated";
                openSession: "Activate your wallet";
                tooltip: {
                    active: "You got an active wallet since {{sessionStart}} and until {{sessionEnd}}";
                    inactive: "The wallet activation will permit us to send interaction data";
                };
            };
            tokens: {
                amountLessThanBalance: "Amount must be less than balance";
                amountPositive: "Amount must be positive";
                amountToSend: "Amount to send";
                backToWallet: "Back to wallet page";
                receive: {
                    title: "Receive assets on <strong>Testnets</strong>";
                };
            };
        };
    };
}

export default Resources;
