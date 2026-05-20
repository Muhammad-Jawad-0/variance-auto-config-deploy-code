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
    const { film_id, label, lang = 'en' } = req.query;

    if (!film_id && !label) {
        return res.status(400).json({
            error: "Missing required parameters: film_id or label"
        });
    }

    try {
        const pdfMapping = {
            "55": {
                url: "https://your-cdn.com/tech-sheets/55_prestige_tint.pdf",
                name: "Prestige Series Technical Sheet"
            },
            "67": {
                url: "https://your-cdn.com/tech-sheets/67_carbon_tint.pdf",
                name: "Carbon Series Technical Sheet"
            },
            "89": {
                url: "https://your-cdn.com/tech-sheets/89_ceramic_tint.pdf",
                name: "Ceramic Series Technical Sheet"
            },
            "default": {
                url: null,
                name: null
            }
        };

        let pdfInfo = pdfMapping[film_id];

        if (!pdfInfo && label) {
            const labelLower = label.toLowerCase();
            if (labelLower.includes("prestige")) {
                pdfInfo = pdfMapping["55"];
            } else if (labelLower.includes("carbon")) {
                pdfInfo = pdfMapping["67"];
            } else if (labelLower.includes("ceramic")) {
                pdfInfo = pdfMapping["89"];
            }
        }

        let result;
        if (pdfInfo && pdfInfo.url) {
            result = {
                success: true,
                pdfUrl: pdfInfo.url,
                pdfName: pdfInfo.name,
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