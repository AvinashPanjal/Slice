'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, X, Volume2, CheckCircle2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  actionTaken?: string | null;
  actionDetails?: any;
  timestamp: string;
}

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRefresh?: () => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onDataRefresh,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'AI',
      text: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ LendWise മലയാളം AI അസിസ്റ്റന്റാണ്. "ആബിൻ 100 rs നൽകി", "ഈ മാസത്തെ കുടിശ്ശിക എത്രയാണ്?" തുടങ്ങിയ കാര്യങ്ങൾ എന്നോട് പറയാം.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState<'ml-IN' | 'en-IN'>('ml-IN');

  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup Web Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = speechLanguage;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputText(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [speechLanguage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported in your browser. Please type your query in the chat input.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInputText('');
      recognitionRef.current.lang = speechLanguage;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Speak response in Malayalam
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLanguage === 'ml-IN' ? 'ml-IN' : 'en-IN';
      utterance.rate = 0.95;

      // Try to find Malayalam voice if available
      const voices = window.speechSynthesis.getVoices();
      const mlVoice = voices.find((v) => v.lang.includes('ml') || v.name.toLowerCase().includes('malayalam'));
      if (mlVoice) {
        utterance.voice = mlVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputText;
    if (!promptToSend.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'USER',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Get stored user API Key if set in Settings
      const storedApiKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          customApiKey: storedApiKey,
          language: speechLanguage,
        }),
      });

      const data = await res.json();

      if (data.response) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'AI',
          text: data.response,
          actionTaken: data.actionTaken,
          actionDetails: data.actionDetails,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, aiMsg]);
        speakText(data.response);

        // If financial action was taken (e.g. payment recorded), trigger dashboard data refresh!
        if (data.actionTaken && onDataRefresh) {
          onDataRefresh();
        }
      }
    } catch (err) {
      console.error('Error querying AI Assistant:', err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'AI',
        text: 'ക്ഷമിക്കണം, എനിക്ക് നിങ്ങളുടെ ആവശ്യം പ്രോസസ്സ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കൂ.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Liquid Glass Dialog Container */}
      <div className="relative w-full max-w-lg liquid-glass rounded-3xl p-4 sm:p-6 z-10 my-auto shadow-2xl flex flex-col h-[85vh] max-h-[700px] border border-white/20 dark:border-white/10 overflow-hidden box-border">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>LendWise Malayalam AI</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
                  Gemini Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">സംസാരിക്കാം, പേയ്‌മെന്റുകൾ അടയാളപ്പെടുത്താം</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Language Selector Chip */}
            <button
              onClick={() => setSpeechLanguage(speechLanguage === 'ml-IN' ? 'en-IN' : 'ml-IN')}
              className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              {speechLanguage === 'ml-IN' ? '🇮🇳 മലയാളം' : '🌐 Manglish'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversation Message Feed */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-end space-x-2 max-w-[88%]">
                {msg.sender === 'AI' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mb-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    msg.sender === 'USER'
                      ? 'bg-indigo-600 text-white rounded-br-none font-medium'
                      : 'bg-zinc-900/90 dark:bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-bl-none'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Executed Action Badge */}
                  {msg.actionTaken === 'RECORD_PAYMENT' && msg.actionDetails && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/30 flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {msg.actionDetails.personName}: ₹{msg.actionDetails.amount} രേഖപ്പെടുത്തി!
                      </span>
                    </div>
                  )}
                </div>

                {msg.sender === 'USER' && (
                  <div className="w-7 h-7 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0 mb-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>

              <span className="text-[10px] text-zinc-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-2 text-zinc-400 text-xs py-2 px-3 bg-zinc-900/60 rounded-2xl w-fit">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>മലയാളത്തിൽ ചിന്തിക്കുന്നു...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Malayalam Suggestion Chips */}
        <div className="py-2 flex items-center space-x-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => handleSend('ഈ മാസത്തെ കുടിശ്ശിക എത്രയാണ്?')}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            📊 കുടിശ്ശിക വിവരം
          </button>

          <button
            onClick={() => handleSend('ആബിൻ 100 rs നൽകി എന്ന് രേഖപ്പെടുത്തൂ')}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            💸 "Abin 100 rs paid"
          </button>

          <button
            onClick={() => handleSend('ആബിന്റെ അഡൈവ് പൂർണ്ണമായി അടച്ചു')}
            className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
          >
            ✅ "Mark Abin Paid"
          </button>
        </div>

        {/* Input Bar & Mic Button */}
        <div className="pt-2 border-t border-zinc-800 shrink-0">
          <div className="flex items-center space-x-2">
            {/* Mic Listening Button */}
            <button
              onClick={toggleListening}
              className={`p-3 rounded-2xl transition-all shadow-md shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white animate-bounce ring-4 ring-rose-500/30'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title={isListening ? 'Stop Listening' : 'Speak in Malayalam'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Input Text Box */}
            <input
              type="text"
              placeholder={isListening ? 'സംസാരിക്കൂ... Listening...' : 'മലയാളത്തിൽ പറയൂ... (e.g. Abin 100 rs paid)'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-zinc-900/90 text-white placeholder-zinc-500 text-xs sm:text-sm px-4 py-3 rounded-2xl border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {/* Send Button */}
            <Button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || loading}
              className="p-3 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
