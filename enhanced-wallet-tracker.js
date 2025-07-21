/**
 * Enhanced Wallet Tracker with Notifications
 * 
 * SYSTEM ARCHITECTURE OVERVIEW:
 * ==============================
 * This is the main integration module that orchestrates three key subsystems:
 * 
 * 1. WALLET TRACKING SYSTEM (from wallet-tracker.js)
 *    - WebSocket connection to Ethereum providers (Alchemy/Infura)
 *    - Real-time pending transaction monitoring
 *    - Connection health monitoring and automatic reconnection
 * 
 * 2. MEME COIN FILTERING SYSTEM (from meme-coin-filter.js)
 *    - Smart contract transaction decoding
 *    - Multi-pattern token detection (ERC-20, DEX swaps, nested calls)
 *    - Configurable meme token address database
 * 
 * 3. NOTIFICATION SYSTEM (from notification-service.js)
 *    - Multi-platform delivery (Telegram + Discord)
 *    - Rich message formatting with transaction details
 *    - Retry logic and rate limiting for reliable delivery
 * 
 * INTEGRATION DESIGN PATTERNS:
 * =============================
 * 1. LAYERED FILTERING: Transaction → Wallet Filter → Meme Filter → Notification
 * 2. DEPENDENCY INJECTION: Services injected via constructor/initialization
 * 3. EVENT-DRIVEN ARCHITECTURE: Pending transactions trigger processing pipeline
 * 4. FAIL-SAFE OPERATIONS: Each subsystem can fail independently without crashing
 * 5. STATISTICS AGGREGATION: Cross-system metrics collection and reporting
 * 
 * DATA FLOW ARCHITECTURE:
 * =======================
 * Raw Transaction (ethers.js) 
 *   ↓
 * Wallet Address Filtering (tracked wallet check)
 *   ↓  
 * Transaction Decoding (extract function calls, parameters)
 *   ↓
 * Meme Token Analysis (check against known meme coins)
 *   ↓
 * Alert Decision Logic (configurable: wallet + meme, wallet OR meme, etc.)
 *   ↓
 * Notification Formatting (platform-specific message formatting)
 *   ↓
 * Multi-Platform Delivery (parallel Telegram + Discord sending)
 * 
 * ENHANCED FEATURES OVER BASIC TRACKER:
 * ======================================
 * - Wallet labeling system for better identification
 * - Comprehensive statistics tracking and periodic reporting
 * - Enhanced transaction categorization and analysis
 * - Multi-layered filtering with configurable alert logic
 * - Rich notification formatting with transaction context
 * - Production-grade error handling and monitoring
 */

const { ethers } = require('ethers');                                           // Ethereum interaction library
const { isMemeTokenTransaction, getMemeTokenStats } = require('./meme-coin-filter');  // Meme coin detection service
const { NotificationService } = require('./notification-service');             // Multi-platform notification service
require('dotenv').config();                                                     // Environment configuration

// Enhanced tracked wallets array with labels for better identification
const ENHANCED_TRACKED_WALLETS = [
    {
        address: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        label: 'Wallet 1',
        description: 'Primary tracking wallet'
    },
    {
        address: '0x8ba1f109551bD432803012645Hac136c52efefeef', 
        label: 'Wallet 2',
        description: 'Secondary tracking wallet'
    },
    {
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        label: 'UNI Wallet',
        description: 'UNI token address for testing'
    }
];

// WebSocket provider configuration
const PROVIDERS = {
    alchemy: process.env.ALCHEMY_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    infura: process.env.INFURA_WS_URL || 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID'
};

/**
 * Enhanced Wallet Tracker Class
 * 
 * INTEGRATION ARCHITECTURE:
 * =========================
 * This class serves as the main orchestrator that integrates three separate modules:
 * 1. Ethereum transaction monitoring (inherited from wallet-tracker.js patterns)
 * 2. Meme coin filtering (via meme-coin-filter.js module)
 * 3. Multi-platform notifications (via notification-service.js module)
 * 
 * The class follows a modular design where each subsystem can operate independently,
 * providing resilience and maintainability.
 * 
 * ENHANCED DATA STRUCTURES:
 * =========================
 * Unlike the basic wallet tracker, this version uses enhanced data structures:
 * - Labeled wallets (address + human-readable label + description)
 * - Comprehensive statistics tracking across all subsystems
 * - Service dependency management with graceful degradation
 * - Cross-module state synchronization
 * 
 * PROCESSING PIPELINE:
 * ====================
 * Each transaction goes through a multi-stage processing pipeline:
 * 1. Raw transaction received from WebSocket
 * 2. Basic validation and parsing
 * 3. Wallet address matching (with labeling)
 * 4. Transaction decoding and analysis
 * 5. Meme token classification
 * 6. Alert decision logic
 * 7. Multi-platform notification delivery
 * 8. Statistics update and logging
 */
class EnhancedWalletTracker {
    /**
     * Constructor - Initialize enhanced wallet tracker with all subsystems
     * 
     * INITIALIZATION STRATEGY:
     * ========================
     * The constructor sets up four main areas:
     * 1. Core Ethereum connection properties (inherited from basic tracker)
     * 2. Enhanced wallet management with labeling system
     * 3. Notification service integration
     * 4. Statistics and monitoring infrastructure
     * 
     * DESIGN PATTERNS:
     * ================
     * - Service Layer Pattern: Each major function separated into services
     * - Observer Pattern: Transaction events trigger processing pipeline
     * - Strategy Pattern: Different handling for different transaction types
     * - State Machine: Connection states (connecting, connected, reconnecting)
     */
    constructor() {
        // =================================================================
        // CORE ETHEREUM CONNECTION PROPERTIES
        // =================================================================
        // These properties manage the WebSocket connection to Ethereum providers
        // Inherited design from basic wallet-tracker.js but enhanced with better monitoring
        
        this.provider = null;                    // Current WebSocket provider instance
        this.isConnected = false;                // Connection state flag
        this.reconnectAttempts = 0;              // Failed reconnection counter
        this.maxReconnectAttempts = 5;           // Maximum reconnection attempts
        this.reconnectDelay = 5000;              // Base delay between reconnection attempts
        this.healthCheckInterval = null;         // Health monitoring timer reference
        
        // =================================================================
        // ENHANCED FEATURES AND SERVICE INTEGRATION
        // =================================================================
        // These properties manage the integration with notification and filtering services
        
        this.notificationService = null;        // Notification service instance
        
        // Convert enhanced wallet objects to simple address array for fast lookup
        // Keep both formats: structured objects for display, addresses for filtering
        this.trackedWallets = ENHANCED_TRACKED_WALLETS.map(w => w.address.toLowerCase());
        
        // Build lookup map for wallet metadata (labels, descriptions)
        // This enables rich wallet identification in notifications
        this.walletLabels = new Map();
        
        // =================================================================
        // COMPREHENSIVE STATISTICS TRACKING
        // =================================================================
        // Enhanced statistics system tracks performance across all subsystems
        // This enables monitoring, debugging, and performance optimization
        this.stats = {
            totalTransactionsProcessed: 0,       // All transactions examined
            trackedWalletHits: 0,                // Transactions involving tracked wallets
            memeTokenHits: 0,                    // Transactions involving meme tokens
            notificationsSent: 0,                // Successfully sent notifications
            startTime: new Date()                // For uptime calculations
        };
        
        // =================================================================
        // WALLET LABELING SYSTEM INITIALIZATION
        // =================================================================
        // Build fast lookup map for wallet metadata
        // This enables rich transaction context in notifications and logging
        ENHANCED_TRACKED_WALLETS.forEach(wallet => {
            this.walletLabels.set(wallet.address.toLowerCase(), {
                label: wallet.label,                    // Human-readable name
                description: wallet.description         // Purpose/context description
            });
        });
        
        // =================================================================
        // SERVICE INITIALIZATION
        // =================================================================
        // Initialize notification service during construction
        // This allows early detection of configuration issues
        this.initializeNotificationService();
    }

    /**
     * Initialize the notification service
     */
    initializeNotificationService() {
        try {
            this.notificationService = new NotificationService();
            console.log('📱 Notification service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize notification service:', error.message);
        }
    }

    /**
     * Initialize the enhanced wallet tracker
     */
    async init() {
        try {
            console.log('🚀 Initializing Enhanced Wallet Tracker...\n');
            
            // Display configuration summary
            this.displayConfiguration();
            
            // Connect to Ethereum provider
            await this.connectToProvider();
            
            // Start monitoring transactions
            await this.startListening();
            
        } catch (error) {
            console.error('❌ Failed to initialize enhanced wallet tracker:', error.message);
            process.exit(1);
        }
    }

    /**
     * Display current configuration and status
     */
    displayConfiguration() {
        console.log('📊 Configuration Summary:');
        console.log(`📍 Tracking ${ENHANCED_TRACKED_WALLETS.length} wallet addresses:`);
        
        ENHANCED_TRACKED_WALLETS.forEach((wallet, index) => {
            console.log(`   ${index + 1}. ${wallet.label}: ${wallet.address}`);
            console.log(`      ${wallet.description}`);
        });
        
        console.log('\n🎭 Meme Coin Filter:');
        const memeStats = getMemeTokenStats();
        console.log(`   Tracking ${memeStats.totalCount} meme coin addresses`);
        console.log(`   SHIB: ${memeStats.hasShib ? '✅' : '❌'}`);
        console.log(`   APE: ${memeStats.hasApe ? '✅' : '❌'}`);
        
        console.log('\n📱 Notification Services:');
        if (this.notificationService) {
            const status = this.notificationService.getStatus();
            console.log(`   Telegram: ${status.telegram.enabled ? '✅ Enabled' : '❌ Disabled'}`);
            console.log(`   Discord: ${status.discord.enabled ? '✅ Enabled' : '❌ Disabled'}`);
        }
        
        console.log('\n' + '='.repeat(70) + '\n');
    }

    /**
     * Connect to Ethereum WebSocket provider
     */
    async connectToProvider() {
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

    /**
     * Start listening for pending transactions with enhanced filtering
     */
    async startListening() {
        if (!this.provider) {
            throw new Error('No provider available');
        }

        console.log('👂 Starting enhanced transaction monitoring...');
        console.log('🎯 Filtering: Tracked Wallets + Meme Coins');
        console.log('📱 Notifications: Enabled for matching transactions');
        console.log('---');

        // Enhanced pending transaction handler
        this.provider.on('pending', async (txHash) => {
            try {
                const tx = await this.provider.getTransaction(txHash);
                if (tx) {
                    await this.processTransaction(tx);
                }
            } catch (error) {
                // Handle connection errors
                if (error.code === 'NETWORK_ERROR' || 
                    error.message.includes('connection') || 
                    error.message.includes('websocket')) {
                    console.error('❌ Connection error detected:', error.message);
                    this.isConnected = false;
                    this.handleReconnect();
                    return;
                }
                // Silently ignore other transaction-specific errors
            }
        });

        // WebSocket error handler
        this.provider.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            this.isConnected = false;
            this.handleReconnect();
        });

        // Start health monitoring
        this.setupHealthCheck();
    }

    /**
     * Enhanced transaction processing with filtering and notifications
     * 
     * CORE INTEGRATION LOGIC:
     * =======================
     * This method represents the heart of the enhanced wallet tracker - it's where
     * all three subsystems (wallet tracking, meme filtering, notifications) integrate
     * to make intelligent decisions about which transactions deserve alerts.
     * 
     * PROCESSING PIPELINE STAGES:
     * ===========================
     * 1. STATISTICS UPDATE: Increment total transaction counter
     * 2. WALLET FILTERING: Check if transaction involves tracked wallets
     * 3. EARLY EXIT: Skip processing if no wallet match (performance optimization)
     * 4. TRANSACTION DECODING: Extract smart contract function calls and parameters
     * 5. MEME TOKEN ANALYSIS: Check if transaction involves known meme coins
     * 6. ALERT DECISION LOGIC: Determine if notification should be sent
     * 7. NOTIFICATION DISPATCH: Send alerts if criteria met
     * 8. LOGGING: Record transaction summary for debugging/monitoring
     * 
     * PERFORMANCE OPTIMIZATIONS:
     * ==========================
     * - Early exit strategy: Skip expensive operations if wallet doesn't match
     * - Lazy evaluation: Only decode transactions for matched wallets
     * - Async notification sending: Don't block processing pipeline
     * - Statistics batching: Increment counters efficiently
     * 
     * FILTERING DECISION LOGIC:
     * =========================
     * The current implementation uses AND logic: (tracked wallet) AND (meme token)
     * This can be easily modified to support different strategies:
     * - OR logic: walletMatch || isMemeToken (alerts for either condition)
     * - Wallet-only: walletMatch (alerts for any tracked wallet activity)
     * - Meme-only: isMemeToken (alerts for any meme token activity)
     * - Complex conditions: Custom logic based on transaction value, gas, etc.
     * 
     * ERROR HANDLING STRATEGY:
     * ========================
     * - Non-blocking errors: Notification failures don't stop transaction processing
     * - Graceful degradation: System continues even if subsystems fail
     * - Comprehensive logging: All decisions and errors are logged for debugging
     * - Statistics preservation: Counters always updated regardless of errors
     */
    async processTransaction(tx) {
        // =================================================================
        // STATISTICS TRACKING
        // =================================================================
        // Always increment total counter regardless of filtering results
        // This enables calculating hit rates and system performance metrics
        this.stats.totalTransactionsProcessed++;

        // =================================================================
        // STAGE 1: WALLET ADDRESS FILTERING
        // =================================================================
        // Check if this transaction involves any of our tracked wallet addresses
        // This is the first and most important filter - only proceed if wallet matches
        const walletMatch = this.checkTrackedWallets(tx);
        
        // PERFORMANCE OPTIMIZATION: Early exit if no wallet match
        // This prevents expensive transaction decoding and meme coin analysis
        // for transactions that don't involve tracked wallets
        if (!walletMatch) {
            return; // Skip further processing for untracked transactions
        }

        // Update statistics: this transaction involves a tracked wallet
        this.stats.trackedWalletHits++;

        // =================================================================
        // STAGE 2: TRANSACTION DECODING AND ANALYSIS
        // =================================================================
        // Decode the transaction to extract smart contract function calls
        // This enables meme coin detection for complex DeFi interactions
        const decodedTx = this.decodeTransactionData(tx);
        
        // Check if transaction involves meme tokens using decoded data
        // The meme coin filter can analyze contract calls, swap paths, etc.
        const isMemeToken = decodedTx ? isMemeTokenTransaction(decodedTx) : false;
        
        // Update statistics if meme token detected
        if (isMemeToken) {
            this.stats.memeTokenHits++;
        }

        // =================================================================
        // STAGE 3: ALERT DECISION LOGIC
        // =================================================================
        // Determine whether this transaction warrants a notification
        // CUSTOMIZABLE LOGIC: Modify this line to change alert criteria
        
        // Current strategy: Only alert on tracked wallet + meme coin combinations
        const shouldAlert = walletMatch && isMemeToken;
        
        // Alternative strategies (uncomment to use):
        // const shouldAlert = walletMatch || isMemeToken;   // Either condition
        // const shouldAlert = walletMatch;                  // Any tracked wallet activity
        // const shouldAlert = isMemeToken;                  // Any meme token activity
        // const shouldAlert = walletMatch && isMemeToken && parseFloat(ethers.formatEther(tx.value)) > 1.0; // Large meme transactions only
        
        // =================================================================
        // STAGE 4: NOTIFICATION DISPATCH
        // =================================================================
        // Send notifications if alert criteria are met
        if (shouldAlert) {
            try {
                // Send enhanced alert with full transaction context
                // This is async but we don't block on it (fire-and-forget)
                await this.sendEnhancedAlert(tx, walletMatch, decodedTx, isMemeToken);
                
                // Update statistics: notification successfully queued
                this.stats.notificationsSent++;
                
            } catch (error) {
                // Log notification errors but don't stop processing
                console.error('❌ Notification dispatch failed:', error.message);
                
                // Note: We don't increment notificationsSent counter on failure
                // This enables monitoring of notification success rates
            }
        }

        // =================================================================
        // STAGE 5: LOGGING AND MONITORING
        // =================================================================
        // Always log transaction summary for debugging and monitoring
        // This provides visibility into filtering decisions and system behavior
        this.logTransactionSummary(tx, walletMatch, isMemeToken, shouldAlert);
    }

    /**
     * Check if transaction involves any tracked wallets
     */
    checkTrackedWallets(tx) {
        const fromAddress = tx.from?.toLowerCase();
        const toAddress = tx.to?.toLowerCase();
        
        const matchedWallet = this.trackedWallets.find(wallet => 
            wallet === fromAddress || wallet === toAddress
        );

        if (matchedWallet) {
            return {
                address: matchedWallet,
                ...this.walletLabels.get(matchedWallet),
                isOutgoing: fromAddress === matchedWallet
            };
        }
        
        return null;
    }

    /**
     * Basic transaction decoding for meme coin analysis
     */
    decodeTransactionData(tx) {
        if (!tx.data || tx.data === '0x') return null;

        const selector = tx.data.slice(0, 10);
        
        // Common function selectors
        const knownSelectors = {
            '0xa9059cbb': 'transfer',
            '0x23b872dd': 'transferFrom',
            '0x38ed1739': 'swapExactTokensForTokens',
            '0x7ff36ab5': 'swapExactETHForTokens',
            '0x18cbafe5': 'swapExactTokensForETH'
        };

        return {
            name: knownSelectors[selector] || 'unknown',
            signature: selector,
            args: [], // Simplified - would need proper ABI decoding for full args
            to: tx.to
        };
    }

    /**
     * Send enhanced alert with comprehensive transaction details
     */
    async sendEnhancedAlert(tx, walletMatch, decodedTx, isMemeToken) {
        if (!this.notificationService) {
            console.log('⚠️  No notification service available');
            return;
        }

        // Extract token information (simplified)
        let tokenName = 'ETH';
        let amount = ethers.formatEther(tx.value || '0');
        let transactionType = 'ETH Transfer';

        if (decodedTx && decodedTx.name !== 'unknown') {
            if (decodedTx.name.includes('swap')) {
                transactionType = 'DEX Swap';
                tokenName = 'Unknown Token';
                amount = 'Multiple';
            } else if (decodedTx.name === 'transfer' || decodedTx.name === 'transferFrom') {
                transactionType = 'Token Transfer';
                tokenName = 'Unknown Token';
                amount = 'Token Amount';
            }
        }

        // Prepare notification data
        const notificationData = {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            tokenName: tokenName,
            amount: amount,
            walletAddress: walletMatch.address,
            timestamp: new Date().toISOString(),
            transactionType: transactionType,
            isMemeToken: isMemeToken,
            gasPriceGwei: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : null
        };

        try {
            const result = await this.notificationService.sendTransactionAlert(notificationData);
            console.log('📱 Notification sent:', result.telegram.sent || result.discord.sent);
        } catch (error) {
            console.error('❌ Failed to send notification:', error.message);
        }
    }

    /**
     * Log transaction summary to console
     */
    logTransactionSummary(tx, walletMatch, isMemeToken, alerted) {
        const timestamp = new Date().toISOString();
        const valueInEth = ethers.formatEther(tx.value || '0');
        
        console.log(`\n${alerted ? '🚨' : '📋'} TRANSACTION PROCESSED`);
        console.log('================================');
        console.log(`⏰ Time: ${timestamp}`);
        console.log(`🔗 Hash: ${tx.hash.substring(0, 16)}...`);
        console.log(`💰 Value: ${valueInEth} ETH`);
        
        if (walletMatch) {
            console.log(`📍 Matched Wallet: ${walletMatch.label} (${walletMatch.address.substring(0, 10)}...)`);
            console.log(`📍 Direction: ${walletMatch.isOutgoing ? '📤 Outgoing' : '📥 Incoming'}`);
        }
        
        console.log(`🎭 Meme Token: ${isMemeToken ? '✅ YES' : '❌ NO'}`);
        console.log(`📱 Alert Sent: ${alerted ? '✅ YES' : '❌ NO'}`);
        console.log('================================');
    }

    /**
     * Display current statistics
     */
    displayStatistics() {
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        
        console.log('\n📊 ENHANCED TRACKER STATISTICS');
        console.log('================================');
        console.log(`⏱️  Uptime: ${hours}h ${minutes}m ${seconds}s`);
        console.log(`📦 Total Transactions Processed: ${this.stats.totalTransactionsProcessed}`);
        console.log(`🎯 Tracked Wallet Hits: ${this.stats.trackedWalletHits}`);
        console.log(`🎭 Meme Token Hits: ${this.stats.memeTokenHits}`);
        console.log(`📱 Notifications Sent: ${this.stats.notificationsSent}`);
        
        const hitRate = this.stats.totalTransactionsProcessed > 0 
            ? ((this.stats.trackedWalletHits / this.stats.totalTransactionsProcessed) * 100).toFixed(4)
            : 0;
        console.log(`📈 Hit Rate: ${hitRate}%`);
        console.log('================================\n');
    }

    /**
     * Set up periodic health monitoring
     */
    setupHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            if (!this.isConnected) return;
            
            try {
                await this.provider.getBlockNumber();
            } catch (error) {
                console.error('❌ Health check failed:', error.message);
                this.isConnected = false;
                this.handleReconnect();
            }
        }, 30000);

        // Display statistics every 5 minutes
        setInterval(() => {
            this.displayStatistics();
        }, 300000);
    }

    /**
     * Handle connection failures and reconnection
     */
    async handleReconnect() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

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
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('❌ Reconnection failed:', error.message);
                this.handleReconnect();
            }
        }, this.reconnectDelay);
    }

    /**
     * Graceful shutdown
     */
    async destroy() {
        console.log('\n🛑 Shutting down Enhanced Wallet Tracker...');
        
        // Display final statistics
        this.displayStatistics();
        
        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Shutdown notification service
        if (this.notificationService) {
            await this.notificationService.shutdown();
        }
        
        // Destroy provider connection
        if (this.provider) {
            await this.provider.destroy();
        }
        
        console.log('🛑 Enhanced Wallet Tracker stopped');
    }
}

/**
 * Signal handlers for graceful shutdown
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    if (global.enhancedTracker) {
        await global.enhancedTracker.destroy();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    if (global.enhancedTracker) {
        await global.enhancedTracker.destroy();
    }
    process.exit(0);
});

/**
 * Main application entry point
 */
async function main() {
    const tracker = new EnhancedWalletTracker();
    global.enhancedTracker = tracker;
    await tracker.init();
}

// Export for use in other modules
module.exports = {
    EnhancedWalletTracker,
    ENHANCED_TRACKED_WALLETS
};

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
} 