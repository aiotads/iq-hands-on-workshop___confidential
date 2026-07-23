/* =========================================================
   Hands-On Workshop — shared client behavior
   - bilingual toggle (zh / en) persisted in localStorage
   - tab switcher (Windows / Ubuntu) persisted per-page
   - checklist persistence (per step id)
   - copy-to-clipboard for code blocks
   - search overlay (Cmd/Ctrl+K) over a static index
   ========================================================= */

(function () {
  'use strict';

  const LS = {
    LANG: 'how_lang',
    TAB: 'how_tab',           // global default OS tab
    CHECK: 'how_check_v1',    // map of stepId -> true
    THEME: 'how_theme',       // 'light' | 'dark'
  };

  // ---------- THEME ----------
  function getTheme() {
    return localStorage.getItem(LS.THEME) || 'dark';
  }
  function setTheme(theme) {
    localStorage.setItem(LS.THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
  function initTheme() {
    setTheme(getTheme());
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    });
  }

  // ---------- LANG ----------
  function getLang() {
    return localStorage.getItem(LS.LANG) || 'zh';
  }
  function setLang(lang) {
    localStorage.setItem(LS.LANG, lang);
    document.documentElement.setAttribute('data-lang', lang);
    document.querySelectorAll('.lang-toggle button').forEach(b => {
      b.classList.toggle('on', b.dataset.lang === lang);
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  }
  function initLang() {
    setLang(getLang());
    document.querySelectorAll('.lang-toggle button').forEach(b => {
      b.addEventListener('click', () => setLang(b.dataset.lang));
    });
  }

  // ---------- TABS (Windows / Ubuntu) ----------
  function getTab() {
    return localStorage.getItem(LS.TAB) || 'windows';
  }
  function setTab(tab) {
    localStorage.setItem(LS.TAB, tab);
    document.querySelectorAll('[data-tabs]').forEach(group => {
      group.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('on', t.dataset.tab === tab);
      });
      group.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('on', p.dataset.tab === tab);
      });
    });
    // Re-count progress: a different OS tab may expose a different step set.
    if (typeof updateProgress === 'function') updateProgress();
  }
  function initTabs() {
    setTab(getTab());
    document.querySelectorAll('[data-tabs] .tab').forEach(t => {
      t.addEventListener('click', () => setTab(t.dataset.tab));
    });
  }

  // ---------- CHECKLIST ----------
  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(LS.CHECK) || '{}'); }
    catch (_) { return {}; }
  }
  function saveChecks(map) {
    localStorage.setItem(LS.CHECK, JSON.stringify(map));
  }
  function initCheckboxes() {
    const map = loadChecks();
    document.querySelectorAll('.step-checkbox').forEach(box => {
      const id = box.dataset.checkId;
      if (!id) return;
      if (map[id]) box.classList.add('done');
      box.addEventListener('click', () => {
        const next = !box.classList.contains('done');
        box.classList.toggle('done', next);
        const m = loadChecks();
        if (next) m[id] = true; else delete m[id];
        saveChecks(m);
        updateProgress();
      });
    });
    updateProgress();
  }
  function updateProgress() {
    // Only count checkboxes that are currently visible (e.g. in the active OS tab).
    const all = [...document.querySelectorAll('.step-checkbox')].filter(b => b.offsetParent !== null);
    if (!all.length) return;
    const m = loadChecks();
    let done = 0;
    all.forEach(b => { if (m[b.dataset.checkId]) done += 1; });
    const pct = Math.round((done / all.length) * 100);
    document.querySelectorAll('[data-progress-fill]').forEach(el => {
      el.style.width = pct + '%';
    });
    document.querySelectorAll('[data-progress-text]').forEach(el => {
      el.textContent = done + ' / ' + all.length;
    });
    document.querySelectorAll('[data-progress-pct]').forEach(el => {
      el.textContent = pct + '%';
    });
  }

  // ---------- COPY ----------
  function initCopy() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const codeEl = btn.closest('.code').querySelector('pre');
        if (!codeEl) return;
        const text = codeEl.innerText;
        try {
          await navigator.clipboard.writeText(text);
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        }
        btn.classList.add('copied');
        const label = btn.querySelector('.copy-label');
        const original = label ? label.textContent : '';
        if (label) label.textContent = '已複製 / Copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          if (label) label.textContent = original;
        }, 1400);
      });
    });
  }

  // ---------- SEARCH ----------
  // Index is provided globally via window.SEARCH_INDEX (see search-index.js).
  function initSearch() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    const list = document.getElementById('search-results');
    if (!overlay || !input || !list) return;

    const open = () => {
      overlay.classList.add('on');
      setTimeout(() => input.focus(), 30);
      render('');
    };
    const close = () => {
      overlay.classList.remove('on');
      input.value = '';
    };

    document.querySelectorAll('[data-open-search]').forEach(b => {
      b.addEventListener('click', open);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        overlay.classList.contains('on') ? close() : open();
      }
      if (e.key === 'Escape' && overlay.classList.contains('on')) close();
      if (overlay.classList.contains('on') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        moveSelection(e.key === 'ArrowDown' ? 1 : -1);
      }
      if (overlay.classList.contains('on') && e.key === 'Enter') {
        const sel = list.querySelector('.search-result.on');
        if (sel) { window.location.href = sel.dataset.href; }
      }
    });

    input.addEventListener('input', () => render(input.value.trim()));

    function moveSelection(dir) {
      const items = [...list.querySelectorAll('.search-result')];
      if (!items.length) return;
      let idx = items.findIndex(i => i.classList.contains('on'));
      idx = (idx + dir + items.length) % items.length;
      items.forEach(i => i.classList.remove('on'));
      items[idx].classList.add('on');
      items[idx].scrollIntoView({ block: 'nearest' });
    }

    function highlight(text, q) {
      if (!q) return text;
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return text.replace(re, '<mark>$1</mark>');
    }

    function render(q) {
      const items = (window.SEARCH_INDEX || []);
      const lang = getLang();
      const ql = q.toLowerCase();
      const hits = !q
        ? items.slice(0, 8)
        : items.filter(it => {
            const blob = [
              it.title, it.titleEn || '',
              it.body || '', it.bodyEn || '',
              it.page,
              ...(it.tags || []),
            ].join(' ').toLowerCase();
            return blob.includes(ql);
          }).slice(0, 12);

      if (!hits.length) {
        list.innerHTML = '<div class="search-empty">'
          + (lang === 'zh' ? '找不到「' + q + '」' : 'No results for "' + q + '"')
          + '</div>';
        return;
      }

      list.innerHTML = hits.map((h, i) => {
        const title = lang === 'en' && h.titleEn ? h.titleEn : h.title;
        const body = lang === 'en' && h.bodyEn ? h.bodyEn : (h.body || '');
        return '<a class="search-result' + (i === 0 ? ' on' : '') + '" '
          + 'data-href="' + h.href + '" href="' + h.href + '">'
          + '<div class="r-page">' + (h.pageLabel || h.page) + '</div>'
          + '<div class="r-title">' + highlight(title, q) + '</div>'
          + (body ? '<div class="r-body">' + highlight(body, q) + '</div>' : '')
          + '</a>';
      }).join('');
    }
  }

  // ---------- FAQ ----------
  function initFaq() {
    document.querySelectorAll('.faq-item').forEach(item => {
      const sum = item.querySelector('.faq-summary');
      if (!sum) return;
      sum.addEventListener('click', () => {
        const wasOpen = item.classList.contains('open');
        if (!sum.closest('.faq-list').dataset.multi) {
          item.parentElement.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'));
        }
        item.classList.toggle('open', !wasOpen);
      });
    });
  }

  // ---------- IMAGE LIGHTBOX ----------
  function initLightbox() {
    const overlay = document.getElementById('img-lightbox');
    const img = document.getElementById('img-lightbox-img');
    if (!overlay || !img) return;

    const open = (src, alt) => {
      img.src = src;
      img.alt = alt || '';
      overlay.classList.add('on');
    };
    const close = () => {
      overlay.classList.remove('on');
      img.src = '';
    };

    document.querySelectorAll('[data-lightbox-src]').forEach(el => {
      el.addEventListener('click', () => {
        open(el.getAttribute('data-lightbox-src'), el.getAttribute('data-lightbox-alt') || '');
      });
    });
    overlay.querySelectorAll('[data-lightbox-close]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('on')) close();
    });
  }

  // ---------- GENERIC MODAL ----------
  function initModals() {
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      const overlay = document.getElementById(btn.getAttribute('data-open-modal'));
      if (!overlay) return;
      btn.addEventListener('click', () => overlay.classList.add('on'));
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.querySelectorAll('[data-modal-close]').forEach(b => {
        b.addEventListener('click', () => overlay.classList.remove('on'));
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('on'); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.on').forEach(o => o.classList.remove('on'));
      }
    });
  }

  // ---------- BOOT ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLang();
    initTabs();
    initCheckboxes();
    initCopy();
    initSearch();
    initFaq();
    initLightbox();
    initModals();
  });
})();
