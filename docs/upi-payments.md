# Per-shop UPI payments

In the counter, open Settings, enter the shop UPI ID and payment recipient name, and save changes. Blank IDs disable online checkout for that shop. The address and recipient name are published in the shop profile through the existing protected `quickprint_update_shop` RPC; no new database migration is required.

Settings generates a reusable QR without a preset amount. Customer checkout saves the original files and order first, then generates a local QR containing `pa`, `pn`, `am` (two decimal places), `cu=INR`, a unique `tr`, and an order note. PDF page counts are read from the document using a lazily loaded parser, rather than guessed from file size. Unreadable/password-protected PDFs are rejected before payment.

Each order keeps a snapshot of its recipient, amount, and reference, so later settings changes do not redirect existing orders. Customers can open a standard UPI link, scan from another device, download the QR, and submit their 12-digit UPI reference. Submission remains **pending**. The shop checks the exact incoming payment in its bank/UPI account and uses **Confirm receipt** to mark it paid. The counter UI checks that the signed-in account can manage that shop before confirming.

This is a direct UPI request and manual reconciliation flow, not a payment processor or a bank verification integration. A syntactically valid UPI address or submitted UTR does not prove account ownership, receipt, or settlement. Actual app acceptance depends on the recipient account and payment provider. Automatic settlement confirmation would require an authenticated bank/PSP integration. Existing Firestore access policies must protect order/payment writes in any production deployment; client-side counter checks are not a substitute for database authorization.

Payment updates use Firestore transactions to read the current quote and update only payment fields. Cancelled, paid, malformed and changed-price requests are blocked. A changed quote requires the shop to reconcile the earlier request before another payment. Upload/save failures never open the QR. A reference-save failure keeps the saved order and lets the customer retry without another transfer.

## Validation

- `npm run test:upi`: recipient and paise encoding, unique references, invalid requests, pending-versus-paid labels, changed/cancelled requests, compressed PDF page counts.
- Browser fixtures: settings RPC payload, decode generated PNGs, two shops with distinct recipients, upload/save recovery, two-PDF page totals, UTR validation, counter confirmation/access checks, and 320–1440px layouts. These use isolated backend fixtures; no real transfers or customer orders are made.

Protocol references: [UPI request fields](https://developers.google.com/pay/india/api/web/create-payment-method), [payment verification](https://developers.google.com/pay/india/api/web/googlepay-response).
