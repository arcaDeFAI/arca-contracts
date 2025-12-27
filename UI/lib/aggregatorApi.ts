/**
 * Utility for interacting with DEX Aggregators (KyberSwap & OpenOcean)
 * Supports Sonic (Chain 146)
 */

const OPENOCEAN_API_BASE = 'https://open-api.openocean.finance/v3/146';
const KYBER_API_BASE = 'https://aggregator-api.kyberswap.com/sonic/api/v1';

type AggregatorProvider = 'kyberswap' | 'openocean';

export interface SwapQuoteRequest {
    inTokenAddress: string;
    outTokenAddress: string;
    amount: string; // Amount in units (e.g. 10.5) or minimal units? Usually OpenOcean takes minimal units (wei).
    gasPrice: string;
    slippage: number; // e.g. 1 for 1%
    account: string;
    referrer?: string;
    referrerFee?: number; // e.g. 1 for 1%
}

export interface SwapResponse {
    code: number;
    data: {
        to: string;
        value: string;
        data: string;
        estimatedGas: string;
        outAmount: string;
        minOutAmount: string;
    };
    message: string;
}

export const AggregatorAPI = {
    /**
     * Get swap data from KyberSwap
     */
    async getKyberSwapData(params: SwapQuoteRequest): Promise<SwapResponse> {
        try {
            // Step 1: Get route
            const routeQuery = new URLSearchParams({
                tokenIn: params.inTokenAddress,
                tokenOut: params.outTokenAddress,
                amountIn: params.amount,
            });

            const routeUrl = `${KYBER_API_BASE}/routes?${routeQuery.toString()}`;
            const routeResponse = await fetch(routeUrl);
            
            if (!routeResponse.ok) {
                throw new Error(`KyberSwap route failed: ${routeResponse.statusText}`);
            }

            const routeData = await routeResponse.json();
            
            if (!routeData.data?.routeSummary) {
                throw new Error('No route found from KyberSwap');
            }

            // Step 2: Build swap transaction
            const buildUrl = `${KYBER_API_BASE}/route/build`;
            const buildResponse = await fetch(buildUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    routeSummary: routeData.data.routeSummary,
                    sender: params.account,
                    recipient: params.account,
                    slippageTolerance: params.slippage * 100, // KyberSwap uses basis points (100 = 1%)
                }),
            });

            if (!buildResponse.ok) {
                throw new Error(`KyberSwap build failed: ${buildResponse.statusText}`);
            }

            const buildData = await buildResponse.json();

            // Transform to our standard format
            return {
                code: 200,
                data: {
                    to: buildData.data.routerAddress,
                    value: buildData.data.value || '0',
                    data: buildData.data.data,
                    estimatedGas: buildData.data.gas || '500000',
                    outAmount: routeData.data.routeSummary.amountOut,
                    minOutAmount: routeData.data.routeSummary.amountOutMin,
                },
                message: 'Success',
            };
        } catch (error: any) {
            throw new Error(`KyberSwap error: ${error.message}`);
        }
    },

    /**
     * Get swap data from OpenOcean
     */
    async getOpenOceanData(params: SwapQuoteRequest): Promise<SwapResponse> {
        const query = new URLSearchParams({
            inTokenAddress: params.inTokenAddress,
            outTokenAddress: params.outTokenAddress,
            amount: params.amount,
            slippage: params.slippage.toString(),
            account: params.account,
            gasPrice: params.gasPrice || '1', // Default gas price for Sonic
        });

        if (params.referrer) {
            query.append('referrer', params.referrer);
            if (params.referrerFee) {
                query.append('referrerFee', params.referrerFee.toString());
            }
        }

        // OpenOcean returns the transaction data directly in the swap_quote response normally, 
        // or through a separate swap/build call. 
        // For V3, it's often /swap_quote
        const url = `${OPENOCEAN_API_BASE}/swap_quote?${query.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            let errorMsg = 'Failed to get swap data';
            try {
                const error = await response.json();
                errorMsg = error.message || error.error || errorMsg;
            } catch (e) {
                errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        if (data.code !== 200) {
            throw new Error(data.message || 'Aggregator returned an error');
        }
        return data;
    },

    /**
     * Get swap data with automatic fallback between providers
     * Tries KyberSwap first, falls back to OpenOcean if it fails
     */
    async getSwapData(params: SwapQuoteRequest, preferredProvider: AggregatorProvider = 'kyberswap'): Promise<SwapResponse> {
        const providers: AggregatorProvider[] = preferredProvider === 'kyberswap' 
            ? ['kyberswap', 'openocean'] 
            : ['openocean', 'kyberswap'];

        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                if (provider === 'kyberswap') {
                    return await this.getKyberSwapData(params);
                } else {
                    return await this.getOpenOceanData(params);
                }
            } catch (error: any) {
                console.warn(`${provider} failed:`, error.message);
                lastError = error;
                // Continue to next provider
            }
        }

        throw lastError || new Error('All aggregators failed');
    }
};
