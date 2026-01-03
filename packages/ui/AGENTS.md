# packages/ui

Radix-based component library. Generic, reusable across all apps.

## Structure

```
├── component/        # UI components (21 components)
│   ├── AlertDialog/
│   ├── Button/
│   ├── Dialog/
│   ├── Input/
│   ├── Popover/
│   └── ...
├── hook/             # Shared hooks (6 hooks)
├── icons/            # SVG icons as React components (12 icons)
├── styles/           # Global styles, variables
├── types/            # Shared types
└── utils/            # UI utilities (22 files)
```

## Where to Look

| Task | Location |
|------|----------|
| Add component | `component/{ComponentName}/` |
| Modify icons | `icons/` |
| Shared hooks | `hook/` |
| CSS variables | `styles/` |

## Conventions

- **Radix primitives**: All components wrap Radix UI
- **CSS Modules**: Each component has `.module.css`
- **Named exports**: Export from component index
- **Compound components**: Use dot notation (`Dialog.Content`)

## Component Pattern

```
component/
└── Button/
    ├── index.ts        # Exports
    ├── Button.tsx      # Component
    └── Button.module.css  # Styles
```

## Anti-Patterns

- Tailwind classes (CSS Modules only)
- Inline styles
- App-specific logic (keep generic)
- Default exports

## Testing

- Tests in `tests/` directory
- Focus on interaction behavior
- Use Radix testing patterns

## Notes

- 95 TS/TSX files
- Used across all frontend apps
- ⚠️ AlertDialog also exists in wallet-shared (duplication)
