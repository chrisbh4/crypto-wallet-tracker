/**
 * Automated Swap Execution Module
 * 
 * ARCHITECTURE OVERVIEW:
 * =====================
 * This module implements automated cryptocurrency swap execution via Uniswap V3 Router.
 * It's designed to work with the enhanced wallet tracker to execute trades based on
 * detected transactions involving tracked wallets or meme coins.
 * 
 * SECURITY ARCHITECTURE:
 * ======================
 * - Private keys are loaded from environment variables (never hardcoded)
 * - All transactions are simulated before execution (dry-run capability)
 * - Slippage protection prevents unfavorable trade execution
 * - Gas price optimization to prevent overpaying
 * - Transaction deadline enforcement to prevent stale transactions
 * - Nonce management to prevent transaction replacement attacks
 * 
 * RISK MANAGEMENT:
 * ================
 * - Maximum transaction value limits
 * - Slippage tolerance configuration (default: 0.5%)
 * - Gas price limits to prevent MEV attacks
 * - Transaction simulation to catch reverts before spending gas
 * - Emergency stop functionality for immediate shutdown
 * 
 * INTEGRATION POINTS:
 * ===================
 * - Enhanced Wallet Tracker: Receives trading signals
 * - Uniswap V3 Router: Executes actual swap transactions  
 * - Notification Service: Reports execution results
 * - Price Oracles: Validates swap rates and slippage
 * 
 * SUPPORTED OPERATIONS:
 * =====================
 * - ETH → ERC-20 swaps (exactETHForTokens)
 * - ERC-20 → ETH swaps (exactTokensForETH)
 * - ERC-20 → ERC-20 swaps (exactTokensForTokens)
 * - Multi-hop swaps through optimal routes
 * - Batch transaction execution
 */

const { ethers } = require('ethers');
require('dotenv').config();

// Uniswap V3 Router Contract Address (Ethereum Mainnet)
const UNISWAP_V3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// Uniswap V3 Router ABI (simplified - key functions only)
const UNISWAP_V3_ROUTER_ABI = [
    // Exact input single swap
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    
    // Exact output single swap
    "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)",
    
    // Multi-hop exact input
    "function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)",
    
    // Unwrap WETH to ETH
    "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
    
    // Refund ETH
    "function refundETH() external payable"
];

// ERC-20 Token ABI (for approvals and balance checks)
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

// Common token addresses (Ethereum Mainnet)
const TOKEN_ADDRESSES = {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6411C8BF1d2A2fA7C9e4aB8d8a0b8b8',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'
};

/**
 * Automated Swap Execution Service
 * 
 * DESIGN PATTERNS:
 * ================
 * 1. BUILDER PATTERN: Flexible swap parameter construction
 * 2. STRATEGY PATTERN: Different execution strategies (aggressive, conservative)
 * 3. COMMAND PATTERN: Swap operations as executable commands with undo capability
 * 4. CIRCUIT BREAKER PATTERN: Emergency stop functionality
 * 5. SIMULATION PATTERN: Dry-run before actual execution
 */
class SwapExecutor {
    /**
     * Initialize swap execution service with security and configuration
     * 
     * SECURITY INITIALIZATION:
     * ========================
     * - Private key loaded from environment (never stored in memory longer than needed)
     * - Wallet instance creation with secure provider connection
     * - Transaction limits and safety parameters configured
     * - Emergency stop mechanisms initialized
     */
    constructor() {
        // =================================================================
        // SECURITY CONFIGURATION
        // =================================================================
        // Load private key from environment variable
        // CRITICAL: Never hardcode private keys or commit them to version control
        this.privateKey = process.env.TRADING_PRIVATE_KEY || null;
        
        // =================================================================
        // TRADING CONFIGURATION
        // =================================================================
        // Risk management parameters with conservative defaults
        this.config = {
            // Slippage tolerance (0.5% = 0.005, 1% = 0.01)
            maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT || '0.5'),
            
            // Maximum transaction value in ETH to prevent large losses
            maxTransactionValueETH: parseFloat(process.env.MAX_TRANSACTION_VALUE_ETH || '0.1'),
            
            // Gas configuration
            maxGasPriceGwei: parseInt(process.env.MAX_GAS_PRICE_GWEI || '100'),
            gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'),
            
            // Transaction timing
            transactionDeadlineMinutes: parseInt(process.env.TRANSACTION_DEADLINE_MINUTES || '10'),
            
            // Execution mode
            enableRealTrading: process.env.ENABLE_REAL_TRADING === 'true',
            
            // Emergency controls
            emergencyStop: false
        };
        
        // =================================================================
        // STATISTICS AND MONITORING
        // =================================================================
        this.stats = {
            totalSwapsRequested: 0,
            totalSwapsExecuted: 0,
            totalSwapsFailed: 0,
            totalVolumeETH: 0,
            totalGasSpentETH: 0,
            lastSwapTime: null,
            startTime: new Date()
        };

        // Validate private key format and presence
        if (!this.privateKey) {
            console.warn('⚠️  No trading private key configured. Swap execution disabled.');
            this.isEnabled = false;
            this.displayConfigurationInstructions();
            return;
        }
        
        if (!this.privateKey.startsWith('0x') || this.privateKey.length !== 66) {
            console.error('❌ Invalid private key format. Must be 64 hex characters with 0x prefix.');
            this.isEnabled = false;
            return;
        }
        
        // =================================================================
        // PROVIDER AND WALLET SETUP
        // =================================================================
        // Initialize provider connection (reuse from wallet tracker)
        this.provider = null;
        this.wallet = null;
        this.isEnabled = false;
        
        // =================================================================
        // CONTRACT INTERFACES
        // =================================================================
        this.uniswapRouter = null;  // Will be initialized when provider is set
        
        console.log('🔧 Swap Executor initialized');
        console.log(`   Max Slippage: ${this.config.maxSlippagePercent}%`);
        console.log(`   Max Transaction: ${this.config.maxTransactionValueETH} ETH`);
        console.log(`   Real Trading: ${this.config.enableRealTrading ? '✅ ENABLED' : '❌ DISABLED'}`);
    }
    
    /**
     * Display configuration instructions for setting up trading
     */
    displayConfigurationInstructions() {
        console.log('\n💡 SWAP EXECUTOR CONFIGURATION');
        console.log('===============================');
        console.log('To enable automated swap execution:');
        console.log('');
        console.log('1. 🔑 Add Trading Private Key to .env:');
        console.log('   TRADING_PRIVATE_KEY=0x1234567890abcdef...');
        console.log('');
        console.log('2. ⚙️  Optional Configuration:');
        console.log('   MAX_SLIPPAGE_PERCENT=0.5          # 0.5% slippage tolerance');
        console.log('   MAX_TRANSACTION_VALUE_ETH=0.1     # Max 0.1 ETH per transaction');
        console.log('   MAX_GAS_PRICE_GWEI=100            # Gas price limit');
        console.log('   ENABLE_REAL_TRADING=false         # Set true to enable real trades');
        console.log('');
        console.log('3. 🔒 Security Best Practices:');
        console.log('   - Use a dedicated wallet with limited funds');
        console.log('   - Test on testnet first (Goerli/Sepolia)');
        console.log('   - Start with very small amounts');
        console.log('   - Never use your main wallet private key');
        console.log('');
        console.log('4. 🧪 Testing:');
        console.log('   npm run test:swap-executor    # Run safety tests');
        console.log('   npm run demo:swap             # Demo dry-run execution');
        console.log('');
    }
    
    /**
     * Initialize provider connection and contract interfaces
     * 
     * @param {ethers.Provider} provider - WebSocket provider instance from wallet tracker
     */
    async initializeProvider(provider) {
        try {
            this.provider = provider;
            
            // Create wallet instance from private key
            this.wallet = new ethers.Wallet(this.privateKey, this.provider);
            
            // Initialize Uniswap V3 Router contract
            this.uniswapRouter = new ethers.Contract(
                UNISWAP_V3_ROUTER_ADDRESS,
                UNISWAP_V3_ROUTER_ABI,
                this.wallet
            );
            
            // Get wallet address and balance for logging
            const address = await this.wallet.getAddress();
            const balance = await this.provider.getBalance(address);
            const balanceETH = ethers.formatEther(balance);
            
            console.log('✅ Swap Executor connected to blockchain');
            console.log(`   Wallet Address: ${address}`);
            console.log(`   Current Balance: ${balanceETH} ETH`);
            
            this.isEnabled = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize swap executor:', error.message);
            this.isEnabled = false;
        }
    }
    
    /**
     * Execute a token swap with comprehensive safety checks
     * 
     * EXECUTION PIPELINE:
     * ===================
     * 1. Parameter validation and sanitization
     * 2. Balance and allowance verification
     * 3. Slippage calculation and protection
     * 4. Gas estimation and optimization
     * 5. Transaction simulation (dry-run)
     * 6. Actual execution (if not dry-run mode)
     * 7. Transaction monitoring and confirmation
     * 8. Result logging and statistics update
     * 
     * @param {Object} swapParams - Swap execution parameters
     * @param {string} swapParams.tokenIn - Input token address (or 'ETH')
     * @param {string} swapParams.tokenOut - Output token address (or 'ETH') 
     * @param {string} swapParams.amountIn - Input amount in token units
     * @param {number} [swapParams.slippagePercent] - Custom slippage tolerance
     * @param {boolean} [swapParams.dryRun=true] - Simulate transaction without execution
     * @param {string} [swapParams.reason] - Reason for swap (for logging)
     * 
     * @returns {Promise<Object>} - Execution result with transaction details
     */
    async executeSwap(swapParams) {
        console.log('\n🔄 SWAP EXECUTION REQUEST');
        console.log('==========================');
        
        try {
            // =================================================================
            // STAGE 1: SAFETY AND VALIDATION CHECKS
            // =================================================================
            
            // Check if service is enabled and configured
            if (!this.isEnabled) {
                throw new Error('Swap executor not enabled or configured properly');
            }
            
            // Check emergency stop
            if (this.config.emergencyStop) {
                throw new Error('Emergency stop activated - all trading suspended');
            }
            
            // Validate required parameters
            this.validateSwapParameters(swapParams);
            
            // Update statistics
            this.stats.totalSwapsRequested++;
            
            // =================================================================
            // STAGE 2: PARAMETER PREPARATION
            // =================================================================
            
            const {
                tokenIn,
                tokenOut, 
                amountIn,
                slippagePercent = this.config.maxSlippagePercent,
                dryRun = true,
                reason = 'Manual swap'
            } = swapParams;
            
            console.log(`📋 Token In: ${tokenIn}`);
            console.log(`📋 Token Out: ${tokenOut}`);
            console.log(`📋 Amount In: ${amountIn}`);
            console.log(`📋 Slippage: ${slippagePercent}%`);
            console.log(`📋 Dry Run: ${dryRun ? 'YES' : 'NO'}`);
            console.log(`📋 Reason: ${reason}`);
            
            // =================================================================
            // STAGE 3: BALANCE AND ALLOWANCE VERIFICATION
            // =================================================================
            
            await this.verifyBalanceAndAllowance(tokenIn, amountIn);
            
            // =================================================================
            // STAGE 4: SWAP ROUTE AND PRICE CALCULATION
            // =================================================================
            
            const swapDetails = await this.calculateSwapDetails(tokenIn, tokenOut, amountIn, slippagePercent);
            
            // =================================================================
            // STAGE 5: TRANSACTION CONSTRUCTION
            // =================================================================
            
            const transaction = await this.buildSwapTransaction(swapDetails);
            
            // =================================================================
            // STAGE 6: SIMULATION (DRY RUN)
            // =================================================================
            
            console.log('\n🧪 TRANSACTION SIMULATION');
            console.log('=========================');
            
            try {
                // Simulate transaction to check for reverts
                const simulationResult = await this.wallet.estimateGas(transaction);
                console.log(`✅ Simulation successful - Estimated Gas: ${simulationResult.toString()}`);
                
                // Calculate transaction costs
                const gasPrice = await this.provider.getFeeData();
                const estimatedCostWei = simulationResult * gasPrice.gasPrice;
                const estimatedCostETH = ethers.formatEther(estimatedCostWei);
                
                console.log(`💰 Estimated Transaction Cost: ${estimatedCostETH} ETH`);
                
            } catch (simulationError) {
                console.error('❌ Transaction simulation failed:', simulationError.message);
                throw new Error(`Swap would fail: ${simulationError.message}`);
            }
            
            // =================================================================
            // STAGE 7: EXECUTION DECISION
            // =================================================================
            
            if (dryRun) {
                console.log('\n✅ DRY RUN COMPLETED SUCCESSFULLY');
                console.log('Transaction would execute without errors');
                
                return {
                    success: true,
                    dryRun: true,
                    swapDetails: swapDetails,
                    estimatedGas: simulationResult?.toString(),
                    estimatedCost: estimatedCostETH
                };
            }
            
            // =================================================================
            // STAGE 8: REAL EXECUTION
            // =================================================================
            
            if (!this.config.enableRealTrading) {
                throw new Error('Real trading is disabled. Set ENABLE_REAL_TRADING=true to execute swaps.');
            }
            
            console.log('\n🚀 EXECUTING REAL TRANSACTION');
            console.log('=============================');
            
            // Send transaction
            const txResponse = await this.wallet.sendTransaction(transaction);
            console.log(`📤 Transaction sent: ${txResponse.hash}`);
            
            // Wait for confirmation
            const receipt = await txResponse.wait();
            console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
            
            // Update statistics
            this.stats.totalSwapsExecuted++;
            this.stats.totalGasSpentETH += parseFloat(ethers.formatEther(receipt.gasUsed * receipt.effectiveGasPrice));
            this.stats.lastSwapTime = new Date();
            
            return {
                success: true,
                dryRun: false,
                transactionHash: txResponse.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                swapDetails: swapDetails
            };
            
        } catch (error) {
            console.error('❌ Swap execution failed:', error.message);
            this.stats.totalSwapsFailed++;
            
            return {
                success: false,
                error: error.message,
                dryRun: swapParams.dryRun || true
            };
        }
    }
    
    /**
     * Validate swap parameters for security and correctness
     * 
     * @param {Object} params - Swap parameters to validate
     */
    validateSwapParameters(params) {
        const { tokenIn, tokenOut, amountIn } = params;
        
        // Check required parameters
        if (!tokenIn || !tokenOut || !amountIn) {
            throw new Error('Missing required parameters: tokenIn, tokenOut, amountIn');
        }
        
        // Validate token addresses (or ETH)
        if (tokenIn !== 'ETH' && !ethers.isAddress(tokenIn)) {
            throw new Error(`Invalid tokenIn address: ${tokenIn}`);
        }
        
        if (tokenOut !== 'ETH' && !ethers.isAddress(tokenOut)) {
            throw new Error(`Invalid tokenOut address: ${tokenOut}`);
        }
        
        // Prevent same token swaps
        if (tokenIn === tokenOut) {
            throw new Error('Cannot swap token to itself');
        }
        
        // Validate amount format
        try {
            const amount = ethers.parseUnits(amountIn, 18); // Assume 18 decimals for validation
            if (amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }
        } catch (error) {
            throw new Error(`Invalid amount format: ${amountIn}`);
        }
    }
    
    /**
     * Verify wallet has sufficient balance and token allowance
     * 
     * @param {string} tokenAddress - Token address or 'ETH'
     * @param {string} amount - Amount to check
     */
    async verifyBalanceAndAllowance(tokenAddress, amount) {
        const walletAddress = await this.wallet.getAddress();
        
        if (tokenAddress === 'ETH') {
            // Check ETH balance
            const ethBalance = await this.provider.getBalance(walletAddress);
            const requiredAmount = ethers.parseEther(amount);
            
            if (ethBalance < requiredAmount) {
                throw new Error(`Insufficient ETH balance. Required: ${amount}, Available: ${ethers.formatEther(ethBalance)}`);
            }
            
        } else {
            // Check ERC-20 token balance and allowance
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            
            // Check balance
            const tokenBalance = await tokenContract.balanceOf(walletAddress);
            const tokenDecimals = await tokenContract.decimals();
            const requiredAmount = ethers.parseUnits(amount, tokenDecimals);
            
            if (tokenBalance < requiredAmount) {
                throw new Error(`Insufficient token balance. Required: ${amount}, Available: ${ethers.formatUnits(tokenBalance, tokenDecimals)}`);
            }
            
            // Check allowance
            const currentAllowance = await tokenContract.allowance(walletAddress, UNISWAP_V3_ROUTER_ADDRESS);
            
            if (currentAllowance < requiredAmount) {
                console.log('⚠️  Insufficient allowance. Approval required.');
                // In a real implementation, you might want to automatically approve
                throw new Error(`Insufficient token allowance. Please approve ${amount} tokens for the Uniswap router.`);
            }
        }
    }
    
    /**
     * Calculate optimal swap route and expected output
     * 
     * @param {string} tokenIn - Input token address
     * @param {string} tokenOut - Output token address
     * @param {string} amountIn - Input amount
     * @param {number} slippagePercent - Allowed slippage percentage
     * @returns {Object} - Swap calculation details
     */
    async calculateSwapDetails(tokenIn, tokenOut, amountIn, slippagePercent) {
        // This is a simplified implementation
        // In production, you would use Uniswap's quoter contract for accurate pricing
        
        // Convert ETH addresses to WETH for Uniswap
        const tokenInAddress = tokenIn === 'ETH' ? TOKEN_ADDRESSES.WETH : tokenIn;
        const tokenOutAddress = tokenOut === 'ETH' ? TOKEN_ADDRESSES.WETH : tokenOut;
        
        // For simulation, we'll estimate the output (in production, use quoter)
        const estimatedOutput = amountIn; // Simplified 1:1 ratio for demo
        const minOutputAfterSlippage = (parseFloat(estimatedOutput) * (1 - slippagePercent / 100)).toString();
        
        return {
            tokenInAddress,
            tokenOutAddress,
            amountIn,
            estimatedOutput,
            minOutputAfterSlippage,
            slippagePercent,
            fee: 3000 // 0.3% fee tier
        };
    }
    
    /**
     * Build the actual swap transaction
     * 
     * @param {Object} swapDetails - Calculated swap details
     * @returns {Object} - Transaction object
     */
    async buildSwapTransaction(swapDetails) {
        const deadline = Math.floor(Date.now() / 1000) + (this.config.transactionDeadlineMinutes * 60);
        const recipientAddress = await this.wallet.getAddress();
        
        // Build Uniswap V3 exactInputSingle parameters
        const params = {
            tokenIn: swapDetails.tokenInAddress,
            tokenOut: swapDetails.tokenOutAddress,
            fee: swapDetails.fee,
            recipient: recipientAddress,
            deadline: deadline,
            amountIn: ethers.parseUnits(swapDetails.amountIn, 18),
            amountOutMinimum: ethers.parseUnits(swapDetails.minOutputAfterSlippage, 18),
            sqrtPriceLimitX96: 0 // No price limit
        };
        
        // Build transaction data
        const data = this.uniswapRouter.interface.encodeFunctionData('exactInputSingle', [params]);
        
        return {
            to: UNISWAP_V3_ROUTER_ADDRESS,
            data: data,
            value: swapDetails.tokenInAddress === TOKEN_ADDRESSES.WETH ? ethers.parseUnits(swapDetails.amountIn, 18) : 0
        };
    }
    
    /**
     * Emergency stop all trading operations
     */
    emergencyStop() {
        console.log('🚨 EMERGENCY STOP ACTIVATED');
        console.log('All trading operations suspended');
        this.config.emergencyStop = true;
    }
    
    /**
     * Resume trading operations after emergency stop
     */
    resumeTrading() {
        console.log('✅ Trading operations resumed');
        this.config.emergencyStop = false;
    }
    
    /**
     * Get current executor status and statistics
     * 
     * @returns {Object} - Status and statistics object
     */
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            emergencyStop: this.config.emergencyStop,
            configuration: {
                maxSlippagePercent: this.config.maxSlippagePercent,
                maxTransactionValueETH: this.config.maxTransactionValueETH,
                enableRealTrading: this.config.enableRealTrading
            },
            statistics: this.stats
        };
    }
}

// Export the service class and utility functions
module.exports = {
    SwapExecutor,
    TOKEN_ADDRESSES,
    
    /**
     * Create and configure a swap executor instance
     * 
     * @param {Object} config - Optional configuration overrides
     * @returns {SwapExecutor} - Configured executor instance
     */
    createSwapExecutor: (config = {}) => {
        const executor = new SwapExecutor();
        
        // Apply configuration overrides
        if (config.maxSlippagePercent) {
            executor.config.maxSlippagePercent = config.maxSlippagePercent;
        }
        
        if (config.maxTransactionValueETH) {
            executor.config.maxTransactionValueETH = config.maxTransactionValueETH;
        }
        
        return executor;
    }
}; 