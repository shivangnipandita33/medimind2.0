import { useEffect, useRef, useState } from "react";
import { Bot, Mic, MicOff, Pill, Send, ShieldAlert, Sparkles, Square, Stethoscope, User, Volume2 } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n/I18nProvider";
import { listen, resolveVoiceLang, speak, sttSupported, stopSpeaking, ttsSupported } from "../utils/voice";

const SUGGESTIONS = {
  medicine: ["ai.s1", "ai.s2", "ai.s3", "ai.s4"],
  doctor: ["doc.s1", "doc.s2", "doc.s3", "doc.s4"],
};

export default function AIAssistant() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState("medicine"); // medicine | doctor
  const [chats, setChats] = useState({ medicine: [], doctor: [] });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const endRef = useRef(null);
  const stopListen = useRef(null);
  const messages = chats[mode];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Stop the microphone / speech when leaving the page or switching tabs.
  useEffect(() => () => { stopListen.current?.(); stopSpeaking(); }, []);

  const push = (m, msg) => setChats((c) => ({ ...c, [m]: [...c[m], msg] }));

  const send = async (text, viaVoice = false) => {
    const question = text.trim();
    if (!question || loading) return;
    const current = mode;
    const history = chats[current].filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    push(current, { role: "user", text: question });
    setInput("");
    setLoading(true);
    try {
      const res = await api.ask(question, history, lang, current);
      push(current, { role: "assistant", text: res.answer });
      if (viaVoice && ttsSupported()) speak(res.answer, resolveVoiceLang(lang).bcp);
    } catch (err) {
      push(current, { role: "assistant", text: err.message, error: true });
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    if (listening) return stopListen.current?.();
    stopSpeaking();
    setVoiceMsg("");
    let heard = "";
    setListening(true);
    stopListen.current = listen(resolveVoiceLang(lang).bcp, {
      onText: (text) => {
        heard = text;
        setInput(text);
      },
      onEnd: () => {
        setListening(false);
        if (heard.trim()) send(heard, true); // asked by voice -> answered by voice
      },
      onError: (msg) => {
        setVoiceMsg(msg);
        setListening(false);
      },
    });
  };

  const readAloud = (i, text) => {
    if (speakingIdx === i) {
      stopSpeaking();
      return setSpeakingIdx(null);
    }
    setSpeakingIdx(i);
    speak(text, resolveVoiceLang(lang).bcp).then((ok) => !ok && setSpeakingIdx(null));
    // The Web Speech API has no reliable "finished" event across browsers, so reset after a while.
    setTimeout(() => setSpeakingIdx((cur) => (cur === i ? null : cur)), Math.min(60000, 2000 + text.length * 70));
  };

  return (
    <section className="card chat" aria-label="AI assistant">
      <div className="seg chat-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "medicine"} className={`seg-btn ${mode === "medicine" ? "active" : ""}`} onClick={() => setMode("medicine")}>
          <Pill size={15} aria-hidden="true" /> {t("ai.tab_medicine")}
        </button>
        <button role="tab" aria-selected={mode === "doctor"} className={`seg-btn ${mode === "doctor" ? "active" : ""}`} onClick={() => setMode("doctor")}>
          <Stethoscope size={15} aria-hidden="true" /> {t("ai.tab_doctor")}
        </button>
      </div>

      <div className="notice" role="note">
        <ShieldAlert size={18} aria-hidden="true" /> {mode === "doctor" ? t("doc.notice") : t("ai.notice")}
      </div>

      <div className="chat-log" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon" aria-hidden="true">
              {mode === "doctor" ? <Stethoscope size={28} /> : <Sparkles size={28} />}
            </div>
            <h3>{mode === "doctor" ? t("doc.empty_title") : t("ai.empty_title")}</h3>
            <p className="muted">{mode === "doctor" ? t("doc.empty_sub") : t("ai.empty_sub")}</p>
            <div className="suggestions">
              {SUGGESTIONS[mode].map((k) => (
                <button key={k} className="suggestion" onClick={() => send(t(k))}>{t(k)}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role} ${m.error ? "msg-error" : ""}`}>
            <span className="msg-avatar" aria-hidden="true">
              {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </span>
            <div className="msg-bubble">
              {m.text}
              {m.role === "assistant" && !m.error && ttsSupported() && (
                <button className="read-aloud" onClick={() => readAloud(i, m.text)} aria-label={t("voice.read_aloud")} title={t("voice.read_aloud")}>
                  {speakingIdx === i ? <Square size={13} /> : <Volume2 size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg msg-assistant">
            <span className="msg-avatar" aria-hidden="true"><Bot size={16} /></span>
            <div className="msg-bubble typing" aria-label="Assistant is typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {voiceMsg && <p className="form-error voice-msg" role="alert">{voiceMsg}</p>}

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label htmlFor="chat-q" className="sr-only">{t("ai.placeholder")}</label>
        <input
          id="chat-q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? t("voice.listening") : t("ai.placeholder")}
          maxLength={1000}
          autoComplete="off"
        />
        {sttSupported() && (
          <button type="button" className={`btn btn-ghost mic-btn ${listening ? "listening" : ""}`} onClick={toggleMic}
                  aria-label={listening ? t("voice.stop") : t("voice.ask")} title={listening ? t("voice.stop") : t("voice.ask")}>
            {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
          </button>
        )}
        <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()} aria-label="Send question">
          <Send size={17} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
