import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UploadIcon, SparklesIcon, BackIcon } from './components/icons';
import { Spinner } from './components/Spinner';

interface OriginalImage {
  url: string;
  base64: string;
  mimeType: string;
}

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<OriginalImage | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string; url: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const [header, base64] = result.split(',');
        if (!header || !base64) {
          reject(new Error("Invalid file format"));
          return;
        }
        const mimeTypeMatch = header.match(/:(.*?);/);
        if (!mimeTypeMatch || !mimeTypeMatch[1]) {
          reject(new Error("Could not determine MIME type"));
          return;
        }
        const mimeType = mimeTypeMatch[1];
        resolve({ base64, mimeType, url: result });
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      setEditedImage(null);
      try {
        const imageData = await fileToBase64(file);
        setOriginalImage(imageData);
      } catch (e) {
        setError("Could not process file. Please try another image.");
        console.error(e);
      }
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt || !originalImage) {
      setError('Please provide a prompt and an image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: originalImage.base64,
                mimeType: originalImage.mimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const newImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setEditedImage(newImageUrl);
          return;
        }
      }
      throw new Error("No image data found in the API response.");

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Generation failed: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, originalImage]);

  const handleStartOver = () => {
    setOriginalImage(null);
    setEditedImage(null);
    setPrompt('');
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const ImageUploader: React.FC = () => (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="image/*" ref={fileInputRef}/>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Gemini Image Editor
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Transform your photos with a simple text prompt.
          </p>
        </header>

        {!originalImage ? (
          <ImageUploader />
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-4 text-gray-300">Original</h2>
                <div className="w-full aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700">
                  <img src={originalImage.url} alt="Original" className="w-full h-full object-contain" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-4 text-gray-300">Edited</h2>
                <div className="w-full aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex items-center justify-center">
                  {isLoading && <Spinner />}
                  {!isLoading && editedImage && (
                    <img src={editedImage} alt="Edited" className="w-full h-full object-contain" />
                  )}
                  {!isLoading && !editedImage && (
                    <div className="text-center text-gray-500">
                      <SparklesIcon className="w-16 h-16 mx-auto mb-2" />
                      <p>Your edited image will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Add a retro filter, make it black and white..."
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-full py-3 pl-5 pr-36 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                  disabled={isLoading}
                />
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold px-4 py-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-pink-600 transition-all shadow-md"
                >
                  <SparklesIcon className="w-5 h-5" />
                  Generate
                </button>
              </div>
            </div>
             <div className="mt-6 text-center">
                <button
                    onClick={handleStartOver}
                    className="flex items-center gap-2 mx-auto bg-gray-700 text-gray-300 font-semibold px-6 py-2 rounded-full hover:bg-gray-600 transition-colors"
                >
                    <BackIcon />
                    Start Over
                </button>
             </div>
          </div>
        )}

        {error && (
            <div className="mt-6 w-full max-w-2xl mx-auto p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-center">
                <p>{error}</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;
