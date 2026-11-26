export default interface Resources {
  "translation": {
    "auth": {
      "invite": {
        "alreadyAuthenticated": "You are logged in with another account. Log out to accept the invitation for {{email}}.",
        "alreadyClaimed": "This invitation was already used. Log in with {{email}} instead.",
        "askToResend": "Ask the person who invited you to send a new invitation.",
        "genericError": "We could not accept the invitation. Check your password and try again. If it keeps failing, ask for a new invitation.",
        "goToLogin": "Go to log in",
        "invalidToken": "This invitation link is invalid or has expired.",
        "openDashboard": "Go to the dashboard",
        "signOutFirst": "Log out to accept this invitation",
        "submit": "Accept invitation",
        "subtitle": "Invited by {{inviterName}}. Choose a password to join the team.",
        "title": "You've been invited to be an admin of <strong>{{merchantName}}</strong> on Frak"
      },
      "login": {
        "back": "Back",
        "connect": "Continue with Frak",
        "connectHint": "New here? We create your account. Already have one? You get your account back.",
        "dashboardImageAlt": "Preview of the Frak dashboard",
        "email": {
          "backToLogin": "Back to log in",
          "emailPlaceholder": "Email address",
          "existingAccountHint": "If this email already has an account, log in with its password or reset it.",
          "forgotPassword": "Forgot your password?",
          "loginError": "We could not log you in. Check your email and password, or reset your password.",
          "newPasswordPlaceholder": "New password",
          "noAccount": "No account yet?",
          "passwordHint": "At least 10 characters.",
          "passwordPlaceholder": "Password",
          "registerCta": "Create account",
          "registerError": "We could not create your account. Check your email and password, then try again.",
          "registerSubmit": "Create account",
          "resetCodePlaceholder": "Reset code",
          "resetInstructions": "Enter the email of your account. We send you a code to reset your password.",
          "resetRequestError": "We could not send the code. Check your email address and try again.",
          "resetSent": "If an account exists for this email, we sent you a code. It is valid for 10 minutes. Check your spam folder if you do not see it. Enter it below with your new password.",
          "resetSubmit": "Reset password",
          "resetSuccess": "Your password has been reset. You can now log in.",
          "sendResetCode": "Send reset code",
          "submit": "Log in"
        },
        "footerCopyright": "© {{year}} FrakLabs. All rights reserved.",
        "footerPrivacy": "Privacy policy",
        "footerTerms": "Terms and conditions",
        "frakLabsLogoAlt": "Frak Labs",
        "heroSubtitle": "Manage your campaigns and rewards in one place.",
        "heroTitleLine1": "Welcome to the",
        "heroTitleLine2": "Frak dashboard",
        "methods": {
          "email": "Continue with email",
          "shopify": "Continue with Shopify",
          "wallet": "Frak account"
        },
        "or": "or",
        "sessionError": "We could not finish logging you in. Try again. If it keeps failing, use another method or email hello@frak-labs.com.",
        "shopify": {
          "invalidDomain": "Enter your store address, like my-store.myshopify.com.",
          "label": "Shopify store address",
          "redirecting": "Taking you to Shopify…",
          "submit": "Continue with Shopify"
        },
        "ssoError": "We could not log you in with Shopify. Try again. If it keeps failing, use another method or email hello@frak-labs.com.",
        "walletError": "We could not log you in with your Frak account. Try again. If it keeps failing, use another method or email hello@frak-labs.com."
      },
      "twoFactor": {
        "codePlaceholder": "6-digit code",
        "email": {
          "resend": "Resend code",
          "resent": "Code sent",
          "sendCode": "Send code by email",
          "sentHint": "Enter the code we sent to your email."
        },
        "genericError": "The verification failed. Try again.",
        "method": {
          "email": "Email code",
          "siwe": "Frak wallet",
          "totp": "Authenticator app"
        },
        "noMethods": {
          "cta": "Go to settings",
          "description": "This action needs an extra check, and your account has none yet. In Settings, set up 2-step verification with an authenticator app, then come back.",
          "title": "Add a way to confirm it's you"
        },
        "pendingHint": "Checking your login…",
        "siwe": {
          "cta": "Confirm with my Frak wallet",
          "hint": "Your Frak wallet opens. Approve to confirm it's you. Nothing is charged."
        },
        "subtitle": "Confirm it's you to continue.",
        "title": "2-step verification",
        "totp": {
          "hint": "Enter the 6-digit code from your authenticator app (Google Authenticator, Authy).",
          "recoveryHint": "Enter one of your backup codes.",
          "recoveryNotice": "Each backup code works once. This is not the 6-digit code from your authenticator app.",
          "recoveryPlaceholder": "Backup code",
          "useCode": "Use your authenticator app",
          "useRecovery": "Use a backup code"
        },
        "verify": "Verify"
      },
      "verifyEmail": {
        "continue": "Continue",
        "hint": "We use a code sent by email to confirm your address.",
        "resend": "Send a new code",
        "resent": "Code sent",
        "sendCode": "Send code",
        "sendError": "We could not send the code. Wait a moment, then try again.",
        "success": "Your email is verified.",
        "title": "Verify your email",
        "verifyError": "That code did not work. Check it, or ask for a new one."
      }
    },
    "bank": {
      "banner": {
        "ctaAddFunds": "Add funds",
        "ctaManageBank": "Manage budget",
        "ctaSetup": "Set up budget",
        "depleted": "Your reward budget is empty. Rewards can't be paid.",
        "notDeployed": "Your reward budget isn't set up yet. Set it up to add funds and pay rewards.",
        "paused": "Rewards are paused, so no reward is paid. Open your budget to turn them back on.",
        "warning": "Your reward budget is running low, or your spending limit is lower than your budget. Open your budget to fix it."
      }
    },
    "campaigns": {
      "actions": {
        "archive": "Archive",
        "archiveTitle": "Archive campaign",
        "cancel": "Cancel",
        "confirmArchive": "Archive <strong>{{name}}</strong>? It stops running and you can't resume or edit it later.",
        "confirmDelete": "Delete <strong>{{name}}</strong>? This can't be undone.",
        "confirmPause": "Pause <strong>{{name}}</strong>? It stops earning rewards until you resume it.",
        "confirmResume": "Resume <strong>{{name}}</strong>? It earns rewards again.",
        "delete": "Delete",
        "deleteTitle": "Delete campaign",
        "error": "The action failed. Try again. If it keeps failing, email hello@frak-labs.com.",
        "errorArchive": "The campaign was not archived. Try again. If it keeps failing, email hello@frak-labs.com.",
        "errorDelete": "The campaign was not deleted. Try again. If it keeps failing, email hello@frak-labs.com.",
        "errorPause": "The campaign was not paused. Try again. If it keeps failing, email hello@frak-labs.com.",
        "errorResume": "The campaign was not resumed. Try again. If it keeps failing, email hello@frak-labs.com.",
        "newCampaign": "Create campaign",
        "pause": "Pause",
        "pauseTitle": "Pause campaign",
        "resume": "Resume",
        "resumeTitle": "Resume campaign"
      },
      "affiliateReport": {
        "actionsOverTime": "Actions per day",
        "brand": {
          "title": "TakeAds store #{{id}}"
        },
        "clicksOverTime": "Clicks per day",
        "kpi": {
          "actions": "Actions",
          "clicks": "Clicks",
          "conversion": "Click to action rate",
          "sales": "Orders"
        },
        "noData": "No data for this period. Choose a longer period.",
        "revenue": {
          "commission": "Commission",
          "currency": "Currency",
          "orders": "Order amount",
          "title": "Sales by currency"
        },
        "status": {
          "canceled": "Canceled",
          "confirmed": "Confirmed",
          "pending": "Pending",
          "settled": "Paid"
        },
        "statusBreakdown": "Actions by status",
        "truncated": "Some data is missing because the period is too long. Choose a shorter period."
      },
      "bulk": {
        "archive": "Archive",
        "archiveTitle": "Archive campaigns",
        "clear": "Deselect all",
        "confirmArchive_one": "Archive <strong>{{count}}</strong> campaign? You can't resume or edit it later.",
        "confirmArchive_other": "Archive <strong>{{count}}</strong> campaigns? You can't resume or edit them later.",
        "confirmDelete_one": "Delete <strong>{{count}}</strong> campaign? This can't be undone.",
        "confirmDelete_other": "Delete <strong>{{count}}</strong> campaigns? This can't be undone.",
        "confirmPause_one": "Pause <strong>{{count}}</strong> campaign? It stops earning rewards until you resume it.",
        "confirmPause_other": "Pause <strong>{{count}}</strong> campaigns? They stop earning rewards until you resume them.",
        "delete": "Delete",
        "deleteTitle": "Delete campaigns",
        "pause": "Pause",
        "pauseTitle": "Pause campaigns",
        "selected_one": "{{count}} selected",
        "selected_other": "{{count}} selected",
        "skipped_one": "{{count}} selected campaign can't take this action and is skipped.",
        "skipped_other": "{{count}} selected campaigns can't take this action and are skipped."
      },
      "create": {
        "actions": {
          "back": "Back",
          "continue": "Continue",
          "draftSaved": "Draft saved.",
          "publish": "Publish",
          "saveDraft": "Save as draft",
          "saveError": "We could not save. Try again. If it keeps failing, email hello@frak-labs.com."
        },
        "basics": {
          "currency": {
            "chooseAnother": "Choose another currency",
            "chooseAnotherDescription": "Use a different currency for this campaign only",
            "defaults": {
              "eure": "Euro (EUR)",
              "fallback": "Your store’s default currency",
              "usdc": "US dollar (USDC)"
            },
            "description": "Ambassadors are paid in this currency.",
            "label": "Reward currency",
            "recommended": "Recommended",
            "useDefault": "Use your store’s default currency"
          },
          "merchant": {
            "label": "Store",
            "placeholder": "Select a store"
          },
          "title": {
            "hint": "Only you can see this name.",
            "label": "Campaign title",
            "placeholder": "E.g. Summer sales 2026",
            "required": "Enter a campaign title"
          }
        },
        "budget": {
          "cap": {
            "commission": "Frak commission",
            "hint": "Maximum you can spend on the whole campaign, Frak commission included. The campaign stops when you reach it.",
            "hintDaily": "Maximum you can spend per day, Frak commission included.",
            "hintMonthly": "Maximum you can spend per month (30 days), Frak commission included.",
            "hintWeekly": "Maximum you can spend per week, Frak commission included.",
            "label": "Budget amount",
            "placeholder": "E.g. 1000",
            "required": "Enter a budget above 0",
            "rewards": "Rewards paid"
          },
          "period": {
            "daily": "Per day",
            "global": "Whole campaign",
            "label": "Budget period",
            "monthly": "Per month",
            "weekly": "Per week"
          },
          "schedule": {
            "datePlaceholder": "dd/mm/yyyy",
            "description": "If you do not set an end date, the campaign stops when the budget is used up.",
            "endDate": "End date",
            "endDateInvalid": "The end date cannot be before the start date",
            "endDateRequired": "Select an end date",
            "immediate": {
              "description": "Starts as soon as you publish",
              "title": "Start immediately"
            },
            "invalidDate": "Enter a valid date",
            "label": "Schedule",
            "openCalendar": "Open calendar",
            "range": {
              "description": "The campaign runs between two dates",
              "title": "Start and end dates"
            },
            "required": "Choose when the campaign starts",
            "startDate": "Start date",
            "startDateRequired": "Select a start date",
            "startOnly": {
              "description": "Choose a start date",
              "title": "Start date only"
            }
          }
        },
        "cancel": {
          "close": "Close",
          "confirm": "Close without saving",
          "description": "Changes on this step will be lost. Steps you already completed stay in your draft.",
          "dismiss": "Stay",
          "title": "Close without saving this step?"
        },
        "goals": {
          "info": "Choose one goal. It decides which action earns a reward.",
          "options": {
            "registration": {
              "description": "Reward ambassadors for sign-ups on your store.",
              "tags": "Account creation",
              "title": "Registration"
            },
            "sales": {
              "description": "Reward ambassadors when a customer places an order.",
              "tags": "Online sales",
              "title": "Sales"
            },
            "traffic": {
              "description": "Reward ambassadors when someone arrives on your store through their link.",
              "tags": "Store visits",
              "title": "Traffic"
            }
          },
          "required": "Select a goal"
        },
        "products": {
          "addValue": "Add a value",
          "advanced": "This product selection was set up outside this form. You can see it here, but you cannot change it.",
          "field": {
            "name": "Product name",
            "productId": "Product ID",
            "quantity": "Quantity",
            "sku": "SKU",
            "totalPrice": "Total for this product",
            "unitPrice": "Unit price"
          },
          "fieldLabel": "Field",
          "mode": {
            "all": {
              "description": "Every order earns a reward.",
              "title": "All products"
            },
            "specific": {
              "description": "Only orders containing a matching product earn a reward.",
              "title": "Selected products"
            }
          },
          "operator": {
            "between": "is between",
            "contains": "contains",
            "eq": "equals",
            "gt": "is greater than",
            "gte": "is at least",
            "in": "is one of",
            "lt": "is less than",
            "lte": "is at most",
            "neq": "does not equal",
            "not_in": "is not one of",
            "starts_with": "starts with"
          },
          "operatorLabel": "Condition",
          "placeholder": {
            "name": "E.g. Eco Sneaker",
            "productId": "E.g. prod-123",
            "quantity": "E.g. 2",
            "sku": "E.g. WIDGET-BLUE-S",
            "totalPrice": "E.g. 99.80",
            "unitPrice": "E.g. 49.90"
          },
          "predicate": {
            "description": "Checked for each product in the order.",
            "label": "Which products?"
          },
          "purchaseOnly": "Choosing products is only available for the Sales goal.",
          "removeValue": "Remove this value",
          "saveError": "We could not save the products. Try again. If you exclude products, the reward must be a percentage or ranges. Check it in the Rewards step.",
          "scope": {
            "description": "An order earns a reward only if it contains a matching product.",
            "label": "Products covered"
          },
          "valueAt": "Value {{index}}",
          "valueToLabel": "Upper value",
          "valueToPlaceholder": "E.g. 150",
          "values": {
            "label": "Value"
          }
        },
        "referralChain": {
          "cac": {
            "label": "Cost per order (set in the Rewards step)",
            "placeholder": "Not available",
            "placeholderTiered": "Varies by range"
          },
          "decrease": {
            "hint": "Each level earns this percentage less than the level before. Enter a value from {{min}} to {{max}}.",
            "label": "Decrease per level (%)",
            "outOfRange": "Enter a percentage from {{min}} to {{max}}.",
            "placeholder": "E.g. 80"
          },
          "enable": {
            "description": "The ambassador reward is also shared with the ambassadors who referred them, level by level.",
            "title": "Enable multi-level referral"
          },
          "maxLevels": {
            "hint": "Maximum number of levels that earn a reward, up to {{max}}. Leave empty for no limit.",
            "label": "Maximum levels",
            "placeholder": "E.g. 5"
          },
          "model": {
            "description": "When the reward is earned, it is split between the ambassador and the ambassadors above them.",
            "label": "How the reward is shared"
          },
          "noReferrer": "To turn this on, first set an ambassador reward in the Rewards step.",
          "preview": {
            "caption": "Each level earns {{percent}}% less than the level before.",
            "chainReward": "Multi-level reward",
            "direct": "Direct ambassador",
            "directReward": "Direct reward",
            "level": "Level {{n}} ambassador",
            "purchase": "Rewarded action",
            "rowDirect": "Direct",
            "rowLevel": "Level {{n}}",
            "tableAmount": "Amount",
            "tableLevel": "Level",
            "title": "How the reward is shared"
          }
        },
        "reward": {
          "basis": {
            "basket": {
              "description": "The reward is calculated on the whole order total.",
              "title": "Whole order total"
            },
            "description": "Which amount the reward is calculated on.",
            "fixedNotAllowed": "A fixed amount does not work when you exclude products. Choose a percentage or ranges, or pick the products to include instead.",
            "label": "Reward basis",
            "lockedNote": "You are excluding products, so the reward is calculated only on the products that are not excluded.",
            "matchedItems": {
              "description": "The reward is calculated only on the products you selected.",
              "title": "Selected products only"
            }
          },
          "campaignType": {
            "description": "Who can earn a reward",
            "label": "Who qualifies",
            "referral": {
              "description": "Only rewards customers who were referred by an ambassador.",
              "title": "Referred customers only"
            }
          },
          "cpa": {
            "applyReco": "Apply 80/20",
            "frakCommission": "Frak commission",
            "hint": "Total you pay per order. Frak keeps {{percent}}%. The rest goes to the ambassador and the referred customer.",
            "reco": "Frak recommends an <highlight>80/20</highlight> split: 80% for the ambassador, 20% for the referred customer.",
            "rewardsDistributed": "Rewards paid",
            "splitMismatch": "The two rewards must add up to {{amount}}. Change one of them."
          },
          "eligibility": {
            "description": "Which orders earn a reward",
            "label": "Eligible orders",
            "minPurchaseHint": "Enter 0 to accept any order total.",
            "minPurchaseLabel": "Minimum order total",
            "minPurchasePlaceholder": "E.g. 5"
          },
          "fixed": {
            "cpaLabel": "Cost per order",
            "cpaPlaceholder": "E.g. 10",
            "percentOfPool": "{{percent}}% of the amount to share"
          },
          "lockup": {
            "description": "Wait before paying rewards, to protect you against refunds",
            "durationHint": "Enter 0 to pay rewards right after the order.",
            "durationLabel": "Payout delay (days)",
            "durationPlaceholder": "E.g. 14",
            "info": "Rewards are paid after this delay. If the order is refunded during the delay, no reward is paid. This protects your campaign budget.",
            "label": "Payout delay",
            "unit": "days"
          },
          "model": {
            "description": "How each reward is calculated",
            "fixed": {
              "description": "The same reward every time.",
              "title": "Fixed amount"
            },
            "label": "Reward type",
            "percentage": {
              "description": "The reward follows the order total.",
              "title": "% of the order total"
            },
            "salesOnly": "Only available for the Sales goal, because the amount depends on the order.",
            "tiered": {
              "description": "The higher the order total, the higher the reward.",
              "title": "Rewards by range"
            }
          },
          "percentage": {
            "cpaLabel": "Cost per order (% of the order total)",
            "cpaPlaceholder": "E.g. 10",
            "recipientHint": "% of the order total paid to this person.",
            "tooHigh": "The cost per order cannot be above 100%."
          },
          "recipient": {
            "ambassadorPlaceholder": "E.g. 6",
            "ambassadorReward": "Ambassador reward",
            "refereePlaceholder": "E.g. 2",
            "refereeReward": "Referred customer reward"
          },
          "saveError": "We could not save the reward. Try again. If you exclude products, choose a percentage or ranges.",
          "tiered": {
            "addTier": "Add a range",
            "basketRange": "Order total range ({{glyph}})",
            "cpaPlaceholder": "E.g. 5",
            "fromPlaceholder": "E.g. 0",
            "globalCpaTitle": "Cost per order",
            "incomplete": "Each range needs a start amount, an end amount (except the last one) and a cost per order above 0.",
            "inverted": "The end of each range must be higher than its start.",
            "overlap": "Ranges cannot overlap. Each range must start where the previous one ends.",
            "removeTier": "Remove range",
            "rewardPlaceholder": "E.g. 5",
            "rewardsRequired": "Each range needs a reward above 0 for the ambassador and for the referred customer.",
            "tierLabel": "Range {{n}}",
            "toPlaceholder": "E.g. 50",
            "unit": "Reward unit"
          },
          "trigger": {
            "create_referral_link": "Referral link created",
            "custom": "Registration",
            "game_join": "Game joined",
            "purchase": "Order placed",
            "referral": "Visit through a referral link",
            "referral_signup": "Sign-up through a referral link"
          },
          "triggeredOn": "Rewarded action: {{trigger}}",
          "value": {
            "description": "How much each person receives.",
            "label": "Reward amount"
          }
        },
        "stepper": {
          "decrease": "Decrease",
          "increase": "Increase"
        },
        "steps": {
          "basics": {
            "hint": "Name, store and currency",
            "label": "Campaign basics",
            "subtitle": "Name your campaign and choose the store it belongs to."
          },
          "budget": {
            "hint": "Amount, period and dates",
            "label": "Budget and schedule",
            "subtitle": "Set the campaign budget and its dates. Frak keeps 20% of the budget as its commission."
          },
          "goals": {
            "hint": "What earns a reward",
            "label": "Goal",
            "subtitle": "Choose the action that earns a reward."
          },
          "products": {
            "hint": "Products that earn a reward",
            "label": "Products",
            "subtitle": "Choose which products earn a reward. By default, every order counts."
          },
          "referralChain": {
            "hint": "Optional",
            "label": "Multi-level referral",
            "subtitle": "Also reward the ambassadors who referred your ambassador. This step is optional."
          },
          "reward": {
            "hint": "Amount and who receives it",
            "label": "Rewards",
            "subtitle": "Choose how rewards are calculated and who receives them."
          },
          "territory": {
            "hint": "Countries you target",
            "label": "Countries",
            "subtitle": "Choose the countries your campaign targets."
          },
          "validation": {
            "hint": "Check and publish",
            "label": "Review",
            "subtitle": "Check your campaign before you publish it. To change something, use the Back button."
          }
        },
        "success": {
          "communicationGuide": "Communication guide (opens in a new tab)",
          "notifyBody": "The Frak ambassador community will receive a push notification on the app: “{{merchant}}” has just launched a new campaign. They can start sharing immediately.",
          "notifyTitle": "Frak ambassadors will be notified",
          "subtitle": "‘{{name}}’ is live.",
          "tip1Desc": "Add a share button on the product page.",
          "tip1Title": "Product page",
          "tip2Desc": "Add the sharing banner right after checkout.",
          "tip2Title": "Order confirmation page",
          "tip3Desc": "Announce the campaign to your existing customers.",
          "tip3Title": "Email",
          "tipsSubtitle": "Mention the campaign in several places:",
          "tipsTitle": "Tell your customers",
          "title": "Campaign published",
          "viewAllCampaigns": "View all campaigns",
          "viewPerformance": "View campaign"
        },
        "territory": {
          "card": {
            "description": "Choose the countries your campaign targets.",
            "label": "Countries",
            "noResults": {
              "clear": "Clear search",
              "description": "No country matches “{{query}}”.",
              "title": "No country found"
            },
            "placeholder": "Choose countries",
            "remove": "Remove {{country}}",
            "required": "Choose at least one country",
            "search": "Search"
          },
          "special": {
            "description": "These categories are not available yet. Leave them unticked to continue.",
            "label": "Special categories",
            "notSupported": "This category is not available yet. Untick it to continue.",
            "options": {
              "credit": {
                "description": "Credit card offers, car loans, long-term financing or similar offers.",
                "title": "Credit"
              },
              "housing": {
                "description": "Real estate listings, home insurance, mortgages or similar offers.",
                "title": "Housing"
              },
              "jobs": {
                "description": "Job offers, internships, professional certification programs or similar offers.",
                "title": "Jobs"
              },
              "social": {
                "description": "Social issues, elections, political figures or campaigns.",
                "title": "Social, electoral or political issues"
              }
            }
          }
        },
        "validation": {
          "ambassador": "Ambassador: {{value}}",
          "budgetAmount": "Budget amount",
          "budgetBreakdown": "Rewards: {{distributed}}{{currency}} · Frak: {{frak}}{{currency}}",
          "budgetPeriod": "Budget period",
          "campaignTitle": "Campaign title",
          "frak": "Frak: {{value}}",
          "goal": "Campaign goal",
          "lockupNone": "No delay",
          "lockupValue": "{{count}} days",
          "lockupValue_one": "{{count}} day",
          "lockupValue_other": "{{count}} days",
          "noEndDate": "No end date",
          "products": "Products",
          "productsAdvanced": "Custom selection",
          "productsAll": "All products",
          "publishError": "We could not publish the campaign. Check each step, then try again. If it keeps failing, email hello@frak-labs.com.",
          "referee": "Referred customer: {{value}}",
          "rewardBasis": "Reward calculated on",
          "rewardLockup": "Payout delay",
          "rewards": "Rewards",
          "schedule": "Schedule",
          "specialCategories": "Special categories",
          "startImmediately": "Start immediately",
          "targetCpa": "Cost per order",
          "territories": "Countries",
          "tierRange": "{{from}} {{currency}} to {{to}} {{currency}}: {{cost}}",
          "tierRangeOpen": "{{from}} {{currency}} and above: {{cost}}",
          "tieredTiers": "{{count}} ranges",
          "tieredTiers_one": "{{count}} range",
          "tieredTiers_other": "{{count}} ranges",
          "trigger": "Rewarded action"
        }
      },
      "details": {
        "close": "Close campaign details",
        "config": {
          "budget": {
            "amountLabel": "Amount",
            "cancel": "Cancel",
            "edit": "Edit limit",
            "error": "The limit was not saved. Try again.",
            "none": "No campaign limit set.",
            "period": {
              "daily": "Daily limit",
              "global": "Total limit",
              "monthly": "Monthly limit",
              "weekly": "Weekly limit"
            },
            "periodLabel": "Limit period",
            "save": "Save",
            "title": "Campaign limit"
          },
          "conditions": {
            "all": "All of the following",
            "and": "and",
            "any": "Any of the following",
            "description": "Extra rules that must be met for the reward to apply.",
            "field": {
              "purchase_amount": "Order total",
              "purchase_matchedAmount": "Eligible products total",
              "purchase_matchedQuantity": "Eligible products quantity"
            },
            "no": "No",
            "none": "No extra conditions. Every qualifying action earns a reward.",
            "noneOf": "None of the following",
            "operator": {
              "between": "is between",
              "contains": "contains",
              "ends_with": "ends with",
              "eq": "equals",
              "exists": "is set",
              "gt": "is greater than",
              "gte": "is at least",
              "in": "is one of",
              "lt": "is less than",
              "lte": "is at most",
              "neq": "does not equal",
              "not_exists": "is not set",
              "not_in": "is not one of",
              "starts_with": "starts with"
            },
            "title": "Conditions",
            "yes": "Yes"
          },
          "limits": {
            "lockup": "Payout delay",
            "lockupNone": "No delay",
            "lockupValue": "{{duration}} before the reward is paid",
            "maxRewardsPerUser": "Maximum rewards per person (this campaign)",
            "merchantMaxRewardsPerUser": "Maximum rewards per person (all campaigns)",
            "pendingExpiration": "Reward claim window",
            "pendingExpirationValue_one": "{{count}} day to claim",
            "pendingExpirationValue_other": "{{count}} days to claim",
            "title": "Limits and timing",
            "unlimited": "Unlimited"
          },
          "productScope": {
            "all": "All products. Every qualifying order earns a reward.",
            "description": "The campaign only applies when the order contains a matching product.",
            "title": "Products covered"
          },
          "rewards": {
            "base": {
              "matched_items_amount": "the eligible products total",
              "purchase_amount": "the order total"
            },
            "bounds": "Between {{min}} and {{max}} {{currency}}",
            "boundsMax": "Up to {{max}} {{currency}}",
            "boundsMin": "At least {{min}} {{currency}}",
            "chaining": "Multi-level referral",
            "chainingDetail": "Each level gets {{decay}}% of what is left, up to {{depth}} levels.",
            "chainingDetailNoDepth": "Each level gets {{decay}}% of what is left, with no level limit.",
            "empty": "No rewards configured yet.",
            "fixed": "{{amount}} {{currency}}",
            "percentage": "{{percent}}% of {{base}}",
            "recipient": {
              "referee": "Referred customer",
              "referrer": "Ambassador"
            },
            "recipientHint": {
              "referee": "The customer who came through the link",
              "referrer": "The person who shared and brought in the customer"
            },
            "tierField": {
              "purchase.amount": "the order total",
              "purchase.matchedAmount": "the eligible products total",
              "purchase.matchedQuantity": "the eligible products quantity"
            },
            "tierPercent": "{{percent}}%",
            "tierRow": "{{range}} → {{amount}} {{currency}}",
            "tiered": "Reward by range, based on {{field}}",
            "title": "Rewards"
          },
          "schedule": {
            "cancel": "Cancel",
            "edit": "Edit dates",
            "endBeforeStart": "The end date must be after the start date",
            "error": "The dates were not saved. Try again.",
            "expires": "End date",
            "immediate": "Immediately",
            "noExpiration": "No end date",
            "notPublished": "Not published yet",
            "published": "Published on",
            "save": "Save",
            "startHint": "The start date can only be moved later.",
            "starts": "Start date",
            "title": "Dates"
          },
          "targeting": {
            "allTerritories": "All countries",
            "goal": "Campaign goal",
            "goalValue": {
              "awareness": "Awareness",
              "registration": "Registration",
              "retention": "Retention",
              "sales": "Sales",
              "traffic": "Traffic"
            },
            "specialCategories": "Special ad categories",
            "specialCategoryValue": {
              "credit": "Credit",
              "housing": "Housing",
              "jobs": "Employment",
              "social": "Social, elections or politics"
            },
            "territories": "Countries",
            "title": "Targeting"
          },
          "trigger": {
            "create_referral_link": "An ambassador creates a share link",
            "custom": "A custom action is tracked",
            "description": "The action that earns a reward.",
            "game_join": "A customer joins a Frak Game",
            "purchase": "A customer places an order",
            "referral": "A referral is completed",
            "referral_signup": "A referred customer creates their Frak account",
            "title": "What earns a reward"
          }
        },
        "cpa": {
          "ambassador": "Ambassador",
          "costPerAction": "per order",
          "frak": "Frak",
          "legendItem": "{{label}}: {{amount}} ({{percent}})",
          "referee": "Referred customer",
          "title": "Cost per order breakdown"
        },
        "economic": {
          "attributedGMV": "Sales generated",
          "attributedGMVSub": "Total of the orders made through this campaign",
          "avgBasketSub": "Per order generated by this campaign",
          "avgBasketValue": "Average order total",
          "cheaperThanMeta": "{{percent}} cheaper than Meta",
          "conversionsCpa": "Orders: {{conversions}}. Cost per order: {{cpa}}.",
          "conversionsCpaMeta": "Orders: {{conversions}}. Estimated cost per order on Meta: {{cpa}}.",
          "equivalentMeta": "Estimated cost on Meta",
          "frakTag": "(Frak)",
          "savedVsMeta": "{{amount}} saved compared with Meta",
          "title": "What you paid vs Meta Ads (estimate)",
          "yourSpend": "Your spend"
        },
        "efficiency": {
          "ambassadors": "Return on spend",
          "avgRewardEarned": "Average reward earned",
          "ofCampaignRev": "Share of the campaign's sales: {{wallet}}",
          "perActiveAmbassador": "Per active ambassador",
          "revenueBudgetSpent": "Sales generated compared with what you spent",
          "roi": "ROI",
          "title": "Campaign efficiency",
          "topPerformer": "Best ambassador"
        },
        "export": "Export (not available yet)",
        "stats": {
          "activeUsers": "Active ambassadors",
          "ambassadors": "Ambassadors",
          "clicksToPurchase": "From click to order",
          "refereesConverted": "Referred customers who ordered",
          "registered": "Registered",
          "sharedAtLeastOnce": "Shared at least once",
          "total": "total"
        },
        "subtitle": {
          "ambassadors_one": "{{count}} ambassador",
          "ambassadors_other": "{{count}} ambassadors"
        },
        "tabs": {
          "ambassadors": "Ambassadors",
          "configuration": "Configuration",
          "funnelRoi": "Results"
        },
        "top": {
          "earned": "Earned",
          "empty": "No ambassador to show yet.",
          "generatedRevenue": "Sales generated",
          "rank": "#",
          "sales": "Orders",
          "shares": "Shares",
          "title": "Top ambassadors",
          "wallet": "Ambassador"
        }
      },
      "empty": {
        "filtered": "No campaign matches these filters. Select “Reset filters” to see all your campaigns.",
        "none": "No campaign yet. Create your first one to reward your ambassadors."
      },
      "filter": {
        "dateRange": "Date range",
        "reset": "Reset filters",
        "tabsLabel": "Filter campaigns by status"
      },
      "overview": {
        "empty": {
          "noData": "No data yet. Choose a longer period or wait for the first shares."
        },
        "footer": {
          "viewAll": "View all campaigns"
        },
        "funnel": {
          "global": "Customer journey, all campaigns: {{variant}}",
          "steps": {
            "brandPageOpened": "App listing opened",
            "converted": "Orders",
            "explorerImpressions": "Seen in the Frak app",
            "linkShared": "Link shared",
            "referred": "Referred customers",
            "shareCtaSeen": "Share button seen",
            "shareInitiated": "Share started"
          },
          "walletFrak": "Frak app",
          "website": "Website"
        },
        "kpi": {
          "ambassadors": "Ambassadors",
          "approximate": "Estimate",
          "avgCpa": "Average cost per order",
          "descriptorAllCampaigns": "All campaigns",
          "descriptorTotal": "total",
          "noData": "No data yet",
          "revenue": "Sales generated",
          "shares": "Shares",
          "sharingRate": "Sharing rate"
        },
        "projected": {
          "actual": "Sales so far",
          "forecast": "Forecast",
          "subtitle": "The forecast extends the last 3 periods.",
          "title": "Sales so far, plus forecast"
        },
        "purchases": {
          "avgPerMonth": "{{value}}\nper month",
          "title": "Orders generated",
          "tooltip": "Orders"
        },
        "sharing": {
          "device": "Device",
          "platform": "Platform",
          "sources": {
            "desktop": "Desktop",
            "merchantSite": "Your store",
            "mobile": "Mobile",
            "other": "Other",
            "tablet": "Tablet",
            "walletApp": "Frak app"
          },
          "title": "Sharing by source"
        },
        "statusLegend": {
          "title": "Status"
        },
        "top": {
          "empty": "No campaign to show yet.",
          "name": "Campaign name",
          "rank": "#",
          "title": "Top campaigns"
        }
      },
      "resources": {
        "affiliateReport": "the affiliate report",
        "config": "the campaign settings",
        "details": "the campaign results",
        "list": "your campaigns",
        "overview": "the campaigns overview"
      },
      "rowMenu": {
        "archive": "Archive",
        "ariaActions": "Actions for {{name}}",
        "delete": "Delete",
        "edit": "Edit campaign",
        "openPerformance": "View results",
        "pause": "Pause",
        "resume": "Resume",
        "viewParameters": "View settings"
      },
      "status": {
        "active": "Active",
        "archived": "Archived",
        "draft": "Draft",
        "ended": "Ended",
        "paused": "Paused",
        "unknown": "Status unavailable"
      },
      "table": {
        "budgetSpend": "Spent / limit",
        "campaign": "Campaign",
        "ctr": "Click rate",
        "endDate": "End date",
        "noEndDate": "No end date",
        "published": "Published on",
        "revenue": "Sales generated",
        "rewards": "Number of rewards",
        "sharingRate": "Sharing rate",
        "status": "Status"
      },
      "tabs": {
        "active": "Active",
        "all": "All",
        "archived": "Archived",
        "draft": "Draft",
        "ended": "Ended",
        "paused": "Paused"
      }
    },
    "common": {
      "cancel": "Cancel",
      "clearAll": "Clear all",
      "close": "Close",
      "copied": "Copied",
      "copy": "Copy",
      "dateField": {
        "openCalendar": "Open calendar",
        "placeholder": "dd/mm/yyyy"
      },
      "dateRange": {
        "clear": "Clear",
        "label": "Date range",
        "presets": {
          "last30": "Last 30 days",
          "last7": "Last 7 days",
          "last90": "Last 90 days",
          "thisMonth": "This month"
        }
      },
      "hidePassword": "Hide password",
      "pagination": {
        "label": "Pagination",
        "morePages": "More pages",
        "next": "Go to next page",
        "previous": "Go to previous page",
        "showing": "Showing {{from}} to {{to}} of {{total}}"
      },
      "search": {
        "placeholder": "Search"
      },
      "showPassword": "Show password",
      "table": {
        "empty": "Nothing to show yet. If you use filters, reset them."
      }
    },
    "customize": {
      "ambassador": {
        "accent": {
          "automatic": "Automatic",
          "hint": "Leave empty to use your theme's button color. The text on the buttons switches between black and white by itself.",
          "invalid": "Enter a color as #rrggbb",
          "label": "Button color"
        },
        "description": "The photo and texts of your ambassador page. An empty field keeps the default text.",
        "fields": {
          "faq1Answer": "Answer 1",
          "faq1Question": "Question 1",
          "faq2Answer": "Answer 2",
          "faq2Question": "Question 2",
          "faq3Answer": "Answer 3",
          "faq3Question": "Question 3",
          "faq4Answer": "Answer 4",
          "faq4Question": "Question 4",
          "faq5Answer": "Answer 5",
          "faq5Question": "Question 5",
          "heroCtaLabel": "Top button",
          "heroLede": "Intro",
          "heroRewardCaption": "Caption on the reward card",
          "heroTitle": "Headline",
          "referralCtaLabel": "Share button",
          "rewardCtaLabel": "Reward button",
          "rewardHeading": "Reward heading",
          "rewardLede": "Reward intro"
        },
        "fullPreview": "See the whole page",
        "fullPreviewDescription": "Phone preview of the whole ambassador page",
        "groups": {
          "buttons": "Button labels",
          "faq": "Frequently asked questions",
          "hero": "Headline and intro",
          "reward": "Reward wording"
        },
        "photo": {
          "custom": "Other image",
          "customHint": "Shown in a 4:5 frame: pick an image where people stay in the middle.",
          "default": "App listing image",
          "defaultHint": "Uses the main cover image of your app listing.",
          "label": "Main photo",
          "noExplorerHint": "Your app listing has no cover image yet, so the page shows no photo.",
          "none": "No photo"
        },
        "preview": "Preview of the top of the page",
        "title": "Ambassador page",
        "tokenHint": "You can insert {BRAND} (your store name) and {REWARD} (the campaign reward).",
        "tonePresets": {
          "casual": "Casual",
          "classic": "Classic",
          "earnings": "Earnings",
          "trust": "Trust"
        }
      },
      "components": {
        "advanced": "Advanced settings",
        "banner": "Banner",
        "bannerGroups": {
          "inapp": "Open in browser",
          "pending": "Unclaimed reward",
          "referral": "Referral"
        },
        "buttonShare": "Share button",
        "description": "A placement is a specific spot on your store where you want a different style or text.",
        "fields": {
          "badgeText": "Badge text",
          "claimCtaText": "Claim button text",
          "css": "Style code (CSS)",
          "ctaNoRewardText": "Button text (no reward)",
          "ctaText": "Button text",
          "inappCta": "Open in browser button text",
          "inappDescription": "Open in browser description",
          "inappTitle": "Open in browser title",
          "noRewardText": "Button text (no reward)",
          "pendingCta": "Unclaimed reward button text",
          "pendingDescription": "Unclaimed reward description",
          "pendingTitle": "Unclaimed reward title",
          "refereeNoRewardText": "Message to referred customers (no reward)",
          "refereeText": "Message to referred customers",
          "referralCta": "Referral button text",
          "referralDescription": "Referral description",
          "referralTitle": "Referral title",
          "referrerNoRewardText": "Message to ambassadors (no reward)",
          "referrerText": "Message to ambassadors",
          "text": "Button text"
        },
        "image": {
          "description": "Replace the default gift icon with your own image.",
          "hint": "Paste an image URL or upload one below.",
          "label": "Illustration"
        },
        "pendingTokensHint": "Shown to visitors with an unclaimed reward. You can insert: {REWARD}, {DAYS}, {DATE}.",
        "postPurchase": "After checkout",
        "postPurchaseGroups": {
          "referee": "Message to referred customers",
          "referrer": "Message to ambassadors",
          "shared": "Badge and button"
        },
        "postPurchasePreview": {
          "referee": "Referred customer view",
          "referrer": "Ambassador view"
        },
        "preview": "Preview",
        "rewardToken": {
          "copy": "Copy {REWARD}",
          "hint": "You can insert <token>{REWARD}</token> in any text. It shows the current campaign reward."
        },
        "style": {
          "background": "Background",
          "borderColor": "Border color",
          "borderWidth": "Border thickness (px)",
          "boxMargin": "Margin",
          "boxPadding": "Inner margin",
          "case_capitalize": "Capitalized",
          "case_lowercase": "lowercase",
          "case_none": "As typed",
          "case_theme": "From theme",
          "case_uppercase": "UPPERCASE",
          "clear": "Reset",
          "clearAll": "Reset all",
          "defaultTierHint": "These settings apply to every share button on a page as soon as one of them is set up with a placement. Otherwise the page keeps your theme's style.",
          "groupColors": "Colors and border",
          "inheritNotice": "The share button is shown inside your store and uses your theme's button style (font, rounded corners, hover and focus). What you set here only replaces the settings you change, so the real button may differ from this preview.",
          "linkMargin": "Link all margins",
          "linkPadding": "Link all inner margins",
          "look": "Look",
          "look_custom": "Custom",
          "look_outline": "Outline",
          "look_solid": "Solid",
          "look_theme": "My theme",
          "marginBottom": "Bottom margin",
          "marginLeft": "Left margin",
          "marginRight": "Right margin",
          "marginTop": "Top margin",
          "none": "None",
          "paddingBottom": "Bottom inner margin",
          "paddingLeft": "Left inner margin",
          "paddingRight": "Right inner margin",
          "paddingTop": "Top inner margin",
          "section": "Visual settings",
          "size": "Size",
          "size_l": "Large",
          "size_m": "Medium",
          "size_s": "Small",
          "spacing": "Spacing",
          "swatchLabel": "Color picker: {{label}}",
          "textCase": "Capital letters",
          "textColor": "Color",
          "textSize": "Text size (px)",
          "textWeight": "Boldness",
          "title": "Button style",
          "unitMargin": "Margin unit",
          "unitPadding": "Inner margin unit",
          "weight_400": "Regular",
          "weight_500": "Medium",
          "weight_600": "Semi-bold",
          "weight_700": "Bold",
          "weight_theme": "From theme"
        },
        "targetInteraction": {
          "error": "Maximum length is 200 characters",
          "hint": "Name of the action that earns a reward on this placement, such as purchase_completed or signup.",
          "label": "Rewarded action"
        },
        "title": "Frak elements on your store"
      },
      "globalCss": {
        "description": "Style code (CSS) applied to every Frak element in every placement. The CSS of a placement can override it.",
        "title": "CSS for all placements",
        "toggle": "Custom CSS"
      },
      "identity": {
        "currency": {
          "auto": "Auto",
          "hint": "Currency used to show amounts to customers. Rewards are still paid in {{token}}.",
          "label": "Display currency"
        },
        "description": "What your customers see in Frak buttons and banners.",
        "displayed": {
          "description": "When off, no Frak element appears on your store.",
          "title": "Show Frak on my store"
        },
        "homepage": {
          "hint": "Your website address. It opens when a customer clicks your name.",
          "invalid": "Enter a valid URL (https://…)",
          "label": "Homepage link"
        },
        "lang": {
          "auto": "Auto (browser language)",
          "en": "English",
          "fr": "Français",
          "hint": "Language of the Frak texts. With Auto, we use the customer's browser language.",
          "label": "Language"
        },
        "logo": {
          "hint": "Shown next to your name on Frak buttons and banners.",
          "label": "Logo"
        },
        "name": {
          "hint": "Left empty, your store's name is used.",
          "label": "Display name"
        },
        "title": "How customers see your store"
      },
      "placements": {
        "add": "+ Add a placement",
        "css": {
          "description": "Style code (CSS) for this placement only. It applies to every Frak element in this placement.",
          "title": "CSS of placement {{placementId}}"
        },
        "delete": {
          "action": "Delete {{placementId}}",
          "cancel": "Cancel",
          "confirm": "Delete placement",
          "description": "This removes every setting of placement {{placementId}}.",
          "dialogTitle": "Delete placement",
          "hint": "This removes every setting of this placement.",
          "title": "Delete placement {{placementId}}"
        },
        "dialog": {
          "cancel": "Cancel",
          "create": "Create placement",
          "errorExists": "This placement already exists.",
          "errorFormat": "Use 3 to 16 characters: letters, numbers, _ or -.",
          "errorMax": "Maximum 10 placements allowed.",
          "hint": "Choose a unique name of 3 to 16 characters.",
          "title": "Create placement"
        },
        "globalDefault": "Global default",
        "label": "Placement"
      },
      "propagationHint": "A saved change can take up to 10 minutes to appear on your storefront.",
      "rewardReminder": {
        "description": "Shows customers who earned a reward but have no Frak wallet yet a small reminder with the amount and the days left before it expires. A reward that is never claimed is never paid. Other visitors never see it.",
        "enabled": "Show the reward reminder",
        "fields": {
          "cta": "Button text",
          "description": "Description",
          "title": "Title"
        },
        "position": {
          "label": "Position",
          "left": "Left",
          "right": "Right"
        },
        "title": "Reward reminder",
        "tokensHint": "You can insert: {REWARD} (the reward), {DAYS} (days left), {DATE} (the date), {BRAND} (your store name). An empty field keeps the default text."
      },
      "save": "Save",
      "sharing": {
        "description": "The title and text shown when a customer shares through their phone or messaging app.",
        "fields": {
          "text": {
            "hint": "Sent alongside the shared link.",
            "label": "Share text"
          },
          "title": {
            "hint": "Used as the subject in email and as the preview header.",
            "label": "Share title"
          }
        },
        "preview": "Preview",
        "title": "Share message"
      },
      "wordingLang": {
        "default": "All languages"
      }
    },
    "dashboard": {
      "actions": {
        "edit": "Edit store",
        "manageBudget": "Manage budget"
      },
      "empty": {
        "description": "Add your store to create your first campaign.",
        "title": "Welcome to Frak"
      }
    },
    "errors": {
      "auth": {
        "invalidCode": "This code is wrong or has expired. Check it or ask for a new one.",
        "invalidMethod": "This option isn't available. Pick another way to confirm.",
        "invalidTwoFactorCode": "This code is wrong or has expired. Check it or ask for a new one.",
        "invalidTwoFactorProof": "The verification failed. Try again.",
        "otpThrottled": "Too many tries. Wait {{seconds}} seconds, then try again."
      },
      "boundary": {
        "goBack": "Go back",
        "message": "This page could not be displayed. Try again. If it keeps happening, email hello@frak-labs.com.",
        "retry": "Try again",
        "retryAria": "Try again to reload this content",
        "technicalDetails": "Technical details (development only)"
      },
      "campaign": {
        "back": "Back to campaigns",
        "message": "This campaign does not exist, or you do not have access to it.",
        "title": "Campaign not found"
      },
      "campaignCreate": {
        "back": "Back to the dashboard",
        "message": "The campaign was not created. Try again. If it keeps failing, email hello@frak-labs.com.",
        "title": "Could not create the campaign"
      },
      "critical": {
        "back": "Go to the dashboard",
        "message": "Try again. If it keeps happening, email hello@frak-labs.com.",
        "title": "The dashboard could not load"
      },
      "dataLoad": {
        "message": "We could not load {{resourceName}}. Check your connection and try again.",
        "resource": {
          "affiliateReport": "the TakeAds report",
          "campaignConfig": "the campaign settings",
          "campaignOverview": "the campaign overview",
          "campaigns": "campaigns",
          "default": "the data",
          "members": "members"
        },
        "title": "Could not load the data"
      },
      "generic": {
        "title": "Something went wrong"
      },
      "linkWallet": {
        "generic": "We could not link your wallet. Try again. If it keeps failing, email hello@frak-labs.com.",
        "signatureCancelled": "You closed the Frak wallet window. Nothing was linked. Try again when you're ready.",
        "stepUpRequired": "We need to check it's you first. Confirm your identity, then try again.",
        "walletTaken": "This Frak wallet is already linked to another account. Use a different wallet, or log in with the account that has it."
      },
      "merchantCreate": {
        "back": "Back to the dashboard",
        "message": "The store was not added. Try again. If it keeps failing, email hello@frak-labs.com.",
        "title": "Could not add the store"
      },
      "merchantNotFound": {
        "back": "Back to the dashboard",
        "message": "This store does not exist, or you do not have access to it.",
        "title": "Store not found"
      },
      "notFound": {
        "action": "Go to the dashboard",
        "description": "This page does not exist or has moved.",
        "title": "Page not found"
      },
      "pushCreate": {
        "back": "Back to members",
        "message": "The notification was not created. Try again. If it keeps failing, email hello@frak-labs.com.",
        "title": "Could not create the push notification"
      }
    },
    "forms": {
      "currencySelector": {
        "circleDescription": "US dollars. For customers who already use crypto apps and exchanges.",
        "moneriumDescription": "Euros. Your customers can send their rewards to their bank account. Best choice if they don't use crypto.",
        "recommendedTooltip": "Recommended"
      },
      "multiSelect": {
        "clear": "Clear",
        "close": "Close",
        "noResults": "No results found.",
        "placeholder": "Select options",
        "search": "Search...",
        "selectedCount_one": "{{count}} selected",
        "selectedCount_other": "{{count}} selected"
      }
    },
    "funding": {
      "addFunds": {
        "balanceLabel": "Current budget",
        "stripe": "Add funds with Stripe",
        "testTokens": "Add test funds"
      },
      "budget": {
        "actions": {
          "amountPlaceholder": "New spending limit",
          "cancel": "Cancel",
          "confirm": "Confirm",
          "increaseLimit": "Increase spending limit",
          "limitHint": "The most Frak can pay out as rewards from your budget. Keep it at or above your budget.",
          "withdraw": "Withdraw",
          "withdrawCta": "Withdraw funds",
          "withdrawHint": "The funds are sent to your Frak wallet. It opens so you can confirm.",
          "withdrawPlaceholder": "Max {{amount}}",
          "withdrawTooltip": "Sends your available funds to your Frak wallet. You can only withdraw while rewards are paused."
        },
        "addFunds": "Add funds",
        "allowanceTooltip": "Spending limit: {{amount}}",
        "breakdown": {
          "distributable": "Available for rewards",
          "frakFee": "Frak fees ({{rate}}%)",
          "vat": "VAT ({{rate}}%)"
        },
        "distributing": "Pay rewards",
        "distributingHint": "When off, no reward is paid. You can then withdraw your funds.",
        "distributingTooltip": "When on, Frak pays rewards from your budget through your active campaigns. When off, no new reward is paid.",
        "emptyWarning": "Your budget is empty. Active campaigns can't pay rewards until you add funds.",
        "limitTooLow": "Spending limit lower than your budget",
        "noFundsCaption": "No funds yet.",
        "noLimit": "No spending limit",
        "sectionLabel": "Reward budget",
        "status": {
          "actionNeeded": "Limit too low",
          "active": "Active",
          "paused": "Rewards paused"
        },
        "totalExclVat": "total budget, Frak fees included",
        "totalInclVat": "total budget, VAT and Frak fees included"
      },
      "error": "We could not load your budget. Check your connection and try again.",
      "errors": {
        "action": "The action did not go through. Try again. If it keeps failing, email hello@frak-labs.com."
      },
      "header": {
        "addFundsDescription": "You pay on Stripe, in a new tab. The amount you pay includes Frak fees, and VAT if it applies to you. Your budget updates once the payment goes through.",
        "addFundsTitle": "Add funds",
        "back": "Back",
        "budgetTitle": "Manage budget",
        "close": "Close"
      },
      "legacy": {
        "description": "Your old budget still holds funds. Move them to your new budget to keep paying rewards. You confirm once in your Frak wallet.",
        "migrate": "Move funds",
        "pending": "Pending rewards (not moved)",
        "title": "Move funds from your old budget",
        "totalBalance": "Total in old budget",
        "withdrawable": "Available to move"
      },
      "linkWallet": {
        "cta": "Link wallet",
        "description": "Needed to turn rewards on or off, change the spending limit, withdraw funds or move funds from your old budget. You confirm each of these in your Frak wallet. Adding funds and viewing your budget work without it.",
        "title": "Link your Frak wallet (optional)"
      },
      "pause": {
        "title": "Pause this currency"
      },
      "pending": "Confirm in your Frak wallet. The change appears here once it is recorded.",
      "setup": {
        "cta": "Set up budget",
        "description": "Set up your reward budget. You can then add funds and start paying rewards."
      },
      "walletPrompt": {
        "migrate": {
          "description": "Move the available funds from your old budget to your new budget.",
          "title": "Move funds"
        },
        "payRewardsOff": {
          "description": "Stop paying rewards from your budget.",
          "title": "Pause rewards"
        },
        "payRewardsOn": {
          "description": "Allow Frak to pay rewards from your budget.",
          "title": "Turn on rewards"
        },
        "revokeLimit": {
          "description": "Set the spending limit to zero. No reward is paid in this currency until you raise it.",
          "title": "Pause this currency"
        },
        "updateLimit": {
          "description": "Change the most Frak can pay out as rewards from your budget.",
          "title": "Change spending limit"
        },
        "withdraw": {
          "description": "Send funds from your budget to your Frak wallet.",
          "title": "Withdraw funds"
        }
      }
    },
    "internal": {
      "bank": {
        "address": "Address",
        "checkedAt": "Read on-chain",
        "closed": "Closed",
        "closedHint": "The bank is closed: nothing is paid until it reopens.",
        "description": "Pays Frak's signup rewards and game prizes. Every brand opted into the shared bank draws on the same balance.",
        "merchants": {
          "empty": "Nothing owed",
          "merchant": "Merchant",
          "title": "What it owes",
          "token": "Token"
        },
        "open": "Open",
        "owed": {
          "depleted": "Waiting for funds",
          "due": "To pay now",
          "later": "Held or locked",
          "processing": "Being sent"
        },
        "owedValue": "{{amount}} ({{count}})",
        "prizes": {
          "confirmedAt": "Confirmed",
          "empty": "No prize confirmed yet",
          "ended": "ended {{date}}",
          "payout": "Payout",
          "prize": "Prize",
          "title": "Game prizes"
        },
        "recheck": {
          "hint": "Settlement re-checks a refilled bank every 3 hours. After a top-up, re-check now to pay what it can cover right away.",
          "result_one": "{{count}} reward back in the queue; settlement started.",
          "result_other": "{{count}} rewards back in the queue; settlement started.",
          "result_zero": "Nothing was waiting on funds; settlement started for the queued rewards.",
          "trigger": "Re-check now"
        },
        "reload": "Reload",
        "shortfall": "Short by {{amount}}: top up the bank or raise its allowance. Until then these rewards show as \"Waiting for brand funding\".",
        "title": "Frak bank",
        "token": {
          "allowance": "Allowance",
          "balance": "Balance",
          "covered": "Covered",
          "payable": "Can pay now",
          "short": "Short {{amount}}"
        }
      },
      "codes": {
        "downloadQr": "Download the QR (SVG)",
        "issue": {
          "description": "New users who enter it at signup get Frak as referrer. Open a game on it to make it a game code.",
          "issued": "Link behind the QR",
          "submitRandom": "Issue a random code",
          "submitVanity": "Issue this code",
          "title": "Issue a Frak code",
          "vanityLabel": "Vanity code (optional)",
          "vanityPlaceholder": "6 characters, random if empty"
        },
        "revoke": {
          "confirm": "Revoke",
          "description": "Nobody can redeem it anymore. Users who already did keep Frak as referrer.",
          "descriptionGame": "Nobody can redeem it or join its game anymore. Users who already did keep Frak as referrer.",
          "title": "Revoke {{code}}?",
          "trigger": "Revoke"
        },
        "showQr": "QR",
        "status": {
          "active": "Active",
          "revoked": "Revoked"
        },
        "table": {
          "code": "Code",
          "createdAt": "Issued",
          "empty": "No Frak code yet",
          "game": "Game",
          "redemptions": "Referees",
          "redemptionsValue": "{{active}} / {{total}}",
          "status": "Status",
          "title_one": "{{count}} code",
          "title_other": "{{count}} codes",
          "viewGame": "View game"
        }
      },
      "draw": {
        "algorithm": "Algorithm",
        "beacon": "Beacon",
        "beaconSigned": "Recorded",
        "beaconWaiting": "Waiting",
        "candidate": {
          "accountCreated": "Account created",
          "adminOnlyHint": "This draw predates the 24 h window: only you can pass the turn on.",
          "awaitingAdmin": "Ready for review",
          "awaitingPlayer": "Waiting for the player",
          "checkedAt": "Follow checked",
          "follows": "Follows @frak_fr",
          "metaDown": "Meta did not answer: the follow shown is the last one we read.",
          "notToldYet": "Not told yet",
          "pid": "Public id",
          "player": "Player",
          "tickets": "Tickets in the draw",
          "title": "Candidate #{{rank}}",
          "verifyBy": "Deadline",
          "windowHint": "A candidate who is not certified and following has 24 h from their push; then the turn passes to the next one."
        },
        "candidates": "Candidates",
        "candidatesValue": "{{rejected}} rejected of {{total}}",
        "check": {
          "algorithm_known": "The algorithm is known",
          "beacon_signed": "drand signed this round",
          "candidates_replay": "The candidates replay in the same order",
          "quicknet_beacon": "The beacon is drand quicknet's",
          "randomness_matches": "The randomness comes from the signature",
          "rejections_in_order": "Each rejection passed over the next candidate in order",
          "root_matches": "The snapshot root hashes the published list",
          "round_after_freeze": "The round came out after the freeze",
          "total_matches": "The ticket total adds up",
          "winner_first_unrejected": "The winner is the first candidate not rejected"
        },
        "confirm": {
          "confirm": "Pay the prize",
          "description": "Their follow is re-read from Meta, then the prize is paid from the shared bank. This cannot be undone.",
          "title": "Pay this winner?",
          "trigger": "Confirm and pay"
        },
        "discarded": {
          "not_following": "Not following",
          "not_linked": "No Instagram"
        },
        "freeze": {
          "confirm": "Freeze",
          "description": "Every player's tickets are counted once and published with a future drand round. This cannot be undone.",
          "title": "Freeze this game's tickets?",
          "trigger": "Freeze now"
        },
        "frozenAt": "Frozen",
        "notFrozen": "Not frozen yet. The cron freezes a game about an hour after it ends, and gives up 7 days later.",
        "participants": "Players",
        "participantsValue": "{{eligible}} eligible of {{total}}",
        "reason": {
          "fraud": "Fraud",
          "ineligible": "Ineligible",
          "not_following_at_review": "Not following at review",
          "not_verified_in_time": "Not verified in time",
          "unreachable": "Unreachable"
        },
        "reject": {
          "confirm": "Reject",
          "description": "Reason: {{reason}}. The next candidate is up; rejecting the last one leaves the draw without a winner.",
          "reason": "Rejection reason",
          "title": "Reject this candidate?",
          "trigger": "Reject"
        },
        "rejection": "#{{rank}}: {{reason}}, by {{actor}} on {{date}}",
        "rejections": "Rejections",
        "reload": "Reload",
        "root": "Snapshot root",
        "round": "drand round",
        "status": {
          "confirmed": "Winner confirmed",
          "drawn": "Under review",
          "frozen": "Frozen",
          "void": "No winner"
        },
        "tickets": "Tickets in the draw",
        "title": "Draw",
        "verify": {
          "allGood": "The draw replays from its public record.",
          "failed": "The public record does not replay: look at the failing checks.",
          "publicRecord": "Public record",
          "run": "Replay the draw",
          "title": "Verification"
        },
        "winner": {
          "confirmedBy": "confirmed by {{actor}} on {{date}}",
          "depleted": "The bank cannot cover it yet, so the winner sees \"Waiting for brand funding\".",
          "openBank": "Open the bank",
          "payout": "Payout",
          "title": "Winner"
        }
      },
      "errors": {
        "generic": "Something went wrong, try again."
      },
      "form": {
        "budget": "Budget (EURe)",
        "stepUpHint": "You will be asked to confirm with your second factor.",
        "unlockDays": "Days to unlock a reward"
      },
      "game": {
        "back": "All games",
        "create": {
          "code": "Frak code",
          "codePlaceholder": "Pick a code",
          "endsAt": "Ends",
          "noFreeCode": "Every active Frak code already has a game: issue one in Referral codes first.",
          "noSponsor": "No sponsor",
          "prizeAmount": "Prize (EUR)",
          "prizeDescription": "Prize description",
          "reward": "Join reward (EURe)",
          "rewardHint": "Paid once to each new user who joins.",
          "sponsor": "Sponsor",
          "startsAt": "Starts",
          "submit": "Open the game",
          "title": "Open a game"
        },
        "detail": {
          "days_one": "{{count}} day",
          "days_other": "{{count}} days",
          "ended": "Ended",
          "endsIn": "Ends in {{time}}",
          "hours_one": "{{count}} hour",
          "hours_other": "{{count}} hours",
          "prize": "Prize {{amount}}",
          "sponsor": "sponsored by {{name}}",
          "startsIn": "Starts in {{time}}",
          "window": "{{start}} → {{end}}"
        },
        "list": {
          "budget": "Join rewards",
          "code": "Code",
          "create": "New game",
          "draw": "Draw",
          "empty": "No game yet",
          "phase": "Status",
          "players": "Players",
          "prize": "Prize",
          "runDraws": "Run the draw pass",
          "runDrawsResult": "Frozen {{frozen}}, drawn {{drawn}}, candidate windows moved {{advanced}}.",
          "title": "Games",
          "window": "Window"
        },
        "notFound": "This game does not exist.",
        "pause": "Pause",
        "phase": {
          "ended": "Ended",
          "live": "Live",
          "paused": "Paused",
          "upcoming": "Upcoming"
        },
        "players": {
          "counts": "Counts",
          "draw": "Draw",
          "empty": "Nobody joined yet",
          "frozen": "As frozen for the draw",
          "instagram": "Instagram",
          "joinedAt": "Joined",
          "live": "Live, counted at {{time}}, refreshed every {{seconds}} s",
          "player": "Player",
          "refresh": "Recount now",
          "search": "Wallet, Instagram or id",
          "tickets": "Tickets",
          "title_one": "{{count}} player",
          "title_other": "{{count}} players",
          "wouldNotCount": "Would not count"
        },
        "resume": "Resume",
        "stats": {
          "budget": "Join rewards paid",
          "budgetOf": "of {{total}}",
          "bySource": "Tickets by source",
          "declared_one": "{{count}} declared handle",
          "declared_other": "{{count}} declared handles",
          "eligibleFrozen_one": "{{count}} counted in the draw",
          "eligibleFrozen_other": "{{count}} counted in the draw",
          "eligibleLive_one": "{{count}} would count in the draw now",
          "eligibleLive_other": "{{count}} would count in the draw now",
          "instagram": "Certified followers",
          "players": "Players",
          "tickets": "Tickets",
          "ticketsInDraw_one": "{{count}} in the draw",
          "ticketsInDraw_other": "{{count}} in the draw"
        }
      },
      "instagram": {
        "certified": "Certified",
        "declared": "Declared",
        "follows": "Follows",
        "none": "No Instagram",
        "notFollowing": "Not following",
        "unknown": "Unknown"
      },
      "lookup": {
        "assets": {
          "amount": "Amount",
          "recipient": "As",
          "status": "Status",
          "title": "Rewards",
          "tx": "Transaction"
        },
        "cancelled": "Cancelled",
        "date": "Date",
        "description": "Everything we know about one person: identity, referrals, interactions and rewards.",
        "groupCreated": "Created {{date}}",
        "identity": "Identity",
        "interactions": "Interactions",
        "latest": "latest {{shown}} of {{total}}",
        "links": {
          "active": "Active",
          "crossMerchant": "Every merchant",
          "referee": "Referee",
          "referrer": "Referrer",
          "removed": "Removed",
          "source": "Source",
          "state": "State"
        },
        "merchant": "Merchant",
        "merged_one": "{{count}} merged group",
        "merged_other": "{{count}} merged groups",
        "none": "Nothing",
        "payload": "Payload",
        "placeholder": "Wallet address, email or identity group id",
        "referees": "Referred",
        "referrers": "Referred by",
        "submit": "Search",
        "type": "Type"
      },
      "payout": {
        "missing": "No payout found",
        "status": {
          "bank_depleted": "Waiting for funds",
          "cancelled": "Cancelled",
          "expired": "Expired",
          "pending": "Queued",
          "processing": "Sending",
          "settled": "Claimable"
        }
      },
      "rule": {
        "budget": "Budget used",
        "budgetValue": "{{used}} used of {{total}}",
        "recipient": {
          "referee": "Friend",
          "referrer": "Referrer"
        },
        "reward": "{{recipient}} {{amount}}",
        "status": {
          "active": "Live",
          "archived": "Archived",
          "draft": "Draft",
          "paused": "Paused"
        },
        "unlimited": "no limit"
      },
      "setup": {
        "merchant": {
          "bank": "Bank",
          "description": "Pays the game rewards and prizes from the shared campaign bank. Seed it once per environment.",
          "domain": "Domain",
          "owner": "Owner",
          "ownerHint": "Wallet address or business account id. Defaults to you.",
          "submit": "Seed the Frak merchant",
          "title": "Frak merchant"
        },
        "missing": "Missing",
        "ready": "Ready",
        "signupRule": {
          "description": "Paid to both sides when a friend signs up with a user's code.",
          "needsMerchant": "Seed the Frak merchant first.",
          "pauseHint": "Pause it from the Frak merchant's campaigns to publish a new one.",
          "referee": "Friend (EURe)",
          "referrer": "Referrer (EURe)",
          "submit": "Publish the signup reward",
          "title": "Signup reward"
        }
      },
      "setupCode": {
        "description": "Lets a merchant register a domain without the DNS record. It only works for this domain and this owner.",
        "domain": "Merchant domain",
        "owner": "Owner",
        "ownerHint": "Their wallet address, or their email when they log in without a wallet.",
        "result": "Setup code for {{domain}}",
        "submit": "Generate",
        "title": "Merchant setup code"
      },
      "tickets": {
        "brandShare": "brand share",
        "instagramCertified": "Instagram",
        "join": "join",
        "purchase": "purchase",
        "referredPurchase": "friend's purchase",
        "referredSignup": "friend's signup"
      }
    },
    "members": {
      "audience": {
        "minMember": "No member matches. Widen the dates or the number of interactions.",
        "reach": "You will reach {{count}} members",
        "required": "Select a filter below to choose who receives this notification.",
        "title": "Audience"
      },
      "columns": {
        "interactions": "Interactions",
        "memberFrom": "Member since",
        "merchants": "Store",
        "rewards": "Rewards earned ({{currency}})",
        "wallet": "Customer"
      },
      "empty": {
        "filtered": "No member matches these filters. Change the dates or the number of interactions.",
        "none": "No member yet. Customers appear here after their first interaction with your store."
      },
      "filters": {
        "button": "Filters",
        "from": "From",
        "interactions": "Interactions",
        "max": "Max",
        "maxGreaterThanMinError": "Max must be higher than min.",
        "maxInteractions": "No maximum",
        "maxInteractionsError": "Maximum interactions can't be negative",
        "membershipDate": "Member since",
        "min": "Min",
        "minInteractions": "0",
        "minInteractionsError": "Minimum interactions can't be negative",
        "pickDate": "Pick a date",
        "reset": "Reset filters",
        "segment": "Segment",
        "to": "To"
      },
      "intro": "Members are customers who interacted with your store through Frak. An interaction is a tracked action, such as sharing a link, arriving through a link or placing an order.",
      "platformAdminNotice": "Member data is hidden in read-only mode.",
      "resources": {
        "list": "your members"
      },
      "sendPushNotification": "Send push notification",
      "tabs": {
        "members": "Members",
        "push": "Push notifications"
      }
    },
    "merchant": {
      "affiliate": {
        "brandId": "TakeAds ID",
        "description": "This store earns through its TakeAds affiliate connection.",
        "title": "Affiliate configuration",
        "trackingLink": "Tracking link"
      },
      "affiliateTag": "TakeAds",
      "create": {
        "actions": {
          "back": "Back",
          "close": "Close",
          "completeRegistration": "Register my store",
          "continue": "Continue"
        },
        "currencyInfo": {
          "circleDescription": "Rewards are paid in USDC, a digital dollar. Best if your customers already use cryptocurrencies.",
          "circleName": "USDC (Circle):",
          "moneriumDescription": "Rewards are paid in euros. Customers can send them to their bank account (IBAN).",
          "moneriumName": "EUR (Monerium):"
        },
        "dns": {
          "copy": "Copy",
          "helpBody": "The steps depend on who manages your domain (for example Cloudflare, GoDaddy or Namecheap). Our guide explains them one by one.",
          "helpCta": "Open the guide",
          "helpQuestion": "How do I add this record?",
          "helper": "Where you manage your domain, add a TXT record with this value. It can take time to appear. Then click Continue.",
          "title": "Prove this domain is yours",
          "verifiedViaShopify": "Domain verified through your Shopify account. Nothing to add."
        },
        "fields": {
          "currency": {
            "description": "The default currency for your campaign rewards. You can change it later.",
            "label": "Reward currency"
          },
          "domain": {
            "alreadyRegistered": "{{domain}} is already registered. If it should be yours, contact hello@frak-labs.com.",
            "dnsNotSet": "We cannot find the TXT record yet, or the setup code is not valid. Changes to a domain can take time to appear. Check the value and the code, wait a little, then click Continue again.",
            "hint": "The address your customers use, like myshop.com. No https://.",
            "invalid": "Enter a domain like myshop.com",
            "label": "Your store's domain",
            "nameLabel": "Domain",
            "placeholder": "myshop.com",
            "required": "Enter your store's domain",
            "verifyFailed": "We could not check your domain. Try again in a moment."
          },
          "name": {
            "label": "Store name",
            "minLength": "The store name must have at least 2 characters",
            "placeholder": "Store name",
            "required": "Enter your store name"
          },
          "setupCode": {
            "label": "Setup code (only if Frak gave you one)",
            "placeholder": "Setup code"
          }
        },
        "instructions": {
          "approve": "Confirm in your Frak wallet. No money moves.",
          "duration": "This usually takes less than a minute.",
          "onChain": "Your store is saved on the blockchain, a public record."
        },
        "platformAdmin": {
          "description": "Advanced options for the Frak team.",
          "label": "Frak admin options",
          "skipDomain": {
            "description": "Register without the domain ownership check. The confirmation is still required.",
            "title": "Skip domain verification"
          },
          "takeadsMerchantId": {
            "label": "TakeAds ID",
            "mustBeInteger": "Enter a positive whole number",
            "placeholder": "e.g. 12345"
          },
          "takeadsTrackingLink": {
            "invalidUrl": "Enter a valid URL",
            "label": "TakeAds tracking link",
            "placeholder": "https://tatrck.com/h/..."
          },
          "useFrakBank": {
            "description": "Link this store to the shared Frak reward budget instead of creating a dedicated one.",
            "title": "Use the shared Frak reward budget"
          }
        },
        "progress": {
          "confirm": "Confirm in your Frak wallet",
          "done": "Your store is registered",
          "failed": "We could not register your store. Try again. If it keeps failing, email hello@frak-labs.com.",
          "registering": "Saving your store..."
        },
        "registration": {
          "description": "When you register your store:",
          "label": "What happens next"
        },
        "steps": {
          "details": {
            "hint": "Name, currency and domain",
            "label": "Your store",
            "subtitle": "Tell us about your store.",
            "title": "Add a store"
          },
          "registration": {
            "hint": "Check and confirm",
            "label": "Confirmation",
            "subtitle": "Frak saves your store on the blockchain, a public record.",
            "title": "Confirm your store"
          }
        },
        "summary": {
          "currency": "Currency",
          "description": "Check these details, then confirm.",
          "domain": "Domain",
          "label": "Summary",
          "name": "Store name",
          "provider": "Payment partner"
        }
      },
      "setupStatus": {
        "completeStep": "Complete this step",
        "documentation": "Read the guide",
        "steps": {
          "addCampaign": {
            "description": "Reward the ambassadors who share your store.",
            "name": "Launch a campaign"
          },
          "addFunding": {
            "description": "Rewards are paid from this budget.",
            "name": "Add funds to your budget"
          },
          "otherAdmin": {
            "description": "If you are away, someone else can still manage your store.",
            "name": "Add another admin"
          },
          "runningBank": {
            "description": "Rewards are paid only when this is on.",
            "name": "Turn on reward payouts"
          }
        },
        "success": "Your store is ready.",
        "title": "Setup checklist",
        "warningLine1": "Some steps are not done yet.",
        "warningLine2": "Finish them to complete your setup."
      }
    },
    "merchantEdit": {
      "close": "Close",
      "details": {
        "currency": "Reward currency",
        "domain": "Domain",
        "edit": "Edit",
        "name": "Store name",
        "title": "Your store"
      },
      "discard": {
        "confirm": "Discard changes",
        "description": "You have unsaved changes. Discard them?",
        "keepEditing": "Keep editing",
        "title": "Discard changes?"
      },
      "domains": {
        "add": "Add domain",
        "addError": "We could not add the domain. Try again.",
        "additionalLabel": "Extra domain",
        "claimed": "This domain is already registered to another store. Contact <support>hello@frak-labs.com</support> to sort it out.",
        "description": "Other addresses where your store runs, like your .myshopify.com address. Frak recognizes your store on these addresses and on your main domain.",
        "empty": "No extra domains yet.",
        "invalid": "Enter a domain like myshop.com",
        "manage": "Manage domains",
        "more": "+{{count}} more",
        "placeholder": "e.g. mystore.myshopify.com",
        "remove": "Remove",
        "title": "Extra domains"
      },
      "editMerchant": {
        "cancel": "Cancel",
        "currency": "Reward currency",
        "description": "Update your store name and reward currency.",
        "domain": "Domain",
        "infoCircle": "USDC (Circle):",
        "infoMonerium": "EUR (Monerium):",
        "name": "Store name",
        "namePlaceholder": "Store name",
        "nameRequired": "Enter your store name",
        "save": "Save changes",
        "title": "Edit your store"
      },
      "explorer": {
        "additionalHero": "More cover images",
        "additionalHeroHint": "Up to 4 more, shown one after the other.",
        "browseFiles": "Choose a file",
        "description": "Description",
        "descriptionPlaceholder": "Describe your store in a few lines",
        "dragAndDrop": "Drag and drop an image here",
        "dropHere": "Drop image here",
        "errors": {
          "fileRejected": "This file does not meet the requirements above. Choose another image.",
          "uploadFailed": "The upload failed. Try again."
        },
        "heroHint": "The main image at the top of your app listing.",
        "heroImage": "Cover image",
        "intro": "Your app listing is your store's page in the Frak app, where customers can discover your store.",
        "invalidUrl": "Enter a valid image URL (https://…)",
        "listed": "Show my store in the Frak app",
        "logo": "Logo",
        "or": "or",
        "previewDisabledHint": "Turn on \"Show my store in the Frak app\" to go live.",
        "readOnly": {
          "listed": "Shown",
          "notListed": "Not shown"
        },
        "removeImage": "Remove image",
        "restrictions": {
          "hero": "Formats: PNG, JPEG, WebP, SVG, GIF. At least 800×450 px. Width to height ratio between 4:3 and 2:1. 10 MB maximum.",
          "icon": "Formats: PNG, JPEG, WebP, SVG, GIF. At least 64×64 px. Width to height ratio between 1:2 and 2:1. 10 MB maximum.",
          "logo": "Formats: PNG, JPEG, WebP, SVG, GIF. At least 128×128 px. Width to height ratio between 1:2 and 2:1. 10 MB maximum."
        },
        "title": "App listing",
        "uploaded": "Image uploaded",
        "uploading": "Uploading...",
        "useExisting": "Use an existing image:"
      },
      "newsletter": {
        "description": "Add this link to your newsletter or any marketing e-mail. It opens your store with the Frak sharing window, showing your current campaign rewards, so customers can share and earn right away.",
        "title": "Newsletter sharing link"
      },
      "packageIds": {
        "add": "Add app",
        "addError": "We could not add the app. Try again.",
        "additionalLabel": "App ID",
        "claimed": "This app is already registered to another store. Contact <support>hello@frak-labs.com</support> to sort it out.",
        "description": "Mobile apps that can use your Frak setup. Your app developer gives you the ID.",
        "empty": "No mobile apps yet.",
        "invalid": "Enter an ID like com.mycompany.myapp",
        "manage": "Manage apps",
        "placeholder": {
          "android": "e.g. com.example.myapp",
          "ios": "e.g. 57DZ6Z2235.com.example.MyApp"
        },
        "platform": {
          "android": "Android",
          "ios": "iOS"
        },
        "platformLabel": "System",
        "remove": "Remove",
        "title": "Mobile apps"
      },
      "purchaseTracker": {
        "description": "Frak needs to know about your orders to pay rewards. A webhook is a message your shop sends to Frak when an order changes. Connect your shop here.",
        "notRegistered": "Not connected",
        "platform": "Shop software",
        "registered": "Connected",
        "sheet": {
          "change": {
            "confirm": "Change",
            "description": "Order tracking can stop until the new connection is saved.",
            "internalWarning": "You cannot go back from this dashboard. To reconnect, set up the connection again from the Frak app for Shopify or the Frak plugin for WordPress.",
            "title": "Change shop software?"
          },
          "description": "Choose your shop software, then follow the steps. Frak then receives your orders.",
          "instructions": {
            "custom": "For a shop built by a developer. Give this page to your developer, who can follow the <doc>documentation</doc>.",
            "internal1": "Your orders already reach Frak. This usually means you use the Frak app for Shopify or the Frak plugin for WordPress. Nothing to do.",
            "internal2": "If this looks wrong, choose your shop software above to set up the connection yourself.",
            "magento": "To connect Adobe Commerce (Magento 2), ask your developer to install the <doc>frak-labs/magento2-module</doc> package. Then open <italic>Stores > Configuration > Frak > Webhook Secret</italic> in your Magento admin and paste the secret below.",
            "shopify": "In your Shopify admin, open <italic>Settings > Notifications > Webhook</italic>. Create a webhook for the <italic>Order Updated</italic> event and paste the URL below. Shopify then shows a signing key at the bottom of the webhooks list. Paste that key in the field below, then click Connect.",
            "woocommerce": "In your WordPress admin, open <italic>WooCommerce > Settings > Advanced > Webhooks</italic>. Create a webhook with the topic <italic>Order Updated</italic>. Paste the URL and the secret below, then click Connect."
          },
          "platformTitle": "Shop software",
          "platforms": {
            "custom": "Other",
            "internal": "Frak app or plugin",
            "magento": "Magento",
            "shopify": "Shopify",
            "woocommerce": "WooCommerce"
          },
          "register": "Connect",
          "registerHint": "Once the URL and secret are in your shop, click Connect. Keep this panel open until then.",
          "secretLabel": "Secret",
          "shopify": {
            "keyLabel": "Signing key",
            "keyPlaceholder": "Copy the signing key shown at the bottom of the webhooks list in your Shopify admin",
            "missingKey": "Paste the signing key from Shopify"
          },
          "stats": {
            "firstPurchase": "First order",
            "lastPurchase": "Last order",
            "lastUpdate": "Last update",
            "none": "None yet",
            "title": "Figures"
          },
          "update": "Save changes",
          "urlLabel": "URL"
        },
        "status": "Status",
        "title": "Order tracking",
        "tracked": "Orders tracked",
        "update": "Edit connection"
      },
      "saveAll": "Save all changes",
      "saveError": "Some changes could not be saved. Check the fields and try again.",
      "tabs": {
        "affiliate": "Affiliation",
        "explorer": "App listing",
        "identity": "Appearance",
        "integration": "Connections",
        "team": "Team"
      },
      "team": {
        "add": {
          "addedSuccess": "{{email}} was added to the team",
          "description": "Add an admin by e-mail or by Frak wallet address. If they have no Frak account yet, we e-mail them an invitation.",
          "emailInvalid": "Enter a valid e-mail address",
          "emailLabel": "E-mail address",
          "emailPlaceholder": "name@company.com",
          "error": "We could not add the admin. Try again.",
          "invalid": "This is not a wallet address. It starts with 0x.",
          "invitedSuccess": "Invitation sent to {{email}}",
          "label": "Frak wallet address (starts with 0x)",
          "modeEmail": "E-mail",
          "modeWallet": "Frak wallet",
          "placeholder": "0x…",
          "submit": "Add team member",
          "title": "Add a team member"
        },
        "addMember": "Add a team member",
        "headers": {
          "action": "Action",
          "role": "Role",
          "wallet": "Member"
        },
        "invited": "Invitation sent",
        "me": "You:",
        "removalsHint": "Removals apply when you save.",
        "removeMember": "Remove team member",
        "resendError": "We could not resend the invitation. Try again.",
        "resendInvite": "Resend invitation",
        "resendSuccess": "Invitation resent to {{email}}",
        "roles": {
          "admin": "Admin",
          "owner": "Owner"
        },
        "rolesHint": "Owners and admins can both manage the store and its team. An owner cannot be removed here.",
        "saveAll": "Save all changes",
        "saveError": "We could not save some changes. Try again.",
        "undoRemove": "Undo removal",
        "walletlessMember": "Member (e-mail only)"
      },
      "title": "Edit your store"
    },
    "platformAdmin": {
      "readOnlyBanner": "Read-only view. You can't make changes.",
      "readOnlySectionTitle": "Read-only stores",
      "readOnlyTag": "Read-only"
    },
    "push": {
      "create": {
        "audience": {
          "countError": "Couldn't count the members who match this audience.",
          "description": "Choose which members should receive this notification.",
          "matched": "Members who match: <0>{{total}}</0>",
          "title": "Audience"
        },
        "campaign": {
          "hint": "A name for your own reference. Members do not see it.",
          "label": "Internal name",
          "maxLength": "The internal name can't exceed 100 characters",
          "minLength": "The internal name requires at least 5 characters",
          "placeholder": "E.g. Summer offer",
          "required": "Internal name is required"
        },
        "charCount": "{{current}} / {{max}} characters",
        "close": "Close",
        "content": {
          "description": "Write the notification your members will receive.",
          "image": {
            "hint": "Optional. Shown in the notification when the device supports it.",
            "label": "Image link",
            "placeholder": "https://..."
          },
          "launchUrl": {
            "hint": "Optional. The page opened when a member taps the notification. If empty, the Frak app opens.",
            "label": "Link opened on tap",
            "placeholder": "https://..."
          },
          "message": {
            "label": "Notification message",
            "max": "The message can't exceed 500 characters",
            "min": "The message requires at least 10 characters",
            "placeholder": "Enter notification message",
            "required": "Notification message is required"
          },
          "notificationTitle": {
            "label": "Notification title",
            "max": "The notification title can't exceed 40 characters",
            "min": "The notification title requires at least 8 characters",
            "placeholder": "Enter notification title",
            "required": "Notification title is required"
          },
          "title": "Notification content"
        },
        "leave": {
          "confirm": "Leave",
          "continueEditing": "Keep editing",
          "description": "You started writing a notification. If you leave, what you entered is lost.",
          "title": "Leave this page?"
        },
        "preview": {
          "message": "Your notification message will appear here.",
          "now": "now",
          "title": "Your notification title"
        },
        "publish": "Review and send",
        "review": {
          "audience": "Audience",
          "audienceValue": "{{total}} members",
          "audienceValue_one": "{{total}} member",
          "audienceValue_other": "{{total}} members",
          "continueEditing": "Back to editing",
          "delivery": "Delivery",
          "error": "We could not send the notification. Try again. If it keeps failing, email hello@frak-labs.com.",
          "immediately": "Immediately",
          "irreversible": "Once sent, a notification can't be edited or deleted.",
          "schedule": "Schedule",
          "send": "Send",
          "title": "Review notification"
        },
        "schedule": {
          "date": {
            "label": "Select date"
          },
          "description": "Choose when this notification should be sent.",
          "later": {
            "description": "Choose a date and time to send.",
            "label": "Schedule for later"
          },
          "now": {
            "description": "Sent as soon as you confirm.",
            "label": "Send immediately"
          },
          "required": "Pick a date and time to send",
          "time": {
            "label": "Select time"
          },
          "timezone": "Time zone: {{timezone}}",
          "title": "When to send"
        },
        "title": "Send push notification",
        "update": "Review changes"
      },
      "history": {
        "audience": {
          "all": "All members",
          "members": "{{count}} members",
          "members_one": "{{count}} member",
          "members_other": "{{count}} members"
        },
        "columns": {
          "audience": "Audience",
          "notification": "Notification",
          "scheduledFor": "Date",
          "sentOpened": "Opened / sent",
          "status": "Status"
        },
        "delete": {
          "cancel": "Cancel",
          "confirm": "Delete",
          "description": "Delete “{{title}}”? It will not be sent. This can't be undone.",
          "error": "We could not delete the notification. Try again.",
          "title": "Delete notification"
        },
        "empty": {
          "filtered": "No notification matches these filters.",
          "none": "You have not sent any notification yet."
        },
        "filters": {
          "button": "Filters",
          "reset": "Reset filters"
        },
        "rowMenu": {
          "aria": "Actions for {{title}}",
          "delete": "Delete",
          "edit": "Edit"
        },
        "status": {
          "scheduled": "Scheduled",
          "sent": "Sent"
        }
      },
      "resources": {
        "history": "your notification history"
      }
    },
    "settings": {
      "billing": {
        "actions": {
          "add": "Add invoice information",
          "cancel": "Cancel",
          "close": "Close",
          "edit": "Edit",
          "save": "Save information",
          "saveChanges": "Save changes"
        },
        "admin": {
          "breakdown": {
            "frakFee": "Frak fee (20%)",
            "gifted": "Gifted amount",
            "gross": "Gross amount",
            "hint": "Estimate. Final VAT and fee are computed when the deposit is created.",
            "net": "Net amount",
            "title": "Estimated breakdown",
            "vat": "VAT (20%)",
            "vatExempt": "VAT (exempt outside FR)"
          },
          "country": {
            "error": "Could not save the billing country. Try again.",
            "hint": "Drives VAT on the merchant's budget display and deposit notes. The merchant still has to complete their billing information.",
            "label": "Billing country",
            "save": "Save country"
          },
          "deposit": {
            "description": "Records a deposit and computes VAT and the Frak fee automatically.",
            "submit": "Create deposit",
            "title": "Add deposit note",
            "trigger": "Add deposit"
          },
          "errors": {
            "create": "We could not create the document. Try again.",
            "void": "We could not void the document. Try again."
          },
          "fields": {
            "currency": {
              "autoPlaceholder": "Select a linked deposit first",
              "label": "Currency"
            },
            "documentDate": {
              "label": "Document date"
            },
            "giftedAmount": {
              "hint": "Offered top-up added back to the net amount, to correct a deposit that was computed wrongly.",
              "label": "Gifted amount (optional)",
              "placeholder": "e.g. 200"
            },
            "grossAmount": {
              "label": "Gross amount",
              "placeholder": "e.g. 1200"
            },
            "linkedDeposit": {
              "label": "Linked deposit",
              "placeholder": "Select the deposit this withdrawal reverses"
            },
            "note": {
              "label": "Note (optional)",
              "placeholder": "Internal note"
            },
            "paymentPlatform": {
              "label": "Payment platform",
              "none": "None"
            },
            "rawIban": {
              "hint": "Only a masked reference (country code + last digits) is ever stored or sent.",
              "label": "IBAN",
              "placeholder": "Enter the destination IBAN"
            },
            "remainingBankAmount": {
              "label": "Remaining bank amount",
              "placeholder": "e.g. 400"
            },
            "txHash": {
              "label": "Transaction hash (optional)"
            }
          },
          "panel": {
            "description": "Set the billing country and create deposit notes and withdraw bills for this merchant. Visible to platform admins only.",
            "title": "Platform admin: billing"
          },
          "table": {
            "void": "Void",
            "voidAria": "Void {{reference}}"
          },
          "void": {
            "confirm": "Void document",
            "description": "This will void {{reference}}. Voided documents are kept for records but excluded from the store's billing history.",
            "title": "Void this document?"
          },
          "withdraw": {
            "description": "Records a withdrawal against a linked deposit and computes the pro-rata restitution automatically.",
            "submit": "Create withdrawal",
            "title": "Add withdraw bill",
            "trigger": "Add withdrawal"
          }
        },
        "errors": {
          "save": "We could not save your invoice information. Your changes are still here. Try again."
        },
        "fields": {
          "billingEmail": {
            "label": "Invoice email",
            "placeholder": "youremail@company.com"
          },
          "city": {
            "label": "City",
            "placeholder": "Enter city"
          },
          "companyName": {
            "label": "Company name",
            "placeholder": "Enter company name"
          },
          "country": {
            "label": "Country",
            "placeholder": "Select country"
          },
          "postalCode": {
            "label": "Postal code",
            "placeholder": "Enter postal code"
          },
          "streetAddress": {
            "label": "Street address",
            "placeholder": "Enter street address"
          },
          "vatNumber": {
            "label": "VAT number",
            "placeholder": "Enter VAT number"
          }
        },
        "info": {
          "label": "Invoice information",
          "missing": "Invoice information missing",
          "missingHint": "These details are used to generate your invoices.",
          "subtitle": "Used on all your invoices.",
          "title": "Invoice information"
        },
        "segments": {
          "deposit": "Deposits",
          "invoices": "Invoices"
        },
        "sheet": {
          "addTitle": "Add invoice information",
          "description": "These details will be used to generate all invoices and billing documents.",
          "editTitle": "Edit invoice information"
        },
        "summary": {
          "address": "Address",
          "billingEmail": "Invoice email",
          "companyName": "Company name",
          "country": "Country",
          "vatNumber": "VAT number"
        },
        "table": {
          "amount": "Amount",
          "date": "Date",
          "description": "Description",
          "download": "Download PDF",
          "downloadError": "We could not download the PDF. Try again.",
          "pdf": "PDF",
          "type": "Type"
        },
        "tag": {
          "deposit": "Deposit",
          "paid": "Paid",
          "withdraw": "Withdrawal"
        },
        "validation": {
          "decimal": "Enter a valid decimal amount",
          "email": "Enter a valid email address",
          "required": "This field is required",
          "txHash": "Enter a valid transaction hash (0x…)"
        }
      },
      "currency": {
        "label": "Currency used to display amounts in this dashboard.",
        "options": {
          "eur": "EUR",
          "gbp": "GBP",
          "usd": "USD"
        },
        "title": "Currency"
      },
      "demo": {
        "description": "Shows example data instead of yours, for presentations. Turning it off logs you out.",
        "label": "Demo mode"
      },
      "language": {
        "label": "Choose your preferred language",
        "options": {
          "en": "English",
          "fr": "Français"
        },
        "title": "Language"
      },
      "security": {
        "credentials": {
          "addPassword": "Add a password to also log in with your email.",
          "addPasswordCta": "Add password",
          "connected": "Email verified",
          "description": "The ways you can log in to this account.",
          "emailMismatch": "Use the email of your account.",
          "emailTaken": "This email is already used by another account. Use another email, or log in with that account.",
          "linkWallet": "Link wallet",
          "linkWalletHint": "Needed to withdraw funds and change your spending limit.",
          "password": "Email and password",
          "passwordAdded": "Password added and email verified.",
          "passwordExists": "This account already has a password.",
          "pending": "Email not verified",
          "savePassword": "Save password",
          "title": "How you log in",
          "verifyBanner": {
            "description": "Confirm your email so you can always log back in.",
            "title": "Verify your email address"
          },
          "wallet": "Frak wallet"
        },
        "sessions": {
          "current": "This device",
          "description": "Devices and browsers currently logged in to your account.",
          "emptyDescription": "Devices logged in to your account appear here.",
          "emptyTitle": "No signed-in devices",
          "loadError": "We could not load your devices. Check your connection and try again.",
          "method": {
            "password": "Email and password",
            "shopify": "Shopify",
            "wallet": "Frak wallet"
          },
          "revoke": "Log out",
          "revokeDescription": "This device will need to log in again to access your account.",
          "revokeError": "We could not log out this device. Try again.",
          "revokeTitle": "Log out this device?",
          "title": "Signed-in devices"
        },
        "totp": {
          "confirm": "Confirm",
          "copyCodes": "Copy codes",
          "downloadCodes": "Download as file",
          "enable": "Set up authenticator app",
          "enabled": "Authenticator app is on",
          "manualHint": "Can't scan? Enter this setup key in the app instead:",
          "recoveryHint": "Keep these codes safe. If you lose your phone, each one works once. We won't show them again.",
          "recoveryTitle": "Save your backup codes",
          "scanHint": "Scan this QR code with an authenticator app such as Google Authenticator or Authy, then enter the 6-digit code it shows.",
          "setupError": "We could not start the setup. Try again.",
          "title": "Authenticator app"
        },
        "twoFactor": {
          "description": "Asks for a 6-digit code from an authenticator app on your phone when you log in and for sensitive actions, like publishing a campaign or managing your team.",
          "title": "2-step verification"
        }
      },
      "tabs": {
        "billing": "Billing",
        "usage": "General"
      },
      "wallet": {
        "copy": "Copy address",
        "empty": "No Frak wallet connected.",
        "hint": "Your Frak wallet. Withdrawn funds are sent here.",
        "title": "Frak wallet address"
      }
    },
    "shell": {
      "header": {
        "account": {
          "logout": "Log out",
          "settings": "Settings"
        },
        "addMerchant": "Add a store",
        "breadcrumbLabel": "Breadcrumb",
        "demoBadge": "demo",
        "demoBadgeTitle": "Demo mode is active. Click to manage settings.",
        "export": "Export",
        "myAccount": "My account"
      },
      "nav": {
        "noMerchantHint": "Add a store first"
      },
      "pages": {
        "billing": {
          "nav": "Billing"
        },
        "campaigns": {
          "nav": "Campaigns"
        },
        "campaignsAffiliateReport": {
          "nav": "TakeAds report"
        },
        "campaignsList": {
          "nav": "All campaigns"
        },
        "campaignsOverview": {
          "nav": "Overview"
        },
        "dashboard": {
          "nav": "My stores",
          "title": "My stores"
        },
        "funding": {
          "nav": "Budget"
        },
        "internal": {
          "nav": "Internal"
        },
        "internalBank": {
          "nav": "Bank"
        },
        "internalCodes": {
          "nav": "Referral codes"
        },
        "internalGame": {
          "nav": "Frak Game"
        },
        "internalLookup": {
          "nav": "Lookup"
        },
        "internalSetupCode": {
          "nav": "Setup code"
        },
        "members": {
          "nav": "Members",
          "title": "Members"
        },
        "merchant": {
          "nav": "Store"
        },
        "push": {
          "nav": "Push"
        },
        "pushCreate": {
          "nav": "Create"
        },
        "settings": {
          "nav": "Settings"
        },
        "setupStatus": {
          "nav": "Setup status"
        },
        "wallet": {
          "nav": "Frak wallet"
        }
      },
      "sections": {
        "acquisition": "Acquisition",
        "internal": "Frak",
        "preview": "Preview"
      }
    },
    "welcomePopup": {
      "cta": "Got it",
      "description": "Manage your campaigns and see their results from this dashboard.",
      "title": "Welcome to the Frak dashboard"
    }
  }
}
