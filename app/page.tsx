'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { POPULAR_LANGUAGES, Language, getLanguageByCode, getLanguageName } from './languages';

type FileType = 'xml' | 'json' | 'xcode' | 'text';

interface AuditResult {
  totalKeys: number;
  translatedKeys: number;
  untranslatedKeys: string[];
  possiblyUntranslated: string[];
  keyMismatch?: boolean;
}

interface TranslationResult {
  language: string;
  languageCode: string;
  content: string;
  audit?: AuditResult;
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileType, setFileType] = useState<FileType>('json');
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);
  const [context, setContext] = useState('');
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [currentTranslatingLang, setCurrentTranslatingLang] = useState('');
  const [error, setError] = useState('');
  const [textContent, setTextContent] = useState('');
  const [modelName, setModelName] = useState('gemini-1.5-flash');
  const [customModel, setCustomModel] = useState('');
  const [concurrentLimit, setConcurrentLimit] = useState(5); // Default to 5 concurrent translations
  const [translationProgress, setTranslationProgress] = useState({ completed: 0, total: 0 });

  // Load saved languages and model on mount
  useEffect(() => {
    const savedLanguages = localStorage.getItem('translatorLanguageCodes');
    if (savedLanguages) {
      try {
        const parsed = JSON.parse(savedLanguages);
        if (Array.isArray(parsed)) {
          setSelectedLanguageCodes(parsed);
          console.log('[Translator] Loaded saved language codes:', parsed);
        }
      } catch (e) {
        console.error('[Translator] Failed to load saved languages:', e);
      }
    }

    const savedModel = localStorage.getItem('translatorModel');
    if (savedModel) {
      setModelName(savedModel);
      console.log('[Translator] Loaded saved model:', savedModel);
    }

    const savedCustomModel = localStorage.getItem('translatorCustomModel');
    if (savedCustomModel) {
      setCustomModel(savedCustomModel);
      console.log('[Translator] Loaded saved custom model:', savedCustomModel);
    }

    const savedConcurrentLimit = localStorage.getItem('translatorConcurrentLimit');
    if (savedConcurrentLimit) {
      setConcurrentLimit(parseInt(savedConcurrentLimit, 10));
      console.log('[Translator] Loaded saved concurrent limit:', savedConcurrentLimit);
    }
  }, []);

  // Save languages when they change
  useEffect(() => {
    if (selectedLanguageCodes.length > 0) {
      localStorage.setItem('translatorLanguageCodes', JSON.stringify(selectedLanguageCodes));
      console.log('[Translator] Saved language codes:', selectedLanguageCodes);
    }
  }, [selectedLanguageCodes]);

  // Save model when it changes
  useEffect(() => {
    localStorage.setItem('translatorModel', modelName);
    console.log('[Translator] Saved model:', modelName);
  }, [modelName]);

  // Save custom model when it changes
  useEffect(() => {
    if (customModel) {
      localStorage.setItem('translatorCustomModel', customModel);
      console.log('[Translator] Saved custom model:', customModel);
    }
  }, [customModel]);

  // Save concurrent limit when it changes
  useEffect(() => {
    localStorage.setItem('translatorConcurrentLimit', concurrentLimit.toString());
    console.log('[Translator] Saved concurrent limit:', concurrentLimit);
  }, [concurrentLimit]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[FileUpload] Uploading file:', file.name, 'Type:', file.type, 'Size:', file.size);
    const text = await file.text();
    setFileContent(text);
    setError('');
    setTranslations([]);
    console.log('[FileUpload] File content loaded, length:', text.length);
  };

  const detectFileType = (content: string): FileType => {
    if (content.trim().startsWith('<?xml') || content.includes('<string name=')) {
      return 'xml';
    } else if (content.includes('/* Localizable.strings') || content.includes('" = "')) {
      return 'xcode';
    }
    return 'json';
  };

  const toggleLanguage = (languageCode: string) => {
    setSelectedLanguageCodes(prev => {
      if (prev.includes(languageCode)) {
        return prev.filter(code => code !== languageCode);
      } else {
        return [...prev, languageCode];
      }
    });
  };

  const cleanResponse = (text: string, type: FileType): string => {
    let cleaned = text.trim();
    
    if (type === 'json') {
      // Remove any markdown code blocks
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
      }
      
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      
      cleaned = cleaned.trim();
      
      // Find the actual JSON content (starts with { and ends with })
      const jsonStart = cleaned.indexOf('{');
      const jsonEnd = cleaned.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      }
      
      // Remove any trailing commas before } or ]
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
      
      return cleaned;
    }
    
    // For other formats, remove any markdown code blocks if present
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n');
      if (firstNewline !== -1) {
        cleaned = cleaned.substring(firstNewline + 1);
      } else {
        cleaned = cleaned.substring(3);
      }
    }
    
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3).trim();
    }
    
    return cleaned;
  };

  const auditTranslation = (original: string, translated: string, type: FileType): AuditResult => {
    console.log('[Audit] Starting audit for type:', type);
    console.log('[Audit] Original content length:', original.length);
    console.log('[Audit] Translated content length:', translated.length);
    
    const result: AuditResult = {
      totalKeys: 0,
      translatedKeys: 0,
      untranslatedKeys: [],
      possiblyUntranslated: []
    };

    if (type === 'text') {
      console.log('[Audit] Skipping audit for text mode');
      return result;
    }

    try {
      if (type === 'json') {
        const cleanTranslated = cleanResponse(translated, 'json');
        
        console.log('[Audit] Parsing JSON content');
        console.log('[Audit] First 200 chars of cleaned translated:', cleanTranslated.substring(0, 200));
        
        let originalJson, translatedJson;
        
        try {
          originalJson = JSON.parse(original);
        } catch (e) {
          console.error('[Audit] Failed to parse original JSON:', e);
          return result;
        }
        
        try {
          translatedJson = JSON.parse(cleanTranslated);
        } catch (e) {
          console.error('[Audit] Failed to parse translated JSON after cleaning:', e);
          // Try one more time with more aggressive cleaning
          let aggressivelyCleaned = cleanTranslated;
          
          // Remove any non-JSON content at the beginning or end
          const jsonStart = aggressivelyCleaned.indexOf('{');
          const jsonEnd = aggressivelyCleaned.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            aggressivelyCleaned = aggressivelyCleaned.substring(jsonStart, jsonEnd + 1);
          }
          
          try {
            translatedJson = JSON.parse(aggressivelyCleaned);
            console.log('[Audit] Successfully parsed after aggressive cleaning');
          } catch (e2) {
            console.error('[Audit] Failed to parse even after aggressive cleaning');
            // Return partial audit result indicating parse failure
            result.totalKeys = Object.keys(originalJson).length;
            result.untranslatedKeys = ['[JSON Parse Error]'];
            return result;
          }
        }
        
        // First check if the keys match at the top level
        const origKeys = Object.keys(originalJson).sort();
        const transKeys = Object.keys(translatedJson).sort();
        
        if (origKeys.length !== transKeys.length || !origKeys.every((key, i) => key === transKeys[i])) {
          console.warn('[Audit] Key mismatch detected! Original keys:', origKeys);
          console.warn('[Audit] Translated keys:', transKeys);
          
          result.keyMismatch = true;
          
          // Find missing and extra keys
          const missingKeys = origKeys.filter(key => !transKeys.includes(key));
          const extraKeys = transKeys.filter(key => !origKeys.includes(key));
          
          if (missingKeys.length > 0) {
            console.error('[Audit] Missing keys in translation:', missingKeys);
            result.untranslatedKeys.push(...missingKeys.map(k => `[MISSING KEY] ${k}`));
          }
          
          if (extraKeys.length > 0) {
            console.error('[Audit] Extra keys in translation:', extraKeys);
            result.untranslatedKeys.push(...extraKeys.map(k => `[EXTRA KEY] ${k}`));
          }
        }
        
        const checkKeys = (origObj: any, transObj: any, path: string = '') => {
          for (const key in origObj) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof origObj[key] === 'object' && origObj[key] !== null) {
              if (!transObj || !transObj[key] || typeof transObj[key] !== 'object') {
                result.untranslatedKeys.push(currentPath);
              } else {
                checkKeys(origObj[key], transObj[key], currentPath);
              }
            } else if (typeof origObj[key] === 'string') {
              result.totalKeys++;
              
              if (!transObj || !transObj[key]) {
                result.untranslatedKeys.push(currentPath);
              } else if (transObj[key] === origObj[key]) {
                result.possiblyUntranslated.push(currentPath);
              } else {
                result.translatedKeys++;
              }
            }
          }
        };
        
        checkKeys(originalJson, translatedJson);
        console.log('[Audit] JSON audit complete:', result);
        
      } else if (type === 'xml') {
        // Extract string entries from XML
        const originalStrings = new Map<string, string>();
        const translatedStrings = new Map<string, string>();
        
        const xmlRegex = /<string\s+name="([^"]+)">([^<]*)<\/string>/g;
        let match;
        
        while ((match = xmlRegex.exec(original)) !== null) {
          originalStrings.set(match[1], match[2]);
        }
        
        xmlRegex.lastIndex = 0;
        while ((match = xmlRegex.exec(translated)) !== null) {
          translatedStrings.set(match[1], match[2]);
        }
        
        result.totalKeys = originalStrings.size;
        
        for (const [key, value] of originalStrings) {
          if (!translatedStrings.has(key)) {
            result.untranslatedKeys.push(key);
          } else if (translatedStrings.get(key) === value) {
            result.possiblyUntranslated.push(key);
          } else {
            result.translatedKeys++;
          }
        }
        console.log('[Audit] XML audit complete:', result);
        
      } else if (type === 'xcode') {
        // Extract string entries from Xcode strings file
        const originalStrings = new Map<string, string>();
        const translatedStrings = new Map<string, string>();
        
        const stringsRegex = /"([^"]+)"\s*=\s*"([^"]*)"/g;
        let match;
        
        while ((match = stringsRegex.exec(original)) !== null) {
          originalStrings.set(match[1], match[2]);
        }
        
        stringsRegex.lastIndex = 0;
        while ((match = stringsRegex.exec(translated)) !== null) {
          translatedStrings.set(match[1], match[2]);
        }
        
        result.totalKeys = originalStrings.size;
        
        for (const [key, value] of originalStrings) {
          if (!translatedStrings.has(key)) {
            result.untranslatedKeys.push(key);
          } else if (translatedStrings.get(key) === value) {
            result.possiblyUntranslated.push(key);
          } else {
            result.translatedKeys++;
          }
        }
        console.log('[Audit] Xcode strings audit complete:', result);
      }
    } catch (err) {
      console.error('[Audit] Audit error:', err);
      console.error('[Audit] Failed to parse content. Original first 200 chars:', original.substring(0, 200));
      console.error('[Audit] Failed to parse content. Translated first 200 chars:', translated.substring(0, 200));
    }
    
    return result;
  };

  const translateContent = async () => {
    const contentToTranslate = fileType === 'text' ? textContent : fileContent;
    
    if (!apiKey || !contentToTranslate || selectedLanguageCodes.length === 0) {
      setError('Please provide API key, content, and at least one target language');
      return;
    }

    if (modelName === 'custom' && !customModel.trim()) {
      setError('Please enter a custom model name');
      return;
    }

    setIsTranslating(true);
    setError('');
    setTranslations([]);
    setTranslationProgress({ completed: 0, total: selectedLanguageCodes.length });

    try {
      console.log('[Translation] Starting parallel translation process');
      console.log('[Translation] API Key length:', apiKey.length);
      console.log('[Translation] Model:', modelName === 'custom' ? customModel : modelName);
      console.log('[Translation] Target languages:', selectedLanguageCodes);
      console.log('[Translation] Content type:', fileType);
      console.log('[Translation] Content length:', contentToTranslate.length);
      
      const actualModel = modelName === 'custom' ? customModel : modelName;
      console.log('[Translation] Using model:', actualModel);

      // Create translation promises for all languages
      const translationPromises = selectedLanguageCodes.map(async (languageCode) => {
        const languageName = getLanguageName(languageCode);
        console.log(`[Translation] Starting translation to ${languageName} (${languageCode})...`);
        
        let prompt = '';
        
        if (fileType === 'text') {
          prompt = `
You are a professional translator. Translate the following text to ${languageName}.
${context ? `Context: ${context}` : ''}

Make the translation sound natural in ${languageName}.

Original text:
${contentToTranslate}

Translated text:`;
        } else if (fileType === 'json') {
          // Detailed prompt for JSON translation
          prompt = `
You are a professional translator specializing in software localization. Your task is to translate a JSON localization file to ${languageName}.

${context ? `Application context: ${context}` : ''}

CRITICAL RULES - MUST FOLLOW:
1. PRESERVE ALL JSON KEYS EXACTLY - Never translate, modify, or change any JSON key names
2. ONLY translate the string values (the text after the colon in quotes)
3. Maintain the EXACT same JSON structure and nesting
4. Keep all placeholders unchanged: {{variable}}, {0}, %s, %d, etc.
5. Return ONLY valid JSON - no markdown, no explanations, no code blocks
6. The output must have IDENTICAL keys to the input

TRANSLATION APPROACH:
- Read each key-value pair
- Keep the key EXACTLY as is (left side of colon)
- Translate only the value (right side of colon)
- Preserve any special characters or formatting in values

EXAMPLES:
Input:  {"common": {"loading": "Loading..."}}
Output: {"common": {"loading": "Cargando..."}}

Input:  {"user.name": "Name", "user.email": "Email"}
Output: {"user.name": "Nombre", "user.email": "Correo electrónico"}

NEVER DO THIS:
✗ Change "loading" to "cargando" (key changed)
✗ Change "user.name" to "userName" (key format changed)
✗ Add or remove any keys
✗ Reorder keys

JSON to translate:
${contentToTranslate}`;
        } else {
          // Prompt for XML and Xcode strings
          prompt = `
You are a professional translator. Translate the following ${fileType} localization file to ${languageName}.
${context ? `Context about the app: ${context}` : ''}

Important instructions:
1. Maintain the exact same file structure and format
2. Only translate the text values, not the keys or identifiers
3. Make the translations sound natural in ${languageName}
4. Keep any placeholders, variables, or formatting codes intact
5. For XML files: only translate content inside string tags
6. For Xcode strings: only translate the text after the = sign
7. IMPORTANT: Translate ALL strings, do not leave any untranslated
8. Return ONLY the translated content without any markdown formatting or code blocks

Original content:
${contentToTranslate}

Translated content:`;
        }

        console.log(`[Translation] Prompt length for ${languageName}:`, prompt.length);
        const startTime = Date.now();
        
        try {
          // Call our API route
          const apiResponse = await fetch('/api/translate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey,
              model: actualModel,
              prompt,
              isJson: fileType === 'json'
            })
          });

          if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(errorData.error || `API call failed with status ${apiResponse.status}`);
          }

          const data = await apiResponse.json();
          const translatedText = data.text;
          
          const duration = Date.now() - startTime;
          console.log(`[Translation] API call for ${languageName} took ${duration}ms`);
          console.log(`[Translation] Response length for ${languageName}:`, translatedText.length);
          console.log(`[Translation] First 200 chars of response:`, translatedText.substring(0, 200));
          
          // Clean the response
          const cleanedText = cleanResponse(translatedText, fileType);
          
          const translationResult: TranslationResult = {
            language: languageName,
            languageCode: languageCode,
            content: cleanedText
          };
          
          // Audit the translation if it's not text mode
          if (fileType !== 'text') {
            translationResult.audit = auditTranslation(contentToTranslate, cleanedText, fileType);
          }
          
          console.log(`[Translation] Completed translation for ${languageName}`);
          return translationResult;
          
        } catch (err) {
          console.error(`[Translation] Error translating to ${languageName}:`, err);
          // Return error result for this language
          return {
            language: languageName,
            languageCode: languageCode,
            content: `Error: ${err instanceof Error ? err.message : 'Translation failed'}`,
            audit: {
              totalKeys: 0,
              translatedKeys: 0,
              untranslatedKeys: [`[ERROR] ${err instanceof Error ? err.message : 'Translation failed'}`],
              possiblyUntranslated: []
            }
          } as TranslationResult;
        }
      });

      // Update UI to show we're translating multiple languages
      setCurrentTranslatingLang(`${selectedLanguageCodes.length} languages in parallel`);

      // Process translations in batches to respect concurrent limit
      const results: TranslationResult[] = [];
      const totalLanguages = selectedLanguageCodes.length;
      
      console.log(`[Translation] Processing ${totalLanguages} translations with concurrent limit of ${concurrentLimit}`);
      
      // Process in batches
      for (let i = 0; i < translationPromises.length; i += concurrentLimit) {
        const batch = translationPromises.slice(i, i + concurrentLimit);
        const batchNumber = Math.floor(i / concurrentLimit) + 1;
        const totalBatches = Math.ceil(translationPromises.length / concurrentLimit);
        
        console.log(`[Translation] Processing batch ${batchNumber}/${totalBatches} (${batch.length} translations)`);
        setCurrentTranslatingLang(`Batch ${batchNumber}/${totalBatches} - ${batch.length} languages`);
        
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
        
        // Update progress
        setTranslationProgress({ completed: results.length, total: totalLanguages });
        
        // Update translations after each batch to show progress
        setTranslations([...results]);
      }
      
      setCurrentTranslatingLang('');
      console.log('[Translation] All parallel translations completed');
      
      // Count successful translations
      const successCount = results.filter(r => !r.content.startsWith('Error:')).length;
      console.log(`[Translation] Successfully translated to ${successCount}/${results.length} languages`);
      
    } catch (err: any) {
      let errorMessage = 'Translation failed';
      
      console.error('[Translation] Error occurred:', err);
      console.error('[Translation] Error name:', err.name);
      console.error('[Translation] Error message:', err.message);
      console.error('[Translation] Error stack:', err.stack);
      
      if (err instanceof Error) {
        if (err.message.includes('NetworkError')) {
          errorMessage = `Network error: Unable to connect to the translation service. Please check your internet connection.`;
        } else if (err.message.includes('Invalid API key')) {
          errorMessage = 'Invalid API key. Please check your Gemini API key.';
        } else if (err.message.includes('Model not found')) {
          errorMessage = `Model "${modelName === 'custom' ? customModel : modelName}" not found. Please check the model name or try a different model.`;
        } else if (err.message.includes('quota')) {
          errorMessage = 'API quota exceeded. Please try again later.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsTranslating(false);
      setCurrentTranslatingLang('');
    }
  };

  const downloadTranslation = (translation: TranslationResult) => {
    const blob = new Blob([translation.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const extension = fileType === 'xml' ? 'xml' : fileType === 'xcode' ? 'strings' : fileType === 'text' ? 'txt' : 'json';
    
    // Use language code for JSON files, full language name for others
    const filename = fileType === 'json' 
      ? `${translation.languageCode}.${extension}`
      : `translated_${translation.languageCode}.${extension}`;
    
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log('[Copy] Content copied to clipboard');
    } catch (err) {
      console.error('[Copy] Failed to copy:', err);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>String Asset Translator</h1>
      
      <div className={styles.section}>
        <label className={styles.label}>
          Google Gemini API Key:
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className={styles.input}
            placeholder="Enter your API key"
          />
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>
          Model:
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className={styles.select}
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Recommended)</option>
            <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B (Faster)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Most Capable)</option>
            <option value="gemini-1.0-pro">Gemini 1.0 Pro (Stable)</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Experimental</option>
            <option value="gemini-2.5-flash-preview-05-20">Gemini 2.5 Flash Preview (Latest)</option>
            <option value="custom">Custom Model (Enter Below)</option>
          </select>
          {modelName === 'custom' && (
            <input
              type="text"
              value={customModel}
              className={styles.input}
              placeholder="Enter custom model name (e.g., gemini-1.0-pro)"
              onChange={(e) => setCustomModel(e.target.value)}
              style={{ marginTop: '0.5rem' }}
            />
          )}
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>
          Concurrent Translations:
          <div className={styles.concurrentControl}>
            <input
              type="range"
              min="1"
              max="20"
              value={concurrentLimit}
              onChange={(e) => setConcurrentLimit(parseInt(e.target.value, 10))}
              className={styles.rangeInput}
            />
            <span className={styles.rangeValue}>{concurrentLimit}</span>
          </div>
          <span className={styles.hint}>
            Higher values translate faster but may hit API rate limits. Recommended: 5-10 for Ryzen 9 systems.
          </span>
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>
          Translation Mode:
          <select
            value={fileType}
            onChange={(e) => {
              setFileType(e.target.value as FileType);
              setFileContent('');
              setTextContent('');
              setTranslations([]);
            }}
            className={styles.select}
          >
            <option value="text">Text (Direct Translation)</option>
            <option value="json">JSON (Next.js locales)</option>
            <option value="xml">XML (Android strings.xml)</option>
            <option value="xcode">Xcode Strings</option>
          </select>
        </label>
      </div>

      {fileType === 'text' ? (
        <div className={styles.section}>
          <label className={styles.label}>
            Text to Translate:
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className={styles.textarea}
              placeholder="Enter the text you want to translate..."
              rows={6}
            />
          </label>
        </div>
      ) : (
        <div className={styles.section}>
          <label className={styles.label}>
            Upload File:
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".json,.xml,.strings"
              className={styles.fileInput}
            />
          </label>
        </div>
      )}

      <div className={styles.section}>
        <label className={styles.label}>
          Target Languages:
        </label>
        <div className={styles.languageGrid}>
          {POPULAR_LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => toggleLanguage(language.code)}
              className={`${styles.languageTagButton} ${
                selectedLanguageCodes.includes(language.code) ? styles.selected : ''
              }`}
              type="button"
            >
              <span className={styles.languageCode}>{language.code}</span>
              <span className={styles.languageName}>{language.name}</span>
              <span className={styles.languageNative}>{language.nativeName}</span>
            </button>
          ))}
        </div>
        
        {selectedLanguageCodes.length > 0 && (
          <div className={styles.selectedLanguages}>
            <h4>Selected Languages ({selectedLanguageCodes.length}):</h4>
            <div className={styles.languageList}>
              {selectedLanguageCodes.map((code) => {
                const language = getLanguageByCode(code);
                return language ? (
                  <div key={code} className={styles.languageTag}>
                    {language.name} ({language.code})
                    <button
                      onClick={() => toggleLanguage(code)}
                      className={styles.removeButton}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <label className={styles.label}>
          App Context (optional):
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className={styles.textarea}
            placeholder="Describe your app to help with better translations..."
            rows={4}
          />
        </label>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.actions}>
        <button
          onClick={translateContent}
          disabled={isTranslating || (!fileContent && !textContent) || !apiKey || selectedLanguageCodes.length === 0}
          className={styles.button}
        >
          {isTranslating ? `Translating: ${currentTranslatingLang || '...'}` : 'Translate All'}
        </button>
        
        {isTranslating && translationProgress.total > 0 && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${(translationProgress.completed / translationProgress.total) * 100}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {translationProgress.completed} / {translationProgress.total} languages completed
            </span>
          </div>
        )}
      </div>

      {translations.length > 0 && (
        <div className={styles.translationsContainer}>
          <h2>Translations</h2>
          {translations.map((translation, index) => (
            <div key={index} className={styles.translationSection}>
              <div className={styles.translationHeader}>
                <h3>{translation.language}</h3>
                <div className={styles.translationActions}>
                  <button
                    onClick={() => copyToClipboard(translation.content)}
                    className={styles.copyButton}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => downloadTranslation(translation)}
                    className={styles.downloadButton}
                  >
                    Download
                  </button>
                </div>
              </div>

              {translation.audit && translation.audit.totalKeys > 0 && (
                <div className={styles.miniAudit}>
                  {translation.audit.keyMismatch && (
                    <span className={styles.miniAuditItem + ' ' + styles.critical}>
                      ⚠️ KEY MISMATCH - JSON keys were changed!
                    </span>
                  )}
                  <span className={styles.miniAuditItem + ' ' + styles.success}>
                    ✓ {translation.audit.translatedKeys}/{translation.audit.totalKeys} translated
                  </span>
                  {translation.audit.untranslatedKeys.length > 0 && (
                    <span className={styles.miniAuditItem + ' ' + styles.error}>
                      ⚠ {translation.audit.untranslatedKeys.length} missing
                    </span>
                  )}
                  {translation.audit.possiblyUntranslated.length > 0 && (
                    <span className={styles.miniAuditItem + ' ' + styles.warning}>
                      ? {translation.audit.possiblyUntranslated.length} possibly untranslated
                    </span>
                  )}
                </div>
              )}

              <div className={styles.translationContent}>
                <pre>{translation.content.substring(0, 300)}{translation.content.length > 300 && '...'}</pre>
              </div>

              {translation.audit && (translation.audit.untranslatedKeys.length > 0 || translation.audit.possiblyUntranslated.length > 0) && (
                <details className={styles.auditDetails}>
                  <summary>View Audit Details</summary>
                  {translation.audit.untranslatedKeys.length > 0 && (
                    <div>
                      <h4>Missing Translations:</h4>
                      <ul className={styles.keyList}>
                        {translation.audit.untranslatedKeys.map((key, idx) => (
                          <li key={idx} className={styles.keyItem}>{key}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {translation.audit.possiblyUntranslated.length > 0 && (
                    <div>
                      <h4>Possibly Untranslated:</h4>
                      <ul className={styles.keyList}>
                        {translation.audit.possiblyUntranslated.map((key, idx) => (
                          <li key={idx} className={styles.keyItem}>{key}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
