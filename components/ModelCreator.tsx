import React, { useRef, useState } from 'react';
import { Upload, Sparkles, Save, Wand2, RefreshCcw, Download, Palette, MapPin, Dices, Loader2, User, Box, Mountain, TextQuote, Shirt, Sparkle } from 'lucide-react';
import { analyzeImageForDescription, generateModelSheet, generateRandomIdea, generateConceptImage } from '../services/geminiService';
import { Character, ComicObject, Environment, ArtStyle, ArtTheme, GeneratedPanel, ModelLabState } from '../types';

interface ModelCreatorProps {
  onSaveCharacter: (char: Character) => void;
  onSaveObject: (obj: ComicObject) => void;
  onSaveEnvironment: (env: Environment) => void;
  onAddToGallery?: (panel: GeneratedPanel) => void; 
  
  state: ModelLabState;
  setState: React.Dispatch<React.SetStateAction<ModelLabState>>;
}

export const ModelCreator: React.FC<ModelCreatorProps> = ({ 
    onSaveCharacter, 
    onSaveObject, 
    onSaveEnvironment,
    onAddToGallery,
    state,
    setState
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({...prev, uploadedImage: reader.result as string, step: 1, generatedModelSheet: null}));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRandomIdea = async () => {
    setIsGeneratingIdea(true);
    try {
      const idea = await generateRandomIdea(state.type);
      setState(prev => ({
        ...prev,
        name: idea.name || prev.name,
        description: idea.description || prev.description,
        gender: idea.gender || prev.gender,
        facialFeatures: idea.facialFeatures || prev.facialFeatures,
        skinTone: idea.skinTone || prev.skinTone,
        clothingDetails: idea.clothingDetails || prev.clothingDetails,
        artStyle: idea.artStyle || prev.artStyle,
        artTheme: idea.artTheme || prev.artTheme
      }));
    } catch (e) {
      alert("Erro ao gerar ideia.");
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleFullAutoRandom = async () => {
    setIsProcessing(true);
    try {
      // 1. Generate Idea
      setProcessStatus('Inventando identidade e design...');
      const idea = await generateRandomIdea(state.type);
      
      const newState = {
        ...state,
        name: idea.name || 'Desconhecido',
        description: idea.description || '',
        gender: idea.gender || 'male',
        facialFeatures: idea.facialFeatures || '',
        skinTone: idea.skinTone || '',
        clothingDetails: idea.clothingDetails || '',
        artStyle: idea.artStyle as ArtStyle || 'comic',
        artTheme: idea.artTheme as ArtTheme || 'none'
      };
      setState(newState);

      // 2. Generate Concept Image
      setProcessStatus('Gerando arte conceitual visual...');
      const conceptImg = await generateConceptImage(newState.description, newState.artStyle, newState.artTheme);
      setState(prev => ({...prev, uploadedImage: conceptImg}));

      // 3. Generate Turnaround
      setProcessStatus('Criando folha de modelo (Turnaround)...');
      const modelSheet = await generateModelSheet(
          conceptImg, 
          newState.description, 
          state.type, 
          state.type === 'character' ? (newState.gender as 'male' | 'female') : undefined,
          newState.artStyle,
          newState.artTheme
      );
      
      setState(prev => ({...prev, generatedModelSheet: modelSheet, step: 3}));

      if (onAddToGallery) {
          onAddToGallery({
              id: crypto.randomUUID(),
              imageUrl: modelSheet,
              prompt: `Full Auto Model: ${newState.name}`,
              characterIds: [], objectIds: [], environmentId: null, timestamp: Date.now()
          });
      }

    } catch (error) {
      console.error(error);
      alert('Erro no fluxo automático.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleAnalyzeAndGenerate = async () => {
    setIsProcessing(true);
    let workingImage = state.uploadedImage;
    
    try {
      // Step A: Generate Concept Image if none exists
      if (!workingImage) {
        setProcessStatus('Criando conceito visual básico...');
        const conceptImg = await generateConceptImage(state.description, state.artStyle, state.artTheme);
        workingImage = conceptImg;
        setState(prev => ({...prev, uploadedImage: conceptImg}));
      }

      // Step B: Analysis
      let currentDesc = state.description;
      if (!state.description || state.step === 1) {
          setProcessStatus('Analisando características detalhadas...');
          const analysis = await analyzeImageForDescription(workingImage);
          setState(prev => ({
              ...prev,
              description: analysis.description,
              facialFeatures: analysis.facialFeatures,
              skinTone: analysis.skinTone,
              clothingDetails: analysis.clothingDetails
          }));
          currentDesc = analysis.description;
      }

      // Step C: Model Sheet Generation
      setProcessStatus('Gerando folha de turnaround (3 ângulos)...');
      const modelSheet = await generateModelSheet(
          workingImage, 
          currentDesc, 
          state.type, 
          state.type === 'character' ? state.gender : undefined,
          state.artStyle,
          state.artTheme
      );
      
      setState(prev => ({...prev, generatedModelSheet: modelSheet, step: 3}));

      if (onAddToGallery) {
          onAddToGallery({
              id: crypto.randomUUID(),
              imageUrl: modelSheet,
              prompt: `Model Sheet: ${state.name} | ${state.artStyle}`,
              characterIds: [], objectIds: [], environmentId: null, timestamp: Date.now()
          });
      }

    } catch (error) {
      alert('Erro ao processar modelo.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleSave = () => {
    const id = crypto.randomUUID();
    const commonData = {
      id,
      name: state.name,
      description: state.description,
      gender: state.gender,
      facialFeatures: state.facialFeatures,
      skinTone: state.skinTone,
      clothingDetails: state.clothingDetails,
      modelSheetBase64: state.generatedModelSheet || state.uploadedImage,
    };

    if (state.type === 'character') onSaveCharacter(commonData as Character);
    else if (state.type === 'object') onSaveObject(commonData as ComicObject);
    else onSaveEnvironment(commonData as Environment);
    
    setState(prev => ({ ...prev, step: 1, uploadedImage: null, name: '', description: '', generatedModelSheet: null }));
    alert('Salvo com sucesso!');
  };

  return (
    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Wand2 className="text-purple-400" />
              Laboratório de Modelos
            </h2>
            <p className="text-slate-400">Crie referências visuais consistentes. Comece do zero ou use a IA.</p>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={handleRandomIdea}
                disabled={isGeneratingIdea || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg font-bold text-sm shadow-lg transition-all border border-slate-700"
                title="Apenas sugerir texto"
            >
                {isGeneratingIdea ? <Loader2 className="animate-spin" size={16} /> : <Dices size={16} />}
                Sugestão
            </button>
            <button 
                onClick={handleFullAutoRandom}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                title="Gerar Identidade + Imagem + Turnaround"
            >
                {isProcessing && processStatus.includes('Inventando') ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Modelo Aleatório Completo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">1. Definição do Asset</h3>
              
              <div className="flex gap-2 mb-4 p-1 bg-slate-900 rounded-lg">
                <button onClick={() => setState(p => ({...p, type: 'character'}))} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${state.type === 'character' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><User size={14} className="inline mr-1"/> Personagem</button>
                <button onClick={() => setState(p => ({...p, type: 'object'}))} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${state.type === 'object' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Box size={14} className="inline mr-1"/> Objeto</button>
                <button onClick={() => setState(p => ({...p, type: 'environment'}))} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${state.type === 'environment' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Mountain size={14} className="inline mr-1"/> Cenário</button>
              </div>

              <div className="space-y-4">
                <input type="text" value={state.name} onChange={(e) => setState(p => ({...p, name: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm" placeholder="Nome do asset..."/>
                
                {state.type === 'character' && (
                  <div className="flex gap-2">
                    <button onClick={() => setState(p => ({...p, gender: 'male'}))} className={`flex-1 py-1 rounded border text-[10px] uppercase font-bold ${state.gender === 'male' ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Masculino</button>
                    <button onClick={() => setState(p => ({...p, gender: 'female'}))} className={`flex-1 py-1 rounded border text-[10px] uppercase font-bold ${state.gender === 'female' ? 'bg-pink-600 border-pink-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Feminino</button>
                  </div>
                )}

                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-600 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-750 transition overflow-hidden">
                  {state.uploadedImage ? <img src={state.uploadedImage} className="h-full object-contain" /> : <div className="text-center text-slate-500 text-xs"><Upload className="mx-auto mb-1" /><span>Upload (Opcional se usar IA)</span></div>}
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select value={state.artStyle} onChange={(e) => setState(p => ({...p, artStyle: e.target.value as ArtStyle}))} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
                    <option value="comic">Digital Comic</option>
                    <option value="anime">Anime Moderno</option>
                    <option value="retro_anime">Anime 90s</option>
                    <option value="manga">Mangá (P&B)</option>
                    <option value="realistic">Realista (8K)</option>
                    <option value="cartoon">Cartoon</option>
                  </select>
                  <select value={state.artTheme} onChange={(e) => setState(p => ({...p, artTheme: e.target.value as ArtTheme}))} className="bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white">
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
            </div>

            <div className={`bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4`}>
              <h3 className="text-lg font-semibold text-white">2. Processamento Detalhado</h3>
              
              <button 
                onClick={handleAnalyzeAndGenerate} 
                disabled={isProcessing || !state.name || (!state.uploadedImage && !state.description)} 
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 mb-4"
              >
                {isProcessing ? <><Loader2 className="animate-spin" /> {processStatus}</> : <><Sparkles /> {state.uploadedImage ? 'Analisar e Criar Turnaround' : 'Gerar Conceito + Turnaround'}</>}
              </button>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                    <TextQuote size={10} /> Descrição Geral
                  </label>
                  <textarea 
                    value={state.description} 
                    onChange={(e) => setState(p => ({...p, description: e.target.value}))} 
                    className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white resize-none" 
                    placeholder="Descrição visual do asset..."
                  />
                </div>

                {state.type === 'character' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <User size={10} /> Detalhes Faciais
                      </label>
                      <input 
                        type="text"
                        value={state.facialFeatures} 
                        onChange={(e) => setState(p => ({...p, facialFeatures: e.target.value}))} 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" 
                        placeholder="Olhos, cabelo, traços marcantes..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Palette size={10} /> Tom de Pele
                      </label>
                      <input 
                        type="text"
                        value={state.skinTone} 
                        onChange={(e) => setState(p => ({...p, skinTone: e.target.value}))} 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" 
                        placeholder="Pálido, bronzeado, oliva, etc..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Shirt size={10} /> Figurino / Traje
                      </label>
                      <input 
                        type="text"
                        value={state.clothingDetails} 
                        onChange={(e) => setState(p => ({...p, clothingDetails: e.target.value}))} 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white" 
                        placeholder="Roupas, armaduras, acessórios..."
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col h-full min-h-[500px]">
            <h3 className="text-lg font-semibold text-white mb-4">3. Resultado Final</h3>
            <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden relative group">
              {state.generatedModelSheet ? (
                <>
                  <img src={state.generatedModelSheet} className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex gap-2">
                    <button onClick={handleAnalyzeAndGenerate} className="p-2 bg-black/60 rounded-full"><RefreshCcw size={18} /></button>
                    <a href={state.generatedModelSheet} download={`${state.name}_sheet.png`} className="p-2 bg-black/60 rounded-full"><Download size={18} /></a>
                  </div>
                </>
              ) : <div className="text-slate-600 text-center p-8 text-xs"><Sparkles className="mx-auto mb-2 opacity-20" size={32} />A folha de modelo (turnaround) aparecerá aqui após o processamento.</div>}
            </div>
            <button onClick={handleSave} disabled={!state.generatedModelSheet || !state.name} className="mt-6 w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"><Save size={18} /> Salvar no Estúdio</button>
          </div>
        </div>
      </div>
    </div>
  );
};