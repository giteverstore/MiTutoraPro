# Monetary wallet and ledger (M6.1)

The wallet is a server-authoritative INR financial domain. Every amount is a non-negative integer number of paise. An account lives at `users/{uid}/wallet/account` and contains `pendingBalanceMinor`, `availableBalanceMinor`, `reservedBalanceMinor`, `lifetimeCreditedMinor`, timestamps, currency, and schema version. Wallets created before M7 safely interpret a missing reserved field as zero. Its immutable ledger lives at `users/{uid}/walletTransactions/{transactionId}`.

M5 calculates a referral reward but does not create wallet money. M6 records an `AVAILABLE` `REFERRAL_REWARD` only after separate trusted financial-settlement evidence. The current settlement seam uses `SYNTHETIC_REFERRAL_SETTLEMENT` solely in explicitly injected emulator/tests; it has no browser callable and fails closed by default. Real payment authority does not exist until M8, so M6.1 does not prove that real money was received.

Settlement resolves the qualified referral, owner, currency, and calculated amount from authoritative records. A Firestore transaction atomically writes the wallet projection, immutable ledger entry, referral settlement link, and server-only idempotency record. Replays return the original result; conflicting identities fail closed. Reconciliation compares AVAILABLE referral ledger credits with both available and lifetime-credited projections.

Authenticated learners may read only their own wallet and transactions. Clients cannot write wallet, ledger, referral settlement, or global idempotency records. A missing wallet is displayed as zero rather than as an error. There are no withdrawal, payout, bank, UPI, add-money, transfer, refund, or chargeback controls in M6.1; M7 owns withdrawals.

MI Coins remain a completely separate, non-cash learning-reward domain. Coins cannot become INR, affect wallet balances, or be produced by wallet settlement. `DEVELOPMENT_GRANT` can establish local Premium entitlement but is neither purchase nor settlement evidence and cannot credit the wallet.
