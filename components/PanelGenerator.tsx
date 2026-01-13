
import React, { useState } from 'react';
import { Character, ComicObject, Environment, GeneratedPanel, GenerationRequest, ArtStyle, ArtTheme, StudioState } from '../types';
import { generateComicPanel, refineImage } from '../services/geminiService';
import { Sparkles, Image as ImageIcon, LayoutTemplate, Layers, Download, Box, Monitor, Smartphone, Square, Mountain, ToggleLeft, ToggleRight, Ghost, Video, Users, Palette, Ban, Wand2, RefreshCw, LayoutDashboard, RectangleHorizontal, RectangleVertical, MapPin, Star, RefreshCcw } from 'lucide-react';

interface PanelGeneratorProps {
  characters: Character[];
  objects: ComicObject[];
  environments: Environment[];
  
  selectedCharacterIds: string[];
  selectedObjectIds: string[];
  selectedEnvironmentId: string | null;
  
  onPanelGenerated: (panel: GeneratedPanel) => void;

  // Persistent State
  state: StudioState;
  setState: React.Dispatch<React.SetStateAction<StudioState>>;
}

export const PanelGenerator: React.FC<PanelGeneratorProps> = ({
  characters,
  objects,
  environments,
  selectedCharacterIds,
  selectedObjectIds,
  selectedEnvironmentId,
  onPanelGenerated,
  state,
  setState
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const selectedCharacters = characters.filter(c => selectedCharacterIds.includes(c.id));
  const selectedObjects = objects.filter(o => selectedObjectIds.includes(o.id));
  const selectedEnvironment = environments.find(e => e.id === selectedEnvironmentId);

  const handleGenerate = async (useFeedback: boolean = false) => {
    // Basic validation
    if (!state.pose && !state.background && !state.composition && !selectedEnvironment) return;

    setIsGenerating(true);

    const request: GenerationRequest = {
      characterIds: selectedCharacterIds,
      objectIds: selectedObjectIds,
      environmentId: selectedEnvironmentId,
      useObject: state.useObject,
      useEnvironment: state.useEnvironment,
      transparentBackground: state.transparentBackground,
      poseDescription: state.pose,
      backgroundDescription: state.background,
      compositionDescription: state.composition,
      negativePrompt: state.negativePrompt,
      cameraAngle: state.cameraAngle,
      aspectRatio: state.aspectRatio,
      artStyle: state.artStyle,
      artTheme: state.artTheme,
      enhancePose: state.enhancePose,
      enhanceBackground: state.enhanceBackground,
      enhanceComposition: state.enhanceComposition,
    };

    try {
      const feedbackRating = useFeedback ? state.currentRating : null;
      const base64Image = await generateComicPanel(
        request, 
        selectedCharacters, 
        selectedObjects, 
        selectedEnvironment,
        undefined, // No sequence continuity in basic studio yet
        undefined, // No style refs in basic studio yet
        feedbackRating
      );
      
      setState(prev => ({...prev, lastGeneratedImage: base64Image, currentRating: null}));
      setRefinementPrompt(''); 
      
      const newPanel: GeneratedPanel = {
        id: crypto.randomUUID(),
        imageUrl: base64Image,
        prompt: `Pose: ${state.pose} | Comp: ${state.composition}`,
        characterIds: selectedCharacterIds,
        objectIds: selectedObjectIds,
        environmentId: selectedEnvironmentId,
        timestamp: Date.now(),
      };
      
      onPanelGenerated(newPanel);

    } catch (error) {
      alert("Falha ao gerar imagem. Por favor tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!state.lastGeneratedImage || !refinementPrompt) return;

    setIsRefining(true);
    try {
      const refinedImage = await refineImage(state.lastGeneratedImage, refinementPrompt, state.artStyle);
      
      setState(prev => ({...prev, lastGeneratedImage: refinedImage, currentRating: null}));
      
      const newPanel: GeneratedPanel = {
        id: crypto.randomUUID(),
        imageUrl: refinedImage,
        prompt: `Refined: ${refinementPrompt}`,
        characterIds: selectedCharacterIds,
        objectIds: selectedObjectIds,
        environmentId: selectedEnvironmentId,
        timestamp: Date.now(),
      };
      onPanelGenerated(newPanel);
      setRefinementPrompt(''); 

    } catch (error) {
      alert("Falha ao refinar imagem.");
    } finally {
      setIsRefining(false);
    }
  };

  const handleRatingChange = (rating: number) => {
    setState(prev => ({ ...prev, currentRating: rating }));
  };

  const RatingStars = ({ rating, onChange }: { rating: number | null, onChange: (r: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} onClick={() => onChange(star)} className={`transition-all hover:scale-110 ${rating && star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}>
          <Star size={20} fill={rating && star <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );

  const ToggleSwitch = ({ checked, onChange, label, disabled }: { checked: boolean, onChange: (v: boolean) => void, label: string, disabled: boolean }) => (
    <button 
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center gap-2 text-xs font-medium transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${checked && !disabled ? 'text-green-400' : 'text-slate-500'}`}
      disabled={disabled}
      title={disabled ? "Selecione um item first" : label}
    >
      {checked ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
      <span>{checked ? 'Incluir' : 'Ignorar'}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
        
        {/* Controls */}
        <div className="w-full lg:w-96 p-6 border-r border-slate-800 bg-slate-900/50 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Compositor de Painel</h2>
            <p className="text-slate-400 text-sm">Defina sua cena de quadrinhos</p>
          </div>

          <div className="space-y-4">
            
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
              <label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                <span>1. Elenco ({selectedCharacters.length})</span>
                <Users size={14} />
              </label>
              
              {selectedCharacters.length > 0 ? (
                <div className="flex flex-col gap-2">
                   {selectedCharacters.map(char => (
                     <div key={char.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded border border-slate-700/50">
                       <div className="w-8 h-8 rounded bg-slate-700 overflow-hidden shrink-0">
                          {char.modelSheetBase64 && (
                            <img src={char.modelSheetBase64} alt="" className="w-full h-full object-cover" />
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-xs font-medium text-white truncate">@{char.name}</div>
                       </div>
                     </div>
                   ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">Nenhum selecionado (Heróis Genéricos)</div>
              )}
            </div>

            <div className={`p-3 bg-slate-800 rounded-lg border transition-colors ${state.useObject && selectedObjects.length > 0 ? 'border-indigo-500/50' : 'border-slate-700'}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  2. Objetos ({selectedObjects.length})
                  <Box size={14} />
                </label>
                <ToggleSwitch 
                  checked={state.useObject} 
                  onChange={(v) => setState(p => ({...p, useObject: v}))} 
                  label="Usar objetos na geração" 
                  disabled={selectedObjects.length === 0}
                />
              </div>
              
              {selectedObjects.length > 0 ? (
                <div className={`flex flex-col gap-2 transition-opacity ${state.useObject ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                  {selectedObjects.map(obj => (
                     <div key={obj.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded border border-slate-700/50">
                       <div className="w-8 h-8 rounded bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {obj.modelSheetBase64 ? (
                            <img src={obj.modelSheetBase64} alt="" className="w-full h-full object-cover" />
                          ) : <Box size={16} className="text-slate-500"/>}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-xs font-medium text-white truncate">@{obj.name}</div>
                       </div>
                     </div>
                   ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">Nenhum objeto selecionado</div>
              )}
            </div>

            <div className={`p-3 bg-slate-800 rounded-lg border transition-colors ${state.useEnvironment && selectedEnvironment && !state.transparentBackground ? 'border-indigo-500/50' : 'border-slate-700'} ${state.transparentBackground ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  3. Cenário (Opcional)
                  {selectedEnvironment && <Mountain size={14} />}
                </label>
                <ToggleSwitch 
                  checked={state.useEnvironment} 
                  onChange={(v) => setState(p => ({...p, useEnvironment: v}))} 
                  label="Usar cenário na geração"
                  disabled={!selectedEnvironment || state.transparentBackground}
                />
              </div>

              {selectedEnvironment ? (
                <div className={`flex items-center gap-3 transition-opacity ${state.useEnvironment && !state.transparentBackground ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                  <div className="w-10 h-10 rounded bg-slate-700 overflow-hidden">
                    {selectedEnvironment.modelSheetBase64 ? (
                      <img src={selectedEnvironment.modelSheetBase64} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><Mountain size={16} /></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{selectedEnvironment.name}</div>
                    <div className="text-xs text-slate-400">
                      {state.transparentBackground ? 'Desativado (Fundo Transparente)' : 'Ambiente de fundo'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">Nenhum cenário selecionado</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                4. Configurações da Imagem
              </label>
              
              <div className="space-y-3">
                <div className="grid grid-cols-5 gap-1">
                  <button 
                      onClick={() => setState(p => ({...p, aspectRatio: "1:1"}))}
                      className={`py-2 px-1 rounded text-[10px] flex flex-col items-center justify-center gap-1 border ${state.aspectRatio === "1:1" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`}
                      title="1:1 (Quadrado)"
                  >
                      <Square size={12} /> 1:1
                  </button>
                  <button 
                      onClick={() => setState(p => ({...p, aspectRatio: "16:9"}))}
                      className={`py-2 px-1 rounded text-[10px] flex flex-col items-center justify-center gap-1 border ${state.aspectRatio === "16:9" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`}
                      title="16:9 (Cinema)"
                  >
                      <Monitor size={12} /> 16:9
                  </button>
                  <button 
                      onClick={() => setState(p => ({...p, aspectRatio: "9:16"}))}
                      className={`py-2 px-1 rounded text-[10px] flex flex-col items-center justify-center gap-1 border ${state.aspectRatio === "9:16" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`}
                      title="9:16 (Story)"
                  >
                      <Smartphone size={12} /> 9:16
                  </button>
                   <button 
                      onClick={() => setState(p => ({...p, aspectRatio: "4:3"}))}
                      className={`py-2 px-1 rounded text-[10px] flex flex-col items-center justify-center gap-1 border ${state.aspectRatio === "4:3" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`}
                      title="4:3 (TV Clássica)"
                  >
                      <RectangleHorizontal size={12} /> 4:3
                  </button>
                   <button 
                      onClick={() => setState(p => ({...p, aspectRatio: "3:4"}))}
                      className={`py-2 px-1 rounded text-[10px] flex flex-col items-center justify-center gap-1 border ${state.aspectRatio === "3:4" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"}`}
                      title="3:4 (Retrato)"
                  >
                      <RectangleVertical size={12} /> 3:4
                  </button>
                </div>

                <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${state.transparentBackground ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                  <input 
                    type="checkbox" 
                    checked={state.transparentBackground}
                    onChange={(e) => setState(p => ({...p, transparentBackground: e.target.checked}))}
                    className="w-4 h-4 rounded border-slate-500 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                  />
                  <div className="ml-3 flex items-center gap-2">
                    <Ghost size={16} className={state.transparentBackground ? "text-indigo-400" : "text-slate-500"} />
                    <span className={`text-sm font-medium ${state.transparentBackground ? "text-indigo-200" : "text-slate-300"}`}>
                      Fundo Transparente (PNG)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Palette size={16} className="text-yellow-400" />
                  5. Estilo
                </label>
                <select 
                  value={state.artStyle}
                  onChange={(e) => setState(p => ({...p, artStyle: e.target.value as ArtStyle}))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="comic">Digital Comic</option>
                  <option value="anime">Anime Moderno</option>
                  <option value="retro_anime">Anime Antigo (90s)</option>
                  <option value="manga">Mangá (P&B)</option>
                  <option value="cartoon">Cartoon</option>
                  <option value="realistic">Realista (8K)</option>
                </select>
              </div>

               <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <MapPin size={16} className="text-green-400" />
                  6. Temática
                </label>
                <select 
                  value={state.artTheme}
                  onChange={(e) => setState(p => ({...p, artTheme: e.target.value as ArtTheme}))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
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
                 <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <Video size={16} className="text-indigo-400" />
                  7. Câmera
                </label>
                <select 
                  value={state.cameraAngle}
                  onChange={(e) => setState(p => ({...p, cameraAngle: e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="front">Frente</option>
                  <option value="back">Pelas Costas</option>
                  <option value="left">Perfil Esquerdo</option>
                  <option value="right">Perfil Direito</option>
                  <option value="top">Topo (Aérea)</option>
                  <option value="bottom">Baixo (Worm)</option>
                  <option value="top-right">Canto Sup. Dir</option>
                  <option value="top-left">Canto Sup. Esq</option>
                  <option value="bottom-right">Canto Inf. Dir</option>
                  <option value="bottom-left">Canto Inf. Esq</option>
                  <option value="close-up">Close-up</option>
                  <option value="wide">Plano Aberto</option>
                </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <LayoutDashboard size={16} className="text-orange-400" />
                    8. Composição de Cena
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={state.enhanceComposition} 
                     onChange={e => setState(p => ({...p, enhanceComposition: e.target.checked}))}
                     className="w-3 h-3 rounded bg-slate-800 border-slate-600 text-purple-600 focus:ring-purple-500"
                   />
                   <span className={`text-[10px] font-medium flex items-center gap-1 ${state.enhanceComposition ? 'text-purple-400' : 'text-slate-500'}`}>
                     <Sparkles size={10} />
                     Melhorar Prompt (IA)
                   </span>
                </label>
              </div>
              <textarea
                value={state.composition}
                onChange={(e) => setState(p => ({...p, composition: e.target.value}))}
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500 resize-none"
                placeholder="Ex: Personagem A em primeiro plano à esquerda, vilão ao fundo centralizado..."
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <LayoutTemplate size={16} className="text-indigo-400" />
                    9. Pose & Ação
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={state.enhancePose} 
                     onChange={e => setState(p => ({...p, enhancePose: e.target.checked}))}
                     className="w-3 h-3 rounded bg-slate-800 border-slate-600 text-purple-600 focus:ring-purple-500"
                   />
                   <span className={`text-[10px] font-medium flex items-center gap-1 ${state.enhancePose ? 'text-purple-400' : 'text-slate-500'}`}>
                     <Sparkles size={10} />
                     Melhorar Prompt (IA)
                   </span>
                </label>
              </div>
              <textarea
                value={state.pose}
                onChange={(e) => setState(p => ({...p, pose: e.target.value}))}
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500 resize-none"
                placeholder="Ex: @Capitão segura a @Espada enquanto @Vilão observa..."
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                  <Layers size={16} className="text-pink-400" />
                  10. Detalhes {state.transparentBackground ? 'de Iluminação (Opcional)' : 'do Cenário'}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={state.enhanceBackground} 
                     onChange={e => setState(p => ({...p, enhanceBackground: e.target.checked}))}
                     className="w-3 h-3 rounded bg-slate-800 border-slate-600 text-purple-600 focus:ring-purple-500"
                   />
                   <span className={`text-[10px] font-medium flex items-center gap-1 ${state.enhanceBackground ? 'text-purple-400' : 'text-slate-500'}`}>
                     <Sparkles size={10} />
                     Melhorar Prompt (IA)
                   </span>
                </label>
              </div>
              <textarea
                value={state.background}
                onChange={(e) => setState(p => ({...p, background: e.target.value}))}
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500 resize-none"
                placeholder={state.transparentBackground ? "Descreva a iluminação no personagem (o fundo será removido)." : (selectedEnvironment && state.useEnvironment ? "Adicione detalhes específicos à cena neste ambiente." : "Descreva o ambiente e iluminação.")}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                <Ban size={16} className="text-red-400" />
                11. Prompt Negativo (O que evitar)
              </label>
              <textarea
                value={state.negativePrompt}
                onChange={(e) => setState(p => ({...p, negativePrompt: e.target.value}))}
                className="w-full h-24 bg-slate-800 border border-slate-700 rounded-md p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500 resize-none"
                placeholder="Ex: Texto, balões de fala, dedos extras, desfoque, baixa qualidade, personagens extras..."
              />
            </div>

            <button
              onClick={() => handleGenerate(false)}
              disabled={isGenerating || (!state.pose && !state.background && !state.composition && !(selectedEnvironment && state.useEnvironment && !state.transparentBackground))}
              className={`w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
                isGenerating || (!state.pose && !state.background && !state.composition && !(selectedEnvironment && state.useEnvironment && !state.transparentBackground))
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/25'
              }`}
            >
              {isGenerating ? (
                <>
                  <Sparkles className="animate-spin" /> {state.enhancePose || state.enhanceBackground || state.enhanceComposition ? "Melhorando & Gerando..." : "Gerando..."}
                </>
              ) : (
                <>
                  <Sparkles /> Gerar Arte
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview / Canvas */}
        <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
          <div className="w-full max-w-4xl flex flex-col items-center justify-center min-h-[60vh]">
            {state.lastGeneratedImage ? (
              <div className="flex flex-col items-center gap-6 w-full">
                {/* Result Image */}
                <div className={`relative group max-w-full flex items-center justify-center ${state.transparentBackground ? 'bg-[url(https://media.istockphoto.com/id/1133105337/vector/checkered-background-vector-seamless-pattern.jpg?s=612x612&w=0&k=20&c=e6sL9uYv7tXNnQ2J9L3f4g6hJ9kL5mNnO2pQ4rS3tU=)] bg-repeat' : ''}`}>
                   <img 
                     src={state.lastGeneratedImage} 
                     alt="Generated Comic Panel" 
                     className={`max-w-full max-h-[70vh] rounded-sm shadow-2xl border-4 border-white object-contain`}
                     style={{ aspectRatio: state.aspectRatio.replace(':', '/') }}
                   />
                   <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={state.lastGeneratedImage} 
                        download={`comic-panel-${Date.now()}.png`}
                        className="p-2 bg-black/70 hover:bg-black text-white rounded-full backdrop-blur-sm"
                        title="Baixar"
                      >
                        <Download size={20} />
                      </a>
                   </div>
                   {/* Rating Badge Overlay */}
                   <div className="absolute bottom-4 left-4 p-2 bg-black/60 backdrop-blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Avalie este resultado</div>
                      <RatingStars rating={state.currentRating} onChange={handleRatingChange} />
                   </div>
                </div>

                {/* Controls Area */}
                <div className="w-full max-w-xl flex flex-col gap-4">
                  {/* Regeneration with feedback */}
                  {state.currentRating !== null && (
                    <button 
                      onClick={() => handleGenerate(true)}
                      disabled={isGenerating}
                      className="w-full py-3 bg-indigo-900/40 border border-indigo-500/50 hover:bg-indigo-900/60 text-indigo-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      {isGenerating ? <RefreshCcw className="animate-spin" size={18}/> : <RefreshCcw size={18} />}
                      Regenerar usando Feedback ({state.currentRating}/5)
                    </button>
                  )}

                  {/* Refinement Area */}
                  <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold text-sm">
                      <Wand2 size={16} />
                      Refinamento & Ajustes (Inpainting)
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={refinementPrompt}
                        onChange={(e) => setRefinementPrompt(e.target.value)}
                        placeholder="Ex: Arrume os dedos, deixe o fundo mais escuro, adicione brilho na espada..."
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      />
                      <button 
                        onClick={handleRefine}
                        disabled={isRefining || !refinementPrompt}
                        className={`px-4 py-2 rounded font-medium text-xs flex items-center gap-2 transition ${isRefining || !refinementPrompt ? 'bg-slate-700 text-slate-500' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                      >
                        {isRefining ? <RefreshCw className="animate-spin" size={16}/> : "Refinar"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 italic">
                      Isso usará a imagem atual como base para criar uma variação pontual.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-600 max-w-sm">
                <div className="mb-4 flex justify-center">
                   <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center">
                     <ImageIcon size={48} className="opacity-50" />
                   </div>
                </div>
                <h3 className="text-xl font-medium text-slate-400 mb-2">Pronto para Criar</h3>
                <p className="text-sm">Selecione seus personagens, defina a cena e gere sua arte.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
