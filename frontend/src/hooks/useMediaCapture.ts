'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMediaCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraDeviceId?: string;
  micDeviceId?: string;
  onAudioChunk?: (transcript: string, durationS: number, volume: number) => void;
  onVideoFrame?: (frameB64: string) => void;
  frameIntervalMs?: number;
}

export interface MediaCaptureState {
  isCapturing: boolean;
  cameraReady: boolean;
  micReady: boolean;
  currentVolume: number;
  error?: string;
}

export function useMediaCapture({
  videoRef,
  cameraDeviceId,
  micDeviceId,
  onAudioChunk,
  onVideoFrame,
  frameIntervalMs = 2000,
}: UseMediaCaptureOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval>>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval>>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chunkStartRef = useRef<number>(Date.now());

  const [state, setState] = useState<MediaCaptureState>({
    isCapturing: false,
    cameraReady: false,
    micReady: false,
    currentVolume: 0,
  });

  const startCapture = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: cameraDeviceId
          ? { deviceId: { exact: cameraDeviceId }, width: 1280, height: 720 }
          : { width: 1280, height: 720 },
        audio: micDeviceId
          ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Audio analysis for volume meter
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      volumeTimerRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const volume = Math.min(100, (avg / 128) * 100);
        setState(prev => ({ ...prev, currentVolume: volume }));
      }, 100);

      // Canvas for frame capture
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 360;

      // Video frame capture
      frameTimerRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !onVideoFrame) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0, 640, 360);
        const b64 = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
        onVideoFrame(b64);
      }, frameIntervalMs);

      // Speech recognition
      setupSpeechRecognition();

      setState(prev => ({
        ...prev,
        isCapturing: true,
        cameraReady: true,
        micReady: true,
        error: undefined,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        error: `Camera/mic access denied: ${err.message}`,
      }));
    }
  }, [cameraDeviceId, micDeviceId, onVideoFrame, frameIntervalMs]);

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    chunkStartRef.current = Date.now();

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim = result[0].transcript;
        }
      }

      // Send accumulated transcript every ~3 seconds
      if (finalTranscript.trim()) {
        const durationS = (Date.now() - chunkStartRef.current) / 1000;
        const volume = analyserRef.current ? getRMSVolume() : 60;
        onAudioChunk?.(finalTranscript.trim(), durationS, volume);
        finalTranscript = '';
        chunkStartRef.current = Date.now();
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still capturing
      if (streamRef.current?.active && recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognition.start();
  }, [onAudioChunk]);

  const getRMSVolume = (): number => {
    if (!analyserRef.current) return 60;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    return Math.min(100, (avg / 128) * 100);
  };

  const stopCapture = useCallback(() => {
    // Stop speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Stop frame capture
    clearInterval(frameTimerRef.current);
    clearInterval(volumeTimerRef.current);

    // Stop media stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // Stop audio context
    audioContextRef.current?.close();
    audioContextRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({
      ...prev,
      isCapturing: false,
      cameraReady: false,
      micReady: false,
      currentVolume: 0,
    }));
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  const getAvailableDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter(d => d.kind === 'videoinput'),
      mics: devices.filter(d => d.kind === 'audioinput'),
    };
  }, []);

  return {
    state,
    startCapture,
    stopCapture,
    getAvailableDevices,
    stream: streamRef.current,
  };
}
