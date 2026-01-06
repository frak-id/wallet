interface Resources {
    customized: {
        sdk: {
            modal: {
                dismiss: {
                    primaryAction: "Continue browsing";
                    primaryAction_sharing: "Share without being paid";
                };
                final: {
                    description: "You've successfully completed all the steps.";
                    description_reward: "Check your earnings at any time on [wallet.frak.id](https://wallet.frak.id). You too can share with your friends, all your shares that lead to clicks, registrations or purchases generate new earnings!";
                    description_sharing: "Your wallet has been created to receive your **{{ productName }}** reward for sharing. To find your wallet, go to [wallet.frak.id](https://wallet.frak.id).";
                    dismissed: {
                        description: "All good";
                        description_sharing: "Share this article.";
                    };
                    title: "Success";
                    title_reward: "Gains";
                    title_sharing: "Share";
                };
                login: {
                    description: "Login to your Frak account to get the best experience on **{{ productName }}**";
                    description_reward: "{{ productName }} pays you directly into your **wallets** for the value you create through actions on this site, such as clicks, registrations or purchases.";
                    description_sharing: "{{ productName }} pays you directly on your **wallet** for the value you create if your shares lead to actions such as clicks, registrations or purchases.";
                    primaryAction: "I create my wallet under 30sec";
                    secondaryAction: "Use a QR code to connect";
                    success: "Connection successful";
                    title: "Connection";
                };
                openSession: {
                    description: "Congratulations, your wallet has been created! Click on the button below to activate it and receive your winnings.";
                    primaryAction: "Activate my wallet";
                    title: "Activation";
                };
                sendTransaction: {
                    description: "To complete, authorize this transaction in your wallet. This ensures secure processing.";
                    primaryAction_one: "Send transaction";
                    primaryAction_other: "Send transactions";
                    title: "Transaction";
                };
                siweAuthenticate: {
                    description: "Please authenticate with your wallet to proceed securely. Your signature confirms your identity.";
                    primaryAction: "Authenticate";
                    title: "Authentication";
                };
            };
            wallet: {
                loggedIn: {
                    onboarding: {
                        activate: "💫 Enable it to be able to share.";
                        activate_referred: "💫 Enable it to receive your gains.";
                        share: "🚀 Let's go! Share this product and receive your rewards directly.";
                        share_referred: "🚀 Share your turn to win more!";
                        welcome: "🥳 Congratulations! Your wallet is created.";
                    };
                };
                login: {
                    primaryAction: "I create my wallet";
                    text: "Create your wallet and receive up to **{{ estimatedReward }}** per referred friend";
                    text_referred: "Welcome! Receive up to **{{ estimatedReward }}** in case of purchase on the site.\n\nCreate your wallet in 1 click";
                };
            };
        };
    };
    translation: {
        authent: {
            create: {
                alreadyRegistered: "You already have a registered wallet. Click the login button below to log in.";
                error: "Error during registration, please try again";
                inProgress: "Wallet creation in progress";
            };
            sso: {
                btn: {
                    existing: {
                        create: "Create a new wallet";
                        login: "Connect with your wallet";
                    };
                    new: {
                        create: "Use biometrics to prove you're not a robot";
                        login: "Connect an existing wallet";
                        phone: "Use a QR code to connect";
                    };
                };
                description: "Before continuing, please make sure you are using a device that belongs to you.<br />Frak is a solution allowing <strong>{{productName}}</strong> to reward its community for the help provided in promoting its offers. <strong>Frak is a decentralized and open-source solution, which does not store any personal or biometric data.</strong><br />To learn more about <strong>{{productName}}</strong>, please review our Privacy Policy and Terms of Use.";
                header: {
                    title: "Login with Frak Wallet";
                };
                previousWallet: "Your wallet: <strong>{{ wallet }}</strong>";
                recover: "Recover wallet from file";
                redirect: "You will be redirected to {{ productName }} in a few seconds.";
                redirectNow: "Redirect now";
                subTitle: "to immediately receive your winnings from <pLink>{{productName}}</pLink>.";
                title: "Create your wallet";
                title_existing: "Connect to your wallet";
                title_new: "Create your wallet";
            };
        };
        biometrics: {
            confirmAction: "Confirm with {{type}}";
            error: "Authentication failed. Please try again.";
            locked: "Wallet Locked";
            settings: {
                description: "Require biometric authentication to access your wallet";
                enable: "Enable biometric lock";
                notAvailable: "Biometrics not available on this device";
                timeout: "Lock after";
                timeout15min: "15 minutes";
                timeout1min: "1 minute";
                timeout5min: "5 minutes";
                timeoutImmediate: "Immediately";
                title: "Biometric Lock";
            };
            unlock: "Unlock";
            unlockReason: "Authenticate to access your wallet";
            unlockWith: "Use {{type}} to unlock";
        };
        common: {
            activated: "Activated";
            added: "added";
            amountRequired: "Amount is required";
            at: "at";
            authenticator: "Authenticator:";
            balance: "Balance";
            claim: "Claim";
            claimed: "claimed";
            copied: "Copied!";
            copyAddress: "Copy address";
            disabled: "Disabled";
            enterAddress: "Enter address";
            interactions: "Interactions";
            logout: "Logout";
            notifications: "Notifications";
            pending: "pending";
            receive: "Receive";
            refresh: "Refresh";
            rewards: "Rewards";
            send: "Send";
            submit: "Submit";
            to: "To";
            transactionHash: "Transaction Hash:";
            transactionLink: "Transaction Link";
            transactionSuccess: "Transaction Success!";
            wallet: "Wallet:";
            walletAddress: "Wallet address:";
            walletAddressRequired: "Wallet address is required";
            walletInvalid: "Invalid wallet address";
        };
        error: {
            webauthn: {
                generic: "An error occurred. Please try again.";
                notAllowed: "You have cancelled the authentication process, please try again.";
                userOperationExecution: "An error occurred while executing the transaction. Please try again.";
            };
        };
        sharing: {
            btn: {
                copy: "Copy link";
                copySuccess: "Link copied!";
                share: "Share";
                shareSuccess: "Link shared!";
            };
            text: "Discover this amazing product!";
            title: "{{productName}} invite link";
        };
        wallet: {
            activateNotifications: "<strong>Enable notifications</strong> <br /> to be notified when your gains are paid";
            inAppBrowser: {
                clickToOpen: "Tap to open in your browser.";
                dismiss: "Dismiss inapp browser warning";
                warning: "You're using an embedded browser. Your experience may be degraded. Tap to open in your browser.";
            };
            installWebApp: "<strong>Install wallet on home screen</strong> <br /> to find your gains at any time";
            interaction: {
                CREATE_REFERRAL_LINK: "Created share link";
                CUSTOMER_MEETING: "Appointment in store";
                OPEN_ARTICLE: "Opened article";
                PURCHASE_COMPLETED: "Completed purchase";
                PURCHASE_STARTED: "Started purchase";
                READ_ARTICLE: "Read article";
                REFERRED: "Referred";
                WEBSHOP_OPENNED: "Opened webshop";
            };
            invite: {
                text: "Earn $5 for each friend you invite. T&C apply";
                title: "Invite friends, earn $5";
            };
            login: {
                accountCreation: "Account creation";
                button: "Recover your <strong>wallet</strong>";
                privy: "Connect via Privy";
                recover: "Recover wallet from file";
                useQRCode: "Use QR code to connect";
                walletsOnDevice: "Wallets used on this device";
            };
            membrs: {
                fanclub: {
                    button: "Discover the Fanclub";
                    text: "Discover the Fanclub of {{productName}}";
                    title: "Fanclub";
                };
                introduction: {
                    button: "Enter";
                    title: "Exclusive access to your favorite stars and franchise";
                };
                profile: {
                    avatar: {
                        capture: "Capture photo";
                        save: "Save";
                        stop: "Stop camera";
                        take: "Take photo with camera";
                        title: "Choose profile picture";
                        upload: "Upload or drag profile picture";
                        zoom: "Zoom";
                    };
                    edit: "Edit my profile";
                    form: {
                        button: "Save";
                        error: "An error occurred while saving your profile. Please try again.";
                        later: "Later";
                        name: "Enter username";
                        nameLength: "Minimum username length is 3";
                        nameRequired: "Username is required";
                    };
                    text1: "Custom your profile to join creators’ community and be rewarded for your engagement";
                    text2: "Benefit from the advantages offered by designers and their partners";
                    title: "Custom your profile";
                };
            };
            notifications: {
                noNotifications: "No notifications";
            };
            pairing: {
                cancel: "Cancel";
                code: "Check that the code is correct";
                confirm: "Confirm";
                error: {
                    noCode: "No pairing code provided";
                    title: "Invalid pairing request";
                };
                info: {
                    device: "Device:";
                    status: "Status:";
                    title: "Pairing information";
                };
                list: {
                    createdAt: "Created at :";
                    delete: "Delete device";
                    lastActive: "Last active :";
                    origin: "Origin :";
                    target: "Target :";
                    title: "Connected devices";
                };
                loading: {
                    title: "Please wait";
                };
                origin: {
                    state: {
                        connecting: "Paired device not online";
                        idle: "Pairing logic initialisation";
                        paired: "Connected with partner";
                        requests: {
                            connecting: "Open your paired device to proceed to the transaction";
                            paired: "Wait for partner to process signature";
                        };
                        retryError: "Error when connecting to the paired device";
                    };
                };
                pairingInProgress: "Pairing in progress, please authenticate";
                refresh: "Retry";
                refreshCode: "Code:";
                refreshReason: "Reason:";
                signatureRequest: {
                    buttons: {
                        reject: "Reject";
                        sign: "Sign";
                    };
                    description: "A device <strongFrom>{{from}}</strongFrom> is requesting your signature";
                    state: {
                        declined: "Declined";
                        error: "Error";
                        idle: "Idle";
                        pending: "Pending";
                        success: "Success";
                        unknown: "Unknown";
                    };
                    stateTitle: "Signing state";
                    title: "Signature request";
                };
                status: {
                    connecting: "Connecting...";
                    idle: "Idle";
                    paired: "Paired";
                };
                target: {
                    state: {
                        connecting: "Connecting to partner device";
                        paired: "Connected with other device";
                        retryError: "Error when connecting to partner device";
                    };
                };
                text: "You're about to connect this device to your account";
                title: "Confirm device pairing";
            };
            password: {
                enter: "Enter password";
                minimum: "Minimum password length is 5";
                pleaseEnter: "Please enter a password";
                required: "Password is required";
            };
            pendingReferral: {
                success: "You have claimed your reward successfully!";
                text: "You got {{eurClaimable}} EUR pending thanks to your referral activities!";
                title: "Pending referral reward";
            };
            recovery: {
                continue: "Continue recovery";
                createPasskey: "create passkey";
                errorLoading: "Error loading recovery account";
                invalidFile: "Invalid file";
                invalidPassword: "Invalid password";
                loadingRecovery: "Loading recovery";
                needCreatePasskey: "You need to create a new passkey on your device";
                pushPasskey: "Push new passkey";
                status: {
                    done: "Done";
                    error: "Error";
                    inProgress: "In progress";
                    loading: "Loading ...";
                    pending: "Pending";
                    walletAlready: "Wallet already recovered";
                };
                step1: "Upload your recovery file";
                step2: "Review recovery data";
                step3: "Decryption with password";
                step4: "Create new passkey";
                step5: "Execute recovery";
                step6: "Success";
                successful: "Recovery is successful, you can now <pLink>login</pLink>";
                title: "Recover a wallet";
                uploadOrDrag: "Upload or drag recovery file";
            };
            recoverySetup: {
                currentGuardian: "Current guardian:";
                disclaimer: "Warning<br />- We do not store any information related to your wallet recovery.<br />- You are solely responsible for keeping your recovery file and password secure and private.\n                <br />- The recovery file can be generated now, but the actual recovery process will only be available one week after the file is created to prevent malicious usage.";
                download: "Download my recovery file";
                generating: "Generating recovery data";
                setupNew: "Setup new recovery";
                setupOn: "Setup recovery on {{name}}";
                step1: "Encryption password";
                step2: "Generate recovery data";
                step3: "Download recovery file";
                step4: "Enable recovery on-chain";
                title: "Recovery setup";
            };
            register: {
                button: {
                    alreadyRegistered: "You already have a wallet on your device<br />Redirecting to the login page";
                    create: "Create your <strong>wallet</strong> <sup>*</sup> in a second with biometry";
                    error: "Error during registration, please try again";
                    inProgress: "Wallet creation in progress<br />Waiting for your biometry validation";
                };
                notice: "<sup>*</sup>encrypted digital account where you can find all the content you own, your consumption data and the rewards you earn";
                useExisting: "Use an existing wallet";
                useQRCode: "Use QR code to connect";
            };
            registerDemo: {
                button: {
                    create: "Create your demo <strong>wallet</strong>";
                    error: "Error during registration, please try again";
                    inProgress: "Wallet creation in progress";
                };
            };
            session: {
                closed: "Your wallet is not activated. You can’t be rewarded.";
                open: "Your wallet is activated";
                openSession: "Activate your wallet";
                titleActivated: "Wallet is activated";
                titleNotActivated: "Wallet not activated";
                tooltip: {
                    active: "You got an active wallet since {{sessionStart}} and until {{sessionEnd}}";
                    inactive: "The wallet activation will permit us to send interaction data";
                };
            };
            settings: {
                biometryInfo: "Biometry informations";
                deletePrivateKey: "Delete private key";
                ecdsaInfo: "Login informations";
                ecdsaWallet: "Ecdsa wallet";
                privateKey: "Private key";
            };
            "share-and-earn": "Share<br />& Earn";
            toastLoading: {
                dismiss: "Dismiss inapp browser warning";
                stuck: "Stuck? See the <pLink>Troubleshooting</pLink> section for more information.<br /><br />You can try to <button>cleanup</button>.<br />(this will logout and you will need to redo a login / pairing)";
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
            welcome: {
                text: "This wallet will enable you to collect all the rewards and much more.";
                title: "Welcome in your wallet";
            };
        };
    };
}

export default Resources;
