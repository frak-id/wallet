interface Resources {
    customized: {
        sdk: {
            modal: {
                dismiss: {
                    primaryAction: "Continue browsing";
                    primaryAction_sharing: "Share without being paid";
                };
                final: {
                    title: "Success";
                    title_reward: "Gains";
                    title_sharing: "Share";
                    description: "You've successfully completed all the steps.";
                    description_sharing: "Your wallet has been created to receive your **{{ productName }}** reward for sharing. To find your wallet, go to [wallet.frak.id](https://wallet.frak.id).";
                    description_reward: "Check your earnings at any time on [wallet.frak.id](https://wallet.frak.id). You too can share with your friends, all your shares that lead to clicks, registrations or purchases generate new earnings!";
                    dismissed: {
                        description: "All good";
                        description_sharing: "Share this article.";
                    };
                };
                login: {
                    description: "Login to your Frak account to get the best experience on **{{ productName }}**";
                    description_sharing: "{{ productName }} pays you directly on your **wallet** for the value you create if your shares lead to actions such as clicks, registrations or purchases.";
                    description_reward: "{{ productName }} pays you directly into your **wallets** for the value you create through actions on this site, such as clicks, registrations or purchases.";
                    primaryAction: "I create my wallet under 30sec";
                    secondaryAction: "Use a QR code to connect";
                    title: "Connection";
                    success: "Connection successful";
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
                login: {
                    text: "Create your wallet and receive up to **{{ estimatedReward }}** per referred friend";
                    text_referred: "Welcome! Receive up to **{{ estimatedReward }}** in case of purchase on the site.\n\nCreate your wallet in 1 click";
                    primaryAction: "I create my wallet";
                };
                loggedIn: {
                    onboarding: {
                        welcome: "🥳 Congratulations! Your wallet is created.";
                        activate: "💫 Enable it to be able to share.";
                        share: "🚀 Let's go! Share this product and receive your rewards directly.";
                        activate_referred: "💫 Enable it to receive your gains.";
                        share_referred: "🚀 Share your turn to win more!";
                    };
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
                    new: {
                        create: "Use biometrics to prove you're not a robot";
                        login: "Connect an existing wallet";
                        phone: "Use a QR code to connect";
                    };
                    existing: {
                        create: "Create a new wallet";
                        login: "Connect with your wallet";
                    };
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
                title_new: "Create your wallet";
                title_existing: "Connect to your wallet";
                previousWallet: "Your wallet: <strong>{{ wallet }}</strong>";
            };
        };
        common: {
            activated: "Activated";
            amountRequired: "Amount is required";
            added: "added";
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
            settings: {
                biometryInfo: "Biometry informations";
                ecdsaInfo: "Login informations";
                ecdsaWallet: "Ecdsa wallet";
                privateKey: "Private key";
                deletePrivateKey: "Delete private key";
            };
            installWebApp: "<strong>Install wallet on home screen</strong> <br /> to find your gains at any time";
            interaction: {
                CREATE_REFERRAL_LINK: "Created share link";
                OPEN_ARTICLE: "Opened article";
                PURCHASE_COMPLETED: "Completed purchase";
                PURCHASE_STARTED: "Started purchase";
                READ_ARTICLE: "Read article";
                REFERRED: "Referred";
                WEBSHOP_OPENNED: "Opened webshop";
                CUSTOMER_MEETING: "Appointment in store";
            };
            invite: {
                title: "Invite friends, earn $5";
                text: "Earn $5 for each friend you invite. T&C apply";
            };
            login: {
                accountCreation: "Account creation";
                button: "Recover your <strong>wallet</strong>";
                recover: "Recover wallet from file";
                walletsOnDevice: "Wallets used on this device";
                privy: "Connect via Privy";
                useQRCode: "Use QR code to connect";
            };
            notifications: {
                noNotifications: "No notifications";
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
                title: "Recover a wallet";
                step1: "Upload your recovery file";
                step2: "Review recovery data";
                step3: "Decryption with password";
                step4: "Create new passkey";
                step5: "Execute recovery";
                step6: "Success";
                uploadOrDrag: "Upload or drag recovery file";
                invalidFile: "Invalid file";
                continue: "Continue recovery";
                invalidPassword: "Invalid password";
                errorLoading: "Error loading recovery account";
                needCreatePasskey: "You need to create a new passkey on your device";
                createPasskey: "create passkey";
                loadingRecovery: "Loading recovery";
                pushPasskey: "Push new passkey";
                status: {
                    loading: "Loading ...";
                    walletAlready: "Wallet already recovered";
                    inProgress: "In progress";
                    done: "Done";
                    error: "Error";
                    pending: "Pending";
                };
                successful: "Recovery is successful, you can now <pLink>login</pLink>";
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
            "share-and-earn": "Share<br />& Earn";
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
                title: "Welcome in your wallet";
                text: "This wallet will enable you to collect all the rewards and much more.";
            };
            membrs: {
                introduction: {
                    title: "Exclusive access to your favorite stars and franchise";
                    button: "Enter";
                };
                profile: {
                    title: "Custom your profile";
                    text1: "Custom your profile to join creators’ community and be rewarded for your engagement";
                    text2: "Benefit from the advantages offered by designers and their partners";
                    edit: "Edit my profile";
                    form: {
                        name: "Enter username";
                        nameRequired: "Username is required";
                        nameLength: "Minimum username length is 3";
                        button: "Save";
                        later: "Later";
                        error: "An error occurred while saving your profile. Please try again.";
                    };
                    avatar: {
                        title: "Choose profile picture";
                        upload: "Upload or drag profile picture";
                        zoom: "Zoom";
                        save: "Save";
                        take: "Take photo with camera";
                        stop: "Stop camera";
                        capture: "Capture photo";
                    };
                };
                fanclub: {
                    title: "Fanclub";
                    text: "Discover the Fanclub of {{productName}}";
                    button: "Discover the Fanclub";
                };
            };
            pairing: {
                title: "Confirm device pairing";
                text: "You're about to connect this device to your account";
                info: {
                    title: "Pairing information";
                    status: "Status:";
                    device: "Device:";
                };
                code: "Check that the code is correct";
                error: {
                    title: "Invalid pairing request";
                    noCode: "No pairing code provided";
                };
                loading: {
                    title: "Please wait";
                };
                cancel: "Cancel";
                confirm: "Confirm";
                pairingInProgress: "Pairing in progress, please authenticate";
                origin: {
                    state: {
                        idle: "Pairing logic initialisation";
                        connecting: "Paired device not online";
                        paired: "Connected with partner";
                        retryError: "Error when connecting to the paired device";
                        requests: {
                            connecting: "Open your paired device to proceed to the transaction";
                            paired: "Wait for partner to process signature";
                        };
                    };
                };
                target: {
                    state: {
                        connecting: "Connecting to partner device";
                        paired: "Connected with other device";
                        retryError: "Error when connecting to partner device";
                    };
                };
                status: {
                    idle: "Idle";
                    connecting: "Connecting...";
                    paired: "Paired";
                };
                signatureRequest: {
                    title: "Signature request";
                    description: "A device <strongFrom>{{from}}</strongFrom> is requesting your signature";
                    stateTitle: "Signing state";
                    state: {
                        idle: "Idle";
                        pending: "Pending";
                        success: "Success";
                        error: "Error";
                        declined: "Declined";
                        unknown: "Unknown";
                    };
                    buttons: {
                        sign: "Sign";
                        reject: "Reject";
                    };
                };
                refresh: "Retry";
                refreshCode: "Code:";
                refreshReason: "Reason:";
                list: {
                    title: "Connected devices";
                    origin: "Origin :";
                    target: "Target :";
                    createdAt: "Created at :";
                    lastActive: "Last active :";
                    delete: "Delete device";
                };
            };
            inAppBrowser: {
                warning: "You're using an embedded browser. Your experience may be degraded. Tap to open in your browser.";
                clickToOpen: "Tap to open in your browser.";
                dismiss: "Dismiss inapp browser warning";
            };
            toastLoading: {
                stuck: "Stuck? See the <pLink>Troubleshooting</pLink> section for more information.<br /><br />You can try to <button>cleanup</button>.<br />(this will logout and you will need to redo a login / pairing)";
                dismiss: "Dismiss inapp browser warning";
            };
        };
        error: {
            webauthn: {
                notAllowed: "You have cancelled the authentication process, please try again.";
                userOperationExecution: "An error occurred while executing the transaction. Please try again.";
                generic: "An error occurred. Please try again.";
            };
        };
    };
}

export default Resources;
