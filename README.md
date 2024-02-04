# Frak-Ecosystem ERC-4337 POC

This repository contains a Proof of Concept (POC) that demonstrates the potential unlocked by ERC-4337 within the Frak-Ecosystem. 

It showcases the future of paywalls across various Web2 spectrums through secure and transparent Web3 technologies like account abstraction, paymasters, and more.

Try it directly here: [poc-wallet.frak.id](https://poc-wallet.frak.id).

## Overview

This POC enables users to quickly create a wallet, unlock access to premium newspaper articles, and read them in seconds using the advancements of ERC-4337. 
It's built on the Mumbai blockchain (polygon testnet) and utilizes a range of cutting-edge libraries and frameworks to demonstrate the integration of Web3 technologies into Web2 interfaces.

### Features

- Instant wallet creation via account abstraction.
- Gas fees sponsoring via pimlico paymaster.
- Secure and transparent access to premium content.
- Built with Domain-Driven Design (DDD) architecture.
- Utilizes modern JavaScript and Web3 libraries for an enhanced development experience.

## Folder Architecture Overview

The project is structured to support a modular and scalable architecture, incorporating Domain-Driven Design (DDD) principles and Infrastructure as Code (IaC) for efficient deployment and management. Below is a detailed explanation of the directory structure:

- `src/app/`: Main Next.js entry point, encompassing all routing logic and pages. It orchestrates user navigation throughout the application.
- 
- `src/types/`: All the shared types between the client and server, ensuring type safety and consistency across the application.

- `src/module/`: Organized by domains, each representing a specific area of functionality within the application. For each domain (e.g., `wallet`, `login`), the structure includes:
    - `hook/`: React hooks specific to the domain, encapsulating logic and side effects.
    - `component/`: React components related to the domain, constructing the user interface.
    - `store/`: State management for the domain, handling relevant application state.
    - `provider/`: Context providers for the domain, allowing state and functionality to be accessed globally.
    - `style/`: CSS or styled components for the domain, defining visual appearance.

- `src/context/`: Manages global context and server-side logic, structured per domain with:
    - `action/`: Server-side actions for the domain, such as database operations or API calls.
    - `dto/`: Data Transfer Objects (DTOs) for structuring data exchanged with the server.
    - `repository/`: Repository patterns for abstracting data access and manipulation.

- `public/`: Contains public static assets like images, fonts, and `robots.txt`, accessible without authentication and served directly by the web server.

- `iac/`: Infrastructure as Code (IaC) setup using Serverless Stack (SST), housing definitions and configurations for cloud infrastructure deployment on AWS.

- `sst.config.ts`: The root SST configuration file, specifying global settings and resource definitions for deploying the application infrastructure.

This architecture not only facilitates separation of concerns and modularity but also ensures scalability and ease of deployment through automated infrastructure management.

## Getting Started

To get started with this POC, you need to have Bun installed on your machine. If you're testing it locally, ensure to create a `.env` file based on the `.env.example` provided.

### Installation

1. Clone the repository and navigate to the project directory.
2. Run `bun install` to install dependencies.

### Running the Development Server

- Execute `bun dev` to start the development server.

## Built With

- [Bun](https://bun.sh/) - The JS toolkit for maximum efficiency.
- [NextJS](https://nextjs.org/) - The React framework for server-side rendering.
- [Biome](https://biomejs.dev/) - For ultra-fast linting/formatting.
- [TanStack Query](https://tanstack.com/) - For efficient data fetching and async state management.
- [Wagmi 2.0](https://wagmi.sh/) - For Ethereum hooks.
- [Viem 2.0](https://viem.sh/) - For blockchain communication.
- [Permissionless](https://github.com/pimlicolabs/permissionless.js) - For account abstraction (ERC-4337) SDK.
- [Kernel SDK](https://github.com/zerodevapp/sdk) - For smart wallet compatibility.
- [Lucid](https://lucide.dev/) - For beautiful icons.

### Infrastructure

- [SST](https://sst.dev/): Simple Infrastructure as Code (IaC) on AWS.
- [OpenNext](https://open-next.js.org/): By SST team, for easy NextJS SSR outside of Vercel.
- [Pimlico](https://www.pimlico.io/): For Paymaster and bundler operations.
- [ZeroDev](https://zerodev.app/): For smart account solutions.

## Articles on Account Abstraction

To gain a deeper understanding of account abstraction and its impact on the Web3 ecosystem, consider exploring the following articles:

- [Understanding ERC-4337: Account Abstraction](https://ethereum.org/en/developers/docs/standards/account-abstraction/)
- [The Future of Ethereum Wallets: Account Abstraction](https://blog.ethereum.org/2021/02/04/account-abstraction/)
- [ERC-4337: Simplifying User Experience in Ethereum](https://medium.com/ethereum-foundation/erc-4337-account-abstraction-7a987039c7d9)

## Contributing

We welcome contributions! Please read our contributing guidelines before submitting pull requests to the project.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
