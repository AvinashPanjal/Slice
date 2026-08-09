'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, X, Volume2, CheckCircle2, Bot, PhoneCall, Radio, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  const [isCallActive, setIsCallActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'LIVE' | 'SPEAKING' | 'LISTENING'>('DISCONNECTED');
  const [transcript, setTranscript] = useState<string>('തത്സമയ മലയാളം വോയ്‌സ് കോളിലേക്ക് സ്വാഗതം! "സ്റ്റാർട്ട് കോൾ" ക്ലിക്ക് ചെയ്യൂ.');
  const [lastAction, setLastAction] = useState<{ title: string; details: string } | null>(null);
  const [matchedPersonName, setMatchedPersonName] = useState<string | null>(null);

  const isCallActiveRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // Stop call on modal close
  useEffect(() => {
    if (!isOpen) {
      endCall();
    }
  }, [isOpen]);

  // Ensure AudioContext is unlocked by user gesture
  const unlockAudioContext = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      // Soft audio chime to unlock speaker output
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.25);
    } catch (e) {
      console.error('Failed to unlock audio context:', e);
    }
  };

  const startCall = async () => {
    try {
      await unlockAudioContext();
      setConnectionStatus('CONNECTING');
      setIsCallActive(true);
      isCallActiveRef.current = true;
      setTranscript('ഗൂഗിൾ AI ലൈവ് സിസ്റ്റവുമായി കണക്ട് ചെയ്യുന്നു...');

      const apiKey = localStorage.getItem('gemini_api_key') || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

      // Welcome voice greeting
      const initialGreeting = 'നമസ്കാരം! ഞാൻ LendWise AI ആണ്. സംസാരിക്കൂ.';
      speakResponseMalayalam(initialGreeting);

      // Check if Gemini Live WebSocket is available
      if (apiKey && typeof window !== 'undefined' && 'WebSocket' in window) {
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        try {
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log('Gemini Live API WebSocket Connected');
            setConnectionStatus('LIVE');
            setTranscript('Gemini Live കണക്റ്റഡ്! തുടർച്ചയായി സംസാരിക്കാം.');

            const setupMessage = {
              setup: {
                model: 'models/gemini-2.0-flash-exp',
                generationConfig: {
                  responseModalities: ['AUDIO', 'TEXT'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Puck' },
                    },
                  },
                },
                systemInstruction: {
                  parts: [
                    {
                      text: `You are LendWise Real-Time Malayalam Voice AI Assistant. You converse with the user via live bidirectional audio in fluent Malayalam.
The user speaks to you in Malayalam or Manglish.
When asked about a specific person (e.g. Abin), give THAT person's due only.
When an action is taken (e.g. Abin 100 rs paid), confirm it clearly in short Malayalam speech under 2 sentences.`,
                    },
                  ],
                },
              },
            };
            ws.send(JSON.stringify(setupMessage));
            startMicrophoneStream(ws);
          };

          ws.onmessage = async (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.serverContent?.modelTurn?.parts) {
                for (const part of data.serverContent.modelTurn.parts) {
                  if (part.text) {
                    setTranscript(part.text);
                  }
                  if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/pcm')) {
                    setConnectionStatus('SPEAKING');
                    playPcmAudio(part.inlineData.data);
                  }
                }
              }

              if (data.toolCall) {
                handleFunctionCall(data.toolCall, ws);
              }
            } catch (e) {
              console.error('Error parsing WebSocket message:', e);
            }
          };

          ws.onerror = (err) => {
            console.warn('Gemini Live WebSocket error, using Web Speech Stream:', err);
            fallbackToWebSpeech();
          };

          ws.onclose = () => {
            console.log('Gemini Live WebSocket closed');
          };
          return;
        } catch (e) {
          console.warn('Direct WebSocket failed, using Web Speech Stream:', e);
        }
      }

      fallbackToWebSpeech();
    } catch (err) {
      console.error('Failed to start Live Audio Call:', err);
      setConnectionStatus('DISCONNECTED');
      setIsCallActive(false);
      isCallActiveRef.current = false;
    }
  };

  // Capture Microphone Audio (16kHz PCM)
  const startMicrophoneStream = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64Pcm = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        ws.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Pcm,
                },
              ],
            },
          })
        );
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setConnectionStatus('LISTENING');
    } catch (err) {
      console.error('Error starting microphone stream:', err);
      fallbackToWebSpeech();
    }
  };

  // Playback PCM Audio from Gemini Live API
  const playPcmAudio = async (base64Pcm: string) => {
    try {
      await unlockAudioContext();
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);

      const audioCtx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = audioCtx.createBuffer(1, int16Array.length, 24000);
      const channelData = buffer.getChannelData(0);

      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);

      source.onended = () => {
        setConnectionStatus('LISTENING');
      };
    } catch (e) {
      console.error('Error playing PCM audio:', e);
    }
  };

  // Continuous Web Speech Stream with Auto-Restart Loop
  const fallbackToWebSpeech = () => {
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setTranscript('ശബ്ദ സന്ദേശം പിന്തുണയ്ക്കുന്നില്ല. ബ്രൗസർ അപ്ഡേറ്റ് ചെയ്യുക.');
      setConnectionStatus('DISCONNECTED');
      setIsCallActive(false);
      isCallActiveRef.current = false;
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'ml-IN';

    setConnectionStatus('LIVE');
    setTranscript('മലയാളം ലൈവ് വോയ്‌സ് റെഡി! പറയു... (e.g. "ആബിൻ 100 രൂപ നൽകി")');

    recognition.onresult = async (event: any) => {
      const lastIndex = event.results.length - 1;
      const spokenText = event.results[lastIndex][0].transcript;

      if (spokenText && spokenText.trim()) {
        setTranscript(`കേട്ടത്: "${spokenText}"`);
        setConnectionStatus('SPEAKING');

        try {
          const storedApiKey = localStorage.getItem('gemini_api_key') || '';
          const res = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: spokenText,
              customApiKey: storedApiKey,
              language: 'ml-IN',
            }),
          });

          const data = await res.json();
          if (data.matchedPerson) {
            setMatchedPersonName(data.matchedPerson);
          }
          if (data.response) {
            setTranscript(data.response);
            speakResponseMalayalam(data.response);

            if (data.actionTaken === 'RECORD_PAYMENT' && data.actionDetails) {
              setLastAction({
                title: 'പേയ്‌മെന്റ് രേഖപ്പെടുത്തി',
                details: `${data.actionDetails.personName}: ₹${data.actionDetails.amount}`,
              });
              if (onDataRefresh) onDataRefresh();
            }
          }
        } catch (err) {
          console.error('Error processing speech query:', err);
        }
      }
    };

    // Auto-restart recognition loop so it NEVER turns off after 1st chat turn
    recognition.onend = () => {
      console.log('Speech recognition paused/ended. Auto restarting continuous loop...');
      if (isCallActiveRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setConnectionStatus('LISTENING');
        } catch (e) {
          // Already active
        }
      }
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Error starting recognition:', e);
    }
  };

  const speakResponseMalayalam = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const mlVoice =
        voices.find((v) => v.lang.toLowerCase().includes('ml') || v.name.toLowerCase().includes('malayalam')) ||
        voices.find((v) => v.lang.toLowerCase().includes('hi')) ||
        voices.find((v) => v.lang.toLowerCase().includes('en-in')) ||
        voices[0];

      if (mlVoice) utterance.voice = mlVoice;
      utterance.lang = mlVoice?.lang || 'en-IN';
      utterance.volume = 1.0;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setConnectionStatus('SPEAKING');
      };

      utterance.onend = () => {
        setConnectionStatus('LISTENING');
        // Restart speech recognition if ended
        if (isCallActiveRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const handleFunctionCall = async (toolCall: any, ws: WebSocket) => {
    try {
      const storedApiKey = localStorage.getItem('gemini_api_key') || '';
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: JSON.stringify(toolCall),
          customApiKey: storedApiKey,
        }),
      });

      const data = await res.json();
      if (data.actionTaken && onDataRefresh) {
        onDataRefresh();
      }

      ws.send(
        JSON.stringify({
          toolResponse: {
            functionResponses: [
              {
                response: { output: data },
                id: toolCall.functionCalls?.[0]?.id,
              },
            ],
          },
        })
      );
    } catch (e) {
      console.error('Tool execution error:', e);
    }
  };

  const endCall = () => {
    isCallActiveRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsCallActive(false);
    setConnectionStatus('DISCONNECTED');
    setMatchedPersonName(null);
    setTranscript('കോൾ അവസാനിച്ചു.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark Blur Overlay */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

      {/* Gemini Live Call Modal Container */}
      <div className="relative w-full max-w-md bg-[#050505] border border-zinc-800 rounded-[2.5rem] p-6 text-white shadow-2xl z-10 flex flex-col items-center justify-between min-h-[530px]">
        {/* Top Header Controls */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isCallActive ? 'bg-emerald-500 animate-ping' : 'bg-zinc-600'}`} />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {connectionStatus === 'LIVE' || connectionStatus === 'LISTENING'
                ? '🎙️ LIVE (CONTINUOUS VOICE)'
                : connectionStatus === 'SPEAKING'
                ? '🔊 GEMINI SPEAKING...'
                : connectionStatus === 'CONNECTING'
                ? '⏳ CONNECTING...'
                : 'OFFLINE'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central Audio Orb / Visualizer */}
        <div className="my-6 flex flex-col items-center justify-center relative">
          {/* Animated Pulsing Rings */}
          {isCallActive && (
            <>
              <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 animate-ping duration-1000" />
              <div className="absolute w-36 h-36 rounded-full bg-indigo-500/20 animate-pulse" />
            </>
          )}

          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
              connectionStatus === 'SPEAKING'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 scale-110 shadow-emerald-500/40'
                : isCallActive
                ? 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-indigo-500/50 scale-105'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {connectionStatus === 'SPEAKING' ? (
              <Volume2 className="w-12 h-12 text-white animate-bounce" />
            ) : isCallActive ? (
              <Mic className="w-12 h-12 text-white animate-pulse" />
            ) : (
              <Radio className="w-10 h-10 text-zinc-400" />
            )}
          </div>

          <h3 className="mt-5 text-xl font-black tracking-tight text-center">
            {isCallActive ? 'LendWise Gemini Live' : 'Google AI Live Stream'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Hands-Free Continuous Malayalam Call</p>

          {/* Person Matched Live Chip */}
          {matchedPersonName && (
            <div className="mt-2.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold flex items-center space-x-1.5 animate-pulse">
              <UserCheck className="w-3.5 h-3.5" />
              <span>വ്യക്തി: {matchedPersonName}</span>
            </div>
          )}
        </div>

        {/* Realtime Live Transcript Box */}
        <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 text-center text-xs leading-relaxed min-h-[70px] flex items-center justify-center shadow-inner">
          <p className="text-zinc-200 font-medium">{transcript}</p>
        </div>

        {/* Action Executed Banner */}
        {lastAction && (
          <div className="mt-3 w-full bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3 flex items-center space-x-3 text-xs text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-extrabold text-[11px] uppercase tracking-wider">{lastAction.title}</p>
              <p className="text-zinc-200 text-xs font-semibold">{lastAction.details}</p>
            </div>
          </div>
        )}

        {/* Bottom Call Action Buttons */}
        <div className="w-full pt-5 flex items-center justify-center space-x-4">
          {!isCallActive ? (
            <button
              onClick={startCall}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-xl shadow-emerald-950 transition-all hover:scale-[1.02]"
            >
              <PhoneCall className="w-5 h-5" />
              <span>മലയാളം വോയ്‌സ് കോൾ ആരംഭിക്കൂ (Start Call)</span>
            </button>
          ) : (
            <button
              onClick={endCall}
              className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-xl shadow-rose-950 transition-all hover:scale-[1.02]"
            >
              <PhoneOff className="w-5 h-5" />
              <span>കോൾ അവസാനിപ്പിക്കൂ (End Call)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
