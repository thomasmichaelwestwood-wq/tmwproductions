// ============================================================
// TMW Productions — Live Availability Checker
// Paste your Google Apps Script Web App URL below
// ============================================================

const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

// ============================================================
// TRUSTED SUPPLIERS
// Add Tom's recommended DJs here when ready:
// {
//   name: 'DJ Name',
//   url:  'https://their-website.co.uk',   // optional
//   note: 'Short description'              // optional
// }
// ============================================================

const TMW_SUPPLIERS = [
  // Coming soon — Tom's trusted suppliers will appear here
];

// ============================================================

(function () {
  const daySelect   = document.querySelector('select[name="day"]');
  const monthSelect = document.querySelector('select[name="month"]');
  const yearSelect  = document.querySelector('select[name="year"]');

  if (!daySelect || !monthSelect || !yearSelect) return;

  // Insert the availability indicator after the date row
  const dateRow = daySelect.closest('.form-row') || daySelect.closest('.form-group');
  const indicator = document.createElement('div');
  indicator.id = 'avail-indicator';
  indicator.style.display = 'none';
  dateRow.insertAdjacentElement('afterend', indicator);

  // ── Helpers ──────────────────────────────────────────────

  function getSelectedDate() {
    const d = daySelect.value;
    const m = monthSelect.value;
    const y = yearSelect.value;
    if (d === '-43' || m === '-43' || y === '-43') return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  // ── Render states ─────────────────────────────────────────

  function showChecking() {
    indicator.style.display = 'block';
    indicator.className = 'avail avail--checking';
    indicator.innerHTML = `<span class="avail__spinner"></span> Checking availability…`;
  }

  function showAvailable(dateStr) {
    indicator.style.display = 'block';
    indicator.className = 'avail avail--yes';
    indicator.innerHTML = `
      <span class="avail__icon">✓</span>
      <div>
        <strong>Tom is available on ${formatDate(dateStr)}!</strong>
        <p>Fill in the rest of the form and he'll be in touch to confirm.</p>
      </div>
    `;
  }

  function showUnavailable(dateStr) {
    indicator.style.display = 'block';
    indicator.className = 'avail avail--no';

    let suppliersHtml = '';

    if (TMW_SUPPLIERS.length > 0) {
      suppliersHtml = `
        <div class="avail__suppliers">
          <p class="avail__suppliers-intro">Tom personally recommends these trusted DJs who may be able to help:</p>
          <ul class="avail__suppliers-list">
            ${TMW_SUPPLIERS.map(s => `
              <li>
                <div class="supplier__name">${s.name}</div>
                ${s.note ? `<div class="supplier__note">${s.note}</div>` : ''}
                ${s.url  ? `<a href="${s.url}" target="_blank" rel="noopener" class="supplier__link">Visit website →</a>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      suppliersHtml = `
        <p class="avail__suppliers-intro">
          Get in touch anyway — Tom keeps a list of trusted DJs and will point you in the right direction.
        </p>
      `;
    }

    indicator.innerHTML = `
      <span class="avail__icon avail__icon--no">✕</span>
      <div>
        <strong>Sorry — Tom is already booked on ${formatDate(dateStr)}.</strong>
        ${suppliersHtml}
      </div>
    `;
  }

  function hideIndicator() {
    indicator.style.display = 'none';
    indicator.className = '';
    indicator.innerHTML = '';
  }

  // ── Calendar check ────────────────────────────────────────

  let debounce;

  function checkAvailability() {
    const date = getSelectedDate();
    if (!date) { hideIndicator(); return; }

    clearTimeout(debounce);
    showChecking();

    // If the URL hasn't been set yet, silently skip
    if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
      hideIndicator();
      return;
    }

    debounce = setTimeout(() => {
      fetch(`${APPS_SCRIPT_URL}?date=${date}`)
        .then(r => r.json())
        .then(data => {
          if (data.available === true)  showAvailable(date);
          else if (data.available === false) showUnavailable(date);
          else hideIndicator();
        })
        .catch(() => hideIndicator());
    }, 400);
  }

  [daySelect, monthSelect, yearSelect].forEach(sel => {
    sel.addEventListener('change', checkAvailability);
  });

})();
