# Seller Analytics — Hindi Notes

- Seller-only shop dashboard में **51 अलग-अलग रिपोर्ट कार्ड** हैं। हर रिपोर्ट का सिर्फ एक visible card होता है।
- हर कार्ड के अपने तीन-dot menu से उसी कार्ड की रिपोर्ट को पिछले 24 घंटे, 7 दिन या 30 दिन के लिए बदला जा सकता है। सभी रिपोर्ट एक साथ duplicate होकर नहीं दिखतीं।
- रिपोर्ट के आंकड़े उपलब्ध saved shop orders, products और timestamp वाले product-view records से निकाले जाते हैं। किसी missing field के लिए अनुमानित आंकड़ा नहीं बनाया जाता।
- वर्तमान codebase में अलग refund ledger नहीं है, इसलिए वास्तविक refund totals का दावा नहीं किया जाता। Visitor-country reporting भी तभी सटीक होगी जब visitor country को consent/appropriate privacy handling के साथ रिकॉर्ड किया जाए; अभी country metrics order/account data से आते हैं।
- Profile photo save होने पर bottom Profile tab में photo दिखती है और green check करीब 3.5 सेकंड बाद अपने-आप हट जाता है।
- Focused source test: `node --test test/seller-analytics-source.test.js`
