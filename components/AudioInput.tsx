import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../services/geminiService';

interface AudioInputProps {
  onTranscription: (text: string) => void;
  className?: string;
}

const AudioInput: React.FC<AudioInputProps> = ({ onTranscription, className }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        const text = await transcribeAudio(blob);
        onTranscription(text);
        setIsProcessing(false);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          flex items-center justify-center w-12 h-12 rounded-full shadow-md transition-all
          ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-600'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-opacity-90'}
          text-white
        `}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isRecording ? (
          <Square className="w-5 h-5 fill-current" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
      {isRecording && <span className="text-sm font-medium text-red-600 animate-pulse">Gravando...</span>}
      {isProcessing && <span className="text-sm font-medium text-blue-600">Transcrevendo...</span>}
    </div>
  );
};

export default AudioInput;
