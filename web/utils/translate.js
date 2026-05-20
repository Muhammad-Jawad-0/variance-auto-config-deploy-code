// Translation using Google Translate REST API with API key
const translationCache = new Map();

const API_KEY = "AIzaSyBRgf-QlMNW1PFdC3XCqV2uzHXcUdfcDJo";

async function translateText(text, targetLang) {
    if (!text || typeof text !== 'string') return text;
    if (!targetLang ) return text;

    const cacheKey = `${text}|${targetLang}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    try {
        // Google Translate REST API
        const url = `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text,
                source: 'fr',      // Variance API mostly French
                target: targetLang,
                format: 'text'
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error(`API Error: ${data.error.message}`);
            return text;
        }
        
        const translated = data.data.translations[0].translatedText;
        translationCache.set(cacheKey, translated);
        return translated;
        
    } catch (error) {
        console.error(`Translation failed: ${error.message}`);
        return text;
    }
}

export async function translateDeep(data, targetLang) {
    if (!targetLang) return data;

    if (Array.isArray(data)) {
        return Promise.all(data.map(item => translateDeep(item, targetLang)));
    }

    if (data && typeof data === 'object') {
        const translatedObj = {};
        for (const [key, value] of Object.entries(data)) {
            const textFields = ['titre', 'label', 'name', 'description', 'nom', 'version', 'carrosserie', 'marque', 'modele'];
            
            if (textFields.includes(key) && typeof value === 'string') {
                translatedObj[key] = await translateText(value, targetLang);
            }
            else if (typeof value === 'string' && 
                     key !== 'reference' && 
                     key !== 'url' && 
                     !key.includes('_id') && 
                     key !== 'id' &&
                     value.length > 0 && 
                     !value.startsWith('http') && 
                     !value.startsWith('https') && 
                     !/^\d+$/.test(value) &&
                     !value.includes('gid://')) {
                translatedObj[key] = await translateText(value, targetLang);
            }
            else {
                translatedObj[key] = await translateDeep(value, targetLang);
            }
        }
        return translatedObj;
    }
    return data;
}

export { translateText  };