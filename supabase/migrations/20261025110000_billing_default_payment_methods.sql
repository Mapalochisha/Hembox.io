-- Seed HEMBOX's initial manual payment instructions for the unified billing ledger.
-- Mobile money methods are customer-ready. Bank transfer stays inactive until real bank details replace the explicit placeholders.
-- Idempotent: existing administrator-edited methods are not overwritten.

insert into public.billing_payment_methods
  (method_key, display_name, supported_currencies, instructions, active, version)
values
  ('mtn_mobile_money', 'MTN Mobile Money', array['ZMW']::text[],
   'Pay the exact ZMW amount shown on your HEMBOX invoice to MTN Mobile Money number +260969868508. Recipient/account holder: Mapalo Chisha. Before confirming, check that the recipient name matches. Use your invoice number as the payment reference where the mobile-money service allows it. After sending, open Portal → Bills, select the invoice, and submit the transaction ID/reference and the exact amount paid. Keep your confirmation message. HEMBOX will verify the funds received before marking the invoice paid. A submitted claim is not confirmation of payment. If the recipient name or number does not match, do not send money; contact HEMBOX through the invoice conversation.',
   true, 1),
  ('airtel_money', 'Airtel Money', array['ZMW']::text[],
   'Pay the exact ZMW amount shown on your HEMBOX invoice to Airtel Money number +260772448274. Recipient/account holder: Mapalo Chisha. Before confirming, check that the recipient name matches. Use your invoice number as the payment reference where the mobile-money service allows it. After sending, open Portal → Bills, select the invoice, and submit the transaction ID/reference and the exact amount paid. Keep your confirmation message. HEMBOX will verify the funds received before marking the invoice paid. A submitted claim is not confirmation of payment. If the recipient name or number does not match, do not send money; contact HEMBOX through the invoice conversation.',
   true, 1),
  ('zamtel_money', 'Zamtel Kwacha', array['ZMW']::text[],
   'Pay the exact ZMW amount shown on your HEMBOX invoice to Zamtel Kwacha number +260953780272. Recipient/account holder: Mapalo Chisha. Before confirming, check that the recipient name matches. Use your invoice number as the payment reference where the mobile-money service allows it. After sending, open Portal → Bills, select the invoice, and submit the transaction ID/reference and the exact amount paid. Keep your confirmation message. HEMBOX will verify the funds received before marking the invoice paid. A submitted claim is not confirmation of payment. If the recipient name or number does not match, do not send money; contact HEMBOX through the invoice conversation.',
   true, 1),
  ('bank_transfer', 'Bank transfer', array['ZMW','USD']::text[],
   'BANK TRANSFER SETUP PLACEHOLDER — do not send money using this method until HEMBOX publishes verified bank details. Bank name: [BANK NAME TO BE ADDED]. Account holder: Mapalo Chisha. Account name/type: [ACCOUNT TYPE TO BE ADDED]. Account number: [ACCOUNT NUMBER TO BE ADDED]. Branch: [BRANCH TO BE ADDED]. SWIFT/BIC (if applicable): [SWIFT/BIC TO BE ADDED]. Currency: use only the currency shown on your invoice and confirmed for the bank account. This method is intentionally inactive until the placeholders are replaced with verified details. Once enabled, use your HEMBOX invoice number as the transfer reference, then submit the transfer reference and exact amount through Portal → Bills. Payment is not confirmed until HEMBOX verifies the funds received.',
   false, 1)
on conflict (method_key) do nothing;
