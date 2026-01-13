

export interface Character {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female';
  facialFeatures: string;
  skinTone: string;
  clothingDetails: string;
  modelSheetBase64: string | null;
  // Metadata for the creator form retrieval if needed
  specs?: CharacterSpecs;
}

export interface CharacterSpecs {
  ethnicity: string;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  hairTexture: 'liso' | 'ondulado' | 'cacheado' | 'crespo' | 'careca';
  facialHairStyle: 'nenhum' | 'bigode' | 'barba' | 'barba_bigode' | 'cavanhaque';
  facialHairVolume: 'curto' | 'medio' | 'grande';
  facialHairColor: string;
  eyebrowThickness: 'fina' | 'media' | 'grossa';
  eyebrowColor: string;
  eyeScleraColor: string;
  eyeIrisColor: string;
  eyeDesign: 'humano' | 'gato' | 'cybernetico' | 'vazio' | 'espiral' | 'anime';
  lipThickness: 'finos' | 'medianos' | 'grossos';
  bodyType: 'ectomorfo' | 'mesomorfo' | 'endomorfo';
  muscleDefinition: 'definido' | 'suave';
  heightCm: number;
  distinguishingMarks: string; // Tattoos, scars
  costume: string;
  artStyle: ArtStyle;
  artTheme: ArtTheme;
}

export interface ComicObject {
  id: string;
  name: string;
  description: string;
  modelSheetBase64: string | null;
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  modelSheetBase64: string | null;
}

export interface GeneratedPanel {
  id: string;
  imageUrl: string;
  prompt: string;
  characterIds: string[];
  objectIds: string[];
  environmentId: string | null;
  timestamp: number;
  driveFileId?: string;
  isSyncedWithDrive?: boolean;
}

export type ArtStyle = 'comic' | 'anime' | 'manga' | 'cartoon' | 'realistic' | 'retro_anime';

export type ArtTheme = 'none' | 'steampunk' | 'cyberpunk' | 'medieval' | 'modern' | 'feudal' | 'scifi' | 'noir' | 'fantasy';

export interface GenerationRequest {
  characterIds: string[];
  objectIds: string[];
  environmentId: string | null;
  useObject: boolean;
  useEnvironment: boolean;
  transparentBackground: boolean;
  poseDescription: string;
  backgroundDescription: string;
  compositionDescription: string;
  negativePrompt: string;
  cameraAngle: string;
  aspectRatio: "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
  artStyle: ArtStyle;
  artTheme: ArtTheme; 
  enhancePose: boolean;
  enhanceBackground: boolean;
  enhanceComposition: boolean;
}

export interface ScriptPanelData {
  id: string;
  panelNumber: number;
  description: string;
  suggestedCamera: string;
  selectedCamera?: string; 
  charactersPresent: string[]; 
  
  activeCharacterIds?: string[]; 
  activeObjectIds?: string[];
  activeEnvironmentId?: string | null;
  usePreviousPanelReference?: boolean; 

  status: 'pending' | 'generating' | 'done' | 'error';
  
  imageHistory: string[]; 
  currentHistoryIndex: number; 
  rating: number | null; // Changed from feedback to rating (1-5)
  
  imageUrl?: string; 
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export interface DriveConfig {
  accessToken: string | null;
  folderId: string | null;
  isEnabled: boolean;
  clientId: string;
  user?: GoogleUser;
}

export interface StudioState {
  pose: string;
  background: string;
  composition: string;
  negativePrompt: string;
  cameraAngle: string;
  artStyle: ArtStyle;
  artTheme: ArtTheme;
  aspectRatio: "1:1" | "16:9" | "9:16" | "3:4" | "4:3";
  useObject: boolean;
  useEnvironment: boolean;
  transparentBackground: boolean;
  enhancePose: boolean;
  enhanceBackground: boolean;
  enhanceComposition: boolean;
  lastGeneratedImage: string | null;
  currentRating: number | null;
  driveConfig: DriveConfig;
}

// ModelLabState interface used for persisting state in the Model Creator lab
export interface ModelLabState {
  step: number;
  type: 'character' | 'object' | 'environment';
  uploadedImage: string | null;
  name: string;
  description: string;
  gender: 'male' | 'female';
  facialFeatures: string;
  skinTone: string;
  clothingDetails: string;
  artStyle: ArtStyle;
  artTheme: ArtTheme;
  generatedModelSheet: string | null;
}
