// --- Global Functions (needed due to inline HTML event handlers) ---

function showFileName() {
  const fileInput = document.getElementById("invoiceUpload");
  const label = document.getElementById("uploadLabel");
  if (fileInput && label) {
    if (fileInput.files.length > 0) {
      label.textContent = fileInput.files[0].name;
    } else {
      label.textContent = "Choose file (PDF, JPG, PNG)";
    }
  }
}

function clearInvoiceError() {
  const error = document.getElementById('invoiceError');
  if (error) error.textContent = '';
}

// --- Start Script ---

document.addEventListener('DOMContentLoaded', async () => {
  const loggedInUser = JSON.parse(sessionStorage.getItem("loggedInUser"));
  if (!loggedInUser || (loggedInUser.role !== 'branch' && loggedInUser.role !== 'admin')) {
    sessionStorage.setItem('logoutMessage', 'Session expired or unauthorized access.');
    window.location.href = 'loading.html';
    return;
  }

  const shopName = loggedInUser.branch;
  const branches = await DataAPI.getBranches();
  const clients = await DataAPI.getClients();

  const shopNameElement = document.getElementById('shopName');
  const locationElement = document.getElementById('location');
  const dateTimeElement = document.getElementById('dateTime');

  if (shopNameElement) {
    shopNameElement.value = branches[shopName]?.name || shopName;
  }
  if (locationElement) {
    locationElement.value = branches[shopName]?.location || "";
  }
  if (dateTimeElement) {
    dateTimeElement.value = new Date().toLocaleString();
  }

  await populateClientDropdown(shopName, clients);

  const phoneNumberField = document.getElementById('phoneNumber');
  const clientNameDropdown = document.getElementById('clientName');

  if (clientNameDropdown && phoneNumberField) {
    clientNameDropdown.addEventListener('change', async (event) => {
      const selectedClientName = event.target.value;
      const currentClients = await DataAPI.getClients();
      const branchClients = currentClients[loggedInUser.branch] || [];
      const selectedClient = branchClients.find(c => c.name === selectedClientName);
      phoneNumberField.value = selectedClient?.phoneNumber || '';
      removeError('clientNameError');
      removeError('phoneNumberError');
    });
  }

  // Attach file input change event to update label
  const invoiceFileInput = document.getElementById('invoiceUpload');
  if (invoiceFileInput) {
    invoiceFileInput.addEventListener('change', showFileName);
  }

  // Attach file input change event for Product Purchased Invoice
  const purchasedInvoiceInput = document.getElementById('purchasedInvoiceUpload');
  if (purchasedInvoiceInput) {
    purchasedInvoiceInput.addEventListener('change', function() {
      const label = document.getElementById('purchasedUploadLabel');
      if (purchasedInvoiceInput.files.length > 0) {
        label.textContent = purchasedInvoiceInput.files[0].name;
      } else {
        label.textContent = 'Choose file (PDF, JPG, PNG)';
      }
    });
  }

  // --- FORM SUBMIT ---
  const purchaseForm = document.getElementById('purchaseForm');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Prevent default form submission and page reload
      // --- NEW: Only use validateProductRows() for product row validation ---
      if (!validateProductRows()) {
      e.preventDefault();
        // Scroll to first error
        const firstError = document.querySelector('.product-error, .variant-error, .amount-error, .productMoneyError');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // --- END NEW ---

      // UI elements
      const spinnerDiv = document.getElementById('purchase-spinner');
      const submitBtn = purchaseForm.querySelector('button[type="submit"]');
      if (spinnerDiv) spinnerDiv.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;

      // Clear all errors (for non-product fields)
      ['shopNameError','locationError','clientNameError','phoneNumberError',
      'invoiceError','commentError','dateTimeError',
      'purchasedInvoiceError','invoiceNumberError'].forEach(removeError);

      const selectedClientName = document.getElementById('clientName')?.value || '';
      const phoneNumber = document.getElementById('phoneNumber')?.value || '';
      const invoiceFileInput = document.getElementById('invoiceUpload');
      const invoiceFile = invoiceFileInput?.files[0];
      const purchasedInvoiceInput = document.getElementById('purchasedInvoiceUpload');
      const purchasedInvoiceFile = purchasedInvoiceInput?.files[0];
      const invoiceNumber = document.getElementById('invoiceNumber')?.value || '';
      const comment = document.getElementById('comment')?.value || '';
      const dateTimeISO = new Date().toISOString();
      const dateTime = new Date().toLocaleString();

      let hasError = false;

      if (!selectedClientName) {
        showError('clientNameError', "Client name is required.");
        hasError = true;
      }
      if (!phoneNumber) {
        showError('phoneNumberError', "Phone number is required.");
        hasError = true;
      }
      if (!invoiceNumber) {
        showError('invoiceNumberError', "Invoice number is required.");
        hasError = true;
      }

      if (!invoiceFile) {
        showError('invoiceError', "Product invoice file is required.");
        hasError = true;
      } else {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(invoiceFile.type)) {
          showError('invoiceError', "Only PDF, JPG, or PNG files are allowed.");
          hasError = true;
        }
      }

      // NEW: Validate Product Purchased Invoice
      if (!purchasedInvoiceFile) {
        showError('purchasedInvoiceError', "Product purchased invoice file is required.");
        hasError = true;
      } else {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(purchasedInvoiceFile.type)) {
          showError('purchasedInvoiceError', "Only PDF, JPG, or PNG files are allowed.");
          hasError = true;
        }
      }

      if (hasError) {
        if (spinnerDiv) spinnerDiv.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // Collect all product entries
      const productEntries = document.querySelectorAll('.product-entry');
      const productList = [];
      productEntries.forEach((entry) => {
        const itemSelect = entry.querySelector('select[name="purchasedItem"]');
        const product = itemSelect?.value || '';
        let variant = '';
        let variant2 = '';
        // Handle special cases for products with two dropdowns
        if (product === "KIPAU DESIGN" || product === "KIPAU T3") {
          const typeSelect = entry.querySelector('select[name="variantType"]');
          const weightSelect = entry.querySelector('select[name="variantWeight"]');
          variant = typeSelect ? typeSelect.value : '';
          variant2 = weightSelect ? weightSelect.value : '';
        } else if (product === "KIPAU 2 IN 1") {
          const weightSelect = entry.querySelector('select[name="variantWeight"]');
          variant = '';
          variant2 = weightSelect ? weightSelect.value : '';
        } else if (product === "THINNER") {
          const typeSelect = entry.querySelector('select[name="variantType"]');
          const unitSelect = entry.querySelector('select[name="variantUnit"]');
          variant = typeSelect ? typeSelect.value : '';
          variant2 = unitSelect ? unitSelect.value : '';
        } else {
          const variantSelect = entry.querySelector('.variant-select');
          if (variantSelect) {
            variant = '';
            variant2 = variantSelect.value;
          } else {
            const variantLabel = entry.querySelector('.variant-label');
            if (variantLabel) {
              variant = '';
              variant2 = variantLabel.textContent;
            }
          }
        }
        const amountInput = entry.querySelector('input[name="bucketAmount"]');
        const amount = parseInt(amountInput?.value || 0);
        const moneyInput = entry.querySelector('input[name="productMoney"]');
        const money = moneyInput?.value.trim().toUpperCase() || '';
        // Save both variants if present
        productList.push({
          purchasedItem: product,
          variant: variant,
          variant2: variant2,
          amount: amount,
          money: money
        });
      });

      // Read both files as base64 and submit
      const reader1 = new FileReader();
      const reader2 = new FileReader();
      let invoiceFileData, purchasedInvoiceFileData;
      let invoiceFileName = invoiceFile ? invoiceFile.name : '';
      let purchasedInvoiceFileName = purchasedInvoiceFile ? purchasedInvoiceFile.name : '';
      reader1.onload = function(event) {
        invoiceFileData = event.target.result;
        reader2.readAsDataURL(purchasedInvoiceFile);
      };
      reader2.onload = async function(event) {
        purchasedInvoiceFileData = event.target.result;
        const purchaseData = {
          shopName: shopNameElement.value,
          branchId: loggedInUser.branch,
          location: locationElement.value,
          clientName: selectedClientName,
          phoneNumber,
          dateTime, // for display
          dateTimeISO, // for sorting
          invoiceFileData,
          invoiceFileName,
          purchasedInvoiceFileData,
          purchasedInvoiceFileName,
          invoiceNumber,
          comment,
          purchases: productList
        };
        try {
          await DataAPI.savePurchase(purchaseData);
          // Debug: Confirm purchase was saved
          console.log('Purchase saved, attempting to show modal');
          const modal = document.getElementById('purchase-success-modal');
          if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
            // Focus the OK button for accessibility
            const okBtn = document.getElementById('purchase-success-ok');
            if (okBtn) {
              okBtn.focus();
              okBtn.onclick = () => {
                modal.classList.remove('show');
                modal.style.display = 'none';
              };
            }
          } else {
            console.error('Purchase success modal not found in DOM!');
            alert('Purchase was successful, but the success modal could not be displayed.');
          }
          // Only reset the form after showing the modal
          purchaseForm.reset();
          shopNameElement.value = branches[loggedInUser.branch]?.name || '';
          locationElement.value = branches[loggedInUser.branch]?.location || '';
          if (dateTimeElement) dateTimeElement.value = new Date().toLocaleString();
          if (phoneNumberField) phoneNumberField.value = "";
          if (clientNameDropdown) await populateClientDropdown(shopName, clients);
          document.getElementById('uploadLabel').textContent = "Choose file (PDF, JPG, PNG)";
          document.getElementById('purchasedUploadLabel').textContent = "Choose file (PDF, JPG, PNG)";
          document.getElementById('products-section').innerHTML = '';
          addDefaultProductRow();
        } catch (error) {
          // No top message on error
          console.error('Error saving purchase:', error);
        } finally {
          if (spinnerDiv) spinnerDiv.classList.add('hidden');
          if (submitBtn) submitBtn.disabled = false;
        }
      };
      reader1.onerror = () => {
        // No top message on error
      };
      reader2.onerror = () => {
        // No top message on error
      };
      reader1.readAsDataURL(invoiceFile);
    });
  }

  addDefaultProductRow();
});

// --- Utilities ---

function showError(id, message) {
  const errorElement = document.getElementById(id);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('text-red-500');
    errorElement.style.display = 'block';
    errorElement.style.visibility = 'visible';
    errorElement.style.opacity = '1';
    errorElement.style.height = 'auto';
    errorElement.style.marginTop = '0.25rem';
  }
}

function removeError(id) {
  const errorElement = document.getElementById(id);
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.classList.remove('text-red-500');
    errorElement.style.display = 'none';
    errorElement.style.visibility = 'hidden';
    errorElement.style.opacity = '0';
    errorElement.style.height = '0';
    errorElement.style.marginTop = '0';
  }
}

async function populateClientDropdown(branchId, allClients) {
  const clientNameDropdown = document.getElementById('clientName');
  if (!clientNameDropdown) return;

  clientNameDropdown.innerHTML = '<option value="">Enter client name</option>';
  const branchClients = allClients[branchId] || [];
  branchClients.sort((a, b) => a.name.localeCompare(b.name));

  for (const client of branchClients) {
    const option = document.createElement('option');
    option.value = client.name;
    option.textContent = client.name;
    clientNameDropdown.appendChild(option);
  }
}

// --- Product/Variant/Unit Automation Data ---
const PRODUCT_VARIANTS = {
  "WEATHER GUARD CLASSIC SEMI GLOSS": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "MIXED WEATHER GUARD": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "SILK CLASSIC SEMI GLOSS": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "MIXED SILK": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "IPOLY EMULSION ECONOMIC GRADE": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "PREMIUM EMULSION MATT CLASSIC": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  // KIPAU DESIGN: type + weight
  "KIPAU DESIGN": {
    type: ["3mm", "2.5mm", "0mm", "0.8mm", "1.5mm", "sample"],
    weight: ["5kg", "30kg"],
    amountLabel: "Quantity"
  },
  // KIPAU PLASTER 25kg
  "KIPAU PLASTER 25kg": { units: ["25kg"], amountLabel: "Quantity" },
  // KIPAU PLASTER 20kg
  "KIPAU PLASTER 20kg": { units: ["20kg"], amountLabel: "Quantity" },
  // KIPAU 2 IN 1: only weight
  "KIPAU 2 IN 1": {
    weight: ["20kg", "25kg"],
    amountLabel: "Quantity"
  },
  // KIPAU T3: type + weight
  "KIPAU T3": {
    type: ["3mm", "2.5mm", "0mm", "0.8mm", "1.5mm", "sample"],
    weight: ["20kg", "25kg"],
    amountLabel: "Quantity"
  },
  "FAST DRY": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "GLOSS ENAMEL": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "NITRO CELLALOSE": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  // THINNER: type + unit
  "THINNER": {
    type: ["High Gloss", "Standard", "Normal"],
    unit: ["1L", "5L"],
    amountLabel: "Quantity"
  },
  "2K CRYL": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
  "WOOD GLUE": { units: ["1L", "4L", "20L"], amountLabel: "Quantity" },
};

function populateProductDropdown(select) {
  select.innerHTML = '<option value="">Select product</option>';
  Object.keys(PRODUCT_VARIANTS).forEach(product => {
    const option = document.createElement('option');
    option.value = product;
    option.textContent = product;
    select.appendChild(option);
  });
}

function createVariantDropdown(product, name = "variant") {
  const config = PRODUCT_VARIANTS[product] || {};
  // Special cases for products with two dropdowns
  if (product === "KIPAU DESIGN" || product === "KIPAU T3") {
    // Type + Weight (stacked vertically)
    return `
      <div class="flex flex-col gap-2 w-full">
        <select name="${name}Type" class="form-input variant-select w-full">
          <option value="">Select type</option>
          ${config.type.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
        <select name="${name}Weight" class="form-input variant-select w-full">
          <option value="">Select weight</option>
          ${config.weight.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (product === "KIPAU 2 IN 1") {
    // Only Weight
    return `
      <select name="${name}Weight" class="form-input variant-select w-full">
        <option value="">Select weight</option>
        ${config.weight.map(v => `<option value="${v}">${v}</option>`).join('')}
      </select>
    `;
  } else if (product === "THINNER") {
    // Type + Unit (stacked vertically)
    return `
      <div class="flex flex-col gap-2 w-full">
        <select name="${name}Type" class="form-input variant-select w-full">
          <option value="">Select type</option>
          ${config.type.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
        <select name="${name}Unit" class="form-input variant-select w-full">
          <option value="">Select unit</option>
          ${config.unit.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (config.units && config.units.length === 1 && config.units[0] !== "") {
    // Only one variant, show as label
    return `<span class="variant-label">${config.units[0]}</span><input type="hidden" name="${name}" value="${config.units[0]}">`;
  } else if (config.units && config.units.length > 0) {
    return `<select name="${name}" class="form-input variant-select w-full">${config.units.map(v => `<option value="${v}">${v}</option>`).join('')}</select>`;
  } else {
    return '';
  }
}

function updateAmountLabel(product, container) {
  const labelEl = container.querySelector('.amount-label');
  if (labelEl) labelEl.textContent = 'Quantity';
}

// Utility: Format number with commas (for thousands)
function formatMoneyInput(value) {
  // Split value into number and non-number (currency) parts
  const match = value.match(/^(\d+)([A-Za-z]*)$/);
  if (!match) return value;
  const num = match[1];
  const currency = match[2] || '';
  // Format number with commas
  const formattedNum = num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return formattedNum + currency;
}

// Attach money input formatter to all productMoney fields (including dynamically added rows)
function attachMoneyInputFormatter(input) {
  input.addEventListener('input', function(e) {
    // Remove all commas for processing
    let raw = this.value.replace(/,/g, '');
    // Uppercase for currency
    raw = raw.toUpperCase();
    // Format if numeric part
    const match = raw.match(/^(\d+)([A-Z]*)$/);
    if (match) {
      const formatted = formatMoneyInput(raw);
      // Save cursor position
      const start = this.selectionStart;
      const before = this.value.length;
      this.value = formatted;
      // Try to restore cursor position
      const after = this.value.length;
      this.setSelectionRange(start + (after - before), start + (after - before));
    }
  });
}

function addDefaultProductRow() {
  const section = document.getElementById('products-section');
  let template = section.querySelector('.product-entry');
  // If no product-entry exists (all removed), use the original HTML template
  if (!template) {
    // Create a new div and set its innerHTML to the original template
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `
      <div class="product-entry grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-gray-50 p-3 rounded-md shadow-sm">
    <div>
          <select name="purchasedItem" class="form-input w-full product-select">
            <option value="">Select product</option>
      </select>
          <p class="product-error text-xs text-red-500 min-h-[1.25rem]"></p>
    </div>
        <div class="variant-container">
          <p class="variant-error text-xs text-red-500 min-h-[1.25rem]"></p>
    </div>
        <div class="flex items-center gap-2 amount-container">
          <label class="text-sm text-gray-700 amount-label">Quantity</label>
      <input type="number" name="bucketAmount" value="1" min="1" class="w-16 border rounded text-center" />
      <button type="button" class="remove-product text-red-500 text-lg" title="Remove product">&times;</button>
          <p class="amount-error text-xs text-red-500 min-h-[1.25rem]"></p>
    </div>
        <div class="col-span-1 sm:col-span-4 mt-2">
      <label class="block text-xs font-medium text-green-700 mb-1">Money</label>
      <input type="text" name="productMoney" placeholder="Enter amount (e.g. 1000RWF)" class="form-input w-full" style="text-transform:uppercase;" />
      <p class="productMoneyError text-xs text-red-500 min-h-[1.25rem]"></p>
        </div>
    </div>
  `;
    template = tempDiv.firstElementChild;
  } else {
    template = template.cloneNode(true);
  }
  // Reset fields
  const productSelect = template.querySelector('.product-select');
  populateProductDropdown(productSelect);
  const variantContainer = template.querySelector('.variant-container');
  variantContainer.innerHTML = '';
  const amountInput = template.querySelector('input[name="bucketAmount"]');
  amountInput.value = 1;
  const moneyInput = template.querySelector('input[name="productMoney"]');
  moneyInput.value = '';
  // Remove error
  template.querySelectorAll('.product-error, .variant-error, .amount-error, .productMoneyError').forEach(e => e.textContent = '');
  // Remove product row
  template.querySelector('.remove-product').addEventListener('click', () => {
    template.remove();
    // If all rows are removed, you can still add a new one
  });
  // Product select change
  productSelect.addEventListener('change', function() {
    const product = this.value;
    const variantCont = template.querySelector('.variant-container');
    variantCont.innerHTML = createVariantDropdown(product);
    updateAmountLabel(product, template.querySelector('.amount-container'));
    // Clear product error
    const productError = template.querySelector('.product-error');
    if (productError) productError.textContent = '';
    // Add variant change listener (if dropdown appears)
    const variantSelect = template.querySelector('.variant-select');
    if (variantSelect) {
      variantSelect.addEventListener('change', function() {
        const variantError = template.querySelector('.variant-error');
        if (variantError) variantError.textContent = '';
      });
    }
  });
  // Amount input
  template.querySelector('input[name="bucketAmount"]').addEventListener('input', function() {
    const amountError = template.querySelector('.amount-error');
    if (amountError) amountError.textContent = '';
  });
  // Money input
  moneyInput.addEventListener('input', function() {
  const moneyError = template.querySelector('.productMoneyError');
    if (moneyError) moneyError.textContent = '';
  });
  attachMoneyInputFormatter(moneyInput);
  section.appendChild(template);
}

// On DOMContentLoaded, update the first row and set up addProduct
window.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('products-section');
  const firstRow = section.querySelector('.product-entry');
  if (firstRow) {
    populateProductDropdown(firstRow.querySelector('.product-select'));
    firstRow.querySelector('.variant-container').innerHTML = '';
    firstRow.querySelector('.remove-product').addEventListener('click', () => firstRow.remove());
    firstRow.querySelector('.product-select').addEventListener('change', function() {
      const product = this.value;
      const variantCont = firstRow.querySelector('.variant-container');
      variantCont.innerHTML = createVariantDropdown(product);
      updateAmountLabel(product, firstRow.querySelector('.amount-container'));
      // Clear product error
      const productError = firstRow.querySelector('.product-error');
      if (productError) productError.textContent = '';
      // Add variant change listener (if dropdown appears)
      const variantSelect = firstRow.querySelector('.variant-select');
      if (variantSelect) {
        variantSelect.addEventListener('change', function() {
          const variantError = firstRow.querySelector('.variant-error');
          if (variantError) variantError.textContent = '';
        });
      }
    });
    // Amount input
    firstRow.querySelector('input[name="bucketAmount"]').addEventListener('input', function() {
      const amountError = firstRow.querySelector('.amount-error');
      if (amountError) amountError.textContent = '';
    });
    // Money input
    const moneyInput = firstRow.querySelector('input[name="productMoney"]');
    moneyInput.addEventListener('input', function() {
      const moneyError = firstRow.querySelector('.productMoneyError');
      if (moneyError) moneyError.textContent = '';
    });
    attachMoneyInputFormatter(moneyInput);
  }
  // Add product button
  window.addProduct = addDefaultProductRow;
});

// --- Enhanced Row Validation ---
function validateProductRows() {
  const productEntries = document.querySelectorAll('.product-entry');
  let hasError = false;
  const seen = new Set();
  productEntries.forEach((entry, idx) => {
    // Clear previous errors
    entry.querySelectorAll('.product-error').forEach(e => e.textContent = '');
    // Product
    const productSelect = entry.querySelector('.product-select');
    const product = productSelect?.value || '';
    const productError = entry.querySelector('.product-error');
    // Variant(s)
    let variant = '';
    let variant2 = '';
    let variantError = entry.querySelector('.variant-error');
    // Special cases for products with two dropdowns
    if (product === "KIPAU DESIGN" || product === "KIPAU T3") {
      const typeSelect = entry.querySelector('select[name="variantType"]');
      const weightSelect = entry.querySelector('select[name="variantWeight"]');
      variant = typeSelect ? typeSelect.value : '';
      variant2 = weightSelect ? weightSelect.value : '';
      if (!variant) {
        if (variantError) variantError.textContent = 'Type is required.';
      }
      if (!variant2) {
        if (variantError) variantError.textContent += ' Weight is required.';
      }
    } else if (product === "KIPAU 2 IN 1") {
      const weightSelect = entry.querySelector('select[name="variantWeight"]');
      variant = weightSelect ? weightSelect.value : '';
      if (!variant) {
        if (variantError) variantError.textContent = 'Weight is required.';
      }
    } else if (product === "THINNER") {
      const typeSelect = entry.querySelector('select[name="variantType"]');
      const unitSelect = entry.querySelector('select[name="variantUnit"]');
      variant = typeSelect ? typeSelect.value : '';
      variant2 = unitSelect ? unitSelect.value : '';
      if (!variant) {
        if (variantError) variantError.textContent = 'Type is required.';
      }
      if (!variant2) {
        if (variantError) variantError.textContent += ' Unit is required.';
      }
    } else {
      const variantSelect = entry.querySelector('.variant-select');
      if (variantSelect) variant = variantSelect.value;
      else {
        const variantLabel = entry.querySelector('.variant-label');
        if (variantLabel) variant = variantLabel.textContent;
      }
      if (PRODUCT_VARIANTS[product] && PRODUCT_VARIANTS[product].units && PRODUCT_VARIANTS[product].units.length > 0 && !variant) {
        if (variantError) variantError.textContent = 'Variant is required.';
      }
    }
    // Quantity
    const amountInput = entry.querySelector('input[name="bucketAmount"]');
    const amount = parseInt(amountInput?.value || 0);
    const amountError = entry.querySelector('.amount-error');
    // Money
    const moneyInput = entry.querySelector('input[name="productMoney"]');
    const money = moneyInput?.value.trim().toUpperCase() || '';
    const moneyError = entry.querySelector('.productMoneyError');
    // --- Validation ---
    let rowHasError = false;
    // Product required
    if (!product) {
      if (productError) productError.textContent = 'Product is required.';
      rowHasError = true;
    }
    // Variant(s) required (if applicable)
    if ((product === "KIPAU DESIGN" || product === "KIPAU T3") && (!variant || !variant2)) {
      rowHasError = true;
    } else if ((product === "KIPAU 2 IN 1") && !variant) {
      rowHasError = true;
    } else if ((product === "THINNER") && (!variant || !variant2)) {
      rowHasError = true;
    } else if (PRODUCT_VARIANTS[product] && PRODUCT_VARIANTS[product].units && PRODUCT_VARIANTS[product].units.length > 0 && !variant) {
      rowHasError = true;
    }
    // Quantity required and positive
    if (!amount || amount < 1) {
      if (amountError) amountError.textContent = 'Quantity must be at least 1.';
      rowHasError = true;
    }
    // Money required and valid
    if (!money || !/^[0-9,]+[A-Z]*$/.test(money)) {
      if (moneyError) moneyError.textContent = 'Valid money (e.g. 1,000RWF) is required.';
      rowHasError = true;
    }
    // Duplicate check (use both variants for key if present)
    const key = product + '|' + variant + (variant2 ? '|' + variant2 : '');
    if (seen.has(key)) {
      if (productError) productError.textContent = 'Duplicate product/variant.';
      rowHasError = true;
    } else {
      seen.add(key);
    }
    if (rowHasError) hasError = true;
  });
  return !hasError;
}

// --- Hook into form submit ---
document.addEventListener('DOMContentLoaded', () => {
  const purchaseForm = document.getElementById('purchaseForm');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', (e) => {
      if (!validateProductRows()) {
        e.preventDefault();
        // Scroll to first error
        const firstError = document.querySelector('.product-error, .variant-error, .amount-error, .productMoneyError');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
});
