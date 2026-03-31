/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Upload, Shirt, User, Sparkles, Loader2, RefreshCw, Download, Key, ShieldCheck, Image as ImageIcon, Film, FileText, Video, Monitor, Mic, Volume2, Smartphone, X, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Extend window interface for AI Studio API key selection
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [outfitImage, setOutfitImage] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<'single' | 'poses' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapResolution, setSwapResolution] = useState<'512px' | '1K' | '2K'>('2K');

  const [activeTab, setActiveTab] = useState<'t2i' | 'image' | 'video'>('t2i');
  
  const [t2iPrompt, setT2iPrompt] = useState<string>('');
  const [t2iImage, setT2iImage] = useState<string | null>(null);
  const [t2iResult, setT2iResult] = useState<string | null>(null);
  const [isT2iProcessing, setIsT2iProcessing] = useState(false);
  const [t2iError, setT2iError] = useState<string | null>(null);
  const [t2iAspectRatio, setT2iAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [t2iResolution, setT2iResolution] = useState<'512px' | '1K' | '2K'>('2K');

  const [videoImage, setVideoImage] = useState<string | null>(null);
  const [videoEndImage, setVideoEndImage] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('');
  
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');
  const [ttsText, setTtsText] = useState<string>('');
  const [ttsVoice, setTtsVoice] = useState<string>('Kore');
  const [audioResult, setAudioResult] = useState<string | null>(null);
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const baseInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);
  const t2iInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoEndInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    } else {
      // Fallback for local dev if window.aistudio isn't present
      setHasApiKey(true);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per guidelines
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'base' | 'outfit') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'base') setBaseImage(reader.result as string);
        else setOutfitImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVideoImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleT2iImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setT2iImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVideoEndImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setVideoEndImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const playVoicePreview = async () => {
    if (isPreviewingAudio) return;
    setIsPreviewingAudio(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const textToRead = ttsText.trim() || `Hello, this is a preview of the ${ttsVoice} voice.`;
      
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToRead }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: ttsVoice },
            },
          },
        },
      });
      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.play();
      }
    } catch (err) {
      console.error("Preview generation failed:", err);
    } finally {
      setIsPreviewingAudio(false);
    }
  };

  const performT2iGeneration = async () => {
    if (!t2iPrompt.trim()) return;

    setIsT2iProcessing(true);
    setT2iError(null);
    setT2iResult(null);

    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF = 2000; // 2 seconds
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [];
      if (t2iImage) {
        const base64Data = t2iImage.split(',')[1];
        const mimeMatch = t2iImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        parts.push({ inlineData: { data: base64Data, mimeType } });
      }
      parts.push({ text: t2iPrompt });

      let lastError: any = null;
      let foundImage = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: t2iAspectRatio,
                imageSize: t2iResolution
              }
            }
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              setT2iResult(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
              foundImage = true;
              break;
            }
          }

          if (foundImage) {
            break; // Success, exit retry loop
          } else {
            throw new Error("No image was returned from the model.");
          }
        } catch (err: any) {
          lastError = err;
          const isRetryable = err.message?.includes("503") || err.message?.includes("429") || 
                             err.status === "UNAVAILABLE" || err.code === 503;
          
          if (isRetryable && attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF * Math.pow(2, attempt);
            console.log(`Attempt ${attempt + 1} failed due to high demand. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          throw err; // Re-throw if not retryable or max retries reached
        }
      }

      if (!foundImage && !lastError) {
        throw new Error("No image was returned from the model.");
      }

    } catch (err: any) {
      console.error("Image generation error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setT2iError("API Key session expired. Please re-select your API key.");
      } else if (err.message?.includes("503") || err.status === "UNAVAILABLE" || err.code === 503) {
        setT2iError("The AI service is currently very busy. We tried retrying, but it's still unavailable. Please wait a minute and try again.");
      } else if (err.message?.includes("429")) {
        setT2iError("Too many requests. Please slow down and try again in a moment.");
      } else {
        setT2iError(err.message || "Failed to generate image. Please try again.");
      }
    } finally {
      setIsT2iProcessing(false);
    }
  };

  const performVideoGeneration = async () => {
    if (!videoPrompt) return;

    setIsVideoProcessing(true);
    setVideoError(null);
    setVideoResult(null);
    setAudioResult(null);
    setVideoStatus('Initializing generation...');

    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      if (ttsText.trim()) {
        setVideoStatus('Generating voiceover...');
        try {
          const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsText }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: ttsVoice },
                },
              },
            },
          });
          const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            setAudioResult(`data:audio/wav;base64,${base64Audio}`);
          }
        } catch (audioErr) {
          console.error("Audio generation failed:", audioErr);
        }
      }

      const model = 'veo-3.1-fast-generate-preview';
      
      let base64Data, mimeType;
      if (videoImage) {
        base64Data = videoImage.split(',')[1];
        const mimeMatch = videoImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      }

      let lastFrameConfig = undefined;
      if (videoEndImage) {
        const endBase64Data = videoEndImage.split(',')[1];
        const endMimeMatch = videoEndImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const endMimeType = endMimeMatch ? endMimeMatch[1] : 'image/png';
        lastFrameConfig = {
          imageBytes: endBase64Data,
          mimeType: endMimeType,
        };
      }

      setVideoStatus('Sending request to Veo model...');
      let operation: any = null;
      let lastError: any = null;
      
      const MAX_RETRIES = 3;
      const INITIAL_BACKOFF = 2000;
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const videoParams: any = {
        model: model,
        prompt: videoPrompt,
        config: {
          numberOfVideos: 1,
          resolution: lastFrameConfig ? '720p' : videoResolution,
          aspectRatio: videoAspectRatio,
          ...(lastFrameConfig ? { lastFrame: lastFrameConfig } : {})
        }
      };

      if (videoImage) {
        videoParams.image = {
          imageBytes: base64Data,
          mimeType: mimeType,
        };
      }

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          operation = await ai.models.generateVideos(videoParams);
          break; // Success, exit retry loop
        } catch (err: any) {
          lastError = err;
          const isRetryable = err.message?.includes("503") || err.message?.includes("429") || 
                             err.status === "UNAVAILABLE" || err.code === 503;
          
          if (isRetryable && attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF * Math.pow(2, attempt);
            setVideoStatus(`High demand. Retrying in ${delay/1000}s...`);
            console.log(`Attempt ${attempt + 1} failed due to high demand. Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          throw err; // Re-throw if not retryable or max retries reached
        }
      }

      if (!operation) {
        throw lastError || new Error("Failed to start video generation.");
      }

      let pollCount = 0;
      const loadingMessages = [
        "Warming up the rendering engine...",
        "Analyzing image and prompt...",
        "Generating video frames...",
        "Adding motion and details...",
        "Refining video quality...",
        "Almost there, finalizing output..."
      ];

      while (!operation.done) {
        setVideoStatus(loadingMessages[Math.min(pollCount, loadingMessages.length - 1)]);
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
        pollCount++;
      }

      if (operation.error) {
        const errMsg = (operation.error as any).message || "Video generation failed during processing.";
        throw new Error(errMsg);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) {
        console.error("Operation object:", operation);
        
        if (operation.response?.raiMediaFilteredReasons?.length > 0) {
          throw new Error(`Safety Filter Blocked: ${operation.response.raiMediaFilteredReasons[0]}`);
        }
        
        const details = operation.response ? JSON.stringify(operation.response) : 'No response';
        throw new Error(`No video returned from the API. Details: ${details}`);
      }

      setVideoStatus('Fetching final video file...');
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to download the generated video.");
      }

      const blob = await response.blob();
      const videoUrl = URL.createObjectURL(blob);
      setVideoResult(videoUrl);
    } catch (err: any) {
      console.error("Video generation error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setVideoError("API Key session expired. Please re-select your API key.");
      } else if (err.message?.includes("503") || err.status === "UNAVAILABLE" || err.code === 503) {
        setVideoError("The AI service is currently very busy. We tried retrying, but it's still unavailable. Please wait a minute and try again.");
      } else if (err.message?.includes("429")) {
        setVideoError("Too many requests. Please slow down and try again in a moment.");
      } else {
        setVideoError(err.message || "Failed to generate video. Please try again.");
      }
    } finally {
      setIsVideoProcessing(false);
      setVideoStatus('');
    }
  };

  const performSwap = async (mode: 'single' | 'poses' = 'single') => {
    if (!baseImage || !outfitImage) return;

    setIsProcessing(mode);
    setError(null);
    setResultImages([]);

    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF = 2000; // 2 seconds

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3.1-flash-image-preview";
      
      const baseImageData = baseImage.split(',')[1];
      const outfitImageData = outfitImage.split(',')[1];

      const generateImageWithRetry = async (posePrompt: string) => {
        let lastError: any = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [
                  { inlineData: { data: baseImageData, mimeType: "image/png" } },
                  { inlineData: { data: outfitImageData, mimeType: "image/png" } },
                  { text: posePrompt }
                ]
              },
              config: {
                imageConfig: {
                  imageSize: swapResolution,
                  aspectRatio: "3:4"
                }
              }
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
              if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
              }
            }
            return null;
          } catch (err: any) {
            lastError = err;
            // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
            const isRetryable = err.message?.includes("503") || err.message?.includes("429") || 
                               err.status === "UNAVAILABLE" || err.code === 503;
            
            if (isRetryable && attempt < MAX_RETRIES) {
              const delay = INITIAL_BACKOFF * Math.pow(2, attempt);
              console.log(`Attempt ${attempt + 1} failed due to high demand. Retrying in ${delay}ms...`);
              await sleep(delay);
              continue;
            }
            throw err;
          }
        }
        throw lastError;
      };

      if (mode === 'single') {
        const prompt = "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the style, color, and texture of the outfit shown in the second image. The final image should look realistic, maintain the original person's identity, and be rendered in high 1080p resolution with crisp details.";
        const img = await generateImageWithRetry(prompt);
        if (img) setResultImages([img]);
        else setError("The AI didn't return an image. Please try again.");
      } else {
        const poses = [
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a natural standing pose, looking at the camera.",
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a dynamic walking pose, slightly turned.",
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a relaxed, candid pose with a slight smile."
        ];
        
        // For multiple poses, we still use Promise.all but each has its own retry logic
        const results = await Promise.all(poses.map(p => generateImageWithRetry(p + " Render in high 1080p resolution.")));
        const validResults = results.filter((img): img is string => img !== null);
        
        if (validResults.length > 0) {
          setResultImages(validResults);
        } else {
          setError("The AI failed to generate poses. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Swap error:", err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("API Key session expired. Please re-select your API key.");
      } else if (err.message?.includes("503") || err.status === "UNAVAILABLE" || err.code === 503) {
        setError("The AI service is currently very busy. We tried retrying, but it's still unavailable. Please wait a minute and try again.");
      } else if (err.message?.includes("429")) {
        setError("Too many requests. Please slow down and try again in a moment.");
      } else {
        setError("Failed to process the image. Please check your connection and try again.");
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const reset = () => {
    setBaseImage(null);
    setOutfitImage(null);
    setResultImages([]);
    setError(null);
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 border border-white/10 p-8 rounded-3xl text-center"
        >
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4">High-Quality Mode</h2>
          <p className="text-white/40 mb-8">
            To generate 1080p high-resolution images, you need to select a paid Gemini API key. 
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline ml-1">
              Learn about billing
            </a>
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-white text-black rounded-xl font-semibold hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            Select API Key
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6"
          >
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/60">AI Studio Powered</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
          >
            AI Studio Creator
          </motion.h1>
          
          {/* Tab Menu */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4 mb-8"
          >
            <button
              onClick={() => setActiveTab('t2i')}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 't2i' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <ImageIcon className="w-5 h-5" /> Image Generator
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'image' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <Shirt className="w-5 h-5" /> Outfit Swapper
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${activeTab === 'video' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              <Film className="w-5 h-5" /> Video Generator
            </button>
          </motion.div>
        </header>

        {/* Main Interface */}
        {activeTab === 't2i' && (
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Input Section */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Prompt & Reference Image
                  </label>
                  <div className="relative bg-white/5 border border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-orange-500/50 transition-all flex flex-col">
                    <textarea
                      value={t2iPrompt}
                      onChange={(e) => setT2iPrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="w-full h-32 bg-transparent p-4 text-white placeholder:text-white/20 focus:outline-none resize-none"
                    />
                    
                    <div className="flex items-center justify-between p-3 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        {t2iImage && (
                          <div className="relative group">
                            <img src={t2iImage} alt="Reference" className="h-12 w-12 object-cover rounded-lg border border-white/20" />
                            <button 
                              onClick={() => setT2iImage(null)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => t2iInputRef.current?.click()}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors flex items-center gap-2 text-sm"
                          title="Add reference image"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Add Image</span>
                        </button>
                        <input 
                          type="file" 
                          ref={t2iInputRef} 
                          onChange={handleT2iImageUpload} 
                          className="hidden" 
                          accept="image/*"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full md:w-48 space-y-6">
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> Aspect Ratio
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['1:1', '16:9', '9:16'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setT2iAspectRatio(ratio)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium transition-all ${t2iAspectRatio === ratio ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" /> Quality
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['512px', '1K', '2K'] as const).map((res) => (
                        <button
                          key={res}
                          onClick={() => setT2iResolution(res)}
                          className={`py-2 px-2 rounded-xl text-xs font-medium transition-all ${t2iResolution === res ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={performT2iGeneration}
                disabled={!t2iPrompt.trim() || isT2iProcessing}
                className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-orange-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isT2iProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Generate Image
                  </>
                )}
              </button>

              {t2iError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {t2iError}
                </div>
              )}
            </div>

            {/* Result Section */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Result <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">{t2iResolution}</span>
              </h2>

              <div className={`relative rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex flex-col items-center justify-center group transition-all duration-500 ${
                t2iAspectRatio === '16:9' ? 'aspect-video' : 
                t2iAspectRatio === '9:16' ? 'aspect-[9/16] max-h-[70vh] mx-auto' : 
                'aspect-square max-w-2xl mx-auto'
              }`}>
                <AnimatePresence mode="wait">
                  {t2iResult ? (
                    <motion.div
                      key="t2i-result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full h-full relative flex flex-col"
                    >
                      <img 
                        src={t2iResult} 
                        alt="Generated Result" 
                        className="w-full h-full object-contain bg-black flex-1"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <a 
                          href={t2iResult} 
                          download="ai-generated-image.png"
                          className="p-3 bg-black/50 text-white rounded-full shadow-xl hover:bg-orange-500 transition-all backdrop-blur-md"
                          title="Download Image"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    </motion.div>
                  ) : isT2iProcessing ? (
                    <motion.div 
                      key="t2i-loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 p-8 text-center"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin" />
                        <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-orange-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-2">Generating your image...</p>
                        <p className="text-white/40 text-sm max-w-[250px]">
                          This might take a few seconds.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="t2i-placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center p-12"
                    >
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <ImageIcon className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/20 max-w-[200px] mx-auto">Enter a prompt to generate an image</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Upload Section */}
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Base Character Upload */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                  <User className="w-4 h-4" /> Base Character
                </label>
                <div 
                  onClick={() => baseInputRef.current?.click()}
                  className={`relative aspect-[3/4] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group
                    ${baseImage ? 'border-white/20' : 'border-white/10 hover:border-orange-500/50 bg-white/5'}`}
                >
                  {baseImage ? (
                    <img src={baseImage} alt="Base" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <Upload className="w-8 h-8 text-white/20 mb-4 group-hover:text-orange-400 transition-colors" />
                      <p className="text-sm text-white/40">Click to upload character photo</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={baseInputRef} 
                    onChange={(e) => handleImageUpload(e, 'base')} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>

              {/* Outfit Upload */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                  <Shirt className="w-4 h-4" /> Target Outfit
                </label>
                <div 
                  onClick={() => outfitInputRef.current?.click()}
                  className={`relative aspect-[3/4] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group
                    ${outfitImage ? 'border-white/20' : 'border-white/10 hover:border-blue-500/50 bg-white/5'}`}
                >
                  {outfitImage ? (
                    <img src={outfitImage} alt="Outfit" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <Upload className="w-8 h-8 text-white/20 mb-4 group-hover:text-blue-400 transition-colors" />
                      <p className="text-sm text-white/40">Click to upload outfit photo</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={outfitInputRef} 
                    onChange={(e) => handleImageUpload(e, 'outfit')} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>
            </div>

            {/* Quality Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Output Quality
              </label>
              <div className="flex gap-2">
                {(['512px', '1K', '2K'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setSwapResolution(res)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${swapResolution === res ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => performSwap('single')}
                disabled={!baseImage || !outfitImage || isProcessing !== null}
                className={`py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${!baseImage || !outfitImage || isProcessing !== null 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-orange-500 hover:text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-orange-500/40'}`}
              >
                {isProcessing === 'single' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate 1080p Look
              </button>

              <button
                onClick={() => performSwap('poses')}
                disabled={!baseImage || !outfitImage || isProcessing !== null}
                className={`py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${!baseImage || !outfitImage || isProcessing !== null 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-white/10 text-white hover:bg-blue-600 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-blue-600/40'}`}
              >
                {isProcessing === 'poses' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Create 3 more poses
              </button>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-lg border border-red-400/20"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Result Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Result <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">{swapResolution}</span>
              </h2>
              {resultImages.length > 0 && (
                <button 
                  onClick={reset}
                  className="text-sm text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Start Over
                </button>
              )}
            </div>

            <div className={`relative rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center group transition-all duration-500
              ${resultImages.length > 1 ? 'aspect-auto min-h-[400px] p-4' : 'aspect-[3/4]'}`}>
              <AnimatePresence mode="wait">
                {resultImages.length > 0 ? (
                  <motion.div
                    key="result-grid"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`w-full h-full grid gap-6 ${resultImages.length > 1 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}
                  >
                    {resultImages.map((img, idx) => (
                      <div key={idx} className="relative flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden">
                          <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <a 
                          href={img} 
                          download={`ai-outfit-swap-${idx}.png`}
                          className="w-full py-3 bg-white text-black rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-orange-500 hover:text-white transition-all"
                        >
                          <Download className="w-4 h-4" />
                          Download {resultImages.length > 1 ? `Pose ${idx + 1}` : 'Result'}
                        </a>
                      </div>
                    ))}
                  </motion.div>
                ) : isProcessing ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-4 py-12"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin" />
                      <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-orange-500 animate-pulse" />
                    </div>
                    <p className="text-white/40 animate-pulse text-center">
                      Rendering high-fidelity details...<br/>
                      <span className="text-[10px] opacity-50">Generating multiple poses takes a bit longer</span>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-12"
                  >
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                      <Shirt className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/20 max-w-[200px] mx-auto">Upload images and choose an action to see the magic in 1080p</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'video' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Video Input Section */}
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Input Images
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => videoInputRef.current?.click()}
                    className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group flex items-center justify-center
                      ${videoImage ? 'border-white/20 bg-black/20' : 'border-white/10 hover:border-purple-500/50 bg-white/5'}`}
                  >
                    {videoImage ? (
                      <img src={videoImage} alt="Video Base" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <Upload className="w-6 h-6 text-white/20 mb-2 group-hover:text-purple-400 transition-colors" />
                        <p className="text-xs text-white/40">Start Frame (Optional)</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={videoInputRef} 
                      onChange={handleVideoImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>

                  <div 
                    onClick={() => videoEndInputRef.current?.click()}
                    className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group flex items-center justify-center
                      ${videoEndImage ? 'border-white/20 bg-black/20' : 'border-white/10 hover:border-purple-500/50 bg-white/5'}`}
                  >
                    {videoEndImage ? (
                      <>
                        <img src={videoEndImage} alt="Video End" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setVideoEndImage(null); }}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white/80 hover:text-white hover:bg-red-500/80 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                        <Upload className="w-6 h-6 text-white/20 mb-2 group-hover:text-purple-400 transition-colors" />
                        <p className="text-xs text-white/40">End Frame (Opt)</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={videoEndInputRef} 
                      onChange={handleVideoEndImageUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>

              {/* Aspect Ratio & Resolution */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                    <Monitor className="w-4 h-4" /> Aspect Ratio
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVideoAspectRatio('16:9')}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${videoAspectRatio === '16:9' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      <Monitor className="w-4 h-4" /> 16:9
                    </button>
                    <button
                      onClick={() => setVideoAspectRatio('9:16')}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${videoAspectRatio === '9:16' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                      <Smartphone className="w-4 h-4" /> 9:16
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Quality
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVideoResolution('720p')}
                      disabled={!!videoEndImage}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${videoResolution === '720p' || videoEndImage ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/60 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      720p
                    </button>
                    <button
                      onClick={() => setVideoResolution('1080p')}
                      disabled={!!videoEndImage}
                      className={`flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${videoResolution === '1080p' && !videoEndImage ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-white/5 text-white/60 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={videoEndImage ? "1080p is not supported when using an End Frame" : ""}
                    >
                      1080p
                    </button>
                  </div>
                </div>
              </div>

              {/* TTS */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voiceover (Optional)
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 min-w-[160px]"
                  >
                    <option value="Kore" className="bg-[#1a1a1a]">Female 1 (Kore)</option>
                    <option value="Zephyr" className="bg-[#1a1a1a]">Female 2 (Zephyr)</option>
                    <option value="Puck" className="bg-[#1a1a1a]">Male 1 (Puck)</option>
                    <option value="Charon" className="bg-[#1a1a1a]">Male 2 (Charon)</option>
                    <option value="Fenrir" className="bg-[#1a1a1a]">Male 3 (Fenrir)</option>
                  </select>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      value={ttsText}
                      onChange={(e) => setTtsText(e.target.value)}
                      placeholder="Enter text to generate voiceover..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                    <button
                      onClick={playVoicePreview}
                      disabled={isPreviewingAudio}
                      className="absolute right-2 p-2 text-white/60 hover:text-purple-400 hover:bg-white/5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Preview Voice"
                    >
                      {isPreviewingAudio ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-white/60 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Text Prompt
                </label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="Describe what should happen in the video..."
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none"
                />
              </div>

              <button
                onClick={performVideoGeneration}
                disabled={!videoPrompt || isVideoProcessing}
                className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${!videoPrompt || isVideoProcessing 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-purple-500 hover:text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-purple-500/40'}`}
              >
                {isVideoProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Video className="w-4 h-4" />
                )}
                Generate Video
              </button>

              {videoError && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-lg border border-red-400/20"
                >
                  {videoError}
                </motion.p>
              )}
            </div>

            {/* Video Result Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Result <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30 font-mono">{videoEndImage ? '720p' : '1080p'}</span>
                </h2>
              </div>

              <div className={`relative rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex flex-col items-center justify-center group transition-all duration-500 ${videoAspectRatio === '9:16' ? 'aspect-[9/16] max-h-[70vh] mx-auto' : 'aspect-video'}`}>
                <AnimatePresence mode="wait">
                  {videoResult ? (
                    <motion.div
                      key="video-result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full h-full relative flex flex-col"
                    >
                      <video 
                        ref={videoRef}
                        src={videoResult} 
                        controls 
                        autoPlay 
                        loop 
                        onPlay={() => audioRef.current?.play()}
                        onPause={() => audioRef.current?.pause()}
                        onSeeked={(e: any) => { if (audioRef.current) audioRef.current.currentTime = e.target.currentTime; }}
                        className="w-full h-full object-contain bg-black flex-1"
                      />
                      {audioResult && (
                        <audio ref={audioRef} src={audioResult} className="hidden" loop />
                      )}
                      <div className="absolute top-4 right-4 flex gap-2">
                        {audioResult && (
                          <a 
                            href={audioResult} 
                            download="ai-generated-audio.wav"
                            className="p-3 bg-black/50 text-white rounded-full shadow-xl hover:bg-purple-500 transition-all backdrop-blur-md"
                            title="Download Audio"
                          >
                            <Volume2 className="w-5 h-5" />
                          </a>
                        )}
                        <a 
                          href={videoResult} 
                          download="ai-generated-video.mp4"
                          className="p-3 bg-black/50 text-white rounded-full shadow-xl hover:bg-purple-500 transition-all backdrop-blur-md"
                          title="Download Video"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    </motion.div>
                  ) : isVideoProcessing ? (
                    <motion.div 
                      key="video-loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 p-8 text-center"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin" />
                        <Film className="absolute inset-0 m-auto w-8 h-8 text-purple-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-white font-medium mb-2">{videoStatus}</p>
                        <p className="text-white/40 text-sm max-w-[250px]">
                          Video generation can take a few minutes. Please don't close this page.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="video-placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center p-12"
                    >
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                        <Film className="w-8 h-8 text-white/20" />
                      </div>
                      <p className="text-white/20 max-w-[200px] mx-auto">Upload an image and describe the motion to generate a video</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-24 pt-12 border-t border-white/5 text-center text-white/20 text-sm">
          <p>© 2026 AI Outfit Swapper. Powered by NTM & Gemini 3.1 Flash Image (1080p Mode).</p>
        </footer>
      </main>
    </div>
  );
}
