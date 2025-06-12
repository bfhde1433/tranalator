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
  const [translationProgress, setTranslationProgress] = useState({ completed: 0, total: 0 });
  const [existingTranslations, setExistingTranslations] = useState<Map<string, any>>(new Map());
  const [mergeMode, setMergeMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const processTranslationFiles = async (files: FileList | File[]) => {
    console.log('[ExistingTranslations] Processing', files.length, 'files');
    const translationsMap = new Map<string, any>();
    let processedCount = 0;

    for (const file of Array.from(files)) {
      try {
        // Skip non-translation files
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.json', '.xml', '.strings'];
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
        
        if (!hasValidExtension) {
          console.log('[ExistingTranslations] Skipping non-translation file:', file.name);
          continue;
        }

        const text = await file.text();
        
        // Extract language code from filename
        let languageCode = '';
        const baseName = file.name.split('.')[0];
        
        // Handle common patterns
        if (baseName.includes('_')) {
          // translated_es.xml, Localizable_es.strings
          languageCode = baseName.split('_').pop() || '';
        } else if (baseName.includes('-')) {
          // zh-TW.json, en-US.json
          languageCode = baseName;
        } else {
          // es.json, fr.json
          languageCode = baseName;
        }

        // Validate language code (should be 2-5 characters)
        if (!languageCode || languageCode.length < 2 || languageCode.length > 5) {
          console.warn('[ExistingTranslations] Could not extract valid language code from', file.name);
          continue;
        }

        // Parse the file content based on detected type
        let parsedContent: any = null;
        
        if (fileName.endsWith('.json')) {
          try {
            parsedContent = JSON.parse(text);
          } catch (err) {
            console.error('[ExistingTranslations] Failed to parse JSON file', file.name, err);
            continue;
          }
        } else if (fileName.endsWith('.xml')) {
          // For XML, store raw content
          parsedContent = text;
        } else if (fileName.endsWith('.strings')) {
          // For Xcode strings, store raw content
          parsedContent = text;
        }

        if (parsedContent) {
          translationsMap.set(languageCode, parsedContent);
          processedCount++;
          console.log('[ExistingTranslations] Loaded translation for', languageCode, 'from', file.name);
        }
      } catch (err) {
        console.error('[ExistingTranslations] Error processing file', file.name, err);
      }
    }

    if (processedCount > 0) {
      setExistingTranslations(translationsMap);
      setMergeMode(true);
      
      console.log('[ExistingTranslations] Successfully loaded', processedCount, 'translations for languages:', Array.from(translationsMap.keys()));
      
      // Auto-select languages that we have existing translations for
      const existingLanguageCodes = Array.from(translationsMap.keys());
      const newSelectedCodes = [...new Set([...selectedLanguageCodes, ...existingLanguageCodes])];
      setSelectedLanguageCodes(newSelectedCodes);
      
      return processedCount;
    }
    
    return 0;
  };

  const handleExistingTranslationsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    await processTranslationFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    // Process all dropped items (files and folders)
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await processEntry(entry, files);
        }
      }
    }

    if (files.length > 0) {
      const processedCount = await processTranslationFiles(files);
      if (processedCount > 0) {
        console.log(`[DragDrop] Successfully processed ${processedCount} translation files`);
      } else {
        setError('No valid translation files found. Please ensure files have language codes in their names (e.g., es.json, fr.xml)');
      }
    }
  };

  const processEntry = async (entry: any, files: File[]): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          files.push(file);
          resolve();
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        dirReader.readEntries(async (entries: any[]) => {
          for (const childEntry of entries) {
            await processEntry(childEntry, files);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
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
      console.log('[Translation] Starting bulk translation process');
      console.log('[Translation] API Key length:', apiKey.length);
      console.log('[Translation] Model:', modelName === 'custom' ? customModel : modelName);
      console.log('[Translation] Target languages:', selectedLanguageCodes);
      console.log('[Translation] Content type:', fileType);
      console.log('[Translation] Content length:', contentToTranslate.length);
      
      const actualModel = modelName === 'custom' ? customModel : modelName;
      console.log('[Translation] Using model:', actualModel);

      const allResults: TranslationResult[] = [];
      
      // Determine optimal batch size based on content type and size
      const contentSize = contentToTranslate.length;
      let languagesPerBatch = 5; // Default
      
      if (fileType === 'text') {
        // For text, we can handle more languages at once
        if (contentSize < 500) languagesPerBatch = 10;
        else if (contentSize < 2000) languagesPerBatch = 7;
        else languagesPerBatch = 5;
      } else {
        // For structured content (JSON/XML), be more conservative
        if (contentSize < 1000) languagesPerBatch = 7;
        else if (contentSize < 5000) languagesPerBatch = 5;
        else languagesPerBatch = 3;
      }
      
      console.log(`[Translation] Using ${languagesPerBatch} languages per API call`);
      
      // Group languages into batches
      const languageBatches: string[][] = [];
      for (let i = 0; i < selectedLanguageCodes.length; i += languagesPerBatch) {
        languageBatches.push(selectedLanguageCodes.slice(i, i + languagesPerBatch));
      }
      
      console.log(`[Translation] Created ${languageBatches.length} batches for ${selectedLanguageCodes.length} languages`);
      
      // Process each batch
      for (let batchIndex = 0; batchIndex < languageBatches.length; batchIndex++) {
        const languageBatch = languageBatches[batchIndex];
        const batchNumber = batchIndex + 1;
        
        console.log(`[Translation] Processing batch ${batchNumber}/${languageBatches.length} with ${languageBatch.length} languages`);
        setCurrentTranslatingLang(`Batch ${batchNumber}/${languageBatches.length} - ${languageBatch.length} languages`);
        
        try {
          // Prepare data for bulk translation
          const languageInfos = languageBatch.map(code => ({
            code,
            name: getLanguageName(code)
          }));
          
          // Check for existing translations and prepare content
          const preparedContents = new Map<string, { content: string; missingKeys: string[]; existing?: any }>();
          
          for (const langCode of languageBatch) {
            const existingTranslation = existingTranslations.get(langCode);
            let contentForLang = contentToTranslate;
            let missingKeys: string[] = [];
            
            if (mergeMode && existingTranslation) {
              missingKeys = findMissingKeys(contentToTranslate, existingTranslation, fileType);
              
              if (missingKeys.length === 0) {
                // No missing keys, use existing translation
                const langName = getLanguageName(langCode);
                allResults.push({
                  language: langName,
                  languageCode: langCode,
                  content: fileType === 'json' ? JSON.stringify(existingTranslation, null, 2) : existingTranslation,
                  audit: fileType !== 'text' ? auditTranslation(contentToTranslate, fileType === 'json' ? JSON.stringify(existingTranslation, null, 2) : existingTranslation, fileType) : undefined
                });
                continue;
              }
              
              contentForLang = createPartialContentForTranslation(contentToTranslate, missingKeys, fileType);
            }
            
            preparedContents.set(langCode, { content: contentForLang, missingKeys, existing: existingTranslation });
          }
          
          // Skip this batch if all languages already have complete translations
          const languagesToTranslate = Array.from(preparedContents.keys());
          if (languagesToTranslate.length === 0) {
            console.log(`[Translation] Batch ${batchNumber} skipped - all languages have complete translations`);
            setTranslationProgress({ completed: allResults.length, total: selectedLanguageCodes.length });
            setTranslations([...allResults]);
            continue;
          }
          
          // Create bulk prompt
          let bulkPrompt = '';
          
          if (fileType === 'text') {
            bulkPrompt = `
You are a professional translator. Translate the following text to multiple languages.
${context ? `Context: ${context}` : ''}

Original text:
${contentToTranslate}

Please provide translations for the following languages:
${languagesToTranslate.map(code => `- ${getLanguageName(code)}`).join('\n')}

Format your response as follows:
[LANGUAGE: language_code]
translated text here
[END]

For example:
[LANGUAGE: es]
Texto traducido en español
[END]
[LANGUAGE: fr]
Texte traduit en français
[END]

Make sure each translation sounds natural in its respective language.`;
          } else if (fileType === 'json') {
            // For JSON, we need to be more careful about bulk translation
            // We'll translate one at a time within the batch to maintain structure integrity
            const batchResults = await Promise.all(languagesToTranslate.map(async (langCode) => {
              const { content: contentForLang, missingKeys, existing } = preparedContents.get(langCode)!;
              const langName = getLanguageName(langCode);
              const isPartial = mergeMode && existing && missingKeys.length > 0;
              
                             const singlePrompt = `
You are a professional translator specializing in software localization. Your task is to translate a JSON localization file to ${langName}.

${context ? `Application context: ${context}` : ''}
${isPartial ? `\nIMPORTANT: You are translating ONLY the missing keys from an existing translation. This is a partial translation to complete an existing file.` : ''}

CRITICAL RULES - MUST FOLLOW:
1. PRESERVE ALL JSON KEYS EXACTLY - Never translate, modify, or change any JSON key names
2. ONLY translate the string values (the text after the colon in quotes)
3. Maintain the EXACT same JSON structure and nesting
4. Keep all placeholders unchanged: {{variable}}, {0}, %s, %d, etc.
5. Return ONLY valid JSON - no markdown, no explanations, no code blocks
6. The output must have IDENTICAL keys to the input
7. TRANSLATE ALL STRING VALUES - Do not leave any string untranslated
8. If a string is already in ${langName}, translate it to a more natural form
9. For technical terms, provide appropriate ${langName} translations

TRANSLATION APPROACH:
- Read the entire JSON structure carefully
- Translate EVERY string value to ${langName}
- Keep keys unchanged (left side of colon)
- Translate values appropriately (right side of colon)
- Preserve any special characters or formatting in values

EXAMPLES:
Input:  {"common": {"loading": "Loading..."}}
Output: {"common": {"loading": "Cargando..."}}

Input:  {"user": {"name": "Name", "email": "Email", "save": "Save"}}
Output: {"user": {"name": "Nombre", "email": "Correo electrónico", "save": "Guardar"}}

Input:  {"errors": {"required": "This field is required"}}
Output: {"errors": {"required": "Este campo es obligatorio"}}

NEVER DO THIS:
✗ Change "loading" to "cargando" (key changed)
✗ Change "user.name" to "userName" (key format changed)  
✗ Leave any string values untranslated
✗ Add or remove any keys
✗ Reorder keys

Remember: Every single string value must be translated to ${langName}. The JSON structure and all keys must remain identical.

JSON to translate:
${contentForLang}`;

                             // Retry logic for failed translations
               const maxRetries = 2;
               let lastError: Error | null = null;
               
               for (let attempt = 1; attempt <= maxRetries; attempt++) {
                 try {
                   console.log(`[Translation] ${langName} - Attempt ${attempt}/${maxRetries}`);
                   const startTime = Date.now();
                   
                   // Create AbortController for timeout handling
                   const controller = new AbortController();
                   const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
                   
                   const apiResponse = await fetch('/api/translate', {
                     method: 'POST',
                     headers: {
                       'Content-Type': 'application/json',
                     },
                     body: JSON.stringify({
                       apiKey,
                       model: actualModel,
                       prompt: singlePrompt,
                       isJson: true
                     }),
                     signal: controller.signal
                   });

                   clearTimeout(timeoutId);

                   if (!apiResponse.ok) {
                     const errorData = await apiResponse.json();
                     throw new Error(errorData.error || `API call failed with status ${apiResponse.status}`);
                   }

                   const data = await apiResponse.json();
                   const translatedText = data.text;
                   const duration = Date.now() - startTime;
                   
                   console.log(`[Translation] API call for ${langName} took ${duration}ms`);
                   
                   // Validate response is not empty
                   if (!translatedText || translatedText.trim().length === 0) {
                     throw new Error('Empty response from translation API');
                   }
                   
                   // Clean and merge if needed
                   const cleanedText = cleanResponse(translatedText, fileType);
                   
                   // Additional validation for JSON
                   if (fileType === 'json') {
                     try {
                       JSON.parse(cleanedText);
                     } catch (parseErr) {
                       throw new Error(`Invalid JSON response: ${parseErr instanceof Error ? parseErr.message : 'Parse failed'}`);
                     }
                   }
                   
                   let finalContent = cleanedText;
                   
                   if (mergeMode && existing && missingKeys.length > 0) {
                     finalContent = mergeTranslations(existing, cleanedText, fileType);
                   }
                   
                   return {
                     language: langName,
                     languageCode: langCode,
                     content: finalContent,
                     audit: auditTranslation(contentToTranslate, finalContent, fileType)
                   } as TranslationResult;
                   
                 } catch (err) {
                   lastError = err instanceof Error ? err : new Error('Translation failed');
                   console.error(`[Translation] ${langName} - Attempt ${attempt} failed:`, lastError.message);
                   
                   // If this was an abort/timeout, don't retry
                   if (lastError.name === 'AbortError' || lastError.message.includes('aborted')) {
                     console.error(`[Translation] ${langName} - Request timed out, skipping retries`);
                     break;
                   }
                   
                   // Wait before retry (exponential backoff)
                   if (attempt < maxRetries) {
                     const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
                     console.log(`[Translation] ${langName} - Waiting ${waitTime}ms before retry...`);
                     await new Promise(resolve => setTimeout(resolve, waitTime));
                   }
                 }
               }
               
               // All retries failed
               console.error(`[Translation] ${langName} - All ${maxRetries} attempts failed`);
               return {
                 language: langName,
                 languageCode: langCode,
                 content: `Error: ${lastError?.message || 'Translation failed after multiple attempts'}`,
                 audit: {
                   totalKeys: 0,
                   translatedKeys: 0,
                   untranslatedKeys: [`[ERROR] ${lastError?.message || 'Translation failed after multiple attempts'}`],
                   possiblyUntranslated: []
                 }
               } as TranslationResult;
            }));
            
            allResults.push(...batchResults);
            setTranslationProgress({ completed: allResults.length, total: selectedLanguageCodes.length });
            setTranslations([...allResults]);
            continue;
          } else {
            // For XML and Xcode strings, use bulk translation
            bulkPrompt = `
You are a professional translator. Translate the following ${fileType} localization file to multiple languages.
${context ? `Context about the app: ${context}` : ''}

Important instructions:
1. Maintain the exact same file structure and format for each language
2. Only translate the text values, not the keys or identifiers
3. Make the translations sound natural in each language
4. Keep any placeholders, variables, or formatting codes intact
5. For XML files: only translate content inside string tags
6. For Xcode strings: only translate the text after the = sign
7. Translate ALL strings for each language

Original content:
${contentToTranslate}

Please provide translations for the following languages:
${languagesToTranslate.map(code => `- ${getLanguageName(code)} (${code})`).join('\n')}

Format your response as follows:
[LANGUAGE: language_code]
translated content here
[END]

Make sure each translation maintains the exact same structure as the original.`;
          }
          
          // For text and XML/Xcode, use bulk translation
          if (fileType === 'text' || fileType === 'xml' || fileType === 'xcode') {
            let bulkResponse = '';
            let duration = 0;
            
            // Retry logic for bulk translation
            const maxRetries = 2;
            let lastError: Error | null = null;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                console.log(`[Translation] Bulk translation - Attempt ${attempt}/${maxRetries} for ${languagesToTranslate.length} languages`);
                const startTime = Date.now();
                
                // Create AbortController for timeout handling (longer timeout for bulk)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for bulk
                
                const apiResponse = await fetch('/api/translate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    apiKey,
                    model: actualModel,
                    prompt: bulkPrompt,
                    isJson: false,
                    isBulk: true,
                    languages: languagesToTranslate
                  }),
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!apiResponse.ok) {
                  const errorData = await apiResponse.json();
                  throw new Error(errorData.error || `API call failed with status ${apiResponse.status}`);
                }

                const data = await apiResponse.json();
                bulkResponse = data.text;
                duration = Date.now() - startTime;
                
                console.log(`[Translation] Bulk API call took ${duration}ms`);
                console.log(`[Translation] Bulk response length:`, bulkResponse.length);
                
                // Validate response is not empty
                if (!bulkResponse || bulkResponse.trim().length === 0) {
                  throw new Error('Empty response from bulk translation API');
                }
                
                // Success, break out of retry loop
                break;
                
              } catch (err) {
                lastError = err instanceof Error ? err : new Error('Bulk translation failed');
                console.error(`[Translation] Bulk translation - Attempt ${attempt} failed:`, lastError.message);
                
                // If this was an abort/timeout, don't retry
                if (lastError.name === 'AbortError' || lastError.message.includes('aborted')) {
                  console.error(`[Translation] Bulk translation - Request timed out, skipping retries`);
                  break;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                  const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s...
                  console.log(`[Translation] Bulk translation - Waiting ${waitTime}ms before retry...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              }
            }
            
            // If all retries failed, throw error to be handled by batch error logic
            if (!bulkResponse && lastError) {
              throw lastError;
            }
            
            // Parse bulk response
            const translationRegex = /\[LANGUAGE:\s*([^\]]+)\]([\s\S]*?)\[END\]/g;
            let match;
            const parsedTranslations = new Map<string, string>();
            
            while ((match = translationRegex.exec(bulkResponse)) !== null) {
              const langCode = match[1].trim();
              const translation = match[2].trim();
              parsedTranslations.set(langCode, translation);
            }
            
            console.log(`[Translation] Parsed ${parsedTranslations.size} translations from bulk response`);
            
            // Process each parsed translation
            for (const langCode of languagesToTranslate) {
              const langName = getLanguageName(langCode);
              const translation = parsedTranslations.get(langCode);
              
              if (!translation) {
                console.error(`[Translation] No translation found for ${langName} in bulk response`);
                allResults.push({
                  language: langName,
                  languageCode: langCode,
                  content: `Error: No translation found in bulk response`,
                  audit: {
                    totalKeys: 0,
                    translatedKeys: 0,
                    untranslatedKeys: [`[ERROR] No translation found in bulk response`],
                    possiblyUntranslated: []
                  }
                });
                continue;
              }
              
              // Clean the response
              const cleanedText = cleanResponse(translation, fileType);
              
              // Merge with existing if needed
              const { existing, missingKeys } = preparedContents.get(langCode)!;
              let finalContent = cleanedText;
              
              if (mergeMode && existing && missingKeys.length > 0) {
                finalContent = mergeTranslations(existing, cleanedText, fileType);
              }
              
              allResults.push({
                language: langName,
                languageCode: langCode,
                content: finalContent,
                audit: fileType !== 'text' ? auditTranslation(contentToTranslate, finalContent, fileType) : undefined
              });
            }
          }
          
          // Update progress
          setTranslationProgress({ completed: allResults.length, total: selectedLanguageCodes.length });
          setTranslations([...allResults]);
          
        } catch (err) {
          console.error(`[Translation] Error in batch ${batchNumber}:`, err);
          
          // Add error results for all languages in this batch
          for (const langCode of languageBatch) {
            const langName = getLanguageName(langCode);
            allResults.push({
              language: langName,
              languageCode: langCode,
              content: `Error: ${err instanceof Error ? err.message : 'Translation failed'}`,
              audit: {
                totalKeys: 0,
                translatedKeys: 0,
                untranslatedKeys: [`[ERROR] ${err instanceof Error ? err.message : 'Translation failed'}`],
                possiblyUntranslated: []
              }
            });
          }
          
          setTranslationProgress({ completed: allResults.length, total: selectedLanguageCodes.length });
          setTranslations([...allResults]);
        }
        
        // Add a small delay between batches to avoid rate limiting
        if (batchIndex < languageBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      setCurrentTranslatingLang('');
      console.log('[Translation] All bulk translations completed');
      
      // Count successful translations
      const successCount = allResults.filter(r => !r.content.startsWith('Error:')).length;
      console.log(`[Translation] Successfully translated to ${successCount}/${allResults.length} languages`);
      
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

  const findMissingKeys = (originalContent: string, existingTranslation: any, fileType: FileType): string[] => {
    const missingKeys: string[] = [];

    try {
      if (fileType === 'json') {
        const originalJson = JSON.parse(originalContent);
        
        const checkMissingKeys = (origObj: any, transObj: any, path: string = '') => {
          for (const key in origObj) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof origObj[key] === 'object' && origObj[key] !== null) {
              if (!transObj || !transObj[key] || typeof transObj[key] !== 'object') {
                missingKeys.push(currentPath);
              } else {
                checkMissingKeys(origObj[key], transObj[key], currentPath);
              }
            } else if (typeof origObj[key] === 'string') {
              if (!transObj || !transObj[key] || transObj[key] === origObj[key]) {
                missingKeys.push(currentPath);
              }
            }
          }
        };
        
        checkMissingKeys(originalJson, existingTranslation);
      } else if (fileType === 'xml') {
        // Extract string entries from original XML
        const originalStrings = new Map<string, string>();
        const xmlRegex = /<string\s+name="([^"]+)">([^<]*)<\/string>/g;
        let match;
        
        while ((match = xmlRegex.exec(originalContent)) !== null) {
          originalStrings.set(match[1], match[2]);
        }
        
        // Extract existing translations
        const existingStrings = new Map<string, string>();
        if (typeof existingTranslation === 'string') {
          xmlRegex.lastIndex = 0;
          while ((match = xmlRegex.exec(existingTranslation)) !== null) {
            existingStrings.set(match[1], match[2]);
          }
        }
        
        // Find missing keys
        for (const [key, value] of originalStrings) {
          if (!existingStrings.has(key) || existingStrings.get(key) === value) {
            missingKeys.push(key);
          }
        }
      } else if (fileType === 'xcode') {
        // Extract string entries from original Xcode strings
        const originalStrings = new Map<string, string>();
        const stringsRegex = /"([^"]+)"\s*=\s*"([^"]*)"/g;
        let match;
        
        while ((match = stringsRegex.exec(originalContent)) !== null) {
          originalStrings.set(match[1], match[2]);
        }
        
        // Extract existing translations
        const existingStrings = new Map<string, string>();
        if (typeof existingTranslation === 'string') {
          stringsRegex.lastIndex = 0;
          while ((match = stringsRegex.exec(existingTranslation)) !== null) {
            existingStrings.set(match[1], match[2]);
          }
        }
        
        // Find missing keys
        for (const [key, value] of originalStrings) {
          if (!existingStrings.has(key) || existingStrings.get(key) === value) {
            missingKeys.push(key);
          }
        }
      }
    } catch (err) {
      console.error('[MissingKeys] Error finding missing keys:', err);
    }

    return missingKeys;
  };

  const createPartialContentForTranslation = (originalContent: string, missingKeys: string[], fileType: FileType): string => {
    if (fileType === 'json') {
      try {
        const originalJson = JSON.parse(originalContent);
        const partialJson: any = {};
        
        // Build partial JSON with only missing keys
        for (const keyPath of missingKeys) {
          const keys = keyPath.split('.');
          let current = partialJson;
          let originalCurrent = originalJson;
          
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            
            if (i === keys.length - 1) {
              // Last key, set the value
              current[key] = originalCurrent[key];
            } else {
              // Intermediate key, create object if needed
              if (!current[key]) {
                current[key] = {};
              }
              current = current[key];
              originalCurrent = originalCurrent[key];
            }
          }
        }
        
        return JSON.stringify(partialJson, null, 2);
      } catch (err) {
        console.error('[PartialContent] Error creating partial JSON:', err);
        return originalContent;
      }
    } else if (fileType === 'xml') {
      // Create XML with only missing keys
      const lines = ['<?xml version="1.0" encoding="utf-8"?>', '<resources>'];
      
      const xmlRegex = /<string\s+name="([^"]+)">([^<]*)<\/string>/g;
      let match;
      
      while ((match = xmlRegex.exec(originalContent)) !== null) {
        if (missingKeys.includes(match[1])) {
          lines.push(`    <string name="${match[1]}">${match[2]}</string>`);
        }
      }
      
      lines.push('</resources>');
      return lines.join('\n');
    } else if (fileType === 'xcode') {
      // Create Xcode strings with only missing keys
      const lines: string[] = [];
      
      const stringsRegex = /"([^"]+)"\s*=\s*"([^"]*)"/g;
      let match;
      
      while ((match = stringsRegex.exec(originalContent)) !== null) {
        if (missingKeys.includes(match[1])) {
          lines.push(`"${match[1]}" = "${match[2]}";`);
        }
      }
      
      return lines.join('\n');
    }
    
    return originalContent;
  };

  const mergeTranslations = (originalTranslation: any, newTranslation: string, fileType: FileType): string => {
    try {
      if (fileType === 'json') {
        const newJson = JSON.parse(cleanResponse(newTranslation, fileType));
        
        // Deep merge function
        const deepMerge = (target: any, source: any): any => {
          const result = { ...target };
          
          for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
              result[key] = source[key];
            }
          }
          
          return result;
        };
        
        const merged = deepMerge(originalTranslation, newJson);
        return JSON.stringify(merged, null, 2);
      } else if (fileType === 'xml') {
        // Parse existing XML strings
        const existingStrings = new Map<string, string>();
        if (typeof originalTranslation === 'string') {
          const xmlRegex = /<string\s+name="([^"]+)">([^<]*)<\/string>/g;
          let match;
          while ((match = xmlRegex.exec(originalTranslation)) !== null) {
            existingStrings.set(match[1], match[2]);
          }
        }
        
        // Parse new translations
        const newStrings = new Map<string, string>();
        const cleanedNew = cleanResponse(newTranslation, fileType);
        const xmlRegex = /<string\s+name="([^"]+)">([^<]*)<\/string>/g;
        let match;
        while ((match = xmlRegex.exec(cleanedNew)) !== null) {
          newStrings.set(match[1], match[2]);
        }
        
        // Merge
        for (const [key, value] of newStrings) {
          existingStrings.set(key, value);
        }
        
        // Rebuild XML
        const lines = ['<?xml version="1.0" encoding="utf-8"?>', '<resources>'];
        for (const [key, value] of existingStrings) {
          lines.push(`    <string name="${key}">${value}</string>`);
        }
        lines.push('</resources>');
        
        return lines.join('\n');
      } else if (fileType === 'xcode') {
        // Similar logic for Xcode strings
        const existingStrings = new Map<string, string>();
        if (typeof originalTranslation === 'string') {
          const stringsRegex = /"([^"]+)"\s*=\s*"([^"]*)"/g;
          let match;
          while ((match = stringsRegex.exec(originalTranslation)) !== null) {
            existingStrings.set(match[1], match[2]);
          }
        }
        
        // Parse new translations
        const newStrings = new Map<string, string>();
        const cleanedNew = cleanResponse(newTranslation, fileType);
        const stringsRegex = /"([^"]+)"\s*=\s*"([^"]*)"/g;
        let match;
        while ((match = stringsRegex.exec(cleanedNew)) !== null) {
          newStrings.set(match[1], match[2]);
        }
        
        // Merge
        for (const [key, value] of newStrings) {
          existingStrings.set(key, value);
        }
        
        // Rebuild strings file
        const lines: string[] = [];
        for (const [key, value] of existingStrings) {
          lines.push(`"${key}" = "${value}";`);
        }
        
        return lines.join('\n');
      }
    } catch (err) {
      console.error('[MergeTranslations] Error merging translations:', err);
    }
    
    return newTranslation;
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
          Translation Mode:
          <div className={styles.modeInfo}>
            <div className={styles.bulkMode}>
              <span className={styles.bulkIcon}>🚀</span>
              <span className={styles.bulkText}>Bulk Translation Enabled</span>
            </div>
            <span className={styles.hint}>
              Translations are processed in batches to minimize API calls and avoid rate limits.
              Multiple languages are translated together in each request.
            </span>
          </div>
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
        <>
          <div className={styles.section}>
            <label className={styles.label}>
              Upload Main File:
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".json,.xml,.strings"
                className={styles.fileInput}
              />
            </label>
          </div>

          <div className={styles.section}>
            <label className={styles.label}>
              Upload Existing Translations (Optional):
            </label>
            
            <div 
              className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={styles.dropZoneContent}>
                <div className={styles.dropZoneIcon}>📁</div>
                <div className={styles.dropZoneText}>
                  <strong>Drag & drop your translations folder here</strong>
                  <br />
                  or individual translation files
                </div>
                <div className={styles.dropZoneSubtext}>
                  Supports: .json, .xml, .strings files
                  <br />
                  Files should be named with language codes (es.json, fr.xml, etc.)
                </div>
                <div className={styles.dropZoneOr}>or</div>
                <input
                  type="file"
                  onChange={handleExistingTranslationsUpload}
                  accept=".json,.xml,.strings"
                  multiple
                  className={styles.fileInput}
                  id="existing-translations-input"
                  {...({ webkitdirectory: "" } as any)}
                />
                <label htmlFor="existing-translations-input" className={styles.browseButton}>
                  Browse Files/Folder
                </label>
              </div>
            </div>
            
            {existingTranslations.size > 0 && (
              <div className={styles.existingTranslationsInfo}>
                <h4>Loaded Existing Translations ({existingTranslations.size}):</h4>
                <div className={styles.existingLanguagesList}>
                  {Array.from(existingTranslations.keys()).map((code) => {
                    const language = getLanguageByCode(code);
                    return (
                      <div key={code} className={styles.existingLanguageTag}>
                        {language ? `${language.name} (${code})` : code}
                        <button
                          onClick={() => {
                            const newMap = new Map(existingTranslations);
                            newMap.delete(code);
                            setExistingTranslations(newMap);
                            if (newMap.size === 0) {
                              setMergeMode(false);
                            }
                          }}
                          className={styles.removeButton}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setExistingTranslations(new Map());
                    setMergeMode(false);
                  }}
                  className={styles.clearButton}
                  type="button"
                >
                  Clear All Existing Translations
                </button>
              </div>
            )}
          </div>
        </>
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
            <div className={styles.progressHeader}>
              <span className={styles.progressText}>
                {translationProgress.completed} / {translationProgress.total} languages completed
              </span>
              <span className={styles.progressPercent}>
                {Math.round((translationProgress.completed / translationProgress.total) * 100)}%
              </span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${(translationProgress.completed / translationProgress.total) * 100}%` }}
              />
            </div>
            <div className={styles.progressDetails}>
              <span className={styles.progressStatus}>
                {currentTranslatingLang}
              </span>
            </div>
          </div>
        )}
      </div>

      {translations.length > 0 && (
        <div className={styles.translationsContainer}>
          <h2>Translations {mergeMode && '(Merged with Existing)'}</h2>
          {translations.map((translation, index) => {
            const existingTranslation = existingTranslations.get(translation.languageCode);
            const hadExisting = mergeMode && existingTranslation;
            
            return (
              <div key={index} className={styles.translationSection}>
                <div className={styles.translationHeader}>
                  <h3>
                    {translation.language}
                    {hadExisting && (
                      <span className={styles.mergeIndicator}> (Merged)</span>
                    )}
                  </h3>
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
                    {hadExisting && (
                      <span className={styles.miniAuditItem + ' ' + styles.info}>
                        🔄 Merged with existing translation
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
            );
          })}
        </div>
      )}
    </main>
  );
}
