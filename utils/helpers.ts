export const generateUUID = (): string => {
  // Use crypto.randomUUID if available (Secure Contexts)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Polyfill for older browsers or non-secure contexts (http://IP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

// Global definition for the script added in index.html
declare global {
  interface Window {
    heic2any: any;
  }
}

/**
 * Processes a file for upload/storage.
 * Handles HEIC -> JPEG conversion automatically so images display in browsers/reports.
 */
export const processFile = async (file: File): Promise<{ data: string, type: string, name: string }> => {
  const isHeic = file.name.toLowerCase().endsWith('.heic') || 
                 file.type === 'image/heic' || 
                 file.type === 'image/heif';

  if (isHeic && window.heic2any) {
    try {
      console.log(`Converting HEIC: ${file.name}`);
      // Convert Blob to JPEG Blob
      const resultBlob = await window.heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });

      // heic2any returns Blob or Blob[]
      const blob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
      
      const base64 = await fileToBase64(blob);
      const newName = file.name.replace(/\.(heic|HEIC)$/, '.jpg');
      
      return { 
        data: base64, 
        type: 'image/jpeg', 
        name: newName 
      };
    } catch (e) {
      console.warn("HEIC conversion failed, falling back to original file", e);
    }
  }

  // Standard processing for other files
  const base64 = await fileToBase64(file);
  return { 
    data: base64, 
    type: file.type, 
    name: file.name 
  };
};