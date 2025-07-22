/**
 * Test file for Meme Coin Transaction Filter
 * 
 * Demonstrates various usage patterns and validates the module functionality
 * with different types of decoded transaction inputs.
 */

const { 
    isMemeTokenTransaction, 
    getMemeTokenStats,
    addMemeTokenAddress,
    getMemeTokenAddresses 
} = require('../meme-coin-filter');

console.log('🧪 Testing Meme Coin Transaction Filter\n');

// Display current configuration
console.log('📊 Current Configuration:');
console.log(getMemeTokenStats());
console.log('\n' + '='.repeat(50) + '\n');

/**
 * Test Case 1: Direct ERC-20 Transfer
 * Transaction directly calling a meme token contract
 */
console.log('Test 1: Direct SHIB Transfer');
const shibTransfer = {
    name: 'transfer',
    args: ['0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', '1000000000000000000'],
    to: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB contract
    signature: 'transfer(address,uint256)'
};
console.log('Input:', JSON.stringify(shibTransfer, null, 2));
console.log('Result:', isMemeTokenTransaction(shibTransfer));
console.log('Expected: true (SHIB is in meme coin list)\n');

/**
 * Test Case 2: Non-meme token transfer
 * Regular ERC-20 transfer that should return false
 */
console.log('Test 2: Regular USDC Transfer');
const usdcTransfer = {
    name: 'transfer',
    args: ['0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', '1000000'],
    to: '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8', // Random non-meme token
    signature: 'transfer(address,uint256)'
};
console.log('Input:', JSON.stringify(usdcTransfer, null, 2));
console.log('Result:', isMemeTokenTransaction(usdcTransfer));
console.log('Expected: false (not a meme coin)\n');

/**
 * Test Case 3: DEX Swap with meme coins in path
 * Uniswap-style swap involving meme tokens
 */
console.log('Test 3: Uniswap Swap (ETH -> SHIB)');
const dexSwap = {
    name: 'swapExactETHForTokens',
    args: [
        '950000000000000000', // min amount out
        [
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
            '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'  // SHIB
        ],
        '0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', // to
        1640995200 // deadline
    ],
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
    signature: 'swapExactETHForTokens(uint256,address[],address,uint256)'
};
console.log('Input:', JSON.stringify(dexSwap, null, 2));
console.log('Result:', isMemeTokenTransaction(dexSwap));
console.log('Expected: true (SHIB in token path)\n');

/**
 * Test Case 4: Multi-hop swap without meme coins
 * Should return false as no meme coins are involved
 */
console.log('Test 4: Multi-hop Swap (USDC -> WETH -> DAI)');
const nonMemeSwap = {
    name: 'swapExactTokensForTokens',
    args: [
        '1000000', // amount in
        '950000000000000000', // min amount out
        [
            '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8', // USDC
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH  
            '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
        ],
        '0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', // to
        1640995200 // deadline
    ],
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
};
console.log('Input:', JSON.stringify(nonMemeSwap, null, 2));
console.log('Result:', isMemeTokenTransaction(nonMemeSwap));
console.log('Expected: false (no meme coins in path)\n');

/**
 * Test Case 5: Complex nested transaction
 * Transaction with nested objects containing addresses
 */
console.log('Test 5: Complex Nested Transaction');
const complexTx = {
    name: 'multicall',
    args: [
        {
            target: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB
            callData: '0xa9059cbb...',
            value: 0
        },
        {
            target: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            callData: '0x38ed1739...',
            value: 0
        }
    ],
    to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Multicall contract
    signature: 'multicall(bytes[])'
};
console.log('Input:', JSON.stringify(complexTx, null, 2));
console.log('Result:', isMemeTokenTransaction(complexTx));
console.log('Expected: true (SHIB address in nested structure)\n');

/**
 * Test Case 6: Invalid/malformed input
 * Testing error handling
 */
console.log('Test 6: Invalid Input Handling');
const invalidInputs = [
    null,
    undefined,
    'not an object',
    {},
    { name: 'transfer' }, // missing args
    { args: ['invalid'] }  // missing name
];

invalidInputs.forEach((input, index) => {
    console.log(`Invalid input ${index + 1}:`, input);
    console.log('Result:', isMemeTokenTransaction(input));
    console.log('Expected: false (graceful handling)\n');
});

/**
 * Test Case 7: Dynamic address management
 * Testing add/remove functionality
 */
console.log('Test 7: Dynamic Address Management');
console.log('Original addresses count:', getMemeTokenAddresses().length);

// Add a new test address
const testAddress = '0x1234567890123456789012345678901234567890';
addMemeTokenAddress(testAddress);
console.log('After adding test address:', getMemeTokenAddresses().length);

// Test with the new address
const testTx = {
    name: 'transfer',
    args: ['0x742d35Cc6634C0532925a3b8D0B4E8d4dE58E1B8', '1000000'],
    to: testAddress
};
console.log('Test transaction with new address:', isMemeTokenTransaction(testTx));
console.log('Expected: true (newly added address should be detected)\n');

console.log('✅ All tests completed!');
console.log('\n' + '='.repeat(50));
console.log('📋 Final Statistics:');
console.log(getMemeTokenStats()); 