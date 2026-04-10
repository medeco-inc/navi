/**
 * navigation.js — ナビゲーション・スムーズスクロール・ヘッダー制御
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────
     ヘッダー：スクロール時の縮小
  ────────────────────────────────────────────────────────────── */
  function initHeaderScroll() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let lastScrollY = 0;
    let ticking = false;

    function updateHeader() {
      if (window.scrollY > 20) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      lastScrollY = window.scrollY;
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ────────────────────────────────────────────────────────────
     モバイルメニュー
  ────────────────────────────────────────────────────────────── */
  function initMobileMenu() {
    const openBtn  = document.querySelector('.mobile-menu-btn');
    const closeBtn = document.querySelector('.mobile-menu-close');
    const menu     = document.querySelector('.mobile-menu');

    if (!openBtn || !menu) return;

    function openMenu() {
      menu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      openBtn.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      // フォーカスをメニュー先頭に
      const firstLink = menu.querySelector('a, button');
      if (firstLink) firstLink.focus();
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
      openBtn.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      openBtn.focus();
    }

    openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // ESC キーで閉じる
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        closeMenu();
      }
    });

    // メニュー外クリックで閉じる
    menu.addEventListener('click', function (e) {
      if (e.target === menu) closeMenu();
    });

    // メニュー内リンクをクリックしたら閉じる
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }

  /* ────────────────────────────────────────────────────────────
     スムーズスクロール（アンカーリンク）
  ────────────────────────────────────────────────────────────── */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;

      const targetId = link.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const header = document.querySelector('.site-header');
      const headerH = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;

      window.scrollTo({ top, behavior: 'smooth' });

      // URLにハッシュをセット（履歴は変えない）
      history.replaceState(null, '', targetId);

      // フォーカスを移動
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ────────────────────────────────────────────────────────────
     アクティブなナビリンクの設定
  ────────────────────────────────────────────────────────────── */
  function initActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.header-nav-item, .mobile-nav-item');

    navLinks.forEach(function (link) {
      const href = link.getAttribute('href');
      if (!href) return;

      // ルートの場合はindex.htmlを特別扱い
      const isRoot = (currentPath === '/' || currentPath.endsWith('index.html')) && (href === '/' || href === './index.html' || href === '../index.html');
      const isMatch = href !== '/' && href !== './index.html' && currentPath.includes(href.replace(/\/index\.html$/, '').replace(/^\.\//, '').replace(/^\.\.\//, ''));

      if (isRoot || isMatch) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ────────────────────────────────────────────────────────────
     FAQ アコーディオン
  ────────────────────────────────────────────────────────────── */
  function initFaqAccordion() {
    document.addEventListener('click', function (e) {
      const question = e.target.closest('.faq-question');
      if (!question) return;

      const item = question.closest('.faq-item');
      if (!item) return;

      const isOpen = item.classList.contains('is-open');

      // 他のFAQを閉じる（同一グループ内）
      const parent = item.parentElement;
      if (parent) {
        parent.querySelectorAll('.faq-item.is-open').forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove('is-open');
            openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
          }
        });
      }

      item.classList.toggle('is-open', !isOpen);
      question.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  /* ────────────────────────────────────────────────────────────
     スクロールトップボタン
  ────────────────────────────────────────────────────────────── */
  function initScrollTop() {
    const btn = document.getElementById('scroll-top-btn');
    if (!btn) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        btn.classList.add('is-visible');
      } else {
        btn.classList.remove('is-visible');
      }
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ────────────────────────────────────────────────────────────
     目次のハイライト（スクロール追従）
  ────────────────────────────────────────────────────────────── */
  function initTocHighlight() {
    const tocLinks = document.querySelectorAll('.toc-item a');
    if (!tocLinks.length) return;

    const sections = Array.from(tocLinks)
      .map(function (link) {
        const id = link.getAttribute('href').replace('#', '');
        return document.getElementById(id);
      })
      .filter(Boolean);

    if (!sections.length) return;

    const header = document.querySelector('.site-header');
    const headerH = header ? header.offsetHeight + 20 : 80;

    function updateToc() {
      let current = sections[0];
      sections.forEach(function (section) {
        if (section.getBoundingClientRect().top <= headerH) {
          current = section;
        }
      });

      tocLinks.forEach(function (link) {
        const id = link.getAttribute('href').replace('#', '');
        if (id === current.id) {
          link.closest('.toc-item').classList.add('is-active');
        } else {
          link.closest('.toc-item').classList.remove('is-active');
        }
      });
    }

    window.addEventListener('scroll', function () {
      requestAnimationFrame(updateToc);
    }, { passive: true });
  }

  /* ────────────────────────────────────────────────────────────
     パンくずナビの生成（任意）
  ────────────────────────────────────────────────────────────── */
  function initBreadcrumb() {
    // data属性からパンくずを自動生成する場合の拡張ポイント
  }

  /* ────────────────────────────────────────────────────────────
     フィルターチップ（一覧ページ共通）
  ────────────────────────────────────────────────────────────── */
  function initFilterChips() {
    document.querySelectorAll('.filter-chip-group').forEach(function (group) {
      const chips = group.querySelectorAll('.filter-chip');
      const isMulti = group.dataset.multiSelect === 'true';

      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          if (isMulti) {
            chip.classList.toggle('is-active');
          } else {
            chips.forEach(function (c) { c.classList.remove('is-active'); });
            chip.classList.add('is-active');
          }

          // カスタムイベントを発火（search.js がリッスン）
          group.dispatchEvent(new CustomEvent('filter-change', {
            bubbles: true,
            detail: {
              group: group.dataset.filterGroup,
              values: Array.from(chips)
                .filter(function (c) { return c.classList.contains('is-active'); })
                .map(function (c) { return c.dataset.value; })
            }
          }));
        });
      });
    });
  }

  /* ────────────────────────────────────────────────────────────
     インデックスナビ（五十音）
  ────────────────────────────────────────────────────────────── */
  function initIndexNav() {
    const navBtns = document.querySelectorAll('.index-nav-btn');
    if (!navBtns.length) return;

    navBtns.forEach(function (btn) {
      if (btn.disabled) return;

      btn.addEventListener('click', function () {
        navBtns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');

        document.dispatchEvent(new CustomEvent('index-filter-change', {
          detail: { value: btn.dataset.index }
        }));
      });
    });
  }

  /* ────────────────────────────────────────────────────────────
     初期化
  ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initMobileMenu();
    initSmoothScroll();
    initActiveNav();
    initFaqAccordion();
    initScrollTop();
    initTocHighlight();
    initBreadcrumb();
    initFilterChips();
    initIndexNav();
  });

})();
