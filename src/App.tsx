/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Shirt, User, Sparkles, Loader2, RefreshCw, Download, Key, ShieldCheck } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const baseInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);

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

  const performSwap = async (mode: 'single' | 'poses' = 'single') => {
    if (!baseImage || !outfitImage) return;

    setIsProcessing(true);
    setError(null);
    setResultImages([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = "gemini-3.1-flash-image-preview";
      
      const baseImageData = baseImage.split(',')[1];
      const outfitImageData = outfitImage.split(',')[1];

      const generateImage = async (posePrompt: string) => {
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
              imageSize: "2K",
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
      };

      if (mode === 'single') {
        const prompt = "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the style, color, and texture of the outfit shown in the second image. The final image should look realistic, maintain the original person's identity, and be rendered in high 2K resolution with crisp details.";
        const img = await generateImage(prompt);
        if (img) setResultImages([img]);
        else setError("The AI didn't return an image. Please try again.");
      } else {
        const poses = [
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a natural standing pose, looking at the camera.",
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a dynamic walking pose, slightly turned.",
          "Keep the face and body shape of the person in the first image exactly the same. Change their clothing to match the outfit in the second image. Show the person in a relaxed, candid pose with a slight smile."
        ];
        
        const results = await Promise.all(poses.map(p => generateImage(p + " Render in high 2K resolution.")));
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
      } else {
        setError("Failed to process the image. Please check your connection and try again.");
      }
    } finally {
      setIsProcessing(false);
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
            To generate 2K high-resolution images, you need to select a paid Gemini API key. 
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
        <header className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6"
          >
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-white/60">2K Ultra HD Mode Active</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
          >
            Outfit Swapper
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-white/40 max-w-2xl mx-auto"
          >
            Upload a character and an outfit. Our AI will seamlessly swap the clothes in stunning 2K resolution.
          </motion.p>
        </header>

        {/* Main Interface */}
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

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => performSwap('single')}
                disabled={!baseImage || !outfitImage || isProcessing}
                className={`py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${!baseImage || !outfitImage || isProcessing 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-orange-500 hover:text-white shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-orange-500/40'}`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate 2K Look
              </button>

              <button
                onClick={() => performSwap('poses')}
                disabled={!baseImage || !outfitImage || isProcessing}
                className={`py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${!baseImage || !outfitImage || isProcessing 
                    ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                    : 'bg-white/10 text-white hover:bg-blue-600 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-blue-600/40'}`}
              >
                {isProcessing ? (
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
                Result <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">2K</span>
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
                    className={`w-full h-full grid gap-4 ${resultImages.length > 1 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}
                  >
                    {resultImages.map((img, idx) => (
                      <div key={idx} className="relative group/item rounded-xl overflow-hidden aspect-[3/4]">
                        <img src={img} alt={`Result ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <a 
                          href={img} 
                          download={`ai-outfit-swap-${idx}.png`}
                          className="absolute bottom-4 right-4 p-2 bg-white text-black rounded-full shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity hover:scale-110"
                        >
                          <Download className="w-4 h-4" />
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
                    <p className="text-white/20 max-w-[200px] mx-auto">Upload images and choose an action to see the magic</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Footer Info */}
        <footer className="mt-24 pt-12 border-t border-white/5 text-center text-white/20 text-sm">
          <p>© 2026 AI Outfit Swapper. Powered by Gemini 3.1 Flash Image (2K Mode).</p>
        </footer>
      </main>
    </div>
  );
}
