"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  useImperativeHandle,
} from "react";
import { Mic, ChevronDown, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal SpeechRecognition interfaces for TypeScript safety
interface ISpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export interface VoiceLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  short: string;
}

export const SUPPORTED_VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: "en-IN", label: "English", nativeLabel: "English", short: "EN" },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", short: "HI" },
  { code: "ta-IN", label: "Tamil", nativeLabel: "தமிழ்", short: "TA" },
  { code: "te-IN", label: "Telugu", nativeLabel: "తెలుగు", short: "TE" },
  { code: "kn-IN", label: "Kannada", nativeLabel: "ಕನ್ನಡ", short: "KN" },
  { code: "ml-IN", label: "Malayalam", nativeLabel: "മലയാളം", short: "ML" },
  { code: "bn-IN", label: "Bengali", nativeLabel: "বাংলা", short: "BN" },
  { code: "mr-IN", label: "Marathi", nativeLabel: "मराठी", short: "MR" },
];

export interface VoiceButtonHandle {
  stopListening: () => void;
}

export interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  ref?: React.Ref<VoiceButtonHandle>;
}

function getInitialVoiceLang(): string {
  if (typeof window !== "undefined") {
    try {
      const savedLang = localStorage.getItem("kartly:voiceLang");
      if (
        savedLang &&
        SUPPORTED_VOICE_LANGUAGES.some((l) => l.code === savedLang)
      ) {
        return savedLang;
      }
    } catch {
      // Ignore localStorage access restrictions
    }
  }
  return "en-IN";
}

function checkSpeechRecognitionSupport(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function VoiceButton({
  onTranscript,
  disabled = false,
  className,
  ref,
}: VoiceButtonProps) {
  // Check SpeechRecognition support using useSyncExternalStore for clean SSR hydration
  const isSupported = useSyncExternalStore(
    () => () => {},
    checkSpeechRecognitionSupport,
    () => false
  );

  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>(getInitialVoiceLang);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Stop listening safely
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Expose stopListening handle to parent for stopping on form submit
  useImperativeHandle(ref, () => ({
    stopListening,
  }), [stopListening]);

  // Stop listening on Escape key press
  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopListening();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isListening, stopListening]);

  // Auto-dismiss error message after 4s
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      setErrorMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Close language dropdown on outside click
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // If SpeechRecognition is not supported, hide button completely
  if (!isSupported) {
    return null;
  }

  const handleSelectLanguage = (code: string) => {
    setSelectedLang(code);
    setIsMenuOpen(false);
    try {
      localStorage.setItem("kartly:voiceLang", code);
    } catch {
      // Ignore localStorage write error
    }

    // If currently listening, stop so next start uses the new language
    if (isListening) {
      stopListening();
    }
  };

  const startListening = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => ISpeechRecognition;
      webkitSpeechRecognition?: new () => ISpeechRecognition;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return;

    setErrorMessage(null);

    try {
      const recognition = new SR();
      recognition.lang = selectedLang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          setErrorMessage("Microphone access denied. Please allow mic in settings.");
        } else if (event.error === "no-speech") {
          setErrorMessage("No speech detected. Please speak clearly.");
        } else if (event.error !== "aborted") {
          setErrorMessage("Voice input failed. Please try again.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      setErrorMessage("Could not start voice search.");
      setIsListening(false);
    }
  };

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const currentLangObj =
    SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === selectedLang) ||
    SUPPORTED_VOICE_LANGUAGES[0];

  return (
    <div className={cn("relative flex items-center gap-1", className)} ref={menuRef}>
      {/* Listening Live Region for Screen Readers */}
      <span className="sr-only" aria-live="polite">
        {isListening ? "Listening... Speak your shopping request" : ""}
      </span>

      {/* Floating Error Bubble */}
      {errorMessage && (
        <div
          role="alert"
          className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 whitespace-nowrap z-50 animate-in fade-in zoom-in-95"
        >
          <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Mic Button */}
      <button
        type="button"
        onClick={handleToggleVoice}
        disabled={disabled}
        aria-label={
          isListening
            ? "Listening... Click to stop"
            : `Voice search in ${currentLangObj.label}`
        }
        title={
          isListening
            ? "Listening... (Press Escape to cancel)"
            : `Voice search (${currentLangObj.label})`
        }
        className={cn(
          "relative size-9 rounded-full flex items-center justify-center transition-all cursor-pointer",
          isListening
            ? "bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse"
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none"
        )}
      >
        <Mic className={cn("size-4", isListening && "animate-bounce")} />
      </button>

      {/* Language Selector Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={disabled || isListening}
        aria-label={`Change voice language (currently ${currentLangObj.label})`}
        aria-expanded={isMenuOpen}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex items-center gap-0.5 px-1.5 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors cursor-pointer",
          isMenuOpen && "bg-gray-100 text-gray-900",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none"
        )}
      >
        <span>{currentLangObj.short}</span>
        <ChevronDown className="size-3 text-gray-400" />
      </button>

      {/* Language Menu Popover */}
      {isMenuOpen && (
        <div
          role="listbox"
          aria-label="Select voice language"
          className="absolute bottom-full mb-2 right-0 w-44 bg-white border border-gray-200 rounded-xl shadow-lg p-1 z-50 animate-in fade-in zoom-in-95"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
            Voice Language
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {SUPPORTED_VOICE_LANGUAGES.map((lang) => {
              const isSelected = lang.code === selectedLang;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{lang.nativeLabel}</span>
                    <span className="text-[11px] text-gray-400">({lang.label})</span>
                  </span>
                  {isSelected && (
                    <Check className="size-3.5 text-emerald-600 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
