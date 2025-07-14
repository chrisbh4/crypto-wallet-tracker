const { ethers } = require('ethers');
require('dotenv').config();

// Hardcoded array of wallet addresses to track
const TRACKED_WALLETS = [
    '0x388C818CA8B9251b393131C08a736A67ccB19297', // Example address 1
    '0x8ba1f109551bD432803012645Hac136c52efefeef', // Example address 2
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // Example address 3 (UNI token)
    '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8', // Example address 4
    // Add more addresses as needed
];

// WebSocket provider URLs
const PROVIDERS = {
    alchemy: process.env.ALCHEMY_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    infura: process.env.INFURA_WS_URL || 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID'
};

class WalletTracker {
    constructor() {
        this.provider = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
    }

    async init() {
        try {
            console.log('🚀 Initializing Wallet Tracker...');
            await this.connectToProvider();
            await this.startListening();
        } catch (error) {
            console.error('❌ Failed to initialize wallet tracker:', error.message);
            process.exit(1);
        }
    }

    async connectToProvider() {
        // Try Alchemy first, then Infura
        const providers = [
            { name: 'Alchemy', url: PROVIDERS.alchemy },
            { name: 'Infura', url: PROVIDERS.infura }
        ];

        for (const { name, url } of providers) {
            try {
                if (url.includes('YOUR_API_KEY') || url.includes('YOUR_PROJECT_ID')) {
                    console.log(`⚠️  ${name} URL not configured, skipping...`);
                    continue;
                }

                console.log(`🔗 Attempting to connect to ${name}...`);
                this.provider = new ethers.WebSocketProvider(url);
                
                // Test connection
                await this.provider.getNetwork();
                console.log(`✅ Successfully connected to ${name}`);
                this.isConnected = true;
                return;
            } catch (error) {
                console.log(`❌ Failed to connect to ${name}:`, error.message);
                if (this.provider) {
                    await this.provider.destroy();
                }
                this.provider = null;
            }
        }

        throw new Error('Could not connect to any provider. Please check your API keys.');
    }

    async startListening() {
        if (!this.provider) {
            throw new Error('No provider available');
        }

        console.log('👂 Starting to listen for pending transactions...');
        console.log(`📋 Tracking ${TRACKED_WALLETS.length} wallet addresses:`);
        TRACKED_WALLETS.forEach((address, index) => {
            console.log(`   ${index + 1}. ${address}`);
        });
        console.log('---');

        // Listen for pending transactions
        this.provider.on('pending', async (txHash) => {
            try {
                const tx = await this.provider.getTransaction(txHash);
                if (tx) {
                    this.checkAndPrintTransaction(tx);
                }
            } catch (error) {
                // Silently ignore errors for individual transactions
                // as pending transactions can be dropped or replaced
            }
        });

        // Handle connection errors
        this.provider.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.handleReconnect();
        });

        // Handle connection close
        this.provider.on('close', () => {
            console.log('🔌 WebSocket connection closed');
            this.isConnected = false;
            this.handleReconnect();
        });
    }

    checkAndPrintTransaction(tx) {
        const fromAddress = tx.from?.toLowerCase();
        const toAddress = tx.to?.toLowerCase();
        
        // Check if from or to address matches any tracked wallet
        const isTrackedTransaction = TRACKED_WALLETS.some(wallet => 
            wallet.toLowerCase() === fromAddress || wallet.toLowerCase() === toAddress
        );

        if (isTrackedTransaction) {
            this.printTransactionDetails(tx);
        }
    }

    printTransactionDetails(tx) {
        const timestamp = new Date().toISOString();
        const valueInEth = ethers.formatEther(tx.value || '0');
        const gasPrice = tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : 'N/A';
        
        console.log('\n🎯 TRACKED TRANSACTION DETECTED');
        console.log('================================');
        console.log(`⏰ Time: ${timestamp}`);
        console.log(`🔗 Hash: ${tx.hash}`);
        console.log(`📤 From: ${tx.from}`);
        console.log(`📥 To: ${tx.to || 'Contract Creation'}`);
        console.log(`💰 Value: ${valueInEth} ETH`);
        console.log(`⛽ Gas Price: ${gasPrice} gwei`);
        console.log(`📊 Gas Limit: ${tx.gasLimit ? tx.gasLimit.toString() : 'N/A'}`);
        console.log(`🔢 Nonce: ${tx.nonce}`);
        if (tx.data && tx.data !== '0x') {
            console.log(`📝 Data: ${tx.data.substring(0, 100)}${tx.data.length > 100 ? '...' : ''}`);
        }
        console.log('================================\n');
    }

    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached. Exiting...');
            process.exit(1);
        }

        this.reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(async () => {
            try {
                await this.connectToProvider();
                await this.startListening();
                this.reconnectAttempts = 0; // Reset on successful reconnection
            } catch (error) {
                console.error('❌ Reconnection failed:', error.message);
                this.handleReconnect();
            }
        }, this.reconnectDelay);
    }

    async destroy() {
        if (this.provider) {
            await this.provider.destroy();
        }
        console.log('🛑 Wallet tracker stopped');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    if (global.walletTracker) {
        await global.walletTracker.destroy();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    if (global.walletTracker) {
        await global.walletTracker.destroy();
    }
    process.exit(0);
});

// Start the wallet tracker
async function main() {
    const tracker = new WalletTracker();
    global.walletTracker = tracker;
    await tracker.init();
}

// Run the script
main().catch(console.error); 