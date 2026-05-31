class VarianceDecoupeConfigurator {
  constructor() {
    this.apiBase = document.getElementById('variance-decoupe-configurator')?.dataset.apiBase || '/apps/customizer';
    this.shopDomain = window.Shopify?.shop || window.location.hostname;

    this.state = {
      options: [],
      selectedItem: null,
      selectedLaize: null,
      selectedLength: 100,
      sqmPrice: 0,
      totalPrice: 0
    };

    this.elements = {
      selectLoader: document.getElementById('decoupe-select-loader'),
      container: document.getElementById('variance-decoupe-configurator'),
      decoupeSelect: document.getElementById('decoupe-select'),
      detailCard: document.getElementById('decoupe-detail-card'),
      detailLoader: document.getElementById('decoupe-detail-loading'),
      previewImg: document.getElementById('decoupe-preview-img'),
      previewPlaceholder: document.getElementById('decoupe-preview-placeholder'),
      imageLoader: document.getElementById('decoupe-image-loading'),
      valRef: document.getElementById('val-ref'),
      valLaizeSingle: document.getElementById('val-laize-single'),
      valLengthDefault: document.getElementById('val-length-default'),
      valPrice: document.getElementById('val-price'),
      valCommercialRef: document.getElementById('val-commercial-ref'),
      description: document.getElementById('decoupe-description'),
      laizeGroup: document.getElementById('decoupe-laize-group'),
      laizeSelect: document.getElementById('decoupe-laize-select'),
      lengthInput: document.getElementById('decoupe-length-input'),
      sqmPriceLabel: document.getElementById('decoupe-sqm-price'),
      totalPriceLabel: document.getElementById('decoupe-total-price'),
      addToCartBtn: document.getElementById('decoupe-add-to-cart-btn')
    };

    // Create a placeholder element for initial message (if not exists)
    if (!document.getElementById('decoupe-result-placeholder')) {
      const placeholderDiv = document.createElement('div');
      placeholderDiv.id = 'decoupe-result-placeholder';
      placeholderDiv.className = 'result-placeholder';
      placeholderDiv.innerHTML = '<span class="rotating">⏳</span>';
      this.elements.detailCard.parentNode.insertBefore(placeholderDiv, this.elements.detailCard);
    }
    this.resultPlaceholder = document.getElementById('decoupe-result-placeholder');

    this.init();
  }

  init() {
    this.setInitialUI();
    this.loadOptions();
    this.registerEvents();
  }

  setInitialUI() {
    // Hide detail card, show placeholder with hourglass
    this.elements.detailCard.classList.add('hidden');
    if (this.resultPlaceholder) this.resultPlaceholder.classList.remove('hidden');
    this.elements.addToCartBtn.disabled = true;

    // Show image loader initially
    if (this.elements.imageLoader) {
      this.elements.imageLoader.classList.remove('hidden');
      this.elements.imageLoader.innerHTML = '<span class="rotating">⏳</span>';
    }
    this.elements.previewImg.classList.add('hidden');
    this.elements.previewPlaceholder.classList.add('hidden');

    // Clear all static labels (they will be set after translation)
    const labelIds = [
      'decoupe-option-label', 'label-ref', 'label-laize', 'label-length',
      'label-price', 'label-commercial', 'label-price-per-sqm', 'label-total-price',
      'label-select-width', 'label-length-field', 'add-to-cart-text'
    ];
    labelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    // Also set select placeholder to empty
    const select = this.elements.decoupeSelect;
    if (select && select.options[0]) select.options[0].text = '';
  }

  getCurrentLang() {
    return window.VarianceDecoupeConfig?.storeLanguage || 'en';
  }

  // ------------------------------------------------------------
  // Translation methods (calls the backend translation API)
  // ------------------------------------------------------------
  async translateStaticText(text, key) {
    if (!this._staticCache) this._staticCache = {};
    const lang = this.getCurrentLang();
    if (lang === 'en') return text;
    if (this._staticCache[key]) return this._staticCache[key];

    try {
      const res = await fetch(`${this.apiBase}/translate-text`, {
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

  async translateStaticLabels() {
    this.translatedLabels = {
      optionLabel: await this.translateStaticText("Option / Product Type", "optionLabel"),
      ref: await this.translateStaticText("Ref:", "ref"),
      laize: await this.translateStaticText("Breedte / laize:", "laize"),
      length: await this.translateStaticText("Lengte:", "length"),
      price: await this.translateStaticText("Price:", "price"),
      commercial: await this.translateStaticText("Commercial Ref:", "commercial"),
      pricePerSqm: await this.translateStaticText("Price per sq.m", "pricePerSqm"),
      totalPrice: await this.translateStaticText("Total Price", "totalPrice"),
      selectWidth: await this.translateStaticText("Select Width (Laize)", "selectWidth"),
      lengthField: await this.translateStaticText("Car Film aantal (lengte, cm)", "lengthField"),
      chooseOption: await this.translateStaticText("Choose an option...", "chooseOption"),
      pleaseSelectFirst: await this.translateStaticText("Please make a selection first", "pleaseSelectFirst"),
      addToCart: await this.translateStaticText("Add to Cart", "addToCart")
    };
  }

  async applyTranslatedTexts() {
    const t = this.translatedLabels;
    document.getElementById('decoupe-option-label').textContent = t.optionLabel;
    document.getElementById('label-ref').textContent = t.ref;
    document.getElementById('label-laize').textContent = t.laize;
    document.getElementById('label-length').textContent = t.length;
    document.getElementById('label-price').textContent = t.price;
    document.getElementById('label-commercial').textContent = t.commercial;
    document.getElementById('label-price-per-sqm').textContent = t.pricePerSqm;
    document.getElementById('label-total-price').textContent = t.totalPrice;
    document.getElementById('label-select-width').textContent = t.selectWidth;
    document.getElementById('label-length-field').textContent = t.lengthField;
    document.getElementById('add-to-cart-text').textContent = t.addToCart;

    // Update select placeholder
    const select = this.elements.decoupeSelect;
    if (select && select.options[0]) select.options[0].text = t.chooseOption;

    // Update placeholder message
    if (this.resultPlaceholder) {
      this.resultPlaceholder.innerHTML = `<p>🔍 ${t.pleaseSelectFirst}</p>`;
    }
  }

  // ------------------------------------------------------------
  // Loading logic (hourglass everywhere)
  // ------------------------------------------------------------
  async loadOptions() {
    const select = this.elements.decoupeSelect;
    select.disabled = true;
    if (this.elements.selectLoader) this.elements.selectLoader.classList.remove('hidden');

    // Show hourglass in placeholder
    if (this.resultPlaceholder) {
      this.resultPlaceholder.classList.remove('hidden');
      this.resultPlaceholder.innerHTML = '<span class="rotating">⏳</span>';
    }

    // Show image loader while loading options
    if (this.elements.imageLoader) {
      this.elements.imageLoader.classList.remove('hidden');
      this.elements.imageLoader.innerHTML = '<span class="rotating">⏳</span>';
    }
    this.elements.previewImg.classList.add('hidden');
    this.elements.previewPlaceholder.classList.add('hidden');

    // First translate all static labels (this triggers the API call)
    await this.translateStaticLabels();
    await this.applyTranslatedTexts();

    try {
      const response = await fetch(`${this.apiBase}/decoupe-list?lang=${this.getCurrentLang()}`);
      if (!response.ok) throw new Error('Failed to fetch decoupe options');
      const data = await response.json();

      let options = [];
      if (data?.liste?.valeurs && Array.isArray(data.liste.valeurs)) {
        options = data.liste.valeurs;
      } else if (Array.isArray(data)) {
        options = data;
      } else if (data?.valeurs && Array.isArray(data.valeurs)) {
        options = data.valeurs;
      } else {
        console.warn('[Decoupe] Unexpected response format:', data);
      }

      this.state.options = options;
      this.populateOptionsDropdown();

      if (options.length > 0) {
        const firstId = options[0].id;
        this.elements.decoupeSelect.value = firstId;
        this.onOptionChange({ target: { value: firstId } });
      } else {
        select.disabled = false;
        if (this.elements.selectLoader) this.elements.selectLoader.classList.add('hidden');
      }
    } catch (err) {
      console.error('[Decoupe] Error loading options:', err);
      select.innerHTML = `<option value="">${this.translatedLabels.chooseOption || 'Failed'}</option>`;
      select.disabled = false;
      if (this.elements.selectLoader) this.elements.selectLoader.classList.add('hidden');
    }
  }

  populateOptionsDropdown() {
    const select = this.elements.decoupeSelect;
    if (!select) return;

    const defaultText = this.translatedLabels.chooseOption || "";
    select.innerHTML = `<option value="">${defaultText}</option>`;
    if (!Array.isArray(this.state.options)) {
      console.error('[Decoupe] Options is not an array:', this.state.options);
      select.innerHTML += '<option disabled>Invalid data format</option>';
      select.disabled = false;
      if (this.elements.selectLoader) this.elements.selectLoader.classList.add('hidden');
      return;
    }

    this.state.options.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.titre || item.title || item.reference || `Option ${item.id}`;
      select.appendChild(option);
    });
    select.disabled = false;
    if (this.elements.selectLoader) this.elements.selectLoader.classList.add('hidden');
  }

  async onOptionChange(event) {
    const id = event.target.value;
    if (!id) {
      this.resetUI();
      return;
    }

    this.showResultLoader();
    this.elements.addToCartBtn.disabled = true;

    try {
      const response = await fetch(`${this.apiBase}/decoupe-detail/${id}?lang=${this.getCurrentLang()}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      const detail = await response.json();
      this.state.selectedItem = detail;
      await this.renderItemDetails(detail);
      this.elements.addToCartBtn.disabled = false;
    } catch (err) {
      console.error('[Decoupe] Error loading detail:', err);
      this.resetUI();
    }
  }

  async renderItemDetails(detail) {
    if (this.resultPlaceholder) this.resultPlaceholder.classList.add('hidden');
    this.elements.detailCard.classList.remove('hidden');
    this.elements.detailLoader.classList.add('hidden');

    const t = this.translatedLabels;
    // Already applied labels, but ensure dynamic rows get correct labels
    document.querySelector('#row-ref .info-label').textContent = t.ref;
    document.querySelector('#row-laize-single .info-label').textContent = t.laize;
    document.querySelector('#row-length-default .info-label').textContent = t.length;
    document.querySelector('#row-price .info-label').textContent = t.price;
    document.querySelector('#row-commercial-ref .info-label').textContent = t.commercial;
    this.elements.sqmPriceLabel.previousElementSibling.textContent = t.pricePerSqm;
    document.querySelector('.total-label').textContent = t.totalPrice;
    document.querySelector('#decoupe-laize-group .field-label').textContent = t.selectWidth;
    document.querySelector('#decoupe-length-group .field-label').textContent = t.lengthField;

    const firstVal = detail?.liste?.valeurs?.[0] || detail;
    const reference = detail.reference || firstVal.reference || 'N/A';
    const commRef = detail.reference_commerciale || firstVal.reference_commerciale || 'N/A';
    const desc = detail.description || firstVal.description || '';

    this.elements.valRef.textContent = reference;
    this.elements.valCommercialRef.textContent = commRef;

    let basePriceValue = 'N/A';
    const priceRaw = detail['prix de base'] || detail.prix_de_base || firstVal['prix de base'] || firstVal.prix_de_base;
    if (priceRaw) {
      const priceNum = parseFloat(priceRaw);
      if (!isNaN(priceNum)) basePriceValue = priceNum.toFixed(2) + ' €';
    }
    this.elements.valPrice.textContent = basePriceValue;

    if (desc) {
      this.elements.description.innerHTML = desc;
      this.elements.description.classList.remove('hidden');
    } else {
      this.elements.description.classList.add('hidden');
    }

    let imageUrl = '';
    const images = detail.images || firstVal.images;
    if (images && images.length > 0) {
      const firstImg = images[0];
      imageUrl = typeof firstImg === 'string' ? firstImg : firstImg.url || '';
    }
    
    // Hide image loader and show image
    this.hideImageLoaderAndShowImage(imageUrl);

    let sqmPrice = parseFloat(priceRaw) || parseFloat(firstVal.prix_public?.prix || 0);
    this.state.sqmPrice = sqmPrice;
    this.elements.sqmPriceLabel.textContent = `${sqmPrice.toFixed(2)} € / sq.m`;

    const laizeRaw = detail.laize || firstVal.laize || '';
    let laizes = [];
    if (laizeRaw) {
      laizes = String(laizeRaw).split(';').map(l => parseFloat(l.trim())).filter(l => !isNaN(l));
    }
    const rowLaizeSingle = document.getElementById('row-laize-single');

    if (laizes.length > 1) {
      this.elements.laizeGroup.classList.remove('hidden');
      if (rowLaizeSingle) rowLaizeSingle.classList.add('hidden');
      const laizeSelect = this.elements.laizeSelect;
      laizeSelect.innerHTML = '';
      laizes.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = `${l} cm`;
        laizeSelect.appendChild(opt);
      });
      this.state.selectedLaize = laizes[0];
    } else {
      this.elements.laizeGroup.classList.add('hidden');
      if (rowLaizeSingle) rowLaizeSingle.classList.remove('hidden');
      const singleLaize = laizes.length === 1 ? laizes[0] : parseFloat(laizeRaw) || 0;
      this.elements.valLaizeSingle.textContent = singleLaize ? `${singleLaize} cm` : 'N/A';
      this.state.selectedLaize = singleLaize;
    }

    const defaultLength = parseFloat(detail.longueur || firstVal.longueur || 100);
    this.elements.valLengthDefault.textContent = `${defaultLength} cm`;
    if (this.elements.lengthInput) {
      this.elements.lengthInput.value = defaultLength;
      this.state.selectedLength = defaultLength;
    }

    this.calculatePrice();
  }

  onLaizeChange(event) {
    this.state.selectedLaize = parseFloat(event.target.value) || 0;
    this.calculatePrice();
  }

  onLengthChange(event) {
    let length = parseFloat(event.target.value) || 0;
    if (length < 1) length = 1;
    this.state.selectedLength = length;
    this.calculatePrice();
  }

  calculatePrice() {
    const laize = this.state.selectedLaize || 0;
    const length = this.state.selectedLength || 0;
    const sqmPrice = this.state.sqmPrice || 0;
    const area = (laize * length) / 10000;
    const total = area * sqmPrice;
    const roundedTotal = Math.round(total * 100) / 100;
    this.state.totalPrice = roundedTotal;
    const formattedTotal = roundedTotal.toLocaleString(
      this.getCurrentLang() === 'nl' ? 'nl-NL' : 'en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    );
    this.elements.totalPriceLabel.textContent = `${formattedTotal} €`;
  }

  showResultLoader() {
    if (this.resultPlaceholder) this.resultPlaceholder.classList.add('hidden');
    this.elements.detailCard.classList.add('hidden');
    this.elements.detailLoader.classList.remove('hidden');
    this.elements.detailLoader.innerHTML = '<span class="rotating">⏳</span>';

    // Show loading spinner in image area too
    this.showImageLoader();
  }

  // Add new method to show image loader
  showImageLoader() {
    // Hide image and placeholder, show spinner
    this.elements.previewImg.classList.add('hidden');
    this.elements.previewPlaceholder.classList.add('hidden');

    let imageLoader = this.elements.imageLoader;
    if (!imageLoader) {
        imageLoader = document.getElementById('decoupe-image-loading');
        this.elements.imageLoader = imageLoader;
    }
    if (imageLoader) {
        imageLoader.classList.remove('hidden');
        imageLoader.innerHTML = '<span class="rotating">⏳</span>';
        
        // ✅ Center the loader
        imageLoader.style.position = 'absolute';
        imageLoader.style.top = '50%';
        imageLoader.style.left = '50%';
        imageLoader.style.transform = 'translate(-50%, -50%)';
        imageLoader.style.display = 'flex';
        imageLoader.style.alignItems = 'center';
        imageLoader.style.justifyContent = 'center';
        imageLoader.style.zIndex = '10';
    }
}

  // Add new method to hide image loader and show image
  hideImageLoaderAndShowImage(imageUrl) {
    // Hide loader
    if (this.elements.imageLoader) {
      this.elements.imageLoader.classList.add('hidden');
      this.elements.imageLoader.innerHTML = '';
    }

    // Show image
    if (imageUrl) {
      this.elements.previewImg.src = imageUrl;
      this.elements.previewImg.classList.remove('hidden');
      this.elements.previewPlaceholder.classList.add('hidden');
    } else {
      this.elements.previewImg.classList.add('hidden');
      this.elements.previewPlaceholder.classList.remove('hidden');
    }
  }

  resetUI() {
    if (this.resultPlaceholder) this.resultPlaceholder.classList.remove('hidden');
    this.elements.detailCard.classList.add('hidden');
    this.elements.detailLoader.classList.add('hidden');
    
    // Reset image area
    this.elements.previewImg.classList.add('hidden');
    this.elements.previewPlaceholder.classList.remove('hidden');
    if (this.elements.imageLoader) {
      this.elements.imageLoader.classList.add('hidden');
      this.elements.imageLoader.innerHTML = '';
    }
    
    this.elements.addToCartBtn.disabled = true;
    this.state.selectedItem = null;
    this.state.selectedLaize = null;
    this.state.selectedLength = 100;
    this.state.sqmPrice = 0;
    this.state.totalPrice = 0;
  }

  registerEvents() {
    if (this.elements.decoupeSelect) {
      this.elements.decoupeSelect.addEventListener('change', (e) => this.onOptionChange(e));
    }
    if (this.elements.laizeSelect) {
      this.elements.laizeSelect.addEventListener('change', (e) => this.onLaizeChange(e));
    }
    if (this.elements.lengthInput) {
      this.elements.lengthInput.addEventListener('input', (e) => this.onLengthChange(e));
    }
    if (this.elements.addToCartBtn) {
      this.elements.addToCartBtn.addEventListener('click', () => this.addToCart());
    }
  }

  async addToCart() {
    if (!this.state.selectedItem) return;

    const detail = this.state.selectedItem;
    const firstVal = detail?.liste?.valeurs?.[0] || detail;
    const reference = detail.reference || firstVal.reference || 'N/A';
    const category = detail.categorie || detail.category || firstVal.categorie || 'N/A';
    let image = '';
    const images = detail.images || firstVal.images;
    if (images && images.length > 0) {
      const firstImg = images[0];
      image = typeof firstImg === 'string' ? firstImg : firstImg.url || '';
    }

    const payload = {
      decoupeId: detail.id || firstVal.id,
      decoupeTitle: detail.titre || detail.title || firstVal.titre || 'Custom Decoupe',
      selectedLaize: this.state.selectedLaize,
      selectedLength: this.state.selectedLength,
      totalPrice: this.state.totalPrice,
      image: image,
      reference: reference,
      category: category
    };

    const btn = this.elements.addToCartBtn;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="rotating">⏳</span>';
    btn.disabled = true;

    try {
      const response = await fetch(`${this.apiBase}/cart/add-decoupe-item?shop=${encodeURIComponent(this.shopDomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const result = await response.json();
      if (!result.success || !result.variantId) {
        throw new Error(result.error || 'Failed to create product variant');
      }

      let variantId = result.variantId;
      if (typeof variantId === 'string' && variantId.includes('gid://')) {
        variantId = variantId.split('/').pop();
      }
      variantId = parseInt(variantId);

      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', '1');
      formData.append('properties[Option]', payload.decoupeTitle);
      formData.append('properties[Width]', `${payload.selectedLaize} cm`);
      formData.append('properties[Length]', `${payload.selectedLength} cm`);
      formData.append('properties[Reference]', payload.reference);
      formData.append('properties[SKU]', result.sku || '');

      const cartRes = await fetch('/cart/add.js', { method: 'POST', body: formData });
      if (!cartRes.ok) {
        const errData = await cartRes.json();
        throw new Error(errData.description || 'Shopify Cart addition failed');
      }

      window.location.href = '/cart';
    } catch (err) {
      console.error('[Decoupe] Add to cart error:', err);
      alert(`Could not add items to the cart: ${err.message}`);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('variance-decoupe-configurator');
  if (!container) return;

  const productId = window.VarianceDecoupeConfig?.productId;
  const shop = window.Shopify?.shop || window.location.hostname;

  if (!productId) {
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`/apps/customizer/check-decoupe-product-extension?productId=${productId}&shop=${shop}`);
    const data = await res.json();

    if (data.allowed) {
      container.style.display = 'block';
      new VarianceDecoupeConfigurator();
      console.log('[Decoupe] Configurator initialized for product:', productId);
    } else {
      container.style.display = 'none';
      console.log('[Decoupe] Configurator not active for this product.');
    }
  } catch (err) {
    console.error('[Decoupe] Permission check failed:', err);
    container.style.display = 'none';
  }
});