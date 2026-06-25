/**
 * Copies a string to the user's clipboard.
 * Uses the Modern Clipboard API if available, and falls back to a temporary textarea
 * element with document.execCommand('copy') in non-secure (HTTP) contexts.
 * 
 * Returns a promise resolving to true if successful, false otherwise.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Try navigator.clipboard first
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy using navigator.clipboard: ", err);
    }
  }

  // Fallback for non-secure contexts (HTTP, or older browsers)
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      
      // Avoid scrolling or styling issues
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        return true;
      }
    } catch (err) {
      console.error("Fallback copy failed: ", err);
    }
  }
  
  return false;
}
