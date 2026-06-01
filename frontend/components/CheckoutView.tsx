"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { CheckoutPanel } from "@/components/CheckoutPanel";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { UnifiedBalanceAdvancedDetails } from "@/components/UnifiedBalanceAdvancedDetails";
import { UnifiedBalanceDepositCard } from "@/components/UnifiedBalanceDepositCard";
import { UnifiedBalanceSources } from "@/components/UnifiedBalanceSources";
import { UnifiedBalanceStatusPanel } from "@/components/UnifiedBalanceStatusPanel";
import { UnifiedBalanceStepper } from "@/components/UnifiedBalanceStepper";
import { WalletConnect } from "@/components/WalletConnect";
import type {
  UnifiedBalanceChainOption,
  UnifiedBalanceDepositEvidence,
  UnifiedBalanceDepositStatus,
  UnifiedBalancePendingDeposit,
  UnifiedBalanceSnapshot,
  UnifiedBalanceSpendEvidence,
  UnifiedBalanceStatus
} from "@/lib/appkit/types";
import {
  depositToUnifiedBalance,
  getUnifiedBalanceDepositErrorMessage,
  switchWalletToUnifiedBalanceSourceChain,
  unifiedBalancePendingDepositSupportMessage
} from "@/lib/appkit/unifiedBalanceDeposit";
import { getUnifiedBalanceUiState } from "@/lib/appkit/unifiedBalanceCheckoutUi";
import {
  clearUnifiedBalanceSession,
  loadUnifiedBalanceSession,
  saveUnifiedBalanceSession,
  type UnifiedBalanceSessionStep
} from "@/lib/appkit/unifiedBalanceSession";
import {
  buildUnifiedBalanceSpendPreparation,
  buildUnifiedBalanceAllocations,
  checkUnifiedBalance,
  estimateUnifiedBalanceSpend,
  executeUnifiedBalanceSpend,
  generateUnifiedBalanceReferenceId,
  getBalanceForChain,
  getProductPriceAsUsdcAmount,
  getUnifiedBalanceSourceChains,
  parseUsdcUnits
} from "@/lib/appkit/unifiedBalance";
import { arcVoucherIntentPaymentReceiverAddress } from "@/lib/contracts/arcVoucherIntentPaymentReceiver";
import { useArcVoucherProduct } from "@/lib/contracts/productReads";
import { confirmBackendIntentSpend, createBackendIntent, useIntentStatus, type StoredIntent } from "@/lib/intents";

type PaymentMode = "direct" | "unified";
type PreparedReference = {
  buyer: `0x${string}`;
  productId: number;
  referenceId: `0x${string}`;
};
type UnifiedCheckoutStatus =
  | "idle"
  | "preparing intent"
  | "estimating fees"
  | "waiting wallet confirmation"
  | "spend submitted"
  | "verifying payment"
  | "payment confirmed"
  | "preparing voucher"
  | "voucher ready"
  | "waiting receiver payment"
  | "payment attached"
  | "settlement submitted"
  | "settled"
  | "failed";

export function CheckoutView({ productId }: { productId: number }) {
  const { address, chainId, isConnected } = useAccount();
  const { isPending: isSwitchingDepositChain, switchChainAsync } = useSwitchChain();
  const confirmingSpendHashRef = useRef<string | undefined>(undefined);
  const balancePollingIntervalRef = useRef<number | undefined>(undefined);
  const balancePollingTimeoutRef = useRef<number | undefined>(undefined);
  const depositElapsedIntervalRef = useRef<number | undefined>(undefined);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("direct");
  const [supportedChains] = useState(() => getUnifiedBalanceSourceChains());
  const [selectedChainIds, setSelectedChainIds] = useState(() => getInitialSelectedChainIds(getUnifiedBalanceSourceChains()));
  const [preparedReference, setPreparedReference] = useState<PreparedReference | undefined>();
  const [backendIntent, setBackendIntent] = useState<StoredIntent | undefined>();
  const [spendEvidence, setSpendEvidence] = useState<UnifiedBalanceSpendEvidence | undefined>();
  const [unifiedCheckoutStatus, setUnifiedCheckoutStatus] = useState<UnifiedCheckoutStatus>("idle");
  const [unifiedCheckoutError, setUnifiedCheckoutError] = useState<string | undefined>();
  const [depositAmount, setDepositAmount] = useState<string | undefined>();
  const [depositChainId, setDepositChainId] = useState<string | undefined>();
  const [depositStatus, setDepositStatus] = useState<UnifiedBalanceDepositStatus>("idle");
  const [depositEvidence, setDepositEvidence] = useState<UnifiedBalanceDepositEvidence | undefined>();
  const [depositError, setDepositError] = useState<string | undefined>();
  const [pendingDeposit, setPendingDeposit] = useState<UnifiedBalancePendingDeposit | undefined>();
  const [pendingDepositElapsedSeconds, setPendingDepositElapsedSeconds] = useState(0);
  const [isCheckingPendingDeposits, setIsCheckingPendingDeposits] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [currentStepStartedAt, setCurrentStepStartedAt] = useState(0);
  const [stepElapsedSeconds, setStepElapsedSeconds] = useState(0);
  const [previousUiStep, setPreviousUiStep] = useState<UnifiedBalanceSessionStep | undefined>();
  const { product, isFallback, isLoading, refetch } = useArcVoucherProduct(productId);
  const amountRequired = product ? getProductPriceAsUsdcAmount(product.price) : "0";
  const depositDisplayAmount = depositAmount ?? amountRequired;
  const selectedDepositChainId = depositChainId ?? selectedChainIds[0] ?? supportedChains[0]?.id;
  const selectedDepositChain = supportedChains.find((chain) => chain.id === selectedDepositChainId) ?? supportedChains[0];
  const currentWalletSourceChain = supportedChains.find((chain) => chain.evmChainId === chainId);
  const isDepositChainMismatch = Boolean(isConnected && selectedDepositChain?.evmChainId && chainId !== selectedDepositChain.evmChainId);
  const referenceId =
    preparedReference && preparedReference.buyer === address && preparedReference.productId === product?.id
      ? preparedReference.referenceId
      : undefined;
  const selectedChains = useMemo(
    () => supportedChains.filter((chain) => selectedChainIds.includes(chain.id)).map((chain) => chain.chain),
    [selectedChainIds, supportedChains]
  );
  const balanceQuery = useQuery({
    enabled: paymentMode === "unified" && isConnected && Boolean(address),
    queryFn: () =>
      checkUnifiedBalance({
        address: address!,
        chains: selectedChains
      }),
    queryKey: ["arcvoucher-unified-balance", address, selectedChainIds]
  });
  const allocationState = useMemo(
    () =>
      buildUnifiedBalanceAllocations({
        amount: amountRequired,
        balances: balanceQuery.data,
        selectedChains: selectedChainIds,
        supportedChains
      }),
    [amountRequired, balanceQuery.data, selectedChainIds, supportedChains]
  );
  const canEstimateFees =
    paymentMode === "unified" &&
    isConnected &&
    Boolean(address) &&
    allocationState.hasSufficientBalance &&
    allocationState.allocations.length > 0;
  const feeEstimateQuery = useQuery({
    enabled: canEstimateFees,
    queryFn: () =>
      estimateUnifiedBalanceSpend({
        allocations: allocationState.allocations,
        amount: amountRequired,
        recipientAddress: arcVoucherIntentPaymentReceiverAddress
      }),
    queryKey: [
      "arcvoucher-unified-balance-fee-estimate",
      address,
      amountRequired,
      arcVoucherIntentPaymentReceiverAddress,
      allocationState.allocations.map((allocation) => `${allocation.chainId}:${allocation.amount}`).join("|")
    ],
    retry: false
  });
  const unifiedPreparation = useMemo(
    () =>
      address && product && referenceId
        ? buildUnifiedBalanceSpendPreparation({
            allocations: allocationState.allocations,
            amount: amountRequired,
            amountWei: product.price,
            buyer: address,
            estimatedFees: feeEstimateQuery.data,
            productId: product.id,
            receiverAddress: arcVoucherIntentPaymentReceiverAddress,
            referenceId,
            selectedChainIds
          })
        : undefined,
    [address, allocationState.allocations, amountRequired, feeEstimateQuery.data, product, referenceId, selectedChainIds]
  );
  const intentStatusQuery = useIntentStatus(backendIntent?.intentId);
  const currentIntent = intentStatusQuery.data?.intent ?? backendIntent;
  const displayedUnifiedStatus = getDisplayedUnifiedStatus({
    currentIntent,
    hasSpendEvidence: Boolean(spendEvidence),
    localStatus: unifiedCheckoutStatus
  });
  const isUnifiedCheckoutBusy = isBusyUnifiedStatus(displayedUnifiedStatus);
  const isVoucherReady = intentStatusQuery.data?.voucherStatus === "fulfilled" || currentIntent?.status === "voucher_fulfilled";
  const isUnifiedFailed = displayedUnifiedStatus === "failed";
  const uiState = getUnifiedBalanceUiState({
    errorMessage: unifiedCheckoutError ?? intentStatusQuery.error?.message,
    hasSufficientBalance: allocationState.hasSufficientBalance,
    intent: currentIntent,
    intentStatus: intentStatusQuery.data,
    localStatus: displayedUnifiedStatus,
    pendingDeposit,
    spendSubmitted: Boolean(spendEvidence?.txHash || spendEvidence?.transferId)
  });
  const unifiedBalanceStatus = getUnifiedBalanceStatus({
    balanceError: balanceQuery.isError,
    hasSufficientBalance: allocationState.hasSufficientBalance,
    isConnected,
    isLoading: balanceQuery.isLoading,
    supportedChains
  });
  const pendingTransactions = selectedDepositChain
    ? (balanceQuery.data?.breakdown.find((balance) => balance.chain === selectedDepositChain.id)?.pendingTransactions ?? [])
    : [];
  const confirmSpendWithBackend = useCallback(
    async (intent: StoredIntent, evidence: UnifiedBalanceSpendEvidence) => {
      if (!address || !product) {
        return;
      }

      if (!evidence.txHash) {
        throw new Error("Unified Balance spend did not return a transaction hash to verify.");
      }

      if (confirmingSpendHashRef.current === evidence.txHash) {
        return;
      }

      confirmingSpendHashRef.current = evidence.txHash;
      setUnifiedCheckoutStatus("verifying payment");

      try {
        const result = await confirmBackendIntentSpend({
          buyer: address,
          expectedAmount: product.price.toString(),
          intentId: intent.intentId,
          recipient: arcVoucherIntentPaymentReceiverAddress,
          spendTxHash: evidence.txHash as Hex
        });
        setBackendIntent(result.intent);
        setUnifiedCheckoutStatus(result.voucherStatus === "fulfilled" || result.intent.status === "voucher_fulfilled" ? "voucher ready" : "preparing voucher");
        void intentStatusQuery.refetch();
      } catch (error) {
        setUnifiedCheckoutError(error instanceof Error ? error.message : String(error));
        setUnifiedCheckoutStatus("failed");
      } finally {
        confirmingSpendHashRef.current = undefined;
      }
    },
    [address, intentStatusQuery, product]
  );

  useEffect(
    () => () => {
      clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
    },
    []
  );

  useEffect(() => {
    if (!address || !product || sessionRestored) {
      return;
    }

    const session = loadUnifiedBalanceSession({ buyer: address, productId: product.id });
    if (!session) {
      return;
    }

    const restoreTimeout = window.setTimeout(() => {
      setPaymentMode("unified");
      setSessionRestored(true);
      setCurrentStepStartedAt(session.updatedAt);
      setPreviousUiStep(session.currentStep);
      if (session.referenceId) {
        setPreparedReference({
          buyer: address,
          productId: product.id,
          referenceId: session.referenceId
        });
      }
      if (session.intentId && session.referenceId) {
        setBackendIntent({
          buyer: address,
          createdAt: new Date(session.createdAt).toISOString(),
          expectedAmount: product.price.toString(),
          expiresAt: new Date(session.createdAt + 60 * 60 * 1000).toISOString(),
          intentId: session.intentId,
          productId: product.id.toString(),
          rawPaymentId: null,
          referenceId: session.referenceId,
          status: "created",
          storeOrderId: null,
          updatedAt: new Date(session.updatedAt).toISOString()
        });
      }
      if (session.spendTxHash || session.transferId) {
        setSpendEvidence({
          raw: {},
          transferId: session.transferId,
          txHash: session.spendTxHash
        });
        setUnifiedCheckoutStatus("spend submitted");
      }
      if (session.depositTxHash && session.depositAmount && session.depositSourceChainId) {
        const sourceChain = supportedChains.find((chain) => chain.id === session.depositSourceChainId);
        setPendingDeposit({
          amount: session.depositAmount,
          confirmedAt: session.updatedAt,
          sourceChainId: session.depositSourceChainId,
          sourceChainLabel: sourceChain?.title ?? session.depositSourceChainId,
          startingConfirmedBalance: "0",
          status: session.currentStep === "deposit" ? "waiting_gateway" : "balance_updated",
          txHash: session.depositTxHash
        });
        setDepositEvidence({
          amount: session.depositAmount,
          chain: session.depositSourceChainId,
          raw: {},
          txHash: session.depositTxHash
        });
        setDepositStatus("success");
      }
    }, 0);

    return () => window.clearTimeout(restoreTimeout);
  }, [address, product, sessionRestored, supportedChains]);

  useEffect(() => {
    if (!address || !product || paymentMode !== "unified") {
      return;
    }

    const hasSessionWork = backendIntent?.intentId || preparedReference?.referenceId || spendEvidence?.txHash || spendEvidence?.transferId || pendingDeposit?.txHash;
    if (!hasSessionWork) {
      return;
    }

    saveUnifiedBalanceSession({
      buyer: address,
      createdAt: pendingDeposit?.confirmedAt ?? currentStepStartedAt,
      currentStep: uiState.currentStep,
      depositAmount: pendingDeposit?.amount,
      depositSourceChainId: pendingDeposit?.sourceChainId,
      depositTxHash: pendingDeposit?.txHash,
      intentId: backendIntent?.intentId ?? currentIntent?.intentId,
      productId: product.id,
      referenceId: referenceId ?? preparedReference?.referenceId,
      spendTxHash: spendEvidence?.txHash,
      transferId: spendEvidence?.transferId,
      updatedAt: currentStepStartedAt
    });
  }, [address, backendIntent?.intentId, currentIntent?.intentId, currentStepStartedAt, paymentMode, pendingDeposit, preparedReference?.referenceId, product, referenceId, spendEvidence, uiState.currentStep]);

  useEffect(() => {
    if (previousUiStep !== uiState.currentStep) {
      const stepTimeout = window.setTimeout(() => {
        setPreviousUiStep(uiState.currentStep);
        setCurrentStepStartedAt(Date.now());
        setStepElapsedSeconds(0);
      }, 0);

      return () => window.clearTimeout(stepTimeout);
    }
  }, [previousUiStep, uiState.currentStep]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepElapsedSeconds(Math.floor((Date.now() - currentStepStartedAt) / 1000));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [currentStepStartedAt]);

  useEffect(() => {
    if (!address || !product || !currentIntent || currentIntent.status !== "created" || !spendEvidence?.txHash) {
      return;
    }

    const confirmTimeout = window.setTimeout(() => {
      void confirmSpendWithBackend(currentIntent, spendEvidence);
    }, 0);

    return () => window.clearTimeout(confirmTimeout);
  }, [address, confirmSpendWithBackend, currentIntent, product, spendEvidence]);

  async function handleUnifiedBalanceCheckout() {
    if (!address || !product) {
      return;
    }

    const nextReferenceId = generateUnifiedBalanceReferenceId({ buyer: address, productId: product.id });
    setUnifiedCheckoutError(undefined);
    setSpendEvidence(undefined);
    setUnifiedCheckoutStatus("preparing intent");
    setPreparedReference({
      buyer: address,
      productId: product.id,
      referenceId: nextReferenceId
    });

    try {
      const intent = await createBackendIntent({
        buyer: address,
        expectedAmount: product.price.toString(),
        productId: product.id,
        referenceId: nextReferenceId
      });
      setBackendIntent(intent);
      setUnifiedCheckoutStatus("estimating fees");
      await balanceQuery.refetch();

      if (canEstimateFees) {
        await feeEstimateQuery.refetch();
      }

      setUnifiedCheckoutStatus("waiting wallet confirmation");
      const evidence = await executeUnifiedBalanceSpend({
        allocations: allocationState.allocations,
        amount: amountRequired,
        recipientAddress: arcVoucherIntentPaymentReceiverAddress
      });
      setSpendEvidence(evidence);
      setUnifiedCheckoutStatus("verifying payment");
      await confirmSpendWithBackend(intent, evidence);
    } catch (error) {
      setUnifiedCheckoutError(error instanceof Error ? error.message : String(error));
      setUnifiedCheckoutStatus("failed");
    }
  }

  async function handleUnifiedBalanceDeposit() {
    if (!isConnected || !selectedDepositChain) {
      return;
    }

    const normalizedAmount = normalizeDepositAmount(depositDisplayAmount);
    if (!isPositiveDecimal(normalizedAmount)) {
      setDepositError("Enter a valid USDC amount to deposit.");
      setDepositStatus("failed");
      return;
    }

    setDepositError(undefined);
    setDepositEvidence(undefined);

    if (isDepositChainMismatch) {
      setDepositError(`Wallet chain mismatch. Switch wallet to ${selectedDepositChain.title} before depositing.`);
      return;
    }

    setDepositStatus("waiting_wallet");

    try {
      const startingConfirmedBalance = getBalanceForChain(balanceQuery.data, selectedDepositChain.id);
      const evidence = await depositToUnifiedBalance({
        amount: normalizedAmount,
        sourceChain: selectedDepositChain.chain
      });
      setDepositEvidence(evidence);
      setDepositStatus("success");
      startPostDepositBalancePolling({
        amount: evidence.amount ?? normalizedAmount,
        evidence,
        sourceChain: selectedDepositChain,
        startingConfirmedBalance
      });
    } catch (error) {
      setDepositError(getUnifiedBalanceDepositErrorMessage(error, selectedDepositChain));
      setDepositStatus("failed");
    }
  }

  async function handleSwitchDepositChain() {
    if (!selectedDepositChain) {
      return;
    }

    setDepositError(undefined);

    try {
      await switchWalletToUnifiedBalanceSourceChain({
        sourceChain: selectedDepositChain,
        switchChainAsync
      });
    } catch (error) {
      setDepositError(getUnifiedBalanceDepositErrorMessage(error, selectedDepositChain));
      setDepositStatus("failed");
    }
  }

  function handleResetUnifiedSession() {
    if (address && product) {
      clearUnifiedBalanceSession({ buyer: address, productId: product.id });
    }

    clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
    setBackendIntent(undefined);
    setPreparedReference(undefined);
    setSpendEvidence(undefined);
    setPendingDeposit(undefined);
    setDepositEvidence(undefined);
    setDepositError(undefined);
    setUnifiedCheckoutError(undefined);
    setUnifiedCheckoutStatus("idle");
    setDepositStatus("idle");
    setSessionRestored(false);
    setPreviousUiStep(undefined);
  }

  function handleRetryUnifiedBalance() {
    if (currentIntent && spendEvidence?.txHash) {
      void confirmSpendWithBackend(currentIntent, spendEvidence);
      return;
    }

    if (currentIntent?.rawPaymentId || spendEvidence?.transferId) {
      void intentStatusQuery.refetch();
      return;
    }

    setUnifiedCheckoutError(undefined);
    setUnifiedCheckoutStatus("idle");
  }

  async function handleCheckPendingDeposits() {
    setIsCheckingPendingDeposits(true);

    try {
      const result = await balanceQuery.refetch();
      if (pendingDeposit && result.data) {
        setPendingDeposit((current) =>
          current
            ? {
                ...current,
                status: getPendingDepositBalanceStatus({
                  amount: current.amount,
                  snapshot: result.data,
                  sourceChainId: current.sourceChainId,
                  startingConfirmedBalance: current.startingConfirmedBalance
                })
              }
            : current
        );
      }
    } finally {
      setIsCheckingPendingDeposits(false);
    }
  }

  function startPostDepositBalancePolling({
    amount,
    evidence,
    sourceChain,
    startingConfirmedBalance
  }: {
    amount: string;
    evidence: UnifiedBalanceDepositEvidence;
    sourceChain: UnifiedBalanceChainOption;
    startingConfirmedBalance: string;
  }) {
    const confirmedAt = Date.now();

    clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
    setPendingDepositElapsedSeconds(0);
    setPendingDeposit({
      amount,
      confirmedAt,
      explorerUrl: evidence.explorerUrl,
      sourceChainId: sourceChain.id,
      sourceChainLabel: sourceChain.title,
      startingConfirmedBalance,
      status: "confirmed_on_chain",
      txHash: evidence.txHash
    });

    const pollGatewayBalance = async () => {
      setIsCheckingPendingDeposits(true);

      try {
        const result = await balanceQuery.refetch();
        const nextStatus = result.data
          ? getPendingDepositBalanceStatus({
              amount,
              snapshot: result.data,
              sourceChainId: sourceChain.id,
              startingConfirmedBalance
            })
          : "waiting_gateway";

        setPendingDeposit((current) => (current ? { ...current, status: nextStatus } : current));

        if (nextStatus === "balance_updated") {
          clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
        }
      } finally {
        setIsCheckingPendingDeposits(false);
      }
    };

    void pollGatewayBalance();
    balancePollingIntervalRef.current = window.setInterval(() => {
      void pollGatewayBalance();
    }, 10_000);
    balancePollingTimeoutRef.current = window.setTimeout(() => {
      clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
    }, 180_000);
    depositElapsedIntervalRef.current = window.setInterval(() => {
      setPendingDepositElapsedSeconds(Math.floor((Date.now() - confirmedAt) / 1000));
    }, 1_000);
  }

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Product not found" message={`Product #${productId} is not available from the contract.`} />
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
      <section className="flex flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-emerald-200">Checkout</p>
        <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Arc USDC payment</h1>
        {isFallback ? (
          <div className="mt-6">
            <StateNotice
              title="Using mock fallback"
              message="The contract read failed for this checkout, so local seeded product data is shown."
            />
          </div>
        ) : null}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Asset</p>
            <p className="mt-2 text-lg font-semibold text-white">USDC</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Network</p>
            <p className="mt-2 text-lg font-semibold text-white">Arc Testnet</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
            <p className="text-sm text-zinc-400">Order</p>
            <p className="mt-2 text-lg font-semibold text-white">On-chain</p>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-white/10 bg-zinc-900/70 p-2">
          <div className="grid grid-cols-2 gap-2">
            <PaymentModeButton active={paymentMode === "direct"} label="Direct Arc Payment" onClick={() => setPaymentMode("direct")} />
            <PaymentModeButton active={paymentMode === "unified"} label="Unified Balance" onClick={() => setPaymentMode("unified")} />
          </div>
        </div>
      </section>

      {paymentMode === "direct" ? (
        <CheckoutPanel onPurchaseConfirmed={refetch} onRefreshState={refetch} product={product} />
      ) : (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-zinc-950 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Unified Balance checkout</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{product.brand} / {product.name}</p>
              </div>
              <WalletConnect />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryMetric label="Product" value={product.name} />
            <SummaryMetric label="Price" value={`${amountRequired} USDC`} />
            <SummaryMetric label="Payment method" value="Unified Balance" />
            <SummaryMetric label="Balance available" value={`${allocationState.availableAmount} USDC`} />
            <SummaryMetric label="Estimated fee" value={`${feeEstimateQuery.data?.totalFees ?? "Pending"} USDC`} />
            <SummaryMetric label="Total required" value={`${amountRequired} USDC`} />
          </div>

          <UnifiedBalanceStepper steps={uiState.steps} />

          <UnifiedBalanceStatusPanel
            errorMessage={unifiedCheckoutError ?? intentStatusQuery.error?.message}
            intent={currentIntent}
            isFailed={isUnifiedFailed}
            isSettled={currentIntent?.status === "settled" || currentIntent?.status === "paid"}
            isVoucherReady={isVoucherReady}
            pendingDeposit={pendingDeposit}
            sessionRestored={sessionRestored}
            stepElapsedSeconds={stepElapsedSeconds}
            uiState={uiState}
            onRefresh={() => {
              void balanceQuery.refetch();
              void intentStatusQuery.refetch();
            }}
            onResetSession={handleResetUnifiedSession}
            onRetry={handleRetryUnifiedBalance}
          />

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <button
              className="min-h-12 w-full rounded-md bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
              disabled={
                !isConnected ||
                !allocationState.hasSufficientBalance ||
                allocationState.allocations.length === 0 ||
                feeEstimateQuery.isLoading ||
                isUnifiedCheckoutBusy ||
                isVoucherReady
              }
              type="button"
              onClick={() => {
                void handleUnifiedBalanceCheckout();
              }}
            >
              {getUnifiedPrimaryButtonLabel({
                hasSufficientBalance: allocationState.hasSufficientBalance,
                isBusy: isUnifiedCheckoutBusy,
                isConnected,
                isEstimating: feeEstimateQuery.isLoading,
                isVoucherReady,
                status: displayedUnifiedStatus
              })}
            </button>
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Direct Arc payment remains available. Unified Balance may take a few minutes while Gateway payment verification updates.
            </p>
          </div>

          <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">Deposit USDC</summary>
            <div className="mt-4">
              <UnifiedBalanceDepositCard
                amount={depositDisplayAmount}
                currentChainId={chainId}
                currentChainLabel={getCurrentWalletChainLabel({ chainId, sourceChain: currentWalletSourceChain })}
                disabled={!isConnected || !selectedDepositChain || isDepositChainMismatch || !isPositiveDecimal(normalizeDepositAmount(depositDisplayAmount))}
                elapsedSeconds={pendingDepositElapsedSeconds}
                errorMessage={depositError}
                evidence={depositEvidence}
                isConnected={isConnected}
                isChainMismatch={isDepositChainMismatch}
                isCheckingPendingDeposits={isCheckingPendingDeposits}
                isSwitchingChain={isSwitchingDepositChain}
                pendingDeposit={pendingDeposit}
                pendingDepositSupportMessage={unifiedBalancePendingDepositSupportMessage}
                pendingTransactions={pendingTransactions}
                selectedChainId={selectedDepositChainId}
                selectedChainLabel={selectedDepositChain?.title}
                selectedEvmChainId={selectedDepositChain?.evmChainId}
                sourceChains={supportedChains}
                status={depositStatus}
                onAmountChange={(nextAmount) => {
                  setDepositAmount(nextAmount);
                  setDepositError(undefined);
                  setPendingDeposit(undefined);
                  if (depositStatus !== "waiting_wallet") {
                    setDepositStatus("idle");
                  }
                }}
                onCheckPendingDeposits={() => {
                  void handleCheckPendingDeposits();
                }}
                onDeposit={() => {
                  void handleUnifiedBalanceDeposit();
                }}
                onRefreshBalance={() => {
                  void balanceQuery.refetch();
                }}
                onSourceChainChange={(chainId) => {
                  setDepositChainId(chainId);
                  setDepositError(undefined);
                  setSelectedChainIds([chainId]);
                  setPendingDeposit(undefined);
                  if (depositStatus !== "waiting_wallet") {
                    setDepositStatus("idle");
                  }
                }}
                onSwitchChain={() => {
                  void handleSwitchDepositChain();
                }}
              />
            </div>
          </details>

          <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">Source chain</summary>
            <div className="mt-4">
              <UnifiedBalanceSources
                balances={balanceQuery.data}
                isLoading={balanceQuery.isLoading}
                selectedChainIds={selectedChainIds}
                supportedChains={supportedChains}
                onToggleChain={(chainId) => {
                  setSelectedChainIds([chainId]);
                  setDepositChainId(chainId);
                }}
              />
            </div>
          </details>

          <UnifiedBalanceAdvancedDetails
            backendError={unifiedCheckoutError ?? intentStatusQuery.error?.message}
            intent={currentIntent}
            intentStatus={intentStatusQuery.data}
            preparation={unifiedPreparation}
            receiverAddress={arcVoucherIntentPaymentReceiverAddress}
            selectedChainIds={selectedChainIds}
            spendEvidence={spendEvidence}
          />

          <details className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">Logs</summary>
            <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p>Balance status: {getUnifiedBalanceStatusLabel(unifiedBalanceStatus)}</p>
              <p>Fee status: {feeEstimateQuery.isLoading ? "Estimating" : feeEstimateQuery.data ? "Estimated" : getFeeEstimateMessage({
                canEstimateFees,
                feeError: feeEstimateQuery.error?.message,
                hasSufficientBalance: allocationState.hasSufficientBalance,
                isConnected,
                selectedChainIds
              }) ?? "Pending"}</p>
              <p>Checkout status: {getUnifiedCheckoutStatusLabel(displayedUnifiedStatus)}</p>
            </div>
          </details>
        </section>
      )}
    </main>
  );
}
function getDisplayedUnifiedStatus({
  currentIntent,
  hasSpendEvidence,
  localStatus
}: {
  currentIntent?: StoredIntent;
  hasSpendEvidence: boolean;
  localStatus: UnifiedCheckoutStatus;
}): UnifiedCheckoutStatus {
  if (localStatus === "failed") {
    return "failed";
  }
  if (currentIntent?.status === "voucher_fulfilled") {
    return "voucher ready";
  }
  if (currentIntent?.status === "paid") {
    return "preparing voucher";
  }
  if (currentIntent?.status === "settled") {
    return "settled";
  }
  if (currentIntent?.status === "payment_attached") {
    return currentIntent.settleTxHash ? "settled" : "payment attached";
  }
  if (currentIntent?.status === "refunded" || currentIntent?.status === "cancelled") {
    return "failed";
  }
  if (hasSpendEvidence && currentIntent?.status === "created") {
    return "verifying payment";
  }

  return localStatus;
}

function isBusyUnifiedStatus(status: UnifiedCheckoutStatus) {
  return [
    "preparing intent",
    "estimating fees",
    "waiting wallet confirmation",
    "spend submitted",
    "verifying payment",
    "payment confirmed",
    "preparing voucher",
    "waiting receiver payment",
    "payment attached",
    "settlement submitted"
  ].includes(status);
}

function PaymentModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-h-11 rounded-md px-4 text-sm font-semibold transition ${
        active ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-sm font-black text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}

function getUnifiedPrimaryButtonLabel({
  hasSufficientBalance,
  isBusy,
  isConnected,
  isEstimating,
  isVoucherReady,
  status
}: {
  hasSufficientBalance: boolean;
  isBusy: boolean;
  isConnected: boolean;
  isEstimating: boolean;
  isVoucherReady: boolean;
  status: UnifiedCheckoutStatus;
}) {
  if (isVoucherReady) {
    return "Voucher ready";
  }
  if (!isConnected) {
    return "Connect wallet";
  }
  if (!hasSufficientBalance) {
    return "Deposit USDC first";
  }
  if (isEstimating) {
    return "Estimating fee";
  }
  if (isBusy) {
    return getBusyButtonLabel(status);
  }
  if (status === "failed") {
    return "Retry Unified Balance";
  }

  return "Pay with Unified Balance";
}

function getBusyButtonLabel(status: UnifiedCheckoutStatus) {
  if (status === "waiting wallet confirmation") {
    return "Waiting for wallet";
  }
  if (status === "verifying payment" || status === "spend submitted") {
    return "Verifying payment";
  }
  if (status === "payment confirmed" || status === "preparing voucher") {
    return "Preparing voucher";
  }
  if (status === "waiting receiver payment") {
    return "Payment verification pending";
  }
  if (status === "payment attached" || status === "settlement submitted") {
    return "Creating your order";
  }

  return "Processing";
}

function getUnifiedCheckoutStatusLabel(status: UnifiedCheckoutStatus) {
  const labels: Record<UnifiedCheckoutStatus, string> = {
    failed: "Failed",
    idle: "Ready",
    "estimating fees": "Estimating fees",
    "payment attached": "Payment confirmed",
    "payment confirmed": "Payment confirmed",
    "preparing intent": "Preparing checkout",
    "preparing voucher": "Preparing voucher",
    settled: "Payment confirmed",
    "settlement submitted": "Preparing voucher",
    "spend submitted": "Payment sent",
    "verifying payment": "Verifying payment",
    "voucher ready": "Voucher ready",
    "waiting receiver payment": "Payment verification pending",
    "waiting wallet confirmation": "Waiting for wallet"
  };

  return labels[status];
}

function getInitialSelectedChainIds(chains: UnifiedBalanceChainOption[]) {
  return chains[0] ? [chains[0].id] : [];
}

function getUnifiedBalanceStatusLabel(status: UnifiedBalanceStatus) {
  const labels = {
    error: "Error",
    insufficient: "Deposit needed",
    loading: "Loading",
    not_connected: "Connect wallet",
    ready: "Ready",
    unavailable: "Unavailable"
  };

  return labels[status];
}

function getUnifiedBalanceStatus({
  balanceError,
  hasSufficientBalance,
  isConnected,
  isLoading,
  supportedChains
}: {
  balanceError: boolean;
  hasSufficientBalance: boolean;
  isConnected: boolean;
  isLoading: boolean;
  supportedChains: UnifiedBalanceChainOption[];
}): UnifiedBalanceStatus {
  if (!isConnected) {
    return "not_connected";
  }
  if (supportedChains.length === 0) {
    return "unavailable";
  }
  if (isLoading) {
    return "loading";
  }
  if (balanceError) {
    return "error";
  }
  if (!hasSufficientBalance) {
    return "insufficient";
  }

  return "ready";
}

function getFeeEstimateMessage({
  canEstimateFees,
  feeError,
  hasSufficientBalance,
  isConnected,
  selectedChainIds
}: {
  canEstimateFees: boolean;
  feeError?: string;
  hasSufficientBalance: boolean;
  isConnected: boolean;
  selectedChainIds: string[];
}) {
  if (feeError) {
    return feeError;
  }
  if (!isConnected) {
    return "Connect wallet to estimate Unified Balance fees.";
  }
  if (selectedChainIds.length === 0) {
    return "Select at least one source blockchain.";
  }
  if (!hasSufficientBalance) {
    return "Insufficient Unified Balance for this checkout amount.";
  }
  if (!canEstimateFees) {
    return "Fee estimate is waiting for balance data.";
  }

  return undefined;
}

function getCurrentWalletChainLabel({ chainId, sourceChain }: { chainId?: number; sourceChain?: UnifiedBalanceChainOption }) {
  if (!chainId) {
    return "Not connected";
  }

  return sourceChain ? `${sourceChain.title} (${chainId})` : `Unsupported chain (${chainId})`;
}

function getPendingDepositBalanceStatus({
  amount,
  snapshot,
  sourceChainId,
  startingConfirmedBalance
}: {
  amount: string;
  snapshot: UnifiedBalanceSnapshot;
  sourceChainId: string;
  startingConfirmedBalance: string;
}): UnifiedBalancePendingDeposit["status"] {
  const chainBalance = snapshot.breakdown.find((balance) => balance.chain === sourceChainId);
  const startingUnits = parseUsdcUnits(startingConfirmedBalance);
  const depositUnits = parseUsdcUnits(amount);
  const currentConfirmedUnits = parseUsdcUnits(chainBalance?.confirmedBalance);
  const pendingUnits = parseUsdcUnits(chainBalance?.pendingBalance);

  if (depositUnits > BigInt(0) && currentConfirmedUnits >= startingUnits + depositUnits) {
    return "balance_updated";
  }
  if (pendingUnits > BigInt(0) || (chainBalance?.pendingTransactions?.length ?? 0) > 0) {
    return "waiting_gateway";
  }

  return "waiting_gateway";
}

function clearDepositPollingTimers(
  balancePollingIntervalRef: { current: number | undefined },
  balancePollingTimeoutRef: { current: number | undefined },
  depositElapsedIntervalRef: { current: number | undefined }
) {
  if (balancePollingIntervalRef.current) {
    window.clearInterval(balancePollingIntervalRef.current);
    balancePollingIntervalRef.current = undefined;
  }
  if (balancePollingTimeoutRef.current) {
    window.clearTimeout(balancePollingTimeoutRef.current);
    balancePollingTimeoutRef.current = undefined;
  }
  if (depositElapsedIntervalRef.current) {
    window.clearInterval(depositElapsedIntervalRef.current);
    depositElapsedIntervalRef.current = undefined;
  }
}

function normalizeDepositAmount(value: string) {
  return value.trim();
}

function isPositiveDecimal(value: string) {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(value)) {
    return false;
  }

  return Number(value) > 0;
}
