# Crypto Wallet Tracker

A Node.js script that monitors pending Ethereum transactions and alerts when transactions involve tracked wallet addresses.

## Features

- 🔗 WebSocket connection to Ethereum via Alchemy or Infura
- 👂 Real-time monitoring of pending transactions
- 🎯 Filters transactions by tracked wallet addresses
- 📊 Displays detailed transaction information
- 🔄 Automatic reconnection with exponential backoff
- 🛑 Graceful shutdown handling

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

### 1. Set up your API keys

Create a `.env` file in the root directory with your API keys:

```env
# Alchemy WebSocket URL (recommended)
# Get your API key from https://dashboard.alchemy.com/
ALCHEMY_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Infura WebSocket URL (alternative)
# Get your project ID from https://infura.io/dashboard
INFURA_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID
```

**Note**: You only need to configure one provider. The script will try Alchemy first, then Infura as a fallback.

### 2. Configure tracked wallet addresses

Edit the `TRACKED_WALLETS` array in `wallet-tracker.js` to include the addresses you want to monitor:

```javascript
const TRACKED_WALLETS = [
    '0x388C818CA8B9251b393131C08a736A67ccB19297', // Your address 1
    '0x8ba1f109551bD432803012645Hac136c52efefeef', // Your address 2
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // Your address 3
    // Add more addresses as needed
];
```

## Usage

Start the wallet tracker:

```bash
npm start
```

or

```bash
node wallet-tracker.js
```

The script will:
1. Connect to your configured WebSocket provider
2. Start listening for pending transactions
3. Print detailed information when transactions involving tracked addresses are detected
4. Automatically reconnect if the connection is lost

## Output Example

When a tracked transaction is detected, you'll see output like this:

```
🎯 TRACKED TRANSACTION DETECTED
================================
⏰ Time: 2024-01-15T10:30:45.123Z
🔗 Hash: 0x1234567890abcdef...
📤 From: 0x388C818CA8B9251b393131C08a736A67ccB19297
📥 To: 0x1f9840a85d5af5bf1d1762f925bdaddc4201f984
💰 Value: 1.5 ETH
⛽ Gas Price: 25.5 gwei
📊 Gas Limit: 21000
🔢 Nonce: 42
📝 Data: 0xa9059cbb000000000000000000000000...
================================
```

## Stopping the Script

To stop the script gracefully:
- Press `Ctrl+C` (SIGINT)
- Or send a SIGTERM signal

The script will clean up connections and exit properly.

## Error Handling

The script includes robust error handling:
- Automatic reconnection with exponential backoff
- Graceful handling of dropped transactions
- Connection timeout handling
- Maximum reconnection attempts (5 by default)

## Customization

You can modify the following constants in `wallet-tracker.js`:

- `TRACKED_WALLETS`: Array of wallet addresses to monitor
- `maxReconnectAttempts`: Maximum number of reconnection attempts (default: 5)
- `reconnectDelay`: Delay between reconnection attempts in milliseconds (default: 5000)

## Requirements

- Node.js 14 or higher
- Alchemy or Infura API key
- Stable internet connection

## Troubleshooting

### Common Issues

1. **Connection failed**: Check your API keys and internet connection
2. **No transactions detected**: Verify your wallet addresses are correct and active
3. **Frequent disconnections**: This is normal for WebSocket connections; the script will automatically reconnect

### Debug Mode

For more verbose logging, you can modify the error handling sections in the code to log additional information.

## License

MIT License
