import fetch from "node-fetch";
import { translateDeep } from "../utils/translate.js";

// Configuration
const BASE_URL = "http://api.variance-auto.com/obtenir";
const API_KEY = "Tool4Sign2026!";


// Helper function to build URL with API key
const buildUrl = (endpoint, params = {}) => {
    const urlParams = new URLSearchParams({
        cle: API_KEY,
        ...params
    });
    return `${BASE_URL}/${endpoint}?${urlParams.toString()}`;
};

// Helper function for making API calls with translation
const callVarianceApi = async (url, res, errorMessage, targetLang = 'en') => {
    try {
        console.log(`Calling Variance API: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({
                error: errorMessage,
                status: response.status,
                details: await response.text()
            });
        }

        const data = await response.json();
        const translatedData = await translateDeep(data, targetLang);
        return res.json(translatedData);

    } catch (error) {
        console.error(`${errorMessage}:`, error.message);
        return res.status(500).json({
            error: errorMessage,
            message: error.message,
            url: url
        });
    }
};

export const getBrands = async (req, res) => {
    const targetLang = req.query.lang || 'en';
    const url = buildUrl("marque");
    return callVarianceApi(url, res, "Failed to fetch brands", targetLang);
};

export const getModelsByBrand = async (req, res) => {
    const { marque_id, lang = 'en' } = req.query;

    if (!marque_id) {
        return res.status(400).json({
            error: "Missing required parameter: marque_id"
        });
    }

    const url = buildUrl("modele", { marque_id });
    return callVarianceApi(url, res, "Failed to fetch models", lang);
};

export const getDeclinaisonsByModel = async (req, res) => {
    const { modele_id, lang = 'en' } = req.query;

    if (!modele_id) {
        return res.status(400).json({
            error: "Missing required parameter: modele_id"
        });
    }

    const url = buildUrl("declinaison", { modele_id });
    return callVarianceApi(url, res, "Failed to fetch declinaisons", lang);
};

export const getKitsByDeclinaison = async (req, res) => {
    const { declinaison_id, lang = 'en' } = req.query;

    if (!declinaison_id) {
        return res.status(400).json({
            error: "Missing required parameter: declinaison_id"
        });
    }

    const url = buildUrl("vitre", { declinaison_id });
    return callVarianceApi(url, res, "Failed to fetch kits", lang);
};

export const getFilmsByDeclinaisonAndKit = async (req, res) => {
    const { declinaison_id, vitre_id, lang = 'en' } = req.query;

    if (!declinaison_id || !vitre_id) {
        return res.status(400).json({
            error: "Missing required parameters: declinaison_id and vitre_id"
        });
    }

    const url = buildUrl("film", { declinaison_id, vitre_id });
    return callVarianceApi(url, res, "Failed to fetch films", lang);
};

export const getFilmDetail = async (req, res) => {
    const { declinaison_id, vitre_id, film_id, lang = 'en' } = req.query;

    if (!declinaison_id || !vitre_id || !film_id) {
        return res.status(400).json({
            error: "Missing required parameters: declinaison_id, vitre_id, and film_id"
        });
    }

    const url = buildUrl("film", { declinaison_id, vitre_id, film_id });
    return callVarianceApi(url, res, "Failed to fetch film details", lang);
};

export const getPdfMapping = async (req, res) => {
    const { film_id, label, custom_id, lang = 'en' } = req.query;

    if (!film_id && !label && !custom_id) {
        return res.status(400).json({
            error: "Missing required parameters: film_id, label or custom_id"
        });
    }

    try {
        // ✅ New mapping based on custom_id
        const pdfMappingById = {
            "film_donker_5": {
                url: "https://cdn.shopify.com/s/files/1/1001/4556/1890/files/Donker_5.pdf?v=1780323478",
                name: "Donker 5% Technical Sheet"
            },
            "film_extreem_helder_70": {
                url: "https://cdn.shopify.com/s/files/1/1001/4556/1890/files/Extreem_helder_70.pdf?v=1780323516",
                name: "Extreem helder 70% Technical Sheet"
            },
            "film_licht_helder_35": {
                url: "https://cdn.shopify.com/s/files/1/1001/4556/1890/files/Licht_helder_35.pdf?v=1780323580",
                name: "Licht helder 35% Technical Sheet"
            },
            "film_medium_25": {
                url: "https://cdn.shopify.com/s/files/1/1001/4556/1890/files/Medium_25.pdf?v=1780323606",
                name: "Medium 25% Technical Sheet"
            },
            "film_medium_plus_15": {
                url: "https://cdn.shopify.com/s/files/1/1001/4556/1890/files/Medium_plus_15.pdf?v=1780323640",
                name: "Medium plus 15% Technical Sheet"
            }
        };

        let pdfInfo = null;
        
        // First try by custom_id
        if (custom_id && pdfMappingById[custom_id]) {
            pdfInfo = pdfMappingById[custom_id];
        }
        // Then try by film_id (original API ID)
        else if (film_id) {
            const oldMapping = {
                "55": pdfMappingById["film_donker_5"],
                "67": pdfMappingById["film_extreem_helder_70"],
                "89": pdfMappingById["film_medium_25"]
            };
            pdfInfo = oldMapping[film_id];
        }
        // Finally try by label (fallback)
        else if (label) {
            const labelLower = label.toLowerCase();
            if (labelLower.includes("donker") || labelLower.includes("dark")) {
                pdfInfo = pdfMappingById["film_donker_5"];
            } else if (labelLower.includes("extreem") || labelLower.includes("helder") || labelLower.includes("70")) {
                pdfInfo = pdfMappingById["film_extreem_helder_70"];
            } else if (labelLower.includes("licht") || labelLower.includes("35")) {
                pdfInfo = pdfMappingById["film_licht_helder_35"];
            } else if (labelLower.includes("medium 25") || labelLower.includes("25%")) {
                pdfInfo = pdfMappingById["film_medium_25"];
            } else if (labelLower.includes("medium plus") || labelLower.includes("15%")) {
                pdfInfo = pdfMappingById["film_medium_plus_15"];
            }
        }

        let result;
        if (pdfInfo && pdfInfo.url) {
            result = {
                success: true,
                pdfUrl: pdfInfo.url,
                pdfName: pdfInfo.name,
                customId: custom_id,
                filmId: film_id,
                filmLabel: label
            };
        } else {
            result = {
                success: false,
                pdfUrl: null,
                message: "No technical sheet available for this tint"
            };
        }

        const translatedResult = await translateDeep(result, lang);
        return res.json(translatedResult);
    } catch (error) {
        console.error("PDF mapping error:", error);
        return res.status(500).json({
            error: "Failed to fetch PDF mapping",
            message: error.message
        });
    }
};

export const getFullConfiguration = async (req, res) => {
    const { marque_id, modele_id, declinaison_id, vitre_id, film_id, lang = 'en' } = req.query;

    try {
        const result = {};

        if (marque_id) {
            const modelsUrl = buildUrl("modele", { marque_id });
            const modelsRes = await fetch(modelsUrl);
            result.models = await modelsRes.json();
        }

        if (modele_id) {
            const declinaisonsUrl = buildUrl("declinaison", { modele_id });
            const declinaisonsRes = await fetch(declinaisonsUrl);
            result.declinaisons = await declinaisonsRes.json();
        }

        if (declinaison_id) {
            const kitsUrl = buildUrl("vitre", { declinaison_id });
            const kitsRes = await fetch(kitsUrl);
            result.kits = await kitsRes.json();
        }

        if (declinaison_id && vitre_id) {
            const filmsUrl = buildUrl("film", { declinaison_id, vitre_id });
            const filmsRes = await fetch(filmsUrl);
            result.films = await filmsRes.json();
        }

        if (declinaison_id && vitre_id && film_id) {
            const detailUrl = buildUrl("film", { declinaison_id, vitre_id, film_id });
            const detailRes = await fetch(detailUrl);
            result.detail = await detailRes.json();
        }

        const translatedResult = await translateDeep(result, lang);
        return res.json(translatedResult);

    } catch (error) {
        console.error("Failed to fetch full configuration:", error);
        return res.status(500).json({ error: "Failed to fetch configuration" });
    }
};

// =============================

export const textTranslate = async (req, res) => {
    try {
        const { text, lang } = req.body;
        if (!text || !lang) {
            return res.status(400).json({ error: "Missing text or lang" });
        }

        // Import translateText dynamically (or import at top)
        const { translateText } = await import("../utils/translate.js");
        const translated = await translateText(text, lang);

        res.json({ success: true, translated });
    } catch (error) {
        console.error("Translation error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}