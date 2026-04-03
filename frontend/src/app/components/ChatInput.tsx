import { useState, useRef, type KeyboardEvent } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';

interface ChatInputProps {
  onSubmit: (text: string) => void | Promise<void>;
  placeholder?: string;
}

export function ChatInput({ onSubmit, placeholder = "Try: 'I had chicken breast and rice'" }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handleSubmit = async () => {
    const t = input.trim();
    if (!t || isSending) return;
    setInput('');
    setIsSending(true);
    try {
      await onSubmit(t);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSubmit();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // In a real app, this would send to a speech-to-text API
        toast.info('Voice recording captured! In production, this would convert speech to text.');
        
        // For demo, show a mock transcription
        const mockTranscriptions = [
          'I had chicken breast and rice',
          'I ate a banana',
          'Had oatmeal for breakfast',
          'Lunch was a salad with salmon',
        ];
        const mockText = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
        setInput(mockText);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started...');
    } catch (error) {
      toast.error('Could not access microphone. Please check permissions.');
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="flex-1"
      />
      
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        onClick={isRecording ? stopRecording : startRecording}
        title={isRecording ? "Stop recording" : "Start voice recording"}
      >
        {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
      </Button>
      
      <Button
        onClick={() => void handleSubmit()}
        disabled={!input.trim() || isSending}
        size="icon"
      >
        <Send className="size-4" />
      </Button>
    </div>
  );
}
