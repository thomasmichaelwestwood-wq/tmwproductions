const TMW_VENUES = [
  {
    name: "Quorn Grange Hotel",
    location: "Quorn, Leicestershire",
    recommended: true,
    setup: "White",
    setupIcon: "✦",
    setupNote: "A white fairy light canopy and white dance floor work beautifully against Quorn Grange's elegant interiors."
  },
  {
    name: "Prestwold Hall",
    location: "Loughborough, Leicestershire",
    recommended: true,
    setup: "Custom",
    setupIcon: "✦",
    setupNote: "Prestwold Hall's grand setting calls for a bespoke setup — we'll design something unique to your colour scheme and vision."
  },
  {
    name: "The Hall Barns",
    location: "Leicestershire",
    recommended: true,
    setup: "Rustic",
    setupIcon: "✦",
    setupNote: "The Hall Barns' natural charm pairs perfectly with warm rustic lighting — Edison bulbs and amber tones to enhance the character of the space."
  },
  {
    name: "Beedles Lake",
    location: "Leicestershire",
    recommended: true,
    setup: "White",
    setupIcon: "✦",
    setupNote: "A white setup complements Beedles Lake's clean, modern event space perfectly."
  },
  {
    name: "Quorn Manor House",
    location: "Quorn, Leicestershire",
    recommended: true,
    setup: null,
    setupIcon: null,
    setupNote: null
  },
  {
    name: "Old Cow Shed",
    location: "Leicestershire",
    recommended: true,
    setup: "Rustic",
    setupIcon: "✦",
    setupNote: "The Old Cow Shed's characterful barn is made for a rustic setup — warm Edison lighting and natural tones to bring out the best of the space."
  }
];

(function () {
  const input = document.getElementById('venue');
  if (!input) return;

  // Wrap the input
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  // Dropdown
  const dropdown = document.createElement('ul');
  dropdown.id = 'venue-dropdown';
  dropdown.setAttribute('role', 'listbox');
  wrapper.appendChild(dropdown);

  // Recommendation card
  const card = document.createElement('div');
  card.id = 'venue-card';
  card.style.display = 'none';
  input.closest('.form-group').appendChild(card);

  function getSetupClass(setup) {
    if (!setup) return '';
    return 'venue-setup--' + setup.toLowerCase();
  }

  function showCard(venue) {
    if (!venue.setup) {
      card.style.display = 'none';
      return;
    }
    card.innerHTML = `
      <div class="venue-card__badge ${getSetupClass(venue.setup)}">${venue.setup} Setup Recommended</div>
      <p class="venue-card__note">${venue.setupNote}</p>
    `;
    card.style.display = 'block';
  }

  function hideCard() {
    card.style.display = 'none';
  }

  function renderDropdown(matches) {
    dropdown.innerHTML = '';
    if (!matches.length) {
      dropdown.style.display = 'none';
      return;
    }
    matches.forEach(venue => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <span class="venue-name">${venue.name}${venue.recommended ? ' <span class="venue-star" title="Recommended venue">★</span>' : ''}</span>
        <span class="venue-location">${venue.location}</span>
      `;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = venue.name;
        dropdown.style.display = 'none';
        showCard(venue);
      });
      dropdown.appendChild(li);
    });
    dropdown.style.display = 'block';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    hideCard();
    if (!q) {
      dropdown.style.display = 'none';
      return;
    }
    const matches = TMW_VENUES.filter(v => v.name.toLowerCase().includes(q));
    renderDropdown(matches);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.style.display = 'none'; }, 150);
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim().toLowerCase();
    if (q) {
      const matches = TMW_VENUES.filter(v => v.name.toLowerCase().includes(q));
      renderDropdown(matches);
    }
  });
})();
