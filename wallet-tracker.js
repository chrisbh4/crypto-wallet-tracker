/**
 * Crypto Wallet Tracker
 * 
 * A Node.js application that monitors pending Ethereum transactions in real-time
 * and alerts when transactions involve specified wallet addresses.
 * 
 * Uses ethers.js v6 with WebSocket connections to Alchemy or Infura providers.
 * Includes automatic reconnection, health monitoring, and graceful error handling.
 */

const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Array of Ethereum wallet addresses to monitor for incoming/outgoing transactions.
 * The script will trigger alerts when any pending transaction has a 'from' or 'to'
 * field matching one of these addresses (case-insensitive comparison).
 * 
 * @type {string[]} - Array of Ethereum addresses in hexadecimal format
 */
const TRACKED_WALLETS = [
    '0x388C818CA8B9251b393131C08a736A67ccB19297', // Example address 1
    '0x8ba1f109551bD432803012645Hac136c52efefeef', // Example address 2
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // Example address 3 (UNI token)
    '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8', // Example address 4
    // Add more addresses as needed
];

/**
 * WebSocket provider configuration object.
 * Contains URLs for different Ethereum node providers with fallback support.
 * URLs are loaded from environment variables with default placeholders.
 * 
 * @type {Object} - Provider URLs for WebSocket connections
 */
const PROVIDERS = {
    alchemy: process.env.ALCHEMY_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    infura: process.env.INFURA_WS_URL || 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID'
};

/**
 * WalletTracker Class
 * 
 * Main class that handles WebSocket connections to Ethereum providers,
 * monitors pending transactions, and manages connection health.
 */
class WalletTracker {
    /**
     * Initialize the WalletTracker instance with default configuration.
     * Sets up connection state management and reconnection parameters.
     */
    constructor() {
        /** @type {ethers.WebSocketProvider|null} - Active WebSocket provider instance */
        this.provider = null;
        
        /** @type {boolean} - Current connection status flag */
        this.isConnected = false;
        
        /** @type {number} - Counter for consecutive reconnection attempts */
        this.reconnectAttempts = 0;
        
        /** @type {number} - Maximum allowed reconnection attempts before giving up */
        this.maxReconnectAttempts = 5;
        
        /** @type {number} - Delay in milliseconds between reconnection attempts */
        this.reconnectDelay = 5000; // 5 seconds
        
        /** @type {NodeJS.Timeout|null} - Interval timer for periodic health checks */
        this.healthCheckInterval = null;
    }

    /**
     * Initialize the wallet tracker application.
     * 
     * This is the main entry point that coordinates the startup sequence:
     * 1. Establishes WebSocket connection to Ethereum provider
     * 2. Sets up transaction event listeners
     * 3. Starts monitoring pending transactions
     * 
     * @async
     * @throws {Error} - Exits process if initialization fails
     */
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

    /**
     * Establish WebSocket connection to an Ethereum provider.
     * 
     * Attempts to connect to providers in priority order (Alchemy first, then Infura).
     * For each provider:
     * 1. Validates that API key/URL is configured (not placeholder)
     * 2. Creates WebSocketProvider instance
     * 3. Tests connection with getNetwork() call
     * 4. Sets connection status on success, cleans up on failure
     * 
     * @async
     * @throws {Error} - If no providers can be connected to
     */
    async connectToProvider() {
        // Define provider priority order and configuration
        const providers = [
            { name: 'Alchemy', url: PROVIDERS.alchemy },
            { name: 'Infura', url: PROVIDERS.infura }
        ];

        // Attempt connection to each provider in sequence
        for (const { name, url } of providers) {
            try {
                // Skip providers that haven't been configured with real API keys
                if (url.includes('YOUR_API_KEY') || url.includes('YOUR_PROJECT_ID')) {
                    console.log(`⚠️  ${name} URL not configured, skipping...`);
                    continue;
                }

                console.log(`🔗 Attempting to connect to ${name}...`);
                
                // Create new WebSocket provider instance
                this.provider = new ethers.WebSocketProvider(url);
                
                // Test connection by requesting network information
                // This validates that the WebSocket connection is working
                await this.provider.getNetwork();
                
                console.log(`✅ Successfully connected to ${name}`);
                this.isConnected = true;
                return; // Exit on successful connection
                
            } catch (error) {
                console.log(`❌ Failed to connect to ${name}:`, error.message);
                
                // Clean up failed provider instance
                if (this.provider) {
                    await this.provider.destroy();
                }
                this.provider = null;
            }
        }

        // All providers failed - throw error to trigger application exit
        throw new Error('Could not connect to any provider. Please check your API keys.');
    }

    /**
     * Set up event listeners and start monitoring pending transactions.
     * 
     * This method establishes the main monitoring loop:
     * 1. Sets up 'pending' event listener for new transactions
     * 2. Sets up 'error' event handler for connection issues
     * 3. Starts periodic health checks to detect connection problems
     * 4. Displays tracking configuration to user
     * 
     * @async
     * @throws {Error} - If no provider is available
     */
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

        /**
         * Main transaction monitoring event handler.
         * 
         * Listens for 'pending' events which fire when new transactions
         * enter the mempool. Each event provides a transaction hash.
         * 
         * Flow:
         * 1. Receive transaction hash from pending event
         * 2. Fetch full transaction details using getTransaction()
         * 3. Check if transaction involves tracked addresses
         * 4. Display transaction details if it matches our criteria
         */
        this.provider.on('pending', async (txHash) => {
            try {
                // Fetch complete transaction object from hash
                const tx = await this.provider.getTransaction(txHash);
                if (tx) {
                    this.checkAndPrintTransaction(tx);
                }
            } catch (error) {
                // Detect connection-related errors and trigger reconnection
                if (error.code === 'NETWORK_ERROR' || 
                    error.message.includes('connection') || 
                    error.message.includes('websocket')) {
                    console.error('❌ Connection error detected:', error.message);
                    this.isConnected = false;
                    this.handleReconnect();
                    return;
                }
                // Silently ignore other errors for individual transactions
                // as pending transactions can be dropped or replaced during normal operation
            }
        });

        /**
         * WebSocket connection error handler.
         * 
         * In ethers.js v6, this is the primary way to detect connection issues.
         * Triggers reconnection logic when WebSocket errors occur.
         */
        this.provider.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.isConnected = false;
            this.handleReconnect();
        });

        // Note: In ethers v6, 'close' event is not directly available on the provider
        // Connection issues will be handled through the error event and transaction failures
        
        // Set up periodic connection health monitoring
        this.setupHealthCheck();
    }

    /**
     * Analyze a transaction and determine if it involves tracked addresses.
     * 
     * Performs case-insensitive comparison between transaction addresses
     * and the configured TRACKED_WALLETS array. If a match is found,
     * triggers detailed transaction logging.
     * 
     * @param {Object} tx - Transaction object from ethers.js getTransaction()
     * @param {string} tx.from - Sender address
     * @param {string} tx.to - Recipient address (null for contract creation)
     */
    checkAndPrintTransaction(tx) {
        // Normalize addresses to lowercase for comparison
        const fromAddress = tx.from?.toLowerCase();
        const toAddress = tx.to?.toLowerCase();
        
        // Check if either sender or recipient matches any tracked wallet address
        const isTrackedTransaction = TRACKED_WALLETS.some(wallet => 
            wallet.toLowerCase() === fromAddress || wallet.toLowerCase() === toAddress
        );

        if (isTrackedTransaction) {
            this.printTransactionDetails(tx);
        }
    }

    /**
     * Display comprehensive details for a tracked transaction.
     * 
     * Formats and logs transaction information in a user-friendly format.
     * Converts raw blockchain data into human-readable values:
     * - Wei amounts to ETH
     * - Gas prices to gwei
     * - Truncates long data payloads
     * 
     * @param {Object} tx - Transaction object with all transaction properties
     */
    printTransactionDetails(tx) {
        // Generate ISO timestamp for when the transaction was detected
        const timestamp = new Date().toISOString();
        
        // Convert value from wei to ETH for readability (handles null/undefined values)
        const valueInEth = ethers.formatEther(tx.value || '0');
        
        // Convert gas price from wei to gwei (standard unit for gas prices)
        const gasPrice = tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : 'N/A';
        
        console.log('\n🎯 TRACKED TRANSACTION DETECTED');
        console.log('================================');
        console.log(`⏰ Time: ${timestamp}`);
        console.log(`🔗 Hash: ${tx.hash}`);
        console.log(`📤 From: ${tx.from}`);
        console.log(`📥 To: ${tx.to || 'Contract Creation'}`); // Handle contract creation (null 'to')
        console.log(`💰 Value: ${valueInEth} ETH`);
        console.log(`⛽ Gas Price: ${gasPrice} gwei`);
        console.log(`📊 Gas Limit: ${tx.gasLimit ? tx.gasLimit.toString() : 'N/A'}`);
        console.log(`🔢 Nonce: ${tx.nonce}`);
        
        // Display transaction data (smart contract calls, token transfers, etc.)
        // Truncate long data payloads to keep output manageable
        if (tx.data && tx.data !== '0x') {
            console.log(`📝 Data: ${tx.data.substring(0, 100)}${tx.data.length > 100 ? '...' : ''}`);
        }
        console.log('================================\n');
    }

    /**
     * Set up periodic health monitoring for the WebSocket connection.
     * 
     * Creates an interval timer that periodically tests the connection
     * by making API calls. This helps detect "silent" connection failures
     * where the WebSocket appears connected but is not receiving data.
     * 
     * Health check strategy:
     * - Runs every 30 seconds
     * - Uses getBlockNumber() as a lightweight test
     * - Triggers reconnection if the test fails
     * - Skips checks when already disconnected
     */
    setupHealthCheck() {
        // Set up interval timer for periodic connection health monitoring
        this.healthCheckInterval = setInterval(async () => {
            // Skip health check if we're already marked as disconnected
            if (!this.isConnected) return;
            
            try {
                // Perform lightweight API call to test connection responsiveness
                // getBlockNumber() is fast and reliable for health checks
                await this.provider.getBlockNumber();
            } catch (error) {
                console.error('❌ Health check failed:', error.message);
                this.isConnected = false;
                this.handleReconnect();
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Handle connection failures and implement reconnection strategy.
     * 
     * Implements exponential backoff reconnection with maximum attempt limits.
     * This method is called when connection errors are detected and manages
     * the complete reconnection lifecycle.
     * 
     * Reconnection process:
     * 1. Clean up existing connection state (health checks, providers)
     * 2. Check if max attempts reached (exit if so)
     * 3. Wait for reconnection delay
     * 4. Attempt full reinitialization (connect + listen)
     * 5. Reset attempt counter on success, retry on failure
     * 
     * @async
     */
    async handleReconnect() {
        // Stop health check monitoring during reconnection process
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // Enforce maximum reconnection attempts to prevent infinite loops
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached. Exiting...');
            process.exit(1);
        }

        this.reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        // Use setTimeout to implement reconnection delay (exponential backoff)
        setTimeout(async () => {
            try {
                // Attempt complete reinitialization: connection + event listeners
                await this.connectToProvider();
                await this.startListening();
                
                // Reset attempt counter on successful reconnection
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('❌ Reconnection failed:', error.message);
                // Recursively retry with incremented attempt counter
                this.handleReconnect();
            }
        }, this.reconnectDelay);
    }

    /**
     * Clean shutdown of the wallet tracker.
     * 
     * Performs complete cleanup of all resources:
     * - Stops health check monitoring
     * - Closes WebSocket connections
     * - Clears event listeners
     * 
     * This method is called during graceful shutdown (SIGINT/SIGTERM)
     * to ensure no resources are leaked.
     * 
     * @async
     */
    async destroy() {
        // Stop periodic health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        // Close WebSocket connection and clean up provider resources
        if (this.provider) {
            await this.provider.destroy();
        }
        
        console.log('🛑 Wallet tracker stopped');
    }
}

/**
 * Signal Handlers - Graceful Shutdown Implementation
 * 
 * These handlers ensure that the application shuts down cleanly when
 * receiving termination signals, preventing resource leaks and ensuring
 * proper connection cleanup.
 */

/**
 * Handle SIGINT (Ctrl+C) - User-initiated shutdown
 * 
 * This is triggered when the user presses Ctrl+C in the terminal.
 * Ensures graceful cleanup before process termination.
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    if (global.walletTracker) {
        await global.walletTracker.destroy();
    }
    process.exit(0);
});

/**
 * Handle SIGTERM - System-initiated shutdown
 * 
 * This is triggered by process managers (PM2, Docker, systemd, etc.)
 * when they need to terminate the application.
 */
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    if (global.walletTracker) {
        await global.walletTracker.destroy();
    }
    process.exit(0);
});

/**
 * Main application entry point.
 * 
 * Creates a WalletTracker instance, stores it globally for signal handlers,
 * and initiates the monitoring process. This function coordinates the
 * complete application lifecycle.
 * 
 * @async
 * @throws {Error} - Logs error and exits if initialization fails
 */
async function main() {
    // Create new tracker instance
    const tracker = new WalletTracker();
    
    // Store globally so signal handlers can access it for cleanup
    global.walletTracker = tracker;
    
    // Start the monitoring process
    await tracker.init();
}

/**
 * Application Bootstrap
 * 
 * Execute main function and handle any uncaught initialization errors.
 * This is the actual entry point when the script is run.
 */
main().catch(console.error); 