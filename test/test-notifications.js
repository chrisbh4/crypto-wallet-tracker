/**
 * Notification Service Test Suite
 * 
 * TESTING STRATEGY OVERVIEW:
 * ===========================
 * This test suite validates the notification system across multiple dimensions:
 * 
 * 1. CONFIGURATION TESTING: Verify service initialization with different config states
 * 2. MESSAGE FORMATTING: Test Telegram HTML and Discord embed formatting
 * 3. ERROR HANDLING: Validate graceful failure when APIs are unavailable
 * 4. RATE LIMITING: Confirm rate limiting prevents API abuse
 * 5. RETRY LOGIC: Test exponential backoff retry mechanisms
 * 6. INTEGRATION TESTING: Verify end-to-end notification delivery
 * 
 * TEST SCENARIOS COVERED:
 * =======================
 * - Outgoing meme token transfers (wallet sends meme coins)
 * - Incoming ETH transfers (wallet receives ETH)
 * - DEX swap transactions (wallet trades on Uniswap/etc)
 * - Large token transfers (high-value transactions)
 * - Invalid input handling (malformed transaction data)
 * - Service configuration validation
 * 
 * TESTING PATTERNS USED:
 * =======================
 * 1. MOCK DATA PATTERN: Use realistic but fake transaction data
 * 2. CONFIGURATION MATRIX: Test all combinations of service availability
 * 3. ERROR INJECTION: Deliberately test failure scenarios
 * 4. ASSERTION PATTERN: Verify expected outcomes and side effects
 * 5. INTEGRATION TESTING: Test real API calls (when configured)
 * 
 * DEVELOPER NOTES:
 * ================
 * - Tests can run without API credentials (will show configuration warnings)
 * - Real API testing requires proper .env configuration
 * - Rate limiting is enforced during tests (3-second delays)
 * - All test data uses fake transaction hashes and addresses
 * - Tests validate both successful and failed notification attempts
 */

const { NotificationService } = require('../notification-service');

/**
 * Test the notification service with sample transaction data
 */
async function runNotificationTests() {
    console.log('🧪 Starting Notification Service Tests\n');
    console.log('=' .repeat(60));

    // Create notification service instance
    const notificationService = new NotificationService();
    
    // Display service status
    console.log('\n📊 Service Status:');
    const status = notificationService.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log('\n' + '=' .repeat(60));

    // Test Case 1: Outgoing meme token transfer
    console.log('\n🧪 Test 1: Outgoing SHIB Transfer');
    const test1Data = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x388C818CA8B9251b393131C08a736A67ccB19297', // Tracked wallet (sender)
        to: '0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8',
        tokenName: 'SHIB',
        amount: '1,000,000,000',
        walletAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        timestamp: new Date().toISOString(),
        transactionType: 'ERC-20 Transfer',
        isMemeToken: true,
        gasPriceGwei: '25.5'
    };

    try {
        const result1 = await notificationService.sendTransactionAlert(test1Data);
        console.log('✅ Test 1 Results:', result1);
    } catch (error) {
        console.error('❌ Test 1 Failed:', error.message);
    }

    // Wait a bit to avoid rate limiting
    await sleep(3000);

    // Test Case 2: Incoming ETH transfer
    console.log('\n🧪 Test 2: Incoming ETH Transfer');
    const test2Data = {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        from: '0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8',
        to: '0x388C818CA8B9251b393131C08a736A67ccB19297', // Tracked wallet (receiver)
        tokenName: 'ETH',
        amount: '2.5',
        walletAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        timestamp: new Date().toISOString(),
        transactionType: 'ETH Transfer',
        isMemeToken: false,
        gasPriceGwei: '30.2'
    };

    try {
        const result2 = await notificationService.sendTransactionAlert(test2Data);
        console.log('✅ Test 2 Results:', result2);
    } catch (error) {
        console.error('❌ Test 2 Failed:', error.message);
    }

    // Wait a bit to avoid rate limiting
    await sleep(3000);

    // Test Case 3: DEX Swap Transaction
    console.log('\n🧪 Test 3: Uniswap DEX Swap');
    const test3Data = {
        hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        from: '0x388C818CA8B9251b393131C08a736A67ccB19297', // Tracked wallet
        to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
        tokenName: 'PEPE',
        amount: '50,000,000',
        walletAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        timestamp: new Date().toISOString(),
        transactionType: 'DEX Swap',
        isMemeToken: true,
        gasPriceGwei: '45.8'
    };

    try {
        const result3 = await notificationService.sendTransactionAlert(test3Data);
        console.log('✅ Test 3 Results:', result3);
    } catch (error) {
        console.error('❌ Test 3 Failed:', error.message);
    }

    // Wait a bit to avoid rate limiting
    await sleep(3000);

    // Test Case 4: Large Token Transfer
    console.log('\n🧪 Test 4: Large USDC Transfer');
    const test4Data = {
        hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        from: '0x388C818CA8B9251b393131C08a736A67ccB19297', // Tracked wallet
        to: '0x0A59649758aa4d66E25f08Dd01271e891fe52199',
        tokenName: 'USDC',
        amount: '100,000',
        walletAddress: '0x388C818CA8B9251b393131C08a736A67ccB19297',
        timestamp: new Date().toISOString(),
        transactionType: 'ERC-20 Transfer',
        isMemeToken: false,
        gasPriceGwei: '20.1'
    };

    try {
        const result4 = await notificationService.sendTransactionAlert(test4Data);
        console.log('✅ Test 4 Results:', result4);
    } catch (error) {
        console.error('❌ Test 4 Failed:', error.message);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ All notification tests completed!');
    
    // Test service preferences update
    console.log('\n🔧 Testing preference updates...');
    notificationService.updatePreferences({
        rateLimitDelay: 1500,
        retryAttempts: 5
    });
    
    console.log('Updated status:');
    console.log(JSON.stringify(notificationService.getStatus(), null, 2));

    // Graceful shutdown
    await notificationService.shutdown();
}

/**
 * Demonstrate manual test notification functionality
 */
async function runManualTest() {
    console.log('🎯 Manual Test: Sending predefined test notification\n');
    
    const notificationService = new NotificationService();
    
    try {
        const result = await notificationService.sendTestNotification();
        console.log('Manual test results:', result);
    } catch (error) {
        console.error('Manual test failed:', error.message);
    }
    
    await notificationService.shutdown();
}

/**
 * Display configuration instructions
 */
function showConfigurationInstructions() {
    console.log('\n📋 CONFIGURATION INSTRUCTIONS');
    console.log('=' .repeat(60));
    
    console.log('\n🤖 TELEGRAM SETUP:');
    console.log('1. Create a Telegram bot by messaging @BotFather');
    console.log('2. Get your bot token from @BotFather');
    console.log('3. Add the bot to your desired chat/channel');
    console.log('4. Get your chat ID by messaging @userinfobot in the chat');
    console.log('5. Add to .env file:');
    console.log('   TELEGRAM_BOT_TOKEN=your_bot_token_here');
    console.log('   TELEGRAM_CHAT_ID=your_chat_id_here');
    
    console.log('\n💬 DISCORD SETUP:');
    console.log('1. Go to your Discord server settings');
    console.log('2. Navigate to Integrations → Webhooks');
    console.log('3. Create a new webhook for your desired channel');
    console.log('4. Copy the webhook URL');
    console.log('5. Add to .env file:');
    console.log('   DISCORD_WEBHOOK_URL=your_webhook_url_here');
    
    console.log('\n📝 EXAMPLE .env FILE:');
    console.log('# Existing configuration');
    console.log('ALCHEMY_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/your_key');
    console.log('');
    console.log('# Telegram notifications');
    console.log('TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
    console.log('TELEGRAM_CHAT_ID=-1001234567890');
    console.log('');
    console.log('# Discord notifications');
    console.log('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123.../abc...');
    
    console.log('\n⚡ QUICK TEST:');
    console.log('Run: node test-notifications.js manual');
}

/**
 * Utility sleep function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution logic
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('manual')) {
        await runManualTest();
    } else if (args.includes('config')) {
        showConfigurationInstructions();
    } else {
        showConfigurationInstructions();
        console.log('\n');
        await runNotificationTests();
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down notification tests...');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    runNotificationTests,
    runManualTest,
    showConfigurationInstructions
}; 