import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { fetchFoodSuggestions } from '../utils/api';

interface ChatInputProps {
  onSubmit: (text: string) => void | Promise<void>;
  placeholder?: string;
}

/** Last comma-separated segment, then last whitespace token — min length 2 to query. */
function activeSearchQuery(value: string): string | null {
  const lastComma = value.lastIndexOf(',');
  const segment = lastComma === -1 ? value : value.slice(lastComma + 1);
  const m = segment.match(/(\S+)$/);
  if (!m) return null;
  const q = m[1];
  return q.length >= 2 ? q : null;
}

/** Replace the last token in the last segment with `replacement`. */
function replaceActiveToken(value: string, replacement: string): string {
  const lastComma = value.lastIndexOf(',');
  const prefix = lastComma === -1 ? '' : value.slice(0, lastComma + 1);
  const segment = lastComma === -1 ? value : value.slice(lastComma + 1);
  const m = segment.match(/^(.*?)(\S+)$/);
  if (!m) return prefix + replacement;
  return prefix + m[1] + replacement;
}

export function ChatInput({ onSubmit, placeholder = "Try: 'I had chicken breast and rice'" }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [usdaEnabled, setUsdaEnabled] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const speechRecognitionRef = useRef<WebSpeechRecognition | null>(null);
  const inputPrefixRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = activeSearchQuery(input);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const { suggestions: list, usdaEnabled: enabled } = await fetchFoodSuggestions(q, 12);
        setSuggestions(list);
        setUsdaEnabled(enabled);
        setSelectedIndex(list.length > 0 ? 0 : -1);
      })();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
    };
  }, []);

  const applySuggestion = (text: string) => {
    setInput(replaceActiveToken(input, text));
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleSubmit = async () => {
    const t = input.trim();
    if (!t || isSending) return;
    setInput('');
    setSuggestions([]);
    setSelectedIndex(-1);
    setIsSending(true);
    try {
      await onSubmit(t);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const showList = focused && suggestions.length > 0;

    if (e.key === 'Escape' && showList) {
      e.preventDefault();
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    if (showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        setSelectedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
      } else {
        setSelectedIndex((i) => (i > 0 ? i - 1 : -1));
      }
      return;
    }

    if (e.key === 'Enter') {
      if (showList && suggestions.length > 0) {
        e.preventDefault();
        const idx = selectedIndex >= 0 ? selectedIndex : 0;
        applySuggestion(suggestions[idx]!);
        return;
      }
      void handleSubmit();
    }
  };

  const startRecording = () => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    try {
      inputPrefixRef.current = input.trimEnd();
      const rec = new Ctor();
      speechRecognitionRef.current = rec;
      rec.lang = navigator.language || 'en-US';
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: WebSpeechRecognitionResultEvent) => {
        let line = '';
        for (let i = 0; i < event.results.length; i++) {
          line += event.results[i]![0]!.transcript;
        }
        const spoken = line.trim();
        const prefix = inputPrefixRef.current;
        setInput(prefix ? `${prefix} ${spoken}` : spoken);
      };

      rec.onerror = (event: WebSpeechRecognitionErrorEvent) => {
        if (event.error === 'aborted') return;
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          toast.error('Allow microphone access to use voice input.');
        } else {
          toast.error(`Speech recognition: ${event.error}`);
        }
      };

      rec.onend = () => {
        speechRecognitionRef.current = null;
        setIsRecording(false);
      };

      rec.start();
      setIsRecording(true);
      toast.success('Listening… click the mic again to stop.');
    } catch (error) {
      toast.error('Could not start speech recognition.');
      console.error(error);
    }
  };

  const stopRecording = () => {
    const rec = speechRecognitionRef.current;
    if (rec && isRecording) {
      rec.stop();
    }
  };

  const showDropdown = focused && suggestions.length > 0;
  const activeQ = activeSearchQuery(input);
  const showUsdaHint =
    focused &&
    Boolean(activeQ) &&
    !usdaEnabled &&
    suggestions.length === 0;

  return (
    <div className="flex gap-2 items-start w-full">
      <div className="relative flex-1 min-w-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (blurCloseRef.current) {
              clearTimeout(blurCloseRef.current);
              blurCloseRef.current = null;
            }
            setFocused(true);
          }}
          onBlur={() => {
            blurCloseRef.current = setTimeout(() => setFocused(false), 150);
          }}
          placeholder={placeholder}
          className="w-full"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {showDropdown && (
          <ul
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
            role="listbox"
          >
            {suggestions.map((s, idx) => (
              <li key={`${s}-${idx}`} role="option" aria-selected={selectedIndex === idx}>
                <button
                  type="button"
                  className={`w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                    selectedIndex === idx ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showUsdaHint && (
          <p className="text-muted-foreground mt-1.5 text-xs px-0.5">
            Food hints use USDA FoodData Central. Set <code className="rounded bg-muted px-1">USDA_FDC_API_KEY</code> in
            your project <code className="rounded bg-muted px-1">.env</code> and restart the API (see{' '}
            <a
              className="underline underline-offset-2"
              href="https://fdc.nal.usda.gov/api-key-signup"
              target="_blank"
              rel="noreferrer"
            >
              api-key-signup
            </a>
            ).
          </p>
        )}
      </div>

      <Button
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        className="shrink-0"
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? 'Stop recording' : 'Start voice recording'}
      >
        {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
      </Button>

      <Button
        onClick={() => void handleSubmit()}
        disabled={!input.trim() || isSending}
        size="icon"
        className="shrink-0"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
