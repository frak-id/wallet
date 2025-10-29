# Dashboard Migration Progress

**Date**: October 29, 2025
**Status**: Initial Components Migrated ✅

## ✅ Completed

### Module Structure Created
```
src/module/
├── common/
│   ├── atoms/
│   │   └── demoMode.ts           # Demo mode atom (copied)
│   └── component/
│       ├── Header/               # ✅ Migrated
│       ├── Navigation/           # ✅ Migrated
│       ├── NavigationTop/        # ✅ Migrated
│       ├── NavigationProfile/    # ✅ Migrated
│       ├── MainLayout/           # ✅ Migrated
│       └── DemoModeBadge/        # ✅ Migrated
```

### Components Migrated

#### 1. Header Component
- **From**: Next.js `Link` → **To**: TanStack Router `Link`
- **Location**: `src/module/common/component/Header/`
- **Features**:
  - Logo with link to dashboard
  - NavigationTop integration
  - Fixed header with backdrop blur

#### 2. Navigation Component
- **From**: Next.js `useRouter` → **To**: TanStack Router `useMatchRoute`
- **Location**: `src/module/common/component/Navigation/`
- **Features**:
  - Sidebar navigation with icons
  - Active route highlighting
  - External link support (Wallet)
  - Disabled items
  - Responsive (mobile collapse)

**Navigation Items**:
- Dashboard (Home)
- Campaigns
- Members
- Revenue (disabled)
- Messenger (disabled)
- Wallet (external link)
- Settings
- Help & FAQ (disabled)

#### 3. NavigationTop Component
- **Location**: `src/module/common/component/NavigationTop/`
- **Features**:
  - Demo Mode Badge
  - Refresh Button
  - Navigation Profile

#### 4. NavigationProfile Component
- **From**: Next.js `Link` → **To**: TanStack Router `Link`
- **Location**: `src/module/common/component/NavigationProfile/`
- **Features**:
  - User avatar
  - Account link to settings

#### 5. DemoModeBadge Component
- **From**: Next.js `useRouter` → **To**: TanStack Router `useNavigate`
- **Location**: `src/module/common/component/DemoModeBadge/`
- **Features**:
  - Shows "demo" badge when in demo mode
  - Links to settings

#### 6. MainLayout Component
- **Location**: `src/module/common/component/MainLayout/`
- **Features**:
  - Main content wrapper with proper margins

### Assets Migrated
```
src/assets/icons/
├── Calendar.tsx
├── Cash.tsx
├── Envelope.tsx
├── Gear.tsx
├── Home.tsx
├── Info.tsx
├── Laptop.tsx
├── Message.tsx
├── Notification.tsx
├── Search.tsx
├── Users.tsx
└── Wallet.tsx
```

### Styles Migrated
```
src/styles/
├── global.css          # Global styles
├── colors-app.css      # CSS variables for colors
└── all.css            # Combined styles
```

### Stores Created
```
src/stores/
└── demoModeStore.ts    # Zustand store for demo mode
```

### Routes Created
```
src/routes/
├── __root.tsx          # Root layout with Header + Navigation
├── index.tsx           # Home page
├── dashboard.tsx       # Dashboard page
└── settings.tsx        # Settings page
```

## Key Adaptations

### Next.js → TanStack Router

| Component | Next.js | TanStack Router |
|-----------|---------|-----------------|
| Link | `import Link from "next/link"` | `import { Link } from "@tanstack/react-router"` |
| Navigate | `useRouter().push()` | `useNavigate()({ to: "..." })` |
| Active Route | `usePathname().startsWith()` | `useMatchRoute()({ to: "...", fuzzy: true })` |
| Route Definition | `export default function Page()` | `export const Route = createFileRoute("/...")` |

### Dependencies Added
- ✅ `class-variance-authority` - For `cx()` utility
- ✅ `@tanstack/react-devtools` - For React devtools

## File Structure

```
apps/dashboard-v2/
├── src/
│   ├── assets/           # Icons
│   ├── module/
│   │   └── common/       # Common components & atoms
│   ├── routes/           # TanStack Router routes
│   ├── stores/           # Zustand stores
│   └── styles/           # Global CSS
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## TypeScript Status

✅ **All TypeScript errors resolved!**
- Route tree auto-generated
- Type-safe navigation
- Proper imports

## Next Steps

### Immediate
- [ ] Add more routes (campaigns, members, etc.)
- [ ] Migrate campaign components
- [ ] Migrate product components
- [ ] Migrate member components

### Components to Migrate
- [ ] Forms (CurrencySelector, Label, Select, etc.)
- [ ] Campaign components
- [ ] Product components
- [ ] Member components
- [ ] Settings components

### Hooks to Migrate
- [ ] useConversionRate
- [ ] useGetAdminWallet
- [ ] useHasRoleOnProduct
- [ ] Campaign hooks
- [ ] Product hooks

### Context/Actions to Migrate
- [ ] Auth actions (session)
- [ ] Campaign actions
- [ ] Product actions
- [ ] Member actions

## Testing

```bash
# Development
bun dev  # → http://localhost:30022

# Type checking
bun run typecheck  # ✅ Passing

# Build
bun run build
```

## Notes

- **Module Structure**: Preserved from old dashboard (`module/common/component/`)
- **CSS Modules**: All styles use CSS modules with BEM naming
- **Zustand**: Demo mode store uses Zustand with persist
- **Responsive**: Navigation collapses on mobile (<768px)
- **Icons**: Lucide-react icons + custom SVG components

---

**Migration started**: October 29, 2025
**Status**: Foundation complete, ready for feature migration

