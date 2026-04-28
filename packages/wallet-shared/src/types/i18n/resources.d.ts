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
                    description_sharing: "Your wallet has been created to receive your **{{productName}}** reward for sharing. To find your wallet, go to [wallet.frak.id](https://wallet.frak.id).";
                    dismissed: {
                        description: "All good";
                        description_sharing: "Share this article.";
                    };
                    title: "Success";
                    title_reward: "Gains";
                    title_sharing: "Share";
                };
                login: {
                    description: "Login to your Frak account to get the best experience on **{{productName}}**";
                    description_reward: "{{productName}} pays you directly into your **wallets** for the value you create through actions on this site, such as clicks, registrations or purchases.";
                    description_sharing: "{{productName}} pays you directly on your **wallet** for the value you create if your shares lead to actions such as clicks, registrations or purchases.";
                    primaryAction: "I create my wallet under 30sec";
                    secondaryAction: "Use a QR code to connect";
                    success: "Connection successful";
                    title: "Connection";
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
            sharingPage: {
                card: {
                    amount: "{{estimatedReward}}";
                    label: "Credited to your account";
                    tagline1: "Earn {{estimatedReward}},";
                    tagline2: "on every purchase!";
                };
                confirmation: {
                    benefits: {
                        cashout: {
                            description: "Transfer your earnings directly to your bank account in 3 clicks.";
                            title: "Cash out whenever you want";
                        };
                        notify: {
                            description: "Receive a notification when a purchase is made thanks to you.";
                            title: "Get notified as soon as you earn";
                        };
                        wallet: {
                            description: "No email, no password, no form. Simple, fast and secure.";
                            title: "Your wallet secured in 10 seconds";
                        };
                    };
                    cardPopupDescription: "A purchase was made through your link. {{estimatedReward}} has been transferred to your wallet.";
                    cardPopupTitle: "You just won {{estimatedReward}}! 🎉";
                    cta: "Collect my {{estimatedReward}}";
                    shareAgain: "Share again";
                    subtitle: "Install the Frak app, official partner of {{productName}}, and track your earnings in real time.";
                    title: "Thank you for sharing!\nDon't miss out on your {{estimatedReward}}.";
                };
                dismiss: "Later";
                faq: {
                    a1: "Anyone can become an ambassador by sharing products through their unique link.";
                    a2: "Your earnings depend on the brand's reward program and the number of purchases made through your link.";
                    a3: "Your earnings are credited as soon as a purchase is confirmed through your sharing link.";
                    a4: "Yes, everyone can create their own sharing link and become an ambassador too.";
                    a5: "Frak enables brands to reward their community for word-of-mouth, in a transparent and decentralized way.";
                    q1: 'Who can become an "ambassador"?';
                    q2: "How much can I earn?";
                    q3: "When do I get paid?";
                    q4: 'Can my friends also become "ambassadors"?';
                    q5: "Why do brands use Frak?";
                    title: "Frequently asked questions";
                };
                reward: {
                    tagline: "You earn a reward every time a friend makes a purchase through your link.";
                    title: "Share with your friends";
                };
                steps: {
                    "1": "Share in 1 click. A personal link is automatically generated with each share.";
                    "2": "Earn on every purchase. Every order placed through your link earns you cash.";
                    "3": "Collect your earnings in the app. Install FRAK to collect your earnings.";
                    title: "";
                };
            };
            wallet: {
                loggedIn: {
                    onboarding: {
                        share: "🚀 Let's go! Share this product and receive your rewards directly.";
                        share_referred: "🚀 Share your turn to win more!";
                        welcome: "🥳 Congratulations! Your wallet is created.";
                    };
                };
                login: {
                    primaryAction: "I create my wallet";
                    text: "Create your wallet and receive up to **{{estimatedReward}}** per referred friend";
                    text_referred: "Welcome! Receive up to **{{estimatedReward}}** in case of purchase on the site.\n\nCreate your wallet in 1 click";
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
                        login: "Use biometrics";
                    };
                    "new": {
                        create: "Use biometrics";
                        login: "Already have an existing wallet?";
                        phone: "Use a QR code to connect";
                    };
                };
                description: "Frak does not store any personal or biometric data. By continuing you accept our <conditionsLink>terms</conditionsLink> and our <privacyLink>privacy policy</privacyLink>.";
                header: {
                    title: "Login with Frak Wallet";
                };
                pairing: {
                    description: "Scan this QR code to sign in from your mobile.";
                    title: "Sign in with my mobile";
                };
                previousWallet: "Your wallet: <strong>{{wallet}}</strong>";
                recover: "Recover wallet from file";
                redirect: "You will be redirected to {{productName}} in a few seconds.";
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
            accountId: "Wallet";
            added: "added";
            amountRequired: "Amount is required";
            at: "at";
            authenticator: "Authenticator";
            back: "Back";
            "back-to-wallet": "Back to Wallet";
            balance: "Balance";
            claim: "Claim";
            claimed: "claimed";
            close: "Close";
            copied: "Copied!";
            copyAddress: "Copy address";
            enterAddress: "Enter address";
            interactions: "Interactions";
            logout: "Logout";
            notifications: "Notifications";
            pending: "pending";
            refresh: "Refresh";
            rewards: "Rewards";
            send: "Send";
            share: "Share";
            submit: "Submit";
            to: "To";
            today: "Today";
            transactionHash: "Transaction Hash:";
            transactionLink: "Transaction Link";
            transactionSuccess: "Transaction Success!";
            wallet: "Wallet:";
            walletAddress: "Wallet address:";
            walletAddressRequired: "Wallet address is required";
            walletInvalid: "Invalid wallet address";
            yesterday: "Yesterday";
        };
        error: {
            webauthn: {
                generic: "An error occurred. Please try again.";
                notAllowed: "You have cancelled the authentication process, please try again.";
                userOperationExecution: "An error occurred while executing the transaction. Please try again.";
            };
        };
        explorer: {
            card: {
                badge: "Up to {{amount}}";
                until: "Until {{date}}";
            };
            detail: {
                close: "Close";
                earningsAvailability: "Earnings availability";
                endDateBadge: "Ends {{date}} ({{days}}d)";
                endsIn: "Ends in {{count}} day";
                endsIn_other: "Ends in {{count}} days";
                immediate: "Immediate";
                instructions: "Instructions";
                legal: "<termsLink>{{merchantName}}'s terms and conditions</termsLink> and <termsLink>FRAK's terms and conditions</termsLink> apply.";
                pendingDays: "{{count}} day";
                pendingDays_other: "{{count}} days";
                readMore: "Read more";
                refereeReward: "Reward as referee";
                referrerReward: "Reward as referrer";
                rewardPerReferral: "{{amount}} per referral";
                share: "Share";
                shareAndEarn: "Share and earn";
                step1Description: "A personal link is automatically generated with each share.";
                step1Title: "Share a product with your friends";
                step2Description: "Every order made through your link on {{name}} earns you cash directly in your wallet.";
                step2Title: "Earn {{amount}} for every purchase you help generate";
                step3Description: "In one click, transfer your earnings to your bank account.";
                step3Title: "Collect your earnings in your wallet";
            };
            empty: {
                description: "New offers are coming soon. Check back later!";
                title: "No offers available";
            };
            pageTitle: "Explorer";
        };
        installCode: {
            codeCopied: "Code copied!";
            copyCode: "Copy the code";
            description: "Paste it when opening the app. It will let you claim your rewards once logged in.";
            download: "Download the app";
            error: "Failed to generate code. Please refresh.";
            infoDescription: 'When opening the app, tap <1>"I have a recovery code"</1>.';
            infoTitle: "Code valid for 3 days";
            loading: "Generating your code...";
            processing: "Setting up your wallet...";
            title: "Don't lose your {{estimatedReward}}!\nCopy this code";
        };
        "mobile-sso": {
            appNotFound: "Frak Wallet app not found";
            connecting: "Connecting...";
            continueInBrowser: "Continue in browser";
            openWallet: "Open in Frak Wallet";
            retry: "Connection timed out. Retry?";
            waiting: "Waiting for wallet app...";
        };
        "mobile-tx": {
            appNotFound: "Frak Wallet app not found";
            appNotFoundHint: "Please reinstall the app or try again";
            explanation: "Approve this transaction in your wallet app";
            openWallet: "Open wallet to approve";
            reopenWallet: "Re-open wallet";
            retry: "Retry";
            sendTransaction: "Send transaction";
            timeout: "Approval timed out. Try again?";
            waiting: "Waiting for approval...";
        };
        monerium: {
            account: "Monerium Account";
            badge: {
                approved: "Bank connected:";
                notLinked: "IBAN not linked to this wallet";
                pending: "Bank verification in progress...";
                rejected: "Verification failed";
            };
            bankFlow: {
                info: {
                    cta: "Accept and continue";
                    description: "To transfer your earnings to your bank account, you need to complete your secure payment account setup.";
                    feature1Description: "To secure your account and verify that you are the rightful owner of the earnings.";
                    feature1Title: "Verify your identity";
                    feature2Description: "To receive your earnings directly into your bank account.";
                    feature2Title: "Add your IBAN";
                    feature3Description: "Your transactions are protected and comply with current security standards.";
                    feature3Title: "Secure your transfers";
                    redirectNotice: "You will be redirected to our financial partner, Monerium, to:";
                    title: "Complete your account to claim your earnings.";
                };
                kyc: {
                    cta: "Verify my identity";
                    description: "To transfer your earnings, you need to verify your identity.";
                    featureDescription: "To secure your account and confirm that you are the rightful owner of the earnings, we use a financial partner, Monerium.";
                    featureTitle: "Verify your identity";
                    notice: "This step is quick and secure.";
                    title: "Complete your identity verification";
                };
                link: {
                    cta: "Link my account";
                    description: "Your wallet is not yet connected to your Monerium account, connect it to transfer your earnings.";
                    featureDescription: "To fully use your wallet, we need to link your account.";
                    featureTitle: "Link your Monerium account to your wallet";
                    title: "Link your wallet";
                };
                success: {
                    cta: "Transfer my earnings";
                    description: "Your account is ready. You can now transfer your earnings to your bank account with ease.";
                    title: "You can now transfer your earnings 🎉";
                };
                transfer: {
                    amount: {
                        continue: "Continue";
                        ibanEmpty: "No IBAN saved";
                        ibanLabel: "IBAN";
                        insufficientBalance: "Insufficient balance";
                        modify: "Edit";
                        title: "Amount to transfer";
                        totalBalance: "Total balance";
                        walletLabel: "Frak Wallet";
                    };
                    ibanManager: {
                        addNew: "Add an IBAN";
                        empty: "No IBAN saved. Add one to get started.";
                        ibanLabel: "IBAN";
                        ibanPlaceholder: "FR76...";
                        nameLabel: "Beneficiary name";
                        namePlaceholder: "e.g. My checking account";
                        remove: "Remove";
                        save: "Save";
                        select: "Select";
                        title: "Manage my IBANs";
                    };
                    recap: {
                        addNote: "Add a note";
                        amountLabel: "Amount";
                        beneficiaryLabel: "Beneficiary";
                        cancel: "Cancel";
                        confirm: "Confirm transfer";
                        defaultNote: "Sent from FRAK";
                        title: "Summary";
                        warning: "Once confirmed, this operation cannot be cancelled";
                    };
                    success: {
                        description: "You will receive your payout within 10 seconds.";
                        title: "Your transfer request of {{amount}} € has been received";
                    };
                };
            };
            callback: {
                cancelledDescription: "You can reconnect to Monerium whenever you're ready.";
                cancelledTitle: "Connection cancelled";
                errorDescription: "Something went wrong while connecting to Monerium. Please try again in a moment.";
                errorTitle: "Connection failed";
                tryAgain: "Try again";
            };
            completeSetup: "Complete setup";
            connect: "Connect";
            connecting: "Connecting...";
            disconnect: "Disconnect";
            linkWallet: "Link wallet";
            offramp: {
                amountInvalid: "Amount must be greater than 0";
                amountLabel: "Amount (EURe)";
                amountRequired: "Amount is required";
                balance: "Balance:";
                confirmBiometric: "Confirm with biometric...";
                destinationIban: "Destination IBAN";
                ibanWarning: "Warning: This IBAN is not linked to your current wallet address.";
                max: "MAX";
                noIban: "No IBAN linked. Please complete Monerium verification first.";
                submit: "Withdraw to bank";
                submitting: "Submitting order...";
                success: "Order submitted! Funds will arrive in 1-2 business days.";
                tryAgain: "Try again";
            };
            status: {
                approved: "Verified ✓";
                created: "Account created — complete verification on Monerium";
                pending: "Verification in progress";
                rejected: "Verification failed";
                settingUp: "Setting up...";
            };
        };
        onboarding: {
            activateSecureSpace: "Activate my secure space";
            alreadyHaveAccount: "Already have an account?";
            continue: "Continue";
            keypass: {
                description: "A secure key is saved in your password manager to quickly log in via biometrics.";
                existingAccount: {
                    button: "Log in";
                    description: "You already have an account. Log in with your passkey to access your wallet.";
                    title: "Welcome back!";
                };
                title: "Secure your account";
                unsupported: {
                    button: "Log in another way";
                    description: "Your browser does not support biometric authentication. Log in another way to access your wallet.";
                    title: "Browser not compatible";
                };
            };
            notification: {
                description: "Get notified as soon as money is credited to your wallet.";
                descriptionHighlight: "Track your rewards in real time.";
                enable: "Yes, notify me";
                skip: "Later";
                title: "Don't miss any reward!";
            };
            recoveryCode: "I have a recovery code";
            slides: {
                one: {
                    description: "Share your favorites and earn money for every purchase you help generate.";
                    title: "Earn money by recommending";
                };
                three: {
                    description: "No forms, no paperwork. Your wallet is ready to receive your earnings, instantly.";
                    title: "Activate your secure space in 10 sec";
                };
                two: {
                    description: "Track your earnings and transfer them to your bank account whenever you want.";
                    title: "Your earnings in real time";
                };
            };
            start: "Get started";
            welcome: {
                button: "Get started";
                description: "Let's go! Explore our partner brands, recommend your favorites and turn your influence into earnings.";
                descriptionHighlight: "Your earnings are secure and accessible at any time.";
                legal: "By continuing, you accept our <termsLink>Terms of Use</termsLink> and our <privacyLink>Privacy Policy</privacyLink>";
                title: "Welcome to your wallet";
            };
        };
        recoveryCode: {
            description: "Paste the code copied from wallet.frak.id to recover your earnings.";
            digitLabel: "Character";
            error: {
                alreadyLinked: "This code has already been used.";
                generic: "Something went wrong — please try again.";
                invalid: "Incorrect or expired code — check the code copied from wallet.frak.id";
            };
            paste: "Paste the code";
            success: {
                description: "You'll receive a notification as soon as a friend purchases via your link.";
                merchantInfo: "Connected to {{merchantName}}";
                title: "Your referral link has been found!";
            };
            title: "Recover your code";
            validate: "Validate the code";
        };
        reward: {
            detail: {
                creditedOn: "Credited on";
                description: "Reward detail";
                estimatedValidation: "Estimated validation";
                generatedDate: "Purchase generated on";
                generatedOn: "Generated on {{date}} · {{time}}";
                pendingDisclaimer: "This reward will be available once the purchase is confirmed by the brand.";
                pendingValidation: "Pending brand validation";
                purchaseDate: "Purchase date";
                purchaseMadeOn: "Purchase made on {{date}} at {{time}}";
                rewardGenerated: "Reward generated";
                title: "Reward detail";
                toCollect: "To collect";
                updatedAt: "Updated on {{date}} · {{time}}";
            };
            history: {
                discover: "Discover offers";
                emptyDescription: "Explore offers and recommend your favorite products to friends to earn money.";
                emptyTitle: "Ready to earn money?";
                seeAll: "See all";
                stats: {
                    totalEarnings: "Total earnings";
                    totalPurchases: "Purchases generated";
                    totalShares: "Total shares";
                };
                title: "Earnings history";
                viewAll: "View all";
            };
            status: {
                cancelled: "Cancelled";
                consumed: "Consumed";
                expired: "Expired";
                pending: "Awaiting validation by the brand";
                processing: "Processing";
                settled: "To collect";
            };
            trigger: {
                create_referral_link: "Shared Link";
                custom: "Custom";
                purchase: "Purchase";
                referral: "Referral";
                unknown: "Reward";
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
            activateNotificationsRationale: "<strong>Enable notifications</strong> <br /> We need your permission to notify you when gains are paid";
            inAppBrowser: {
                clickToOpen: "Tap to open in your browser.";
                clipboardAlert: "This browser doesn't support all features needed.\n\nThe link has been copied to your clipboard.\n\nTo continue:\n1. Open Safari\n2. Tap the address bar\n3. Paste and go";
                clipboardManualAlert: "This browser doesn't support all features needed.\n\nAutomatic copy failed.\n\nCopy this link manually:\n{{url}}\n\nThen:\n1. Open Safari\n2. Tap the address bar\n3. Paste and go";
                cta: "Open browser";
                description: "For a better experience, open this page in your default browser.";
                dismiss: "Dismiss inapp browser warning";
                title: "Open in your browser";
                warning: "You're using an embedded browser. Your experience may be degraded. Tap to open in your browser.";
            };
            installWebApp: "<strong>Install wallet on home screen</strong> <br /> to find your gains at any time";
            invite: {
                text: "Earn $5 for each friend you invite. T&C apply";
                title: "Invite friends, earn $5";
            };
            login: {
                accountCreation: "Account creation";
                anotherAccount: "Connect another account";
                button: "Use biometrics";
                privy: "Connect via Privy";
                recover: "Recover wallet from file";
                title: "Log in to your wallet";
                useMyAccount: "Use my account <strong>{{address}}</strong>";
                useQRCode: "Use QR code to connect";
                walletsOnDevice: "Wallets used on this device";
            };
            manageNotifications: "<strong>Manage notifications</strong> <br /> Open settings to control your notifications";
            notifications: {
                noNotifications: "No notifications";
            };
            openLogin: {
                login: "Connect with biometrics";
                webauthnNotSupported: "WebAuthn is not supported on this device";
            };
            openNotificationSettings: "<strong>Notifications disabled</strong> <br /> Open settings to enable notifications";
            pageTitle: "Wallet";
            pairing: {
                cancel: "Cancel";
                code: "Check that the code is correct";
                confirm: "Confirm";
                error: {
                    noCode: "No pairing code provided";
                    notFound: "Pairing request not found or expired";
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
                noCodeNotice: "Confirm this pairing request to continue.";
                origin: {
                    state: {
                        connecting: "Paired device not online";
                        error: "Connection rejected by the server";
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
                reconnect: "Reconnect";
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
                    connecting: "Pairing in progress";
                    idle: "Idle";
                    paired: "Paired";
                };
                target: {
                    state: {
                        connecting: "Connecting to partner device";
                        error: "Connection rejected by the server";
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
            pendingEmpty: {
                confirm: "Got it";
                description: "As soon as a purchase is made through your sharing link, your earnings will appear here.";
                title: "You don't have any earnings yet";
            };
            pendingGains: {
                confirm: "Collect my earnings";
                description: "A purchase through your link earned you rewards. Collect them now into your wallet.";
                heading: "Great news!\nMoney is waiting for you.";
                subtitle: "Pending earnings";
                success: "Earnings collected!";
            };
            pendingReferral: {
                success: "You have claimed your reward successfully!";
                text: "You got {{eurClaimable}} EUR pending thanks to your referral activities!";
                title: "Pending referral reward";
            };
            profile: {
                biometricPrompt: "Require {{biometryLabel}} at every app launch";
                helpSupport: "Help & support";
                lastConnection: "Last connection";
                manageAction: "Manage";
                notificationSettings: "Notification settings";
                pageTitle: "Profil";
                privacyPolicy: "Privacy Policy";
                rateApp: "Rate the app";
                recoveryConfigured: "Configured";
                unsubscribeNotifications: "Unsubscribe";
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
            settings: {
                biometryInfo: "Biometry informations";
                deleteAccount: "Delete my account";
                deletePrivateKey: "Delete private key";
                ecdsaInfo: "Login informations";
                ecdsaWallet: "Ecdsa wallet";
                legal: "Legal";
                privateKey: "Private key";
                termsOfUse: "Terms and conditions";
            };
            "share-and-earn": "Share<br />& Earn";
            stats: {
                lifetime: "Lifetime";
                pending: "Pending";
            };
            toastLoading: {
                dismiss: "Dismiss inapp browser warning";
                stuck: "Stuck? See the <pLink>Troubleshooting</pLink> section for more information.<br /><br />You can try to <button>cleanup</button>.<br />(this will logout and you will need to redo a login / pairing)";
            };
            tokens: {
                amountLessThanBalance: "Amount must be less than balance";
                amountPositive: "Amount must be positive";
                amountToSend: "Amount to send";
                sendTitle: "Transfer to a crypto wallet";
            };
            transferEmpty: {
                description: "Share products with your friends to start earning money.";
                discover: "Discover offers";
                title: "You don't have any money to transfer yet";
            };
            transferModal: {
                bankAccount: "Bank account";
                bankAccountDescription: "Add an IBAN";
                description: "Choose one of the following options to transfer your earnings.";
                title: "Transfer";
                wallet: "Wallet";
                walletDescription: "Transfer to a crypto wallet";
            };
            transferToBank: "Transfer to my bank";
            transferredEmpty: {
                confirm: "Got it";
                description: "The total of your earnings will appear here once you make a transfer to your bank account.";
                title: "You haven't transferred any earnings yet";
            };
            welcome: {
                check1: "Explore partner brands";
                check2: "Recommend your favorite products";
                check3: "Earn money with every referral";
                detail: {
                    discoverOffers: "Discover offers";
                    howItWorks: "How does it work?";
                    legal: "FRAK's <termsLink>terms and conditions</termsLink> apply.";
                    step1Description: "A personal link is automatically generated with each share.";
                    step1Title: "Explore our partner brands";
                    step2Description: "A personal link is automatically generated with each share.";
                    step2Title: "Share an article with your friends";
                    step3Description: "In one click, transfer your earnings to your bank account.";
                    step3Title: "Earn money";
                };
                notifications: {
                    description: "Enable notifications to track your earnings in real time.";
                    title: "Don't miss any earnings!";
                };
                text: "This wallet will enable you to collect all the rewards and much more.";
                title: "Welcome in your wallet";
            };
        };
    };
}

export default Resources;
