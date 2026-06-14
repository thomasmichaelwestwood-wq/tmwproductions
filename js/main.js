/* =============================================
   TMW PRODUCTIONS — Main JavaScript
   Handles: nav scroll, hamburger menu, scroll
   animations, particles, gallery filters, FAQ
============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // ================================
  // NAV — scroll effect + topbar
  // ================================
  const nav = document.getElementById('nav');
  const topbar = document.getElementById('topbar');
  if (nav) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 60;
      nav.classList.toggle('scrolled', scrolled);
      if (topbar) {
        topbar.classList.toggle('hidden', scrolled);
        nav.style.top = scrolled ? '0' : '';
      }
    }, { passive: true });
  }

  // ================================
  // NAV — hamburger menu
  // ================================
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Mobile dropdown: tap the parent "About" link to expand sub-items
    navLinks.querySelectorAll('.nav__has-dropdown > a').forEach(parentLink => {
      parentLink.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          const li = parentLink.closest('.nav__has-dropdown');
          li.classList.toggle('open');
        }
      });
    });

    // Close menu on link click (skip dropdown parent links — handled above)
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        // Don't close if this is a mobile dropdown parent toggle
        if (window.innerWidth <= 768 && link.closest('.nav__has-dropdown') === link.parentElement) return;
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
        // Reset any open dropdowns
        navLinks.querySelectorAll('.nav__has-dropdown').forEach(d => d.classList.remove('open'));
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // ================================
  // SCROLL ANIMATIONS — Intersection Observer
  // ================================
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealEls.forEach(el => observer.observe(el));
  }

  // ================================
  // HERO PARTICLES
  // ================================
  const particleContainer = document.getElementById('particles');
  if (particleContainer) {
    const count = 25;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      const size = Math.random() * 6 + 2;
      p.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${Math.random() * 100}%;
        animation-duration: ${Math.random() * 12 + 8}s;
        animation-delay: ${Math.random() * 10}s;
        filter: blur(${Math.random() * 2}px);
      `;
      particleContainer.appendChild(p);
    }
  }

  // ================================
  // GALLERY FILTERS
  // ================================
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  if (filterBtns.length && galleryItems.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;

        galleryItems.forEach(item => {
          const category = item.dataset.category;
          const show = filter === 'all' || category === filter;
          item.style.opacity = show ? '1' : '0.2';
          item.style.pointerEvents = show ? 'all' : 'none';
        });
      });
    });
  }

  // ================================
  // FAQ ACCORDION
  // ================================
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-item__question');
    if (question) {
      question.setAttribute('aria-expanded', 'false');
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close all
        faqItems.forEach(f => {
          f.classList.remove('open');
          const q = f.querySelector('.faq-item__question');
          if (q) q.setAttribute('aria-expanded', 'false');
        });
        // Open clicked if it was closed
        if (!isOpen) {
          item.classList.add('open');
          question.setAttribute('aria-expanded', 'true');
        }
      });
    }
  });

  // ================================
  // CONTACT FORM — basic handling
  // ================================
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('.form-submit');
      btn.textContent = 'Sent! I\'ll be in touch soon.';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      // In production: replace this with a real form handler / email service
    });
  }

  // ================================
  // HERO — parallax on scroll
  // ================================
  const heroImage   = document.querySelector('.hero__image');
  const allowMotion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  if (heroImage && allowMotion) {
    let heroRaf;
    function updateHeroParallax() {
      heroImage.style.transform = `translateY(${window.scrollY * 0.28}px)`;
      heroRaf = null;
    }
    window.addEventListener('scroll', () => {
      if (!heroRaf) heroRaf = requestAnimationFrame(updateHeroParallax);
    }, { passive: true });
  }

  // ================================
  // PROCESS SECTION — line fill, parallax, active step
  // ================================
  const processTimeline = document.querySelector('.process__timeline');
  const processLineFill = document.getElementById('processLineFill');
  const processSteps    = document.querySelectorAll('.process__step');
  const processNums     = document.querySelectorAll('.process__num');
  const processSection  = document.querySelector('.process');
  const processGlow     = document.querySelector('.process__glow');
  const processDecos    = document.querySelectorAll('.process__deco');

  if (processTimeline && processLineFill && processSteps.length) {

    function updateProcess() {
      const tlRect     = processTimeline.getBoundingClientRect();
      const tlHeight   = processTimeline.offsetHeight;
      const winH       = window.innerHeight;

      // ── Line fill progress ──────────────────────────────
      const progress = Math.max(0, Math.min(1,
        (winH - tlRect.top) / (tlHeight + winH)
      ));
      processLineFill.style.height = (progress * 100) + '%';

      // ── Active step (closest to viewport centre) ────────
      const viewCentre = winH / 2;
      let closestStep = null;
      let closestDist = Infinity;

      processSteps.forEach(step => {
        const r    = step.getBoundingClientRect();
        const mid  = r.top + r.height / 2;
        const dist = Math.abs(mid - viewCentre);
        if (dist < closestDist) {
          closestDist = dist;
          closestStep = step;
        }
        step.classList.remove('is-active');
      });

      if (closestStep) closestStep.classList.add('is-active');

      if (!allowMotion) return;

      // ── Parallax on step numbers (deeper depth = more movement) ──
      processNums.forEach(num => {
        const step   = num.closest('.process__step');
        if (!step) return;
        const r      = step.getBoundingClientRect();
        const offset = (viewCentre - (r.top + r.height / 2)) * 0.22;
        num.style.transform = `translateY(${offset}px)`;
      });

      // ── Section-level parallax (glow + decorative rings) ──
      if (processSection) {
        const sRect = processSection.getBoundingClientRect();
        const sOff  = viewCentre - (sRect.top + sRect.height / 2);

        if (processGlow) {
          processGlow.style.transform = `translate(-50%, calc(-50% + ${sOff * 0.08}px))`;
        }

        // Three rings at distinct depths, rings also rotate subtly
        if (processDecos[0]) processDecos[0].style.transform = `translateY(${sOff * 0.06}px) rotate(${sOff * 0.009}deg)`;
        if (processDecos[1]) processDecos[1].style.transform = `translateY(${sOff * 0.16}px) rotate(${sOff * -0.013}deg)`;
        if (processDecos[2]) processDecos[2].style.transform = `translateY(${sOff * 0.26}px)`;
      }
    }

    window.addEventListener('scroll', updateProcess, { passive: true });
    updateProcess(); // run once on load
  }

  // ================================
  // SMOOTH ANCHOR SCROLL
  // ================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ================================
  // REVIEW RATING BARS — animate on scroll
  // ================================
  const bars = document.querySelectorAll('.platform-row__fill');
  if (bars.length) {
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Bars are already set to 100% width via inline style
          // Just trigger the CSS transition by briefly setting to 0
          const el = entry.target;
          const finalWidth = el.style.width;
          el.style.width = '0';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.width = finalWidth;
            });
          });
          barObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    bars.forEach(bar => barObserver.observe(bar));
  }

  // AVAILABILITY BARS — animate on scroll
  // ================================
  const availFills = document.querySelectorAll('.avail__fill');
  if (availFills.length) {
    const availObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          availObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    availFills.forEach(el => availObserver.observe(el));
  }

});
