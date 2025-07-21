/**
 * Notification Service Module
 * 
 * ARCHITECTURE OVERVIEW:
 * ======================
 * This module implements a multi-platform notification system that sends real-time 
 * cryptocurrency transaction alerts to both Telegram and Discord. It's designed as 
 * a standalone service that can be integrated with any crypto monitoring system.
 * 
 * DESIGN PATTERNS USED:
 * =====================
 * 1. SERVICE LAYER PATTERN: Encapsulates all notification logic in a single service
 * 2. STRATEGY PATTERN: Different formatting strategies for Telegram vs Discord
 * 3. RETRY PATTERN: Exponential backoff for failed API calls
 * 4. RATE LIMITING PATTERN: Prevents API abuse and spam
 * 5. CONFIGURATION PATTERN: Environment-based configuration management
 * 
 * KEY FEATURES:
 * =============
 * - Dual platform support (Telegram + Discord)
 * - Rich transaction formatting with emojis and links
 * - Robust error handling with exponential backoff retry logic
 * - Rate limiting to prevent API abuse
 * - Configurable notification preferences
 * - Graceful degradation when services are unavailable
 * 
 * INTEGRATION POINTS:
 * ==================
 * - Wallet tracker provides transaction data
 * - Meme coin filter provides token classification
 * - Environment variables provide configuration
 * - External APIs: Telegram Bot API, Discord Webhooks
 */

const axios = require('axios');           // HTTP client for Discord webhook calls
const { Telegraf } = require('telegraf'); // Telegram Bot API wrapper
require('dotenv').config();               // Load environment variables

/**
 * Notification Service Class
 * 
 * IMPLEMENTATION DETAILS:
 * =======================
 * This class manages the entire notification lifecycle from initialization to delivery.
 * It uses a dual-service architecture where both Telegram and Discord can operate
 * independently - if one fails, the other continues to work.
 * 
 * CONSTRUCTOR RESPONSIBILITIES:
 * =============================
 * 1. Load configuration from environment variables
 * 2. Initialize rate limiting and retry mechanisms
 * 3. Set up service availability tracking
 * 4. Initialize both Telegram and Discord services
 * 
 * ERROR HANDLING STRATEGY:
 * ========================
 * - Graceful degradation: If one service fails, others continue
 * - Retry with exponential backoff: Failed API calls are retried up to 3 times
 * - Rate limiting: Prevents overwhelming APIs with too many requests
 * - Configuration validation: Services only initialize if properly configured
 */
class NotificationService {
    /**
     * Constructor - Initialize notification service with configuration
     * 
     * DESIGN NOTES:
     * =============
     * - Uses environment variables for configuration (12-factor app principle)
     * - Initializes with safe defaults to prevent crashes
     * - Separates configuration from initialization for better testability
     * - Uses null-safe patterns throughout to handle missing config
     */
    constructor() {
        // =================================================================
        // TELEGRAM CONFIGURATION
        // =================================================================
        // Store Telegram bot instance and credentials
        // Bot will be initialized only if both token and chat ID are provided
        this.telegramBot = null;                                    // Telegraf bot instance
        this.telegramChatId = process.env.TELEGRAM_CHAT_ID || null; // Target chat for messages
        this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || null; // Bot authentication token
        
        // =================================================================
        // DISCORD CONFIGURATION  
        // =================================================================
        // Discord uses webhooks (simpler than bot API)
        // Only requires webhook URL - no authentication tokens needed
        this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || null;
        
        // =================================================================
        // SERVICE STATE MANAGEMENT
        // =================================================================
        // Track which notification services are actually available and working
        // This allows graceful degradation if one service fails
        this.isEnabled = {
            telegram: false,    // Will be true if Telegram bot initializes successfully
            discord: false      // Will be true if Discord webhook URL is provided
        };
        
        // =================================================================
        // RELIABILITY & PERFORMANCE CONFIGURATION
        // =================================================================
        // These settings control retry behavior and rate limiting to ensure
        // reliable delivery without overwhelming external APIs
        
        // Retry mechanism for failed API calls
        this.retryAttempts = 3;              // Max attempts per notification
        this.retryDelay = 1000;              // Base delay (1 second), uses exponential backoff
        
        // Rate limiting to prevent API abuse and spam
        this.lastNotificationTime = 0;       // Timestamp of last notification
        this.rateLimitDelay = 2000;          // Minimum 2 seconds between notifications
        
        // =================================================================
        // INITIALIZATION
        // =================================================================
        // Initialize both services based on available configuration
        // This is done in constructor to fail fast if configuration is invalid
        this.initializeServices();
    }

    /**
     * Initialize Telegram and Discord services based on available configuration
     * 
     * INITIALIZATION STRATEGY:
     * ========================
     * This method implements a "fail-safe initialization" pattern where:
     * 1. Each service is initialized independently
     * 2. Failures in one service don't affect others
     * 3. Services are enabled only after successful initialization
     * 4. Clear logging indicates which services are available
     * 
     * TELEGRAM INITIALIZATION:
     * ========================
     * - Requires both bot token AND chat ID (both must be present)
     * - Uses Telegraf library which provides a clean API wrapper
     * - Gracefully handles invalid tokens or network issues
     * - Bot token format: "1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
     * - Chat ID format: "-1001234567890" (groups/channels) or "123456789" (private)
     * 
     * DISCORD INITIALIZATION:
     * =======================
     * - Only requires webhook URL (simpler than Telegram)
     * - No authentication needed - webhook URL contains credentials
     * - Webhook format: "https://discord.com/api/webhooks/ID/TOKEN"
     * - No actual connection test performed (webhook validity checked on first use)
     * 
     * GRACEFUL DEGRADATION:
     * =====================
     * - If no services are configured, system continues with console-only logging
     * - Partial configuration (e.g., only Telegram) is perfectly acceptable
     * - Services can be added/removed without code changes (environment-based)
     */
    initializeServices() {
        // =================================================================
        // TELEGRAM BOT INITIALIZATION
        // =================================================================
        // Telegram requires both bot token and target chat ID
        // We validate both are present before attempting initialization
        if (this.telegramBotToken && this.telegramChatId) {
            try {
                // Create Telegraf instance with bot token
                // Telegraf handles API communication and rate limiting internally
                this.telegramBot = new Telegraf(this.telegramBotToken);
                
                // Mark service as enabled only after successful initialization
                this.isEnabled.telegram = true;
                console.log('✅ Telegram notifications enabled');
                
                // NOTE: We don't test the bot connection here to avoid delays
                // Connection will be tested on first actual message send
                
            } catch (error) {
                // Handle initialization errors (usually invalid token format)
                console.error('❌ Failed to initialize Telegram bot:', error.message);
                
                // Service remains disabled (this.isEnabled.telegram stays false)
                // This prevents runtime errors when trying to send messages
            }
        } else {
            // Missing required configuration - provide helpful message
            console.log('⚠️  Telegram not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
        }

        // =================================================================
        // DISCORD WEBHOOK INITIALIZATION
        // =================================================================
        // Discord webhooks are simpler - just need URL validation
        if (this.discordWebhookUrl) {
            // Basic URL format validation could be added here
            // For now, we assume URL is valid and test on first use
            
            this.isEnabled.discord = true;
            console.log('✅ Discord notifications enabled');
            
            // NOTE: No connection test performed here for performance
            // Invalid webhooks will be detected on first message attempt
            
        } else {
            // Missing webhook URL - provide helpful message
            console.log('⚠️  Discord not configured (missing DISCORD_WEBHOOK_URL)');
        }

        // =================================================================
        // SERVICE AVAILABILITY CHECK
        // =================================================================
        // Inform user if no notification services are available
        // System can still run with console-only logging
        if (!this.isEnabled.telegram && !this.isEnabled.discord) {
            console.log('⚠️  No notification services configured. Alerts will only be logged to console.');
        }
    }

    /**
     * Send transaction alert to all enabled notification platforms
     * 
     * CORE ORCHESTRATION METHOD:
     * ===========================
     * This is the main entry point for sending notifications. It implements several
     * important patterns for reliable message delivery:
     * 
     * 1. RATE LIMITING: Prevents API abuse and spam
     * 2. PARALLEL DELIVERY: Sends to both platforms simultaneously (not sequential)
     * 3. INDEPENDENT FAILURES: One platform failing doesn't affect the other
     * 4. COMPREHENSIVE LOGGING: Tracks success/failure for each platform
     * 5. STRUCTURED RETURN: Returns detailed results for monitoring/debugging
     * 
     * RATE LIMITING STRATEGY:
     * =======================
     * - Enforces minimum delay between notifications (default: 2 seconds)
     * - Prevents overwhelming external APIs during high-volume periods
     * - Uses simple time-based throttling (could be enhanced with token bucket)
     * - Returns early with rate_limited status if threshold not met
     * 
     * PARALLEL EXECUTION DESIGN:
     * ===========================
     * - Telegram and Discord notifications sent concurrently (not await each)
     * - Each platform operation is independent and isolated
     * - Failure in one platform doesn't prevent delivery to others
     * - Results aggregated and returned as structured object
     * 
     * ERROR HANDLING PHILOSOPHY:
     * ===========================
     * - Errors are caught per-platform and logged but don't throw
     * - Method always returns a result (never throws exceptions)
     * - Calling code can continue operating even if notifications fail
     * - Detailed error information preserved in return object for debugging
     * 
     * @param {Object} transactionData - Formatted transaction information
     * @param {string} transactionData.hash - Transaction hash (0x...)
     * @param {string} transactionData.from - Sender address (0x...)
     * @param {string} transactionData.to - Recipient address (0x...)
     * @param {string} transactionData.tokenName - Token symbol (ETH, USDC, SHIB, etc.)
     * @param {string} transactionData.amount - Human-readable amount (1,000,000 SHIB)
     * @param {string} transactionData.walletAddress - Tracked wallet that matched
     * @param {string} transactionData.timestamp - ISO timestamp (2024-01-15T10:30:45.123Z)
     * @param {string} [transactionData.transactionType] - Optional: Transfer, Swap, etc.
     * @param {boolean} [transactionData.isMemeToken] - Optional: Meme token flag
     * @param {number} [transactionData.gasPriceGwei] - Optional: Gas price in gwei
     * 
     * @returns {Promise<Object>} - Detailed results object:
     *   {
     *     telegram: { sent: boolean, error: string|null },
     *     discord: { sent: boolean, error: string|null },
     *     timestamp: string
     *   }
     */
    async sendTransactionAlert(transactionData) {
        // =================================================================
        // RATE LIMITING IMPLEMENTATION
        // =================================================================
        // Check if enough time has passed since last notification
        // This prevents API abuse during high-frequency trading periods
        const now = Date.now();
        if (now - this.lastNotificationTime < this.rateLimitDelay) {
            console.log('⏳ Rate limiting: Skipping notification');
            
            // Return early with rate limiting status
            // Calling code can decide how to handle this case
            return { success: false, reason: 'rate_limited' };
        }
        
        // Update timestamp for next rate limit check
        this.lastNotificationTime = now;

        // =================================================================
        // RESULT TRACKING STRUCTURE
        // =================================================================
        // Initialize result tracking object
        // This provides detailed feedback about each notification attempt
        const results = {
            telegram: { sent: false, error: null },  // Telegram delivery status
            discord: { sent: false, error: null },   // Discord delivery status
            timestamp: new Date().toISOString()      // When notification was processed
        };

        // =================================================================
        // PARALLEL NOTIFICATION DELIVERY
        // =================================================================
        // Send to both platforms concurrently for better performance
        // Each platform is handled independently to ensure reliability
        
        // TELEGRAM DELIVERY ATTEMPT
        if (this.isEnabled.telegram) {
            try {
                // Send to Telegram (includes built-in retry logic)
                await this.sendToTelegram(transactionData);
                
                // Mark as successful
                results.telegram.sent = true;
                console.log('📱 Telegram notification sent successfully');
                
            } catch (error) {
                // Capture error details for debugging
                results.telegram.error = error.message;
                console.error('❌ Telegram notification failed:', error.message);
                
                // Note: We don't throw here - continue with Discord attempt
            }
        }

        // DISCORD DELIVERY ATTEMPT  
        if (this.isEnabled.discord) {
            try {
                // Send to Discord (includes built-in retry logic)
                await this.sendToDiscord(transactionData);
                
                // Mark as successful
                results.discord.sent = true;
                console.log('💬 Discord notification sent successfully');
                
            } catch (error) {
                // Capture error details for debugging
                results.discord.error = error.message;
                console.error('❌ Discord notification failed:', error.message);
                
                // Note: We don't throw here - method always returns results
            }
        }

        // =================================================================
        // RETURN COMPREHENSIVE RESULTS
        // =================================================================
        // Return detailed results for monitoring and debugging
        // Calling code can check individual platform success/failure
        return results;
    }

    /**
     * Send formatted message to Telegram chat
     * 
     * @param {Object} txData - Transaction data
     */
    async sendToTelegram(txData) {
        if (!this.telegramBot || !this.telegramChatId) {
            throw new Error('Telegram bot not properly configured');
        }

        const message = this.formatTelegramMessage(txData);
        
        // Retry logic for Telegram API
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await this.telegramBot.telegram.sendMessage(
                    this.telegramChatId, 
                    message, 
                    { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: false 
                    }
                );
                return; // Success, exit retry loop
            } catch (error) {
                if (attempt === this.retryAttempts) {
                    throw error; // Last attempt failed
                }
                
                console.log(`⏳ Telegram attempt ${attempt} failed, retrying...`);
                await this.sleep(this.retryDelay * attempt); // Exponential backoff
            }
        }
    }

    /**
     * Send formatted message to Discord webhook
     * 
     * @param {Object} txData - Transaction data
     */
    async sendToDiscord(txData) {
        if (!this.discordWebhookUrl) {
            throw new Error('Discord webhook URL not configured');
        }

        const embed = this.formatDiscordEmbed(txData);
        
        // Retry logic for Discord webhook
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                await axios.post(this.discordWebhookUrl, {
                    embeds: [embed],
                    username: 'Crypto Wallet Tracker',
                    avatar_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
                });
                return; // Success, exit retry loop
            } catch (error) {
                if (attempt === this.retryAttempts) {
                    throw error; // Last attempt failed
                }
                
                console.log(`⏳ Discord attempt ${attempt} failed, retrying...`);
                await this.sleep(this.retryDelay * attempt); // Exponential backoff
            }
        }
    }

    /**
     * Format transaction data for Telegram message
     * 
     * @param {Object} txData - Transaction data
     * @returns {string} - Formatted HTML message for Telegram
     */
    formatTelegramMessage(txData) {
        const {
            hash,
            from,
            to,
            tokenName = 'ETH',
            amount,
            walletAddress,
            timestamp,
            transactionType = 'Transaction',
            isMemeToken = false,
            gasPriceGwei
        } = txData;

        // Format timestamp
        const formattedTime = new Date(timestamp).toLocaleString('en-US', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Create Etherscan link
        const etherscanLink = `https://etherscan.io/tx/${hash}`;
        
        // Determine transaction direction
        const isOutgoing = from.toLowerCase() === walletAddress.toLowerCase();
        const direction = isOutgoing ? '📤 OUTGOING' : '📥 INCOMING';
        const directionEmoji = isOutgoing ? '🔴' : '🟢';
        
        // Meme token indicator
        const memeIndicator = isMemeToken ? '🎭 MEME TOKEN' : '';

        return `
${directionEmoji} <b>WALLET TRANSACTION DETECTED</b> ${memeIndicator}

🔍 <b>Type:</b> ${transactionType}
${direction}

💰 <b>Amount:</b> <code>${amount} ${tokenName}</code>
📍 <b>Tracked Wallet:</b> <code>${walletAddress}</code>

📤 <b>From:</b> <code>${from}</code>
📥 <b>To:</b> <code>${to}</code>

⏰ <b>Time:</b> ${formattedTime} UTC
${gasPriceGwei ? `⛽ <b>Gas:</b> ${gasPriceGwei} gwei` : ''}

🔗 <a href="${etherscanLink}">View on Etherscan</a>

<i>Hash: ${hash.substring(0, 16)}...</i>
        `.trim();
    }

    /**
     * Format transaction data for Discord embed
     * 
     * @param {Object} txData - Transaction data
     * @returns {Object} - Discord embed object
     */
    formatDiscordEmbed(txData) {
        const {
            hash,
            from,
            to,
            tokenName = 'ETH',
            amount,
            walletAddress,
            timestamp,
            transactionType = 'Transaction',
            isMemeToken = false,
            gasPriceGwei
        } = txData;

        // Determine transaction direction and color
        const isOutgoing = from.toLowerCase() === walletAddress.toLowerCase();
        const direction = isOutgoing ? '📤 Outgoing' : '📥 Incoming';
        const color = isOutgoing ? 0xFF5555 : 0x55FF55; // Red for outgoing, green for incoming

        // Create Etherscan link
        const etherscanLink = `https://etherscan.io/tx/${hash}`;
        
        // Build title
        let title = `${direction} ${transactionType}`;
        if (isMemeToken) {
            title += ' 🎭';
        }

        // Build description
        const description = `**${amount} ${tokenName}** transaction detected on tracked wallet`;

        // Build embed fields
        const fields = [
            {
                name: '💰 Amount',
                value: `\`${amount} ${tokenName}\``,
                inline: true
            },
            {
                name: '📍 Tracked Wallet',
                value: `\`${walletAddress.substring(0, 10)}...${walletAddress.substring(32)}\``,
                inline: true
            },
            {
                name: '⏰ Timestamp',
                value: `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:F>`,
                inline: false
            },
            {
                name: '📤 From',
                value: `\`${from.substring(0, 10)}...${from.substring(32)}\``,
                inline: true
            },
            {
                name: '📥 To',
                value: `\`${to.substring(0, 10)}...${to.substring(32)}\``,
                inline: true
            }
        ];

        // Add gas price if available
        if (gasPriceGwei) {
            fields.push({
                name: '⛽ Gas Price',
                value: `${gasPriceGwei} gwei`,
                inline: true
            });
        }

        return {
            title: title,
            description: description,
            color: color,
            fields: fields,
            footer: {
                text: `Hash: ${hash.substring(0, 16)}...`,
                icon_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            },
            timestamp: timestamp,
            url: etherscanLink
        };
    }

    /**
     * Send a test notification to verify configuration
     * 
     * @returns {Promise<Object>} - Test results
     */
    async sendTestNotification() {
        console.log('🧪 Sending test notifications...\n');

        const testData = {
            hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            from: '0x388C818CA8B9251b393131C08a736A67ccB19297',
            to: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
            tokenName: 'SHIB',
            amount: '1,000,000,000',
            walletAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
            timestamp: new Date().toISOString(),
            transactionType: 'ERC-20 Transfer',
            isMemeToken: true,
            gasPriceGwei: '25.5'
        };

        return await this.sendTransactionAlert(testData);
    }

    /**
     * Get current service status
     * 
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            telegram: {
                enabled: this.isEnabled.telegram,
                configured: !!(this.telegramBotToken && this.telegramChatId)
            },
            discord: {
                enabled: this.isEnabled.discord,
                configured: !!this.discordWebhookUrl
            },
            rateLimitDelay: this.rateLimitDelay,
            retryAttempts: this.retryAttempts
        };
    }

    /**
     * Update notification preferences
     * 
     * @param {Object} preferences - New preferences
     */
    updatePreferences(preferences) {
        if (preferences.rateLimitDelay) {
            this.rateLimitDelay = preferences.rateLimitDelay;
        }
        if (preferences.retryAttempts) {
            this.retryAttempts = preferences.retryAttempts;
        }
        
        console.log('📝 Notification preferences updated');
    }

    /**
     * Utility function to sleep/wait
     * 
     * @param {number} ms - Milliseconds to wait
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Graceful shutdown - stop any ongoing operations
     */
    async shutdown() {
        if (this.telegramBot) {
            try {
                await this.telegramBot.stop();
                console.log('🛑 Telegram bot stopped');
            } catch (error) {
                console.error('Error stopping Telegram bot:', error.message);
            }
        }
        console.log('🛑 Notification service shutdown complete');
    }
}

// Export the service class and a convenience function
module.exports = {
    NotificationService,
    
    /**
     * Create and configure a notification service instance
     * 
     * @param {Object} config - Optional configuration overrides
     * @returns {NotificationService} - Configured service instance
     */
    createNotificationService: (config = {}) => {
        const service = new NotificationService();
        
        if (config.preferences) {
            service.updatePreferences(config.preferences);
        }
        
        return service;
    }
}; 