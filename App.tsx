
import React, { useState, useEffect, useCallback } from 'react';
import { CharacterManager } from './components/CharacterManager';
import { PanelGenerator } from './components/PanelGenerator';
import { ModelCreator } from './components/ModelCreator';
import { Gallery } from './components/Gallery';
import { ScriptToPanels } from './components/ScriptToPanels';
import { Character, ComicObject, Environment, GeneratedPanel, ScriptPanelData, ModelLabState, StudioState, ArtStyle, ArtTheme, DriveConfig, GoogleUser } from './types';
import { BookOpen, Palette, Wand2, Image as ImageIcon, LockKeyhole, FileText, LogOut, User as UserIcon, CheckCircle2, Loader2, AlertCircle, Key } from 'lucide-react';
import { uploadImageToDrive, getFolderId, createFolder } from './services/driveService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
    google?: any;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<'studio' | 'model-lab' | 'gallery' | 'script'>('studio');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [objects, setObjects] = useState<ComicObject[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [panels, setPanels] = useState<GeneratedPanel[]>([]);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [syncQueue, setSyncQueue] = useState<string[]>([]); // Tracking IDs being synced
  
  // --- PERSISTENT STATE ---
  
  // Script Mode State
  const [scriptText, setScriptText] = useState('');
  const [scriptPanels, setScriptPanels] = useState<ScriptPanelData[]>([]);

  // Model Lab State
  const [modelLabState, setModelLabState] = useState<ModelLabState>({
    step: 1,
    type: 'character',
    uploadedImage: null,
    name: '',
    description: '',
    gender: 'male',
    facialFeatures: '',
    skinTone: '',
    clothingDetails: '',
    artStyle: 'comic',
    artTheme: 'none',
    generatedModelSheet: null
  });

  // Studio State
  const [studioState, setStudioState] = useState<StudioState>(() => {
    const saved = localStorage.getItem('comicgen_studio_state');
    const defaultState: StudioState = {
      pose: '',
      background: '',
      composition: '',
      negativePrompt: '',
      cameraAngle: 'front',
      artStyle: 'comic',
      artTheme: 'none',
      aspectRatio: '1:1',
      useObject: true,
      useEnvironment: true,
      transparentBackground: false,
      enhancePose: false,
      enhanceBackground: false,
      enhanceComposition: false,
      lastGeneratedImage: null,
      currentRating: null,
      driveConfig: {
        accessToken: null,
        folderId: null,
        isEnabled: false,
        clientId: localStorage.getItem('comicgen_drive_client_id') || '' 
      }
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed, lastGeneratedImage: null, currentRating: null, driveConfig: { ...defaultState.driveConfig, clientId: localStorage.getItem('comicgen_drive_client_id') || '' } };
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem('comicgen_studio_state', JSON.stringify(studioState));
    if (studioState.driveConfig.clientId) {
      localStorage.setItem('comicgen_drive_client_id', studioState.driveConfig.clientId);
    }
  }, [studioState]);

  // API Key Check States
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  
  // Selection States
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);

  const checkKey = useCallback(async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    } catch (error) {
      console.error("Error checking API key:", error);
      setHasApiKey(true); 
    } finally {
      setIsCheckingKey(false);
    }
  }, []);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.message?.includes("API_KEY_NOT_FOUND") || event.error?.message?.includes("API_KEY_NOT_FOUND")) {
        setHasApiKey(false);
      }
    };
    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Failed to select key:", e);
      }
    }
  };

  const addCharacter = (char: Character) => {
    setCharacters(prev => [...prev, char]);
    if (activeView === 'studio') setSelectedCharacterIds(prev => [...prev, char.id]);
  };

  const deleteCharacter = (id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
    setSelectedCharacterIds(prev => prev.filter(charId => charId !== id));
  };

  const toggleCharacterSelection = (id: string) => {
    setSelectedCharacterIds(prev => prev.includes(id) ? prev.filter(charId => charId !== id) : [...prev, id]);
  };

  const addObject = (obj: ComicObject) => {
    setObjects(prev => [...prev, obj]);
    if (activeView === 'studio') setSelectedObjectIds(prev => [...prev, obj.id]);
  };

  const deleteObject = (id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    setSelectedObjectIds(prev => prev.filter(objId => objId !== id));
  };

  const toggleObjectSelection = (id: string) => {
    setSelectedObjectIds(prev => prev.includes(id) ? prev.filter(objId => objId !== id) : [...prev, id]);
  };

  const addEnvironment = (env: Environment) => {
    setEnvironments(prev => [...prev, env]);
    setSelectedEnvironmentId(env.id);
  };

  const deleteEnvironment = (id: string) => {
    setEnvironments(prev => prev.filter(e => e.id !== id));
    if (selectedEnvironmentId === id) setSelectedEnvironmentId(null);
  };

  const addPanel = async (panel: GeneratedPanel) => {
    setPanels(prev => [panel, ...prev]);

    const config = studioState.driveConfig;
    if (config.isEnabled && config.accessToken && config.folderId) {
      setSyncQueue(prev => [...prev, panel.id]);
      try {
        const timestamp = new Date(panel.timestamp).toISOString().replace(/[:.]/g, '-');
        const filename = `ComicGen_${timestamp}.png`;
        const driveFileId = await uploadImageToDrive(config.accessToken, config.folderId, panel.imageUrl, filename);
        setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, driveFileId, isSyncedWithDrive: true } : p));
      } catch (e) {
        console.error("Falha ao salvar no Google Drive:", e);
      } finally {
        setSyncQueue(prev => prev.filter(id => id !== panel.id));
      }
    }
  };

  const deletePanel = (id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
  };

  const handleSendToModelLab = (char: Character) => {
    setActiveView('model-lab');
    setModelLabState(prev => ({
      ...prev,
      type: 'character',
      uploadedImage: char.modelSheetBase64,
      name: char.name,
      description: char.description,
      gender: char.gender,
      facialFeatures: char.facialFeatures,
      skinTone: char.skinTone,
      clothingDetails: char.clothingDetails,
      artStyle: char.specs?.artStyle || 'comic',
      artTheme: char.specs?.artTheme || 'none',
      step: 1
    }));
  };

  const handleEditInStudio = (panel: GeneratedPanel) => {
    setStudioState(prev => ({ ...prev, lastGeneratedImage: panel.imageUrl, currentRating: null }));
    if (panel.characterIds) setSelectedCharacterIds(panel.characterIds.filter(id => characters.some(c => c.id === id)));
    if (panel.objectIds) setSelectedObjectIds(panel.objectIds.filter(id => objects.some(o => o.id === id)));
    if (panel.environmentId && environments.some(e => e.id === panel.environmentId)) setSelectedEnvironmentId(panel.environmentId);
    setActiveView('studio');
  };

  const updateDriveConfig = (partial: Partial<DriveConfig>) => {
    setStudioState(prev => ({
      ...prev,
      driveConfig: { ...prev.driveConfig, ...partial }
    }));
  };

  const handleGoogleLogin = () => {
    if (!studioState.driveConfig.clientId) {
      alert("Por favor, configure o Google Client ID na Galeria > Configurações da Nuvem para ativar a sincronização com Drive.");
      setActiveView('gallery');
      return;
    }

    setIsConnectingDrive(true);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: studioState.driveConfig.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            setIsConnectingDrive(false);
            return;
          }
          
          const accessToken = response.access_token;
          
          try {
            // Fetch profile info
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const profileData = await profileResponse.json();
            
            const user: GoogleUser = {
              name: profileData.name,
              email: profileData.email,
              picture: profileData.picture
            };

            let folderId = await getFolderId(accessToken);
            if (!folderId) folderId = await createFolder(accessToken);
            
            updateDriveConfig({ accessToken, folderId, isEnabled: true, user });
          } catch (e) {
            console.error("Erro ao recuperar perfil do Google:", e);
          } finally {
            setIsConnectingDrive(false);
          }
        }
      });
      client.requestAccessToken();
    } catch (e) {
      console.error(e);
      setIsConnectingDrive(false);
    }
  };

  const handleLogout = () => {
    updateDriveConfig({ accessToken: null, folderId: null, isEnabled: false, user: undefined });
  };

  if (isCheckingKey) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!hasApiKey) {
    return (
       <div className="flex h-screen w-screen bg-slate-950 items-center justify-center p-4">
         <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <LockKeyhole className="text-indigo-400" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Acesso à API Necessário</h2>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Para utilizar os recursos de geração de imagem (Gemini 3 Pro), você precisa inserir ou selecionar sua própria <strong>Chave de API</strong> de um projeto pago (Billing habilitado).
            </p>
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Key size={20} /> Inserir / Selecionar Chave
            </button>
            <div className="mt-6 pt-6 border-t border-slate-800">
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                Como obter uma chave de API paga?
              </a>
            </div>
         </div>
       </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {activeView === 'studio' && (
        <CharacterManager
          characters={characters} objects={objects} environments={environments}
          onAddCharacter={addCharacter} onDeleteCharacter={deleteCharacter}
          onAddObject={addObject} onDeleteObject={deleteObject}
          onAddEnvironment={addEnvironment} onDeleteEnvironment={deleteEnvironment}
          selectedCharacterIds={selectedCharacterIds} onToggleCharacter={toggleCharacterSelection}
          selectedObjectIds={selectedObjectIds} onToggleObject={toggleObjectSelection}
          selectedEnvironmentId={selectedEnvironmentId} onSelectEnvironment={setSelectedEnvironmentId}
          onAddToGallery={addPanel} onSendToModelLab={handleSendToModelLab}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="text-indigo-500" />
            <h1 className="text-xl font-bold tracking-tight text-white">ComicGen <span className="text-indigo-400">Studio</span></h1>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg">
             <button onClick={() => setActiveView('studio')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeView === 'studio' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Palette size={14} /> Estúdio</button>
             <button onClick={() => setActiveView('script')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeView === 'script' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><FileText size={14} /> Roteiro</button>
             <button onClick={() => setActiveView('model-lab')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeView === 'model-lab' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Wand2 size={14} /> Laboratório</button>
             <button onClick={() => setActiveView('gallery')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeView === 'gallery' ? 'bg-green-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><ImageIcon size={14} /> Galeria</button>
          </div>

          <div className="flex items-center gap-4">
            {syncQueue.length > 0 && (
              <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase">Sincronizando...</span>
              </div>
            )}

            <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
              <button 
                onClick={handleSelectKey}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 px-3 py-1.5 rounded-full text-[10px] text-indigo-400 font-bold transition-all"
                title="Inserir ou Alterar sua própria Chave de API"
              >
                <Key size={12} />
                Chave API
              </button>
            </div>

            {studioState.driveConfig.user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-bold text-white leading-none mb-1">{studioState.driveConfig.user.name}</div>
                  <div className="text-[10px] text-green-400 flex items-center justify-end gap-1 font-medium leading-none">
                    <CheckCircle2 size={10} /> Cloud Sync ON
                  </div>
                </div>
                <div className="group relative">
                  <img 
                    src={studioState.driveConfig.user.picture} 
                    alt="User" 
                    className="w-8 h-8 rounded-full border border-slate-700 cursor-pointer hover:border-indigo-500 transition-all" 
                  />
                  <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 min-w-[120px]">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-slate-800 rounded transition-colors"
                    >
                      <LogOut size={14} /> Sair do Google
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                disabled={isConnectingDrive}
                className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
              >
                {isConnectingDrive ? <Loader2 className="animate-spin" size={14} /> : (
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 2.332c.708-2.127 2.692-3.714 5.036-3.714z" fill="#EA4335"/><path d="M0 0h18v18H0z" fill="none"/></svg>
                )}
                Entrar com Google
              </button>
            )}
          </div>
        </header>
        
        <main className="flex-1 flex overflow-hidden">
          {activeView === 'studio' && (
            <PanelGenerator
              characters={characters} objects={objects} environments={environments}
              selectedCharacterIds={selectedCharacterIds} selectedObjectIds={selectedObjectIds} selectedEnvironmentId={selectedEnvironmentId}
              onPanelGenerated={addPanel} state={studioState} setState={setStudioState}
            />
          )}
          {activeView === 'script' && (
            <ScriptToPanels 
              characters={characters} objects={objects} environments={environments} onPanelGenerated={addPanel}
              script={scriptText} setScript={setScriptText} panels={scriptPanels} setPanels={setScriptPanels}
            />
          )}
          {activeView === 'model-lab' && (
            <ModelCreator 
              onSaveCharacter={(char) => { addCharacter(char); setActiveView('studio'); }}
              onSaveObject={(obj) => { addObject(obj); setActiveView('studio'); }}
              onSaveEnvironment={(env) => { addEnvironment(env); setActiveView('studio'); }}
              onAddToGallery={addPanel} state={modelLabState} setState={setModelLabState}
            />
          )}
          {activeView === 'gallery' && (
            <Gallery 
              panels={panels} onDeletePanel={deletePanel} onEditInStudio={handleEditInStudio} 
              driveConfig={studioState.driveConfig} onUpdateDriveConfig={updateDriveConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}
