# String Asset Translator

A Next.js application that uses Google's Gemini AI to translate localization files (JSON, XML, Xcode strings) and text content into multiple languages.

## Features

- **Multiple File Format Support**: JSON, Android XML, Xcode strings, and plain text
- **Language Tags Selection**: Choose from 70+ popular languages with an easy-to-use tag interface
- **Parallel Translation**: Translate to multiple languages simultaneously with configurable concurrency
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

1. **Enter your Gemini API Key**: Required for translation services
2. **Select AI Model**: Choose from Gemini Flash (recommended), Pro, or enter a custom model
3. **Set Concurrent Translations**: Adjust the slider (1-20) to control parallel processing
   - Higher values = faster translation but may hit API rate limits
   - Recommended: 5-10 for most systems, 10-15 for high-end systems like Ryzen 9
4. **Choose Translation Mode**: 
   - JSON for Next.js/React localization files
   - XML for Android strings
   - Xcode for iOS localization
   - Text for direct text translation
5. **Select Target Languages**: Click on language tags to select/deselect languages
6. **Upload File or Enter Text**: Depending on your mode
7. **Add Context** (optional): Describe your app for better translations
8. **Click Translate**: The app will translate to all selected languages in parallel

### Parallel Translation

The app now supports parallel translation processing to significantly speed up multi-language translations:

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

### File Naming Convention

Downloaded files use language codes for easy integration:
- JSON files: `{languageCode}.json` (e.g., `es.json`, `fr.json`, `zh-TW.json`)
- Other formats: `translated_{languageCode}.{extension}` (e.g., `translated_es.xml`)

## Translation Quality

The app includes an audit system for JSON translations that checks:
- ✓ All keys are present in the translation
- ✓ All values have been translated (not left in original language)
- ⚠️ Potential untranslated strings (same as original)
- ❌ Missing translations

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
