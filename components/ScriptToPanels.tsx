import React, { useState } from 'react';
import { Character, ComicObject, Environment, GeneratedPanel, ScriptPanelData, ArtStyle, GenerationRequest, ArtTheme } from '../types';
import { parseScript, enhancePrompt, generateComicPanel, refineImage, generateRandomScriptFromAssets } from '../services/geminiService';
import { Sparkles, Play, Users, Box, Palette, Ban, Monitor, Smartphone, Square, RectangleHorizontal, RectangleVertical, CheckCircle2, Loader2, Download, AlertCircle, FileText, Mountain, Wand2, RefreshCw, Trash2, RefreshCcw, Eraser, Link, Undo2, Redo2, MapPin, FileDown, Layers, Star, Dices } from 'lucide-react';
import { jsPDF } from "jspdf";

interface ScriptToPanelsProps {
  characters: Character[];
  objects: ComicObject[];
  environments: Environment[];
  onPanelGenerated: (panel: GeneratedPanel) => void;
  
  script: string;
  setScript: (s: string) => void;
  panels: ScriptPanelData[];
  setPanels: React.Dispatch<React.SetStateAction<ScriptPanelData[]>>;
}

export const ScriptToPanels: React.FC<ScriptToPanelsProps> = ({
  characters,
  objects,
  environments,
  onPanelGenerated,
  script,
  setScript,
  panels,
  setPanels
}) => {
  const [artStyle, setArtStyle] = useState<ArtStyle>('comic');
  const [artTheme, setArtTheme] = useState<ArtTheme>('none');
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "3:4" | "4:3">("16:9");
  const [negativePrompt, setNegativePrompt] = useState('');
  const [transparentBackground, setTransparentBackground] = useState(false);

  const [isEnhancingScript, setIsEnhancingScript] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const [refinementInputs, setRefinementInputs] = useState<Record<string, string>>({});
  const [isRefiningMap, setIsRefiningMap] = useState<Record<string, boolean>>({});

  const addToHistory = (panelId: string, newImageUrl: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const currentHistory = p.imageHistory || [];
      const currentIndex = p.currentHistoryIndex ?? -1;
      const historyUpToNow = currentHistory.slice(0, currentIndex + 1);
      const newHistory = [...historyUpToNow, newImageUrl];
      return {
        ...p,
        imageHistory: newHistory,
        currentHistoryIndex: newHistory.length - 1,
        imageUrl: newImageUrl,
        status: 'done'
      };
    }));
  };

  const handleUndo = (panelId: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      if (p.currentHistoryIndex > 0) {
        const newIndex = p.currentHistoryIndex - 1;
        return { ...p, currentHistoryIndex: newIndex, imageUrl: p.imageHistory[newIndex] };
      }
      return p;
    }));
  };

  const handleRedo = (panelId: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      if (p.currentHistoryIndex < p.imageHistory.length - 1) {
        const newIndex = p.currentHistoryIndex + 1;
        return { ...p, currentHistoryIndex: newIndex, imageUrl: p.imageHistory[newIndex] };
      }
      return p;
    }));
  };

  const handleRating = (panelId: string, rating: number) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, rating } : p));
  };

  const toggleContinuity = (panelId: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, usePreviousPanelReference: !p.usePreviousPanelReference } : p));
  };

  const handleClearSession = () => {
    if (confirm("Tem certeza que deseja reiniciar? Isso apagará todo o roteiro e os quadros gerados.")) {
      setScript(''); setPanels([]); setRefinementInputs({});
    }
  };

  const handleExportPDF = () => {
    if (panels.length === 0) return;
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      doc.setFontSize(24);
      doc.text("Roteiro Visual de Quadrinhos", pageWidth / 2, 40, { align: 'center' });
      
      panels.forEach((panel) => {
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`Quadro #${panel.panelNumber}`, margin, 30);
        if (panel.imageUrl) {
            const imgProps = doc.getImageProperties(panel.imageUrl);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
            doc.addImage(panel.imageUrl, 'PNG', margin, 45, contentWidth, imgHeight);
        }
      });
      doc.save("comic-script-export.pdf");
    } catch (e) { alert("Erro ao gerar PDF."); } finally { setIsExportingPDF(false); }
  };

  const togglePanelCharacter = (panelId: string, charId: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const currentIds = p.activeCharacterIds || [];
      const newIds = currentIds.includes(charId) ? currentIds.filter(id => id !== charId) : [...currentIds, charId];
      return { ...p, activeCharacterIds: newIds };
    }));
  };

  const setPanelCamera = (panelId: string, camera: string) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, selectedCamera: camera } : p));
  };

  const handleDeletePanel = (panelId: string) => {
    if (confirm("Remover este quadro do roteiro?")) {
      setPanels(prev => prev.filter(p => p.id !== panelId));
    }
  };

  const handleEnhanceScript = async () => {
    if (!script) return;
    setIsEnhancingScript(true);
    try { setScript(await enhancePrompt(script)); } finally { setIsEnhancingScript(false); }
  };

  const handleGenerateRandomScript = async () => {
    if (characters.length === 0 && environments.length === 0) {
      alert("Crie pelo menos um personagem ou cenário no Laboratório para que a IA possa sugerir uma história baseada nos seus ativos.");
      return;
    }
    setIsGeneratingScript(true);
    try {
      const newScript = await generateRandomScriptFromAssets(characters, objects, environments);
      setScript(newScript);
    } catch (e) {
      alert("Erro ao sugerir história.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleAnalyze = async () => {
    if (!script) return;
    setIsAnalyzing(true);
    try {
      const parsedPanels = await parseScript(script, characters);
      const panelsWithAssets = parsedPanels.map(panel => {
        const descLower = panel.description.toLowerCase();
        const detectedCharIds = characters.filter(c => descLower.includes(c.name.toLowerCase())).map(c => c.id);
        const detectedObjIds = objects.filter(o => descLower.includes(o.name.toLowerCase())).map(o => o.id);
        const detectedEnv = environments.find(e => descLower.includes(e.name.toLowerCase()));
        return {
          ...panel,
          selectedCamera: panel.suggestedCamera,
          activeCharacterIds: detectedCharIds, 
          activeObjectIds: detectedObjIds,
          activeEnvironmentId: detectedEnv ? detectedEnv.id : null,
          usePreviousPanelReference: false,
          imageHistory: [],
          currentHistoryIndex: -1,
          rating: null,
        };
      });
      setPanels(panelsWithAssets);
    } catch (e) { alert("Erro ao analisar roteiro."); } finally { setIsAnalyzing(false); }
  };

  const generateSinglePanel = async (panel: ScriptPanelData): Promise<void> => {
    setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, status: 'generating' } : p));
    try {
      const activeCharIds = panel.activeCharacterIds || [];
      const activeObjIds = panel.activeObjectIds || [];
      const activeEnvId = panel.activeEnvironmentId;

      let previousPanelImage: string | undefined = undefined;
      if (panel.usePreviousPanelReference) {
        const panelIndex = panels.findIndex(p => p.id === panel.id);
        if (panelIndex > 0 && panels[panelIndex - 1].imageUrl) {
          previousPanelImage = panels[panelIndex - 1].imageUrl;
        }
      }

      const highRatedPanels = panels.filter(p => p.rating && p.rating >= 4 && p.imageUrl && p.id !== panel.id).slice(-2);
      const styleReferences = highRatedPanels.map(p => p.imageUrl!);
      
      const request: GenerationRequest = {
        characterIds: activeCharIds, objectIds: activeObjIds, environmentId: activeEnvId || null,
        useObject: activeObjIds.length > 0, useEnvironment: !!activeEnvId && !transparentBackground,
        transparentBackground, poseDescription: panel.description, backgroundDescription: "Consistency focused setting.",
        compositionDescription: "", negativePrompt, cameraAngle: panel.selectedCamera || panel.suggestedCamera,
        aspectRatio, artStyle, artTheme, enhancePose: false, enhanceBackground: true, enhanceComposition: false,
      };

      const selectedChars = characters.filter(c => request.characterIds.includes(c.id));
      const selectedObjs = objects.filter(o => request.objectIds.includes(o.id));
      const selectedEnv = environments.find(e => e.id === request.environmentId);

      const imageUrl = await generateComicPanel(
          request, 
          selectedChars, 
          selectedObjs, 
          selectedEnv, 
          previousPanelImage, 
          styleReferences,
          panel.rating
      );

      setPanels(prev => prev.map(p => {
        if (p.id !== panel.id) return p;
        const currentHistory = p.imageHistory || [];
        const currentIndex = p.currentHistoryIndex ?? -1;
        const historyUpToNow = currentHistory.slice(0, currentIndex + 1);
        const newHistory = [...historyUpToNow, imageUrl];
        return { ...p, imageHistory: newHistory, currentHistoryIndex: newHistory.length - 1, imageUrl, status: 'done' };
      }));
      
      onPanelGenerated({ id: crypto.randomUUID(), imageUrl, prompt: panel.description, characterIds: activeCharIds, objectIds: activeObjIds, environmentId: activeEnvId || null, timestamp: Date.now() });
    } catch (e) { setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, status: 'error' } : p)); }
  };

  const handleGenerateAll = async () => {
    if (panels.length === 0) return;
    setIsGeneratingAll(true);
    const panelsToGenerate = panels.filter(p => p.status === 'pending' || p.status === 'error');
    for (const panel of panelsToGenerate) {
        await generateSinglePanel(panel);
        await new Promise(r => setTimeout(r, 500));
    }
    setIsGeneratingAll(false);
  };

  const handleRefinePanel = async (panel: ScriptPanelData) => {
    const prompt = refinementInputs[panel.id];
    if (!panel.imageUrl || !prompt) return;
    setIsRefiningMap(prev => ({ ...prev, [panel.id]: true }));
    try {
      const refinedImage = await refineImage(panel.imageUrl, prompt, artStyle);
      addToHistory(panel.id, refinedImage);
      setRefinementInputs(prev => ({ ...prev, [panel.id]: '' }));
    } finally { setIsRefiningMap(prev => ({ ...prev, [panel.id]: false })); }
  };

  const RatingStars = ({ rating, onChange }: { rating: number | null, onChange: (r: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)} className={`transition-all hover:scale-110 ${rating && star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}>
          <Star size={16} fill={rating && star <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      <div className="w-full lg:w-96 border-r border-slate-800 bg-slate-900 flex flex-col h-full">
        <div className="p-4 border-b border-slate-800 flex justify-between items-start">
           <div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="text-blue-400" /> Roteiro</h2>
             <p className="text-xs text-slate-500 mt-1">Gere sequências consistentes a partir de texto.</p>
           </div>
           <div className="flex gap-2 items-center">
             <button onClick={handleExportPDF} title="Exportar para PDF" disabled={panels.length === 0 || isExportingPDF} className="text-slate-500 hover:text-green-400 p-1 disabled:opacity-30"><FileDown size={18} /></button>
             <button onClick={handleClearSession} title="Limpar Sessão" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/50 rounded hover:bg-red-900/50"><Eraser size={14} /> Reiniciar</button>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-slate-300">Roteiro / História</label>
              <div className="flex gap-2">
                <button 
                  onClick={handleGenerateRandomScript} 
                  disabled={isGeneratingScript}
                  className="text-[10px] flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {isGeneratingScript ? <Loader2 className="animate-spin" size={12} /> : <Dices size={12} />}
                  Sugerir História
                </button>
                <button 
                  onClick={handleEnhanceScript} 
                  disabled={!script || isEnhancingScript} 
                  className="text-[10px] flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {isEnhancingScript ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />} 
                  IA
                </button>
              </div>
            </div>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder="Ex: @Herói foge da @Explosão enquanto segura a @Maleta..." className="w-full h-40 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white resize-none font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none" />
          </div>
          
          <div className="space-y-4 pt-4 border-t border-slate-800">
             {/* Aspect Ratio Section */}
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-wider">Proporção</label>
                <div className="grid grid-cols-5 gap-1">
                  <button onClick={() => setAspectRatio("1:1")} className={`py-2 px-1 rounded text-[8px] flex flex-col items-center justify-center gap-1 border transition ${aspectRatio === "1:1" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`} title="1:1 (Quadrado)"><Square size={10} /> 1:1</button>
                  <button onClick={() => setAspectRatio("16:9")} className={`py-2 px-1 rounded text-[8px] flex flex-col items-center justify-center gap-1 border transition ${aspectRatio === "16:9" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`} title="16:9 (Cinema)"><Monitor size={10} /> 16:9</button>
                  <button onClick={() => setAspectRatio("9:16")} className={`py-2 px-1 rounded text-[8px] flex flex-col items-center justify-center gap-1 border transition ${aspectRatio === "9:16" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`} title="9:16 (Story)"><Smartphone size={10} /> 9:16</button>
                  <button onClick={() => setAspectRatio("4:3")} className={`py-2 px-1 rounded text-[8px] flex flex-col items-center justify-center gap-1 border transition ${aspectRatio === "4:3" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`} title="4:3 (TV Clássica)"><RectangleHorizontal size={10} /> 4:3</button>
                  <button onClick={() => setAspectRatio("3:4")} className={`py-2 px-1 rounded text-[8px] flex flex-col items-center justify-center gap-1 border transition ${aspectRatio === "3:4" ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`} title="3:4 (Retrato)"><RectangleVertical size={10} /> 3:4</button>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Estilo</label>
                    <select value={artStyle} onChange={(e) => setArtStyle(e.target.value as ArtStyle)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                        <option value="comic">Digital Comic</option>
                        <option value="anime">Anime Moderno</option>
                        <option value="retro_anime">Anime 90s</option>
                        <option value="manga">Mangá (P&B)</option>
                        <option value="realistic">Realista (8K)</option>
                        <option value="cartoon">Cartoon</option>
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Temática</label>
                    <select value={artTheme} onChange={(e) => setArtTheme(e.target.value as ArtTheme)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white">
                        <option value="none">Padrão</option>
                        <option value="steampunk">Steampunk</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="medieval">Medieval</option>
                        <option value="feudal">Japão Feudal</option>
                        <option value="modern">Moderno</option>
                        <option value="scifi">Sci-Fi</option>
                        <option value="noir">Noir</option>
                        <option value="fantasy">Fantasia</option>
                    </select>
                </div>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Prompt Negativo</label>
                <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full h-16 bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white resize-none" />
             </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={handleAnalyze} disabled={!script || isAnalyzing} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2">{isAnalyzing ? <Loader2 className="animate-spin" /> : <Play size={20} />} Analisar</button>
            {panels.length > 0 && <button onClick={handleGenerateAll} disabled={isGeneratingAll} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2">{isGeneratingAll ? <Loader2 className="animate-spin" /> : <Layers size={20} />} Gerar Tudo</button>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-950 p-6">
         <div className="max-w-5xl mx-auto space-y-8">
            {panels.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-[60vh] text-slate-600">
                  <FileText size={64} className="mb-4 opacity-20" />
                  <p>Inicie seu roteiro para visualizar os quadros.</p>
                  <p className="text-xs mt-2 text-slate-500">Dica: Use '@' para referenciar seus personagens criados.</p>
               </div>
            ) : panels.map((panel, index) => {
               const isFirstPanel = index === 0;
               return (
               <div key={panel.id} className="flex gap-4">
                  <div className="flex flex-col items-center pt-2">
                     <div className="w-8 h-8 rounded-full bg-blue-900 border border-blue-500 flex items-center justify-center text-sm font-bold text-white">{panel.panelNumber}</div>
                     <div className="w-0.5 flex-1 bg-slate-800 my-2"></div>
                  </div>
                  <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-5 relative">
                     <button onClick={() => handleDeletePanel(panel.id)} className="absolute top-4 right-4 text-slate-600 hover:text-red-500"><Trash2 size={16} /></button>
                     <div className="flex flex-col xl:flex-row gap-6">
                        <div className="flex-1 flex flex-col gap-3">
                           <div className="flex items-center gap-2 bg-slate-800 rounded p-1 border border-slate-700 w-fit">
                             <Monitor size={14} className="text-indigo-400 ml-1" />
                             <select value={panel.selectedCamera || panel.suggestedCamera} onChange={(e) => setPanelCamera(panel.id, e.target.value)} className="bg-transparent text-[10px] font-bold uppercase text-slate-300">
                               <option value="front">Frente</option><option value="back">Costas</option><option value="close-up">Close-up</option><option value="wide">Plano Aberto</option>
                             </select>
                           </div>
                           <p className="text-sm text-slate-300 bg-slate-950/50 p-3 rounded">{panel.description}</p>
                           {!isFirstPanel && (
                             <button onClick={() => toggleContinuity(panel.id)} className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${panel.usePreviousPanelReference ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                               <Link size={14} /> {panel.usePreviousPanelReference ? 'Continuidade: ATIVA' : 'Vincular à Cena Anterior'}
                             </button>
                           )}
                           <div className="bg-slate-800/50 p-3 rounded-lg space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {characters.map(char => (
                                  <button key={char.id} onClick={() => togglePanelCharacter(panel.id, char.id)} className={`px-2 py-1 rounded text-[10px] border ${panel.activeCharacterIds?.includes(char.id) ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>{char.name}</button>
                                ))}
                              </div>
                           </div>
                           <div className="pt-2">
                              {panel.status === 'pending' && <button onClick={() => generateSinglePanel(panel)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm flex items-center gap-2"><Sparkles size={16} /> Gerar Quadro</button>}
                              {panel.status === 'generating' && <div className="text-blue-400 text-sm flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Criando arte...</div>}
                              {panel.status === 'done' && (
                                  <div className="flex flex-col gap-3">
                                      <div className="flex gap-2">
                                        <input type="text" placeholder="Refinar..." value={refinementInputs[panel.id] || ''} onChange={(e) => setRefinementInputs(prev => ({...prev, [panel.id]: e.target.value}))} className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                                        <button onClick={() => handleRefinePanel(panel)} disabled={isRefiningMap[panel.id]} className="bg-indigo-600 p-1.5 rounded" title="Refinar Imagem Atual">{isRefiningMap[panel.id] ? <RefreshCw className="animate-spin" size={14} /> : <Wand2 size={14} />}</button>
                                        <button onClick={() => generateSinglePanel(panel)} disabled={panel.status === 'generating'} className="bg-slate-700 hover:bg-slate-600 p-1.5 rounded" title="Regerar do Zero (Usa Feedback)">
                                            <RefreshCcw size={14} />
                                        </button>
                                      </div>
                                      {panel.rating !== null && (
                                          <p className="text-[10px] text-slate-500 italic">Nota atual: {panel.rating}/5. Clique em regerar para tentar novamente com este feedback.</p>
                                      )}
                                  </div>
                              )}
                           </div>
                        </div>
                        <div className="w-full xl:w-96 aspect-video bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center relative group overflow-hidden shadow-inner">
                           {panel.imageUrl ? (
                              <>
                                 <img src={panel.imageUrl} alt="Result" className="w-full h-full object-contain" />
                                 <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100"><a href={panel.imageUrl} download={`panel-${panel.panelNumber}.png`} className="p-2 bg-black/60 text-white rounded-full"><Download size={16} /></a></div>
                                 {(panel.imageHistory?.length > 1) && (
                                   <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100">
                                      <button onClick={() => handleUndo(panel.id)} disabled={panel.currentHistoryIndex <= 0} className="p-2 bg-black/60 text-white rounded-full disabled:opacity-30"><Undo2 size={16} /></button>
                                      <button onClick={() => handleRedo(panel.id)} disabled={panel.currentHistoryIndex >= panel.imageHistory.length - 1} className="p-2 bg-black/60 text-white rounded-full disabled:opacity-30"><Redo2 size={16} /></button>
                                   </div>
                                 )}
                                 <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                                    <div className="flex flex-col gap-1">
                                      {panel.usePreviousPanelReference && <div className="bg-blue-900/80 text-blue-100 text-[10px] px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1"><Link size={10} /> Sequência Contínua</div>}
                                    </div>
                                    <div className="p-2 rounded-full bg-black/60 backdrop-blur-sm"><RatingStars rating={panel.rating} onChange={(r) => handleRating(panel.id, r)} /></div>
                                 </div>
                              </>
                           ) : <Monitor size={32} className="opacity-20" />}
                        </div>
                     </div>
                  </div>
               </div>
            )})}
         </div>
      </div>
    </div>
  );
};