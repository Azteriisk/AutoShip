// AutoShip Merchant Dashboard Client Application

let currentShipments = [];
let currentCatalog = [];
let currentPresets = [];
let currentSettings = {};
let activeModalShipment = null;
let currentCalculatedRates = [];
let selectedCalculatedRate = null;

const PRESET_DIMS = {
  preset_medium_box: { name: 'Medium Box (Standard)', l: 10, w: 7, h: 5 },
  preset_padded_envelope: { name: 'Padded Bubble Mailer', l: 12.5, w: 9.5, h: 1 },
  preset_small_box: { name: 'Small Box', l: 6, w: 4, h: 3 },
  preset_large_box: { name: 'Large Box', l: 14, w: 10, h: 8 },
  preset_extra_large_box: { name: 'Extra Large Box', l: 20, w: 16, h: 12 },
};

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Toast helper
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// Format currency
function formatCurrency(val) {
  return `$${Number(val || 0).toFixed(2)}`;
}

// Tab Switching
tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    tabContents.forEach((c) => c.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const tabName = btn.getAttribute('data-tab');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'overview') loadShipments();
    if (tabName === 'presets') loadPresets();
    if (tabName === 'discounts') {
      loadSettings();
      loadPromos();
    }
    if (tabName === 'settings') loadSettings();
  });
});

// Load Overview & Shipments
async function loadShipments() {
  const tbody = document.getElementById('shipmentsTableBody');
  try {
    const res = await fetch('/api/shipments');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    currentShipments = json.data;
    renderShipmentsTable(currentShipments);
    updateOverviewStats(currentShipments);
  } catch (err) {
    console.error('Failed to load shipments:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Error loading shipments: ${err.message}</td></tr>`;
  }
}

function updateOverviewStats(shipments) {
  document.getElementById('statTotalShipments').textContent = shipments.length;
  const totalSpend = shipments.reduce((sum, s) => sum + (s.totalCost || 0), 0);
  document.getElementById('statTotalSpend').textContent = formatCurrency(totalSpend);

  if (shipments.length > 0) {
    document.getElementById('statAvgDelivery').textContent = '2.2 Days';
  }
}

function renderShipmentsTable(shipments) {
  const tbody = document.getElementById('shipmentsTableBody');
  if (shipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state" style="padding: 3rem 1rem; text-align: center;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📦</div>
          <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-main); margin-bottom: 0.25rem;">No Shipments Generated Yet</div>
          <div style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem;">
            Ready for fulfillment. Create a shipping label from scratch or complete an order on your Clover POS terminal.
          </div>
          <button class="btn btn-primary" onclick="document.querySelector('.tab-btn[data-tab=\\'calculator\\']')?.click()">
            + Create Shipping Label
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = shipments
    .map((s) => {
      const statusClass =
        s.status === 'delivered'
          ? 'badge-success'
          : s.status === 'voided'
          ? 'badge-danger'
          : s.status === 'in_transit' || s.status === 'out_for_delivery'
          ? 'badge-info'
          : 'badge-warning';

      const dateStr = new Date(s.createdAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });

      return `
        <tr>
          <td data-label="Order ID">
            <div class="cell-ellipsis" title="${s.orderId}"><strong>#${s.orderId}</strong></div>
          </td>
          <td data-label="Date">${dateStr}</td>
          <td data-label="Customer">
            <div class="cell-ellipsis" title="${s.toAddress.name}">${s.toAddress.name}</div>
          </td>
          <td data-label="Carrier & Service">
            <div style="font-weight: 600;">${s.carrier}</div>
            <div class="cell-subtext" title="${s.service}">${s.service}</div>
          </td>
          <td data-label="Tracking #">
            <a href="${s.trackingUrl}" target="_blank" class="cell-tracking-link" title="${s.trackingNumber}">
              ${s.trackingNumber} ↗
            </a>
          </td>
          <td data-label="Packaging">
            <div class="cell-subtext" title="${s.parcel?.presetName || 'Standard Box'}">${s.parcel?.presetName || 'Standard Box'}</div>
            <div style="font-size: 0.68rem; color: #64748b;">${s.parcel?.totalWeightLbs || 1} lbs</div>
          </td>
          <td data-label="Status">
            <span class="badge ${statusClass}">${s.status.replace(/_/g, ' ').toUpperCase()}</span>
          </td>
          <td data-label="Cost">
            <strong>${formatCurrency(s.totalCost)}</strong>
          </td>
          <td data-label="Actions">
            <div class="table-action-btns">
              <button class="btn btn-secondary btn-xs" onclick="openLabelModal('${s.id}')" title="Print Label">
                🏷️ Label
              </button>
              <button class="btn btn-secondary btn-xs" onclick="openTrackingModal('${s.id}')" title="Track Shipment">
                📍 Track
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// Search Filter
document.getElementById('shipmentSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = currentShipments.filter(
    (s) =>
      s.orderId.toLowerCase().includes(q) ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.toAddress.name.toLowerCase().includes(q) ||
      s.carrier.toLowerCase().includes(q)
  );
  renderShipmentsTable(filtered);
});

document.getElementById('btnRefreshShipments')?.addEventListener('click', loadShipments);

// Load Boxes & Catalog for Calculator
async function loadBoxesAndCatalog() {
  try {
    const res = await fetch('/api/rates/boxes');
    const json = await res.json();
    if (!json.success) return;

    currentCatalog = json.catalog;
    currentPresets = json.presets;

    const picker = document.getElementById('cartItemsPicker');
    picker.innerHTML = currentCatalog
      .map(
        (item) => `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <span class="item-name">${item.name}</span>
            <span class="item-specs">${item.weightOz} oz | ${item.lengthIn}"x${item.widthIn}"x${item.heightIn}" | $${item.price.toFixed(2)}</span>
          </div>
          <div>
            <input type="number" class="item-qty-input" data-item-id="${item.id}" value="${item.id === 'item_tee' || item.id === 'item_mug' ? 1 : 0}" min="0" max="20">
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load boxes/catalog:', err);
  }
}

// Preset selector dropdown listener
document.getElementById('manualPackagePreset')?.addEventListener('change', (e) => {
  const presetKey = e.target.value;
  const p = PRESET_DIMS[presetKey];
  if (p) {
    document.getElementById('manualDimLength').value = p.l;
    document.getElementById('manualDimWidth').value = p.w;
    document.getElementById('manualDimHeight').value = p.h;
    document.getElementById('resBoxName').textContent = p.name;
    document.getElementById('resBoxDims').textContent = `${p.l}" × ${p.w}" × ${p.h}"`;
  } else {
    document.getElementById('resBoxName').textContent = 'Custom Package Dimensions';
    updateBoxDimensionsDisplay();
  }
});

['manualDimLength', 'manualDimWidth', 'manualDimHeight', 'calcWeightLbs'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', () => {
    updateBoxDimensionsDisplay();
  });
});

function updateBoxDimensionsDisplay() {
  const l = parseFloat(document.getElementById('manualDimLength')?.value) || 0;
  const w = parseFloat(document.getElementById('manualDimWidth')?.value) || 0;
  const h = parseFloat(document.getElementById('manualDimHeight')?.value) || 0;
  const wt = parseFloat(document.getElementById('calcWeightLbs')?.value) || 0;
  const dimsEl = document.getElementById('resBoxDims');
  const wtEl = document.getElementById('resBillableWeight');
  if (dimsEl) dimsEl.textContent = `${l}" × ${w}" × ${h}"`;
  if (wtEl) wtEl.textContent = `${wt.toFixed(1)} lbs`;
}

// Handle Rate Calculation for Standalone Fulfillment
document.getElementById('rateCalculatorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnCalculateRates');
  btn.textContent = '⏳ Calculating Live Rates...';
  btn.disabled = true;

  const destName = document.getElementById('destName').value.trim();
  const destCompany = document.getElementById('destCompany').value.trim();
  const destStreet = document.getElementById('destStreet').value.trim();
  const destStreet2 = document.getElementById('destStreet2').value.trim();
  const destCity = document.getElementById('destCity').value.trim();
  const destState = document.getElementById('destState').value.trim().toUpperCase();
  const destZip = document.getElementById('destZip').value.trim();
  const destPhone = document.getElementById('destPhone').value.trim();

  const lengthIn = parseFloat(document.getElementById('manualDimLength').value) || 10;
  const widthIn = parseFloat(document.getElementById('manualDimWidth').value) || 7;
  const heightIn = parseFloat(document.getElementById('manualDimHeight').value) || 5;
  const weightLbs = parseFloat(document.getElementById('calcWeightLbs').value) || 2.0;

  const presetSelect = document.getElementById('manualPackagePreset');
  const presetId = presetSelect.value;
  const presetName = presetSelect.options[presetSelect.selectedIndex]?.text || 'Standard Box';

  const enteredSubtotal = parseFloat(document.getElementById('calcSubtotal').value) || 0;
  const chkInsurance = document.getElementById('chkInsurance').checked;
  const chkGuarantee = document.getElementById('chkGuarantee').checked;

  const payload = {
    toAddress: {
      name: destName,
      company: destCompany,
      street1: destStreet,
      street2: destStreet2,
      city: destCity,
      state: destState,
      zip: destZip,
      country: 'US',
      phone: destPhone,
      isResidential: true,
    },
    package: {
      presetId,
      presetName,
      lengthIn,
      widthIn,
      heightIn,
      weightLbs,
    },
    cartSubtotal: enteredSubtotal,
    insuranceRequested: chkInsurance,
    deliveryGuaranteeRequested: chkGuarantee,
  };

  try {
    const res = await fetch('/api/rates/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    renderRateResults(json.data);
    showToast('Live multi-carrier commercial rates calculated!');
  } catch (err) {
    alert(`Carrier Rating Error: ${err.message}`);
  } finally {
    btn.textContent = '⚡ Calculate Live Multi-Carrier Rates';
    btn.disabled = false;
  }
});

function renderRateResults(quote) {
  const parcel = quote.parcel;
  if (parcel) {
    document.getElementById('resBoxName').textContent = parcel.presetName || 'Standard Package';
    document.getElementById('resBoxDims').textContent = `${parcel.lengthIn}" L × ${parcel.widthIn}" W × ${parcel.heightIn}" H`;
    document.getElementById('resBillableWeight').textContent = `${parcel.billableWeightLbs} lbs`;
  }

  // Discount banner
  const discountBanner = document.getElementById('discountBanner');
  if (quote.discount?.applied) {
    discountBanner.classList.remove('hidden');
    document.getElementById('discountBannerText').textContent =
      quote.discount.rule === 'threshold'
        ? `Free standard shipping unlocked! You saved ${formatCurrency(quote.discount.savings)}.`
        : `Promo code applied! You saved ${formatCurrency(quote.discount.savings)}.`;
  } else {
    discountBanner.classList.add('hidden');
  }

  const container = document.getElementById('carrierRatesContainer');
  const rates = quote.rates || [];
  currentCalculatedRates = rates;

  if (rates.length === 0) {
    container.innerHTML = '<div class="empty-state">No carrier rates available for this destination.</div>';
    document.getElementById('manualPurchaseActionCard')?.classList.add('hidden');
    return;
  }

  // Auto-select first rate
  selectCalculatedRate(0);

  container.innerHTML = rates
    .map((r, idx) => {
      const badgeHtml = r.badge
        ? `<span class="badge ${r.badge === 'Cheapest' ? 'badge-success' : r.badge === 'Fastest' ? 'badge-purple' : 'badge-info'}">${r.badge}</span>`
        : '';

      const discountHtml =
        r.discountAmount > 0
          ? `<span class="rate-orig-price">${formatCurrency(r.baseRate)}</span>
             <span class="rate-discount-tag">Saved -${formatCurrency(r.discountAmount)}</span>`
          : '';

      const isSelected = idx === 0;

      return `
        <div class="rate-card ${isSelected ? 'selected' : ''}" data-rate-index="${idx}" onclick="selectCalculatedRate(${idx})">
          <div class="rate-carrier-info">
            <div class="rate-carrier-header">
              <span class="rate-carrier-name">${r.carrier}</span>
              ${badgeHtml}
            </div>
            <div class="rate-carrier-service">${r.service}</div>
            <div class="rate-carrier-eta">Est. Delivery: ${r.estimatedDeliveryDate || '2-3 Business Days'} (${r.estimatedDays || 2} days)</div>
          </div>
          <div class="rate-price-info">
            <span class="rate-final-price">${formatCurrency(r.finalCustomerRate)}</span>
            ${discountHtml}
          </div>
        </div>
      `;
    })
    .join('');

  document.getElementById('manualPurchaseActionCard')?.classList.remove('hidden');
}

window.selectCalculatedRate = function (idx) {
  if (!currentCalculatedRates[idx]) return;
  selectedCalculatedRate = currentCalculatedRates[idx];

  // Update card visuals
  document.querySelectorAll('.rate-card').forEach((card, i) => {
    if (i === idx) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  const svcName = document.getElementById('selectedServiceName');
  const svcPrice = document.getElementById('selectedServicePrice');
  const billingNote = document.getElementById('purchasePlanBillingNote');

  if (svcName) svcName.textContent = `${selectedCalculatedRate.carrier} - ${selectedCalculatedRate.service}`;
  if (svcPrice) svcPrice.textContent = formatCurrency(selectedCalculatedRate.finalCustomerRate);

  // Update billing note based on active Clover plan
  if (billingNote) {
    const tier = currentSettings.planTier || 'growth';
    const count = currentSettings.shipmentsCountThisMonth || 0;
    if (tier === 'pay_as_you_go') {
      billingNote.textContent = 'Billed via Clover App Market metered rate ($0.49/label). No monthly subscription.';
    } else if (tier === 'growth') {
      if (count < 100) {
        billingNote.textContent = `Included in your monthly Growth Plan allowance (${count + 1} of 100 used). $0.00 metered fee.`;
      } else {
        billingNote.textContent = `Growth Plan post-limit overage rate ($0.15/label billed via Clover).`;
      }
    } else if (tier === 'enterprise') {
      if (count < 1000) {
        billingNote.textContent = `Included in your monthly Enterprise Plan allowance (${count + 1} of 1,000 used). $0.00 metered fee.`;
      } else {
        billingNote.textContent = `Enterprise Plan post-limit overage rate ($0.06/label billed via Clover).`;
      }
    }
  }

  document.getElementById('manualPurchaseActionCard')?.classList.remove('hidden');
};

// Purchase Standalone Shipping Label
document.getElementById('btnBuyManualLabel')?.addEventListener('click', async () => {
  if (!selectedCalculatedRate) {
    alert('Please calculate and select a carrier shipping rate first.');
    return;
  }

  const btn = document.getElementById('btnBuyManualLabel');
  btn.textContent = '⏳ Purchasing Carrier Label & Barcode...';
  btn.disabled = true;

  try {
    const destName = document.getElementById('destName').value.trim();
    const destCompany = document.getElementById('destCompany').value.trim();
    const destStreet = document.getElementById('destStreet').value.trim();
    const destStreet2 = document.getElementById('destStreet2').value.trim();
    const destCity = document.getElementById('destCity').value.trim();
    const destState = document.getElementById('destState').value.trim().toUpperCase();
    const destZip = document.getElementById('destZip').value.trim();
    const destPhone = document.getElementById('destPhone').value.trim();

    const lengthIn = parseFloat(document.getElementById('manualDimLength').value) || 10;
    const widthIn = parseFloat(document.getElementById('manualDimWidth').value) || 7;
    const heightIn = parseFloat(document.getElementById('manualDimHeight').value) || 5;
    const weightLbs = parseFloat(document.getElementById('calcWeightLbs').value) || 2.0;

    const presetSelect = document.getElementById('manualPackagePreset');
    const presetId = presetSelect.value;
    const presetName = presetSelect.options[presetSelect.selectedIndex]?.text || 'Standard Box';

    const referenceId = document.getElementById('manualReferenceId').value.trim() || undefined;
    const chkInsurance = document.getElementById('chkInsurance').checked;
    const declaredValue = parseFloat(document.getElementById('calcSubtotal').value) || 0;

    const payload = {
      toAddress: {
        name: destName,
        company: destCompany,
        street1: destStreet,
        street2: destStreet2,
        city: destCity,
        state: destState,
        zip: destZip,
        country: 'US',
        phone: destPhone,
        isResidential: true,
      },
      parcel: {
        presetId,
        presetName,
        lengthIn,
        widthIn,
        heightIn,
        weightLbs,
      },
      carrier: selectedCalculatedRate.carrier,
      service: selectedCalculatedRate.service,
      referenceId,
      insuranceRequested: chkInsurance,
      declaredValue,
    };

    const res = await fetch('/api/shipments/create-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    const shipment = json.data;
    showToast(`Shipping label purchased! Tracking #${shipment.trackingNumber}`);

    // Refresh dashboard stats and table
    await loadShipments();
    await loadSettings();

    // Open label preview modal
    if (shipment.id) {
      openLabelModal(shipment.id);
    }
  } catch (err) {
    alert(`Purchase Failed: ${err.message}`);
  } finally {
    btn.textContent = '🏷️ Buy & Print Shipping Label (4"×6")';
    btn.disabled = false;
  }
});

// Packaging Presets Tab
async function loadPresets() {
  const container = document.getElementById('presetsGrid');
  try {
    const res = await fetch('/api/settings/presets');
    const json = await res.json();
    if (!json.success) return;

    currentPresets = json.data;
    container.innerHTML = currentPresets
      .map(
        (p) => `
        <div class="preset-card">
          <div>
            <div class="preset-header">
              <span class="preset-title">${p.name}</span>
              <span class="badge badge-info">${p.type.toUpperCase()}</span>
            </div>
            <div class="preset-body">
              <div><strong>Dimensions:</strong> ${p.lengthIn}" × ${p.widthIn}" × ${p.heightIn}"</div>
              <div><strong>Tare Weight:</strong> ${p.tareWeightOz} oz</div>
              <div><strong>Max Weight:</strong> ${(p.maxWeightOz / 16).toFixed(1)} lbs (${p.maxWeightOz} oz)</div>
              <div><strong>Volume:</strong> ${(p.lengthIn * p.widthIn * p.heightIn).toFixed(0)} cu in</div>
            </div>
          </div>
          <div style="margin-top: 1rem; text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="deletePreset('${p.id}')">Delete</button>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load presets:', err);
  }
}

async function deletePreset(id) {
  if (!confirm('Are you sure you want to delete this packaging preset?')) return;
  await fetch(`/api/settings/presets/${id}`, { method: 'DELETE' });
  showToast('Packaging preset deleted');
  loadPresets();
}

document.getElementById('btnNewPreset')?.addEventListener('click', async () => {
  const name = prompt('Preset Name:', 'Wine Shipping Box');
  if (!name) return;
  const lengthIn = parseFloat(prompt('Length (inches):', '12')) || 12;
  const widthIn = parseFloat(prompt('Width (inches):', '8')) || 8;
  const heightIn = parseFloat(prompt('Height (inches):', '6')) || 6;
  const maxWeightLbs = parseFloat(prompt('Max Weight (lbs):', '25')) || 25;

  const newPreset = {
    name,
    type: 'box',
    lengthIn,
    widthIn,
    heightIn,
    maxWeightOz: maxWeightLbs * 16,
    tareWeightOz: 7.0,
  };

  await fetch('/api/settings/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPreset),
  });

  showToast('Custom packaging preset added!');
  loadPresets();
});

// Discounts & Promos Tab
async function loadPromos() {
  const container = document.getElementById('promosList');
  try {
    const res = await fetch('/api/settings/promos');
    const json = await res.json();
    if (!json.success) return;

    container.innerHTML = json.data
      .map(
        (p) => `
        <div class="promo-item">
          <div>
            <span class="promo-code-badge">${p.code}</span>
            <span style="margin-left: 0.5rem; font-size: 0.85rem; font-weight: 500;">
              ${p.discountType === 'percentage' ? `${p.discountValue}% off shipping` : p.discountType === 'fixed_amount' ? `$${p.discountValue.toFixed(2)} off shipping` : 'Free Shipping'}
            </span>
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
              Min Cart: $${p.minOrderAmount.toFixed(2)} | Used: ${p.usageCount} times
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="deletePromo('${p.id}')">Remove</button>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Failed to load promo codes:', err);
  }
}

async function deletePromo(id) {
  if (!confirm('Delete this promo code?')) return;
  await fetch(`/api/settings/promos/${id}`, { method: 'DELETE' });
  showToast('Promo code deleted');
  loadPromos();
}

document.getElementById('btnNewPromo')?.addEventListener('click', async () => {
  const code = prompt('Promo Code (e.g. VIPSHIP):');
  if (!code) return;
  const type = prompt('Type (free_shipping / percentage / fixed_amount):', 'percentage') || 'percentage';
  const val = parseFloat(prompt('Discount Value (% or $ amount):', '25')) || 25;
  const min = parseFloat(prompt('Minimum order subtotal ($):', '30')) || 0;

  const newPromo = {
    code,
    discountType: type,
    discountValue: val,
    minOrderAmount: min,
    active: true,
  };

  await fetch('/api/settings/promos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPromo),
  });

  showToast('Promo code created!');
  loadPromos();
});

// Threshold form
document.getElementById('thresholdForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const threshold = parseFloat(document.getElementById('freeShippingThreshold').value) || 100;
  const enabled = document.getElementById('enableFreeShippingThreshold').checked;

  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      freeShippingThreshold: threshold,
      enableFreeShippingThreshold: enabled,
    }),
  });

  showToast('Free shipping threshold settings saved!');
});

// Settings Tab
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (!json.success) return;

    currentSettings = json.data;

    // Badge
    const badge = document.getElementById('modeBadge');
    const modeText = document.getElementById('modeText');
    if (badge && modeText) {
      badge.className = 'mode-badge live';
      modeText.textContent = currentSettings.easyPostApiKey
        ? 'BYOA Custom Rates'
        : 'AutoShip Commercial Rates';
    }

    // Render Subscription Plan Quota
    renderPlanQuota(currentSettings);

    // Populate settings form
    document.getElementById('useMockCarrier').checked = !!currentSettings.useMockCarrier;
    document.getElementById('carrierUsps').checked = !!currentSettings.enabledCarriers?.USPS;
    document.getElementById('carrierUps').checked = !!currentSettings.enabledCarriers?.UPS;
    document.getElementById('carrierFedex').checked = !!currentSettings.enabledCarriers?.FedEx;

    const orig = currentSettings.originAddress || {};
    document.getElementById('originName').value = orig.company || orig.name || '';
    document.getElementById('originPhone').value = orig.phone || '';
    document.getElementById('originStreet').value = orig.street1 || '';
    document.getElementById('originCity').value = orig.city || '';
    document.getElementById('originState').value = orig.state || '';
    document.getElementById('originZip').value = orig.zip || '';

    document.getElementById('insuranceRate').value = currentSettings.insuranceRatePerHundred || 1.05;
    document.getElementById('guaranteeFee').value = currentSettings.deliveryGuaranteeFee || 2.99;

    document.getElementById('freeShippingThreshold').value = currentSettings.freeShippingThreshold || 100;
    document.getElementById('enableFreeShippingThreshold').checked = !!currentSettings.enableFreeShippingThreshold;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function renderPlanQuota(settings) {
  const tier = settings.planTier || 'growth';
  const planConfig = settings.planConfig || {
    name: tier === 'pay_as_you_go' ? 'Pay-As-You-Ship' : tier === 'enterprise' ? 'Enterprise Plan' : 'Growth Plan',
    monthlyPrice: tier === 'pay_as_you_go' ? 0 : tier === 'enterprise' ? 59.99 : 6.99,
    includedShipments: tier === 'pay_as_you_go' ? 0 : tier === 'enterprise' ? 1000 : 100,
    overageRate: tier === 'pay_as_you_go' ? 0.49 : tier === 'enterprise' ? 0.06 : 0.15,
  };

  const planBadge = document.getElementById('planBadge');
  const planSelect = document.getElementById('planTierSelect');
  const usageText = document.getElementById('quotaUsageText');
  const overageBadge = document.getElementById('quotaOverageBadge');
  const progressBar = document.getElementById('quotaProgressBar');

  if (planSelect) planSelect.value = tier;
  if (planBadge) {
    planBadge.textContent = `${planConfig.name} ($${planConfig.monthlyPrice.toFixed(2)}/mo)`;
    planBadge.style.background = tier === 'enterprise' ? 'rgba(56, 189, 248, 0.18)' : tier === 'growth' ? 'rgba(52, 211, 153, 0.18)' : 'rgba(96, 165, 250, 0.18)';
    planBadge.style.color = tier === 'enterprise' ? '#38bdf8' : tier === 'growth' ? '#34d399' : '#60a5fa';
    planBadge.style.border = tier === 'enterprise' ? '1px solid rgba(56, 189, 248, 0.4)' : tier === 'growth' ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(96, 165, 250, 0.4)';
  }

  const count = settings.shipmentsCountThisMonth !== undefined ? settings.shipmentsCountThisMonth : (allShipments ? allShipments.length : 0);
  const limit = planConfig.includedShipments;

  if (tier === 'pay_as_you_go') {
    if (usageText) usageText.textContent = `${count} shipment(s) processed this month ($0.49/label metered billing)`;
    if (progressBar) {
      progressBar.style.width = '100%';
      progressBar.style.background = 'linear-gradient(90deg, #0284c7, #38bdf8)';
    }
    if (overageBadge) {
      const spend = (count * 0.49).toFixed(2);
      overageBadge.textContent = `${count} metered labels ($${spend} billed via Clover)`;
      overageBadge.style.background = 'rgba(56, 189, 248, 0.15)';
      overageBadge.style.color = '#38bdf8';
      overageBadge.style.border = '1px solid rgba(56, 189, 248, 0.35)';
    }
  } else {
    const pct = Math.min(100, Math.round((count / limit) * 100));
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
      progressBar.style.background = count > limit ? '#ef4444' : 'linear-gradient(90deg, #0284c7, #38bdf8, #34d399)';
    }
    if (usageText) {
      usageText.textContent = `${count} of ${limit} included shipments used this billing cycle`;
    }
    if (overageBadge) {
      if (count <= limit) {
        overageBadge.textContent = `Within Monthly Allowance ($0.00 metered)`;
        overageBadge.style.background = 'rgba(52, 211, 153, 0.15)';
        overageBadge.style.color = '#34d399';
        overageBadge.style.border = '1px solid rgba(52, 211, 153, 0.35)';
      } else {
        const overageCount = count - limit;
        const overageCost = (overageCount * planConfig.overageRate).toFixed(2);
        overageBadge.textContent = `${overageCount} overage labels ($${overageCost} billed via Clover at $${planConfig.overageRate}/ea)`;
        overageBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        overageBadge.style.color = '#f87171';
        overageBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      }
    }
  }

  // Update feature icons
  const iconThreshold = document.getElementById('featIconThreshold');
  const iconMarkup = document.getElementById('featIconMarkup');
  const iconByoa = document.getElementById('featIconByoa');

  if (iconThreshold) iconThreshold.textContent = tier === 'pay_as_you_go' ? '🔒' : '✅';
  if (iconMarkup) iconMarkup.textContent = tier === 'pay_as_you_go' ? '🔒' : '✅';
  if (iconByoa) iconByoa.textContent = tier === 'enterprise' ? '✅' : '🔒';
}

document.getElementById('planTierSelect')?.addEventListener('change', async (e) => {
  const newTier = e.target.value;
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planTier: newTier }),
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Switched plan tier to ${newTier.replace(/_/g, ' ')}!`);
      await loadSettings();
    }
  } catch (err) {
    console.error('Failed to update plan tier:', err);
  }
});

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKeyVal = document.getElementById('easyPostApiKey').value.trim();
  const updates = {
    useMockCarrier: document.getElementById('useMockCarrier').checked,
    enabledCarriers: {
      USPS: document.getElementById('carrierUsps').checked,
      UPS: document.getElementById('carrierUps').checked,
      FedEx: document.getElementById('carrierFedex').checked,
    },
    originAddress: {
      name: document.getElementById('originName').value,
      company: document.getElementById('originName').value,
      phone: document.getElementById('originPhone').value,
      street1: document.getElementById('originStreet').value,
      city: document.getElementById('originCity').value,
      state: document.getElementById('originState').value,
      zip: document.getElementById('originZip').value,
      country: 'US',
    },
    insuranceRatePerHundred: parseFloat(document.getElementById('insuranceRate').value) || 1.05,
    deliveryGuaranteeFee: parseFloat(document.getElementById('guaranteeFee').value) || 2.99,
  };

  if (apiKeyVal) {
    updates.easyPostApiKey = apiKeyVal;
  }

  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const json = await res.json();
  if (json.success) {
    showToast('Carrier settings saved successfully!');
    loadSettings();
  }
});

// Demo Walkthrough Fulfillment
document.getElementById('btnQuickSimulate')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnQuickSimulate');
  btn.textContent = '⏳ Processing Sample Order...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/webhooks/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: `CLOVER_${Math.floor(10000 + Math.random() * 90000)}`,
        carrier: 'USPS',
        service: 'USPS Priority Mail',
      }),
    });

    const json = await res.json();
    if (json.success) {
      showToast('Sample order fulfilled! 4"×6" shipping label and tracking generated.');
      await loadShipments();
      await loadSettings();
      // Automatically open the generated label
      if (json.shipment?.id) {
        openLabelModal(json.shipment.id);
      }
    } else {
      showToast(`Demo order error: ${json.error || 'Failed to simulate sample order'}`);
      alert(`Demo Order Walkthrough Error: ${json.error || 'Failed to simulate sample order'}`);
    }
  } catch (err) {
    alert(`Error running demo order: ${err.message}`);
  } finally {
    btn.textContent = '⚡ Demo Order Walkthrough';
    btn.disabled = false;
  }
});

// Label Modal
window.openLabelModal = async function (shipmentId) {
  try {
    const res = await fetch(`/api/shipments/${shipmentId}`);
    const json = await res.json();
    if (!json.success) return;

    activeModalShipment = json.data;
    const container = document.getElementById('labelPreviewContainer');
    container.innerHTML = activeModalShipment.labelData || '<div class="empty-state">No label preview available</div>';

    document.getElementById('labelModal').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to open label:', err);
  }
};

document.getElementById('btnCloseLabelModal')?.addEventListener('click', () => {
  document.getElementById('labelModal').classList.add('hidden');
});
document.getElementById('btnCloseModalBtn')?.addEventListener('click', () => {
  document.getElementById('labelModal').classList.add('hidden');
});

document.getElementById('btnPrintModalLabel')?.addEventListener('click', () => {
  if (activeModalShipment) {
    const printWindow = window.open(`/api/shipments/${activeModalShipment.id}/label?view=print`, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  }
});

// Tracking Modal
window.openTrackingModal = async function (shipmentId) {
  try {
    const res = await fetch(`/api/shipments/${shipmentId}`);
    const json = await res.json();
    if (!json.success) return;

    activeModalShipment = json.data;
    const s = activeModalShipment;

    document.getElementById('trackingInfoSummary').innerHTML = `
      <div style="margin-bottom: 1rem;">
        <h4>${s.carrier} Tracking: <span style="font-family: monospace;">${s.trackingNumber}</span></h4>
        <p style="font-size: 0.85rem; color: #64748b;">Order #${s.orderId} to ${s.toAddress.city}, ${s.toAddress.state}</p>
      </div>
    `;

    renderTimeline(s.trackingTimeline || []);
    document.getElementById('trackingModal').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to open tracking:', err);
  }
};

function renderTimeline(events) {
  const container = document.getElementById('trackingTimelineContainer');
  container.innerHTML = events
    .map(
      (ev) => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-time">${new Date(ev.timestamp).toLocaleString()} - ${ev.location}</div>
        <div class="timeline-status">${ev.status.replace(/_/g, ' ').toUpperCase()}</div>
        <div class="timeline-details">${ev.statusDetails}</div>
      </div>
    `
    )
    .join('');
}

document.getElementById('btnAdvanceTracking')?.addEventListener('click', async () => {
  if (!activeModalShipment) return;

  const nextStatusMap = {
    label_created: 'in_transit',
    in_transit: 'out_for_delivery',
    out_for_delivery: 'delivered',
  };

  const next = nextStatusMap[activeModalShipment.status] || 'delivered';

  const res = await fetch(`/api/shipments/${activeModalShipment.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: next,
      statusDetails:
        next === 'in_transit'
          ? 'Departed carrier sorting facility'
          : next === 'out_for_delivery'
          ? 'Out for delivery on local courier vehicle'
          : 'Package safely delivered at front porch / customer reception',
    }),
  });

  const json = await res.json();
  if (json.success) {
    activeModalShipment = json.data;
    renderTimeline(activeModalShipment.trackingTimeline);
    loadShipments();
    showToast(`Tracking updated: ${next.replace(/_/g, ' ').toUpperCase()}`);
  }
});

document.getElementById('btnCloseTrackingModal')?.addEventListener('click', () => {
  document.getElementById('trackingModal').classList.add('hidden');
});
document.getElementById('btnCloseTrackingBtn')?.addEventListener('click', () => {
  document.getElementById('trackingModal').classList.add('hidden');
});

// Create Label & Hero button shortcuts & Search
document.getElementById('btnOpenCreateLabel')?.addEventListener('click', () => {
  const calcBtn = document.querySelector('.tab-btn[data-tab="calculator"]');
  if (calcBtn) {
    calcBtn.click();
    document.getElementById('tab-calculator')?.scrollIntoView({ behavior: 'smooth' });
  }
});

document.getElementById('btnHeroCalculate')?.addEventListener('click', () => {
  const calcBtn = document.querySelector('.tab-btn[data-tab="calculator"]');
  if (calcBtn) {
    calcBtn.click();
    document.getElementById('tab-calculator')?.scrollIntoView({ behavior: 'smooth' });
  }
});

document.getElementById('btnHeaderDemo')?.addEventListener('click', () => {
  document.getElementById('btnQuickSimulate')?.click();
});

document.getElementById('btnRefreshShipments')?.addEventListener('click', () => {
  loadShipments();
  showToast('Shipments list refreshed');
});

document.getElementById('shipmentSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) {
    renderShipmentsTable(currentShipments);
    return;
  }
  const filtered = currentShipments.filter((s) => {
    return (
      s.orderId?.toLowerCase().includes(q) ||
      s.trackingNumber?.toLowerCase().includes(q) ||
      s.toAddress?.name?.toLowerCase().includes(q) ||
      s.carrier?.toLowerCase().includes(q) ||
      s.service?.toLowerCase().includes(q)
    );
  });
  renderShipmentsTable(filtered);
});

// Clover App Market Subscription Sync
document.getElementById('btnSyncSubscription')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSyncSubscription');
  btn.textContent = '⏳ Syncing...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/settings/sync-subscription', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`Clover subscription synced: ${json.data.tierName}`);
      await loadSettings();
    } else {
      showToast(`Subscription sync: ${json.error || 'Plan is current'}`);
    }
  } catch (err) {
    showToast(`Sync error: ${err.message}`);
  } finally {
    btn.textContent = '🔄 Sync Subscription';
    btn.disabled = false;
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadBoxesAndCatalog();
  loadShipments();
  loadSettings();
});
