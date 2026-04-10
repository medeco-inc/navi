/**
 * accessibility.js — アクセシビリティ補助
 * WCAG 2.1 AA 準拠のサポート機能
 */

(function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────
     フォーカストラップ（モーダル・オーバーレイ用）
  ────────────────────────────────────────────────────────────── */
  function trapFocus(element) {
    const focusable = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return function () {};

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    function handler(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    element.addEventListener('keydown', handler);
    return function () {
      element.removeEventListener('keydown', handler);
    };
  }

  /* ────────────────────────────────────────────────────────────
     検索オーバーレイのフォーカストラップ適用
  ────────────────────────────────────────────────────────────── */
  function initOverlayTrap() {
    const overlay = document.getElementById('search-overlay');
    if (!overlay) return;

    let removeTrap = null;

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (overlay.classList.contains('is-open')) {
            const inner = overlay.querySelector('.search-overlay-inner');
            if (inner) {
              removeTrap = trapFocus(inner);
            }
          } else {
            if (removeTrap) {
              removeTrap();
              removeTrap = null;
            }
          }
        }
      });
    });

    observer.observe(overlay, { attributes: true });
  }

  /* ────────────────────────────────────────────────────────────
     モバイルメニューのフォーカストラップ適用
  ────────────────────────────────────────────────────────────── */
  function initMobileMenuTrap() {
    const menu = document.querySelector('.mobile-menu');
    if (!menu) return;

    let removeTrap = null;

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          if (menu.classList.contains('is-open')) {
            removeTrap = trapFocus(menu);
          } else {
            if (removeTrap) {
              removeTrap();
              removeTrap = null;
            }
          }
        }
      });
    });

    observer.observe(menu, { attributes: true });
  }

  /* ────────────────────────────────────────────────────────────
     ARIAライブリージョン（動的コンテンツの通知）
  ────────────────────────────────────────────────────────────── */
  let liveRegion = null;

  function announceToScreenReader(message, politeness) {
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
      liveRegion.setAttribute('aria-live', politeness || 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // テキストをクリアしてから再設定（再読み上げのため）
    liveRegion.textContent = '';
    setTimeout(function () {
      liveRegion.textContent = message;
    }, 50);
  }

  // 検索結果件数の通知
  function initSearchResultAnnounce() {
    const observer = new MutationObserver(function () {
      const countEl = document.getElementById('disease-count') ||
                      document.getElementById('symptom-count') ||
                      document.getElementById('treatment-count');
      if (countEl) {
        const count = countEl.textContent;
        if (count) {
          announceToScreenReader(count + 'の結果が表示されています');
        }
      }
    });

    ['disease-list', 'symptom-list', 'treatment-list'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true });
    });
  }

  /* ────────────────────────────────────────────────────────────
     キーボード操作補助
  ────────────────────────────────────────────────────────────── */
  function initKeyboardHints() {
    // マウス使用時はフォーカスリングを非表示（CSS :focus-visible で制御済みだが補完）
    let usingMouse = false;

    document.addEventListener('mousedown', function () {
      usingMouse = true;
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        usingMouse = false;
        document.body.classList.add('keyboard-nav');
      }
    });

    document.addEventListener('mousedown', function () {
      document.body.classList.remove('keyboard-nav');
    });
  }

  /* ────────────────────────────────────────────────────────────
     カードのキーボード操作
  ────────────────────────────────────────────────────────────── */
  function initCardKeyboard() {
    // カードがリンク以外でも Enterキー で動作するよう補完
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.card');
      if (!card) return;
      const link = card.querySelector('a');
      if (link && e.target === card) {
        link.click();
      }
    });
  }

  /* ────────────────────────────────────────────────────────────
     画像の alt 属性チェック（開発時のみ）
  ────────────────────────────────────────────────────────────── */
  function checkImgAlt() {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return;

    const imgs = document.querySelectorAll('img:not([alt])');
    if (imgs.length) {
      console.warn('[a11y] alt属性がない画像があります:', imgs);
    }
  }

  /* ────────────────────────────────────────────────────────────
     ARIA ラベルの補完
  ────────────────────────────────────────────────────────────── */
  function initAriaLabels() {
    // フィルターチップグループに role と aria-label を付与
    document.querySelectorAll('.filter-chip-group').forEach(function (group) {
      if (!group.getAttribute('role')) {
        group.setAttribute('role', 'group');
      }
    });

    // カードにフォーカス可能性を付与
    document.querySelectorAll('.card:not(a):not(button)').forEach(function (card) {
      if (!card.querySelector('a') && !card.getAttribute('tabindex')) {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'article');
      }
    });

    // インデックスナビボタンの説明
    document.querySelectorAll('.index-nav-btn').forEach(function (btn) {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', btn.textContent.trim() + '行');
      }
    });

    // 検索入力フィールドの補完
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(function (input) {
      if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
        input.setAttribute('aria-label', '検索キーワードを入力');
      }
    });
  }

  /* ────────────────────────────────────────────────────────────
     色コントラスト補助（ハイコントラストモード対応）
  ────────────────────────────────────────────────────────────── */
  function initHighContrastSupport() {
    const mediaQuery = window.matchMedia('(forced-colors: active)');

    function applyHighContrast(e) {
      if (e.matches) {
        document.documentElement.classList.add('high-contrast');
      } else {
        document.documentElement.classList.remove('high-contrast');
      }
    }

    applyHighContrast(mediaQuery);
    mediaQuery.addEventListener('change', applyHighContrast);
  }

  /* ────────────────────────────────────────────────────────────
     モーション軽減（prefers-reduced-motion）
  ────────────────────────────────────────────────────────────── */
  function initReducedMotion() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function applyReducedMotion(e) {
      if (e.matches) {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
    }

    applyReducedMotion(mediaQuery);
    mediaQuery.addEventListener('change', applyReducedMotion);
  }

  /* ────────────────────────────────────────────────────────────
     初期化
  ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initOverlayTrap();
    initMobileMenuTrap();
    initSearchResultAnnounce();
    initKeyboardHints();
    initCardKeyboard();
    initAriaLabels();
    initHighContrastSupport();
    initReducedMotion();
    checkImgAlt();
  });

  // 公開API（他スクリプトから利用可能）
  window.MedecoA11y = {
    announce: announceToScreenReader,
    trapFocus: trapFocus
  };

})();
