/**
 * search.js — 検索・フィルタリング機能
 * データは data/*.json から取得し、localStorage にキャッシュします。
 */

(function () {
  'use strict';

  const CACHE_KEY = 'medeco_navi_data';
  const CACHE_TTL = 60 * 60 * 1000; // 1時間

  /* ────────────────────────────────────────────────────────────
     データローダー
  ────────────────────────────────────────────────────────────── */
  async function loadData() {
    // キャッシュチェック
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          return parsed.data;
        }
      }
    } catch (e) { /* キャッシュ読み取りエラーは無視 */ }

    // ルートパスの解決（どのディレクトリからでも動作）
    const root = resolveRoot();

    try {
      const [diseasesRes, symptomsRes, treatmentsRes] = await Promise.all([
        fetch(root + 'data/diseases.json'),
        fetch(root + 'data/symptoms.json'),
        fetch(root + 'data/treatments.json')
      ]);

      const [diseasesData, symptomsData, treatmentsData] = await Promise.all([
        diseasesRes.json(),
        symptomsRes.json(),
        treatmentsRes.json()
      ]);

      const data = {
        diseases:   diseasesData.diseases   || [],
        symptoms:   symptomsData.symptoms   || [],
        treatments: treatmentsData.treatments || []
      };

      // キャッシュに保存
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
      } catch (e) { /* キャッシュ書き込みエラーは無視 */ }

      return data;
    } catch (err) {
      console.warn('データの読み込みに失敗しました:', err);
      return { diseases: [], symptoms: [], treatments: [] };
    }
  }

  function resolveRoot() {
    const path = window.location.pathname;
    const depth = (path.match(/\//g) || []).length - 1;
    if (depth <= 0) return './';
    return '../'.repeat(depth);
  }

  /* ────────────────────────────────────────────────────────────
     全文検索ユーティリティ
  ────────────────────────────────────────────────────────────── */
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  function matchesQuery(item, query) {
    if (!normalize(query)) return true;

    // 半角・全角スペースで分割し、空トークンを除外
    var tokens = query.split(/[\s\u3000]+/).map(normalize).filter(Boolean);
    if (!tokens.length) return true;

    var targets = [
      item.name,
      item.nameEn,
      item.summary,
      item.category,
      ...(item.tags || [])
    ].filter(Boolean).map(normalize);

    // すべてのキーワードがいずれかのフィールドに含まれるか（AND検索）
    return tokens.every(function (token) {
      return targets.some(function (t) { return t.includes(token); });
    });
  }

  /* ────────────────────────────────────────────────────────────
     検索オーバーレイ
  ────────────────────────────────────────────────────────────── */
  function initSearchOverlay() {
    const openBtns   = document.querySelectorAll('[data-search-open]');
    const overlay    = document.getElementById('search-overlay');
    const input      = document.getElementById('search-overlay-input');
    const closeBtn   = document.querySelector('.search-overlay-close');
    const resultArea = document.getElementById('search-overlay-results');

    if (!overlay) return;

    let allData = null;

    function openOverlay() {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(function () {
        if (input) input.focus();
      }, 50);

      // データをプリロード
      if (!allData) {
        loadData().then(function (data) {
          allData = data;
          if (input && input.value) renderResults(input.value);
        });
      }
    }

    function closeOverlay() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
      overlay.setAttribute('aria-hidden', 'true');
      if (input) input.value = '';
      if (resultArea) resultArea.innerHTML = '';
    }

    openBtns.forEach(function (btn) {
      btn.addEventListener('click', openOverlay);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        closeOverlay();
      }
    });

    // 入力イベント
    if (input) {
      let debounceTimer = null;
      input.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          renderResults(input.value);
        }, 150);
      });
    }

    function renderResults(query) {
      if (!resultArea) return;

      if (!allData) {
        loadData().then(function (data) {
          allData = data;
          renderResults(query);
        });
        return;
      }

      const q = normalize(query);
      if (!q) {
        resultArea.innerHTML = '';
        return;
      }

      const root = resolveRoot();

      const diseases = allData.diseases.filter(function (d) { return d.hasPage !== false && matchesQuery(d, q); }).slice(0, 4);
      const symptoms = allData.symptoms.filter(function (s) { return s.hasPage !== false && matchesQuery(s, q); }).slice(0, 4);
      const treatments = allData.treatments.filter(function (t) { return t.hasPage !== false && matchesQuery(t, q); }).slice(0, 3);

      const total = diseases.length + symptoms.length + treatments.length;

      if (total === 0) {
        resultArea.innerHTML = '<p class="search-no-result">「' + escapeHtml(query) + '」に一致する情報が見つかりませんでした。</p>';
        return;
      }

      let html = '';

      if (diseases.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">疾患</p>';
        diseases.forEach(function (d) {
          html += '<a class="search-result-item" href="' + root + 'diseases/' + escapeHtml(d.id) + '/index.html">';
          html += '<span class="search-result-icon disease" aria-hidden="true">🫀</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(d.name) + '</span>';
          html += '<br><span class="search-result-meta">' + escapeHtml(d.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }

      if (symptoms.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">症状</p>';
        symptoms.forEach(function (s) {
          html += '<a class="search-result-item" href="' + root + 'symptoms/' + escapeHtml(s.id) + '/index.html">';
          html += '<span class="search-result-icon symptom" aria-hidden="true">🩺</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(s.name) + '</span>';
          html += '<br><span class="search-result-meta">' + escapeHtml(s.bodyPart) + ' / ' + escapeHtml(s.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }

      if (treatments.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">治療法</p>';
        treatments.forEach(function (t) {
          html += '<a class="search-result-item" href="' + root + 'treatments/' + escapeHtml(t.id) + '/index.html">';
          html += '<span class="search-result-icon treatment" aria-hidden="true">💊</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(t.name) + '</span>';
          html += '<br><span class="search-result-meta">' + escapeHtml(t.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }

      resultArea.innerHTML = html;
    }
  }

  /* ────────────────────────────────────────────────────────────
     疾患一覧ページの検索・フィルター
  ────────────────────────────────────────────────────────────── */
  function initDiseaseListPage() {
    const container = document.getElementById('disease-list');
    if (!container) return;

    loadData().then(function (data) {
      const diseases = data.diseases;
      renderDiseaseList(diseases);
      setupDiseaseFilters(diseases);
    });

    function renderDiseaseList(items) {
      if (!container) return;
      if (!items.length) {
        container.innerHTML = '<div class="empty-state"><p>条件に一致する疾患が見つかりませんでした。</p></div>';
        const countEl = document.getElementById('disease-count');
        if (countEl) countEl.textContent = '0件';
        return;
      }

      const root = resolveRoot();
      container.innerHTML = items.map(function (d) {
        const hasPage = d.hasPage !== false;
        const tag = hasPage ? 'a' : 'div';
        const linkAttr = hasPage ? ' href="' + root + 'diseases/' + escapeHtml(d.id) + '/index.html"' : '';
        const disabledClass = hasPage ? '' : ' card-disabled';
        return '<' + tag + ' class="card disease-card' + (hasPage ? ' card-link' : '') + disabledClass + '"' + linkAttr + '>' +
          '<div class="card-icon" aria-hidden="true">' + getCategoryIcon(d.category) + '</div>' +
          '<div>' +
            '<h3 class="card-title">' + escapeHtml(d.name) + '</h3>' +
            (d.nameEn ? '<p class="text-sm text-muted">' + escapeHtml(d.nameEn) + '</p>' : '') +
          '</div>' +
          '<p class="card-summary">' + escapeHtml(d.summary) + '</p>' +
          '<div class="card-footer">' +
            '<span class="badge badge-neutral">' + escapeHtml(d.category) + '</span>' +
            (hasPage ? '<span class="card-arrow" aria-hidden="true">→</span>' : '<span class="card-disabled-label">準備中</span>') +
          '</div>' +
        '</' + tag + '>';
      }).join('');

      const countEl = document.getElementById('disease-count');
      if (countEl) countEl.textContent = items.length + '件';
    }

    function setupDiseaseFilters(allDiseases) {
      const searchInput = document.getElementById('disease-search');
      let currentQuery  = '';
      let currentCategory = 'all';
      let currentIndex  = 'all';

      function filterAndRender() {
        let filtered = allDiseases;

        if (currentCategory !== 'all') {
          filtered = filtered.filter(function (d) { return d.category === currentCategory; });
        }
        if (currentIndex !== 'all') {
          filtered = filtered.filter(function (d) { return normalize(d.name).startsWith(normalize(currentIndex)); });
        }
        if (currentQuery) {
          filtered = filtered.filter(function (d) { return matchesQuery(d, currentQuery); });
        }
        renderDiseaseList(filtered);
      }

      if (searchInput) {
        let timer = null;
        searchInput.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            currentQuery = searchInput.value;
            filterAndRender();
          }, 200);
        });
      }

      document.addEventListener('filter-change', function (e) {
        if (e.detail.group === 'disease-category') {
          currentCategory = e.detail.values[0] || 'all';
          filterAndRender();
        }
      });

      document.addEventListener('index-filter-change', function (e) {
        currentIndex = e.detail.value;
        filterAndRender();
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     症状一覧ページの検索・フィルター
  ────────────────────────────────────────────────────────────── */
  function initSymptomListPage() {
    const container = document.getElementById('symptom-list');
    if (!container) return;

    loadData().then(function (data) {
      const symptoms = data.symptoms;
      renderSymptomList(symptoms);
      setupSymptomFilters(symptoms);
    });

    function renderSymptomList(items) {
      if (!container) return;
      if (!items.length) {
        container.innerHTML = '<div class="empty-state"><p>条件に一致する症状が見つかりませんでした。</p></div>';
        const countEl = document.getElementById('symptom-count');
        if (countEl) countEl.textContent = '0件';
        return;
      }

      const root = resolveRoot();
      container.innerHTML = items.map(function (s) {
        const urgencyClass = { high: 'badge-danger', medium: 'badge-warning', low: 'badge-success' }[s.urgencyLevel] || 'badge-neutral';
        const urgencyLabel = { high: '要注意', medium: '注意', low: '参考' }[s.urgencyLevel] || '';
        const hasPage = s.hasPage !== false;
        const tag = hasPage ? 'a' : 'div';
        const linkAttr = hasPage ? ' href="' + root + 'symptoms/' + escapeHtml(s.id) + '/index.html"' : '';
        const disabledClass = hasPage ? '' : ' card-disabled';

        return '<' + tag + ' class="card symptom-card' + (hasPage ? ' card-link' : '') + disabledClass + '"' + linkAttr + '>' +
          (urgencyLabel ? '<span class="badge ' + urgencyClass + ' urgency-badge">' + urgencyLabel + '</span>' : '') +
          '<h3 class="card-title">' + escapeHtml(s.name) + '</h3>' +
          '<p class="card-summary">' + escapeHtml(s.summary) + '</p>' +
          '<div class="card-footer">' +
            '<span class="badge badge-info">' + escapeHtml(s.bodyPart) + '</span>' +
            (hasPage
              ? '<span class="text-sm text-muted">関連疾患 ' + (s.relatedDiseases ? s.relatedDiseases.length : 0) + '件</span>'
              : '<span class="card-disabled-label">準備中</span>') +
          '</div>' +
        '</' + tag + '>';
      }).join('');

      const countEl = document.getElementById('symptom-count');
      if (countEl) countEl.textContent = items.length + '件';
    }

    function setupSymptomFilters(allSymptoms) {
      const searchInput = document.getElementById('symptom-search');
      let currentQuery   = '';
      let currentBodyPart = 'all';
      let currentCategory = 'all';

      function filterAndRender() {
        let filtered = allSymptoms;

        if (currentBodyPart !== 'all') {
          filtered = filtered.filter(function (s) { return s.bodyPart === currentBodyPart; });
        }
        if (currentCategory !== 'all') {
          filtered = filtered.filter(function (s) { return s.category === currentCategory; });
        }
        if (currentQuery) {
          filtered = filtered.filter(function (s) { return matchesQuery(s, currentQuery); });
        }
        renderSymptomList(filtered);
      }

      if (searchInput) {
        let timer = null;
        searchInput.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            currentQuery = searchInput.value;
            filterAndRender();
          }, 200);
        });
      }

      document.addEventListener('filter-change', function (e) {
        if (e.detail.group === 'symptom-body-part') {
          currentBodyPart = e.detail.values[0] || 'all';
          filterAndRender();
        }
        if (e.detail.group === 'symptom-category') {
          currentCategory = e.detail.values[0] || 'all';
          filterAndRender();
        }
      });

      // 身体部位マップのクリック
      document.querySelectorAll('.body-part').forEach(function (part) {
        part.addEventListener('click', function () {
          document.querySelectorAll('.body-part').forEach(function (p) { p.classList.remove('is-active'); });
          part.classList.add('is-active');
          currentBodyPart = part.dataset.part || 'all';
          filterAndRender();

          // フィルターチップも同期
          document.querySelectorAll('[data-filter-group="symptom-body-part"]').forEach(function (chip) {
            chip.classList.toggle('is-active', chip.dataset.value === currentBodyPart);
          });
        });
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     治療法一覧ページの検索・フィルター
  ────────────────────────────────────────────────────────────── */
  function initTreatmentListPage() {
    const container = document.getElementById('treatment-list');
    if (!container) return;

    loadData().then(function (data) {
      const treatments = data.treatments;
      renderTreatmentList(treatments);
      setupTreatmentFilters(treatments);
    });

    function renderTreatmentList(items) {
      if (!container) return;
      if (!items.length) {
        container.innerHTML = '<div class="empty-state"><p>条件に一致する治療法が見つかりませんでした。</p></div>';
        const countEl = document.getElementById('treatment-count');
        if (countEl) countEl.textContent = '0件';
        return;
      }

      const root = resolveRoot();
      container.innerHTML = items.map(function (t) {
        const icon = getTreatmentIcon(t.category);
        const hasPage = t.hasPage !== false;
        const tag = hasPage ? 'a' : 'div';
        const linkAttr = hasPage ? ' href="' + root + 'treatments/' + escapeHtml(t.id) + '/index.html"' : '';
        const disabledClass = hasPage ? '' : ' card-disabled';

        return '<' + tag + ' class="card treatment-card' + (hasPage ? ' card-link' : '') + disabledClass + '"' + linkAttr + '>' +
          '<div class="card-icon" aria-hidden="true" style="background:var(--color-bg-alt);width:48px;height:48px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:24px;">' + icon + '</div>' +
          '<h3 class="card-title">' + escapeHtml(t.name) + '</h3>' +
          '<p class="card-summary">' + escapeHtml(t.summary) + '</p>' +
          '<div class="card-footer">' +
            '<span class="badge badge-primary">' + escapeHtml(t.category) + '</span>' +
            (hasPage
              ? (t.duration ? '<span class="text-sm text-muted">' + escapeHtml(t.duration) + '</span>' : '')
              : '<span class="card-disabled-label">準備中</span>') +
          '</div>' +
        '</' + tag + '>';
      }).join('');

      const countEl = document.getElementById('treatment-count');
      if (countEl) countEl.textContent = items.length + '件';
    }

    function setupTreatmentFilters(allTreatments) {
      const searchInput = document.getElementById('treatment-search');
      let currentQuery    = '';
      let currentCategory = 'all';

      function filterAndRender() {
        let filtered = allTreatments;

        if (currentCategory !== 'all') {
          filtered = filtered.filter(function (t) { return t.category === currentCategory; });
        }
        if (currentQuery) {
          filtered = filtered.filter(function (t) { return matchesQuery(t, currentQuery); });
        }
        renderTreatmentList(filtered);
      }

      if (searchInput) {
        let timer = null;
        searchInput.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            currentQuery = searchInput.value;
            filterAndRender();
          }, 200);
        });
      }

      document.addEventListener('filter-change', function (e) {
        if (e.detail.group === 'treatment-category') {
          currentCategory = e.detail.values[0] || 'all';
          filterAndRender();
        }
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     ヘルパー関数
  ────────────────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCategoryIcon(category) {
    const map = {
      '循環器系': '🫀',
      '消化器系': '🫁',
      '神経系':   '🧠',
      '呼吸器系': '🌬️',
      '運動器系': '🦴',
      '内分泌系': '⚖️',
      '泌尿器系': '💧',
      'がん領域': '🔬',
      '皮膚科':   '🧬',
      '眼科':     '👁️'
    };
    return map[category] || '🏥';
  }

  function getTreatmentIcon(category) {
    const map = {
      '薬物療法':   '💊',
      '外科手術':   '🔪',
      '放射線治療': '☢️',
      'リハビリ':   '🏃',
      '生活療法':   '🥗',
      '化学療法':   '🧪',
      '免疫療法':   '🛡️',
      '内視鏡治療': '🔭'
    };
    return map[category] || '🏥';
  }

  /* ────────────────────────────────────────────────────────────
     トップページ インライン検索
  ────────────────────────────────────────────────────────────── */
  function initTopPageSearch() {
    var input      = document.getElementById('top-search-input');
    var resultArea = document.getElementById('top-search-results');
    if (!input || !resultArea) return;

    var allData = null;
    loadData().then(function (data) { allData = data; });

    var debounceTimer = null;
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () { renderTopResults(input.value); }, 150);
    });

    // フォーカスが外れたら結果を閉じる（少し遅延してリンククリックを優先）
    input.addEventListener('blur', function () {
      setTimeout(function () { resultArea.innerHTML = ''; }, 200);
    });

    function renderTopResults(query) {
      var q = normalize(query);
      if (!q) { resultArea.innerHTML = ''; return; }

      if (!allData) {
        loadData().then(function (data) { allData = data; renderTopResults(query); });
        return;
      }

      var root = resolveRoot();
      var diseases   = allData.diseases.filter(function (d) { return d.hasPage !== false && matchesQuery(d, q); }).slice(0, 4);
      var symptoms   = allData.symptoms.filter(function (s) { return s.hasPage !== false && matchesQuery(s, q); }).slice(0, 4);
      var treatments = allData.treatments.filter(function (t) { return t.hasPage !== false && matchesQuery(t, q); }).slice(0, 3);
      var total = diseases.length + symptoms.length + treatments.length;

      if (total === 0) {
        resultArea.innerHTML = '<p class="search-no-result" style="padding:var(--space-4) var(--space-5);color:var(--color-text-muted);font-size:var(--text-sm);">「' + escapeHtml(query) + '」に一致する情報が見つかりませんでした。</p>';
        return;
      }

      var html = '';
      if (diseases.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">疾患</p>';
        diseases.forEach(function (d) {
          html += '<a class="search-result-item" href="' + root + 'diseases/' + escapeHtml(d.id) + '/index.html">';
          html += '<span class="search-result-icon disease" aria-hidden="true">🫀</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(d.name) + '</span><br><span class="search-result-meta">' + escapeHtml(d.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }
      if (symptoms.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">症状</p>';
        symptoms.forEach(function (s) {
          html += '<a class="search-result-item" href="' + root + 'symptoms/' + escapeHtml(s.id) + '/index.html">';
          html += '<span class="search-result-icon symptom" aria-hidden="true">🩺</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(s.name) + '</span><br><span class="search-result-meta">' + escapeHtml(s.bodyPart) + ' / ' + escapeHtml(s.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }
      if (treatments.length) {
        html += '<div class="search-result-group">';
        html += '<p class="search-result-group-title">治療法</p>';
        treatments.forEach(function (t) {
          html += '<a class="search-result-item" href="' + root + 'treatments/' + escapeHtml(t.id) + '/index.html">';
          html += '<span class="search-result-icon treatment" aria-hidden="true">💊</span>';
          html += '<span><span class="search-result-name">' + escapeHtml(t.name) + '</span><br><span class="search-result-meta">' + escapeHtml(t.category) + '</span></span>';
          html += '</a>';
        });
        html += '</div>';
      }
      resultArea.innerHTML = html;
    }
  }

  /* ────────────────────────────────────────────────────────────
     初期化
  ────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initSearchOverlay();
    initTopPageSearch();
    initDiseaseListPage();
    initSymptomListPage();
    initTreatmentListPage();
  });

})();
