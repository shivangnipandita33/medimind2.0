// Voice helpers: speak reminders aloud (text-to-speech) and listen to questions (speech-to-text).
// Uses the browser's built-in Web Speech API - free, no key. Quality and the list of languages
// depend on the voices installed on the user's device/browser (Chrome and Edge have the most).

const KEY = "medimind_voice";

// Spoken reminder sentence per language. {name} and {dose} are filled in.
// (Written by AI - have a native speaker review them before real use.)
export const VOICE_LANGS = [
  { code: "en", bcp: "en-US", label: "English", say: "It's time for your medicine. Please take {name}, {dose}." },
  { code: "hi", bcp: "hi-IN", label: "हिन्दी (Hindi)", say: "आपकी दवा लेने का समय हो गया है। कृपया {name}, {dose} लें।" },
  { code: "bn", bcp: "bn-IN", label: "বাংলা (Bengali)", say: "আপনার ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে {name}, {dose} খান।" },
  { code: "ta", bcp: "ta-IN", label: "தமிழ் (Tamil)", say: "உங்கள் மருந்து எடுத்துக்கொள்ளும் நேரம் வந்துவிட்டது. தயவுசெய்து {name}, {dose} எடுத்துக்கொள்ளுங்கள்." },
  { code: "te", bcp: "te-IN", label: "తెలుగు (Telugu)", say: "మీరు మందు వేసుకునే సమయం అయింది. దయచేసి {name}, {dose} తీసుకోండి." },
  { code: "mr", bcp: "mr-IN", label: "मराठी (Marathi)", say: "तुमची औषध घेण्याची वेळ झाली आहे. कृपया {name}, {dose} घ्या." },
  { code: "gu", bcp: "gu-IN", label: "ગુજરાતી (Gujarati)", say: "તમારી દવા લેવાનો સમય થઈ ગયો છે. કૃપા કરીને {name}, {dose} લો." },
  { code: "kn", bcp: "kn-IN", label: "ಕನ್ನಡ (Kannada)", say: "ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ. ದಯವಿಟ್ಟು {name}, {dose} ತೆಗೆದುಕೊಳ್ಳಿ." },
  { code: "ml", bcp: "ml-IN", label: "മലയാളം (Malayalam)", say: "നിങ്ങളുടെ മരുന്ന് കഴിക്കാനുള്ള സമയമായി. ദയവായി {name}, {dose} കഴിക്കുക." },
  { code: "pa", bcp: "pa-IN", label: "ਪੰਜਾਬੀ (Punjabi)", say: "ਤੁਹਾਡੀ ਦਵਾਈ ਲੈਣ ਦਾ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ {name}, {dose} ਲਵੋ।" },
  { code: "ur", bcp: "ur-PK", label: "اردو (Urdu)", say: "آپ کی دوا لینے کا وقت ہو گیا ہے۔ براہ کرم {name}، {dose} لیں۔" },
  { code: "es", bcp: "es-ES", label: "Español", say: "Es hora de tu medicina. Por favor toma {name}, {dose}." },
  { code: "fr", bcp: "fr-FR", label: "Français", say: "C'est l'heure de votre médicament. Veuillez prendre {name}, {dose}." },
  { code: "de", bcp: "de-DE", label: "Deutsch", say: "Es ist Zeit für Ihr Medikament. Bitte nehmen Sie {name}, {dose}." },
  { code: "pt", bcp: "pt-BR", label: "Português", say: "É hora do seu remédio. Por favor, tome {name}, {dose}." },
  { code: "ar", bcp: "ar-SA", label: "العربية (Arabic)", say: "حان وقت دوائك. من فضلك تناول {name}، {dose}." },
];

const DEFAULTS = { enabled: true, lang: "auto", rate: 0.9 };

export function getVoicePrefs() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setVoicePrefs(patch) {
  const next = { ...getVoicePrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked */
  }
  return next;
}

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Which voice language to use: the saved choice, or the app language when set to "auto". */
export function resolveVoiceLang(uiLang) {
  const { lang } = getVoicePrefs();
  const code = lang === "auto" ? uiLang : lang;
  return VOICE_LANGS.find((v) => v.code === code) || VOICE_LANGS[0];
}

// Browsers load their voice list asynchronously.
function voicesReady() {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([]);
    const have = window.speechSynthesis.getVoices();
    if (have.length) return resolve(have);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

export async function findVoice(bcp) {
  const voices = await voicesReady();
  const base = bcp.slice(0, 2).toLowerCase();
  return (
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === bcp.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    null
  );
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** Speak any text. Resolves true if it started, false if unsupported or no voice. */
export async function speak(text, bcp = "en-US", { rate, requireVoice = false } = {}) {
  if (!ttsSupported() || !text) return false;
  const voice = await findVoice(bcp);
  if (!voice && requireVoice) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang || bcp;
  if (voice) u.voice = voice;
  u.rate = rate ?? getVoicePrefs().rate;
  u.volume = 1;
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Speak "it's time for your medicine ..." in the chosen language.
 * If the device has no voice for that language it falls back to English so the user still hears it.
 */
export async function speakReminder(medicine, uiLang) {
  const prefs = getVoicePrefs();
  if (!prefs.enabled || !ttsSupported()) return false;
  let v = resolveVoiceLang(uiLang);
  if (!(await findVoice(v.bcp))) v = VOICE_LANGS[0];
  const text = v.say.replace("{name}", medicine.name).replace("{dose}", medicine.dosage || "");
  return speak(text, v.bcp);
}

// Chrome only lets a page speak after the user has interacted with it once. Any click or key does it,
// so we "prime" the speech engine on the first interaction.
let primed = false;
export function primeVoice() {
  if (primed || !ttsSupported()) return;
  const prime = () => {
    primed = true;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.removeEventListener("pointerdown", prime);
    window.removeEventListener("keydown", prime);
  };
  window.addEventListener("pointerdown", prime);
  window.addEventListener("keydown", prime);
}

// ------------------------------------------------------------ speech to text
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const sttSupported = () => !!SR;

/** Start listening once. Returns a function that stops it. */
export function listen(bcp, { onText, onEnd, onError }) {
  if (!SR) {
    onError?.("Voice input is not supported in this browser. Try Chrome or Edge.");
    return () => {};
  }
  const rec = new SR();
  rec.lang = bcp;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    const text = Array.from(e.results).map((r) => r[0].transcript).join(" ");
    onText?.(text, e.results[e.results.length - 1].isFinal);
  };
  rec.onerror = (e) =>
    onError?.(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone access is blocked. Allow the microphone in your browser's address bar."
        : e.error === "no-speech"
        ? "I didn't hear anything. Try again."
        : `Voice input error: ${e.error}`
    );
  rec.onend = () => onEnd?.();
  try {
    rec.start();
  } catch {
    onEnd?.();
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}
