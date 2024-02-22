# Graphs

This md file contain different flow representing interaction between User, content publisher, the Frak SDK and the Frak Wallet.

### Sequence flow of  registration process

This graph show how the registration process is done with the Frak Wallet

```mermaid
sequenceDiagram
autonumber
actor User as User
participant Wallet as Frak Wallet
participant Storage as Frak.id browser storage
participant WebAuthN as Browser WebhAuthN
participant Blockchain as Blockchain

    Note over User,Blockchain: Create a wallet
    User->>Wallet: Launch wallet creation
    Wallet->>Storage: Get previously used authenticators
    Storage-->>Wallet: `previousAuthenticators[]`
    Wallet->>WebAuthN: Launch registration, excluding `previousAuthenticators[]`
    WebAuthN->>User: Show passkey creation popup
    User->>User: Create new passkey and verify biometry
    User-->>WebAuthN: Here is the created biometry
    WebAuthN-->>Wallet: Created `authenticator` or `error`

    break Error during WebAuthN passkey creation
        Wallet-->>User: Show error message
    end

    Wallet->>Wallet: Extract `publicKey` from `authenticator`
    Wallet->>Wallet: Create smart wallet client for this `publicKey`
    Wallet->>Blockchain: What would be the address for this wallet?
    Blockchain-->>Wallet: After deployment the wallet address would be `wAddress`
    Wallet->>Storage: Add this wallet to<br> the previous authenticators wallet
    Wallet->>User: Wallet created with address `wAddress`
```

### Sequence flow of a wallet recovery process

This graph show how the recovery process is done with the Frak Wallet

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Wallet as Frak Wallet
    participant Storage as Frak.id browser storage
    participant WebAuthN as Browser WebhAuthN
    participant Blockchain as Blockchain

    Note over User,Blockchain: Recover a wallet
    User->>Wallet: Launch wallet recovery
    Wallet->>WebAuthN: Start a signature with no precise authenticator specified
    WebAuthN->>User: Pick the passkey to use<br> from all the one available for this domain
    User->>User: Select a passkey
    User->>User: Perform the signature
    User-->>WebAuthN: Here is the biometry used and the signed message
    WebAuthN-->>Wallet: Here is the `signatureResult` or `error`

    break Error during WebAuthN signature
        Wallet-->>User: Show error message
    end

    Wallet->>Wallet: Extract `authenticatorId` from `signatureResult`
    Wallet->>Storage: Get the authenticator<br> matching `authenticatorId` from `previousAuthenticators`
    Storage-->>Wallet: Here is `authenticator` or `undefined`

    alt Authenticator not found in storage
        Wallet->>Blockchain: Check the Kernel logs to find an validator used with `authenticatorId`
        Blockchain-->>Wallet: Here is the `authenticator` or `undefined`

        break No logs found for `authenticatorId`
            Wallet-->>User: Unable to find your wallet on chain
        end
    end

    Wallet->>Wallet: Extract `publicKey` from the recovered `authenticator`

    Wallet->>Wallet: Create smart wallet client for this `publicKey`
    Wallet->>Blockchain: What would be the address for this wallet?
    Blockchain-->>Wallet: After deployment the wallet address would be `wAddress`
    Wallet->>Storage: Add this wallet to<br> the previous authenticators wallet if not present yet
    Wallet->>User: Recovered wallet with address `wAddress`
```

### Sequence flow of a wallet login process

This graph show how the login on a given authenticator is done with the Frak Wallet

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Wallet as Frak Wallet
    participant Storage as Frak.id browser storage
    participant WebAuthN as Browser WebhAuthN
    participant Blockchain as Blockchain
    
    Note over User,Blockchain: Connect to a specific wallet
    User->>Wallet: What's my previous wallets?
    Wallet->>Storage: Get all the previous authenticator
    Storage-->>Wallet: Here is all the `previousAuthenticators`
    Wallet-->>User: Pick one of the `previousAuthenticators`
    User-->>Wallet: I want to use `authenticator`<br> from the `previousAuthenticators`
    Wallet->>Wallet: Extract `publickKey` and `authenticatorId`<br> from `authenticator`
    Wallet->>WebAuthN: Launch signature allowing only `authenticatorId`
    WebAuthN->>User: Allow the use of `authenticatorId`
    User->>User: Perform the signature
    User-->>WebAuthN: Here is the biometry used and the signed message
    WebAuthN-->>Wallet: Here is the `signatureResult` or `error`

    break Error during WebAuthN signature
        Wallet-->>User: Show error message
    end

    Wallet->>Wallet: Ensure `authenticatorId` match the `signatureResult`

    break Authenticator doesn't match
        Wallet-->>User: Show error message
    end

    Wallet->>Wallet: Create smart wallet client for this `publicKey`
    Wallet->>Blockchain: What would be the address for this wallet?
    Blockchain-->>Wallet: After deployment the wallet address would be `wAddress`
    Wallet->>Storage: Add this wallet to<br> the previous authenticators wallet if not present yet
    Wallet->>User: Recovered wallet with address `wAddress`
```


### Sequence flow of a transaction

This graph show how a transaction is performed with the Frak Wallet

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Wallet as Frak Wallet
    participant Storage as Frak.id browser storage
    participant WebAuthN as Browser WebhAuthN
    participant Pimlico as Pimlico
    participant Blockchain as Blockchain

    Note over User,Blockchain: Launch a transaction
    User->>Wallet: I want to launch the `transaction`
    Wallet->>Storage: Get the current authenticator
    Storage-->>Wallet: Here is the `currentAuthenticator`<br> and associated `smartWallet`

    break No current authenticator
        Wallet-->>User: Need to register or login
    end

    Wallet->>Wallet: Format the `transaction` to be executable by the `smartWallet`
    Wallet->>Wallet: Prepare an initial user operation bundle<br> with a webauthn dummy signature
    Wallet->>Pimlico: Get fees and paymaster data
    Pimlico-->>Wallet: Here is the final `userOperation` without `signature`
    Wallet->>WebAuthN: Launch signature of `userOperation.hash`<br> allowing only `currentAuthenticator`
    WebAuthN->>User: Allow the use of `authenticatorId`
    User->>User: Perform the signature
    User-->>WebAuthN: Here is the biometry used and the signed message
    WebAuthN-->>Wallet: Here is the `signatureResult` or `error`

    break Error during WebAuthN signature
        Wallet-->>User: Show error message
    end

    Wallet->>Wallet: Extract all the WebAuthN data from `signatureResult`
    Wallet->>Wallet: Pack all the signature data and add it to the `userOperation`
    Wallet->>Pimlico: Execute the `userOperation`
    Pimlico-->>Wallet: User operation sent, here is the `userOperationHash`
    Wallet-->>User: Transaction sent with success with `userOperationHash`

    Wallet->>Pimlico: Wait for `userOperationHash` finalisation
    Pimlico->>Pimlico: Bundle the user operation<br> and send it onchain
    Pimlico->>Blockchain: Send all the bundled user operations
    Blockchain-->>Pimlico: Here is the `txHash`
    Pimlico->>Wallet: The `userOperation` was sent on `txHash`

    Wallet->>Blockchain: Wait for `txHash` to be confirmed
    Blockchain-->>Wallet: The transaction is finalised and confirmed by 4 blocks
    Wallet-->>User: Your transaction has reached his final state<br> and was bundled in `txHash`
```

### Sequence flow of an article unlock

This diagram represent the sequence flow during an article unlock from a content provider

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Content as Content Publisher
    participant SDK as Frak SDK
    participant Wallet as Frak Wallet
    participant Blockchain as Blockchain

    Note over User,Blockchain: Flow with existing wallet
    User->>Content: Load publisher website
    Content->>SDK: Init SDK (send config data)
    SDK->>SDK: Create secure iframe for Frak Wallet communication
    SDK-->>Content: SDK initialised and ready
    User->>Content: Opens premium article
    Content->>SDK: Check if article is unlocked
    SDK->>Wallet: Get current wallet infos
    Wallet-->>Content: Return secured unlock informations
    break Article already unlocked
        Note over User,Content: All the secure data about the unlock <br>process is available for the publisher
        Content-->>User: Provide unlocked article
    end
    Note over User,Blockchain: We enter the proper unlock flow here
    Content->>SDK: Get article prices
    SDK->>Wallet: Get prices and states for current wallet
    Wallet-->>Content: Prices for the wallet with avalability state
    Content-->>User: Display unlock options with prices
    User->>Content: Select unlock option
    Content->>SDK: Generate secure unlock url 
    SDK-->>Content: Redirection url to perform the unlock
    Content-->>User: Redirect URL you should <br> go to unlock article
    User->>Wallet: Go to redirect url
    Wallet->>Wallet: Parse secured params
    Wallet-->>User: Display transaction informations
    User->>Wallet: Validate transaction via biometry
    Wallet->>Wallet: Bundle all the params into a transaction
    Wallet->>Blockchain: Send transaction
    Blockchain-->>Wallet: Transaction in the mempool
    Wallet->>Content: Go to the article with a new state
    Content->>SDK: Listen to the transaction state 
    loop Until Transaction Mined
        SDK->>Blockchain: Check tx state
        Blockchain-->>SDK: Updated tx state
        SDK-->>Content: Update current article
    end
    Content-->>User: Provide unlocked article
```