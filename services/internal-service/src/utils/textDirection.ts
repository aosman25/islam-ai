/**
 * Detects the text direction (RTL or LTR) based on the content
 * Returns 'rtl' if the text is primarily right-to-left, 'ltr' otherwise
 */
export const getTextDirection = (text: string): 'rtl' | 'ltr' => {
  if (!text || text.trim().length === 0) {
    return 'ltr';
  }

  // RTL character ranges (Arabic, Hebrew, Persian, Urdu, etc.)
  const rtlCharRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

  // LTR character ranges (Latin, Cyrillic, Greek, etc.)
  const ltrCharRegex = /[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0370-\u03FF]/g;

  const rtlMatches = text.match(rtlCharRegex);
  const ltrMatches = text.match(ltrCharRegex);

  const rtlCount = rtlMatches ? rtlMatches.length : 0;
  const ltrCount = ltrMatches ? ltrMatches.length : 0;

  // If there are more RTL characters than LTR, use RTL
  // This handles mixed-language text intelligently
  return rtlCount > ltrCount ? 'rtl' : 'ltr';
};

/**
 * Returns the appropriate text alignment based on text direction
 */
export const getTextAlign = (text: string): 'right' | 'left' => {
  return getTextDirection(text) === 'rtl' ? 'right' : 'left';
};

/**
 * Returns CSS properties for text direction
 */
export const getTextDirectionStyles = (text: string): { direction: 'rtl' | 'ltr'; textAlign: 'right' | 'left' } => {
  const direction = getTextDirection(text);
  return {
    direction,
    textAlign: direction === 'rtl' ? 'right' : 'left',
  };
};
