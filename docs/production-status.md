# QuickPrint operational behavior

The app now starts new devices with an empty order cache. Existing remote orders remain in the database. The former sample order IDs, sample upload shortcuts, legacy demo-PIN login, profit simulator, and public notification-channel fallback are removed. Customer tabs subscribe to their selected order; counter tabs subscribe to their shop. The all-shop order listener runs only in the authenticated admin UI.

New queue numbers are allocated in a Firestore transaction using `orders/quickprint-order-sequence`; the initial number is 1000001, separate from the old local counters. The counter document is filtered out of the order directory. The transaction stores the allocated number and order together. Failed commits do not produce local success. Existing order numbers are preserved.

Counter status, payment, quote, rejection, download timestamps, and cleanup changes await their database writes. Updates use the latest server order so a quote change does not overwrite a payment reference. Revisions to paid orders are blocked. Counter receipts have an actual per-order tracking QR. Settings and payment QRs are generated locally. Contact details use the shop’s configured phone instead of a platform-owner fallback.

Page selections are strictly parsed and mapped to each original file. Two one-page PDFs remain two physical duplex sheets, and each file's print instructions show its own selected pages. Invalid prices are rejected when saving settings.

Cash or UPI received at the counter is recorded explicitly by the operator. Direct online UPI remains pending until the shop checks incoming money and confirms receipt. Opening a document does not mark it printing; the shop explicitly confirms after starting the physical print job. Paper size, copies, sides and color must be selected in the native print dialog.

## Deployment limits

- File cleanup currently runs while a verified counter is open. A guarantee of deletion while all counters are closed requires an authenticated scheduled backend job. The UI no longer claims that guarantee.
- Supabase enforces access to stored files and shop configuration. Firestore rules still need a separate server-side authorization review; UI role checks alone do not establish database security. No database access rules or authentication providers were changed in this release.
- The queue allocator was checked with isolated transaction tests. A production counter-write test was rejected by automatic approval because it would leave a persistent sequence change, so it was not retried. A read-only production connection check passed. The attempted temporary test records were cleaned up by exact IDs before the rejected counter test; no customer orders, payments, or documents were used.
- Reload existing counter tabs after deployment to use the new order numbering and synchronization code.

## Verification

`npm test` covers concurrent queue allocation, failed commits, concurrent quote/payment updates, strict page selections, per-file page mapping, prices, PDF page counts, UPI URI fields, and pending payment behavior. Browser fixtures cover failed status/quote saves, UPI submission and operator confirmation, cross-shop recipients, changed-quote payment blocking, and printing confirmation. They do not perform real financial transfers or send jobs to physical printers.

The production dependency audit reports zero advisories after overriding Firebase’s gRPC dependency to patched version 1.13.6. See the [vendor advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j). Development-tool advisories are outside that production-only audit result.
