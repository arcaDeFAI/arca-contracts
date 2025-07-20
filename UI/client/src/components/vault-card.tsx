import { Vault } from '../types/vault';
import TokenPairIcons from './token-pair-icons';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useToast } from '@/hooks/use-toast';
import { VAULT_ABI, CONTRACT_ADDRESSES, TOKEN_ADDRESSES, ERC20_ABI } from '@/lib/contracts';
import { useVaultTvl } from '@/hooks/use-vault-tvl';
import { useVaultTokens } from '@/hooks/use-vault-tokens';
import { useTokenBalance } from '@/hooks/use-token-balance';
import { useLbpTvl } from '@/hooks/use-lbp-tvl';

interface VaultCardProps {
  vault: Vault;
  onClick?: () => void;
}

export default function VaultCard({ vault, onClick }: VaultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmounts, setDepositAmounts] = useState<{[key: string]: string}>({});
  const [withdrawShares, setWithdrawShares] = useState<string>('');
  const [positionStatus, setPositionStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const [approvalStep, setApprovalStep] = useState<'none' | 'approving' | 'depositing'>('none');

  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { data: approvalHash, writeContract: writeApprove } = useWriteContract();

  // Fetch real-time vault TVL data
  const { tvl: farmTvl, sonicPrice, balances, isLoading: tvlLoading } = useVaultTvl(vault.name);

  // Fetch actual contract addresses from strategy
  const { vaultAddress, tokenXAddress, tokenYAddress, isLoading: addressesLoading } = useVaultTokens(vault.name);

  const { data: scusdAllowance, refetch: refetchScusdAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.scUSD as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, vaultAddress as `0x${string}`],
    enabled: !!address && !!vaultAddress,
  });

  const { data: tokenYAllowance, refetch: refetchTokenYAllowance } = useReadContract({
    address: tokenYAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, vaultAddress as `0x${string}`],
    enabled: !!address && !!vaultAddress && !!tokenYAddress,
  });

    const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.USDC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, vaultAddress as `0x${string}`],
    enabled: !!address && !!vaultAddress,
  });

  // Token allowance hooks for approval checking
  //const tokenYAllowance = usdcAllowance;

  // Fetch user's vault shares balance
  const { data: userVaultShares, refetch: refetchVaultShares } = useReadContract({
    address: vaultAddress as `0x${string}`,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    enabled: !!address && !!vaultAddress,
  });

  // Debug logging for vault card balanceOf
  if (vault.name === 'S/USDC' && userVaultShares !== undefined) {
    console.log(`VaultCard balanceOf for ${vault.name}:`, {
      vaultAddress,
      userAddress: address,
      userVaultShares: userVaultShares.toString(),
      sharesDecimal: Number(userVaultShares) / 1e12
    });
  }

  // Fetch real pool TVL from LBP contract
  const { tvl: poolTvl, reserves, price: lbpPrice, isLoading: lbpLoading } = useLbpTvl(vault.name);

  // Fetch user's token balances using addresses from strategy contract
  const tokenXBalance = useTokenBalance(tokenXAddress);
  const tokenYBalance = useTokenBalance(tokenYAddress);

  // Debug log to check token addresses and balances
  console.log('Token addresses and balances:', {
    tokenXAddress,
    tokenYAddress,
    tokenXBalance: tokenXBalance.balance,
    tokenYBalance: tokenYBalance.balance,
    tokenXLoading: tokenXBalance.isLoading,
    tokenYLoading: tokenYBalance.isLoading,
    tokenXDecimals: tokenXBalance.decimals,
    tokenYDecimals: tokenYBalance.decimals,
    addressesLoading
  });



  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  // Reset approval step when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setApprovalStep('none');
      // Clear amounts based on active tab
      if (activeTab === 'deposit') {
        setDepositAmounts({});
        toast({
          title: "Deposit successful!",
          description: "Your tokens have been deposited successfully",
        });
      } else {
        setWithdrawShares('');
        toast({
          title: "Withdrawal queued!",
          description: "Your withdrawal has been queued successfully",
        });
      }
      // Refetch user shares
      refetchVaultShares();
    }
  }, [isConfirmed, activeTab, toast, refetchVaultShares]);

  const { isLoading: isApprovalConfirming, isSuccess: isApprovalConfirmed } =
    useWaitForTransactionReceipt({ hash: approvalHash });

  // Use the actual vault address from the strategy contract
  const VAULT_CONTRACT_ADDRESS = vaultAddress;

  // Reset approval step when approval is confirmed
  useEffect(() => {
    if (isApprovalConfirmed) {
      setApprovalStep('none');
      // Refetch allowances to update the UI
      refetchTokenYAllowance();
      refetchScusdAllowance();
      refetchUsdcAllowance();
    }
  }, [isApprovalConfirmed, refetchTokenYAllowance, refetchScusdAllowance, refetchUsdcAllowance]);

  // Watch for Deposit events to update position status
  useWatchContractEvent({
    address: VAULT_CONTRACT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI,
    eventName: 'Deposit',
    onLogs: (logs) => {
      // Check if any log is for the current user
      logs.forEach((log) => {
        if (log.args.from?.toLowerCase() === address?.toLowerCase()) {
          if (log.args.shares && log.args.shares > 0) {
            setPositionStatus('Active');
          }
        }
      });
    },
  });

    const handleApproveScUSD = async () => {
      if (!isConnected) {
        toast({
          title: "Wallet not connected",
          description: "Please connect your wallet to approve scUSD",
          variant: "destructive",
        });
        return;
      }

      try {
        setApprovalStep('approving');
        await writeApprove({
          address: TOKEN_ADDRESSES.scUSD as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [VAULT_CONTRACT_ADDRESS as `0x${string}`, parseUnits('1000000000', 6)], // Approve a large amount
        });

        toast({
          title: "Approval submitted",
          description: "scUSD approval is being processed",
        });
      } catch (error) {
        console.error('Approval error:', error);
        setApprovalStep('none');
        toast({
          title: "Approval failed",
          description: "Failed to submit scUSD approval transaction",
          variant: "destructive",
        });
      }
    };

       const handleApproveUSDC = async () => {
      if (!isConnected) {
        toast({
          title: "Wallet not connected",
          description: "Please connect your wallet to approve USDC",
          variant: "destructive",
        });
        return;
      }

      try {
        setApprovalStep('approving');
        await writeApprove({
          address: TOKEN_ADDRESSES.USDC as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [VAULT_CONTRACT_ADDRESS as `0x${string}`, parseUnits('1000000000', 6)], // Approve a large amount
        });

        toast({
          title: "Approval submitted",
          description: "USDC approval is being processed",
        });
      } catch (error) {
        console.error('Approval error:', error);
        setApprovalStep('none');
        toast({
          title: "Approval failed",
          description: "Failed to submit USDC approval transaction",
          variant: "destructive",
        });
      }
    };

    const handleApproveTokenY = async () => {
      if (!isConnected) {
        toast({
          title: "Wallet not connected",
          description: `Please connect your wallet to approve ${vault.tokens[1]}`,
          variant: "destructive",
        });
        return;
      }

      try {
        setApprovalStep('approving');
        const token1Amount = depositAmounts[vault.tokens[1]] || '0';
        await writeApprove({
          address: tokenYAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [VAULT_CONTRACT_ADDRESS as `0x${string}`, parseUnits(token1Amount, 6)], // Approve a large amount
        });

        toast({
          title: "Approval submitted",
          description: `${vault.tokens[1]} approval is being processed`,
        });
      } catch (error) {
        console.error('Approval error:', error);
        setApprovalStep('none');
        toast({
          title: "Approval failed",
          description: `Failed to submit ${vault.tokens[1]} approval transaction`,
          variant: "destructive",
        });
      }
    };

  const handleProvideLiquidity = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to provide liquidity",
        variant: "destructive",
      });
      return;
    }

    // Check if user has entered amounts for both tokens
    const token0Amount = depositAmounts[vault.tokens[0]] || '0';
    const token1Amount = depositAmounts[vault.tokens[1]] || '0';

    if (parseFloat(token0Amount) === 0 && parseFloat(token1Amount) === 0) {
      toast({
        title: "No amounts entered",
        description: "Please enter amounts for at least one token",
        variant: "destructive",
      });
      return;
    }

    try {
      setApprovalStep('depositing');

      // Convert amounts to proper units (18 decimals for S token, 6 decimals for scUSD)
      const amountX = parseFloat(token0Amount) > 0 ? parseUnits(token0Amount, 18) : 0n;
      const amountY = parseFloat(token1Amount) > 0 ? parseUnits(token1Amount, 6) : 0n;

      // Call the vault's depositNative function for S token deposits
      await writeContract({
        address: VAULT_CONTRACT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'depositNative',
        args: [
          amountX,      // Amount of S token (passed as native value)
          amountY,      // Amount of scUSD to deposit
          0n            // Minimum shares
        ],
        value: amountX, // Send native S token as value
      });

      toast({
        title: "Transaction submitted",
        description: "Your liquidity deposit is being processed",
      });
    } catch (error) {
      console.error('Deposit error:', error);
      setApprovalStep('none');
      toast({
        title: "Transaction failed",
        description: "Failed to submit deposit transaction",
        variant: "destructive",
      });
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to withdraw",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(withdrawShares) === 0 || !withdrawShares) {
      toast({
        title: "No shares entered",
        description: "Please enter share amount to withdraw",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert share amount to proper format (multiply by 10^12)
      const sharesToWithdraw = parseUnits(withdrawShares, 12);

      await writeContract({
        address: VAULT_CONTRACT_ADDRESS as `0x${string}`,
        abi: VAULT_ABI,
        functionName: 'queueWithdrawal',
        args: [
          sharesToWithdraw, // Shares to withdraw (multiplied by 10^12)
          address as `0x${string}` // Recipient address
        ],
      });

      toast({
        title: "Withdrawal queued",
        description: "Your withdrawal has been queued for processing",
      });
    } catch (error) {
      console.error('Withdraw error:', error);
      toast({
        title: "Transaction failed",
        description: "Failed to submit withdrawal transaction",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (token: string, value: string) => {
    if (activeTab === 'deposit') {
      setDepositAmounts(prev => ({
        ...prev,
        [token]: value
      }));
    } else {
      setWithdrawShares(value);
    }
  };

  const handlePercentageClick = (token: string, percentage: number) => {
    if (activeTab === 'deposit') {
      const balance = token === 'S' ? tokenXBalance.balance : tokenYBalance.balance;
      const amount = (parseFloat(balance) * percentage / 100).toFixed(6);
      setDepositAmounts(prev => ({ ...prev, [token]: amount }));
    } else {
      // For withdraw, use vault shares balance (shares are stored with 10^12 precision)
      const sharesBalance = userVaultShares ? Number(userVaultShares) / 1e12 : 0;
      const amount = (sharesBalance * percentage / 100).toFixed(6);
      setWithdrawShares(amount);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleCardClick = () => {
    setIsExpanded(!isExpanded);
    if (onClick) onClick();
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className={`hidden sm:block mx-4 mb-4 ${isExpanded ? 'vault-card-glow' : 'vault-card'}`}>
        <div 
          className={`grid grid-cols-4 gap-6 px-6 py-6 bg-arca-surface border border-arca-border transition-all duration-300 cursor-pointer ${
            isExpanded ? 'rounded-t-xl' : 'rounded-xl'
          }`}
          onClick={handleCardClick}
        >
          {/* Pool */}
          <div className="flex items-center space-x-3">
            <TokenPairIcons tokens={vault.tokens} />
            <div>
              <div className="text-white font-semibold">{vault.name}</div>
              <div className="text-arca-secondary text-sm">{vault.platform}</div>
            </div>
          </div>

          {/* Pool TVL */}
          <div className="flex items-center">
            <span className="text-white font-medium">
              {formatCurrency(poolTvl || vault.poolTvl)}
            </span>
          </div>

          {/* Farm TVL */}
          <div className="flex items-center">
            <span className="text-white font-medium">{formatCurrency(farmTvl)}</span>
          </div>

          {/* Rewards */}
          <div className="flex items-center justify-between">
            <div>
              <div className="arca-primary font-bold text-lg">{vault.apr}%</div>
              <div className="text-arca-secondary text-sm">({vault.aprDaily}% daily)</div>
            </div>
            {/* Active Position Indicator */}
            {userVaultShares && Number(userVaultShares) > 0 && (
              <div className="flex items-center space-x-2 ml-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="bg-gradient-to-b from-arca-surface to-arca-bg border border-arca-border border-t-0 rounded-b-xl px-6 py-6 -mt-1 shadow-2xl">
            <div className="grid grid-cols-1 gap-6">
              {/* Main Section - Deposit/Withdraw */}
              <div className="bg-arca-surface rounded-xl p-6 border border-gray-800">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex bg-black rounded-xl p-1 border border-gray-700 hover:border-gray-600 transition-all duration-200">
                    <button 
                      className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'deposit' 
                          ? 'bg-arca-primary text-black' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveTab('deposit')}
                    >
                      Deposit
                    </button>
                    <button 
                      className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                        activeTab === 'withdraw' 
                          ? 'bg-arca-primary text-black' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveTab('withdraw')}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                {/* Token Input Fields */}
                <div className="space-y-5">
                  {activeTab === 'deposit' ? (
                    vault.tokens.map((token, index) => (
                      <div key={token} className="space-y-3 group">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-sm font-medium">{token} to Add</span>
                          <div className="text-right">
                            <span className="text-gray-400 text-sm">
                              Balance: {index === 0 ? 
                                (tokenXBalance.isLoading ? 'Loading...' : Number(tokenXBalance.balance).toFixed(5)) : 
                                (tokenYBalance.isLoading ? 'Loading...' : Number(tokenYBalance.balance).toFixed(5))
                              }
                            </span>
                            {token === 'S' && sonicPrice && (
                              <div className="text-emerald-400 text-xs font-medium">
                                ${sonicPrice.toFixed(4)} per {token}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative bg-black rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-200">
                          <div className="flex items-center p-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                              token === 'S' ? 'bg-gradient-to-r from-gray-600 to-gray-700' : 'bg-gradient-to-r from-green-500 to-emerald-500'
                            }`}>
                              <span className="text-white text-sm font-bold">{token.charAt(0)}</span>
                            </div>
                            <input 
                              type="text" 
                              placeholder="0.0"
                              value={depositAmounts[token] || ''}
                              onChange={(e) => handleInputChange(token, e.target.value)}
                              className="flex-1 bg-transparent text-white text-xl font-semibold border-none outline-none ml-4 placeholder-gray-500"
                            />
                            <div className="flex flex-col space-y-1">
                              <button 
                                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-black text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                                onClick={() => handlePercentageClick(token, 50)}
                              >
                                50%
                              </button>
                              <button 
                                className="px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-black text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                                onClick={() => handlePercentageClick(token, 100)}
                              >
                                MAX
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3 group">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm font-medium">Shares to Withdraw</span>
                        <div className="text-right">
                          <span className="text-gray-400 text-sm">
                            Available: {userVaultShares ? (Number(userVaultShares) / 1e12).toFixed(8) : '0.00000000'}
                          </span>
                          <div className="text-red-400 text-xs font-medium">
                            LP Shares
                          </div>
                        </div>
                      </div>
                      <div className="relative bg-black rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-200">
                        <div className="flex items-center p-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center shadow-lg">
                            <span className="text-white text-sm font-bold">S</span>
                          </div>
                          <input 
                            type="text" 
                            placeholder="0.0"
                            value={withdrawShares}
                            onChange={(e) => handleInputChange('shares', e.target.value)}
                            className="flex-1 bg-transparent text-white text-xl font-semibold border-none outline-none ml-4 placeholder-gray-500"
                          />
                          <div className="flex flex-col space-y-1">
                            <button 
                                className="px-3 py-1 bg-green-500 hover:bg-green-400 text-black text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                                onClick={() => handlePercentageClick('shares', 50)}
                              >
                                50%
                              </button>
                              <button 
                                className="px-3 py-1 bg-green-500 hover:bg-green-400 text-black text-xs font-medium rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                                onClick={() => handlePercentageClick('shares', 100)}
                              >
                                MAX
                              </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Desktop */}
                <div className="mt-8 space-y-4">
                  {activeTab === 'deposit' ? (
                    (() => {
                      const token1Amount = depositAmounts[vault.tokens[1]] || '0';
                      const tokenAmountFloat = parseFloat(token1Amount);
                      const isUSDC = vault.tokens[1].toLowerCase() === 'usdc';
                      const currentAllowance = usdcAllowance || 0n;

                      // Check if we have a valid amount greater than 0.1
                      const hasValidAmount = !isNaN(tokenAmountFloat) && tokenAmountFloat >= 0.1;

                      let tokenYAmount = 0n;
                      let needsApproval = false;

                      if (hasValidAmount && isUSDC) {
                        try {
                          tokenYAmount = parseUnits(token1Amount, 6);
                          needsApproval = tokenYAmount > 0n && currentAllowance < tokenYAmount;
                        } catch (error) {
                          console.error('Error parsing token amount:', error);
                        }
                      }

                      if (needsApproval && approvalStep === 'none') {
                        return (
                          <button
                            onClick={handleApproveUSDC}
                            disabled={isPending || isConfirming}
                            className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending || isConfirming ? 'Processing...' : `Approve ${vault.tokens[1]}`}
                          </button>
                        );
                      } else if (approvalStep === 'approving') {
                        return (
                          <button
                            disabled={true}
                            className="w-full bg-arca-primary text-black py-2 rounded-lg font-medium text-sm opacity-50 cursor-not-allowed"
                          >
                            Approving...
                          </button>
                        );
                      } else {
                        return (
                          <button
                            onClick={handleProvideLiquidity}
                            disabled={isPending || isConfirming || approvalStep === 'depositing'}
                            className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {approvalStep === 'depositing' ? 'Depositing...' : 
                             isPending || isConfirming ? 'Processing...' : 'Deposit Tokens'}
                          </button>
                        );
                      }
                    })()
                  ) : (
                    <button
                      onClick={handleWithdraw}
                      disabled={isPending || isConfirming}
                      className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending || isConfirming ? 'Processing...' : 'Queue Withdrawal'}
                    </button>
                  )}
                  <button 
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-medium text-sm transition-all duration-200"
                    onClick={() => window.location.href = '/dashboard'}
                  >
                    MANAGE POSITION
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Layout */}
      <div className={`sm:hidden mx-4 mb-4 ${isExpanded ? 'vault-card-glow' : 'vault-card'}`}>
        <div 
          className={`px-4 py-4 bg-arca-surface border border-arca-border transition-all duration-300 cursor-pointer ${
            isExpanded ? 'rounded-t-xl' : 'rounded-xl'
          }`}
          onClick={handleCardClick}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <TokenPairIcons tokens={vault.tokens} />
              <div>
                <div className="text-white font-semibold">{vault.name}</div>
                <div className="text-arca-secondary text-sm">{vault.platform}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="arca-primary font-bold text-lg">{vault.apr}%</div>
              <div className="text-arca-secondary text-xs">({vault.aprDaily}% daily)</div>
              {/* Active Position Indicator - Mobile */}
              {userVaultShares && Number(userVaultShares) > 0 && (
                <div className="flex items-center justify-end space-x-1 mt-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs font-medium">Active</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-arca-secondary text-xs">POOL TVL</div>
              <div className="text-white font-medium">
                {formatCurrency(poolTvl || vault.poolTvl)}
              </div>
            </div>
            <div>
              <div className="text-arca-secondary text-xs">FARM TVL</div>
              <div className="text-white font-medium">{formatCurrency(farmTvl)}</div>
            </div>
          </div>
        </div>

        {/* Mobile Expanded Details */}
        {isExpanded && (
          <div className="bg-gradient-to-b from-arca-surface to-arca-bg border border-arca-border border-t-0 rounded-b-xl px-4 py-4 -mt-1 shadow-2xl">
            {/* Mobile Deposit/Withdraw */}
            <div className="bg-arca-surface rounded-xl p-4 border border-gray-800">
                <div className="flex justify-center items-center mb-4">
                  <div className="flex bg-black rounded-xl p-1 border border-gray-700 hover:border-gray-600 transition-all duration-200">
                    <button 
                      className={`px-4 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                        activeTab === 'deposit' 
                          ? 'bg-arca-primary text-black' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveTab('deposit')}
                    >
                      Deposit
                    </button>
                    <button 
                      className={`px-4 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                        activeTab === 'withdraw' 
                          ? 'bg-arca-primary text-black' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveTab('withdraw')}
                    >
                      Withdraw
                    </button>
                  </div>
                </div>

                {/* Token Input Fields */}
                <div className="space-y-4">
                  {activeTab === 'deposit' ? (
                    vault.tokens.map((token, index) => (
                      <div key={token} className="space-y-2 group">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-xs font-medium">{token} to Add</span>
                          <div className="text-right">
                            <span className="text-gray-400 text-xs">
                              {index === 0 ? 
                                (tokenXBalance.isLoading ? 'Loading...' : Number(tokenXBalance.balance).toFixed(3)) : 
                                (tokenYBalance.isLoading ? 'Loading...' : Number(tokenYBalance.balance).toFixed(3))
                              }
                            </span>
                            {token === 'S' && sonicPrice && (
                              <div className="text-emerald-400 text-xs font-medium">
                                ${sonicPrice.toFixed(3)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative bg-black rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200">
                          <div className="flex items-center p-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                              token === 'S' ? 'bg-gradient-to-r from-gray-600 to-gray-700' : 'bg-gradient-to-r from-green-500 to-emerald-500'
                            }`}>
                              <span className="text-white text-xs font-bold">{token.charAt(0)}</span>
                            </div>
                            <input 
                              type="text" 
                              placeholder="0.0"
                              value={depositAmounts[token] || ''}
                              onChange={(e) => handleInputChange(token, e.target.value)}
                              className="flex-1 bg-transparent text-white text-lg font-semibold border-none outline-none ml-3 placeholder-gray-500"
                            />
                            <div className="flex space-x-1">
                              <button 
                                className="px-2 py-1 bg-green-600 hover:bg-green-500 text-black text-xs font-medium rounded transition-all duration-200"
                                onClick={() => handlePercentageClick(token, 50)}
                              >
                                50%
                              </button>
                              <button 
                                className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-black text-xs font-medium rounded transition-all duration-200"
                                onClick={() => handlePercentageClick(token, 100)}
                              >
                                MAX
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 text-xs font-medium">Shares to Withdraw</span>
                        <div className="text-right">
                          <span className="text-gray-400 text-xs">
                            {userVaultShares ? (Number(userVaultShares) / 1e12).toFixed(8) : '0.00000000'}
                          </span>
                          <div className="text-red-400 text-xs font-medium">
                            LP Shares
                          </div>
                        </div>
                      </div>
                      <div className="relative bg-black rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200">
                        <div className="flex items-center p-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center shadow-lg">
                            <span className="text-white text-xs font-bold">S</span>
                          </div>
                          <input 
                            type="text" 
                            placeholder="0.0"
                            value={withdrawShares}
                            onChange={(e) => handleInputChange('shares', e.target.value)}
                            className="flex-1 bg-transparent text-white text-lg font-semibold border-none outline-none ml-3 placeholder-gray-500"
                          />
                          <div className="flex space-x-1">
                            <button 
                                className="px-2 py-1 bg-green-500 hover:bg-green-400 text-black text-xs font-medium rounded transition-all duration-200"
                                onClick={() => handlePercentageClick('shares', 50)}
                              >
                                50%
                              </button>
                              <button 
                                className="px-2 py-1 bg-green-500 hover:bg-green-400 text-black text-xs font-medium rounded transition-all duration-200"
                                onClick={() => handlePercentageClick('shares', 100)}
                              >
                                MAX
                              </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Mobile */}
                <div className="mt-6 space-y-3">
                  {activeTab === 'deposit' ? (
                    (() => {
                      const token1Amount = depositAmounts[vault.tokens[1]] || '0';
                      const tokenAmountFloat = parseFloat(token1Amount);
                      const isUSDC = vault.tokens[1].toLowerCase() === 'usdc';
                      const currentAllowance = usdcAllowance || 0n;

                      // Check if we have a valid amount greater than 0.1
                      const hasValidAmount = !isNaN(tokenAmountFloat) && tokenAmountFloat >= 0.1;

                      let tokenYAmount = 0n;
                      let needsApproval = false;

                      if (hasValidAmount && isUSDC) {
                        try {
                          tokenYAmount = parseUnits(token1Amount, 6);
                          needsApproval = tokenYAmount > 0n && currentAllowance < tokenYAmount;
                        } catch (error) {
                          console.error('Error parsing token amount:', error);
                        }
                      }

                      if (needsApproval && approvalStep === 'none') {
                        return (
                          <button
                            onClick={handleApproveUSDC}
                            disabled={isPending || isConfirming}
                            className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending || isConfirming ? 'Processing...' : `Approve ${vault.tokens[1]}`}
                          </button>
                        );
                      } else if (approvalStep === 'approving') {
                        return (
                          <button
                            disabled={true}
                            className="w-full bg-arca-primary text-black py-2 rounded-lg font-medium text-xs opacity-50 cursor-not-allowed"
                          >
                            Approving...
                          </button>
                        );
                      } else {
                        return (
                          <button
                            onClick={handleProvideLiquidity}
                            disabled={isPending || isConfirming || approvalStep === 'depositing'}
                            className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {approvalStep === 'depositing' ? 'Depositing...' : 
                             isPending || isConfirming ? 'Processing...' : 'Deposit Tokens'}
                          </button>
                        );
                      }
                    })()
                  ) : (
                    <button
                      onClick={handleWithdraw}
                      disabled={isPending || isConfirming}
                      className="w-full bg-arca-primary hover:bg-green-400 text-black py-2 rounded-lg font-medium text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending || isConfirming ? 'Processing...' : 'Queue Withdrawal'}
                    </button>
                  )}
                  <button 
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg font-medium text-xs transition-all duration-200"
                    onClick={() => window.location.href = '/dashboard'}
                  >
                    MANAGE POSITION
                  </button>
                </div>
              </div>
          </div>
        )}
      </div>
    </>
  );
}