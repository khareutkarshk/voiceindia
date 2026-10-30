// Her line in the scripts India pays in, set out like the language panel on the back of a rupee note.
// `line` is what she said on her fourth call ("after my salary comes"); `salary` is the word inside it that
// the particles carry in orange, down to the system that knows when the salary lands. `self` is the language's
// own name and `hello` how the voice agent opens the call, both drawn in particles later in the story.
// Drafts: every line is to be checked by a native speaker before launch.
export const LANGS = [
  { code: 'hi', name: 'Hindi', line: 'सैलरी आने के बाद', salary: 'सैलरी', self: 'हिन्दी', hello: 'नमस्ते' },
  { code: 'bn', name: 'Bengali', line: 'বেতন আসার পরে', salary: 'বেতন', self: 'বাংলা', hello: 'নমস্কার' },
  { code: 'ta', name: 'Tamil', line: 'சம்பளம் வந்த பிறகு', salary: 'சம்பளம்', self: 'தமிழ்', hello: 'வணக்கம்' },
  { code: 'mr', name: 'Marathi', line: 'पगार आल्यावर', salary: 'पगार', self: 'मराठी', hello: 'नमस्कार' },
  { code: 'te', name: 'Telugu', line: 'జీతం వచ్చాక', salary: 'జీతం', self: 'తెలుగు', hello: 'నమస్కారం' },
  { code: 'pa', name: 'Punjabi', line: 'ਤਨਖਾਹ ਆਉਣ ਤੋਂ ਬਾਅਦ', salary: 'ਤਨਖਾਹ', self: 'ਪੰਜਾਬੀ', hello: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ' },
  { code: 'gu', name: 'Gujarati', line: 'પગાર આવે પછી', salary: 'પગાર', self: 'ગુજરાતી', hello: 'નમસ્તે' },
  { code: 'kn', name: 'Kannada', line: 'ಸಂಬಳ ಬಂದ ಮೇಲೆ', salary: 'ಸಂಬಳ', self: 'ಕನ್ನಡ', hello: 'ನಮಸ್ಕಾರ' },
  { code: 'ml', name: 'Malayalam', line: 'ശമ്പളം വന്നിട്ട്', salary: 'ശമ്പളം', self: 'മലയാളം', hello: 'നമസ്കാരം' },
  { code: 'or', name: 'Odia', line: 'ଦରମା ଆସିବା ପରେ', salary: 'ଦରମା', self: 'ଓଡ଼ିଆ', hello: 'ନମସ୍କାର' },
  { code: 'as', name: 'Assamese', line: 'দৰমহা অহাৰ পিছত', salary: 'দৰমহা', self: 'অসমীয়া', hello: 'নমস্কাৰ' },
  { code: 'en', name: 'English', line: 'After my salary comes', salary: 'salary', self: 'English', hello: 'Hello' },
];

export const langOf = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
