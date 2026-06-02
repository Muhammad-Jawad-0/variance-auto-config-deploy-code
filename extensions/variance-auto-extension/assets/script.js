class VarianceConfigurator {
    constructor() {
        this.state = {
            selectedBrand: null,
            selectedModel: null,
            selectedDeclinaison: null,
            selectedKit: null,
            selectedFilm: null,
            filmDetail: null,
            realFilmId: null,
            filmCustomId: null
        };

        this.apiBase = '/apps/customizer';
        this.elements = {};
        this.customDropdownOpen = false;
        this.init();
    }

    async init() {
        this.cacheElements();
        await this.loadBrands();
        this.bindEvents();
        this.setInitialUI();
    }

    getCurrentLang() {
        return window.VarianceConfig?.storeLanguage || 'en';
    }

    async translateStaticText(text, key) {
        if (!this._staticCache) this._staticCache = {};
        const lang = this.getCurrentLang();
        if (lang === 'en') return text;
        if (this._staticCache[key]) return this._staticCache[key];

        try {
            const res = await fetch('/apps/customizer/translate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang })
            });
            const data = await res.json();
            this._staticCache[key] = data.translated || text;
            return this._staticCache[key];
        } catch (err) {
            console.error(`Translation failed for ${key}:`, err);
            return text;
        }
    }

    async translateAllStaticTexts() {
        const stepTexts = document.querySelectorAll('.step-text');
        stepTexts.forEach((el, idx) => {
            el.textContent = '⏳';
            if (idx !== 2 && idx !== 3) {
                el.classList.add('rotating');
            }
        });

        const brandTrigger = document.querySelector('.custom-select-trigger span:first-child');
        if (brandTrigger) {
            brandTrigger.textContent = '⏳';
            brandTrigger.classList.add('rotating');
        }

        const modelSelect = this.elements.modelSelect;
        if (modelSelect && modelSelect.options[0]) {
            modelSelect.options[0].text = '⏳';
            modelSelect.options[0].classList.add('rotating');
        }

        const filmSelect = this.elements.filmSelect;
        if (filmSelect && filmSelect.options[0]) {
            filmSelect.options[0].text = '⏳';
            filmSelect.options[0].classList.add('rotating');
        }

        const placeholderDiv = document.getElementById('result-placeholder');
        if (placeholderDiv) {
            placeholderDiv.innerHTML = `<p class="rotating">⏳</p>`;
        }

        const btn = this.elements.addToCartBtn;
        if (btn) {
            const svg = btn.querySelector('svg');
            btn.innerHTML = '';
            if (svg) btn.appendChild(svg);
            const spinnerSpan = document.createElement('span');
            spinnerSpan.textContent = '⏳';
            spinnerSpan.classList.add('rotating');
            btn.appendChild(spinnerSpan);
            btn.disabled = true;
        }

        const translations = {
            step1: await this.translateStaticText("Select Brand", "step1"),
            step2: await this.translateStaticText("Select Model", "step2"),
            step3: await this.translateStaticText("Select Year / Trim", "step3"),
            step4: await this.translateStaticText("Select Window Kit", "step4"),
            step5: await this.translateStaticText("Select Tint Film", "step5"),
            chooseBrand: await this.translateStaticText("Choose a brand", "chooseBrand"),
            chooseModel: await this.translateStaticText("Choose a model", "chooseModel"),
            chooseTint: await this.translateStaticText("Choose a tint", "chooseTint"),
            loadingBrands: await this.translateStaticText("Loading brands...", "loadingBrands"),
            loadingModels: await this.translateStaticText("Loading models...", "loadingModels"),
            loadingOptions: await this.translateStaticText("Loading options...", "loadingOptions"),
            loadingTints: await this.translateStaticText("Loading tints...", "loadingTints"),
            pleaseSelectFirst: await this.translateStaticText("Please make a selection first", "pleaseSelectFirst"),
            addToCart: await this.translateStaticText("Add to Cart", "addToCart"),
            ref: await this.translateStaticText("Ref:", "ref"),
            uv: await this.translateStaticText("UV", "uv"),
            solar: await this.translateStaticText("Solar", "solar"),
            light: await this.translateStaticText("Light", "light"),
            techSheet: await this.translateStaticText("Technical Sheet", "techSheet"),
            noPDF: await this.translateStaticText("No PDF", "noPDF")
        };
        this.translations = translations;

        stepTexts.forEach((el, idx) => {
            const keys = ['step1', 'step2', 'step3', 'step4', 'step5'];
            if (idx < keys.length) {
                el.textContent = translations[keys[idx]];
                el.classList.remove('rotating');
            }
        });

        if (brandTrigger) {
            brandTrigger.textContent = translations.chooseBrand;
            brandTrigger.classList.remove('rotating');
        }

        if (modelSelect && modelSelect.options[0]) {
            modelSelect.options[0].text = translations.chooseModel;
            modelSelect.options[0].classList.remove('rotating');
        }

        if (filmSelect && filmSelect.options[0]) {
            filmSelect.options[0].text = translations.chooseTint;
            filmSelect.options[0].classList.remove('rotating');
        }

        if (placeholderDiv) {
            placeholderDiv.innerHTML = `<p>🔍 ${translations.pleaseSelectFirst}</p>`;
        }

        if (btn) {
            const svg = btn.querySelector('svg');
            btn.innerHTML = '';
            if (svg) btn.appendChild(svg);
            btn.appendChild(document.createTextNode(' ' + translations.addToCart));
            btn.disabled = true;
        }
    }

    async translateButton() {
        const btn = this.elements.addToCartBtn;
        if (!btn) return;
        const translated = this.translations?.addToCart || await this.translateStaticText("Add to Cart", "addToCart");
        const svg = btn.querySelector('svg');
        btn.innerHTML = '';
        if (svg) btn.appendChild(svg);
        btn.appendChild(document.createTextNode(' ' + translated));
    }

    setInitialUI() {
        this.elements.addToCartBtn.disabled = true;
        if (this.elements.resultContent) {
            this.elements.resultContent.classList.add('hidden');
        }
        const placeholder = document.getElementById('result-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    cacheElements() {
        this.elements = {
            brandSelect: document.getElementById('brand-select'),
            brandPreview: document.getElementById('brand-preview'),
            modelSection: document.getElementById('model-section'),
            modelSelect: document.getElementById('model-select'),
            modelImagePreview: document.getElementById('model-image-preview'),
            selectedModelImg: document.getElementById('selected-model-img'),
            declinaisonSection: document.getElementById('declinaison-section'),
            declinaisonList: document.getElementById('declinaison-list'),
            kitSection: document.getElementById('kit-section'),
            kitList: document.getElementById('kit-list'),
            tintSection: document.getElementById('tint-section'),
            filmSelect: document.getElementById('film-select'),
            resultBox: document.getElementById('result-box'),
            resultContent: document.getElementById('result-content'),
            techSheetLink: document.getElementById('tech-sheet-link'),
            addToCartBtn: document.getElementById('add-to-cart-btn')
        };
        this.resultPlaceholder = document.getElementById('result-placeholder');
    }

    bindEvents() {
        if (this.elements.brandSelect) {
            this.elements.brandSelect.addEventListener('change', (e) => this.onBrandChange(e));
        }
        if (this.elements.modelSelect) {
            this.elements.modelSelect.addEventListener('change', (e) => this.onModelChange(e));
        }
        if (this.elements.filmSelect) {
            this.elements.filmSelect.addEventListener('change', (e) => this.onFilmChange(e));
        }
        if (this.elements.addToCartBtn) {
            this.elements.addToCartBtn.addEventListener('click', () => this.addToCart());
        }
    }

    buildCustomBrandDropdown(brands) {
        const selectWrap = document.querySelector('.select-wrap');
        if (!selectWrap) return;
        const oldCustom = selectWrap.querySelector('.custom-select');
        if (oldCustom) oldCustom.remove();

        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        const chooseText = this.translations?.chooseBrand || "Choose a brand";
        trigger.innerHTML = `<span>${chooseText}</span><span style="margin-left: auto;">▼</span>`;
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';

        brands.forEach(brand => {
            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.id = brand.id || brand.marque_id;
            option.dataset.image = brand.images?.[0]?.url || '';
            option.innerHTML = `
                ${brand.images?.[0]?.url ? `<img src="${brand.images[0].url}" alt="${brand.titre}">` : '<div style="width:35px;"></div>'}
                <span>${brand.titre || brand.label || brand.name}</span>
            `;
            option.addEventListener('click', () => {
                this.onCustomBrandSelect(brand, trigger, optionsContainer);
                optionsContainer.classList.remove('open');
                this.customDropdownOpen = false;
            });
            optionsContainer.appendChild(option);
        });

        customSelect.appendChild(trigger);
        customSelect.appendChild(optionsContainer);
        const originalSelect = this.elements.brandSelect;
        originalSelect.style.display = 'none';
        selectWrap.appendChild(customSelect);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsContainer.classList.toggle('open');
            this.customDropdownOpen = optionsContainer.classList.contains('open');
        });
        document.addEventListener('click', () => {
            if (this.customDropdownOpen) {
                optionsContainer.classList.remove('open');
                this.customDropdownOpen = false;
            }
        });
    }

    onCustomBrandSelect(brand, trigger, optionsContainer) {
        this.state.selectedBrand = {
            id: brand.id || brand.marque_id,
            name: brand.titre || brand.label || brand.name,
            image: brand.images?.[0]?.url || ''
        };
        trigger.innerHTML = `
            ${this.state.selectedBrand.image ? `<img src="${this.state.selectedBrand.image}" style="width:30px;height:30px;object-fit:contain;">` : ''}
            <span>${this.state.selectedBrand.name}</span>
            <span style="margin-left: auto;">▼</span>
        `;
        optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.querySelector('span').textContent === this.state.selectedBrand.name) {
                opt.classList.add('selected');
            }
        });
        this.updateProgress(2);
        this.showModelSection();
        this.loadModels(this.state.selectedBrand.id);
    }

    async loadBrands() {
        try {
            await this.translateAllStaticTexts();
            const response = await fetch(`${this.apiBase}/brands?lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const brands = data?.liste?.valeurs || data?.brands || data || [];
            if (this.elements.brandSelect) {
                this.buildCustomBrandDropdown(brands);
            }
            this.state.brands = brands;
        } catch (error) {
            console.error('Failed to load brands:', error);
            if (this.elements.brandSelect) {
                this.elements.brandSelect.innerHTML = '<option value="">Failed to load brands</option>';
            }
        }
    }

    onBrandChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption.value) {
            this.resetBrandSelection();
            return;
        }
        const brandId = selectedOption.value;
        const brandName = selectedOption.textContent;
        const brandImage = selectedOption.dataset.image;
        this.state.selectedBrand = { id: brandId, name: brandName, image: brandImage };
        this.updateBrandPreview(brandName, brandImage);
        this.updateProgress(2);
        this.showModelSection();
        this.loadModels(brandId);
    }

    resetBrandSelection() {
        this.state.selectedBrand = null;
        this.updateBrandPreview(null, null);
        this.hideModelSection();
        this._originalBrandImage = null;
        this.updateProgress(1);
    }

    updateBrandPreview(name, image) {
        const brandPreview = this.elements.brandPreview;
        if (!name) {
            if (brandPreview) {
                brandPreview.innerHTML = `<div class="preview-empty"><div class="preview-empty__icon">🚗</div><h3>No brand selected</h3><p>Choose a brand from the dropdown</p></div>`;
            }
            return;
        }
        const previewHtml = `<div class="brand-card" style="width:100%; text-align:center;">${image ? `<img class="brand-card__image" src="${image}" alt="${name}" loading="lazy">` : `<div class="brand-card__placeholder"><div class="brand-card__icon">🏷️</div></div>`}<p class="brand-card__name">${name}</p><div class="brand-card__meta">Brand ID: ${this.state.selectedBrand.id}</div></div>`;
        if (brandPreview) brandPreview.innerHTML = previewHtml;
    }

    showModelSection() { if (this.elements.modelSection) this.elements.modelSection.classList.remove('hidden'); }
    hideModelSection() { if (this.elements.modelSection) this.elements.modelSection.classList.add('hidden'); if (this.elements.modelImagePreview) this.elements.modelImagePreview.classList.add('hidden'); }

    async loadModels(brandId) {
        const modelSelect = this.elements.modelSelect;
        if (!modelSelect) return;
        modelSelect.disabled = true;
        modelSelect.innerHTML = `<option value="" class="rotating">⏳</option>`;
        this.elements.modelSection.classList.remove('hidden');
        try {
            const response = await fetch(`${this.apiBase}/models?marque_id=${brandId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const models = data?.liste?.valeurs || data?.models || data || [];
            const chooseText = this.translations?.chooseModel || "Choose a model";
            modelSelect.innerHTML = `<option value="">${chooseText}</option>`;
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id || model.modele_id;
                option.textContent = model.titre || model.label || model.name;
                option.dataset.image = model.images?.[0]?.url || '';
                option.dataset.model = JSON.stringify(model);
                modelSelect.appendChild(option);
            });
            modelSelect.disabled = false;
        } catch (error) {
            console.error('Failed to load models:', error);
            modelSelect.innerHTML = '<option value="">Failed to load models</option>';
        }
    }

    onModelChange(event) {
        const selectedOption = event.target.selectedOptions[0];
        if (!selectedOption.value) {
            this.resetModelSelection();
            return;
        }
        const modelId = selectedOption.value;
        const modelName = selectedOption.textContent;
        const modelImage = selectedOption.dataset.image;
        this.state.selectedModel = { id: modelId, name: modelName, image: modelImage };
        if (modelImage && this.elements.modelImagePreview) {
            this.elements.selectedModelImg.src = modelImage;
            this.elements.modelImagePreview.classList.remove('hidden');
        } else {
            this.elements.modelImagePreview.classList.add('hidden');
        }
        this.updateProgress(3);
        this.showDeclinaisonSection();
        this.loadDeclinaisons(modelId);
    }

    resetModelSelection() {
        this.state.selectedModel = null;
        if (this.elements.modelImagePreview) this.elements.modelImagePreview.classList.add('hidden');
        if (this._originalBrandImage && this.elements.brandPreview) {
            this.elements.brandPreview.innerHTML = this._originalBrandImage;
        }
        this.hideDeclinaisonSection();
        this.hideKitSection();
        this.hideTintSection();
        this.resetResultToPlaceholder();
        this.updateProgress(2);
    }

    showDeclinaisonSection() { if (this.elements.declinaisonSection) this.elements.declinaisonSection.classList.remove('hidden'); this.hideKitSection(); this.hideTintSection(); this.resetResultToPlaceholder(); }
    hideDeclinaisonSection() { if (this.elements.declinaisonSection) this.elements.declinaisonSection.classList.add('hidden'); }

    async loadDeclinaisons(modelId) {
        const grid = this.elements.declinaisonList;
        if (!grid) return;
        grid.innerHTML = `<div class="loading">⏳</div>`;
        try {
            const response = await fetch(`${this.apiBase}/declinaisons?modele_id=${modelId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const declinaisons = data?.liste?.valeurs || data?.declinaisons || data || [];
            if (declinaisons.length === 0) {
                grid.innerHTML = '<p>No options available</p>';
                return;
            }
            this.renderTileGrid(grid, declinaisons, 'declinaison', (item) => { this.onDeclinaisonSelect(item); });
        } catch (error) {
            console.error('Failed to load declinaisons:', error);
            grid.innerHTML = '<p>Failed to load options</p>';
        }
    }

    renderTileGrid(container, items, type, onClickCallback) {
        container.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'tile-card';
            card.dataset.id = item.id || item.declinaison_id || item.vitre_id;
            let imageUrl = null;
            if (item.images && item.images.length > 0) {
                imageUrl = item.images[0].url || item.images[0];
            } else if (item.image_url) {
                imageUrl = item.image_url;
            } else if (item.image) {
                imageUrl = item.image;
            }
            let label = item.titre || item.label || item.name;
            let badge = '';
            if (type === 'declinaison' && item.annee_debut) {
                const yearStart = item.annee_debut;
                const yearEnd = item.annee_fin || 'present';
                badge = `${yearStart} - ${yearEnd}`;
                if (item.version) label = `${item.version} (${badge})`;
                else if (item.carrosserie) label = `${item.carrosserie} (${badge})`;
                else label = badge;
            }
            card.innerHTML = `
                ${imageUrl ? `<img src="${imageUrl}" alt="${label}" loading="lazy" style="width:100%; height:120px; object-fit:cover; border-radius:10px;">` : `<div style="height:80px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; justify-content:center;"><span>${type === 'kit' ? '🪟' : (type === 'model' ? '🚙' : '🚗')}</span></div>`}
                <p class="tile-label">${label || 'Option'}</p>
                ${badge && type === 'declinaison' ? `<span class="tile-badge">${badge}</span>` : ''}
            `;
            card.addEventListener('click', () => {
                document.querySelectorAll(`#${container.id} .tile-card`).forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                onClickCallback(item);
            });
            container.appendChild(card);
        });
    }

    onDeclinaisonSelect(declinaison) {
        this.state.selectedDeclinaison = {
            id: declinaison.id || declinaison.declinaison_id,
            label: declinaison.titre || declinaison.label
        };
        const variantImageUrl = declinaison.images?.[0]?.url || declinaison.image_url || '';
        if (variantImageUrl && this.elements.brandPreview) {
            if (!this._originalBrandImage) {
                this._originalBrandImage = this.elements.brandPreview.innerHTML;
            }
            this.elements.brandPreview.innerHTML = `<div class="variant-card" style="width:100%; text-align:center;">
                <img class="variant-card__image" src="${variantImageUrl}" alt="${this.state.selectedDeclinaison.label}" loading="lazy" style="max-width:100%; max-height:200px; object-fit:contain;">
                <p class="variant-card__name">${this.state.selectedDeclinaison.label}</p>
            </div>`;
        }
        this.updateProgress(4);
        this.showKitSection();
        this.loadKits(this.state.selectedDeclinaison.id);
    }

    showKitSection() { if (this.elements.kitSection) this.elements.kitSection.classList.remove('hidden'); this.hideTintSection(); this.resetResultToPlaceholder(); }
    hideKitSection() { if (this.elements.kitSection) this.elements.kitSection.classList.add('hidden'); }

    async loadKits(declinaisonId) {
        const grid = this.elements.kitList;
        if (!grid) return;
        grid.innerHTML = `<div class="loading">⏳</div>`;
        try {
            const response = await fetch(`${this.apiBase}/kits?declinaison_id=${declinaisonId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const kits = data?.liste?.valeurs || data?.kits || data || [];
            if (kits.length === 0) {
                grid.innerHTML = '<p>No kits available</p>';
                return;
            }
            this.renderTileGrid(grid, kits, 'kit', (item) => { this.onKitSelect(item); });
        } catch (error) {
            console.error('Failed to load kits:', error);
            grid.innerHTML = '<p>Failed to load kits</p>';
        }
    }

    onKitSelect(kit) {
        let kitImageUrl = '';
        if (kit.images && kit.images.length > 0) {
            kitImageUrl = kit.images[0].url || kit.images[0];
        } else if (kit.image_url) {
            kitImageUrl = kit.image_url;
        } else if (kit.image) {
            kitImageUrl = kit.image;
        }
        this.state.selectedKit = {
            id: kit.id || kit.vitre_id,
            label: kit.titre || kit.label,
            imageUrl: kitImageUrl,
            originalData: kit
        };
        this.updateProgress(5);
        this.showTintSection();
        this.loadFilms();
    }

    showTintSection() { if (this.elements.tintSection) this.elements.tintSection.classList.remove('hidden'); this.resetResultToPlaceholder(); }
    hideTintSection() { if (this.elements.tintSection) this.elements.tintSection.classList.add('hidden'); }

    async loadFilms() {
        const filmSelect = this.elements.filmSelect;
        if (!filmSelect) return;
        filmSelect.disabled = true;
        filmSelect.innerHTML = `<option value="" class="rotating">⏳</option>`;

        try {
            const response = await fetch(`${this.apiBase}/films?declinaison_id=${this.state.selectedDeclinaison.id}&vitre_id=${this.state.selectedKit.id}&lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const films = data?.liste?.valeurs || data?.films || data || [];

            // Define your desired films with their patterns and custom labels
            const desiredFilms = [
                { customLabel: "Donker 5%", patterns: ['dark solar film 5', 'dark 5%', 'donker 5%'], customId: 'film_donker_5' },
                { customLabel: "Extreem helder 70%", patterns: ['extreme clear 70 solar film', 'extreem helder 70%', '70%'], customId: 'film_extreem_helder_70' },
                { customLabel: "Licht helder 35%", patterns: ['light smoke solar film 35', 'licht helder 35%', '35%'], customId: 'film_licht_helder_35' },
                { customLabel: "Medium 25%", patterns: ['medium solar film 25', 'medium 25%', '25%'], customId: 'film_medium_25' },
                { customLabel: "Medium plus 15%", patterns: ['medium solar film plus 15', 'medium plus 15%', '15%'], customId: 'film_medium_plus_15' }
            ];

            const matchedOptions = [];

            for (const desired of desiredFilms) {
                // Try to find a film from API that matches any pattern
                const foundFilm = films.find(film => {
                    const title = (film.titre || film.label || film.name || '').toLowerCase();
                    return desired.patterns.some(pattern => title.includes(pattern.toLowerCase()));
                });

                if (foundFilm) {
                    matchedOptions.push({
                        realFilmId: foundFilm.id,
                        customId: desired.customId,
                        label: desired.customLabel,   // show your custom label
                        originalTitle: foundFilm.titre
                    });
                } else {
                    // Fallback – still show the option but without a real film ID
                    // (details will not be fetched from API)
                    matchedOptions.push({
                        realFilmId: null,
                        customId: desired.customId,
                        label: desired.customLabel,
                        originalTitle: desired.customLabel
                    });
                    console.warn(`Film not found in API: ${desired.customLabel}`);
                }
            }

            const chooseText = this.translations?.chooseTint || "Choose a tint";
            filmSelect.innerHTML = `<option value="">${chooseText}</option>`;

            for (const opt of matchedOptions) {
                const option = document.createElement('option');
                // Use realFilmId as the value if available, otherwise fallback to customId
                option.value = opt.realFilmId || opt.customId;
                option.textContent = opt.label;
                option.dataset.realFilmId = opt.realFilmId;
                option.dataset.customId = opt.customId;
                option.dataset.label = opt.label;
                filmSelect.appendChild(option);
            }

            filmSelect.disabled = false;
        } catch (error) {
            console.error('Failed to load films from API, using hardcoded options:', error);
            // Ultimate fallback – hardcoded options without real film IDs
            const fallbackFilms = [
                { customId: "film_donker_5", label: "Donker 5%" },
                { customId: "film_extreem_helder_70", label: "Extreem helder 70%" },
                { customId: "film_licht_helder_35", label: "Licht helder 35%" },
                { customId: "film_medium_25", label: "Medium 25%" },
                { customId: "film_medium_plus_15", label: "Medium plus 15%" }
            ];
            const chooseText = this.translations?.chooseTint || "Choose a tint";
            filmSelect.innerHTML = `<option value="">${chooseText}</option>`;
            fallbackFilms.forEach(film => {
                const option = document.createElement('option');
                option.value = film.customId;
                option.textContent = film.label;
                option.dataset.realFilmId = null;
                option.dataset.customId = film.customId;
                option.dataset.label = film.label;
                filmSelect.appendChild(option);
            });
            filmSelect.disabled = false;
        }
    }

async onFilmChange(event) {
    const selectedOption = event.target.selectedOptions[0];
    const realFilmId = selectedOption.dataset.realFilmId;
    const customId = selectedOption.dataset.customId;
    const filmLabel = selectedOption.dataset.label;

    if (!realFilmId && !customId) {
        this.resetResultToPlaceholder();
        return;
    }

    this.showResultLoader();
    this.elements.addToCartBtn.disabled = true;

    if (realFilmId && realFilmId !== 'null') {
        // ✅ Real film ID exists – fetch details from API
        try {
            const response = await fetch(`${this.apiBase}/film-detail?declinaison_id=${this.state.selectedDeclinaison.id}&vitre_id=${this.state.selectedKit.id}&film_id=${realFilmId}&lang=${this.getCurrentLang()}`);
            if (!response.ok) throw new Error('Failed to fetch film details');
            const detail = await response.json();
            this.state.filmDetail = detail;
            this.state.realFilmId = realFilmId;
            this.state.filmCustomId = customId;
            await this.showResult(detail, customId);
            this.updateProgress(5, true);
            this.elements.addToCartBtn.disabled = false;
        } catch (error) {
            console.error('Failed to load film details:', error);
            this.resetResultToPlaceholder();
            this.elements.addToCartBtn.disabled = true;
        }
    } else {
        // Fallback (no real film ID) – use hardcoded data (should not happen normally)
        console.warn('No real film_id, using fallback data for PDF only');
        const fallbackData = {
            reference: filmLabel,
            rejet_UV: '99.0',
            protection_solaire: '60.0',
            transmission_lumiere: '35.0',
            prix_public: { prix: 0 },
            titre: filmLabel,
            custom_id: customId
        };
        this.state.filmDetail = fallbackData;
        this.state.filmCustomId = customId;
        await this.showResult(fallbackData, customId);
        this.updateProgress(5, true);
        this.elements.addToCartBtn.disabled = false;
    }
}

    showResultLoader() {
        if (this.resultPlaceholder) this.resultPlaceholder.classList.add('hidden');
        if (this.elements.resultContent) {
            this.elements.resultContent.classList.remove('hidden');
            this.elements.resultContent.innerHTML = `<div class="rotating">⏳</div>`;
        }
        this.elements.addToCartBtn.disabled = true;
    }

    resetResultToPlaceholder() {
        if (this.resultPlaceholder) this.resultPlaceholder.classList.remove('hidden');
        if (this.elements.resultContent) {
            this.elements.resultContent.classList.add('hidden');
            this.elements.resultContent.innerHTML = '';
        }
        this.elements.addToCartBtn.disabled = true;
        this.state.filmDetail = null;
    }

    async showResult(detail, forcedCustomId = null) {
        const resultContent = this.elements.resultContent;
        if (!resultContent) return;

        if (this.resultPlaceholder) this.resultPlaceholder.classList.add('hidden');
        resultContent.classList.remove('hidden');

        const t = this.translations || {};
        const refLabel = t.ref || "Ref:";
        const uvLabel = t.uv || "UV";
        const solarLabel = t.solar || "Solar";
        const lightLabel = t.light || "Light";
        const techSheetLabel = t.techSheet || "Technical Sheet";
        const noPDFLabel = t.noPDF || "No PDF";

        const firstValue = detail?.liste?.valeurs?.[0] || detail;
        const reference = detail?.reference || firstValue?.reference || 'N/A';
        const uv = firstValue?.rejet_UV || detail?.rejet_UV || '';
        const solar = firstValue?.protection_solaire || detail?.protection_solaire || '';
        const light = firstValue?.transmission_lumiere || detail?.transmission_lumiere || '';
        const apiPrice = firstValue?.prix_public?.prix || detail?.prix_public?.prix || 0;
        const currentLang = this.getCurrentLang();

        let customId = forcedCustomId || this.state.filmCustomId;
        if (!customId && detail.custom_id) customId = detail.custom_id;
        if (!customId && detail.titre) {
            const titleLower = detail.titre.toLowerCase();
            if (titleLower.includes('donker') || titleLower.includes('dark')) customId = 'film_donker_5';
            else if (titleLower.includes('extreem') || titleLower.includes('70')) customId = 'film_extreem_helder_70';
            else if (titleLower.includes('licht') || titleLower.includes('35')) customId = 'film_licht_helder_35';
            else if (titleLower.includes('medium') && titleLower.includes('25')) customId = 'film_medium_25';
            else if (titleLower.includes('medium plus') || titleLower.includes('15')) customId = 'film_medium_plus_15';
        }

        let pdfUrl = null;
        let finalTechSheetLabel = techSheetLabel;

        if (customId) {
            try {
                const mappingRes = await fetch(`${this.apiBase}/pdf-mapping?custom_id=${customId}&lang=${currentLang}`);
                const mappingData = await mappingRes.json();
                if (mappingData.success && mappingData.pdfUrl) {
                    pdfUrl = mappingData.pdfUrl;
                    finalTechSheetLabel = mappingData.pdfName || techSheetLabel;
                }
            } catch (err) {
                console.warn("Failed to fetch PDF mapping:", err);
            }
        }

        let kitImageHtml = '';
        if (this.state.selectedKit && this.state.selectedKit.imageUrl) {
            kitImageHtml = `<div class="kit-thumbnail" style="display: inline-block; margin-left: 10px;"><img src="${this.state.selectedKit.imageUrl}" alt="Kit" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; vertical-align: middle;"></div>`;
        } else if (this.state.selectedKit && this.state.selectedKit.originalData) {
            const kitData = this.state.selectedKit.originalData;
            const imgUrl = kitData?.images?.[0]?.url || kitData?.image_url || '';
            if (imgUrl) {
                kitImageHtml = `<div class="kit-thumbnail" style="display: inline-block; margin-left: 10px;"><img src="${imgUrl}" alt="Kit" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; vertical-align: middle;"></div>`;
            }
        }

        resultContent.innerHTML = `
        <div class="result-compact">
            <div class="compact-section">
                <div class="row">
                    <span class="label">🔖 ${refLabel}</span>
                    <span>${reference}</span>
                </div>
                <div class="row specs" style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    ${uv ? `<span>${uvLabel} ${uv}%</span>` : ''}
                    ${solar ? `<span>${solarLabel} ${solar}%</span>` : ''}
                    ${light ? `<span>${lightLabel} ${light}%</span>` : ''}
                    ${kitImageHtml}
                </div>
            </div>
            <div class="compact-section">
                ${pdfUrl ? `<a href="${pdfUrl}" target="_blank" class="pdf-link">📄 ${finalTechSheetLabel}</a>` : `<span class="no-pdf">${noPDFLabel}</span>`}
            </div>
            <div class="compact-price">
                <strong>€${(parseFloat(apiPrice || 0) + parseFloat(window.VarianceConfig.productPrice || 0)).toLocaleString(currentLang === 'nl' ? 'nl-NL' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
        </div>`;
    }

    updateProgress(step, isComplete = false) {
        const steps = document.querySelectorAll('.step');
        steps.forEach((stepEl, index) => {
            const stepNum = index + 1;
            stepEl.classList.remove('active', 'completed');
            if (stepNum < step) stepEl.classList.add('completed');
            else if (stepNum === step) stepEl.classList.add('active');
        });
    }

    async addToCart() {
        if (!this.state.filmDetail) return;

        const filmValue = this.state.filmDetail?.liste?.valeurs?.[0] || this.state.filmDetail;
        const apiPrice = parseFloat(filmValue?.prix_public?.prix || 0);
        const basePrice = parseFloat(window.VarianceConfig?.productPrice || 0);
        const totalPrice = apiPrice + basePrice;

        const configData = {
            marque_id: this.state.selectedBrand?.id,
            modele_id: this.state.selectedModel?.id,
            declinaison_id: this.state.selectedDeclinaison?.id,
            vitre_id: this.state.selectedKit?.id,
            film_id: this.state.selectedFilm,
            brandName: this.state.selectedBrand?.name || '',
            modelName: this.state.selectedModel?.name || '',
            declinaisonLabel: this.state.selectedDeclinaison?.label || '',
            kitLabel: this.state.selectedKit?.label || '',
            filmName: filmValue?.titre || filmValue?.label || '',
            totalPrice: totalPrice,
            basePrice: basePrice,
            filmPrice: apiPrice,
            reference: filmValue?.reference || 'N/A',
            uv: filmValue?.rejet_UV || '',
            solar: filmValue?.protection_solaire || '',
            light: filmValue?.transmission_lumiere || '',
            filmImages: filmValue?.images?.map(img => img.url || img) || [],
            modelImageUrl: this.state.selectedModel?.image || '',
            brandImageUrl: this.state.selectedBrand?.image || '',
            technicalSheetUrl: '',
            technicalSheetName: 'Technical Sheet',
        };

        const cartProperties = {
            'Brand': configData.brandName,
            'Model': configData.modelName,
            'Year/Trim': configData.declinaisonLabel,
            'Window Kit': configData.kitLabel,
            'Tint Film': configData.filmName,
            'Reference': configData.reference,
            'UV Protection': configData.uv ? `${configData.uv}%` : '',
            'Solar Protection': configData.solar ? `${configData.solar}%` : '',
            'Light Transmission': configData.light ? `${configData.light}%` : '',
            'Configuration ID': `${configData.marque_id}-${configData.modele_id}-${configData.declinaison_id}-${configData.vitre_id}-${configData.film_id}`,
        };
        Object.keys(cartProperties).forEach(k => { if (!cartProperties[k]) delete cartProperties[k]; });

        const btn = this.elements.addToCartBtn;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '⏳ Adding...';
        btn.disabled = true;

        const shopDomain = window.Shopify?.shop || window.location.hostname;
        const backendUrl = `${this.apiBase}/cart/add-configured-item?shop=${encodeURIComponent(shopDomain)}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const backendRes = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!backendRes.ok) throw new Error(`Backend error: ${backendRes.status}`);
            const backendData = await backendRes.json();
            if (!backendData.success || !backendData.variantId) throw new Error(backendData.error || 'Failed to get variant');
            let variantId = backendData.variantId;
            if (typeof variantId === 'string' && variantId.includes('gid://')) variantId = variantId.split('/').pop();
            variantId = parseInt(variantId);
            const formData = new FormData();
            formData.append('id', variantId);
            formData.append('quantity', '1');
            Object.keys(cartProperties).forEach(key => { formData.append(`properties[${key}]`, cartProperties[key]); });
            const cartAddRes = await fetch('/cart/add.js', { method: 'POST', body: formData });
            if (!cartAddRes.ok) {
                const cartError = await cartAddRes.json();
                throw new Error(cartError.description || 'Cart add failed');
            }
            window.location.href = '/cart';
        } catch (error) {
            console.error('Add to cart error:', error);
            alert('Could not add to cart. ' + error.message);
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const configuratorContainer = document.getElementById('variance-configurator');
    if (!configuratorContainer) return;
    const productId = window.VarianceConfig?.productId || null;
    const shopDomain = window.Shopify?.shop || '';
    if (!productId) {
        configuratorContainer.style.display = 'none';
        return;
    }
    try {
        const response = await fetch(`/apps/customizer/check-product-extension?productId=${productId}&shop=${shopDomain}`);
        const data = await response.json();
        if (data.allowed) {
            configuratorContainer.style.display = 'block';
            new VarianceConfigurator();
        } else {
            configuratorContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to check extension permission:', error);
        configuratorContainer.style.display = 'none';
    }
});