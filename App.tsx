
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, ChatMessage, AgentRole, RAGFile } from './types';
import Sidebar from './components/Sidebar';
import { GeminiService } from './services/geminiService';
import { useLiveAPI } from './hooks/useLiveAPI';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [useSearch, setUseSearch] = useState(true);
  const [useMaps, setUseMaps] = useState(false);
  const [role, setRole] = useState<AgentRole>('general');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  // RAG States
  const [ragFiles, setRagFiles] = useState<RAGFile[]>([]);
  
  // Analyst States
  const [analysisFile, setAnalysisFile] = useState<RAGFile | null>(null);

  const gemini = useRef(new GeminiService());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { isActive: liveActive, transcripts, startSession, stopSession, error: liveError } = useLiveAPI();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcripts]);

  useEffect(() => {
    if (useMaps && !location) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn("Location permission denied")
      );
    }
  }, [useMaps]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      type: 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      let response;
      if (mode === AppMode.RAG) {
        const context = ragFiles
          .filter(f => f.status === 'ready')
          .map(f => `File: ${f.name}\nContent: ${f.content}`)
          .join('\n\n---\n\n');
        
        response = await gemini.current.chat(inputValue, {
          thinking,
          useSearch,
          role: 'researcher',
          context
        });
      } else if (mode === AppMode.ANALYST && analysisFile) {
        response = await gemini.current.analyzeData(analysisFile.content, inputValue);
      } else {
        response = await gemini.current.chat(inputValue, {
          thinking,
          useSearch,
          useMaps,
          role,
          location: location ? { latitude: location.lat, longitude: location.lng } : undefined
        });
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Sorry, I encountered an issue.',
        type: 'text',
        groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "An error occurred during communication with Gemini.",
        type: 'error'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, targetMode: AppMode) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const newFile: RAGFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          content: content,
          type: file.type,
          status: 'ready'
        };

        if (targetMode === AppMode.RAG) {
          setRagFiles(prev => [...prev, newFile]);
        } else {
          setAnalysisFile(newFile);
        }
      };
      reader.readAsText(file);
    });
  };

  const renderChat = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-blue-600/10 flex items-center justify-center mb-6 border border-blue-500/20">
              <i className="fa-solid fa-sparkles text-blue-500 text-3xl"></i>
            </div>
            <h2 className="text-3xl font-bold mb-3">Welcome to OmniGenius</h2>
            <p className="text-slate-400">Your supercharged multimodal assistant powered by Gemini 3.</p>
            
            <div className="grid grid-cols-2 gap-4 mt-8 w-full">
              {[
                { r: 'general', l: 'General Assistant', i: 'fa-robot' },
                { r: 'analyst', l: 'Data Analyst', i: 'fa-chart-simple' },
                { r: 'coder', l: 'Software Engineer', i: 'fa-code' },
                { r: 'researcher', l: 'Deep Researcher', i: 'fa-microscope' }
              ].map(opt => (
                <button 
                  key={opt.r}
                  onClick={() => setRole(opt.r as AgentRole)}
                  className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                    role === opt.r ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <i className={`fa-solid ${opt.i} text-xl`}></i>
                  <span className="text-xs font-bold uppercase">{opt.l}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'glass-panel text-slate-100 rounded-tl-none'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              
              {msg.groundingSources && (
                <div className="mt-4 pt-3 border-t border-slate-700">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-link"></i> Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.groundingSources.map((source: any, idx: number) => {
                      const url = source.web?.uri || source.maps?.uri;
                      const title = source.web?.title || source.maps?.title || "Reference";
                      if (!url) return null;
                      return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" 
                           className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors text-blue-400">
                          {title}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="glass-panel p-4 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
            <button 
              onClick={() => setThinking(!thinking)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                thinking ? 'bg-purple-600/20 text-purple-400 border-purple-500/50' : 'bg-slate-800 text-slate-400 border-transparent'
              }`}
            >
              <i className="fa-solid fa-brain"></i> Thinking Mode
            </button>
            <button 
              onClick={() => setUseSearch(!useSearch)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                useSearch ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-800 text-slate-400 border-transparent'
              }`}
            >
              <i className="fa-brands fa-google"></i> Search Grounding
            </button>
          </div>
          
          <div className="relative flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything..."
              className="flex-1 glass-panel px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[56px] max-h-32"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className="w-12 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white shadow-lg transition-all"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRAG = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-2xl font-bold mb-4">RAG Document Lab</h2>
        <div className="flex gap-4 items-center">
          <label className="flex-1 flex items-center justify-center gap-3 py-8 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer transition-all">
            <i className="fa-solid fa-cloud-arrow-up text-3xl text-blue-500"></i>
            <div>
              <p className="font-bold">Upload Knowledge Base</p>
              <p className="text-xs text-slate-500">PDF, TXT, CSV accepted (Text extraction only)</p>
            </div>
            <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, AppMode.RAG)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {ragFiles.map(file => (
            <div key={file.id} className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs flex items-center gap-2">
              <i className="fa-solid fa-file-lines text-blue-400"></i>
              <span>{file.name}</span>
              <button onClick={() => setRagFiles(prev => prev.filter(f => f.id !== file.id))} className="text-slate-500 hover:text-red-400">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {renderChat()}
      </div>
    </div>
  );

  const renderAnalyst = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-800">
        <h2 className="text-2xl font-bold mb-4">Data Analyst Mode</h2>
        {!analysisFile ? (
          <label className="flex items-center justify-center gap-3 py-12 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20 hover:bg-slate-800/40 cursor-pointer transition-all">
            <i className="fa-solid fa-chart-column text-4xl text-purple-500"></i>
            <div>
              <p className="font-bold text-lg">Upload Dataset (CSV)</p>
              <p className="text-sm text-slate-500">Analyze patterns and get insights instantly.</p>
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, AppMode.ANALYST)} />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 bg-purple-600/10 border border-purple-500/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-table text-purple-400 text-2xl"></i>
              <div>
                <p className="font-bold text-sm">{analysisFile.name}</p>
                <p className="text-xs text-purple-300">Active dataset for analysis</p>
              </div>
            </div>
            <button onClick={() => setAnalysisFile(null)} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-all">
              Change Data
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {renderChat()}
      </div>
    </div>
  );

  const renderLive = () => (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <div className={`w-48 h-48 rounded-full flex items-center justify-center mb-8 relative ${
        liveActive ? 'bg-red-600/10' : 'bg-blue-600/10'
      }`}>
        <div className={`absolute inset-0 rounded-full border-2 ${
          liveActive ? 'border-red-500/50 animate-ping' : 'border-blue-500/30'
        }`}></div>
        <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all ${
          liveActive ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
        }`}>
          <i className={`fa-solid ${liveActive ? 'fa-microphone-lines' : 'fa-microphone'} text-6xl`}></i>
        </div>
      </div>
      <h2 className="text-3xl font-bold mb-4">{liveActive ? 'Listening...' : 'OmniGenius Live'}</h2>
      <p className="text-slate-400 max-w-md mb-8">Powered by Gemini 2.5 Flash Native Audio.</p>
      <div className="flex gap-4">
        {!liveActive ? (
          <button onClick={startSession} className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all">Start Conversation</button>
        ) : (
          <button onClick={stopSession} className="px-8 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all">End Call</button>
        )}
      </div>
    </div>
  );

  const renderGenerator = () => <GeneratorView gemini={gemini.current} />;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200">
      <Sidebar currentMode={mode} setMode={setMode} />
      <main className="flex-1 flex flex-col">
        {mode === AppMode.CHAT && renderChat()}
        {mode === AppMode.LIVE && renderLive()}
        {mode === AppMode.GENERATE && renderGenerator()}
        {mode === AppMode.ANALYST && renderAnalyst()}
        {mode === AppMode.RAG && renderRAG()}
      </main>
    </div>
  );
};

// --- Subcomponents ---

const GeneratorView: React.FC<{ gemini: GeminiService }> = ({ gemini }) => {
  const [prompt, setPrompt] = useState('');
  const [type, setType] = useState<'image' | 'video'>('image');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [startImage, setStartImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const statusInterval = useRef<number | null>(null);

  useEffect(() => {
    if (type === 'video' && aspectRatio === '1:1') {
      setAspectRatio('16:9');
    }
  }, [type, aspectRatio]);

  useEffect(() => {
    if (type === 'video' || (type === 'image' && size !== '1K')) {
      (window as any).aistudio?.hasSelectedApiKey().then(setHasApiKey);
    }
  }, [type, size]);

  const startStatusCycle = () => {
    const messages = [
      "Analyzing scene dynamics...",
      "Generating keyframes...",
      "Synthesizing high-fidelity textures...",
      "Optimizing temporal coherence...",
      "Polishing final render...",
      "Wrapping up your cinematic masterpiece..."
    ];
    let idx = 0;
    setStatusMessage(messages[0]);
    statusInterval.current = window.setInterval(() => {
      idx = (idx + 1) % messages.length;
      setStatusMessage(messages[idx]);
    }, 15000);
  };

  const stopStatusCycle = () => {
    if (statusInterval.current) {
      clearInterval(statusInterval.current);
      statusInterval.current = null;
    }
  };

  const handleStartImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setStartImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setResult(null);
    startStatusCycle();

    try {
      if (type === 'image') {
        const url = await gemini.generateImage(prompt, { aspectRatio: aspectRatio as any, imageSize: size });
        setResult(url);
      } else {
        const url = await gemini.generateVideo(prompt, aspectRatio as any, startImage || undefined);
        setResult(url);
      }
    } catch (err: any) {
      if (err?.message?.includes("Requested entity was not found")) {
        alert("API Key error. Please re-select your key.");
        (window as any).aistudio?.openSelectKey();
      } else {
        alert("Generation failed. Please try again.");
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
      stopStatusCycle();
    }
  };

  const openKeyPicker = async () => {
    await (window as any).aistudio?.openSelectKey();
    setHasApiKey(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-4xl font-bold mb-2 gradient-text">Multimodal Studio</h2>
          <p className="text-slate-400">Cinematic video & High-res imagery powered by Veo and Nano Banana.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <div className="flex bg-slate-800 p-1 rounded-2xl">
                <button onClick={() => setType('image')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${type === 'image' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>Image</button>
                <button onClick={() => setType('video')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${type === 'video' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>Video</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Description</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 min-h-[140px] focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder={type === 'image' ? "A hyper-realistic portrait of a cybernetic owl..." : "A slow tracking shot through a dense rainforest..."}
                />
              </div>

              {type === 'video' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Start Frame (Optional)</label>
                  <div className="flex gap-4 items-center">
                    {startImage ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                        <img src={startImage} className="w-full h-full object-cover" />
                        <button onClick={() => setStartImage(null)} className="absolute top-1 right-1 bg-red-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                          <i className="fa-solid fa-x"></i>
                        </button>
                      </div>
                    ) : (
                      <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-all text-slate-600 hover:text-slate-400">
                        <i className="fa-solid fa-plus"></i>
                        <span className="text-[10px] mt-1">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleStartImageUpload} />
                      </label>
                    )}
                    <p className="text-[10px] text-slate-500 leading-tight">Provide an image to guide the first frame of your video.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Ratio</label>
                  <select value={aspectRatio} onChange={(e: any) => setAspectRatio(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none cursor-pointer">
                    {type === 'image' && <option value="1:1">1:1 Square</option>}
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                  </select>
                </div>
                {type === 'image' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Quality</label>
                    <select value={size} onChange={(e: any) => setSize(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none">
                      <option value="1K">1K Basic</option>
                      <option value="2K">2K High</option>
                      <option value="4K">4K Ultra</option>
                    </select>
                  </div>
                )}
              </div>

              {(type === 'video' || size !== '1K') && !hasApiKey && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-amber-500">Paid API key required</p>
                    <p className="text-[10px] text-amber-200/60">Veo and High-Res images need a billing-enabled key.</p>
                  </div>
                  <button onClick={openKeyPicker} className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 rounded-xl text-xs font-bold transition-all">Select</button>
                </div>
              )}

              <button 
                onClick={handleGenerate} 
                disabled={isGenerating || !prompt} 
                className={`w-full py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 ${
                  isGenerating 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02] text-white'
                }`}
              >
                {isGenerating ? (
                  <><i className="fa-solid fa-circle-notch animate-spin"></i> Processing...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles"></i> Create {type === 'image' ? 'Image' : 'Video'}</>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className={`flex-1 glass-panel rounded-3xl min-h-[400px] flex items-center justify-center border-dashed border-2 border-slate-700 overflow-hidden relative shadow-inner ${isGenerating ? 'animate-pulse' : ''}`}>
              {result ? (
                type === 'image' ? (
                  <img src={result} className="w-full h-full object-contain" />
                ) : (
                  <video src={result} controls autoPlay loop className="w-full h-full object-contain" />
                )
              ) : isGenerating ? (
                <div className="text-center p-8">
                  <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-6 shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
                  <p className="text-blue-400 font-medium mb-2">{statusMessage}</p>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto italic">This can take up to 2 minutes for high-quality video generation. Please don't close the window.</p>
                </div>
              ) : (
                <div className="text-center opacity-30">
                  <i className={`fa-solid ${type === 'image' ? 'fa-image' : 'fa-clapperboard'} text-6xl mb-4`}></i>
                  <p className="text-sm">Canvas ready for generation</p>
                </div>
              )}
            </div>
            {result && (
              <div className="mt-4 flex gap-3">
                <a href={result} download={`omni-${type}-${Date.now()}`} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-center text-sm font-bold transition-all">
                  <i className="fa-solid fa-download mr-2"></i> Save Result
                </a>
                <button onClick={() => { setPrompt(''); setResult(null); setStartImage(null); }} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-sm transition-all">
                  <i className="fa-solid fa-rotate-right"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
