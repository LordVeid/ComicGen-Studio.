
import React, { useState } from 'react';
import { GeneratedPanel, DriveConfig } from '../types';
import { Download, Trash2, Calendar, Image as ImageIcon, Cloud, CloudOff, Link, Settings, CheckCircle, AlertCircle, Loader2, Edit2, User } from 'lucide-react';
import { getFolderId, createFolder } from '../services/driveService';

interface GalleryProps {
  panels: GeneratedPanel[];
  onDeletePanel: (id: string) => void;
  onEditInStudio: (panel: GeneratedPanel) => void;
  driveConfig: DriveConfig;
  onUpdateDriveConfig: (config: Partial<DriveConfig>) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ panels, onDeletePanel, onEditInStudio, driveConfig, onUpdateDriveConfig }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const handleConnectDrive = () => {
    if (!driveConfig.clientId) {
      alert("Por favor, configure o seu Google Client ID nas configurações da nuvem primeiro.");
      setShowConfig(true);
      return;
    }

    setIsConnecting(true);
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: driveConfig.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: async (response: any) => {
        if (response.error) {
          setIsConnecting(false);
          return;
        }

        try {
          const accessToken = response.access_token;
          
          const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const profileData = await profileResponse.json();

          let folderId = await getFolderId(accessToken);
          if (!folderId) {
            folderId = await createFolder(accessToken);
          }
          
          onUpdateDriveConfig({
            accessToken,
            folderId,
            isEnabled: true,
            user: {
              name: profileData.name,
              email: profileData.email,
              picture: profileData.picture
            }
          });
        } catch (e) {
          console.error("Erro ao conectar com Google", e);
        } finally {
          setIsConnecting(false);
        }
      }
    });
    client.requestAccessToken();
  };

  const handleDisconnect = () => {
    onUpdateDriveConfig({
      accessToken: null,
      folderId: null,
      isEnabled: false,
      user: undefined
    });
  };

  if (panels.length === 0 && !driveConfig.isEnabled) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-950 p-6">
        <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mb-4">
          <ImageIcon size={48} className="opacity-50" />
        </div>
        <h2 className="text-xl font-bold text-slate-400 mb-2">Galeria Vazia</h2>
        <p className="mb-6">Suas artes geradas aparecerão aqui.</p>
        <button 
          onClick={handleConnectDrive}
          className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 font-bold rounded-lg transition-all"
        >
          <User size={20} /> Entrar com Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <ImageIcon className="text-indigo-400" />
              Galeria de Artes ({panels.length})
            </h2>
            <p className="text-slate-400">
              Gerencie, baixe ou edite suas criações. Sincronização automática ativa se logado.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${driveConfig.isEnabled ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${driveConfig.isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                  {driveConfig.isEnabled ? <Cloud size={20} /> : <CloudOff size={20} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Cloud Sync (Google Drive)</div>
                  <div className="text-[10px] text-slate-400">
                    {driveConfig.isEnabled ? `Conectado como ${driveConfig.user?.name}` : 'Backup automático desativado'}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                  title="Configurações de Nuvem"
                >
                  <Settings size={18} />
                </button>
                {driveConfig.isEnabled ? (
                  <button 
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-red-900/30 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold hover:bg-red-900/50 transition-all"
                  >
                    Logout
                  </button>
                ) : (
                  <button 
                    onClick={handleConnectDrive}
                    disabled={isConnecting}
                    className="px-3 py-1.5 bg-white text-slate-950 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    {isConnecting ? <Loader2 className="animate-spin" size={14} /> : <Link size={14} />}
                    Login
                  </button>
                )}
              </div>
            </div>

            {showConfig && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-200">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configuração de Credenciais</div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400">OAuth Client ID</label>
                  <input 
                    type="text"
                    value={driveConfig.clientId}
                    onChange={(e) => onUpdateDriveConfig({ clientId: e.target.value })}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="p-2 bg-indigo-950/20 rounded border border-indigo-900/30 text-[10px] text-indigo-300 leading-relaxed">
                  <AlertCircle size={12} className="inline mr-1 mb-0.5" />
                  Necessário para habilitar o login e salvamento automático. Adicione este domínio aos origens autorizados no console da Google.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {panels.map((panel) => (
            <div key={panel.id} className="group bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg hover:border-indigo-500 transition-all">
              {/* Image Preview */}
              <div 
                className="aspect-square w-full overflow-hidden bg-slate-950 relative cursor-pointer"
                onClick={() => {
                   const win = window.open();
                   win?.document.write(`<img src="${panel.imageUrl}" style="max-width:100%"/>`);
                }}
              >
                <img 
                  src={panel.imageUrl} 
                  alt="Generated Art" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                />
                
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       onEditInStudio(panel);
                     }}
                     className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full backdrop-blur-md transition-colors"
                     title="Editar no Estúdio"
                   >
                     <Edit2 size={24} />
                   </button>
                   <a 
                     href={panel.imageUrl} 
                     download={`comic-art-${panel.timestamp}.png`}
                     className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors"
                     onClick={(e) => e.stopPropagation()}
                     title="Baixar Imagem"
                   >
                     <Download size={24} />
                   </a>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       if(confirm('Tem certeza que deseja excluir esta imagem?')) {
                         onDeletePanel(panel.id);
                       }
                     }}
                     className="p-3 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-colors"
                     title="Excluir"
                   >
                     <Trash2 size={24} />
                   </button>
                </div>

                {panel.isSyncedWithDrive && (
                  <div className="absolute top-2 left-2 p-1.5 bg-green-500/80 backdrop-blur rounded-lg text-white" title="Sincronizado com Drive">
                    <CheckCircle size={14} />
                  </div>
                )}
              </div>

              {/* Info Footer */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span>{new Date(panel.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 line-clamp-2" title={panel.prompt}>
                  {panel.prompt}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};