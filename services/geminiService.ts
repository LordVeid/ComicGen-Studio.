import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Character, ComicObject, Environment, GenerationRequest, ArtStyle, ScriptPanelData, ArtTheme, CharacterSpecs } from "../types";

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Helper function to retry operations with exponential backoff
 */
const retryWithBackoff = async <T>(
  operation: () => Promise<T>, 
  retries = 5, 
  delay = 1000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const errorCode = error?.status || error?.code || error?.error?.code || error?.error?.status;
    const errorMessage = error?.message || error?.error?.message || JSON.stringify(error);
    
    if (errorMessage.includes("Requested entity was not found") || errorCode === 404) {
      throw new Error("API_KEY_NOT_FOUND");
    }

    const isOverloaded = 
      errorCode === 503 || 
      errorCode === 429 || 
      errorCode === 500 || 
      (typeof errorMessage === 'string' && (
        errorMessage.toLowerCase().includes('overloaded') || 
        errorMessage.toLowerCase().includes('unavailable') ||
        errorMessage.toLowerCase().includes('resource exhausted')
      ));
      
    if (retries > 0 && isOverloaded) {
      console.warn(`Gemini API Busy (Code: ${errorCode}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

const getStylePrompt = (style: ArtStyle): string => {
  const prompts: Record<ArtStyle, string> = {
    'comic': 'Style: Modern Western Digital Comic Book Art. Bold ink lines, deep shadows, dynamic shading, vibrant colors, superhero comic aesthetic, high detail.',
    'anime': 'Style: High-Quality Modern Anime. Clean thin lines, sophisticated cell-shading, highly detailed expressive eyes, vibrant and cinematic lighting.',
    'manga': 'Style: Japanese Manga Masterpiece. Black and white ink only. Use screentones for shading. High contrast, dynamic speed lines, professional ink pen aesthetic.',
    'cartoon': 'Style: Modern Western Animation. Expressive features, slightly exaggerated proportions, bold flat colors, clean lines, lively vibe.',
    'realistic': 'Style: Photorealistic Concept Art. Cinematic lighting, 8k resolution, Unreal Engine 5 render style, highly detailed textures.',
    'retro_anime': 'Style: High-quality 1990s Retro Anime (OVA and Movie style). Clean, sharp ink lines. Vibrant blue skies with massive, fluffy cumulonimbus clouds. Painterly, detailed watercolor backgrounds (Ghibli-inspired). Character designs with expressive large eyes and soft features. Warm, nostalgic cinematic lighting. Classic hand-painted cel animation aesthetic.'
  };
  return prompts[style] || prompts['comic'];
};

const getThemePrompt = (theme: ArtTheme): string => {
  const prompts: Record<ArtTheme, string> = {
    'none': '',
    'steampunk': 'THEME: STEAMPUNK. Brass gears, copper pipes, steam-powered, victorian fashion with goggles, bronze tones.',
    'cyberpunk': 'THEME: CYBERPUNK. High-tech low-life, neon lights, holographic ads, cybernetic implants, rainy dystopian city.',
    'medieval': 'THEME: MEDIEVAL FANTASY. Stone castles, iron armor, rustic villages, swords, shields, magical atmosphere.',
    'feudal': 'THEME: FEUDAL JAPAN. Samurai armor, katanas, cherry blossoms, lanterns, traditional architecture.',
    'modern': 'THEME: MODERN DAY. Contemporary clothing, smartphones, modern city, cars, office buildings.',
    'scifi': 'THEME: SCI-FI SPACE OPERA. Spaceships, laser weapons, alien planets, starfields, sleek uniforms.',
    'noir': 'THEME: FILM NOIR. High contrast black and white, dramatic shadows, detectives, fedoras, rain, smoke.',
    'fantasy': 'THEME: HIGH FANTASY. Magic effects, glowing runes, mythical creatures, enchanted forests.'
  };
  return prompts[theme] || '';
};

// --- RANDOM SCRIPT GENERATOR ---
export const generateRandomScriptFromAssets = async (
  characters: Character[],
  objects: ComicObject[],
  environments: Environment[]
): Promise<string> => {
  const ai = getClient();
  
  const charContext = characters.map(c => `@${c.name} (${c.description})`).join(", ");
  const objContext = objects.map(o => `@${o.name} (${o.description})`).join(", ");
  const envContext = environments.map(e => `@${e.name} (${e.description})`).join(", ");

  const prompt = `
    Create a 3 to 5 sentence comic book scene script. 
    You MUST use these existing assets in the story by tagging them with '@' followed by their name exactly.
    Characters: ${charContext || "None"}
    Objects: ${objContext || "None"}
    Environments: ${envContext || "None"}

    The script should be dramatic, focus on visual actions, and be written in Portuguese.
    Only return the script text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] }
    });
    return response.text || "";
  } catch (e) {
    throw new Error("Failed to generate random script.");
  }
};

// --- RANDOM IDEA GENERATOR ---
export const generateRandomIdea = async (type: 'character' | 'object' | 'environment'): Promise<any> => {
  const ai = getClient();
  const prompt = `Generate a technical random ${type} design specification for a comic book. 
  The description MUST be optimized for an AI image generator, focusing on:
  - Silhouettes and body type
  - Textures and materials
  - Color palette
  - Specific architectural or clothing details
  - Unique distinguishing features
  
  Return strictly JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: prompt }] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          gender: { type: Type.STRING, description: "Only for characters: 'male' or 'female'" },
          facialFeatures: { type: Type.STRING, description: "Only for characters" },
          skinTone: { type: Type.STRING, description: "Only for characters" },
          clothingDetails: { type: Type.STRING, description: "Only for characters or object appearance" },
          artStyle: { type: Type.STRING, description: "One of: comic, anime, manga, cartoon, realistic, retro_anime" },
          artTheme: { type: Type.STRING, description: "One of: none, steampunk, cyberpunk, medieval, modern, feudal, scifi, noir, fantasy" }
        },
        required: ["name", "description", "artStyle", "artTheme"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

// --- CONCEPT IMAGE GENERATOR (From Description) ---
export const generateConceptImage = async (description: string, style: ArtStyle, theme: ArtTheme): Promise<string> => {
  const ai = getClient();
  const prompt = `Full body concept art of: ${description}. 
  Style: ${getStylePrompt(style)} 
  Theme: ${getThemePrompt(theme)}
  Background: Solid neutral gray. High quality, professional character design.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: { aspectRatio: '3:4', imageSize: '1K' }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Failed to generate concept image.");
};

export const parseScript = async (
  scriptText: string, 
  availableCharacters: Character[]
): Promise<ScriptPanelData[]> => {
  const ai = getClient();
  const charList = availableCharacters.map(c => `${c.name} (${c.gender}, ${c.description})`).join(', ');

  const prompt = `
    Analyze this script and break it into sequential comic panels.
    Cast: ${charList || "None defined"}
    For each panel, provide: visual description, camera angle, and present characters.
    Return strictly JSON.
  `;

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: prompt + `\n\nSCRIPT:\n${scriptText}` }]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              panel_number: { type: Type.INTEGER },
              visual_description: { type: Type.STRING },
              suggested_camera_angle: { type: Type.STRING },
              characters_in_scene: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["panel_number", "visual_description", "suggested_camera_angle"]
          }
        }
      }
    }));

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any) => ({
      id: crypto.randomUUID(),
      panelNumber: item.panel_number,
      description: item.visual_description,
      suggestedCamera: item.suggested_camera_angle,
      charactersPresent: item.characters_in_scene || [],
      status: 'pending',
      imageHistory: [],
      currentHistoryIndex: -1,
      rating: null,
      usePreviousPanelReference: false
    }));
  } catch (error) {
    throw new Error("Failed to parse script.");
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  if (!originalPrompt || originalPrompt.trim() === "") return "";
  const ai = getClient();
  const instruction = `Expand the following into a detailed comic art prompt. Focus on visuals, lighting, and action. Output ONLY the string: "${originalPrompt}"`;
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: instruction }] }
    }));
    return response.text || originalPrompt;
  } catch (e) {
    return originalPrompt;
  }
};

export const analyzeImageForDescription = async (base64Image: string): Promise<{ description: string; facialFeatures: string; skinTone: string; clothingDetails: string }> => {
  const ai = getClient();
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.split(';')[0].split(':')[1];
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: "Analyze this character image for visual consistency (face, skin, clothing)." },
          { inlineData: { data: base64Data, mimeType: mimeType } }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            facialFeatures: { type: Type.STRING },
            skinTone: { type: Type.STRING },
            clothingDetails: { type: Type.STRING },
          },
          required: ["description", "facialFeatures", "skinTone", "clothingDetails"]
        }
      }
    }));
    const data = JSON.parse(response.text || "{}");
    return {
      description: data.description || "",
      facialFeatures: data.facialFeatures || "",
      skinTone: data.skinTone || "",
      clothingDetails: data.clothingDetails || ""
    };
  } catch (e) {
    return { description: "Analysis failed", facialFeatures: "", skinTone: "", clothingDetails: "" };
  }
};

export const generateCharacterConcept = async (name: string, gender: string, specs: CharacterSpecs): Promise<string> => {
    const ai = getClient();
    const prompt = `Create character concept art for ${name} (${gender}). Specs: ${specs.ethnicity}, ${specs.bodyType}, ${specs.hairColor}, ${specs.costume}. Background: Solid white. Style: ${getStylePrompt(specs.artStyle)}. Theme: ${getThemePrompt(specs.artTheme)}.`;
    try {
      const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', 
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: '3:4', imageSize: '2K' } }
      }));
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      throw new Error("No image generated.");
    } catch (e) { throw e; }
};

export const generateModelSheet = async (base64Image: string, description: string, type: string, gender?: 'male' | 'female', artStyle: ArtStyle = 'comic', artTheme: ArtTheme = 'none'): Promise<string> => {
  const ai = getClient();
  const prompt = `Create a professional ${type} model sheet turnaround (front, side, back) for: ${description}. Style: ${getStylePrompt(artStyle)}. Theme: ${getThemePrompt(artTheme)}.`;
  const base64Data = base64Image.split(',')[1];
  const mimeType = base64Image.split(';')[0].split(':')[1];
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview', 
        contents: { parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType: mimeType } }] },
        config: { imageConfig: { aspectRatio: '16:9', imageSize: '2K' } }
    }));
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (e) { throw e; }
};

export const refineImage = async (originalImageBase64: string, refinementPrompt: string, artStyle: ArtStyle): Promise<string> => {
  const ai = getClient();
  const prompt = `Edit this image based on: ${refinementPrompt}. Style: ${getStylePrompt(artStyle)}.`;
  const base64Data = originalImageBase64.split(',')[1];
  const mimeType = originalImageBase64.split(';')[0].split(':')[1];
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType: mimeType } }] },
        config: { imageConfig: { imageSize: '2K' } }
    }));
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (e) { throw e; }
};

export const generateComicPanel = async (
  request: GenerationRequest,
  characters: Character[],
  comicObjects: ComicObject[],
  environment: Environment | undefined,
  previousPanelImage?: string,
  styleReferences?: string[],
  userFeedbackRating?: number | null
): Promise<string> => {
  const ai = getClient();
  
  const [enhancedPose, enhancedBackground, enhancedComposition] = await Promise.all([
    request.enhancePose ? enhancePrompt(request.poseDescription) : Promise.resolve(request.poseDescription),
    request.enhanceBackground ? enhancePrompt(request.backgroundDescription) : Promise.resolve(request.backgroundDescription),
    request.enhanceComposition ? enhancePrompt(request.compositionDescription) : Promise.resolve(request.compositionDescription)
  ]);

  const parts: any[] = [];
  const selectedStyle = getStylePrompt(request.artStyle);
  const selectedTheme = getThemePrompt(request.artTheme);

  const cameraPrompts: Record<string, string> = {
    'front': 'Front view.', 'back': 'Back view.', 'left': 'Side left.', 'right': 'Side right.',
    'top': 'Top-down.', 'bottom': 'Low angle.', 'close-up': 'Close-up.', 'wide': 'Wide shot.'
  };

  const cameraInstruction = cameraPrompts[request.cameraAngle] || cameraPrompts['front'];

  let textPrompt = `
  TASK: Generate a comic panel.
  STYLE: ${selectedStyle} | THEME: ${selectedTheme}
  CAMERA: ${cameraInstruction} | LAYOUT: ${enhancedComposition}
  ACTION: ${enhancedPose}
  SETTING: ${request.transparentBackground ? "Isolated on white background" : enhancedBackground}
  `;

  if (userFeedbackRating !== undefined && userFeedbackRating !== null) {
      if (userFeedbackRating <= 2) {
          textPrompt += `\n\n[USER CRITIQUE] The user rated the previous attempt as ${userFeedbackRating}/5. 
          The previous version lacked quality or character accuracy. 
          YOU MUST IMPROVE SIGNIFICANTLY: Better anatomy, more dynamic lighting, and strictly following character design cues.`;
      } else if (userFeedbackRating >= 4) {
          textPrompt += `\n\n[USER REFINEMENT] The user liked the previous attempt (${userFeedbackRating}/5) but requested a variation. 
          Keep the same spirit, composition, and quality level while providing a fresh take on the action.`;
      } else {
          textPrompt += `\n\n[USER FEEDBACK] The user provided a rating of ${userFeedbackRating}/5. 
          Adjust the visual output to better align with the description.`;
      }
  }

  if (previousPanelImage) {
    const base64Data = previousPanelImage.split(',')[1];
    const mimeType = previousPanelImage.split(';')[0].split(':')[1];
    
    parts.push({ text: `
    [STRICT SEQUENCE CONTINUITY]
    The provided image is the IMMEDIATELY PRECEDING panel.
    YOUR MISSION: Model a 100% consistent sequence.
    
    PRESERVATION RULES:
    1. CHARACTERS: Use the EXACT facial features, hair, and physique from the reference.
    2. CLOTHING: Maintain the identical costume, colors, and patterns (unless the prompt specifies a change).
    3. ENVIRONMENT: Keep the same architecture, room layout, and specific decorative elements.
    4. ATMOSPHERE: Replicate the exact lighting conditions, weather (rain/fog/sun), and color grading.
    5. OBJECTS: If a character holds an object in the reference, it must be the same object in this new action.
    
    ADAPTATION: Only change the pose, action, and camera angle as defined in the text prompt while keeping all static visual elements identical to the reference.
    ` });

    parts.push({
      inlineData: { data: base64Data, mimeType: mimeType },
    });
  }

  if (styleReferences && styleReferences.length > 0) {
    parts.push({ text: `[ARTISTIC STYLE REFERENCE] Follow this rendering style strictly:` });
    for (const ref of styleReferences) {
        const data = ref.split(',')[1];
        const mime = ref.split(';')[0].split(':')[1];
        parts.push({ inlineData: { data, mimeType: mime } });
    }
  }

  if (characters.length > 0) {
    textPrompt += `\n\n[CHARACTER REFERENCES] Use these identities:`;
    characters.forEach(char => {
      textPrompt += `\n- @${char.name}: ${char.description} (${char.facialFeatures}, ${char.clothingDetails})`;
      if (char.modelSheetBase64) {
         const data = char.modelSheetBase64.split(',')[1];
         const mime = char.modelSheetBase64.split(';')[0].split(':')[1];
         parts.push({ text: `Reference for @${char.name}:` });
         parts.push({ inlineData: { data, mimeType: mime } });
      }
    });
  }

  if (comicObjects.length > 0 && request.useObject) {
    comicObjects.forEach(obj => {
       if (obj.modelSheetBase64) {
         const data = obj.modelSheetBase64.split(',')[1];
         const mime = obj.modelSheetBase64.split(';')[0].split(':')[1];
         parts.push({ text: `Reference for Object @${obj.name}:` });
         parts.push({ inlineData: { data, mimeType: mime } });
       }
    });
  }

  if (environment && environment.modelSheetBase64 && request.useEnvironment && !request.transparentBackground) {
    const data = environment.modelSheetBase64.split(',')[1];
    const mime = environment.modelSheetBase64.split(';')[0].split(':')[1];
    parts.push({ text: `Reference for Environment:` });
    parts.push({ inlineData: { data, mimeType: mime } });
  }

  parts.push({ text: textPrompt });

  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts },
      config: { imageConfig: { aspectRatio: request.aspectRatio, imageSize: '2K' } }
    }));
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (error) { throw error; }
};