# Frak SDK Components Demo (React + TanStack Router)

This is a demonstration application showcasing the Frak SDK components and providing an interactive configuration wizard for SDK setup.

## Features

- **Landing Page**: Interactive component showcase with live SDK component previews
- **Configuration Wizard**: Multi-step form to generate SDK initialization code
  - Base Configuration: Set app name, language, currency, logo, and homepage
  - Customization: Add custom CSS and view live preview
  - Code Generation: Copy generated configuration code

## Tech Stack

- **React 19** with TypeScript
- **TanStack Router** for file-based routing
- **Zustand** for state management with localStorage persistence
- **react-i18next** for internationalization (English & French)
- **react-hook-form** for form validation
- **CSS Modules** with Lightning CSS
- **Vite** for build tooling

## Getting Started

### Install Dependencies

```bash
bun install
```

### Development

```bash
bun run dev
```

The app will be available at `http://localhost:3014`

### Build

```bash
bun run build
```

### Preview Production Build

```bash
bun run preview
```

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx      # Root layout with providers
│   ├── index.tsx       # Landing page
│   └── configuration.tsx # Configuration wizard
├── components/
│   ├── landing/        # Landing page components
│   ├── configuration/  # Wizard components
│   └── common/         # Shared components (ErrorBoundary)
├── stores/             # Zustand stores
│   ├── configStore.ts  # SDK configuration state
│   └── wizardStore.ts  # Wizard step state
├── hooks/              # Custom React hooks
│   └── useConfigCode.ts # Generate cleaned config code
├── utils/              # Utility functions
│   ├── configTransform.ts # Config cleanup utilities
│   ├── languages.ts    # Language options
│   └── currencies.ts   # Currency options
├── i18n/               # Internationalization
│   ├── config.ts       # i18next setup
│   └── locales/        # Translation files
└── styles/             # Global styles
```

## State Management

The app uses Zustand with persist middleware for state management:

- **configStore**: Manages SDK configuration (metadata, customizations)
- **wizardStore**: Manages wizard navigation (current step)

Both stores persist to localStorage with the prefix `frak-example-`.

## Internationalization

The app supports English and French with automatic language detection. Translations are managed with react-i18next.

## Code Quality

- **Linting**: `bun run lint`
- **Formatting**: `bun run format`
- **Type Checking**: `bun run typecheck`

## License

MIT
