# Graphs

This md file contain different flow representing interaction between User, content publisher, the Frak SDK and the Frak Wallet.

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