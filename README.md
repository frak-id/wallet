# Frak-Ecosystem ERC-4337 POC

This repository contains a Proof of Concept (POC) that demonstrates the potential unlocked by ERC-4337 within the Frak-Ecosystem. 

It showcases the future of paywalls across various Web2 spectrums through secure and transparent Web3 technologies like account abstraction, paymasters, and more.

Try it the wallet directly here: [poc-wallet.frak.id](https://poc-wallet.frak.id).

Try the flow using a newspaper article here: [news-example.frak.id](https://news-example.frak.id/).

Or even, try real life flow by following some article shared via the demo X account here: [Frak Demo account](https://twitter.com/FrakDemo). 

## Overview

This POC enables users to quickly create a wallet, unlock access to premium newspaper articles, and read them in seconds using the advancements of ERC-4337. 
It's built on the Mumbai blockchain (polygon testnet) and utilizes a range of cutting-edge libraries and frameworks to demonstrate the integration of Web3 technologies into Web2 interfaces.

If you are brave enough and have an overview of how it works under the hood, you can check a few sequence flow graph here: [Sequence Flow Graph](https://twitter.com/FrakDemo)

### Features

- Instant wallet creation via account abstraction.
- Gas fees sponsoring via pimlico paymaster.
- Secure and transparent access to premium content.
- Built with Domain-Driven Design (DDD) architecture.
- Utilizes modern JavaScript and Web3 libraries for an enhanced development experience.

## Folder Architecture Overview

The project is built using a monorepo structure to further enhance modularity and scalability, incorporating Domain-Driven Design (DDD) principles and Infrastructure as Code (IaC) for efficient deployment and management. 

This new structure allows for multiple projects, such as POCs and example applications, to coexist within the same repository while maintaining their individual architectures. Below is the revised directory structure:

### Monorepo Structure

- `packages/`: Root directory for all projects within the monorepo, each project contained within its own subdirectory.
  - `wallet/`: The wallet proof of concept (POC), demonstrating the core functionalities.
  - `example/`: An example application interacting with the wallet POC.

- `iac/`: Infrastructure as Code (IaC) setup using Serverless Stack (SST), located at the root of each project within the `packages/` directory. It houses definitions and configurations for cloud infrastructure deployment on AWS.

- `sst.config.ts`: Located at the root of each project within the `packages/` directory, this is the root SST configuration file. It specifies global settings and resource definitions for deploying the project's infrastructure.

Each project within the `packages/` directory follows the same internal architecture, as detailed below:

### Project Structure (Applicable to Both `wallet` and `example`)

- `src/app/`: Main Next.js entry point for the project, encompassing all routing logic and pages. It orchestrates user navigation throughout the application.

- `src/types/`: Holds all shared TypeScript types and interfaces between the client and server for the project, ensuring type safety and consistency across the application.

- `src/module/`: Organized by domains, with each domain representing a specific area of functionality within the project. For each domain (e.g., `wallet`, `login`), the structure includes:
  - `hook/`: React hooks specific to the domain, encapsulating logic and side effects.
  - `component/`: React components related to the domain, used to construct the user interface.
  - `store/`: State management logic for the domain, managing relevant application state.
  - `provider/`: Context providers for the domain, enabling state and functionality to be accessed globally.
  - `style/`: CSS or styled components for the domain, defining its visual appearance.

- `src/context/`: Manages global context and server-side logic for the project, structured per domain with:
  - `action/`: Defines server-side actions for the domain, such as database operations or external API calls.
  - `dto/`: Data Transfer Objects (DTOs) for structuring data exchanged with the server.
  - `repository/`: Repository patterns for abstracting data access and manipulation.

- `public/`: Contains public static assets like images, fonts, accessible without authentication and served directly by the web server.

This architecture not only supports the separation of concerns and modularity but also facilitates scalability and ease of deployment through automated infrastructure management across multiple projects within the monorepo.

## Getting Started

To get started with this POC, you need to have Bun installed on your machine, and have an AWS account setup using AWS CLI. The AWS account will be used to store the config and upload each websites.

### Installation

1. Clone the repository and navigate to the project directory.
2. Run `bun install` to install dependencies.

### Running the Development Server

- Execute `bun dev` to start the development server.

## Built With

- [Bun](https://bun.sh/) - The JS toolkit for maximum efficiency.
- [Kernel SDK](https://github.com/zerodevapp/sdk) - For smart wallet compatibility.
- [Permissionless](https://github.com/pimlicolabs/permissionless.js) - For account abstraction (ERC-4337) SDK.
- [NextJS](https://nextjs.org/) - The React framework for server-side rendering.
- [Biome](https://biomejs.dev/) - For ultra-fast linting/formatting.
- [TanStack Query](https://tanstack.com/) - For efficient data fetching and async state management.
- [Wagmi 2.0](https://wagmi.sh/) - For Ethereum hooks.
- [Viem 2.0](https://viem.sh/) - For blockchain communication.
- [Lucid](https://lucide.dev/) - For beautiful icons.

### Infrastructure

- [SST](https://sst.dev/): Simple Infrastructure as Code (IaC) on AWS.
- [OpenNext](https://open-next.js.org/): By SST team, for easy NextJS SSR outside of Vercel.
- [Pimlico](https://www.pimlico.io/): For Paymaster and bundler operations.
- [ZeroDev](https://zerodev.app/): For smart account solutions.

## Contributing

We welcome contributions! Don't hesitate to submit PR :)

## License

This project is licensed under the GNU GPLv3 License - see the LICENSE file for details.
