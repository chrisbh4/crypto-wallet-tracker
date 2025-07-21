# Crypto Wallet Tracker with Notifications

A comprehensive Node.js application that monitors pending Ethereum transactions in real-time and sends instant alerts to Telegram and Discord when tracked wallet addresses execute trades involving meme coins.

## 🚀 Features

### Core Monitoring
- 🔗 **WebSocket Connection** to Ethereum via Alchemy or Infura
- 👂 **Real-time Monitoring** of pending transactions
- 🎯 **Wallet Address Filtering** for specific addresses
- 📊 **Detailed Transaction Information** with formatting

### Enhanced Detection
- 🎭 **Meme Coin Filtering** - Detects transactions involving popular meme tokens
- 🔍 **Multi-Pattern Analysis** - Supports ERC-20 transfers, DEX swaps, multi-hop trades
- 🧠 **Smart Transaction Decoding** - Recognizes common DeFi patterns
- 🎪 **Nested Call Detection** - Handles complex multi-call transactions

### Notification System
- 📱 **Telegram Bot Integration** - Rich HTML messages with transaction details
- 💬 **Discord Webhook Support** - Beautiful embed notifications
- 🔄 **Multi-Platform Delivery** - Send to both platforms simultaneously
- 🛡️ **Error Handling & Retry Logic** - Reliable delivery with exponential backoff
- ⚡ **Rate Limiting** - Prevents spam and API limits

### System Reliability
- 🔄 **Automatic Reconnection** with exponential backoff
- 🏥 **Health Monitoring** - Periodic connection health checks
- 📊 **Statistics Tracking** - Monitor performance and hit rates
- 🛑 **Graceful Shutdown** - Clean resource management

## 📁 Project Structure

```
crypto-wallet-tracker/
├── package.json                 # Dependencies and scripts
├── .env                        # Configuration (create from .env.example)
├── .gitignore                  # Git ignore patterns
├── README.md                   # This documentation
│
├── wallet-tracker.js           # Original wallet tracker (with comments)
├── enhanced-wallet-tracker.js  # Complete integration with notifications
│
├── meme-coin-filter.js         # Meme coin detection module
├── test-meme-filter.js         # Tests for meme coin filter
├── integration-example.js      # Integration examples
│
├── notification-service.js     # Telegram/Discord notification system
├── test-notifications.js       # Notification system tests
│
└── .env.example               # Environment configuration template
```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-wallet-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and notification settings
   ```

## ⚙️ Configuration

### 1. Ethereum Provider Setup

Add your Alchemy or Infura WebSocket URL to `.env`:

```env
# Alchemy (recommended)
ALCHEMY_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Or Infura (alternative)
INFURA_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID
```

### 2. Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Get your bot token
4. Add the bot to your desired chat/channel
5. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot) in the chat

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

### 3. Discord Webhook Setup

1. Go to your Discord server settings
2. Navigate to **Integrations** → **Webhooks**
3. Create a new webhook for your desired channel
4. Copy the webhook URL

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abc-xyz
```

### 4. Wallet Configuration

Edit the wallet addresses in your chosen tracker file:

```javascript
// In enhanced-wallet-tracker.js
const ENHANCED_TRACKED_WALLETS = [
    {
        address: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        label: 'Primary Wallet',
        description: 'Main tracking target'
    },
    // Add more wallets...
];
```

## 🚦 Usage

### Quick Start - Enhanced Tracker

Run the complete system with all features:

```bash
npm run enhanced
# or
node enhanced-wallet-tracker.js
```

### Alternative - Basic Tracker

Run the original tracker (console only):

```bash
npm start
# or
node wallet-tracker.js
```

### Testing Notifications

Test your notification setup:

```bash
# Show configuration instructions
node test-notifications.js config

# Send test notification
node test-notifications.js manual

# Run full notification test suite
node test-notifications.js
```

### Testing Meme Coin Filter

Test the meme coin detection:

```bash
node test-meme-filter.js
```

## 📱 Notification Examples

### Telegram Message Format
```
🟢 WALLET TRANSACTION DETECTED 🎭 MEME TOKEN

🔍 Type: ERC-20 Transfer
📥 INCOMING

💰 Amount: 1,000,000,000 SHIB
📍 Tracked Wallet: 0x388C818CA...

📤 From: 0x742d35Cc6634C05...
📥 To: 0x388C818CA8B9251...

⏰ Time: Dec 15, 10:30:45 UTC
⛽ Gas: 25.5 gwei

🔗 View on Etherscan

Hash: 0x1234567890ab...
```

### Discord Embed
Rich embeds with:
- Color-coded by transaction direction (🟢 incoming, 🔴 outgoing)
- Clickable Etherscan links
- Formatted timestamps
- Token amount and gas information
- Wallet labels and descriptions

## 🎛️ Advanced Configuration

### Notification Preferences

```javascript
// Customize alert logic in enhanced-wallet-tracker.js
const shouldAlert = walletMatch && isMemeToken;  // Both conditions required

// Alternative options:
const shouldAlert = walletMatch || isMemeToken;   // Either condition
const shouldAlert = walletMatch;                  // Only wallet matches
const shouldAlert = isMemeToken;                  // Only meme tokens
```

### Meme Coin Management

```javascript
const { addMemeTokenAddress, removeMemeTokenAddress } = require('./meme-coin-filter');

// Add new meme coin
addMemeTokenAddress('0x1234567890123456789012345678901234567890');

// Remove meme coin
removeMemeTokenAddress('0x1234567890123456789012345678901234567890');
```

### Rate Limiting & Retry

```javascript
// Adjust in notification-service.js constructor
this.rateLimitDelay = 2000;  // 2 seconds between notifications
this.retryAttempts = 3;      // 3 retry attempts
this.retryDelay = 1000;      // 1 second base delay
```

## 📊 Monitoring & Statistics

The enhanced tracker displays statistics every 5 minutes:

```
📊 ENHANCED TRACKER STATISTICS
================================
⏱️  Uptime: 2h 15m 30s
📦 Total Transactions Processed: 15,247
🎯 Tracked Wallet Hits: 12
🎭 Meme Token Hits: 8
📱 Notifications Sent: 5
📈 Hit Rate: 0.0787%
================================
```

## 🛠️ Development

### Module Structure

- **`notification-service.js`** - Core notification handling
- **`meme-coin-filter.js`** - Meme token detection logic
- **`enhanced-wallet-tracker.js`** - Complete integrated system
- **`test-*.js`** - Comprehensive test suites

### Adding New Features

1. **New Notification Platforms**: Extend `NotificationService` class
2. **Custom Token Filters**: Modify `meme-coin-filter.js` or create new filters
3. **Enhanced Decoding**: Improve transaction analysis in `decodeTransactionData`

### Error Handling

All modules include comprehensive error handling:
- **Network failures**: Automatic reconnection
- **API errors**: Retry logic with exponential backoff
- **Invalid data**: Graceful degradation
- **Rate limits**: Built-in rate limiting

## 🚨 Troubleshooting

### Common Issues

1. **"Could not connect to any provider"**
   - Check your ALCHEMY_WS_URL or INFURA_WS_URL in `.env`
   - Ensure the API key is valid and has WebSocket access

2. **"Telegram notifications not working"**
   - Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
   - Ensure the bot is added to the chat/channel
   - Check bot permissions

3. **"Discord notifications failing"**
   - Verify DISCORD_WEBHOOK_URL is correct
   - Ensure webhook permissions in Discord
   - Check for webhook deletion

4. **"No transactions detected"**
   - Verify wallet addresses are correct (case-insensitive)
   - Check that wallets are active
   - Review filtering logic

### Debug Mode

For detailed debugging, modify console.log statements or add:

```javascript
// Enable verbose transaction logging
this.logTransactionSummary(tx, walletMatch, isMemeToken, true);
```

### Testing Configuration

```bash
# Test notification setup
node test-notifications.js manual

# Check service status
node -e "
const { NotificationService } = require('./notification-service');
const service = new NotificationService();
console.log(JSON.stringify(service.getStatus(), null, 2));
"

# Test meme coin detection
node test-meme-filter.js
```

## 🔐 Security Notes

- Never commit your `.env` file to version control
- Use environment variables for all sensitive data
- Regularly rotate API keys and bot tokens
- Monitor notification channels for unauthorized access
- Use webhook URLs securely (Discord webhooks can be regenerated)

## 📈 Performance Tips

1. **Optimize Wallet List**: Only track essential addresses
2. **Adjust Rate Limits**: Balance speed vs API limits
3. **Filter Transactions**: Use strict filtering to reduce noise
4. **Monitor Resources**: Watch memory usage during long runs
5. **Connection Health**: Health checks prevent silent failures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Use GitHub Issues for bug reports
- **Features**: Submit feature requests via GitHub
- **Documentation**: Refer to inline code comments for technical details

## 🎯 Roadmap

- [ ] **Token Price Integration** - Add USD values to notifications
- [ ] **Advanced Filtering** - Transaction size, gas price filters
- [ ] **Historical Analysis** - Track wallet behavior over time
- [ ] **Web Dashboard** - Browser-based monitoring interface
- [ ] **Mobile App** - React Native companion app
- [ ] **Multi-Chain Support** - Polygon, BSC, Arbitrum support
