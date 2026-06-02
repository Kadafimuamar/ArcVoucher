"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { CheckoutPanel } from "@/components/CheckoutPanel";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { UnifiedBalanceDepositCard } from "@/components/UnifiedBalanceDepositCard";
import { UnifiedBalanceStatusPanel } from "@/components/UnifiedBalanceStatusPanel";
import { UnifiedBalanceStepper } from "@/components/UnifiedBalanceStepper";
import { WalletConnect } from "@/components/WalletConnect";
import type {
  UnifiedBalanceChainOption,
  UnifiedBalanceDepositEvidence,
  UnifiedBalanceDepositStatus,
  UnifiedBalancePendingDeposit,
  UnifiedBalanceSnapshot,
  UnifiedBalanceSpendEvidence
} from "@/lib/appkit/types";
import {
  depositToUnifiedBalance,
  getUnifiedBalanceDepositErrorMessage,
  switchWalletToUnifiedBalanceSourceChain
} from "@/lib/appkit/unifiedBalanceDeposit";
import { getUnifiedBalanceUiState } from "@/lib/appkit/unifiedBalanceCheckoutUi";
import {
  clearUnifiedBalanceSession,
  loadUnifiedBalanceSession,
  saveUnifiedBalanceSession,
  type UnifiedBalanceSessionStep
} from "@/lib/appkit/unifiedBalanceSession";
import {
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
import { confirmBackendIntentSpend, createBackendIntent, retryBackendIntentSpend, useIntentStatus, type StoredIntent } from "@/lib/intents";

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
  | "verification pending"
  | "payment confirmed"
  | "preparing voucher"
  | "voucher ready"
  | "waiting receiver payment"
  | "payment attached"
  | "settlement submitted"
  | "settled"
  | "failed";

const spendVerificationPendingMessage =
  "Payment was sent but verification is still pending. Please refresh or retry verification.";

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
  const [sessionRestored, setSessionRestored] = useState(false);
  const [currentStepStartedAt, setCurrentStepStartedAt] = useState(0);
  const [previousUiStep, setPreviousUiStep] = useState<UnifiedBalanceSessionStep | undefined>();
  const { product, isFallback, isLoading, refetch } = useArcVoucherProduct(productId);
  const amountRequired = product ? getProductPriceAsUsdcAmount(product.price) : "0";
  const depositDisplayAmount = depositAmount ?? amountRequired;
  const selectedDepositChainId = depositChainId ?? selectedChainIds[0] ?? supportedChains[0]?.id;
  const selectedDepositChain = supportedChains.find((chain) => chain.id === selectedDepositChainId) ?? supportedChains[0];
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
  const retrySpendTxHash = (spendEvidence?.txHash ?? currentIntent?.spendTxHash) as Hex | undefined;
  const canRetrySpendVerification = Boolean(currentIntent?.intentId && retrySpendTxHash && !isVoucherReady);
  const uiState = getUnifiedBalanceUiState({
    errorMessage: unifiedCheckoutError ?? intentStatusQuery.error?.message,
    hasSufficientBalance: allocationState.hasSufficientBalance,
    intent: currentIntent,
    intentStatus: intentStatusQuery.data,
    localStatus: displayedUnifiedStatus,
    pendingDeposit,
    spendSubmitted: Boolean(spendEvidence?.txHash || spendEvidence?.transferId)
  });
  const selectedChainBalance = selectedDepositChainId ? getBalanceForChain(balanceQuery.data, selectedDepositChainId) : "0";
  const confirmSpendWithBackend = useCallback(
    async (intent: StoredIntent, evidence: UnifiedBalanceSpendEvidence) => {
      if (!address || !product) {
        return;
      }

      if (!evidence.txHash) {
        setUnifiedCheckoutError(spendVerificationPendingMessage);
        setUnifiedCheckoutStatus("verification pending");
        return;
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
        console.error("[checkout] Unified Balance verification failed", error);
        setUnifiedCheckoutError(spendVerificationPendingMessage);
        setUnifiedCheckoutStatus("verification pending");
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
      spendTxHash: spendEvidence?.txHash ?? currentIntent?.spendTxHash ?? undefined,
      transferId: spendEvidence?.transferId,
      updatedAt: currentStepStartedAt
    });
  }, [address, backendIntent?.intentId, currentIntent?.intentId, currentIntent?.spendTxHash, currentStepStartedAt, paymentMode, pendingDeposit, preparedReference?.referenceId, product, referenceId, spendEvidence, uiState.currentStep]);

  useEffect(() => {
    if (previousUiStep !== uiState.currentStep) {
      const stepTimeout = window.setTimeout(() => {
        setPreviousUiStep(uiState.currentStep);
        setCurrentStepStartedAt(Date.now());
      }, 0);

      return () => window.clearTimeout(stepTimeout);
    }
  }, [previousUiStep, uiState.currentStep]);

  useEffect(() => {
    if (
      !address ||
      !product ||
      !currentIntent ||
      currentIntent.status !== "created" ||
      !spendEvidence?.txHash ||
      currentIntent.lastConfirmationError ||
      unifiedCheckoutStatus === "verification pending"
    ) {
      return;
    }

    const confirmTimeout = window.setTimeout(() => {
      void confirmSpendWithBackend(currentIntent, spendEvidence);
    }, 0);

    return () => window.clearTimeout(confirmTimeout);
  }, [address, confirmSpendWithBackend, currentIntent, product, spendEvidence, unifiedCheckoutStatus]);

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
    if (currentIntent && retrySpendTxHash) {
      void retrySpendVerification(currentIntent, retrySpendTxHash);
      return;
    }

    if (currentIntent?.rawPaymentId || spendEvidence?.transferId) {
      void intentStatusQuery.refetch();
      return;
    }

    setUnifiedCheckoutError(undefined);
    setUnifiedCheckoutStatus("idle");
  }

  async function retrySpendVerification(intent: StoredIntent, spendTxHash: Hex) {
    setUnifiedCheckoutError(undefined);
    setUnifiedCheckoutStatus("verifying payment");

    try {
      const result = await retryBackendIntentSpend({
        intentId: intent.intentId,
        spendTxHash
      });
      setBackendIntent(result.intent);
      setUnifiedCheckoutStatus(result.voucherStatus === "fulfilled" || result.intent.status === "voucher_fulfilled" ? "voucher ready" : "preparing voucher");
      void intentStatusQuery.refetch();
    } catch (error) {
      console.error("[checkout] Unified Balance retry verification failed", error);
      setUnifiedCheckoutError(spendVerificationPendingMessage);
      setUnifiedCheckoutStatus("verification pending");
      void intentStatusQuery.refetch();
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

    const pollBalance = async () => {
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
      } catch {
        setPendingDeposit((current) => (current ? { ...current, status: "waiting_gateway" } : current));
      }
    };

    void pollBalance();
    balancePollingIntervalRef.current = window.setInterval(() => {
      void pollBalance();
    }, 10_000);
    balancePollingTimeoutRef.current = window.setTimeout(() => {
      clearDepositPollingTimers(balancePollingIntervalRef, balancePollingTimeoutRef, depositElapsedIntervalRef);
    }, 180_000);
  }

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Product not found" message={`Product #${productId} is not available from the contract.`} />
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_460px] lg:px-8">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">Checkout</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">Complete purchase</h1>
        </div>
        {isFallback ? (
          <div className="mt-6">
            <StateNotice
              title="Using mock fallback"
              message="The contract read failed for this checkout, so local seeded product data is shown."
            />
          </div>
        ) : null}
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className={`flex h-44 items-end rounded-md ${product.surface} p-4`}>
            <div className={`h-16 w-16 rounded-lg bg-gradient-to-br ${product.accent} shadow-lg shadow-black/20`} />
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{product.brand}</p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-950 dark:text-white">{product.name}</h2>
            </div>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-200">{amountRequired} USDC</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ProductSummary label="Asset" value="USDC" />
            <ProductSummary label="Network" value="Arc Testnet" />
            <ProductSummary label="Delivery" value="Voucher code" />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className="grid grid-cols-2 gap-2">
            <PaymentModeButton active={paymentMode === "direct"} label="Direct Arc Payment" onClick={() => setPaymentMode("direct")} />
            <PaymentModeButton active={paymentMode === "unified"} label="Unified Balance" onClick={() => setPaymentMode("unified")} />
          </div>
        </div>

        {paymentMode === "unified" ? <UnifiedBalanceGuide /> : null}
      </section>

      {paymentMode === "direct" ? (
        <CheckoutPanel onPurchaseConfirmed={refetch} onRefreshState={refetch} product={product} />
      ) : (
        <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 shadow-xl shadow-zinc-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white dark:shadow-black/10">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Unified Balance checkout</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{product.brand} / {product.name}</p>
              </div>
              <WalletConnect />
            </div>
          </div>

          {allocationState.hasSufficientBalance ? (
            <CompactSourceChainSelect
              balance={selectedChainBalance}
              isLoading={balanceQuery.isLoading}
              selectedChainId={selectedDepositChainId}
              sourceChains={supportedChains}
              onSourceChainChange={(chainId) => {
                setDepositChainId(chainId);
                setSelectedChainIds([chainId]);
              }}
            />
          ) : null}

          <PaymentSummary
            available={allocationState.availableAmount}
            fee={formatEstimatedFee(feeEstimateQuery.data?.totalFees, allocationState.hasSufficientBalance)}
            hasSufficientBalance={allocationState.hasSufficientBalance}
            price={amountRequired}
            productName={product.name}
          />

          <UnifiedBalanceStepper steps={uiState.steps} />

          <UnifiedBalanceStatusPanel
            errorMessage={unifiedCheckoutError ?? intentStatusQuery.error?.message}
            intent={currentIntent}
            isFailed={isUnifiedFailed}
            isSettled={currentIntent?.status === "settled" || currentIntent?.status === "paid"}
            isVoucherReady={isVoucherReady}
            pendingDeposit={pendingDeposit}
            sessionRestored={sessionRestored}
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
                (!canRetrySpendVerification && !allocationState.hasSufficientBalance) ||
                (!canRetrySpendVerification && allocationState.allocations.length === 0) ||
                feeEstimateQuery.isLoading ||
                isUnifiedCheckoutBusy ||
                isVoucherReady
              }
              type="button"
              onClick={() => {
                if (canRetrySpendVerification && currentIntent && retrySpendTxHash) {
                  void retrySpendVerification(currentIntent, retrySpendTxHash);
                  return;
                }

                void handleUnifiedBalanceCheckout();
              }}
            >
              {getUnifiedPrimaryButtonLabel({
                canRetryVerification: canRetrySpendVerification,
                hasSufficientBalance: allocationState.hasSufficientBalance,
                isBusy: isUnifiedCheckoutBusy,
                isConnected,
                isEstimating: feeEstimateQuery.isLoading,
                isVoucherReady,
                status: displayedUnifiedStatus
              })}
            </button>
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Your payment is processed securely. Voucher preparation usually takes less than a minute after payment confirmation.
            </p>
          </div>

          {(!allocationState.hasSufficientBalance || pendingDeposit || depositStatus !== "idle") && (
            <UnifiedBalanceDepositCard
              amount={depositDisplayAmount}
              balance={selectedChainBalance}
              disabled={!isConnected || !selectedDepositChain || isDepositChainMismatch || !isPositiveDecimal(normalizeDepositAmount(depositDisplayAmount))}
              errorMessage={depositError}
              evidence={depositEvidence}
              isConnected={isConnected}
              isChainMismatch={isDepositChainMismatch}
              isSwitchingChain={isSwitchingDepositChain}
              pendingDeposit={pendingDeposit}
              selectedChainId={selectedDepositChainId}
              selectedChainLabel={selectedDepositChain?.title}
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
              onDeposit={() => {
                void handleUnifiedBalanceDeposit();
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
          )}

          <NeedHelpPanel
            canCheckVoucher={Boolean(currentIntent?.intentId)}
            isVoucherReady={isVoucherReady}
            orderHref={currentIntent?.intentId ? `/orders/unified/${currentIntent.intentId}` : "/orders"}
            onRetry={handleRetryUnifiedBalance}
          />
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
        active
          ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 dark:bg-emerald-300 dark:text-zinc-950"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.04] dark:hover:text-white"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CompactSourceChainSelect({
  balance,
  isLoading,
  selectedChainId,
  sourceChains,
  onSourceChainChange
}: {
  balance: string;
  isLoading: boolean;
  selectedChainId?: string;
  sourceChains: UnifiedBalanceChainOption[];
  onSourceChainChange: (chainId: string) => void;
}) {
  return (
    <label className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Source chain</span>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <select
          className="min-h-11 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
          disabled={sourceChains.length === 0 || isLoading}
          value={selectedChainId ?? ""}
          onChange={(event) => onSourceChainChange(event.target.value)}
        >
          {sourceChains.length === 0 ? <option value="">No supported chains</option> : null}
          {sourceChains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.title}
            </option>
          ))}
        </select>
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Balance: {formatDisplayUsdc(balance)} USDC</span>
      </div>
    </label>
  );
}

function PaymentSummary({
  available,
  fee,
  hasSufficientBalance,
  price,
  productName
}: {
  available: string;
  fee: string;
  hasSufficientBalance: boolean;
  price: string;
  productName: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <dl className="space-y-3 text-sm">
        <SummaryRow label="Product" value={productName} />
        <SummaryRow label="Price" value={`${price} USDC`} />
        <SummaryRow label="Available" value={`${formatDisplayUsdc(available)} USDC`} />
        <SummaryRow label="Network fee" value={fee} />
        <SummaryRow emphasized label="Total" value={`${price} USDC`} />
      </dl>
      {!hasSufficientBalance ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
          You need a little more USDC to continue.
        </p>
      ) : null}
    </section>
  );
}

function SummaryRow({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className={emphasized ? "font-semibold text-zinc-950 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}>{label}</dt>
      <dd className={`text-right font-semibold ${emphasized ? "text-emerald-700 dark:text-emerald-200" : "text-zinc-950 dark:text-white"}`}>{value}</dd>
    </div>
  );
}

function UnifiedBalanceGuide() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
      <h2 className="text-base font-bold text-zinc-950 dark:text-white">How Unified Balance works</h2>
      <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <GuideStep number="1" text="Deposit USDC from a supported chain." />
        <GuideStep number="2" text="Wait for your Unified Balance to update." />
        <GuideStep number="3" text="Pay for the voucher." />
        <GuideStep number="4" text="Reveal your voucher in Orders." />
      </ol>
    </section>
  );
}

function GuideStep({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
        {number}
      </span>
      <span>{text}</span>
    </li>
  );
}

function NeedHelpPanel({
  canCheckVoucher,
  isVoucherReady,
  orderHref,
  onRetry
}: {
  canCheckVoucher: boolean;
  isVoucherReady: boolean;
  orderHref: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80">
      {isVoucherReady ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100">
          Your voucher is ready.
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Your payment is being processed. This usually takes less than a minute after payment confirmation.
        </p>
      )}
      <p className="text-sm font-semibold text-zinc-950 dark:text-white">Need help?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Link className="flex min-h-11 items-center justify-center rounded-md border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.04]" href="/orders">
          View orders
        </Link>
        <Link
          className={`flex min-h-11 items-center justify-center rounded-md border px-3 text-sm font-semibold ${
            canCheckVoucher
              ? "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
              : "pointer-events-none border-zinc-100 text-zinc-400 dark:border-white/5 dark:text-zinc-600"
          }`}
          href={orderHref}
        >
          Check voucher
        </Link>
        <button
          className="min-h-11 rounded-md border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
          type="button"
          onClick={onRetry}
        >
          Retry verification
        </button>
      </div>
    </section>
  );
}

function ProductSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-white/[0.04]">
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}

function getUnifiedPrimaryButtonLabel({
  canRetryVerification,
  hasSufficientBalance,
  isBusy,
  isConnected,
  isEstimating,
  isVoucherReady,
  status
}: {
  canRetryVerification: boolean;
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
  if (canRetryVerification && !isBusy) {
    return "Retry verification";
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
  if (status === "failed" || status === "verification pending") {
    return "Retry verification";
  }

  return "Pay with Unified Balance";
}

function formatEstimatedFee(totalFees: string | undefined, hasSufficientBalance: boolean) {
  if (!hasSufficientBalance) {
    return "Estimated after balance is ready";
  }

  return totalFees ? `${formatDisplayUsdc(totalFees)} USDC` : "Estimated after balance is ready";
}

function formatDisplayUsdc(value: string) {
  return Number(value || "0").toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(value) > 0 ? 2 : 0
  });
}

function getBusyButtonLabel(status: UnifiedCheckoutStatus) {
  if (status === "waiting wallet confirmation") {
    return "Waiting for wallet";
  }
  if (status === "verifying payment" || status === "spend submitted") {
    return "Confirming payment";
  }
  if (status === "payment confirmed" || status === "preparing voucher") {
    return "Preparing voucher";
  }
  if (status === "waiting receiver payment") {
    return "Confirming payment";
  }
  if (status === "payment attached" || status === "settlement submitted") {
    return "Preparing voucher";
  }

  return "Processing";
}

function getInitialSelectedChainIds(chains: UnifiedBalanceChainOption[]) {
  const preferred = chains.find((chain) => /arbitrum/i.test(chain.title) && /sepolia/i.test(chain.title));
  return preferred ? [preferred.id] : chains[0] ? [chains[0].id] : [];
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
