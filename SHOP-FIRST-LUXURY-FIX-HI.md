# Stratic Market — Shop-first luxury layout update

इस अपडेट में मौजूदा ऐप की बाकी सुविधाएँ हटाई नहीं गई हैं। Chat, Privacy Policy, Terms, login, cart, orders, payments, parcel और बाकी मौजूदा मॉड्यूल शामिल रखे गए हैं।

## बदलाव
- Home पर अब अलग-अलग/global product cards दुकानों के नीचे नहीं दिखते। Home पर केवल storefront cards दिखते हैं।
- हर storefront card पर shop logo, मोटे अक्षरों में shop name, नीचे हल्के रंग में company name, product count और अधिकतम पाँच product thumbnails दिखते हैं।
- पाँच से अधिक products देखने के लिए View Store दबाना होगा। Store detail page में उसी दुकान के सभी products दिखते हैं।
- Bottom navigation में `Categories` का label `Shop` किया गया है। बीच का गोल `+` button दुकान बनाने के लिए है; इससे Home / Shop / + / Cart / Profile क्रम रहता है।
- Shop create करने के बाद product upload dialog अपने-आप नहीं खुलता। पहले नई दुकान खुलती है; दुकान के अंदर `Add Product` दबाकर product upload होता है।
- Product upload form में selected shop ID ही भेजी जाती है; shop name दोबारा नहीं पूछा जाता।
- Product save होने के बाद global product feed में product inject नहीं होता; selected shop refresh होती है।
- Private admin dashboard में सभी shops, product count, sold units, order count, sales value और manual Blue Tick control जोड़ा गया है।
- Blue Tick डिफॉल्ट रूप से बंद है और केवल private admin dashboard से बदला जा सकता है।
- Purple / lavender / gold palette को बरकरार रखा गया है।

## डेटा सुरक्षा
पुराने products जिनके साथ कोई shop ID नहीं जुड़ी है, वे नए shop-first Home या किसी नई shop के अंदर नहीं दिखेंगे। ZIP में कोई production database delete/migration नहीं चलती; live data को deploy से पहले backup करना जरूरी है।

## सीमाएँ
कंपनी के नाम से बनने वाला लोगो original monogram SVG है, किसी brand का official trademark/logo स्वतः copy नहीं करता। Product-level star rating workflow इस update में implement नहीं किया गया है; storefront पर rating तभी दिखेगी जब rating data मौजूद हो।
