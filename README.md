# String Asset Translator

A Next.js application that uses Google's Gemini AI to translate localization files (JSON, XML, Xcode strings) and text content into multiple languages.

## Features

- **Multiple File Format Support**: JSON, React JS/TS modules, Android XML, Xcode strings, and plain text
- **Language Tags Selection**: Choose from 70+ popular languages with an easy-to-use tag interface
- **Parallel Translation**: Translate to multiple languages simultaneously with configurable concurrency
- **Smart Merge Mode**: Upload existing translations and only translate missing keys
- **Smart File Naming**: Downloads use language codes (e.g., `es.json`, `fr.json`) for easy integration
- **Translation Audit**: Automatic validation of translated JSON files to ensure all keys are translated
- **Multiple AI Models**: Support for various Gemini models including Flash, Pro, and custom models
- **Context-Aware**: Add app context for better translation quality
- **Persistent Settings**: Saves your API key, selected languages, model preferences, and concurrency settings
- **Progress Tracking**: Real-time progress bar showing translation completion status

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Google Gemini API key (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))

### Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd translator-app

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Basic Translation

1. **Enter your Gemini API Key**: Required for translation services
2. **Select AI Model**: Choose from Gemini Flash (recommended), Pro, or enter a custom model
3. **Set Concurrent Translations**: Adjust the slider (1-20) to control parallel processing
4. **Choose Translation Mode**: JSON, React module, XML, Xcode, or Text
5. **Upload Main File**: Your source localization file
6. **Select Target Languages**: Click on language tags to select/deselect languages
7. **Add Context** (optional): Describe your app for better translations
8. **Click Translate**: The app will translate to all selected languages in parallel

### Smart Merge Mode (Recommended Workflow)

For the most efficient workflow when you have existing translations:

1. **Upload Main File**: Your updated source file (e.g., `en.json`)
2. **Upload Existing Translations**: 
   - **Drag & Drop**: Simply drag your entire translations folder into the drop zone
   - **Browse**: Click "Browse Files/Folder" to select multiple files or a folder
   - **Auto-Detection**: The app automatically detects language codes from filenames
   - **Bulk Upload**: Upload dozens of translation files at once
   - **React Modules**: Works with JS/TS locale files that export objects (e.g. `export default { ... }`)
3. **Auto-Selection**: Languages with existing translations are automatically selected
4. **Smart Translation**: Only missing or untranslated keys are sent to the AI
5. **Merged Results**: Get complete translation files with existing + new translations

#### Drag & Drop Features:
- **Folder Upload**: Drag your entire `/translations` or `/locales` folder
- **Multi-File Upload**: Drag multiple individual files at once
- **Smart Filtering**: Automatically ignores non-translation files
- **Visual Feedback**: Clear drag-over indication and file count
- **Error Handling**: Shows helpful messages for invalid files

#### Benefits of Merge Mode:
- **Faster**: Only translates what's needed
- **Cost-Effective**: Fewer API calls = lower costs
- **Preserves Quality**: Keeps your existing good translations
- **Incremental Updates**: Perfect for adding new features to existing apps
- **Bulk Processing**: Handle entire translation folders effortlessly

### File Naming Convention

The app automatically detects language codes from filenames:
- `es.json`, `fr.json`, `de.json` → `es`, `fr`, `de`
- `translated_es.xml`, `translated_fr.xml` → `es`, `fr`
- `Localizable_es.strings` → `es`
- `common.en.ts`, `fr.ts`, `messages-pt_BR.ts` → `en`, `fr`, `pt-BR`
- `zh-TW.json`, `en-US.json` → `zh-TW`, `en-US` (supports region codes)

Downloaded files use the same language code format for easy integration.

### Parallel Translation

The app supports parallel translation processing to significantly speed up multi-language translations:

- **Configurable Concurrency**: Set between 1-20 concurrent translations
- **Batch Processing**: Languages are processed in batches to respect the concurrent limit
- **Progress Tracking**: Real-time progress bar shows completion status
- **Optimized for Performance**: Takes advantage of modern multi-core processors
- **Rate Limit Protection**: Prevents overwhelming the API with too many simultaneous requests

For systems with powerful processors (like Ryzen 9 7900 with 64GB RAM), you can safely increase the concurrent limit to 10-15 for optimal performance.

### Language Selection

The app includes 70+ popular languages organized by region:
- **European**: Spanish, French, German, Italian, Portuguese, Dutch, Polish, Russian, etc.
- **Asian**: Chinese (Simplified/Traditional), Japanese, Korean, Vietnamese, Thai, Hindi, etc.
- **Middle Eastern**: Arabic, Hebrew, Persian
- **Others**: Swahili, Filipino, Estonian, Georgian, etc.

Selected languages are saved automatically and restored on your next visit.

## Translation Quality

The app includes an audit system for JSON translations that checks:
- ✓ All keys are present in the translation
- ✓ All values have been translated (not left in original language)
- ⚠️ Potential untranslated strings (same as original)
- ❌ Missing translations
- 🔄 Merge status (when using existing translations)

## API Configuration

The app supports multiple Gemini models:
- **Gemini 1.5 Flash** (Recommended): Fast and efficient
- **Gemini 1.5 Flash-8B**: Even faster, smaller model
- **Gemini 1.5 Pro**: Most capable, best quality
- **Gemini 1.0 Pro**: Stable version
- **Custom Model**: Enter any Gemini model name

## Performance Tips

- **For faster translations**: Increase the concurrent limit (10-15 for high-end systems)
- **For API stability**: Keep concurrent limit at 5-10
- **For large files**: Consider splitting into smaller chunks
- **For many languages**: The parallel processing will significantly reduce total time
- **For existing projects**: Use merge mode to only translate new/missing keys

## Workflow Examples

### New Project
1. Upload your source file (e.g., `en.json`)
2. Select target languages
3. Translate all languages from scratch

### Existing Project with Updates
1. Upload updated source file
2. Upload existing translation files
3. App automatically finds missing keys
4. Only translates what's new/missing
5. Download merged, complete files

### Bulk Folder Upload (Fastest)
1. Upload your updated source file (e.g., `en.json`)
2. Drag your entire `/translations` folder into the drop zone
3. App processes all files automatically (es.json, fr.json, de.json, etc.)
4. Missing keys are identified across all languages
5. Parallel translation of only missing keys
6. Download updated complete translation files

### Adding New Language
1. Upload source file
2. Select new language (existing translations optional)
3. Get complete translation for new language

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety
- **Google Generative AI**: Gemini API for translations
- **CSS Modules**: Scoped styling

## License

MIT
