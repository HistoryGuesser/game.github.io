import { FULL_QUESTIONS } from './data/questions.js';

import {
  SAVE_KEY,
  LEADERBOARD_KEY,
  PLAYER_KEY,
  saveJSON,
  loadJSON,
  removeJSON
} from './storage/storage.js';

import {
  byId,
  show,
  hide,
  toggle
} from './utils/dom.js';

(() => {

      const SUPABASE_URL = 'https://zlxjshorwqmntjqadgdz.supabase.co';
      const QUESTIONS_PER_GAME = 5;
      const SAVE_KEY = 'historyguesser_save';
      const LEADERBOARD_KEY = 'historyguesser_leaderboard_v1';
      const PLAYER_KEY = 'historyguesser_player_profile_v1';
      const MAX_SCALE = 6;
      const OVERDRAW_PX = 25;
      const DRAG_THRESHOLD = 6;
      const EDUCATION_ORGS = ['Не указано', 'Московский университет МВД России имени В. Я. Кикотя', 'Военная академия связи', 'Михайловская военная артиллерийская академия', 'Военно-космическая академия им. А.Ф. Можайского', 'Военно-медицинская академия', 'Другое'];

      const byId = (id) => document.getElementById(id);
      const gameScreen = byId('gameScreen');
      const yearSlider = byId('yearSlider');
      const yearValueDisplay = byId('yearValueDisplay');
      const actionBtn = byId('actionBtn');
      const totalScoreSpan = byId('totalScore');
      const roundBadge = byId('roundBadge');
      const infoBlock = byId('infoBlock');
      const mapView = byId('mapView');
      const imageView = byId('imageView');
      const toggleViewDiv = byId('toggleView');
      const splitViewDiv = byId('splitView');
      const splitColumns = splitViewDiv.querySelector('.split-columns');
      const splitMapDiv = byId('splitMap');
      const splitAnswerBlock = byId('splitAnswerBlock');
      const splitImagePane = splitViewDiv.querySelector('.split-image');
      const splitRightControls = splitViewDiv.querySelector('.split-right-controls');
      const selectorMapDiv = byId('selectorMap');
      const yearSliderArea = byId('yearSliderArea');
      const roundScoreCards = byId('roundScoreCards');
      const controlBar = byId('controlBar');
      const distanceCard = byId('distanceCard');
      const splitDistancePoints = byId('splitDistancePoints');
      const splitYearPoints = byId('splitYearPoints');
      const splitRoundPoints = byId('splitRoundPoints');
      const splitNextBtn = byId('splitNextBtn');
      const zoomButtons = imageView.querySelector('.zoom-buttons');
      const switchViewBtn = byId('switchViewBtn');
      const switchIcon = byId('switchIcon');
      const playerOrgSelect = byId('playerOrgSelect');
      const lbOrgFilter = byId('lbOrgFilter');
      const lbCourseFilter = byId('lbCourseFilter');
      const lbGroupFilter = byId('lbGroupFilter');
      const leaderboardBody = byId('leaderboardBody');
      let lbActiveTab = 'overall';

      const imageWrapper = byId('imageWrapper');
      const splitImageWrapper = byId('splitImageWrapper');
      const historicalImg = byId('historicalImage');
      const historicalImgBg = byId('historicalImageBg');
      const splitHistoricalImage = byId('splitHistoricalImage');
      const splitHistoricalImageBg = byId('splitHistoricalImageBg');

      let map = null;
      let splitMap = null;
      let selectorMap = null;
      let userMarker = null, correctMarker = null, distanceLine = null;
      let selectedLat = null, selectedLng = null, selectedYear = 1950;
      let totalPoints = 0, currentIndex = 0;
      let currentQuestions = [];
      let questionAnswered = false;
      let waitingNext = false;
      let currentView = 'image';
      let gameMode = 'single';
      let currentPlayer = null;

      let imgW = 0, imgH = 0, scale = 1, translateX = 0, translateY = 0, minScale = 0.15;
      let pointers = new Map();
      let gesture = null;

      const shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      const randomQuestions = () => shuffle([...FULL_QUESTIONS]).slice(0, QUESTIONS_PER_GAME);
      const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

      function setInfo(text, timeout = 2200) {
        infoBlock.innerHTML = text;
        clearTimeout(setInfo._timer);
        setInfo._timer = setTimeout(() => {
          if (!questionAnswered && !waitingNext) {
            infoBlock.innerHTML = 'Определите место на карте и укажите наиболее вероятный год.';
          }
        }, timeout);
      }
      function populateOrgSelects() {
        const optionsHtml = EDUCATION_ORGS.map((org) => `<option value="${org}">${org}</option>`).join('');
        playerOrgSelect.innerHTML = optionsHtml;
        lbOrgFilter.innerHTML = `<option value="">Все учреждения</option>${optionsHtml}`;
      }
      function loadPlayerProfile() {
        try { return JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null'); } catch { return null; }
      }
      function savePlayerProfile(profile) { localStorage.setItem(PLAYER_KEY, JSON.stringify(profile)); }
      // ── Supabase ──────────────────────────────────────────────────────────
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpseGpzaG9yd3FtbnRqcWFkZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjg0NTcsImV4cCI6MjA5MDY0NDQ1N30.PMkUf1lW6lINc0QBrDrTxe77gZQzMX-p_4OKiyHB7j0';

      async function sbFetch(path, options = {}) {
        const res = await fetch(SUPABASE_URL + path, {
          ...options,
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || '',
            ...(options.headers || {})
          }
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error('Supabase error ' + res.status + ': ' + err);
        }
        return res.status === 204 ? null : res.json();
      }

      async function addLeaderboardEntry(points) {
        if (!currentPlayer) return;
        const entry = {
          name: currentPlayer.name,
          org: currentPlayer.org || 'Не указано',
          course: currentPlayer.course || '—',
          grp: currentPlayer.group || '—',
          points: Math.floor(points),
          created_at: new Date().toISOString()
        };
        // Сохраняем локально всегда (резервная копия)
        try {
          const list = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
          list.push({ ...entry, group: entry.grp });
          localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
        } catch {}
        // Пробуем отправить в Supabase
        try {
          await sbFetch('/rest/v1/leaderboard', {
            method: 'POST',
            prefer: 'return=minimal',
            body: JSON.stringify(entry)
          });
        } catch (e) {
          console.warn('Supabase write failed, используются локальные данные:', e.message);
        }
      }

      async function loadLeaderboardData() {
        // Сначала пробуем Supabase
        try {
          const rows = await sbFetch('/rest/v1/leaderboard?select=*&order=points.desc&limit=500');
          if (Array.isArray(rows)) {
            // Нормализуем поле group (в БД может быть grp)
            return rows.map(r => ({ ...r, group: r.grp || r.group || '—' }));
          }
        } catch (e) {
          console.warn('Supabase read failed, используются локальные данные:', e.message);
        }
        // Фоллбэк — локальное хранилище
        try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]'); } catch { return []; }
      }

      async function renderLeaderboard() {
        const type = lbActiveTab;
        const org = lbOrgFilter.value.trim();
        const course = lbCourseFilter.value.trim();
        const group = lbGroupFilter.value.trim().toLowerCase();

        // Показываем нужные фильтры
        lbOrgFilter.classList.toggle('hidden', type !== 'org' && type !== 'course' && type !== 'group');
        lbCourseFilter.classList.toggle('hidden', type !== 'course');
        lbGroupFilter.classList.toggle('hidden', type !== 'group');
        const filtersDiv = byId('lbFilters');
        const anyVisible = !lbOrgFilter.classList.contains('hidden') || !lbCourseFilter.classList.contains('hidden') || !lbGroupFilter.classList.contains('hidden');
        filtersDiv.style.display = anyVisible ? '' : 'none';

        const thead = byId('lbThead');
        leaderboardBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b;">Загрузка...</td></tr>';

        let rows = await loadLeaderboardData();

        if (type === 'all_orgs') {
          rows = rows.filter(r => r.org && r.org !== 'Не указано');
          const orgMap = {};
          rows.forEach(r => {
            if (!orgMap[r.org]) orgMap[r.org] = { org: r.org, totalPoints: 0, players: 0 };
            orgMap[r.org].totalPoints += r.points;
            orgMap[r.org].players += 1;
          });
          const orgRows = Object.values(orgMap).sort((a, b) => b.totalPoints - a.totalPoints);
          thead.innerHTML = '<tr><th>#</th><th>Учреждение</th><th>Игроков</th><th>Суммарно очков</th></tr>';
          leaderboardBody.innerHTML = orgRows.map((r, idx) => {
            const cls = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
            return `<tr class="${cls}"><td>${idx+1}</td><td>${r.org}</td><td>${r.players}</td><td>${r.totalPoints}</td></tr>`;
          }).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#64748b;">Пока нет результатов.</td></tr>';
          return;
        }

        if (type === 'org' && org) rows = rows.filter(r => r.org === org);
        if (type === 'course') {
          if (org) rows = rows.filter(r => r.org === org);
          if (course) rows = rows.filter(r => String(r.course) === course);
        }
        if (type === 'group') {
          if (org) rows = rows.filter(r => r.org === org);
          if (group) rows = rows.filter(r => String(r.group).toLowerCase() === group);
        }

        rows.sort((a, b) => b.points - a.points);
        thead.innerHTML = '<tr><th>#</th><th>Игрок</th><th>Учреждение</th><th>Курс</th><th>Взвод/группа</th><th>Очки</th><th>Дата</th></tr>';
        leaderboardBody.innerHTML = rows.map((r, idx) => {
          const cls = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
          const date = r.created_at ? new Date(r.created_at).toLocaleDateString('ru-RU') : (r.date ? new Date(r.date).toLocaleDateString('ru-RU') : '—');
          return `<tr class="${cls}"><td>${idx+1}</td><td>${r.name}</td><td>${r.org}</td><td>${r.course}</td><td>${r.group}</td><td>${r.points}</td><td>${date}</td></tr>`;
        }).join('') || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b;">Пока нет результатов.</td></tr>';
      }
      function resetSwitchButtonPosition() {
        switchViewBtn.style.right = '16px';
        switchViewBtn.style.bottom = '16px';
        switchViewBtn.style.left = 'auto';
        switchViewBtn.style.top = 'auto';
      }

      function saveGameState() {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ totalPoints, currentIndex, selectedYear, currentQuestions }));
      }
      function loadGameState() {
        const saved = localStorage.getItem(SAVE_KEY);
        return saved ? JSON.parse(saved) : null;
      }
      function clearGameState() { localStorage.removeItem(SAVE_KEY); }

      function calcPoints(userLat, userLng, userYear, correctLat, correctLng, correctYear) {
        const R = 6371;
        const dLat = (correctLat - userLat) * Math.PI / 180;
        const dLng = (correctLng - userLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(correctLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const yearDiff = Math.abs(userYear - correctYear);
        const pointsYear = Math.max(0, 500 - yearDiff * 10);

        // Distance scoring: 150м→500, 100км→350, 250км→250, 500км→100, 1000км→50, 2500км→0
        let pointsDist = 0;
        if (distKm <= 0.15) {
          pointsDist = 500;
        } else if (distKm <= 100) {
          pointsDist = Math.round(350 + (500 - 350) * (1 - (distKm - 0.15) / (100 - 0.15)));
        } else if (distKm <= 250) {
          pointsDist = Math.round(250 + (350 - 250) * (1 - (distKm - 100) / (250 - 100)));
        } else if (distKm <= 500) {
          pointsDist = Math.round(100 + (250 - 100) * (1 - (distKm - 250) / (500 - 250)));
        } else if (distKm <= 1000) {
          pointsDist = Math.round(50 + (100 - 50) * (1 - (distKm - 500) / (1000 - 500)));
        } else if (distKm <= 2500) {
          pointsDist = Math.round(50 * (1 - (distKm - 1000) / (2500 - 1000)));
        } else {
          pointsDist = 0;
        }

        return { total: pointsYear + pointsDist, distKm, yearDiff, pointsYear, pointsDist };
      }

      function hideCopyrights() {
        const selectors = [
          '.ymaps-copyrights-pane', '.ymaps-logo', '.ymaps-copyright',
          '[class*="ymaps-copyright"]', '[class*="ymaps-logo"]',
          '.ymaps-2-1-79-copyright', '.ymaps-2-1-79-copyrights-pane'
        ];
        selectors.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
          el.style.display = 'none'; el.style.visibility = 'hidden'; el.style.opacity = '0';
        }));
      }
      new MutationObserver(hideCopyrights).observe(document.body, { childList: true, subtree: true });

      async function initMainMap() {
        return new Promise((resolve) => {
          const boot = () => {
            map = new ymaps.Map('mapView', {
              center: [55, 37], // was [55.7537, 37.6199]
              zoom: 6,          // was 6
              controls: ['zoomControl']
            }, {
              suppressMapOpenBlock: true,
              yandexMapDisablePoiInteractivity: true
            });

      // расширенный лимит карты: вся Евразия
            map.options.set('restrictMapArea', [[10, -10], [82, 190]]); // was [[41, 19], [82, 190]]

            map.events.add('click', (e) => applyUserSelection(e.get('coords')));
            hideCopyrights();
            resolve();
          };

          if (window.ymaps) ymaps.ready(boot);
          else setTimeout(() => initMainMap().then(resolve), 120);
        });
      }
      function applyUserSelection(coords) {
        if (questionAnswered || waitingNext) return setInfo('Вопрос уже проверен. Перейдите к следующему.');
        [selectedLat, selectedLng] = coords;
        if (userMarker) map.geoObjects.remove(userMarker);
        userMarker = new ymaps.Placemark([selectedLat, selectedLng], { hintContent: 'Ваш выбор' }, { preset: 'islands#blueCircleIcon' });
        map.geoObjects.add(userMarker);

        if (selectorMap) {
          selectorMap.geoObjects.removeAll();
          selectorMap.geoObjects.add(new ymaps.Placemark([selectedLat, selectedLng], { hintContent: 'Ваш выбор' }, { preset: 'islands#blueCircleIcon' }));
        }
        setInfo(`Координаты выбраны: ${selectedLat.toFixed(2)}°, ${selectedLng.toFixed(2)}°`, 1800);
      }

      async function initSelectorMap() {
        if (window.innerWidth < 980 || !window.ymaps) return;
          return new Promise((resolve) => {
            ymaps.ready(() => {
              if (selectorMap) selectorMap.destroy();
              selectorMap = new ymaps.Map(selectorMapDiv, {
                center: [55, 37], // was [55.7537, 37.6199]
                zoom: 4,          // was 4
                controls: []
              }, {
                suppressMapOpenBlock: true,
                yandexMapDisablePoiInteractivity: true
              });

      // расширенный лимит карты: вся Евразия
              selectorMap.options.set('restrictMapArea', [[10, -10], [82, 190]]); // was [[41, 19], [82, 190]]

              selectorMap.events.add('click', (e) => applyUserSelection(e.get('coords')));
              hideCopyrights();
              resolve();
            });
          });
      }

      async function initSplitMap() {
        if (!window.ymaps) return;
        return new Promise((resolve) => {
          ymaps.ready(() => {
            if (splitMap) splitMap.destroy();
            splitMap = new ymaps.Map(splitMapDiv, {
              center: [55, 37], // was [55.7537, 37.6199]
              zoom: 6,          // was 6
              controls: ['zoomControl']
            }, {
              suppressMapOpenBlock: true,
              yandexMapDisablePoiInteractivity: true
            });

      // расширенный лимит карты: вся Евразия
            splitMap.options.set('restrictMapArea', [[10, -10], [82, 190]]); // was [[41, 19], [82, 190]]

            if (selectedLat != null && selectedLng != null) {
              splitMap.geoObjects.add(new ymaps.Placemark(
                [selectedLat, selectedLng],
                { hintContent: 'Ваш выбор' },
                { preset: 'islands#blueCircleIcon' }
              ));
            }
            const q = currentQuestions[currentIndex];
            splitMap.geoObjects.add(new ymaps.Placemark(
              [q.correctLat, q.correctLng],
              { hintContent: 'Правильное место' },
              { preset: 'islands#greenCircleIcon' }
            ));
            if (selectedLat != null && selectedLng != null) {
              splitMap.geoObjects.add(new ymaps.Polyline(
                [[selectedLat, selectedLng], [q.correctLat, q.correctLng]],
                {},
                { strokeColor: '#1e3a8a', strokeWidth: 3, strokeStyle: 'dash' }
              ));
              const bounds = ymaps.util.bounds.fromPoints([[selectedLat, selectedLng], [q.correctLat, q.correctLng]]);
              splitMap.setBounds(bounds, { checkZoomRange: true, zoomMargin: 70 });
            }
            hideCopyrights();
            resolve();
          });
        });
      }

      function clearMapGraphics() {
        if (!map) return;
        if (userMarker) map.geoObjects.remove(userMarker);
        if (correctMarker) map.geoObjects.remove(correctMarker);
        if (distanceLine) map.geoObjects.remove(distanceLine);
        userMarker = correctMarker = distanceLine = null;
        if (selectorMap) selectorMap.geoObjects.removeAll();
      }

      function drawAnswerOnMainMap(q) {
        correctMarker = new ymaps.Placemark([q.correctLat, q.correctLng], { hintContent: 'Правильное место' }, { preset: 'islands#greenCircleIcon' });
        map.geoObjects.add(correctMarker);
        if (selectedLat == null || selectedLng == null) return;
        distanceLine = new ymaps.Polyline([[selectedLat, selectedLng], [q.correctLat, q.correctLng]], {}, { strokeColor: '#1e3a8a', strokeWidth: 3, strokeStyle: 'dash' });
        map.geoObjects.add(distanceLine);
        const bounds = ymaps.util.bounds.fromPoints([[selectedLat, selectedLng], [q.correctLat, q.correctLng]]);
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 70 });
      }

      function stageRect() { return imageWrapper.getBoundingClientRect(); }
      function metrics() {
        const rect = stageRect();
        if (!imgW || !imgH || !rect.width || !rect.height) return null;
        const contain = Math.min(rect.width / imgW, rect.height / imgH);
        const cover = Math.max(rect.width / imgW, rect.height / imgH);
        return { rect, contain, cover };
      }
      function panBounds(nextScale = scale) {
        const rect = stageRect();
        const scaledW = imgW * nextScale;
        const scaledH = imgH * nextScale;
        const centerX = (rect.width - scaledW) / 2;
        const centerY = (rect.height - scaledH) / 2;

        const minX = scaledW <= rect.width ? centerX - OVERDRAW_PX : rect.width - scaledW - OVERDRAW_PX;
        const maxX = scaledW <= rect.width ? centerX + OVERDRAW_PX : OVERDRAW_PX;
        const minY = scaledH <= rect.height ? centerY - OVERDRAW_PX : rect.height - scaledH - OVERDRAW_PX;
        const maxY = scaledH <= rect.height ? centerY + OVERDRAW_PX : OVERDRAW_PX;
        return { minX, maxX, minY, maxY };
      }

      function applyTransforms() {
        historicalImg.style.width = `${imgW}px`;
        historicalImg.style.height = `${imgH}px`;
        historicalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

        const m = metrics();
        if (m) {
          const bgW = imgW * m.cover;
          const bgH = imgH * m.cover;
          const bgX = (m.rect.width - bgW) / 2;
          const bgY = (m.rect.height - bgH) / 2;
          historicalImgBg.style.width = `${imgW}px`;
          historicalImgBg.style.height = `${imgH}px`;
          historicalImgBg.style.transform = `translate(${bgX}px, ${bgY}px) scale(${m.cover})`;
        }
      }
      function fitImage() {
        const m = metrics();
        if (!m) return;
        minScale = Math.max(.15, m.contain * .9);
        scale = m.contain;
        translateX = (m.rect.width - imgW * scale) / 2;
        translateY = (m.rect.height - imgH * scale) / 2;
        applyBounds();
      }
      function applyBounds() {
        const b = panBounds();
        translateX = clamp(translateX, b.minX, b.maxX);
        translateY = clamp(translateY, b.minY, b.maxY);
        applyTransforms();
      }
      function setScale(nextScale, ax = null, ay = null) {
        const rect = stageRect();
        if (!rect.width || !rect.height) return;
        const old = scale;
        const s = clamp(nextScale, minScale, MAX_SCALE);
        if (s === old) return;
        const x = ax ?? rect.width / 2;
        const y = ay ?? rect.height / 2;
        const imgX = (x - translateX) / old;
        const imgY = (y - translateY) / old;
        scale = s;
        translateX = x - imgX * scale;
        translateY = y - imgY * scale;
        applyBounds();
      }

      function updateSplitImagePreview() {
        if (splitViewDiv.classList.contains('hidden') || !imgW || !imgH) return;
        const rect = splitImageWrapper.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const k = Math.min(rect.width / imgW, rect.height / imgH);
        const x = (rect.width - imgW * k) / 2;
        const y = (rect.height - imgH * k) / 2;
        const cover = Math.max(rect.width / imgW, rect.height / imgH);
        const bx = (rect.width - imgW * cover) / 2;
        const by = (rect.height - imgH * cover) / 2;
        splitHistoricalImageBg.style.width = `${imgW}px`;
        splitHistoricalImageBg.style.height = `${imgH}px`;
        splitHistoricalImageBg.style.transform = `translate(${bx}px, ${by}px) scale(${cover})`;
        splitHistoricalImage.style.width = `${imgW}px`;
        splitHistoricalImage.style.height = `${imgH}px`;
        splitHistoricalImage.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      }

      function updateMobileResultLayout() {
        if (isDesktop() || splitViewDiv.classList.contains('hidden') || !gameScreen.classList.contains('result-mode')) {
          splitMapDiv.style.height = '';
          splitImagePane.style.height = '';
          return;
        }
        const viewportH = Math.floor(window.visualViewport?.height || window.innerHeight || 0);
        if (!viewportH) return;
        const colsRect = splitColumns.getBoundingClientRect();
        const visibleHeight = Math.max(0, viewportH - colsRect.top - 6);
        if (!visibleHeight) return;
        const styles = getComputedStyle(splitColumns);
        const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
        const fixedHeight = splitAnswerBlock.offsetHeight + distanceCard.offsetHeight + splitRightControls.offsetHeight + gap * 4;
        // Запас под системные панели/погрешности, чтобы кнопка всегда оставалась в видимой зоне.
        const reservePx = 14;
        const available = Math.max(0, visibleHeight - fixedHeight - reservePx);
        const shared = Math.max(40, Math.floor(available * 0.5));
        splitMapDiv.style.height = `${shared}px`;
        splitImagePane.style.height = `${shared}px`;
      }

      function loadImage(url, description) {
        const img = new Image();
        img.onload = () => {
          imgW = img.width; imgH = img.height;
          [historicalImg.src, historicalImgBg.src, splitHistoricalImage.src, splitHistoricalImageBg.src] = [url, url, url, url];
          requestAnimationFrame(() => { fitImage(); updateSplitImagePreview(); });
        };
        img.onerror = () => {
          const fallback = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 260'><rect width='100%' height='100%' fill='#6c757d'/><text x='200' y='130' text-anchor='middle' fill='white' font-size='18'>Не загружено</text><text x='200' y='170' text-anchor='middle' fill='#f8f9fa' font-size='14'>${description}</text></svg>`)}`;
          imgW = 400; imgH = 260;
          [historicalImg.src, historicalImgBg.src, splitHistoricalImage.src, splitHistoricalImageBg.src] = [fallback, fallback, fallback, fallback];
          requestAnimationFrame(() => { fitImage(); updateSplitImagePreview(); });
        };
        img.src = url;
      }

      function isDesktop() { return window.innerWidth >= 980; }

      function switchView() {
        if (isDesktop()) return; // На ПК переключение не нужно — карта всегда видна
        if (currentView === 'image') {
          currentView = 'map';
          mapView.classList.remove('view-hidden');
          imageView.classList.add('view-hidden');
          switchIcon.textContent = '🖼️';
          map?.container.fitToViewport();
        } else {
          currentView = 'image';
          mapView.classList.add('view-hidden');
          imageView.classList.remove('view-hidden');
          switchIcon.textContent = '🗺️';
          requestAnimationFrame(fitImage);
        }
      }

      function loadQuestion(savedYear = null) {
        questionAnswered = false;
        waitingNext = false;
        clearMapGraphics();
        selectedLat = selectedLng = null;

        const q = currentQuestions[currentIndex];
        roundBadge.textContent = `Раунд ${currentIndex + 1}/${currentQuestions.length}`;
        totalScoreSpan.textContent = Math.floor(totalPoints);
        yearSliderArea.style.display = '';
        roundScoreCards.classList.add('hidden');
        gameScreen.classList.remove('result-mode');
        controlBar.style.display = '';
        zoomButtons.style.display = '';
        toggleViewDiv.classList.remove('hidden');
        splitViewDiv.classList.add('hidden');
        byId('splitAnswerDescription').textContent = '—';
        byId('splitCorrectYear').textContent = '—';
        byId('splitYearDiff').textContent = '—';
        infoBlock.classList.remove('compact');
        infoBlock.style.display = '';

        // На ПК карта всегда видна рядом с фото
        if (isDesktop()) {
          mapView.classList.remove('view-hidden');
          imageView.classList.remove('view-hidden');
          currentView = 'image';
        } else {
          if (currentView === 'map') switchView();
        }

        selectedYear = savedYear ?? Math.floor(Math.random() * (2024 - 1850 + 1)) + 1850;
        yearSlider.value = selectedYear;
        yearValueDisplay.textContent = selectedYear;

        actionBtn.disabled = false;
        actionBtn.style.display = '';
        actionBtn.textContent = '✅ ПРОВЕРИТЬ';
        actionBtn.onclick = handleCheck;
        splitNextBtn.onclick = null;
        splitNextBtn.textContent = '➡️ СЛЕДУЮЩИЙ ВОПРОС';

        setInfo('Определите место на карте и укажите наиболее вероятный год.', 2000);
        loadImage(q.imageUrl, q.description);
        resetSwitchButtonPosition();

        map?.setCenter([55.7537, 37.6199], 6, { duration: 250 });
        setTimeout(() => map?.container?.fitToViewport(), 50);
      }

      function handleCheck() {
        if (questionAnswered || waitingNext) return;
        if (selectedLat == null || selectedLng == null) return setInfo('Сначала выберите точку на карте.', 2200);

        const q = currentQuestions[currentIndex];
        const res = calcPoints(selectedLat, selectedLng, selectedYear, q.correctLat, q.correctLng, q.correctYear);

        totalPoints += res.total;
        totalScoreSpan.textContent = Math.floor(totalPoints);

        drawAnswerOnMainMap(q);
        questionAnswered = true;
        waitingNext = true;
        saveGameState();

        yearSliderArea.style.display = 'none';
        toggleViewDiv.classList.add('hidden');
        splitViewDiv.classList.remove('hidden');
        gameScreen.classList.add('result-mode');
        controlBar.style.display = 'none';
        zoomButtons.style.display = 'none';
        actionBtn.style.display = 'none';
        roundScoreCards.classList.add('hidden');

        // В сцене результата скрываем infoBlock на всех устройствах
        infoBlock.style.display = 'none';

        distanceCard.textContent = `Расстояние: ${res.distKm.toFixed(1)} км`;
        // Только splitView карточки — roundScoreCards в control-bar скрыты на ПК в результате
        splitDistancePoints.textContent = res.pointsDist;
        splitYearPoints.textContent = res.pointsYear;
        splitRoundPoints.textContent = res.total;

        byId('splitAnswerDescription').textContent = q.description;
        byId('splitCorrectYear').textContent = q.correctYear + ' г.';
        byId('splitYearDiff').textContent = res.yearDiff;

        splitHistoricalImage.src = historicalImg.src;
        updateMobileResultLayout();
        updateSplitImagePreview();
        initSplitMap().catch(console.error);
        requestAnimationFrame(() => {
          updateMobileResultLayout();
          updateSplitImagePreview();
        });

        const goNext = () => {
          currentIndex += 1;
          if (currentIndex < currentQuestions.length) {
            loadQuestion();
            saveGameState();
          } else {
            finishGame();
          }
        };
        const isLastRound = currentIndex === currentQuestions.length - 1;
        splitNextBtn.textContent = isLastRound ? '🏁 ЗАВЕРШИТЬ ИГРУ' : '➡️ СЛЕДУЮЩИЙ ВОПРОС';
        splitNextBtn.onclick = goNext;
      }

      function finishGame() {
        const maxPoints = currentQuestions.length * 1000;
        const percent = (totalPoints / maxPoints) * 100;
        const messages = percent >= 80
          ? ['Вы продемонстрировали высокий уровень исторической и географической точности.']
          : percent >= 50
            ? ['Хороший результат. Рекомендуется повторить материал для повышения точности.']
            : ['Рекомендуется повторная попытка для улучшения итогового результата.'];

        if (gameMode === 'multi') addLeaderboardEntry(totalPoints);
        byId('finalMessage').innerHTML = `Итоговый результат: ${Math.floor(totalPoints)} из ${maxPoints}<br>${messages[0]}`;
        const finalButtons = byId('finalButtons');
        finalButtons.innerHTML = '';

        const againBtn = document.createElement('button');
        againBtn.className = 'modal-btn';
        againBtn.textContent = 'Новая игра';
        againBtn.onclick = () => { byId('finalModal').classList.add('hidden'); startGame(false, gameMode); };

        const menuBtn = document.createElement('button');
        menuBtn.className = 'modal-btn';
        menuBtn.textContent = 'Главное меню';
        menuBtn.onclick = () => {
          byId('finalModal').classList.add('hidden');
          byId('gameScreen').classList.add('hidden');
          byId('menuScreen').classList.remove('hidden');
          map?.destroy(); map = null;
          splitMap?.destroy(); splitMap = null;
          selectorMap?.destroy(); selectorMap = null;
        };

        finalButtons.append(againBtn, menuBtn);
        if (gameMode === 'multi') {
          const lbBtn = document.createElement('button');
          lbBtn.className = 'modal-btn';
          lbBtn.textContent = 'Таблица лидеров';
          lbBtn.onclick = () => {
            byId('finalModal').classList.add('hidden');
            byId('gameScreen').classList.add('hidden');
            byId('menuScreen').classList.add('hidden');
            byId('leaderboardScreen').classList.remove('hidden');
            renderLeaderboard();
          };
          finalButtons.append(lbBtn);
        }
        byId('finalModal').classList.remove('hidden');
        clearGameState();
      }

      async function startGame(useSaved = false, mode = 'single') {
        gameMode = mode;
        byId('menuScreen').classList.add('hidden');
        byId('leaderboardScreen').classList.add('hidden');
        byId('gameScreen').classList.remove('hidden');

        if (map) { map.destroy(); map = null; }
        if (splitMap) { splitMap.destroy(); splitMap = null; }
        if (selectorMap) { selectorMap.destroy(); selectorMap = null; }

        await initMainMap();
        await initSelectorMap();

        if (useSaved && mode === 'single') {
          const saved = loadGameState();
          if (saved?.currentQuestions?.length && saved.currentIndex < saved.currentQuestions.length) {
            currentQuestions = saved.currentQuestions;
            totalPoints = saved.totalPoints;
            currentIndex = saved.currentIndex;
            selectedYear = saved.selectedYear;
            loadQuestion(saved.selectedYear);
          } else {
            currentQuestions = randomQuestions();
            totalPoints = 0;
            currentIndex = 0;
            loadQuestion();
            clearGameState();
            saveGameState();
          }
        } else {
          currentQuestions = randomQuestions();
          totalPoints = 0;
          currentIndex = 0;
          loadQuestion();
          clearGameState();
          saveGameState();
        }

        // На ПК карта всегда видна рядом с фото
        if (isDesktop()) {
          mapView.classList.remove('view-hidden');
          imageView.classList.remove('view-hidden');
        } else {
          mapView.classList.add('view-hidden');
          imageView.classList.remove('view-hidden');
        }
        currentView = 'image';
        switchIcon.textContent = '🗺️';
        resetSwitchButtonPosition();
        setTimeout(() => map?.container?.fitToViewport(), 100);
      }

      yearSlider.addEventListener('input', () => {
        if (questionAnswered || waitingNext) {
          yearSlider.value = selectedYear;
          return;
        }
        selectedYear = Number(yearSlider.value);
        yearValueDisplay.textContent = selectedYear;
        saveGameState();
      });

      imageWrapper.addEventListener('pointerdown', (e) => {
        if (currentView !== 'image' || (e.button !== undefined && e.button !== 0)) return;
        imageWrapper.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 1) {
          gesture = { type: 'drag', id: e.pointerId, sx: e.clientX, sy: e.clientY, tx: translateX, ty: translateY };
        } else if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()];
          gesture = { type: 'pinch', dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), scale };
        }
      });
      imageWrapper.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId) || currentView !== 'image') return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size === 1 && gesture?.type === 'drag' && gesture.id === e.pointerId) {
          translateX = gesture.tx + (e.clientX - gesture.sx);
          translateY = gesture.ty + (e.clientY - gesture.sy);
          applyBounds();
          return;
        }

        if (pointers.size === 2 && gesture?.type === 'pinch') {
          const [p1, p2] = [...pointers.values()];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const rect = imageWrapper.getBoundingClientRect();
          const mx = (p1.x + p2.x) / 2 - rect.left;
          const my = (p1.y + p2.y) / 2 - rect.top;
          setScale(gesture.scale * (dist / gesture.dist), mx, my);
        }
      });
      const endPointer = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) gesture = null;
      };
      imageWrapper.addEventListener('pointerup', endPointer);
      imageWrapper.addEventListener('pointercancel', endPointer);
      imageWrapper.addEventListener('pointerleave', endPointer);
      imageWrapper.addEventListener('wheel', (e) => {
        if (currentView !== 'image') return;
        e.preventDefault();
        const rect = imageWrapper.getBoundingClientRect();
        setScale(scale * (e.deltaY > 0 ? 0.92 : 1.08), e.clientX - rect.left, e.clientY - rect.top);
      }, { passive: false });
      imageWrapper.addEventListener('dblclick', fitImage);

      byId('zoomIn').addEventListener('click', () => setScale(scale * 1.18));
      byId('zoomOut').addEventListener('click', () => setScale(scale * 0.82));

      let switchDrag = null;
      function clampSwitchPosition(x, y) {
        const parent = switchViewBtn.parentElement.getBoundingClientRect();
        const rect = switchViewBtn.getBoundingClientRect();
        return {
          x: clamp(x, 6, parent.width - rect.width - 6),
          y: clamp(y, 6, parent.height - rect.height - 6)
        };
      }
      switchViewBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const rect = switchViewBtn.getBoundingClientRect();
        const parent = switchViewBtn.parentElement.getBoundingClientRect();
        switchDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, left: rect.left - parent.left, top: rect.top - parent.top, moved: false };
        switchViewBtn.setPointerCapture?.(e.pointerId);
      });
      switchViewBtn.addEventListener('pointermove', (e) => {
        if (!switchDrag || switchDrag.id !== e.pointerId) return;
        const dx = e.clientX - switchDrag.sx;
        const dy = e.clientY - switchDrag.sy;
        if (!switchDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        switchDrag.moved = true;
        const pos = clampSwitchPosition(switchDrag.left + dx, switchDrag.top + dy);
        switchViewBtn.style.left = `${pos.x}px`;
        switchViewBtn.style.top = `${pos.y}px`;
        switchViewBtn.style.right = 'auto';
        switchViewBtn.style.bottom = 'auto';
        switchViewBtn.classList.add('dragging');
      });
      switchViewBtn.addEventListener('pointerup', (e) => {
        if (!switchDrag || switchDrag.id !== e.pointerId) return;
        const moved = switchDrag.moved;
        switchDrag = null;
        switchViewBtn.classList.remove('dragging');
        if (!moved) switchView();
      });
      switchViewBtn.addEventListener('pointercancel', () => {
        switchDrag = null;
        switchViewBtn.classList.remove('dragging');
      });

      byId('singlePlayerBtn').addEventListener('click', () => {
        const hasSave = !!loadGameState();
        byId('modalQuestion').textContent = hasSave
          ? 'Хотите начать новую игру или продолжить сохранённую?'
          : 'Сохранённая игра не найдена. Начать новую?';

        const modalButtons = byId('modalButtons');
        modalButtons.innerHTML = '';

        const newBtn = document.createElement('button');
        newBtn.className = 'modal-btn';
        newBtn.textContent = hasSave ? 'Новая игра' : 'Начать игру';
        newBtn.onclick = () => { byId('gameModeModal').classList.add('hidden'); startGame(false, 'single'); };
        modalButtons.appendChild(newBtn);

        if (hasSave) {
          const contBtn = document.createElement('button');
          contBtn.className = 'modal-btn';
          contBtn.textContent = 'Продолжить';
          contBtn.onclick = () => { byId('gameModeModal').classList.add('hidden'); startGame(true, 'single'); };
          modalButtons.appendChild(contBtn);
        }

        byId('gameModeModal').classList.remove('hidden');
      });

      byId('multiPlayerBtn').addEventListener('click', () => {
        const profile = loadPlayerProfile();
        byId('playerNameInput').value = profile?.name || '';
        byId('playerOrgSelect').value = profile?.org || 'Не указано';
        byId('playerCourseInput').value = profile?.course || '';
        byId('playerGroupInput').value = profile?.group || '';
        byId('playerDataModal').classList.remove('hidden');
      });
      byId('startMultiBtn').addEventListener('click', () => {
        const name = byId('playerNameInput').value.trim();
        if (!name) return alert('Введите ФИО или никнейм.');
        currentPlayer = {
          name,
          org: byId('playerOrgSelect').value || 'Не указано',
          course: byId('playerCourseInput').value.trim(),
          group: byId('playerGroupInput').value.trim()
        };
        savePlayerProfile(currentPlayer);
        byId('playerDataModal').classList.add('hidden');
        clearGameState();
        startGame(false, 'multi');
      });

      byId('menuLeaderboardBtn').addEventListener('click', () => {
        byId('menuScreen').classList.add('hidden');
        byId('leaderboardScreen').classList.remove('hidden');
        renderLeaderboard();
      });
      byId('backFromLeaderboardBtn').addEventListener('click', () => {
        byId('leaderboardScreen').classList.add('hidden');
        byId('menuScreen').classList.remove('hidden');
      });

      // Tab switching
      document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          lbActiveTab = tab.dataset.tab;
          // Reset filters
          lbOrgFilter.value = '';
          lbCourseFilter.value = '';
          lbGroupFilter.value = '';
          renderLeaderboard();
        });
      });

      lbOrgFilter.addEventListener('change', renderLeaderboard);
      lbCourseFilter.addEventListener('input', renderLeaderboard);
      lbGroupFilter.addEventListener('input', renderLeaderboard);

      byId('closeGameModeModal').addEventListener('click', () => byId('gameModeModal').classList.add('hidden'));
      byId('closePlayerDataModal').addEventListener('click', () => byId('playerDataModal').classList.add('hidden'));
      byId('helpBtn').addEventListener('click', () => byId('rulesModal').classList.remove('hidden'));
      byId('closeRulesModal').addEventListener('click', () => byId('rulesModal').classList.add('hidden'));
      byId('closeRulesBtn').addEventListener('click', () => byId('rulesModal').classList.add('hidden'));
      byId('closeFinalModal').addEventListener('click', () => byId('finalModal').classList.add('hidden'));

      byId('backToMenuBtn').addEventListener('click', () => {
        byId('gameScreen').classList.add('hidden');
        byId('menuScreen').classList.remove('hidden');
        byId('leaderboardScreen').classList.add('hidden');
        byId('gameModeModal').classList.add('hidden');
        byId('playerDataModal').classList.add('hidden');
        byId('finalModal').classList.add('hidden');
        map?.destroy(); map = null;
        splitMap?.destroy(); splitMap = null;
        selectorMap?.destroy(); selectorMap = null;
      });

      window.addEventListener('resize', () => {
        requestAnimationFrame(() => {
          if (!byId('gameScreen').classList.contains('hidden')) {
            if (currentView === 'image' && !questionAnswered) fitImage();
            map?.container.fitToViewport();
            splitMap?.container.fitToViewport();
            selectorMap?.container.fitToViewport();
            updateMobileResultLayout();
            updateSplitImagePreview();
          }
        });
      });
      window.visualViewport?.addEventListener('resize', () => {
        requestAnimationFrame(() => {
          if (!byId('gameScreen').classList.contains('hidden')) {
            updateMobileResultLayout();
            updateSplitImagePreview();
            splitMap?.container.fitToViewport();
          }
        });
      });
      populateOrgSelects();
      currentPlayer = loadPlayerProfile();
})();