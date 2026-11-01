# Stratic Market — QR Payment Security (Hindi)

## Is update se kya badla
- Buyer ka static seller-QR UPI order hamesha `PAYMENT_PENDING` rahega. Buyer ka typed UTR apne aap payment proof nahi hai.
- Order ko admin tabhi verify kar sakta hai jab seller ke bank/UPI statement me wahi UTR aur exact order amount ka credit sach me dikh raha ho.
- Admin verification me statement ka UTR dobara enter karna zaroori hai; buyer ka UTR aur bank statement UTR exact match hona chahiye.
- Amount order total ke bilkul barabar hona chahiye.
- Ek UTR ko doosre order me verify nahi kiya ja sakta. Checkout aur storage layer dono par duplicate UTR reject hota hai; case, spaces aur hyphen jaise formatting differences se bhi duplicate check bypass nahi hota.
- Isliye same seller ke do alag products ki price/QR same hone par bhi pehle order ka UTR doosre order ke liye dobara submit nahi ho sakta.
- Sirf gateway ke server-side verification ke baad gateway order confirm ho sakta hai.
- Galat/missing/mismatched UTR ya amount par order pending rahega.

## Bahut zaroori limitation
Aapka seller-uploaded QR ek static personal UPI QR hai. Static QR + buyer-entered UTR se website ya AI khud bank ke private transaction ledger ko access nahi kar sakta. Isliye yeh update automatic bank verification ka daawa nahi karta. Admin ko seller ke actual bank/UPI statement me credit dekhkar hi manual verification karni hogi.

Agar aapko poori automatic verification chahiye, to har seller ko aise UPI acquiring/merchant payment provider se jodna hoga jo:
1. har order ke liye unique provider-side payment/order reference ya dynamic QR banaye;
2. signed webhook/server API se payment status, amount, merchant account aur provider transaction ID de;
3. Stratic backend ko seller/merchant mapping aur settlement/reconciliation API de.

Personal UPI QR ke liye bank statement API/webhook aam taur par uplabdh nahi hota. Provider support aur merchant onboarding confirm kiye bina automatic verification possible nahi hai.

## Admin verification ka sahi tareeqa
1. Admin dashboard > Online payments me order dekhein.
2. Seller se confirm karein ki payment uske account me aayi hai.
3. Seller ke bank/UPI statement me credit kholein — buyer ka screenshot/typed UTR akela proof nahi hai.
4. Check karein ki wahi UTR kisi aur order me pehle submit/verify na hua ho; system duplicate UTR ko reject karta hai.
5. Statement ka UTR aur exact credited amount dekhein.
6. Sirf tab “Payment received” karein jab credit isi order ke liye ho aur pehle kisi order me use na hua ho. Warna Reject karein / Pending chhodein.

## Deploy se pehle
- Staging par fake UTR, wrong amount, duplicate UTR, UTR from another payment, correct bank UTR and gateway success/failure test karein.
- Existing production data ka backup lein.
- Is patch ko automatic AI/bank verification na samjhein; yeh static QR flow ko fail-closed + manually reconciled banata hai.
