/**
 * Integration Example: Wallet Tracker + Meme Coin Filter
 * 
 * This example demonstrates how to integrate the meme coin filter module
 * with the wallet tracker to specifically monitor meme coin transactions.
 * 
 * Features:
 * - Combines wallet address tracking with meme coin filtering
 * - Shows how to decode transaction data
 * - Demonstrates layered filtering (wallet + token type)
 */

const { ethers } = require('ethers');
const { isMemeTokenTransaction, getMemeTokenStats } = require('./meme-coin-filter');

/**
 * Enhanced transaction checker that combines wallet and meme coin filtering.
 * 
 * This function takes a raw transaction and applies both filters:
 * 1. Check if transaction involves tracked wallet addresses
 * 2. Check if transaction involves meme coin token addresses
 * 
 * @param {Object} tx - Raw transaction object from ethers.js
 * @param {string[]} trackedWallets - Array of wallet addresses to monitor
 * @returns {Object} - Analysis result with filtering details
 */
function analyzeTransaction(tx, trackedWallets) {
    const result = {
        hash: tx.hash,
        isTrackedWallet: false,
        isMemeToken: false,
        shouldAlert: false,
        details: {
            walletMatch: null,
            tokenMatch: null,
            transactionType: 'unknown'
        }
    };

    // Check wallet address filtering (from original wallet tracker logic)
    const fromAddress = tx.from?.toLowerCase();
    const toAddress = tx.to?.toLowerCase();
    
    const walletMatch = trackedWallets.find(wallet => 
        wallet.toLowerCase() === fromAddress || wallet.toLowerCase() === toAddress
    );
    
    if (walletMatch) {
        result.isTrackedWallet = true;
        result.details.walletMatch = walletMatch;
    }

    // Try to decode transaction data for meme coin checking
    let decodedTx = null;
    if (tx.data && tx.data !== '0x') {
        try {
            decodedTx = decodeTransactionData(tx);
            if (decodedTx) {
                result.isMemeToken = isMemeTokenTransaction(decodedTx);
                if (result.isMemeToken) {
                    result.details.tokenMatch = 'meme coin detected';
                    result.details.transactionType = decodedTx.name || 'contract call';
                }
            }
        } catch (error) {
            // If decoding fails, we can still check the 'to' address
            const simpleCheck = {
                to: tx.to,
                name: 'unknown',
                args: []
            };
            result.isMemeToken = isMemeTokenTransaction(simpleCheck);
        }
    } else if (tx.value && tx.value !== '0') {
        result.details.transactionType = 'ETH transfer';
    }

    // Determine if we should alert based on filtering criteria
    // You can customize this logic based on your needs:
    
    // Option 1: Alert on tracked wallets AND meme coins
    result.shouldAlert = result.isTrackedWallet && result.isMemeToken;
    
    // Option 2: Alert on tracked wallets OR meme coins
    // result.shouldAlert = result.isTrackedWallet || result.isMemeToken;
    
    // Option 3: Only meme coins from tracked wallets
    // result.shouldAlert = result.isTrackedWallet && result.isMemeToken;

    return result;
}

/**
 * Simplified transaction decoder for common patterns.
 * In a real implementation, you'd use a proper ABI decoder.
 * 
 * @param {Object} tx - Raw transaction object
 * @returns {Object|null} - Decoded transaction or null if can't decode
 */
function decodeTransactionData(tx) {
    if (!tx.data || tx.data === '0x') return null;

    // Get function selector (first 4 bytes)
    const selector = tx.data.slice(0, 10);
    
    // Common function selectors for ERC-20 and DEX operations
    const knownSelectors = {
        '0xa9059cbb': { name: 'transfer', argCount: 2 },
        '0x23b872dd': { name: 'transferFrom', argCount: 3 },
        '0x38ed1739': { name: 'swapExactTokensForTokens', argCount: 5 },
        '0x7ff36ab5': { name: 'swapExactETHForTokens', argCount: 4 },
        '0x18cbafe5': { name: 'swapExactTokensForETH', argCount: 5 },
        '0xac9650d8': { name: 'multicall', argCount: 1 }
    };

    const functionInfo = knownSelectors[selector];
    if (!functionInfo) {
        // Unknown function, create basic decoded object
        return {
            name: 'unknown',
            signature: selector,
            args: [],
            to: tx.to
        };
    }

    try {
        // For demo purposes, we'll do basic parameter extraction
        // In production, use proper ABI decoding
        const params = tx.data.slice(10); // Remove function selector
        const args = [];
        
        // This is simplified - real decoding would parse based on ABI
        if (functionInfo.name === 'transfer' || functionInfo.name === 'transferFrom') {
            // These functions interact with token contracts directly
            return {
                name: functionInfo.name,
                signature: selector,
                args: args,
                to: tx.to // The token contract address
            };
        }
        
        return {
            name: functionInfo.name,
            signature: selector,
            args: args,
            to: tx.to
        };
        
    } catch (error) {
        console.error('Error decoding transaction:', error.message);
        return null;
    }
}

/**
 * Enhanced transaction handler that combines wallet tracking with meme coin filtering.
 * This replaces the original checkAndPrintTransaction function.
 * 
 * @param {Object} tx - Transaction object from pending events
 * @param {string[]} trackedWallets - Array of wallet addresses to track
 */
function handleEnhancedTransaction(tx, trackedWallets) {
    const analysis = analyzeTransaction(tx, trackedWallets);
    
    if (analysis.shouldAlert) {
        printEnhancedTransactionDetails(tx, analysis);
    }
}

/**
 * Enhanced transaction display with wallet and meme coin information.
 * 
 * @param {Object} tx - Raw transaction object
 * @param {Object} analysis - Analysis result from analyzeTransaction
 */
function printEnhancedTransactionDetails(tx, analysis) {
    const timestamp = new Date().toISOString();
    const valueInEth = ethers.formatEther(tx.value || '0');
    const gasPrice = tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : 'N/A';
    
    console.log('\n🎯 ENHANCED TRANSACTION ALERT');
    console.log('================================');
    console.log(`⏰ Time: ${timestamp}`);
    console.log(`🔗 Hash: ${tx.hash}`);
    console.log(`📤 From: ${tx.from}`);
    console.log(`📥 To: ${tx.to || 'Contract Creation'}`);
    console.log(`💰 Value: ${valueInEth} ETH`);
    console.log(`⛽ Gas Price: ${gasPrice} gwei`);
    
    // Enhanced filtering information
    console.log(`\n🔍 Filter Results:`);
    console.log(`   📍 Tracked Wallet: ${analysis.isTrackedWallet ? '✅ YES' : '❌ NO'}`);
    if (analysis.details.walletMatch) {
        console.log(`   📍 Matched Wallet: ${analysis.details.walletMatch}`);
    }
    console.log(`   🎭 Meme Token: ${analysis.isMemeToken ? '✅ YES' : '❌ NO'}`);
    if (analysis.details.tokenMatch) {
        console.log(`   🎭 Token Details: ${analysis.details.tokenMatch}`);
    }
    console.log(`   🔄 Transaction Type: ${analysis.details.transactionType}`);
    
    if (tx.data && tx.data !== '0x') {
        console.log(`📝 Data: ${tx.data.substring(0, 100)}${tx.data.length > 100 ? '...' : ''}`);
    }
    console.log('================================\n');
}

/**
 * Example usage and testing function
 */
function runExample() {
    console.log('🚀 Enhanced Wallet Tracker with Meme Coin Filter\n');
    
    // Display meme coin configuration
    console.log('📊 Meme Coin Filter Configuration:');
    console.log(getMemeTokenStats());
    console.log('\n');
    
    // Example tracked wallets (same as original tracker)
    const trackedWallets = [
        '0x388C818CA8B9251b393131C08a736A67ccB19297',
        '0x8ba1f109551bD432803012645Hac136c52efefeef',
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    ];
    
    console.log('📋 Tracking wallets:', trackedWallets);
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Example transaction testing
    console.log('Testing with example transactions:\n');
    
    // Test 1: Tracked wallet + meme token
    const exampleTx1 = {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x388C818CA8B9251b393131C08a736A67ccB19297', // Tracked wallet
        to: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',   // SHIB token
        value: '0',
        gasPrice: ethers.parseUnits('25', 'gwei'),
        data: '0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b8d0b4e8d4de58e1b80000000000000000000000000000000000000000000000000de0b6b3a7640000'
    };
    
    console.log('Example 1: Tracked Wallet + Meme Token');
    handleEnhancedTransaction(exampleTx1, trackedWallets);
    
    // Test 2: Non-tracked wallet + meme token
    const exampleTx2 = {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        from: '0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', // Random wallet
        to: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',   // SHIB token
        value: '0',
        gasPrice: ethers.parseUnits('20', 'gwei'),
        data: '0xa9059cbb'
    };
    
    console.log('Example 2: Non-tracked Wallet + Meme Token');
    handleEnhancedTransaction(exampleTx2, trackedWallets);
    
    console.log('✅ Example completed!');
    console.log('\n💡 Integration Tips:');
    console.log('1. Replace checkAndPrintTransaction in wallet-tracker.js with handleEnhancedTransaction');
    console.log('2. Adjust shouldAlert logic based on your filtering preferences');
    console.log('3. Add proper ABI decoding for more accurate transaction analysis');
    console.log('4. Consider adding more sophisticated meme token detection patterns');
}

// Export functions for use in other modules
module.exports = {
    analyzeTransaction,
    handleEnhancedTransaction,
    decodeTransactionData,
    runExample
};

// Run example if this file is executed directly
if (require.main === module) {
    runExample();
} 