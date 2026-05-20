class VarianceConfigurator {
    constructor() {
        this.state = {
            selectedBrand: null,
            selectedModel: null,
            selectedDeclinaison: null,
            selectedKit: null,
            selectedFilm: null,
            filmDetail: null
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
    }

    getCurrentLang() {
        return window.VarianceConfig?.storeLanguage || 'en';
    }

    async translateHeading() {
        const headingEl = document.querySelector('#result-box .result-header h3');
        if (!headingEl) return;

        const originalText = "Your Selection Summary";
        const lang = this.getCurrentLang();

        if (lang === 'en') {
            headingEl.textContent = originalText;
            return;
        }

        // Check cache
        if (!this._headingCache) this._headingCache = {};
        if (this._headingCache[lang]) {
            headingEl.textContent = this._headingCache[lang];
            return;
        }

        try {
            const res = await fetch('/apps/customizer/translate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: originalText, lang })
            });
            const data = await res.json();
            const translated = data.translated || originalText;
            this._headingCache[lang] = translated;
            headingEl.textContent = translated;
        } catch (err) {
            console.error("Heading translation failed:", err);
            headingEl.textContent = originalText;
        }
    }

    // Cache for translated static texts
    async translateStaticText(text, key) {
        if (!this._staticCache) this._staticCache = {};
        const lang = this.getCurrentLang();

        // English mein translate nahi karna
        if (lang === 'en') return text;

        // Cache check
        if (this._staticCache[key]) return this._staticCache[key];

        try {
            const response = await fetch('/apps/customizer/translate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang })
            });
            const data = await response.json();
            const translated = data.translated || text;
            this._staticCache[key] = translated;
            return translated;
        } catch (error) {
            console.error(`Translation failed for ${key}:`, error);
            return text;
        }
    }

    async translateHeading() {
        const headingEl = document.querySelector('#result-box .result-header h3');
        if (!headingEl) return;

        const translated = await this.translateStaticText("Your Selection Summary", "heading");
        headingEl.textContent = translated;
    }

    async translateButton() {
        const btn = this.elements.addToCartBtn;
        if (!btn) return;

        const svg = btn.querySelector('svg');
        const translatedText = await this.translateStaticText("Add to Cart", "button");

        btn.innerHTML = '';
        if (svg) btn.appendChild(svg);
        btn.appendChild(document.createTextNode(' ' + translatedText));
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

        // Create custom dropdown HTML
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';

        // Trigger button
        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.innerHTML = `
        <span>Choose a brand</span>
        <span style="margin-left: auto;">▼</span>
    `;

        // Options container
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

        // Replace original select
        const originalSelect = this.elements.brandSelect;
        originalSelect.style.display = 'none';
        selectWrap.appendChild(customSelect);

        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsContainer.classList.toggle('open');
            this.customDropdownOpen = optionsContainer.classList.contains('open');
        });

        // Close on click outside
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

        // Update trigger display
        trigger.innerHTML = `
        ${this.state.selectedBrand.image ? `<img src="${this.state.selectedBrand.image}" style="width:30px;height:30px;object-fit:contain;">` : ''}
        <span>${this.state.selectedBrand.name}</span>
        <span style="margin-left: auto;">▼</span>
    `;

        // Update active class in options
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
            const lang = window.VarianceConfig?.storeLanguage || 'en';
            const response = await fetch(`${this.apiBase}/brands?lang=${this.getCurrentLang()}`);
            const data = await response.json();
            const brands = data?.liste?.valeurs || data?.brands || data || [];

            if (this.elements.brandSelect) {
                // Build custom dropdown instead of native select
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

        this.state.selectedBrand = {
            id: brandId,
            name: brandName,
            image: brandImage
        };

        this.updateBrandPreview(brandName, brandImage);
        this.updateProgress(2);
        this.showModelSection();
        this.loadModels(brandId);
    }

    resetBrandSelection() {
        this.state.selectedBrand = null;
        this.updateBrandPreview(null, null);
        this.hideModelSection();
        this.updateProgress(1);
    }

    updateBrandPreview(name, image) {
        const brandCard = this.elements.brandCard;
        const brandPreview = this.elements.brandPreview;

        if (!name) {
            if (brandCard) {
                brandCard.classList.add('brand-card--empty');
                brandCard.innerHTML = `
          <div class="brand-card__placeholder">
            <div class="brand-card__icon">✨</div>
            <p>Select a brand to see its logo here</p>
          </div>
        `;
            }


            if (brandPreview) {
                brandPreview.innerHTML = `
          <div class="preview-empty">
            <div class="preview-empty__icon">🚗</div>
            <h3>No brand selected</h3>
            <p>Choose a brand from the dropdown</p>
          </div>
        `;
            }
            return;
        }

        const previewHtml = `
      <div class="brand-card" style="width:100%; text-align:center;">
        ${image ? `<img class="brand-card__image" src="${image}" alt="${name}" loading="lazy">` : `
          <div class="brand-card__placeholder">
            <div class="brand-card__icon">🏷️</div>
          </div>
        `}
        <p class="brand-card__name">${name}</p>
        <div class="brand-card__meta">Brand ID: ${this.state.selectedBrand.id}</div>
      </div>
    `;

        if (brandPreview) brandPreview.innerHTML = previewHtml;

        if (brandCard) {
            brandCard.classList.remove('brand-card--empty');
            brandCard.innerHTML = `
        ${image ? `<img class="brand-card__image" src="${image}" alt="${name}">` : `
          <div class="brand-card__placeholder">
            <div class="brand-card__icon">🏷️</div>
          </div>
        `}
        <p class="brand-card__name">${name}</p>
        <div class="brand-card__meta">Brand ID: ${this.state.selectedBrand.id}</div>
      `;
        }
    }

    showModelSection() {
        if (this.elements.modelSection) {
            this.elements.modelSection.classList.remove('hidden');
        }
    }

    hideModelSection() {
        if (this.elements.modelSection) {
            this.elements.modelSection.classList.add('hidden');
        }
    }

    showModelSection() {
        if (this.elements.modelSection) {
            this.elements.modelSection.classList.remove('hidden');
        }
    }

    hideModelSection() {
        if (this.elements.modelSection) {
            this.elements.modelSection.classList.add('hidden');
        }
        // Hide model image preview
        if (this.elements.modelImagePreview) {
            this.elements.modelImagePreview.classList.add('hidden');
        }
    }

    onModelSelect(model) {
        this.state.selectedModel = {
            id: model.id || model.modele_id,
            name: model.titre || model.label || model.name
        };

        this.updateProgress(3);
        this.showDeclinaisonSection();
        this.loadDeclinaisons(this.state.selectedModel.id);
    }

    async loadModels(brandId) {
        const modelSelect = this.elements.modelSelect;
        const modelSection = this.elements.modelSection;
        if (!modelSelect) return;

        modelSelect.disabled = true;
        modelSelect.innerHTML = '<option value="">Loading models...</option>';
        modelSection.classList.remove('hidden');

        try {
            const response = await fetch(`${this.apiBase}/models?marque_id=${brandId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();

            const models = data?.liste?.valeurs || data?.models || data || [];

            modelSelect.innerHTML = '<option value="">Choose a model</option>';

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id || model.modele_id;
                option.textContent = model.titre || model.label || model.name;
                // Store image URL in dataset
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

        this.state.selectedModel = {
            id: modelId,
            name: modelName,
            image: modelImage
        };

        // Show model image if available
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

        // Hide model image preview
        if (this.elements.modelImagePreview) {
            this.elements.modelImagePreview.classList.add('hidden');
        }

        this.hideDeclinaisonSection();
        this.hideKitSection();
        this.hideTintSection();
        this.hideResult();
        this.updateProgress(2);
    }

    showDeclinaisonSection() {
        if (this.elements.declinaisonSection) {
            this.elements.declinaisonSection.classList.remove('hidden');
        }
        this.hideKitSection();
        this.hideTintSection();
        this.hideResult();
    }

    hideDeclinaisonSection() {
        if (this.elements.declinaisonSection) {
            this.elements.declinaisonSection.classList.add('hidden');
        }
    }

    async loadDeclinaisons(modelId) {
        const grid = this.elements.declinaisonList;
        if (!grid) return;

        grid.innerHTML = '<div class="loading">Loading options...</div>';

        try {
            const response = await fetch(`${this.apiBase}/declinaisons?modele_id=${modelId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();

            const declinaisons = data?.liste?.valeurs || data?.declinaisons || data || [];

            if (declinaisons.length === 0) {
                grid.innerHTML = '<p>No options available</p>';
                return;
            }

            this.renderTileGrid(grid, declinaisons, 'declinaison', (item) => {
                this.onDeclinaisonSelect(item);
            });

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

            const imageUrl = item.images?.[0]?.url || item.image_url;
            let label = item.titre || item.label || item.name;
            let badge = '';

            // For declinaisons (year/trim), show actual year range
            if (type === 'declinaison' && item.annee_debut) {
                const yearStart = item.annee_debut;
                const yearEnd = item.annee_fin || 'present';
                badge = `${yearStart} - ${yearEnd}`;
                // Also update label if needed
                if (item.version) label = `${item.version} (${badge})`;
                else if (item.carrosserie) label = `${item.carrosserie} (${badge})`;
                else label = badge;
            }

            card.innerHTML = `
            ${imageUrl ? `<img src="${imageUrl}" alt="${label}" loading="lazy">` : `
                <div style="height:80px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; justify-content:center;">
                    <span>${type === 'model' ? '🚙' : '🚗'}</span>
                </div>
            `}
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

        this.updateProgress(4);
        this.showKitSection();
        this.loadKits(this.state.selectedDeclinaison.id);
    }

    showKitSection() {
        if (this.elements.kitSection) {
            this.elements.kitSection.classList.remove('hidden');
        }
        this.hideTintSection();
        this.hideResult();
    }

    hideKitSection() {
        if (this.elements.kitSection) {
            this.elements.kitSection.classList.add('hidden');
        }
    }

    async loadKits(declinaisonId) {
        const grid = this.elements.kitList;
        if (!grid) return;

        grid.innerHTML = '<div class="loading">Loading kits...</div>';

        try {
            const response = await fetch(`${this.apiBase}/kits?declinaison_id=${declinaisonId}&lang=${this.getCurrentLang()}`);
            const data = await response.json();

            const kits = data?.liste?.valeurs || data?.kits || data || [];

            if (kits.length === 0) {
                grid.innerHTML = '<p>No kits available</p>';
                return;
            }

            this.renderTileGrid(grid, kits, 'kit', (item) => {
                this.onKitSelect(item);
            });

        } catch (error) {
            console.error('Failed to load kits:', error);
            grid.innerHTML = '<p>Failed to load kits</p>';
        }
    }

    onKitSelect(kit) {
        this.state.selectedKit = {
            id: kit.id || kit.vitre_id,
            label: kit.titre || kit.label
        };

        this.updateProgress(5);
        this.showTintSection();
        this.loadFilms();
    }

    showTintSection() {
        if (this.elements.tintSection) {
            this.elements.tintSection.classList.remove('hidden');
        }
        this.hideResult();
    }

    hideTintSection() {
        if (this.elements.tintSection) {
            this.elements.tintSection.classList.add('hidden');
        }
    }

    async loadFilms() {
        const filmSelect = this.elements.filmSelect;
        if (!filmSelect) return;

        filmSelect.disabled = true;
        filmSelect.innerHTML = '<option value="">Loading tints...</option>';

        try {
            const response = await fetch(
                `${this.apiBase}/films?declinaison_id=${this.state.selectedDeclinaison.id}&vitre_id=${this.state.selectedKit.id}&lang=${this.getCurrentLang()}`
            );
            const data = await response.json();

            const films = data?.liste?.valeurs || data?.films || data || [];

            filmSelect.innerHTML = '<option value="">Choose a tint</option>';

            films.forEach(film => {
                const option = document.createElement('option');
                option.value = film.id || film.film_id;
                option.textContent = film.titre || film.label || film.name;
                filmSelect.appendChild(option);
            });

            filmSelect.disabled = false;

        } catch (error) {
            console.error('Failed to load films:', error);
            filmSelect.innerHTML = '<option value="">Failed to load tints</option>';
        }
    }

    async onFilmChange(event) {
        const filmId = event.target.value;
        if (!filmId) {
            this.hideResult();
            return;
        }

        this.state.selectedFilm = filmId;

        try {
            const response = await fetch(
                `${this.apiBase}/film-detail?declinaison_id=${this.state.selectedDeclinaison.id}&vitre_id=${this.state.selectedKit.id}&film_id=${filmId}&lang=${this.getCurrentLang()}`
            );
            const data = await response.json();

            this.state.filmDetail = data;
            this.showResult(data);
            this.updateProgress(5, true);

        } catch (error) {
            console.error('Failed to load film details:', error);
        }
    }

    async showResult(detail) {
        const resultBox = this.elements.resultBox;
        const resultContent = this.elements.resultContent;

        if (!resultBox || !resultContent) return;

        // ✅ Translate heading and button
        await this.translateHeading();
        await this.translateButton();

        // ✅ Translate static labels
        const refLabel = await this.translateStaticText("Ref:", "ref");
        const uvLabel = await this.translateStaticText("UV", "uv");
        const solarLabel = await this.translateStaticText("Solar", "solar");
        const lightLabel = await this.translateStaticText("Light", "light");
        const techSheetLabel = await this.translateStaticText("Technical Sheet", "techSheet");
        const noPDFLabel = await this.translateStaticText("No PDF", "noPDF");

        // Get data from API
        const firstValue = detail?.liste?.valeurs?.[0] || detail;
        const reference = detail?.reference || firstValue?.reference || 'N/A';
        const specs = {
            uv: firstValue?.rejet_UV || detail?.rejet_UV,
            solar: firstValue?.protection_solaire || detail?.protection_solaire,
            light: firstValue?.transmission_lumiere || detail?.transmission_lumiere
        };
        const schemeImages = detail?.images || firstValue?.images || [];
        const pdfUrl = detail?.ficheTechnique?.url || firstValue?.ficheTechnique?.url;
        const apiPrice = firstValue?.prix_public?.prix || detail?.prix_public?.prix || 0;
        const currentLang = this.getCurrentLang();

        // ✅ Render with translated labels
        resultContent.innerHTML = `
        <div class="result-compact">
            <div class="compact-section">
                <div class="row">
                    <span class="label">🔖 ${refLabel}</span>
                    <span>${reference}</span>
                </div>
                <div class="row specs">
                    ${specs.uv ? `<span>${uvLabel} ${specs.uv}%</span>` : ''}
                    ${specs.solar ? `<span>${solarLabel} ${specs.solar}%</span>` : ''}
                    ${specs.light ? `<span>${lightLabel} ${specs.light}%</span>` : ''}
                </div>
                ${schemeImages.length ? `
                    <div class="row images">
                        ${schemeImages.map(img => `<img src="${img.url || img}">`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="compact-section">
                ${pdfUrl
                ? `<a href="${pdfUrl}" target="_blank" class="pdf-link">📄 ${techSheetLabel}</a>`
                : `<span class="no-pdf">${noPDFLabel}</span>`
            }
            </div>
            <div class="compact-price">
                <strong>€${(parseFloat(apiPrice || 0) + parseFloat(window.VarianceConfig.productPrice || 0)).toLocaleString(
                currentLang === 'nl' ? 'nl-NL' : 'en-US',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</strong>
            </div>
        </div>
    `;

        if (this.elements.addToCartBtn) {
            this.elements.addToCartBtn.classList.remove('hidden');
        }

        resultBox.classList.remove('hidden');
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    hideResult() {
        if (this.elements.resultBox) {
            this.elements.resultBox.classList.add('hidden');
        }
    }

    updateProgress(step, isComplete = false) {
        const steps = document.querySelectorAll('.step');
        steps.forEach((stepEl, index) => {
            const stepNum = index + 1;
            stepEl.classList.remove('active', 'completed');

            if (stepNum < step) {
                stepEl.classList.add('completed');
            } else if (stepNum === step) {
                stepEl.classList.add('active');
            }
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
            technicalSheetUrl: filmValue?.ficheTechnique?.url || '',
            technicalSheetName: filmValue?.ficheTechnique?.name || 'Technical Sheet',
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
            'Technical Sheet': configData.technicalSheetUrl,
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
            // 1. Get variant ID from backend (with timeout)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const backendRes = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!backendRes.ok) {
                throw new Error(`Backend error: ${backendRes.status}`);
            }

            const backendData = await backendRes.json();
            if (!backendData.success || !backendData.variantId) {
                throw new Error(backendData.error || 'Failed to get variant');
            }

            let variantId = backendData.variantId;
            // Clean GID if needed
            if (typeof variantId === 'string' && variantId.includes('gid://')) {
                variantId = variantId.split('/').pop();
            }
            variantId = parseInt(variantId);

            console.log("Adding to cart - Variant ID:", variantId);

            // 2. Add to Shopify cart
            const formData = new FormData();
            formData.append('id', variantId);
            formData.append('quantity', '1');

            // Add properties
            Object.keys(cartProperties).forEach(key => {
                formData.append(`properties[${key}]`, cartProperties[key]);
            });

            const cartAddRes = await fetch('/cart/add.js', {
                method: 'POST',
                body: formData,
            });

            if (!cartAddRes.ok) {
                const cartError = await cartAddRes.json();
                throw new Error(cartError.description || 'Cart add failed');
            }

            // Success - redirect
            window.location.href = '/cart';

        } catch (error) {
            console.error('Add to cart error:', error);
            if (error.name === 'AbortError') {
                alert('Request timed out. Please check your connection and try again.');
            } else {
                alert('Could not add to cart. ' + error.message);
            }
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }
}

// ✅ New initialization with permission check
document.addEventListener('DOMContentLoaded', async () => {
    const configuratorContainer = document.getElementById('variance-configurator');
    if (!configuratorContainer) return;

    // Get product ID from liquid variable (already defined in theme)
    const productId = window.VarianceConfig?.productId || null;
    const shopDomain = window.Shopify?.shop || ''; // Shopify injects this globally

    if (!productId) {
        console.warn('No product ID found, hiding configurator');
        configuratorContainer.style.display = 'none';
        return;
    }

    try {
        // Call your backend to check if this product is allowed
        const response = await fetch(`/apps/customizer/check-product-extension?productId=${productId}&shop=${shopDomain}`);
        const data = await response.json();

        if (data.allowed) {
            // ✅ Show and initialize configurator
            configuratorContainer.style.display = 'block';
            new VarianceConfigurator();
            console.log('Variance Configurator initialized for product', productId);
        } else {
            // ❌ Hide configurator completely
            configuratorContainer.style.display = 'none';
            // Optionally remove from DOM
            // configuratorContainer.remove();
            console.log('Configurator not allowed for this product');
        }
    } catch (error) {
        console.error('Failed to check extension permission:', error);
        // On error, hide configurator for safety
        configuratorContainer.style.display = 'none';
    }
});