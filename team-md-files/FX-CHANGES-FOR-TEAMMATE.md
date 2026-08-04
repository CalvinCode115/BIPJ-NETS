# FX and Multi-Currency Changes for Teammate

Date reviewed: 19 July 2026

## Purpose

This document explains the FX-related changes currently present in the working tree compared with the original Git version. It focuses on:

- Correctly attributing an exchange to the logged-in user
- Preventing one user from reusing another user's selected card
- Recording exchanges as transactions
- Displaying exchange transactions on Home and All Transactions
- Loading the selected card's multi-currency wallet from Firestore

These changes are currently uncommitted.

## Main problem that triggered the changes

An exchange performed while logged in as Aaron (new user: HP 90123456, Pin same for all) could be processed with Alex's user or card information.

Two original behaviours caused this:

1. FX code read the user from `localStorage` and used the fallback `user_1`.
2. The selected card was stored under the shared key `nets_selected_card_id`.

Those shared/default values could survive account changes and cause the FX page to use another user's card.

## Changes made

### 1. User-specific card storage keys

New file:

- `src/app/utils/card-storage.ts`

Added helper functions that produce keys containing the authenticated user ID:

```typescript
nets_selected_card_id_<userId>
nets_current_sgd_balance_<userId>
```

Previously, all accounts shared:

```typescript
nets_selected_card_id
nets_current_sgd_balance
```

Reason:

- Prevent card selection and cached SGD balance from leaking between users.
- Ensure Aaron and Alex have separate local card state.

### 2. FX page now uses the authenticated user

Changed file:

- `src/app/pages/travel/fx-tracker/fx-tracker.page.ts`

Original behaviour:

- Read `nets_user_id` directly from `localStorage`.
- Fell back to `user_1`.
- Trusted the globally stored card ID.
- Used shared SGD balance storage.

New behaviour:

- Injects `AuthService`.
- Uses `this.auth.userId`.
- Stops and displays an error when no user is logged in.
- Reads and writes user-specific card and balance keys.
- Checks whether the selected card exists in the current user's wallet.
- Falls back to that user's first prepaid card when the stored card is invalid.
- Stops if the current user has no valid prepaid card.

Reason:

- Remove the hardcoded Alex/`user_1` fallback.
- Ensure every wallet and exchange API request uses the active account.
- Recover safely from an old or invalid selected-card value.

### 3. Card-linked exchange service now uses `AuthService`

Changed file:

- `src/app/services/card-linked-exchange.service.ts`

Original behaviour:

```typescript
const userId = localStorage.getItem('nets_user_id') || 'user_1';
```

New behaviour:

- Injects `AuthService`.
- Uses `this.auth.userId` for exchange and currency deduction requests.
- Returns a login error when `userId` is unavailable.

Reason:

- Keep exchange service requests consistent with the authenticated session.
- Prevent backend requests from being sent under a default user.
- Resolve TypeScript errors caused by passing `string | null` as a user ID.

### 4. Home and logout use the same user-specific keys

Changed files:

- `src/app/pages/home/home/home.page.ts`
- `src/app/services/auth.service.ts`

Home now:

- Saves the selected card under the current user's key.
- Saves the current SGD balance under the current user's key.
- Loads the multi-currency wallet using `this.auth.userId`.
- No longer calls the wallet API with the `user_1` fallback.

Logout now:

- Removes the current user's selected-card and SGD-balance keys.
- Also removes the obsolete shared keys for migration cleanup.

Reason:

- Home and FX must use identical storage rules.
- Logging out should not leave card state that can affect the next account.

### 5. Backend verifies card ownership before exchange

Changed file:

- `backend/routes/api.js`

The exchange route now calls:

```javascript
db.getCardById(req.params.userId, req.params.cardId)
```

If the card is not inside that user's card collection, the API returns:

```text
The selected card does not belong to this user.
```

Reason:

- Frontend validation alone is not a security boundary.
- A stale, manipulated or manually submitted card ID must not update another user's balances.

### 6. Successful exchanges now create transaction records

Changed file:

- `backend/routes/api.js`

After a successful exchange, the route creates a transaction containing:

- `user_id`
- `card_id`
- `merchant: Currency Exchange`
- `category: Currency Exchange`
- Rate information
- Source and received amounts
- `txn_type: exchange`
- Singapore timestamp

Example display value:

```text
100.00 SGD → 73.63 USD
```

Reason:

- The original exchange changed wallet balances but did not create a normal transaction.
- Without a transaction record, Home and All Transactions had nothing to display.

### 7. Exchange display amounts are persisted and returned

Changed files:

- `backend/db/firestore-store.js`
- `backend/services/dna.js`
- `src/app/services/transactions.service.ts`

Added:

```text
display_amount
```

The backend API maps it to:

```text
displayAmount
```

The frontend transaction type now also accepts:

```typescript
'exchange'
```

Reason:

- A normal numeric `amount` cannot clearly represent both sides of an exchange.
- `displayAmount` preserves the source amount, received amount and both currency codes.

### 8. Home and All Transactions display exchanges

Changed files:

- `src/app/pages/home/home/home.page.ts`
- `src/app/pages/home/home/home.page.html`
- `src/app/pages/home/home-all-transactions/home-all-transactions.page.ts`
- `src/app/pages/home/home-all-transactions/home-all-transactions.page.html`

New behaviour:

- Home maps `displayAmount` from dashboard transactions.
- Recent transactions use `displayAmount` when available.
- All Transactions uses `displayAmount` when available.
- `Currency Exchange` was added as an All Transactions category filter.
- The transaction model accepts the `exchange` type.

Reason:

- Exchange transactions should appear consistently in both recent and complete transaction views.
- The formatted exchange text is more useful than displaying `$0.00`.

## Original code compared with new code

The snippets below show the important FX-related sections before and after the changes. Unrelated changes in the same files are not included.

### A. Getting the user ID on the FX page

Original:

```typescript
const userId = localStorage.getItem('nets_user_id') || 'user_1';
```

New:

```typescript
const userId = this.auth.userId;

if (!userId) {
  this.isExchanging = false;
  this.exchangeResult = {
    success: false,
    message: 'Please log in before exchanging currency.',
  };
  return;
}
```

Why:

- The original fallback could silently process an exchange as `user_1`.
- The new code requires a real authenticated user.

### B. Reading the selected card on the FX page

Original:

```typescript
const savedCardId = localStorage.getItem('nets_selected_card_id');
if (savedCardId) {
  this.cardId = savedCardId;
}
```

New:

```typescript
const userId = this.auth.userId;

if (!userId) {
  this.error = 'Please log in to use currency exchange.';
  return;
}

const savedCardId = localStorage.getItem(
  selectedCardStorageKey(userId)
);

if (savedCardId) {
  this.cardId = savedCardId;
}
```

Why:

- The original key was shared by every account.
- The new key contains the current user ID.

### C. Validating the FX card against the current wallet

Original:

```typescript
const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
const card = allCards.find(c => c.id === this.cardId);
const realSgdBalance = card?.balance ?? 500;
```

New:

```typescript
const allCards = [...wallet.prepaid, ...wallet.cashcard, ...wallet.others];
const selectedCard = allCards.find((card) => card.id === this.cardId);
const exchangeCard = selectedCard ?? wallet.prepaid[0] ?? null;

if (!exchangeCard) {
  this.isExchanging = false;
  this.exchangeResult = {
    success: false,
    message: 'No valid prepaid card is available for exchange.',
  };
  return;
}

this.cardId = exchangeCard.id;
localStorage.setItem(
  selectedCardStorageKey(userId),
  exchangeCard.id
);

const realSgdBalance = exchangeCard.balance;
```

Why:

- The original code accepted a missing or stale card and substituted a fake `$500` balance.
- The new code only uses a card belonging to the current wallet.

### D. Card-linked exchange service authentication

Original:

```typescript
exchange(req: ExchangeRequest, _currentSgdBalance: number): Observable<ExchangeResult> {
  const userId = localStorage.getItem('nets_user_id') || 'user_1';
  const rate = this.getMockRate(req.fromCurrency, req.toCurrency);

  return this.cardsService.exchangeCurrency(userId, req.cardId, {
    fromCurrency: req.fromCurrency,
    toCurrency: req.toCurrency,
    amount: req.amount,
    rate: rate
  });
}
```

New:

```typescript
exchange(
  req: ExchangeRequest,
  _currentSgdBalance: number
): Observable<ExchangeResult> {
  const userId = this.auth.userId;

  if (!userId) {
    return of({
      success: false,
      message: 'Please log in before exchanging currency.',
    });
  }

  const rate = this.getMockRate(req.fromCurrency, req.toCurrency);

  return this.cardsService.exchangeCurrency(userId, req.cardId, {
    fromCurrency: req.fromCurrency,
    toCurrency: req.toCurrency,
    amount: req.amount,
    rate,
  });
}
```

Why:

- Service-level requests now follow the authenticated Angular session.
- A missing login produces an error instead of falling back to another account.

### E. Home selected-card storage

Original:

```typescript
if (this.currentCard) {
  localStorage.setItem(
    'nets_selected_card_id',
    this.currentCard.id || 'default'
  );
  localStorage.setItem(
    'nets_current_sgd_balance',
    String(this.cardFundsAmount)
  );
}
```

New:

```typescript
const userId = this.auth.userId;

if (this.currentCard && userId) {
  localStorage.setItem(
    selectedCardStorageKey(userId),
    this.currentCard.id || 'default'
  );

  localStorage.setItem(
    currentSgdBalanceStorageKey(userId),
    String(this.cardFundsAmount)
  );
}
```

Why:

- Home and FX now read and write the same user-specific keys.

### F. Loading Home's multi-currency wallet

Original:

```typescript
loadMultiCurrencyBalances(): void {
  const card = this.currentCard;
  if (!card?.id) {
    this.cardCurrencyBalances = [];
    return;
  }

  const realSgdBalance = this.cardFundsAmount;
  localStorage.setItem(
    'nets_current_sgd_balance',
    String(realSgdBalance)
  );

  this.cardsService
    .getCardWallet(this.auth.userId ?? 'user_1', card.id)
    .subscribe({
      next: (wallet: MultiCurrencyWallet) => {
        this.cardCurrencyBalances = Object.entries(wallet.balances).map(
          ([currency, amount]) => ({
            currency,
            amount,
            flag: this.cardExchange.getCurrencyFlag(currency)
          })
        );
      },
      error: () => {
        this.cardCurrencyBalances = [];
      }
    });
}
```

New:

```typescript
loadMultiCurrencyBalances(): void {
  const userId = this.auth.userId;
  const card = this.currentCard;

  if (!userId || !card?.id) {
    this.cardCurrencyBalances = [];
    return;
  }

  const realSgdBalance = this.cardFundsAmount;

  localStorage.setItem(
    currentSgdBalanceStorageKey(userId),
    String(realSgdBalance)
  );

  this.cardsService.getCardWallet(userId, card.id).subscribe({
    next: (wallet: MultiCurrencyWallet) => {
      this.cardCurrencyBalances = Object.entries(wallet.balances).map(
        ([currency, amount]) => ({
          currency,
          amount,
          flag: this.cardExchange.getCurrencyFlag(currency),
        })
      );
    },
    error: () => {
      this.cardCurrencyBalances = [];
    },
  });
}
```

Why:

- The wallet request can no longer fall back to `user_1`.
- The locally stored SGD balance belongs to the authenticated user.

### G. Backend card ownership validation

Original:

```javascript
const { fromCurrency, toCurrency, amount, rate } = req.body;
```

The original exchange route moved directly from user validation to processing the submitted card ID.

New:

```javascript
const card = await db.getCardById(
  req.params.userId,
  req.params.cardId
);

if (!card) {
  return res.status(404).json({
    error: 'The selected card does not belong to this user.',
  });
}

const { fromCurrency, toCurrency, amount, rate } = req.body;
```

Why:

- The backend independently verifies ownership before changing balances.

### H. Creating an exchange transaction

Original:

```javascript
res.json({
  success: true,
  message: `Exchanged ${amount} ${fromCurrency} → ${result.received.toFixed(2)} ${toCurrency}`,
  newBalances: result.newBalances,
  card: mapCard(result.card, 'wallet'),
});
```

New:

```javascript
const exchangeTransaction = await db.addTransaction({
  id: `txn_exchange_${Date.now()}`,
  user_id: req.params.userId,
  card_id: req.params.cardId,
  merchant: 'Currency Exchange',
  category: 'Currency Exchange',
  subtitle:
    `Rate: 1 ${fromCurrency} = ${Number(rate).toFixed(4)} ${toCurrency}`,
  display_amount:
    `${Number(amount).toFixed(2)} ${fromCurrency} → ` +
    `${result.received.toFixed(2)} ${toCurrency}`,
  amount: 0,
  txn_type: 'exchange',
  icon: 'swap-horizontal',
  icon_color: '#9b51e0',
  occurred_at: period.nowSingaporeIso(),
});

res.json({
  success: true,
  message:
    `Exchanged ${amount} ${fromCurrency} → ` +
    `${result.received.toFixed(2)} ${toCurrency}`,
  newBalances: result.newBalances,
  card: mapCard(result.card, 'wallet'),
  transaction: formatTransaction(exchangeTransaction),
});
```

Why:

- Previously, the exchange updated balances but left no transaction history.
- The new transaction is linked to both the user and selected card.

### I. Saving and returning the formatted exchange amount

Original `transactionToDoc()`:

```javascript
return {
  // Existing transaction fields
  transfer_id: txn.transfer_id ?? null,
};
```

New:

```javascript
return {
  // Existing transaction fields
  transfer_id: txn.transfer_id ?? null,
  display_amount: txn.display_amount ?? null,
};
```

Original DNA transaction formatter:

```javascript
return {
  id: row.id,
  merchant: row.merchant,
  subtitle: row.subtitle,
  amount: row.amount,
};
```

New:

```javascript
return {
  id: row.id,
  merchant: row.merchant,
  subtitle: row.subtitle,
  displayAmount: row.display_amount ?? null,
  amount: row.amount,
};
```

Why:

- Both currencies and both amounts must survive Firestore storage and API formatting.

### J. Rendering the exchange amount

Original:

```html
{{ formatAmount(item.amount) }}
```

New:

```html
{{ item.displayAmount || formatAmount(item.amount) }}
```

Reason:

- Normal debit and credit transactions still use the numeric formatter.
- Exchange transactions use text such as `100.00 SGD → 73.63 USD`.

## Current data flow

The expected exchange flow is:

1. User logs in.
2. Home saves that user's selected card ID.
3. FX reads the same user-specific selected-card key.
4. FX confirms the card exists in that user's wallet.
5. Frontend sends `userId`, `cardId`, currencies, amount and rate.
6. Backend confirms the user exists.
7. Backend confirms the card belongs to that user.
8. Firestore updates the multi-currency balances atomically.
9. Backend creates an exchange transaction.
10. Home and All Transactions display the returned transaction information.

## Destination and currency-list status

No destination expansion has been implemented yet.

Current state:

- `destination.config.ts` still has only Malaysia, Thailand, Japan, Korea and Australia.
- Home's Add Currency feature is still destination-based.
- `availableDestinationsToAdd`, `destinationId` and `addTrackedCurrency()` have not been renamed.
- `fx-tracker.page.ts` still has its original hardcoded `availableCurrencies` array.
- `currency.config.ts` exists as an untracked file but is not imported or used anywhere.
- The proposed 12 additional travel destinations have not been added.

Therefore, the destination architecture still behaves as it did before.

## Known remaining issue

`getMultiCurrencyWallet()` currently uses:

```javascript
const multiCurrency = card.multi_currency || { SGD: card.balance };
```

If `multi_currency` already exists but its `SGD` value is stale, this method returns the stale value instead of forcing:

```javascript
multiCurrency.SGD = card.balance;
```

Also, ordinary operations that update `card.balance` must update `multi_currency.SGD` in the same database transaction. This synchronization has not been completed for every balance-writing path.

Impact:

- A payment, transfer or top-up can update the card balance while the FX wallet's SGD amount remains outdated.

This should be handled as a separate balance-consistency change.

## Teammate review checklist

Please verify:

- Aaron cannot see or exchange using Alex's selected card.
- Changing accounts produces different selected-card storage keys.
- An invalid stored card ID falls back only to the current user's prepaid card.
- The backend rejects an exchange using another user's card ID.
- SGD to foreign currency creates a transaction.
- Foreign currency back to SGD creates a transaction.
- Exchange records appear on both Home and All Transactions.
- The displayed source and received amounts are correct.
- Failed exchanges do not create transaction records.
- Logout removes the current user's cached selected card and SGD balance.

## Files most relevant to the FX teammate

- `src/app/pages/travel/fx-tracker/fx-tracker.page.ts`
- `src/app/pages/travel/fx-tracker/fx-tracker.service.ts`
- `src/app/services/card-linked-exchange.service.ts`
- `src/app/services/cards.service.ts`
- `src/app/utils/card-storage.ts`
- `src/app/pages/home/home/home.page.ts`
- `src/app/pages/home/home/home.page.html`
- `src/app/services/transactions.service.ts`
- `backend/routes/api.js`
- `backend/db/firestore-store.js`
- `backend/services/dna.js`

