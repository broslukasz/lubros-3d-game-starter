/**
 * Truncates long 3D model filenames cleanly while preserving the extension
 * e.g. "Meshy_AI_The_Welcoming_Savior_biped_Animation_Running_withSkin.glb" -> "Meshy_AI_The_...withSkin.glb"
 */
export function formatShortFileName(name: string, maxLen = 22): string {
  if (!name) return 'model.glb';
  if (name.length <= maxLen) return name;

  const extIndex = name.lastIndexOf('.');
  const ext = extIndex !== -1 ? name.slice(extIndex) : '';
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;

  const available = maxLen - ext.length - 3; // 3 chars for ellipsis '...'
  if (available <= 4) {
    return `${name.slice(0, Math.max(3, maxLen - 3))}...${ext}`;
  }

  const frontChars = Math.ceil(available * 0.6);
  const backChars = Math.floor(available * 0.4);

  return `${base.slice(0, frontChars)}...${base.slice(-backChars)}${ext}`;
}
