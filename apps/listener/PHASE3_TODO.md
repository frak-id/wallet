# Phase 3 Remaining Work

## Status
- ✅ Listener module copied (50 files)
- ✅ Import paths updated to use `@frak-labs/wallet-shared/*`
- ✅ Dependencies added (class-variance-authority, micromark, vaul, etc.)
- ⚠️  57 typecheck errors remaining (down from 136)

## Missing Modules in wallet-shared

These modules are imported by listener but don't exist in wallet-shared yet:

### Wallet Hooks (not in wallet-shared)
- `wallet/hook/useCloseSession`
- `wallet/hook/useOpenSession`
- `wallet/hook/useInteractionSessionStatus`
- `wallet/hook/usePushInteraction`

### SDK Utils (partially missing)
- `sdk/utils/backup` - needs to be added
- `sdk/utils/i18nMapper` - ✅ EXISTS

### Common Hooks (missing)
- `common/hook/useGetSafeSdkSession`

## Next Steps

1. **Copy missing modules from wallet app to wallet-shared**
   - Extract wallet hooks that listener needs
   - Extract SDK backup utils
   - Extract common hooks

2. **Fix wallet-shared internal imports**
   - Wallet-shared still uses `@/` internally
   - Need to ensure TypeScript can resolve these when imported by listener

3. **Test listener app**
   - Verify build works
   - Test functionality

4. **Clean up**
   - Remove unused imports in listener
   - Verify no circular dependencies
