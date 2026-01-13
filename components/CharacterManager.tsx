import React, { useState, useRef } from 'react';
import { Character, ComicObject, Environment, ArtStyle, ArtTheme, CharacterSpecs, GeneratedPanel } from '../types';
import { Plus, Trash2, Upload, User, Info, Box, Mountain, CheckCircle2, X, Sparkles, RefreshCw, Save, ArrowRight, Wand2, RefreshCcw, Palette, MapPin } from 'lucide-react';
import { generateCharacterConcept, refineImage } from '../services/geminiService';

interface AssetManagerProps {
  characters: Character[];
  objects: ComicObject[];
  environments: Environment[];
  
  onAddCharacter: (char: Character) => void;
  onDeleteCharacter: (id: string) => void;
  
  onAddObject: (obj: ComicObject) => void;
  onDeleteObject: (id: string) => void;

  onAddEnvironment: (env: Environment) => void;
  onDeleteEnvironment: (id: string) => void;

  selectedCharacterIds: string[];
  onToggleCharacter: (id: string) => void;
  
  selectedObjectIds: string[];
  onToggleObject: (id: string) => void;

  selectedEnvironmentId: string | null;
  onSelectEnvironment: (id: string | null) => void;

  onAddToGallery: (panel: GeneratedPanel) => void;
  onSendToModelLab: (char: Character) => void;
}

export const CharacterManager: React.FC<AssetManagerProps> = ({
  characters,
  objects,
  environments,
  onAddCharacter,
  onDeleteCharacter,
  onAddObject,
  onDeleteObject,
  onAddEnvironment,
  onDeleteEnvironment,
  selectedCharacterIds,
  onToggleCharacter,
  selectedObjectIds,
  onToggleObject,
  selectedEnvironmentId,
  onSelectEnvironment,
  onAddToGallery,
  onSendToModelLab,
}) => {
  const [activeTab, setActiveTab] = useState<'chars' | 'objs' | 'envs'>('chars');
  const [isAdding, setIsAdding] = useState(false); 
  const [creationMode, setCreationMode] = useState<'upload' | 'generate'>('upload');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  
  const [newGender, setNewGender] = useState<'male' | 'female'>('male');
  const [newFacialFeatures, setNewFacialFeatures] = useState('');
  const [newSkinTone, setNewSkinTone] = useState('');
  const [newClothingDetails, setNewClothingDetails] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);

  const [specs, setSpecs] = useState<CharacterSpecs>({
    ethnicity: '',
    skinTone: '',
    hairColor: '',
    hairStyle: '',
    hairTexture: 'liso',
    facialHairStyle: 'nenhum',
    facialHairVolume: 'curto',
    facialHairColor: '',
    eyebrowThickness: 'media',
    eyebrowColor: '',
    eyeScleraColor: 'branca',
    eyeIrisColor: '',
    eyeDesign: 'humano',
    lipThickness: 'medianos',
    bodyType: 'mesomorfo',
    muscleDefinition: 'definido',
    heightCm: 175,
    distinguishingMarks: '',
    costume: '',
    artStyle: 'comic',
    artTheme: 'none'
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConcept, setGeneratedConcept] = useState<string | null>(null);
  const [refinementText, setRefinementText] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateConcept = async () => {
    if (!newName) {
        alert("Por favor, dê um nome ao personagem.");
        return;
    }
    setIsGenerating(true);
    try {
        const image = await generateCharacterConcept(newName, newGender, specs);
        setGeneratedConcept(image);
        setNewImage(image); 
        
        onAddToGallery({
            id: crypto.randomUUID(),
            imageUrl: image,
            prompt: `Concept Art: ${newName}`,
            characterIds: [],
            objectIds: [],
            environmentId: null,
            timestamp: Date.now()
        });

        setNewDesc(`${specs.ethnicity}, ${specs.bodyType}, ${specs.hairColor} ${specs.hairStyle} hair. ${specs.costume}.`);
        setNewFacialFeatures(`Eyes: ${specs.eyeIrisColor} (${specs.eyeDesign}). Mouth: ${specs.lipThickness}.`);
        setNewSkinTone(specs.skinTone || "Natural");
        setNewClothingDetails(specs.costume);

    } catch (e) {
        alert("Erro ao gerar conceito.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleRefineConcept = async () => {
    if (!generatedConcept || !refinementText) return;
    setIsRefining(true);
    try {
        const refined = await refineImage(generatedConcept, refinementText, specs.artStyle);
        setGeneratedConcept(refined);
        setNewImage(refined);
        setRefinementText('');
    } catch (e) {
        alert("Erro ao refinar.");
    } finally {
        setIsRefining(false);
    }
  };

  const handleSubmit = () => {
    if (!newName) return;

    const id = crypto.randomUUID();
    
    const commonData = {
      id,
      name: newName,
      description: newDesc,
      modelSheetBase64: newImage,
      gender: activeTab === 'chars' ? newGender : 'male',
      facialFeatures: activeTab === 'chars' ? newFacialFeatures : '',
      skinTone: activeTab === 'chars' ? newSkinTone : '',
      clothingDetails: activeTab === 'chars' ? newClothingDetails : '',
      specs: creationMode === 'generate' ? specs : undefined
    };

    if (activeTab === 'chars') onAddCharacter(commonData as Character);
    else if (activeTab === 'objs') onAddObject(commonData as ComicObject);
    else onAddEnvironment(commonData as Environment);

    resetForm();
  };

  const handleSendToLab = () => {
    handleSubmit(); 
    const tempChar: Character = {
        id: 'temp',
        name: newName,
        description: newDesc,
        gender: newGender,
        facialFeatures: newFacialFeatures,
        skinTone: newSkinTone,
        clothingDetails: newClothingDetails,
        modelSheetBase64: newImage,
        specs: creationMode === 'generate' ? specs : undefined
    };
    onSendToModelLab(tempChar);
    setIsAdding(false);
  };

  const resetForm = () => {
    setNewName('');
    setNewDesc('');
    setNewGender('male');
    setNewFacialFeatures('');
    setNewSkinTone('');
    setNewClothingDetails('');
    setNewImage(null);
    setGeneratedConcept(null);
    setIsAdding(false);
  };

  const getActiveList = () => {
    if (activeTab === 'chars') return characters;
    if (activeTab === 'objs') return objects;
    return environments;
  };

  const isSelected = (id: string) => {
    if (activeTab === 'chars') return selectedCharacterIds.includes(id);
    if (activeTab === 'objs') return selectedObjectIds.includes(id);
    return selectedEnvironmentId === id;
  };

  const handleSelect = (id: string) => {
    if (activeTab === 'chars') onToggleCharacter(id);
    else if (activeTab === 'objs') onToggleObject(id);
    else onSelectEnvironment(selectedEnvironmentId === id ? null : id);
  };

  const handleDelete = (id: string) => {
    if (activeTab === 'chars') onDeleteCharacter(id);
    else if (activeTab === 'objs') onDeleteObject(id);
    else onDeleteEnvironment(id);
  };

  const currentList = getActiveList();

  const getHeaderIcon = () => {
    if (activeTab === 'chars') return <User size={20} className="text-indigo-400" />;
    if (activeTab === 'objs') return <Box size={20} className="text-indigo-400" />;
    return <Mountain size={20} className="text-indigo-400" />;
  };

  const getHeaderTitle = () => {
    if (activeTab === 'chars') return 'Personagens';
    if (activeTab === 'objs') return 'Objetos';
    return 'Cenários';
  };

  return (
    <>
    <div className="bg-slate-900 border-r border-slate-800 w-full md:w-80 flex flex-col h-full z-10">
      <div className="flex flex-col border-b border-slate-800">
        <div className="p-4 pb-2 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {getHeaderIcon()}
            {getHeaderTitle()}
          </h2>
          <button
            onClick={() => setIsAdding(true)}
            className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition"
            title="Adicionar Novo"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex px-4 gap-4 text-sm font-medium overflow-x-auto no-scrollbar">
          <button 
            onClick={() => { setActiveTab('chars'); }}
            className={`pb-2 border-b-2 transition whitespace-nowrap ${activeTab === 'chars' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Personagens
          </button>
          <button 
            onClick={() => { setActiveTab('objs'); }}
            className={`pb-2 border-b-2 transition whitespace-nowrap ${activeTab === 'objs' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Objetos
          </button>
          <button 
            onClick={() => { setActiveTab('envs'); }}
            className={`pb-2 border-b-2 transition whitespace-nowrap ${activeTab === 'envs' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Cenários
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentList.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Info className="mx-auto mb-2 opacity-50" size={24} />
            <p>Nenhum item adicionado.</p>
            <p className="text-xs mt-1">Adicione uma ficha modelo para consistência.</p>
          </div>
        )}

        {currentList.map((item) => {
          const selected = isSelected(item.id);
          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`group relative p-3 rounded-lg border transition cursor-pointer flex gap-3 ${
                selected
                  ? 'bg-indigo-900/30 border-indigo-500/50'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="w-12 h-12 shrink-0 bg-slate-950 rounded overflow-hidden border border-slate-700">
                {item.modelSheetBase64 ? (
                  <img src={item.modelSheetBase64} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    {activeTab === 'chars' && <User size={20} />}
                    {activeTab === 'objs' && <Box size={20} />}
                    {activeTab === 'envs' && <Mountain size={20} />}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className={`font-semibold text-sm truncate ${selected ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {item.name}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
              </div>
              
              {selected && (
                <div className="absolute top-3 right-3 text-indigo-400">
                  <CheckCircle2 size={16} />
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                className="absolute bottom-2 right-2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition z-10 bg-slate-800/80 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>

    {isAdding && (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
                <h2 className="text-2xl font-bold text-white">Criar Novo {activeTab === 'chars' ? 'Personagem' : activeTab === 'objs' ? 'Objeto' : 'Cenário'}</h2>
                <button onClick={resetForm} className="p-2 hover:bg-slate-800 rounded-full"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Nome</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="Ex: Cyber Samurai"
                        />
                    </div>

                    {activeTab === 'chars' && (
                        <div className="flex gap-4 p-1 bg-slate-800 rounded-lg">
                            <button 
                                onClick={() => setCreationMode('upload')}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${creationMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Upload size={16} className="inline mr-2" /> Upload Manual
                            </button>
                            <button 
                                onClick={() => setCreationMode('generate')}
                                className={`flex-1 py-2 rounded-md text-sm font-medium transition ${creationMode === 'generate' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Sparkles size={16} className="inline mr-2" /> Gerador Completo
                            </button>
                        </div>
                    )}

                    {(creationMode === 'upload' || activeTab !== 'chars') && (
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                                <textarea
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 resize-none"
                                    placeholder="Descreva visualmente..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Imagem de Referência</label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-600 rounded-lg h-40 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition"
                                >
                                    {newImage ? (
                                        <img src={newImage} alt="Preview" className="h-full object-contain" />
                                    ) : (
                                        <div className="text-center text-slate-500">
                                            <Upload className="mx-auto mb-2" />
                                            <span>Clique para upload</span>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                                </div>
                            </div>
                        </div>
                    )}

                    {creationMode === 'generate' && activeTab === 'chars' && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Físico</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <select 
                                        value={newGender} 
                                        onChange={(e) => setNewGender(e.target.value as any)}
                                        className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                    >
                                        <option value="male">Masculino</option>
                                        <option value="female">Feminino</option>
                                    </select>
                                    <input type="number" placeholder="Altura (cm)" value={specs.heightCm} onChange={e => setSpecs({...specs, heightCm: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={specs.bodyType} onChange={e => setSpecs({...specs, bodyType: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                        <option value="ectomorfo">Ectomorfo (Magro)</option>
                                        <option value="mesomorfo">Mesomorfo (Atlético)</option>
                                        <option value="endomorfo">Endomorfo (Robusto)</option>
                                    </select>
                                    <select value={specs.muscleDefinition} onChange={e => setSpecs({...specs, muscleDefinition: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                        <option value="definido">Músculos Definidos</option>
                                        <option value="suave">Suave / Sem definição</option>
                                    </select>
                                </div>
                                <input type="text" placeholder="Etnia" value={specs.ethnicity} onChange={e => setSpecs({...specs, ethnicity: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                <input type="text" placeholder="Tom de Pele (ex: Oliva, Pálido, Escuro)" value={specs.skinTone} onChange={e => setSpecs({...specs, skinTone: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Cabelo & Rosto</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="text" placeholder="Cor Cabelo" value={specs.hairColor} onChange={e => setSpecs({...specs, hairColor: e.target.value})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                    <input type="text" placeholder="Estilo Cabelo" value={specs.hairStyle} onChange={e => setSpecs({...specs, hairStyle: e.target.value})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                    <select value={specs.hairTexture} onChange={e => setSpecs({...specs, hairTexture: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                        <option value="liso">Liso</option>
                                        <option value="ondulado">Ondulado</option>
                                        <option value="cacheado">Cacheado</option>
                                        <option value="crespo">Crespo</option>
                                        <option value="careca">Careca</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <select value={specs.facialHairStyle} onChange={e => setSpecs({...specs, facialHairStyle: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                        <option value="nenhum">Sem Barba</option>
                                        <option value="bigode">Bigode</option>
                                        <option value="barba">Barba Cheia</option>
                                        <option value="barba_bigode">Barba & Bigode</option>
                                        <option value="cavanhaque">Cavanhaque</option>
                                    </select>
                                    <input type="text" placeholder="Cor da Barba" value={specs.facialHairColor} onChange={e => setSpecs({...specs, facialHairColor: e.target.value})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="text" placeholder="Cor Iris" value={specs.eyeIrisColor} onChange={e => setSpecs({...specs, eyeIrisColor: e.target.value})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                    <input type="text" placeholder="Cor Esclera" value={specs.eyeScleraColor} onChange={e => setSpecs({...specs, eyeScleraColor: e.target.value})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                    <select value={specs.eyeDesign} onChange={e => setSpecs({...specs, eyeDesign: e.target.value as any})} className="bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                        <option value="humano">Humano</option>
                                        <option value="gato">Gato</option>
                                        <option value="cybernetico">Cyber</option>
                                        <option value="vazio">Vazio (Branco)</option>
                                        <option value="anime">Anime (Grande)</option>
                                    </select>
                                </div>
                                <select value={specs.lipThickness} onChange={e => setSpecs({...specs, lipThickness: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                    <option value="finos">Lábios Finos</option>
                                    <option value="medianos">Lábios Medianos</option>
                                    <option value="grossos">Lábios Grossos</option>
                                </select>
                            </div>

                             <div className="space-y-3">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Detalhes Visuais</h3>
                                <input type="text" placeholder="Marcas, Cicatrizes ou Tatuagens" value={specs.distinguishingMarks} onChange={e => setSpecs({...specs, distinguishingMarks: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"/>
                                <textarea placeholder="Descreva o figurino / traje aqui..." value={specs.costume} onChange={e => setSpecs({...specs, costume: e.target.value})} className="w-full h-20 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white resize-none"/>
                            </div>
                            
                             <div className="space-y-3">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Estilo & Universo</h3>
                                <div className="grid grid-cols-2 gap-3">
                                     <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1"><Palette size={10}/> Estúdio Estilo</label>
                                        <select value={specs.artStyle} onChange={e => setSpecs({...specs, artStyle: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
                                            <option value="comic">Digital Comic</option>
                                            <option value="anime">Anime Moderno</option>
                                            <option value="retro_anime">Anime 90s</option>
                                            <option value="manga">Mangá (P&B)</option>
                                            <option value="realistic">Realista (8K)</option>
                                            <option value="cartoon">Cartoon</option>
                                        </select>
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1"><MapPin size={10}/> Temática</label>
                                        <select value={specs.artTheme} onChange={e => setSpecs({...specs, artTheme: e.target.value as any})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white">
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

                             <button 
                                onClick={handleGenerateConcept}
                                disabled={isGenerating}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                             >
                                {isGenerating ? <Sparkles className="animate-spin" /> : <Wand2 />}
                                {isGenerating ? 'Gerando Conceito...' : 'Gerar Personagem'}
                             </button>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4">Pré-visualização</h3>
                    
                    <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center relative overflow-hidden min-h-[400px]">
                        {newImage ? (
                            <img src={newImage} alt="Character Concept" className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-slate-600 text-center">
                                <User size={64} className="mx-auto mb-2 opacity-20" />
                                <p>A imagem do personagem aparecerá aqui</p>
                            </div>
                        )}
                    </div>

                    {creationMode === 'generate' && generatedConcept && (
                        <div className="mt-4 flex gap-2">
                             <input 
                                type="text"
                                placeholder="Refinar (ex: deixar cabelo mais curto...)"
                                value={refinementText}
                                onChange={(e) => setRefinementText(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                             />
                             <button 
                                onClick={handleRefineConcept}
                                disabled={isRefining || !refinementText}
                                className="px-4 bg-indigo-600 rounded text-white disabled:bg-slate-700 transition"
                             >
                                {isRefining ? <RefreshCw className="animate-spin" size={18} /> : 'Refinar'}
                             </button>
                        </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3">
                         <div className="flex gap-3">
                            <button
                                onClick={handleSubmit}
                                disabled={!newImage}
                                className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition"
                            >
                                <Save size={20} /> Salvar Personagem
                            </button>
                            {creationMode === 'generate' && newImage && (
                                <button
                                    onClick={handleGenerateConcept}
                                    className="px-4 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
                                    title="Gerar Novamente"
                                >
                                    <RefreshCcw size={20} />
                                </button>
                            )}
                         </div>

                         {activeTab === 'chars' && newImage && (
                            <button
                                onClick={handleSendToLab}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition"
                            >
                                <ArrowRight size={20} /> Usar no Laboratório de Modelos
                            </button>
                         )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    )}
    </>
  );
};