# RPC Usage Examples

This document provides concrete examples of how to use the `@frak-labs/rpc` package.

## Client-Side (SDK) Examples

### Basic Setup

```typescript
import { createRpcClient } from '@frak-labs/rpc'

// Create the client (assuming iframe communication)
const iframe = document.getElementById('frak-wallet-iframe') as HTMLIFrameElement
const client = createRpcClient({
  transport: window,
  targetOrigin: 'https://wallet.frak.id'
})

// Always connect before making requests
await client.connect()
```

### Promise-Based Requests (One-Shot)

```typescript
// Send an interaction
const result = await client.request(
  'frak_sendInteraction',
  '0x1234...', // productId
  { type: 'view', data: '...' }, // interaction
  '0xabcd...' // optional signature
)

console.log('Interaction result:', result)
// { status: 'success', hash: '0x...' }

// Get product information
const productInfo = await client.request('frak_getProductInformation')
console.log('Product info:', productInfo)
// { productId: '0x...', hasActiveCampaign: true }

// Open SSO
const ssoResult = await client.request(
  'frak_sso',
  { redirectUrl: 'https://example.com/callback' },
  'My App',
  'custom-css-string'
)
console.log('SSO token:', ssoResult.token)
```

### Streaming Requests (Multiple Emissions)

```typescript
// Listen to wallet status updates
const statusStream = client.stream('frak_listenToWalletStatus')

for await (const status of statusStream) {
  console.log('Wallet status update:', status)

  if (status.key === 'connecting') {
    console.log('Wallet is connecting...')
  } else if (status.key === 'connected') {
    console.log('Connected to wallet:', status.wallet)
    // You might want to break here if you only need one status
    break
  } else if (status.key === 'not-connected') {
    console.log('Wallet not connected')
  }
}

console.log('Stream ended')
```

### Error Handling

```typescript
import { RpcErrorCodes } from '@frak-labs/rpc'

try {
  const result = await client.request(
    'frak_sendInteraction',
    productId,
    interaction
  )
  console.log('Success:', result)
} catch (error) {
  // Check error code
  if ('code' in error) {
    switch (error.code) {
      case RpcErrorCodes.userRejected:
        console.log('User rejected the request')
        break
      case RpcErrorCodes.invalidParams:
        console.error('Invalid parameters:', error.message)
        break
      case RpcErrorCodes.clientNotConnected:
        console.error('Client not connected, reconnecting...')
        await client.connect()
        break
      default:
        console.error('RPC error:', error.message)
    }
  } else {
    console.error('Unknown error:', error)
  }
}
```

### Cleanup

```typescript
// Always cleanup when done
client.cleanup()
```

## Wallet-Side (Listener) Examples

### Basic Setup

```typescript
import { createRpcListener } from '@frak-labs/rpc'

const listener = createRpcListener({
  transport: window,
  allowedOrigins: [
    'https://example.com',
    'https://app.example.com'
  ]
})
```

### Promise Handlers (One-Shot Responses)

```typescript
// Handle interaction requests
listener.handle('frak_sendInteraction', async (params, context) => {
  const [productId, interaction, signature] = params

  console.log('Received interaction from:', context.origin)
  console.log('Product ID:', productId)
  console.log('Interaction:', interaction)

  // Process the interaction
  try {
    const hash = await processInteraction(productId, interaction, signature)

    return {
      status: 'success',
      hash
    }
  } catch (error) {
    return {
      status: 'error'
    }
  }
})

// Handle product info requests
listener.handle('frak_getProductInformation', async (params, context) => {
  // params is undefined for this method
  const productId = getCurrentProductId()
  const hasActiveCampaign = await checkActiveCampaigns(productId)

  return {
    productId,
    hasActiveCampaign
  }
})

// Handle SSO requests
listener.handle('frak_sso', async (params, context) => {
  const [ssoParams, name, customCss] = params

  // Open SSO flow
  const token = await openSsoFlow(ssoParams, name, customCss)

  return {
    token
  }
})
```

### Stream Handlers (Multiple Emissions)

```typescript
// Handle wallet status subscription
listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
  console.log('Client subscribed to wallet status from:', context.origin)

  // Emit initial status
  emit({ key: 'connecting' })

  // Subscribe to wallet state changes
  const unsubscribe = walletState.subscribe((state) => {
    if (state.connected) {
      emit({
        key: 'connected',
        wallet: state.address
      })
    } else {
      emit({
        key: 'not-connected'
      })
    }
  })

  // Optional: return cleanup function
  // This would be called when the stream ends
  return () => {
    console.log('Client unsubscribed from wallet status')
    unsubscribe()
  }
})
```

### Error Handling in Handlers

```typescript
import { FrakRpcError, RpcErrorCodes } from '@frak-labs/rpc'

listener.handle('frak_sendInteraction', async (params, context) => {
  const [productId, interaction, signature] = params

  // Validate parameters
  if (!productId) {
    throw new FrakRpcError(
      RpcErrorCodes.invalidParams,
      'Product ID is required'
    )
  }

  // Check if user is authenticated
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) {
    throw new FrakRpcError(
      RpcErrorCodes.userRejected,
      'User is not authenticated'
    )
  }

  // Process interaction
  try {
    const hash = await processInteraction(productId, interaction, signature)
    return { status: 'success', hash }
  } catch (error) {
    throw new FrakRpcError(
      RpcErrorCodes.internalError,
      'Failed to process interaction',
      error
    )
  }
})
```

### Dynamic Handler Registration

```typescript
// You can register and unregister handlers dynamically
function setupHandlers(user: User) {
  if (user.isAuthenticated) {
    listener.handle('frak_sendInteraction', authenticatedInteractionHandler)
  } else {
    listener.handle('frak_sendInteraction', unauthenticatedInteractionHandler)
  }
}

// Later, unregister a handler
listener.unregister('frak_sendInteraction')

// And register a new one
listener.handle('frak_sendInteraction', newHandler)
```

### Cleanup

```typescript
// Always cleanup when done
listener.cleanup()
```

## React Integration Example (Client-Side)

```typescript
import { useEffect, useState } from 'react'
import { createRpcClient } from '@frak-labs/rpc'
import type { WalletStatusReturnType } from '@frak-labs/rpc'

function useWalletStatus() {
  const [status, setStatus] = useState<WalletStatusReturnType>({ key: 'connecting' })

  useEffect(() => {
    const client = createRpcClient({
      transport: window,
      targetOrigin: 'https://wallet.frak.id'
    })

    let active = true

    async function subscribe() {
      await client.connect()

      const stream = client.stream('frak_listenToWalletStatus')

      for await (const status of stream) {
        if (!active) break
        setStatus(status)
      }
    }

    subscribe()

    return () => {
      active = false
      client.cleanup()
    }
  }, [])

  return status
}

// Usage
function App() {
  const walletStatus = useWalletStatus()

  return (
    <div>
      {walletStatus.key === 'connected' && (
        <p>Connected: {walletStatus.wallet}</p>
      )}
      {walletStatus.key === 'not-connected' && (
        <p>Not connected</p>
      )}
    </div>
  )
}
```

## Message Format (For Reference)

All messages use the same backward-compatible format:

```typescript
{
  id: "1234567890-abc123",       // Unique identifier
  topic: "frak_sendInteraction", // Method name
  data: { /* compressed payload */ }
}
```

This format is maintained for 100% backward compatibility with existing implementations.
