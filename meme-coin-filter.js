/**
 * Meme Coin Transaction Filter
 * 
 * A JavaScript module that analyzes decoded transaction data to determine
 * if the transaction involves any predefined meme coin token addresses.
 * 
 * Supports various transaction types:
 * - Direct ERC-20 transfers
 * - DEX swaps (Uniswap, SushiSwap, etc.)
 * - Multi-hop swaps
 * - Contract interactions involving tokens
 */

/**
 * Predefined array of popular meme coin token addresses (Ethereum mainnet).
 * These addresses are commonly traded meme coins that users might want to track.
 * 
 * @type {string[]} - Array of Ethereum token contract addresses
 */
const MEME_COIN_ADDRESSES = [
    // Dogecoin-themed tokens
    '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB (Shiba Inu)
    '0x4d224452801ACEd8B2F0aebE155379bb5D594381', // APE (ApeCoin)
    '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8', // Example meme coin 1
    
    // Dog-themed tokens
    '0x88ACDd2a6425c3FaAE4Bc9650Fd7E27e0Bebb7aB', // AKITA (Akita Inu)
    '0xBa2aE424d960c26247Dd6c32edC70B295c744C43', // DOGE (Dogecoin wrapped)
    '0x43f11c02439e2736800433b4594994BD43Cd066D', // FLOKI (Floki Inu)
    
    // Popular meme tokens
    '0x853d955aCEf822Db058eb8505911ED77F175b99e', // FRAX (example)
    '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', // SUSHI (SushiToken)
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI (Uniswap)
    
    // Add more meme coin addresses as needed
    // Note: Some addresses above are examples - replace with actual meme coin addresses
];

/**
 * Check if a decoded transaction involves any meme coin token addresses.
 * 
 * This function analyzes various parts of a decoded transaction to find
 * token addresses and compares them against the predefined meme coin list.
 * 
 * Handles multiple transaction patterns:
 * - Direct token transfers (transfer, transferFrom)
 * - DEX swaps with token addresses in parameters
 * - Multi-parameter functions with token arrays
 * - Nested contract calls
 * 
 * @param {Object} decodedTx - Decoded transaction object
 * @param {string} decodedTx.name - Function name (e.g., 'transfer', 'swapExactTokensForTokens')
 * @param {Array} decodedTx.args - Array of function arguments/parameters
 * @param {string} decodedTx.signature - Function signature
 * @param {string} [decodedTx.to] - Target contract address (optional)
 * 
 * @returns {boolean} - True if transaction involves any meme coin, false otherwise
 * 
 * @example
 * // ERC-20 transfer
 * const transferTx = {
 *   name: 'transfer',
 *   args: ['0x742d...', '1000000000000000000'],
 *   to: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE' // SHIB
 * };
 * console.log(isMemeTokenTransaction(transferTx)); // true
 * 
 * @example
 * // DEX swap
 * const swapTx = {
 *   name: 'swapExactTokensForTokens',
 *   args: ['1000000', '950000', ['0x95aD...', '0xA0b8...'], '0x123...', 1640995200]
 * };
 * console.log(isMemeTokenTransaction(swapTx)); // true if path contains meme coins
 */
function isMemeTokenTransaction(decodedTx) {
    try {
        // Input validation
        if (!decodedTx || typeof decodedTx !== 'object') {
            return false;
        }

        const { name, args, to } = decodedTx;
        
        // Create a set of normalized meme coin addresses for efficient lookup
        const memeAddressSet = new Set(
            MEME_COIN_ADDRESSES.map(addr => addr.toLowerCase())
        );

        /**
         * Check if a single address is a meme coin.
         * Handles null/undefined values and normalizes case.
         * 
         * @param {string} address - Ethereum address to check
         * @returns {boolean} - True if address is a meme coin
         */
        const isMemeAddress = (address) => {
            if (!address || typeof address !== 'string') return false;
            return memeAddressSet.has(address.toLowerCase());
        };

        // Check 1: Transaction target address (for direct token interactions)
        if (isMemeAddress(to)) {
            return true;
        }

        // Check 2: Function arguments analysis
        if (args && Array.isArray(args)) {
            for (const arg of args) {
                // Direct address parameter
                if (typeof arg === 'string' && arg.startsWith('0x')) {
                    if (isMemeAddress(arg)) {
                        return true;
                    }
                }
                
                // Array parameter (common in DEX swaps for token paths)
                else if (Array.isArray(arg)) {
                    for (const item of arg) {
                        if (typeof item === 'string' && item.startsWith('0x')) {
                            if (isMemeAddress(item)) {
                                return true;
                            }
                        }
                    }
                }
                
                // Object parameter (nested structures)
                else if (arg && typeof arg === 'object') {
                    const flattenedAddresses = extractAddressesFromObject(arg);
                    if (flattenedAddresses.some(addr => isMemeAddress(addr))) {
                        return true;
                    }
                }
            }
        }

        // Check 3: Function-specific patterns
        if (name) {
            switch (name.toLowerCase()) {
                case 'transfer':
                case 'transferfrom':
                    // For ERC-20 transfers, the contract address (to) is the token
                    return isMemeAddress(to);
                
                case 'swapexacttokensfortokens':
                case 'swaptokensforexacttokens':
                case 'swapexactethfortokens':
                case 'swaptokensforexacteth':
                    // DEX swap functions - check token path array (usually args[2])
                    if (args && args.length > 2 && Array.isArray(args[2])) {
                        return args[2].some(addr => isMemeAddress(addr));
                    }
                    break;
                
                case 'multicall':
                case 'batchswap':
                    // Multi-call transactions - recursively check nested calls
                    return checkNestedCalls(args);
                
                default:
                    // For unknown function names, we've already checked all parameters above
                    break;
            }
        }

        return false;

    } catch (error) {
        // Log error for debugging but don't throw to avoid breaking the caller
        console.error('Error in isMemeTokenTransaction:', error.message);
        return false;
    }
}

/**
 * Recursively extract all Ethereum addresses from a nested object structure.
 * Used for complex transaction parameters that contain nested address references.
 * 
 * @param {Object} obj - Object to search for addresses
 * @returns {string[]} - Array of found Ethereum addresses
 */
function extractAddressesFromObject(obj) {
    const addresses = [];
    
    /**
     * Recursive helper to traverse object properties
     * @param {*} value - Current value being examined
     */
    function traverse(value) {
        if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
            addresses.push(value);
        } else if (Array.isArray(value)) {
            value.forEach(traverse);
        } else if (value && typeof value === 'object') {
            Object.values(value).forEach(traverse);
        }
    }
    
    traverse(obj);
    return addresses;
}

/**
 * Check nested calls within multi-call transactions.
 * Some transactions (like MEV bots) bundle multiple calls together.
 * 
 * @param {Array} args - Transaction arguments that may contain nested calls
 * @returns {boolean} - True if any nested call involves meme coins
 */
function checkNestedCalls(args) {
    if (!Array.isArray(args)) return false;
    
    for (const arg of args) {
        // Look for structures that might contain nested transaction data
        if (arg && typeof arg === 'object') {
            // Common patterns: { target, callData }, { to, data }, etc.
            if (arg.target || arg.to) {
                const target = arg.target || arg.to;
                if (typeof target === 'string' && 
                    MEME_COIN_ADDRESSES.some(addr => 
                        addr.toLowerCase() === target.toLowerCase()
                    )) {
                    return true;
                }
            }
            
            // Recursively check nested objects
            if (extractAddressesFromObject(arg).some(addr => 
                MEME_COIN_ADDRESSES.some(memeAddr => 
                    memeAddr.toLowerCase() === addr.toLowerCase()
                ))) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Add a new meme coin address to the tracking list.
 * Useful for dynamically updating the filter without restarting.
 * 
 * @param {string} address - Ethereum token contract address to add
 * @throws {Error} - If address format is invalid
 */
function addMemeTokenAddress(address) {
    if (!address || typeof address !== 'string') {
        throw new Error('Address must be a non-empty string');
    }
    
    if (!address.startsWith('0x') || address.length !== 42) {
        throw new Error('Invalid Ethereum address format');
    }
    
    // Avoid duplicates
    const normalizedAddress = address.toLowerCase();
    if (!MEME_COIN_ADDRESSES.some(addr => addr.toLowerCase() === normalizedAddress)) {
        MEME_COIN_ADDRESSES.push(address);
        console.log(`Added meme token address: ${address}`);
    }
}

/**
 * Remove a meme coin address from the tracking list.
 * 
 * @param {string} address - Ethereum token contract address to remove
 * @returns {boolean} - True if address was found and removed
 */
function removeMemeTokenAddress(address) {
    if (!address || typeof address !== 'string') {
        return false;
    }
    
    const normalizedAddress = address.toLowerCase();
    const initialLength = MEME_COIN_ADDRESSES.length;
    
    // Filter out the address (case-insensitive)
    const updatedAddresses = MEME_COIN_ADDRESSES.filter(addr => 
        addr.toLowerCase() !== normalizedAddress
    );
    
    // Update the array in place
    MEME_COIN_ADDRESSES.length = 0;
    MEME_COIN_ADDRESSES.push(...updatedAddresses);
    
    const wasRemoved = MEME_COIN_ADDRESSES.length < initialLength;
    if (wasRemoved) {
        console.log(`Removed meme token address: ${address}`);
    }
    
    return wasRemoved;
}

/**
 * Get a copy of the current meme coin addresses list.
 * Returns a copy to prevent external modification of the internal array.
 * 
 * @returns {string[]} - Copy of current meme coin addresses
 */
function getMemeTokenAddresses() {
    return [...MEME_COIN_ADDRESSES];
}

/**
 * Get statistics about the current meme token configuration.
 * 
 * @returns {Object} - Statistics object with count and sample addresses
 */
function getMemeTokenStats() {
    return {
        totalCount: MEME_COIN_ADDRESSES.length,
        sampleAddresses: MEME_COIN_ADDRESSES.slice(0, 5), // First 5 for preview
        hasShib: MEME_COIN_ADDRESSES.some(addr => 
            addr.toLowerCase() === '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'
        ),
        hasApe: MEME_COIN_ADDRESSES.some(addr => 
            addr.toLowerCase() === '0x4d224452801aced8b2f0aebe155379bb5d594381'
        )
    };
}

// Export the main function and utility functions
module.exports = {
    isMemeTokenTransaction,
    addMemeTokenAddress,
    removeMemeTokenAddress,
    getMemeTokenAddresses,
    getMemeTokenStats,
    
    // Export the addresses array for advanced use cases
    MEME_COIN_ADDRESSES
}; 