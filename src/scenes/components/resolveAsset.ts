import { staticFile } from 'remotion';

/**
 * Resolves a media source path.
 * If the path starts with http/https, it returns the URL as-is.
 * Otherwise, it resolves the path relative to the Remotion public directory using staticFile.
 */
export const resolveAsset = (src: string | undefined): string => {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Remove leading slash if present, as staticFile expects path relative to public/
  const cleanPath = src.startsWith('/') ? src.slice(1) : src;
  
  try {
    return staticFile(cleanPath);
  } catch (e) {
    // Return original string if staticFile fails (e.g. in non-browser/non-render environments)
    return src;
  }
};
