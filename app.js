/**
 * Verses — Scripture 4-Way Swipe & t-SNE Explorer
 * Built with vanilla HTML/CSS/JS using data/scriptures_sub.csv
 */

(() => {
  'use strict';

  // Volume classification for the 87 books in scriptures_sub.csv
  const VOLUME_RANGES = [
    { name: 'Old Testament', startBook: 'Genesis', endBook: 'Malachi' },
    { name: 'New Testament', startBook: 'Matthew', endBook: 'Revelation' },
    { name: 'Book of Mormon', startBook: '1 Nephi', endBook: 'Moroni' },
    { name: 'Doctrine and Covenants', startBook: 'Doctrine and Covenants', endBook: 'Doctrine and Covenants' },
    { name: 'Pearl of Great Price', startBook: 'Moses', endBook: 'Articles of Faith' }
  ];

  const VOLUME_COLORS = {
    'Old Testament': '#3b82f6',
    'New Testament': '#f59e0b',
    'Book of Mormon': '#10b981',
    'Doctrine and Covenants': '#8b5cf6',
    'Pearl of Great Price': '#ec4899'
  };

  // Application State
  const state = {
    loaded: false,
    verses: [],          // Array of { index, book, volume, chapter, verse, ref, shortRef, text, x, y, cluster }
    xs: null,            // Float32Array of shifted tsne_x
    ys: null,            // Float32Array of shifted tsne_y
    books: [],           // Array of { name, volume, chapters: Map<number, Array<verseObj>> }
    bookMap: new Map(),  // bookName -> bookObj
    refMap: new Map(),   // normalized ref string -> verse index
    stories: [],         // Array of { title, shortTitle, summary, startRef, turningRef, endRef, startIdx, turningIdx, endIdx, volume }

    // Navigation state
    anchorIndex: 26136,  // Default: John 3:16
    top50: [],           // Array of { index, distance, rank } for current anchorIndex
    simRank: 0,          // 0 = Anchor verse itself, 1..50 = closest neighbors by t-SNE distance
    activeView: 'read',  // 'read' | 'select' | 'similar' | 'map' | 'about'

    // Picker state
    pickerVolume: 'all',
    pickerBook: 'John',
    pickerChapter: 3,
    pickerVerse: 16,

    // Map state
    mapTransform: { x: 0, y: 0, k: 1 },
    mapInspectedIndex: 26136,
    mapHoveredStory: null,
    mapColorMode: 'highlight',
    xMin: 0,
    xMax: 140,
    yMin: 0,
    yMax: 120,

    // Preferences (default swipeMode is 'natural' / Page Flip: Swipe Left = Next Verse)
    swipeMode: localStorage.getItem('verses_swipe_mode_v2') || 'natural', // 'natural' (Left=+1) | 'direct' (Right=+1)
    fontSize: localStorage.getItem('verses_font_size') || 'md',
    theme: localStorage.getItem('verses_theme') || 'auto'
  };

  // DOM Elements Cache
  const els = {
    headerStatus: document.getElementById('header-status'),
    randomHeaderBtn: document.getElementById('random-verse-header-btn'),
    shortcutsBtn: document.getElementById('shortcuts-btn'),
    shortcutsDialog: document.getElementById('shortcuts-dialog'),

    // Views & Bottom Nav
    views: {
      read: document.getElementById('view-read'),
      select: document.getElementById('view-select'),
      similar: document.getElementById('view-similar'),
      map: document.getElementById('view-map'),
      about: document.getElementById('view-about')
    },
    navButtons: Array.from(document.querySelectorAll('.bottom-nav-item')),

    // Read / Swipe View
    anchorInlineActions: document.getElementById('anchor-inline-actions'),
    returnAnchorBtn: document.getElementById('return-anchor-btn'),
    makeAnchorBtn: document.getElementById('make-anchor-btn'),

    swipeStage: document.getElementById('swipe-stage'),
    scriptureCard: document.getElementById('scripture-card'),
    gestureBadge: document.getElementById('gesture-badge'),
    cardVolume: document.getElementById('card-volume'),
    cardStoryBadge: document.getElementById('card-story-badge'),
    cardCluster: document.getElementById('card-cluster'),
    cardReference: document.getElementById('card-reference'),
    cardChangeRefBtn: document.getElementById('card-change-ref-btn'),
    cardSimilarityStatus: document.getElementById('card-similarity-status'),
    cardBody: document.getElementById('card-body'),
    cardText: document.getElementById('card-text'),
    cardCoords: document.getElementById('card-coords'),
    cardViewSimilarBtn: document.getElementById('card-view-similar-btn'),
    cardViewMapBtn: document.getElementById('card-view-map-btn'),

    // Compass Controls
    btnSwipeLeft: document.getElementById('btn-swipe-left'),
    btnSwipeRight: document.getElementById('btn-swipe-right'),
    btnSwipeUp: document.getElementById('btn-swipe-up'),
    btnSwipeDown: document.getElementById('btn-swipe-down'),
    btnLeftRef: document.getElementById('btn-left-ref'),
    btnRightRef: document.getElementById('btn-right-ref'),
    btnUpType: document.getElementById('btn-up-type'),
    btnUpRef: document.getElementById('btn-up-ref'),
    btnDownType: document.getElementById('btn-down-type'),
    btnDownRef: document.getElementById('btn-down-ref'),

    // Select & Search View
    panelBrowse: document.getElementById('panel-browse'),
    volFilterBtns: Array.from(document.querySelectorAll('.vol-filter-btn')),
    selectBook: document.getElementById('select-book'),
    selectChapter: document.getElementById('select-chapter'),
    selectVerse: document.getElementById('select-verse'),
    bookPillList: document.getElementById('book-pill-list'),
    chapterPillList: document.getElementById('chapter-pill-list'),
    versePillList: document.getElementById('verse-pill-list'),
    pickerPreviewRef: document.getElementById('picker-preview-ref'),
    pickerPreviewText: document.getElementById('picker-preview-text'),
    pickerGoBtn: document.getElementById('picker-go-btn'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    searchSubmitBtn: document.getElementById('search-submit-btn'),
    searchMeta: document.getElementById('search-meta'),
    searchResultsList: document.getElementById('search-results-list'),
    storiesSectionTitle: document.getElementById('stories-section-title'),
    storiesListMeta: document.getElementById('stories-list-meta'),
    storiesScrollList: document.getElementById('stories-scroll-list'),

    // Similar View
    similarAnchorTitle: document.getElementById('similar-anchor-title'),
    excludeSameBookToggle: document.getElementById('exclude-same-book-toggle'),
    similarList: document.getElementById('similar-list'),

    // Map View
    mapFocusBtn: document.getElementById('map-focus-neighborhood-btn'),
    mapResetBtn: document.getElementById('map-reset-zoom-btn'),
    mapColorMode: document.getElementById('map-color-mode'),
    mapWrapper: document.getElementById('map-canvas-wrapper'),
    canvas: document.getElementById('tsne-canvas'),
    mapInspectorBadge: document.getElementById('map-inspector-badge'),
    mapInspectorRef: document.getElementById('map-inspector-ref'),
    mapInspectorCoords: document.getElementById('map-inspector-coords'),
    mapInspectorText: document.getElementById('map-inspector-text'),
    mapInspectorOpenBtn: document.getElementById('map-inspector-open-btn'),
    spatialUpBtn: document.getElementById('spatial-up-btn'),
    spatialDownBtn: document.getElementById('spatial-down-btn'),
    spatialLeftBtn: document.getElementById('spatial-left-btn'),
    spatialRightBtn: document.getElementById('spatial-right-btn'),

    // Settings
    settingSwipeMode: document.getElementById('setting-swipe-mode'),
    settingFontSize: document.getElementById('setting-font-size'),
    settingTheme: document.getElementById('setting-theme')
  };

  /* ========================================================================
     1. DIRECTIONAL VIEW TRANSITION HELPER (modern-web-guidance)
     ======================================================================== */
  function navigateWithTransition(updateDOM, directionType) {
    if (!directionType || !document.startViewTransition) {
      updateDOM();
      return;
    }
    try {
      document.startViewTransition({
        update: updateDOM,
        types: [directionType]
      });
    } catch {
      updateDOM();
    }
  }

  /* ========================================================================
     2. FAST CSV PARSER & DATA INITIALIZATION
     ======================================================================== */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < len && text[i + 1] === '\n') {
          i++;
        }
        row.push(field);
        field = '';
        if (row.length > 1) {
          rows.push(row);
        }
        row = [];
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      if (row.length > 1) rows.push(row);
    }
    return rows;
  }

  function resolveRefString(rawRef) {
    if (!rawRef) return undefined;
    let norm = String(rawRef).trim().replace(/\s+/g, ' ').toLowerCase();
    if (state.refMap.has(norm)) return state.refMap.get(norm);

    // Handle common book name shorthand in case user adds custom rows to scripture_stories.csv
    norm = norm
      .replace(/^d&c\s+/, 'doctrine and covenants ')
      .replace(/^psalm\s+/, 'psalms ')
      .replace(/^js[—–-]?h(?:istory)?\s+/, 'joseph smith--history ')
      .replace(/^song of solomon\s+/, 'song ofuet ') // fallback check
      .trim();
    return state.refMap.get(norm);
  }

  function abbreviateStoryTitle(title, maxLen = 28) {
    const clean = String(title || '').trim();
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return `${lastSpace > 12 ? cut.slice(0, lastSpace) : cut}…`;
  }

  async function loadStoriesCSV() {
    try {
      const response = await fetch('data/scripture_stories.csv', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading data/scripture_stories.csv`);
      }
      const csvText = await response.text();
      const rawRows = parseCSV(csvText);
      if (rawRows.length <= 1) return;

      // Header: story_title,story_summary,starting_verse,turning_point_verse,ending_verse
      const dataRows = rawRows.slice(1);
      const stories = [];

      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        if (!r || r.length < 3) continue;
        const title = (r[0] || '').trim();
        const summary = (r[1] || '').trim();
        const startRef = (r[2] || '').trim();
        const turningRef = (r[3] || startRef).trim();
        const endRef = (r[4] || turningRef || startRef).trim();
        if (!title || !startRef) continue;

        const rawStartIdx = resolveRefString(startRef);
        const rawTurningIdx = resolveRefString(turningRef) ?? rawStartIdx;
        const rawEndIdx = resolveRefString(endRef) ?? rawTurningIdx ?? rawStartIdx;

        if (rawStartIdx === undefined) continue;

        const startIdx = Math.min(rawStartIdx, rawEndIdx);
        const endIdx = Math.max(rawStartIdx, rawEndIdx);
        const turningIdx = rawTurningIdx ?? startIdx;
        const volume = state.verses[startIdx]?.volume || '';

        stories.push({
          id: `story-${i}`,
          title,
          shortTitle: abbreviateStoryTitle(title, 30),
          summary,
          startRef: state.verses[startIdx]?.ref || startRef,
          turningRef: state.verses[turningIdx]?.ref || turningRef,
          endRef: state.verses[endIdx]?.ref || endRef,
          startIdx,
          turningIdx,
          endIdx,
          volume
        });
      }

      state.stories = stories;
      renderStoriesScrollList();
      renderReadView();
      if (state.activeView === 'map') renderMap();
    } catch (err) {
      console.error('Error loading data/scripture_stories.csv:', err);
      if (els.storiesListMeta) {
        els.storiesListMeta.textContent = 'Could not load data/scripture_stories.csv';
      }
    }
  }

  async function loadScriptures() {
    try {
      const response = await fetch('data/scriptures_sub.csv');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading data/scriptures_sub.csv`);
      }
      const csvText = await response.text();
      const rawRows = parseCSV(csvText);

      // Header row is index 0: [, book_title, chapter_number, verse_number, verse_short_title, scripture_text, tsne_x, tsne_y, cluster]
      const dataRows = rawRows.slice(1);
      const count = dataRows.length;

      const rawX = new Float32Array(count);
      const rawY = new Float32Array(count);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      // Determine volume per book
      let volIdx = 0;
      const bookVolumeLookup = new Map();

      const verses = new Array(count);
      for (let i = 0; i < count; i++) {
        const r = dataRows[i];
        const book = r[1];
        const chapter = parseInt(r[2], 10);
        const verse = parseInt(r[3], 10);
        const shortRef = r[4];
        const text = r[5];
        const x = parseFloat(r[6]);
        const y = parseFloat(r[7]);
        const cluster = parseInt(r[8], 10) || 0;

        rawX[i] = x;
        rawY[i] = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        let volume = bookVolumeLookup.get(book);
        if (!volume) {
          volume = VOLUME_RANGES[volIdx].name;
          bookVolumeLookup.set(book, volume);
          if (book === VOLUME_RANGES[volIdx].endBook && volIdx < VOLUME_RANGES.length - 1) {
            volIdx++;
          }
        }

        const ref = `${book} ${chapter}:${verse}`;
        const vObj = {
          index: i,
          book,
          volume,
          chapter,
          verse,
          ref,
          shortRef,
          text,
          x: 0,
          y: 0,
          cluster
        };
        verses[i] = vObj;

        state.refMap.set(ref.toLowerCase(), i);
        state.refMap.set(shortRef.toLowerCase(), i);

        let bookEntry = state.bookMap.get(book);
        if (!bookEntry) {
          bookEntry = { name: book, volume, chapters: new Map() };
          state.bookMap.set(book, bookEntry);
          state.books.push(bookEntry);
        }
        let chapList = bookEntry.chapters.get(chapter);
        if (!chapList) {
          chapList = [];
          bookEntry.chapters.set(chapter, chapList);
        }
        chapList.push(vObj);
      }

      // Shift tsne_x and tsne_y to positive values (matching applet.py lines 24-25)
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const sx = rawX[i] - minX;
        const sy = rawY[i] - minY;
        xs[i] = sx;
        ys[i] = sy;
        verses[i].x = sx;
        verses[i].y = sy;
      }

      state.verses = verses;
      state.xs = xs;
      state.ys = ys;
      state.xMin = 0;
      state.xMax = maxX - minX;
      state.yMin = 0;
      state.yMax = maxY - minY;
      state.loaded = true;

      els.headerStatus.textContent = `${count.toLocaleString()} scriptures • t-SNE 2D`;

      // Check initial URL hash or default to John 3:16
      const initialIndex = resolveHashToIndex() ?? state.refMap.get('john 3:16') ?? 0;
      setAnchorVerse(initialIndex, null);
      populatePickerData();
      await loadStoriesCSV();
    } catch (err) {
      console.error(err);
      els.headerStatus.textContent = 'Error loading scripture dataset';
      els.cardText.textContent = 'Could not load data/scriptures_sub.csv. Please ensure the page is served via HTTP.';
    }
  }

  /* ========================================================================
     3. t-SNE DISTANCE CALCULATION & NAVIGATION LOGIC
     ======================================================================== */
  function computeTopSimilar(anchorIdx, limit = 50) {
    const xs = state.xs;
    const ys = state.ys;
    const ax = xs[anchorIdx];
    const ay = ys[anchorIdx];
    const n = xs.length;

    // Maintain a bounded max-heap or fast partial sort for top `limit`
    // Since N=41,995, scanning all distances and keeping top 50 threshold takes < 0.3ms
    const top = [];
    let maxTopDistSq = Infinity;

    for (let i = 0; i < n; i++) {
      const dx = xs[i] - ax;
      const dy = ys[i] - ay;
      const dSq = dx * dx + dy * dy;

      if (top.length < limit) {
        top.push({ index: i, dSq });
        if (top.length === limit) {
          top.sort((a, b) => a.dSq - b.dSq);
          maxTopDistSq = top[limit - 1].dSq;
        }
      } else if (dSq < maxTopDistSq) {
        top[limit - 1] = { index: i, dSq };
        // Insertion bubble to keep sorted
        for (let j = limit - 1; j > 0 && top[j].dSq < top[j - 1].dSq; j--) {
          const tmp = top[j];
          top[j] = top[j - 1];
          top[j - 1] = tmp;
        }
        maxTopDistSq = top[limit - 1].dSq;
      }
    }

    // Ensure anchorIdx itself is at rank 0
    top.sort((a, b) => (a.index === anchorIdx ? -1 : b.index === anchorIdx ? 1 : a.dSq - b.dSq));

    return top.map((item, rank) => ({
      index: item.index,
      distance: Math.sqrt(item.dSq),
      rank
    }));
  }

  function getCurrentVerseIndex() {
    if (!state.top50.length) return state.anchorIndex;
    return state.top50[state.simRank]?.index ?? state.anchorIndex;
  }

  /**
   * Sets a new Anchor Verse (resets similarity rank to 0 and computes Top 50)
   */
  function setAnchorVerse(index, transitionType = null) {
    if (!state.loaded) return;
    const count = state.verses.length;
    const clamped = ((index % count) + count) % count;

    const applyUpdate = () => {
      state.anchorIndex = clamped;
      state.simRank = 0;
      state.top50 = computeTopSimilar(clamped, 80); // Compute 80 so "Different book only" filter still has 50
      state.mapInspectedIndex = clamped;
      syncURLHash(clamped);
      renderReadView();
      if (state.activeView === 'similar') renderSimilarView();
      if (state.activeView === 'map') {
        focusMapOnNeighborhood();
        renderMap();
      }
    };

    navigateWithTransition(applyUpdate, transitionType);
  }

  /**
   * Moves along the current Anchor's t-SNE similarity list
   */
  function setSimilarityRank(newRank, transitionType = null) {
    if (!state.loaded || !state.top50.length) return;
    const clampedRank = Math.max(0, Math.min(50, newRank));
    if (clampedRank === state.simRank) return;

    const applyUpdate = () => {
      state.simRank = clampedRank;
      const currIdx = getCurrentVerseIndex();
      state.mapInspectedIndex = currIdx;
      renderReadView();
      if (state.activeView === 'similar') renderSimilarView();
      if (state.activeView === 'map') renderMap();
    };

    navigateWithTransition(applyUpdate, transitionType);
  }

  /**
   * Directional Targets
   * - Buttons: Left button is ALWAYS Prev Verse (-1), Right button is ALWAYS Next Verse (+1)
   * - 1-Finger Swipe: In default 'natural' (Page Flip) mode, Swipe Left = Next Verse (+1), Swipe Right = Prev Verse (-1)
   * - 2-Finger Swipe / Up & Down Buttons: Step through t-SNE similarity ranks (0 <-> 1 <-> ... <-> 50 <-> 0)
   */
  function getDirectionalTargets() {
    const count = state.verses.length;
    const currIdx = getCurrentVerseIndex();
    const nextChronIdx = (currIdx + 1) % count;
    const prevChronIdx = (currIdx - 1 + count) % count;

    const swipeRightIdx = state.swipeMode === 'direct' ? nextChronIdx : prevChronIdx;
    const swipeLeftIdx = state.swipeMode === 'direct' ? prevChronIdx : nextChronIdx;

    const upRank = state.simRank >= 50 ? 0 : state.simRank + 1;
    const downRank = state.simRank === 0 ? 50 : state.simRank - 1;

    return {
      nextChronVerse: state.verses[nextChronIdx],
      prevChronVerse: state.verses[prevChronIdx],
      swipeRightVerse: state.verses[swipeRightIdx],
      swipeLeftVerse: state.verses[swipeLeftIdx],
      upItem: state.top50[upRank] || state.top50[0],
      downItem: state.top50[downRank] || state.top50[0],
      upRank,
      downRank
    };
  }

  function handleNextChron() {
    const { nextChronVerse } = getDirectionalTargets();
    if (nextChronVerse) setAnchorVerse(nextChronVerse.index, 'swipe-left');
  }

  function handlePrevChron() {
    const { prevChronVerse } = getDirectionalTargets();
    if (prevChronVerse) setAnchorVerse(prevChronVerse.index, 'swipe-right');
  }

  function handleSwipeRight() {
    const { swipeRightVerse } = getDirectionalTargets();
    if (swipeRightVerse) setAnchorVerse(swipeRightVerse.index, 'swipe-right');
  }

  function handleSwipeLeft() {
    const { swipeLeftVerse } = getDirectionalTargets();
    if (swipeLeftVerse) setAnchorVerse(swipeLeftVerse.index, 'swipe-left');
  }

  function handleSwipeUp() {
    const { upRank } = getDirectionalTargets();
    setSimilarityRank(upRank, 'swipe-up');
  }

  function handleSwipeDown() {
    const { downRank } = getDirectionalTargets();
    setSimilarityRank(downRank, 'swipe-down');
  }

  /* ========================================================================
     4. RENDER READ / SWIPE VIEW
     ======================================================================== */
  function renderReadView() {
    if (!state.loaded) return;
    const currIdx = getCurrentVerseIndex();
    const curr = state.verses[currIdx];
    const anchor = state.verses[state.anchorIndex];
    const currentSimItem = state.top50[state.simRank];

    // Card header & body
    els.cardVolume.textContent = curr.volume;
    els.cardCluster.textContent = `Cluster ${curr.cluster}`;
    els.cardReference.textContent = curr.ref;
    els.cardText.textContent = curr.text;
    els.cardCoords.textContent = `t-SNE: (${curr.x.toFixed(2)}, ${curr.y.toFixed(2)})`;
    els.cardBody.scrollTop = 0;

    // Story label (abbreviated Story Title) when current verse is part of a story
    if (els.cardStoryBadge) {
      const activeStory = state.stories.find(
        (s) => s.startIdx !== undefined && s.endIdx !== undefined && currIdx >= s.startIdx && currIdx <= s.endIdx
      );
      if (activeStory) {
        els.cardStoryBadge.hidden = false;
        els.cardStoryBadge.textContent = `📖 ${activeStory.shortTitle}`;
        els.cardStoryBadge.title = `${activeStory.title} (${activeStory.startRef} – ${activeStory.endRef})`;
        els.cardStoryBadge.dataset.storyStartIdx = String(activeStory.startIdx);
      } else {
        els.cardStoryBadge.hidden = true;
        delete els.cardStoryBadge.dataset.storyStartIdx;
      }
    }

    // Compact inline similarity status inside card header (no separate top banner)
    if (state.simRank === 0) {
      if (els.anchorInlineActions) els.anchorInlineActions.hidden = true;
      els.cardSimilarityStatus.textContent = 'Anchor • 2-finger swipe ↔ or tap ↑/↓ for similar';
    } else {
      if (els.anchorInlineActions) els.anchorInlineActions.hidden = false;
      els.cardSimilarityStatus.textContent = `Similar #${state.simRank}/50 to ${anchor.shortRef} (Δ ${currentSimItem.distance.toFixed(2)})`;
    }

    // Update 4-way compass buttons: Left is ALWAYS Prev Verse, Right is ALWAYS Next Verse
    const { nextChronVerse, prevChronVerse, upItem, downItem, upRank, downRank } = getDirectionalTargets();
    const upVerse = state.verses[upItem.index];
    const downVerse = state.verses[downItem.index];

    els.btnSwipeLeft.querySelector('.compass-type').textContent = 'Prev Verse';
    els.btnLeftRef.textContent = prevChronVerse.shortRef;

    els.btnSwipeRight.querySelector('.compass-type').textContent = 'Next Verse';
    els.btnRightRef.textContent = nextChronVerse.shortRef;

    els.btnUpType.textContent = upRank === 0 ? 'Back to Anchor' : `Closest #${upRank} (t-SNE)`;
    els.btnUpRef.textContent = upVerse.shortRef;

    els.btnDownType.textContent = downRank === 0 ? 'Back to Anchor' : `Closest #${downRank} (t-SNE)`;
    els.btnDownRef.textContent = downVerse.shortRef;
  }

  /* ========================================================================
     5. INTERACTIVE 1-FINGER & 2-FINGER SWIPE ENGINE
     ======================================================================== */
  function setupSwipeGestures() {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let lockedAxis = null; // 'x' | 'y' | null
    let pointerId = null;

    // 2-Finger Touch State (for similar scriptures on mobile)
    let wasTwoFingerGesture = false;
    let twoFingerTriggered = false;
    let twoFingerStartX = 0;
    let twoFingerLastDx = 0;

    const SWIPE_THRESHOLD = 46;
    const TWO_FINGER_THRESHOLD = 38;
    const LOCK_THRESHOLD = 10;

    function resetCardPosition() {
      els.scriptureCard.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      els.scriptureCard.style.transform = '';
      els.gestureBadge.hidden = true;
    }

    // --- A. Two-Finger Horizontal Touch Swipe (Similar Scriptures) ---
    els.scriptureCard.addEventListener('touchstart', (e) => {
      if (e.touches.length >= 2) {
        wasTwoFingerGesture = true;
        twoFingerTriggered = false;
        isDragging = false;
        lockedAxis = null;
        twoFingerStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        twoFingerLastDx = 0;
        els.scriptureCard.style.transition = 'none';
      }
    }, { passive: true });

    els.scriptureCard.addEventListener('touchmove', (e) => {
      if (!wasTwoFingerGesture || e.touches.length < 2) return;

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const dx = midX - twoFingerStartX;
      twoFingerLastDx = dx;

      if (Math.abs(dx) > 6) {
        e.preventDefault();
      }

      const moveX = dx * 0.65;
      els.scriptureCard.style.transform = `translate3d(${moveX}px, 0, 0)`;

      if (Math.abs(dx) > 16) {
        const { upItem, downItem, upRank, downRank } = getDirectionalTargets();
        const isNextSim = state.swipeMode === 'natural' ? dx < 0 : dx > 0;
        const targetRank = isNextSim ? upRank : downRank;
        const targetItem = isNextSim ? upItem : downItem;
        const targetVerse = state.verses[targetItem.index];

        els.gestureBadge.hidden = false;
        els.gestureBadge.classList.add('is-similarity');
        els.gestureBadge.textContent = targetRank === 0
          ? `✌️ Anchor: ${targetVerse.ref}`
          : `✌️ Closest #${targetRank}: ${targetVerse.ref} (Δ ${targetItem.distance.toFixed(2)})`;
      } else {
        els.gestureBadge.hidden = true;
      }
    }, { passive: false });

    function handleTwoFingerEnd(e) {
      if (!wasTwoFingerGesture) return;

      if (!twoFingerTriggered && Math.abs(twoFingerLastDx) >= TWO_FINGER_THRESHOLD) {
        twoFingerTriggered = true;
        const dx = twoFingerLastDx;
        resetCardPosition();
        const isNextSim = state.swipeMode === 'natural' ? dx < 0 : dx > 0;
        if (isNextSim) {
          handleSwipeUp();
        } else {
          handleSwipeDown();
        }
      } else if (e.touches.length === 0) {
        resetCardPosition();
      }

      if (e.touches.length === 0) {
        wasTwoFingerGesture = false;
        twoFingerTriggered = false;
        twoFingerLastDx = 0;
      }
    }

    els.scriptureCard.addEventListener('touchend', handleTwoFingerEnd);
    els.scriptureCard.addEventListener('touchcancel', handleTwoFingerEnd);

    // --- B. Single-Finger / Pointer Horizontal Swipe & Vertical Scroll ---
    let startScrollTop = 0;
    let startedInsideBody = false;

    els.scriptureCard.addEventListener('pointerdown', (e) => {
      if (wasTwoFingerGesture) return;
      if (e.target.closest('button, a')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      isDragging = true;
      lockedAxis = null;
      startX = e.clientX;
      startY = e.clientY;
      currentX = 0;
      startScrollTop = els.cardBody.scrollTop;
      startedInsideBody = Boolean(e.target.closest('#card-body'));
      pointerId = e.pointerId;
      els.scriptureCard.style.transition = 'none';
    });

    els.scriptureCard.addEventListener('pointermove', (e) => {
      if (wasTwoFingerGesture || !isDragging || e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!lockedAxis) {
        if (Math.abs(dx) > LOCK_THRESHOLD || Math.abs(dy) > LOCK_THRESHOLD) {
          // Favor vertical scrolling unless gesture is clearly horizontal
          lockedAxis = Math.abs(dx) > Math.abs(dy) * 1.35 ? 'x' : 'y';
          if (lockedAxis === 'x' && e.pointerType === 'mouse') {
            try {
              els.scriptureCard.setPointerCapture(pointerId);
            } catch {
              // Ignore if pointer capture is unavailable
            }
          }
        } else {
          return;
        }
      }

      // If dragging vertically with 1 finger or mouse:
      // - Native pan-y handles touch scrolling inside #card-body
      // - Mouse drag or touch drag started outside #card-body scrolls #card-body directly
      if (lockedAxis === 'y') {
        if (e.pointerType === 'mouse' || !startedInsideBody) {
          els.cardBody.scrollTop = startScrollTop - dy;
        }
        return;
      }

      // Apply damped horizontal drag movement
      currentX = dx * 0.65;
      const rotateDeg = currentX * 0.025;
      els.scriptureCard.style.transform = `translate3d(${currentX}px, 0, 0) rotate(${rotateDeg}deg)`;

      const { swipeRightVerse, swipeLeftVerse } = getDirectionalTargets();
      if (Math.abs(dx) > 20) {
        els.gestureBadge.hidden = false;
        els.gestureBadge.classList.remove('is-similarity');
        if (dx > 0) {
          const actionWord = state.swipeMode === 'direct' ? 'Next Verse' : 'Prev Verse';
          els.gestureBadge.textContent = `${actionWord}: ${swipeRightVerse.ref} →`;
        } else {
          const actionWord = state.swipeMode === 'direct' ? 'Prev Verse' : 'Next Verse';
          els.gestureBadge.textContent = `← ${actionWord}: ${swipeLeftVerse.ref}`;
        }
      } else {
        els.gestureBadge.hidden = true;
      }
    });

    function endGesture(e) {
      if (wasTwoFingerGesture) {
        isDragging = false;
        lockedAxis = null;
        pointerId = null;
        return;
      }
      if (!isDragging || (e && e.pointerId !== pointerId)) return;
      isDragging = false;
      try {
        if (pointerId !== null && els.scriptureCard.hasPointerCapture(pointerId)) {
          els.scriptureCard.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore if pointer capture was already released
      }

      const dx = e.clientX - startX;
      resetCardPosition();

      if (lockedAxis === 'x' && Math.abs(dx) >= SWIPE_THRESHOLD) {
        if (dx > 0) {
          handleSwipeRight();
        } else {
          handleSwipeLeft();
        }
      }
      lockedAxis = null;
      pointerId = null;
    }

    els.scriptureCard.addEventListener('pointerup', endGesture);
    els.scriptureCard.addEventListener('pointercancel', endGesture);

    // Compass buttons: Left button is ALWAYS Prev Verse, Right button is ALWAYS Next Verse
    els.btnSwipeLeft.addEventListener('click', handlePrevChron);
    els.btnSwipeRight.addEventListener('click', handleNextChron);
    els.btnSwipeUp.addEventListener('click', handleSwipeUp);
    els.btnSwipeDown.addEventListener('click', handleSwipeDown);

    // Inline anchor action buttons inside card header
    els.returnAnchorBtn.addEventListener('click', () => setSimilarityRank(0, 'swipe-down'));
    els.makeAnchorBtn.addEventListener('click', () => {
      const currIdx = getCurrentVerseIndex();
      setAnchorVerse(currIdx, null);
    });

    // Keyboard navigation when in Read view and not typing in an input
    window.addEventListener('keydown', (e) => {
      if (state.activeView !== 'read') return;
      if (els.shortcutsDialog.open) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextChron();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevChron();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleSwipeUp();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleSwipeDown();
      }
    });
  }

  /* ========================================================================
     6. SELECT & SEARCH VIEW
     ======================================================================== */
  let searchDebounceTimer = null;

  function runSearch(jumpOnExactMatch = false) {
    const q = els.searchInput.value.trim();
    if (els.searchClearBtn) {
      els.searchClearBtn.hidden = q.length === 0;
    }

    if (!q) {
      els.searchMeta.textContent = 'Start typing to search all 41,995 verses and story summaries instantly, or press Enter to jump to a match.';
      els.searchResultsList.innerHTML = '';
      renderStoriesScrollList();
      return;
    }

    if (!state.loaded) {
      els.searchMeta.textContent = 'Loading scripture dataset…';
      return;
    }

    const lowerQ = q.toLowerCase().replace(/\s+/g, ' ');
    // Check direct reference match first (e.g. "1 nephi 12:4" or "1 ne. 12:4")
    const exactIdx = state.refMap.get(lowerQ);
    if (jumpOnExactMatch && exactIdx !== undefined) {
      setAnchorVerse(exactIdx, null);
      switchView('read');
      return;
    }

    const terms = lowerQ.split(/\s+/).filter(Boolean);

    // 1. Search Scripture Stories (matching story_summary, story_title, or story verse references)
    const storyMatches = [];
    for (let i = 0; i < state.stories.length; i++) {
      const s = state.stories[i];
      if (s.startIdx === undefined) continue;
      const haySummary = s.summary.toLowerCase();
      const hayTitle = s.title.toLowerCase();
      const hayRefs = `${s.startRef} ${s.turningRef} ${s.endRef}`.toLowerCase();
      let ok = true;
      for (let t = 0; t < terms.length; t++) {
        const term = terms[t];
        if (!haySummary.includes(term) && !hayTitle.includes(term) && !hayRefs.includes(term)) {
          ok = false;
          break;
        }
      }
      if (ok) storyMatches.push(s);
    }

    if (jumpOnExactMatch && storyMatches.length > 0 && exactIdx === undefined) {
      setAnchorVerse(storyMatches[0].startIdx, null);
      switchView('read');
      return;
    }

    // 2. Search individual Scripture Verses
    const matches = [];
    if (exactIdx !== undefined) {
      matches.push(state.verses[exactIdx]);
    }

    const allVerses = state.verses;
    const maxResults = 60;

    for (let i = 0; i < allVerses.length && matches.length < maxResults; i++) {
      if (i === exactIdx) continue;
      const v = allVerses[i];
      const hayRef = v.ref.toLowerCase();
      const hayShort = v.shortRef.toLowerCase();
      const hayText = v.text.toLowerCase();
      let ok = true;
      for (let t = 0; t < terms.length; t++) {
        const term = terms[t];
        if (!hayText.includes(term) && !hayRef.includes(term) && !hayShort.includes(term)) {
          ok = false;
          break;
        }
      }
      if (ok) matches.push(v);
    }

    // Report Scripture Search Results first in #search-results-list
    els.searchMeta.textContent = matches.length === 0
      ? `No individual scripture verses matched "${q}".`
      : `Matching Scriptures (${matches.length}${matches.length >= maxResults ? '+' : ''}) — click any scripture to open it`;

    els.searchResultsList.innerHTML = '';
    const frag = document.createDocumentFragment();

    matches.forEach((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'verse-list-card';
      btn.innerHTML = `
        <div class="verse-list-header">
          <span class="verse-list-title">${v.ref}</span>
          <div class="verse-list-badges">
            <span class="volume-pill">${v.volume}</span>
            <span class="cluster-pill">Cluster ${v.cluster}</span>
          </div>
        </div>
        <p class="verse-list-text">${v.text}</p>
      `;
      btn.addEventListener('click', () => {
        setAnchorVerse(v.index, null);
        switchView('read');
      });
      frag.appendChild(btn);
    });
    els.searchResultsList.appendChild(frag);

    // Report Story Search Results below that in #stories-scroll-list
    renderStoriesScrollList(storyMatches, q);
  }

  function renderStoriesScrollList(filteredStories = null, searchQuery = '') {
    if (!els.storiesScrollList) return;
    els.storiesScrollList.innerHTML = '';

    const isSearching = Boolean(searchQuery && filteredStories !== null);
    const displayedStories = isSearching ? filteredStories : state.stories;

    if (els.storiesSectionTitle) {
      els.storiesSectionTitle.textContent = isSearching
        ? `Matching Stories (${displayedStories.length})`
        : 'Scripture Stories';
    }

    if (!state.stories.length) {
      if (els.storiesListMeta) {
        els.storiesListMeta.textContent = 'No scripture stories found.';
      }
      return;
    }

    if (els.storiesListMeta) {
      if (isSearching) {
        els.storiesListMeta.textContent = displayedStories.length === 0
          ? `No scripture stories matched "${searchQuery}"`
          : `Filtered by "${searchQuery}" — click any story to open its starting verse`;
      } else {
        els.storiesListMeta.textContent = `${state.stories.length} stories — tap any story to open its starting verse`;
      }
    }

    const frag = document.createDocumentFragment();
    displayedStories.forEach((s) => {
      if (s.startIdx === undefined) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'verse-list-card story-list-card';
      btn.innerHTML = `
        <div class="verse-list-header">
          <span class="verse-list-title">${s.title}</span>
          <div class="verse-list-badges">
            <span class="story-badge-pill">📖 ${s.startRef} – ${s.endRef}</span>
            <span class="volume-pill">${s.volume}</span>
          </div>
        </div>
        <p class="verse-list-text story-summary-text">${s.summary}</p>
      `;
      btn.addEventListener('click', () => {
        setAnchorVerse(s.startIdx, null);
        switchView('read');
      });
      frag.appendChild(btn);
    });

    els.storiesScrollList.appendChild(frag);
  }

  function setupSelectAndSearchUI() {
    // Volume filter buttons
    els.volFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        els.volFilterBtns.forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        state.pickerVolume = btn.dataset.volume;
        if (!state.loaded) return;
        const filteredBooks = getFilteredBooks();
        if (filteredBooks.length && !filteredBooks.some((b) => b.name === state.pickerBook)) {
          state.pickerBook = filteredBooks[0].name;
          state.pickerChapter = 1;
          state.pickerVerse = 1;
        }
        renderPickerBooks();
        renderPickerChapters();
        renderPickerVerses();
        updatePickerPreview();
      });
    });

    // Native <select> dropdowns
    els.selectBook.addEventListener('change', () => {
      state.pickerBook = els.selectBook.value;
      state.pickerChapter = 1;
      state.pickerVerse = 1;
      renderPickerBooks();
      renderPickerChapters();
      renderPickerVerses();
      updatePickerPreview();
    });

    els.selectChapter.addEventListener('change', () => {
      state.pickerChapter = parseInt(els.selectChapter.value, 10);
      state.pickerVerse = 1;
      renderPickerChapters();
      renderPickerVerses();
      updatePickerPreview();
    });

    els.selectVerse.addEventListener('change', () => {
      state.pickerVerse = parseInt(els.selectVerse.value, 10);
      renderPickerVerses();
      updatePickerPreview();
    });

    // Open Selected Verse button
    els.pickerGoBtn.addEventListener('click', () => {
      if (!state.loaded) return;
      const refKey = `${state.pickerBook} ${state.pickerChapter}:${state.pickerVerse}`.toLowerCase();
      const idx = state.refMap.get(refKey);
      if (idx !== undefined) {
        setAnchorVerse(idx, null);
        switchView('read');
      }
    });

    // Featured Quick Jump chips
    document.querySelectorAll('[data-jump-ref]').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (!state.loaded) return;
        const ref = chip.dataset.jumpRef.toLowerCase();
        const idx = state.refMap.get(ref);
        if (idx !== undefined) {
          setAnchorVerse(idx, null);
          switchView('read');
        }
      });
    });

    // Live Search bar handlers
    els.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => runSearch(false), 90);
    });

    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchDebounceTimer);
        runSearch(true);
      }
    });

    els.searchSubmitBtn.addEventListener('click', () => {
      clearTimeout(searchDebounceTimer);
      runSearch(false);
    });

    if (els.searchClearBtn) {
      els.searchClearBtn.addEventListener('click', () => {
        els.searchInput.value = '';
        runSearch(false);
        els.searchInput.focus();
      });
    }
  }

  function populatePickerData() {
    if (!state.loaded) return;
    const curr = state.verses[getCurrentVerseIndex()];
    state.pickerBook = curr.book;
    state.pickerChapter = curr.chapter;
    state.pickerVerse = curr.verse;
    renderPickerBooks();
    renderPickerChapters();
    renderPickerVerses();
    updatePickerPreview();

    if (els.searchInput.value.trim()) {
      runSearch(false);
    }
  }

  function getFilteredBooks() {
    if (state.pickerVolume === 'all') return state.books;
    return state.books.filter((b) => b.volume === state.pickerVolume);
  }

  function renderPickerBooks() {
    const books = getFilteredBooks();
    els.selectBook.innerHTML = '';
    els.bookPillList.innerHTML = '';

    const fragSelect = document.createDocumentFragment();
    const fragPills = document.createDocumentFragment();

    books.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      if (b.name === state.pickerBook) opt.selected = true;
      fragSelect.appendChild(opt);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `picker-item-btn${b.name === state.pickerBook ? ' is-selected' : ''}`;
      btn.textContent = b.name;
      btn.addEventListener('click', () => {
        state.pickerBook = b.name;
        state.pickerChapter = 1;
        state.pickerVerse = 1;
        renderPickerBooks();
        renderPickerChapters();
        renderPickerVerses();
        updatePickerPreview();
      });
      fragPills.appendChild(btn);
    });

    els.selectBook.appendChild(fragSelect);
    els.bookPillList.appendChild(fragPills);
  }

  function renderPickerChapters() {
    const bookObj = state.bookMap.get(state.pickerBook);
    if (!bookObj) return;
    const chapters = Array.from(bookObj.chapters.keys());

    els.selectChapter.innerHTML = '';
    els.chapterPillList.innerHTML = '';

    const fragSelect = document.createDocumentFragment();
    const fragPills = document.createDocumentFragment();

    chapters.forEach((ch) => {
      const opt = document.createElement('option');
      opt.value = String(ch);
      opt.textContent = `Chapter ${ch}`;
      if (ch === state.pickerChapter) opt.selected = true;
      fragSelect.appendChild(opt);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `num-pill-btn${ch === state.pickerChapter ? ' is-selected' : ''}`;
      btn.textContent = String(ch);
      btn.addEventListener('click', () => {
        state.pickerChapter = ch;
        state.pickerVerse = 1;
        renderPickerChapters();
        renderPickerVerses();
        updatePickerPreview();
      });
      fragPills.appendChild(btn);
    });

    els.selectChapter.appendChild(fragSelect);
    els.chapterPillList.appendChild(fragPills);
  }

  function renderPickerVerses() {
    const bookObj = state.bookMap.get(state.pickerBook);
    const verses = bookObj?.chapters.get(state.pickerChapter) || [];

    els.selectVerse.innerHTML = '';
    els.versePillList.innerHTML = '';

    const fragSelect = document.createDocumentFragment();
    const fragPills = document.createDocumentFragment();

    verses.forEach((vObj) => {
      const vn = vObj.verse;
      const opt = document.createElement('option');
      opt.value = String(vn);
      opt.textContent = `Verse ${vn}`;
      if (vn === state.pickerVerse) opt.selected = true;
      fragSelect.appendChild(opt);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `num-pill-btn${vn === state.pickerVerse ? ' is-selected' : ''}`;
      btn.textContent = String(vn);
      btn.title = `Select ${vObj.ref} (double-click to open immediately)`;
      btn.addEventListener('click', () => {
        state.pickerVerse = vn;
        renderPickerVerses();
        updatePickerPreview();
      });
      btn.addEventListener('dblclick', () => {
        setAnchorVerse(vObj.index, null);
        switchView('read');
      });
      fragPills.appendChild(btn);
    });

    els.selectVerse.appendChild(fragSelect);
    els.versePillList.appendChild(fragPills);
  }

  function updatePickerPreview() {
    const refKey = `${state.pickerBook} ${state.pickerChapter}:${state.pickerVerse}`.toLowerCase();
    const idx = state.refMap.get(refKey);
    if (idx !== undefined) {
      const v = state.verses[idx];
      els.pickerPreviewRef.textContent = v.ref;
      els.pickerPreviewText.textContent = v.text;
      els.pickerGoBtn.textContent = `Open ${v.ref} →`;
    }
  }

  /* ========================================================================
     7. TOP 50 SIMILAR VIEW
     ======================================================================== */
  function renderSimilarView() {
    if (!state.loaded) return;
    const anchor = state.verses[state.anchorIndex];
    const currIdx = getCurrentVerseIndex();
    const excludeSameBook = els.excludeSameBookToggle.checked;

    els.similarAnchorTitle.textContent = anchor.ref;
    els.similarList.innerHTML = '';

    const filtered = state.top50.filter((item) => {
      if (!excludeSameBook || item.rank === 0) return true;
      return state.verses[item.index].book !== anchor.book;
    }).slice(0, 51);

    const frag = document.createDocumentFragment();
    filtered.forEach((item) => {
      const v = state.verses[item.index];
      const isCurrent = item.index === currIdx;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `verse-list-card${isCurrent ? ' is-current' : ''}`;

      const badgeLabel = item.rank === 0
        ? 'Anchor Verse'
        : `Closest #${item.rank} • Δ ${item.distance.toFixed(2)}`;

      btn.innerHTML = `
        <div class="verse-list-header">
          <span class="verse-list-title">${v.ref}</span>
          <div class="verse-list-badges">
            <span class="dist-pill">${badgeLabel}</span>
            <span class="volume-pill">${v.volume}</span>
            <span class="cluster-pill">Cluster ${v.cluster}</span>
          </div>
        </div>
        <p class="verse-list-text">${v.text}</p>
      `;

      btn.addEventListener('click', () => {
        if (item.rank <= 50) {
          setSimilarityRank(item.rank, null);
        } else {
          setAnchorVerse(item.index, null);
        }
        switchView('read');
      });

      frag.appendChild(btn);
    });

    els.similarList.appendChild(frag);
  }

  /* ========================================================================
     8. INTERACTIVE 2D t-SNE MAP VIEW (HTML5 Canvas)
     ======================================================================== */
  function setupMapInteractions() {
    const canvas = els.canvas;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let movedDuringPointer = false;

    function resizeCanvas() {
      if (state.activeView !== 'map') return;
      const rect = els.mapWrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      renderMap();
    }

    window.addEventListener('resize', resizeCanvas);

    els.mapFocusBtn.addEventListener('click', () => {
      focusMapOnNeighborhood();
      renderMap();
    });

    els.mapResetBtn.addEventListener('click', () => {
      resetMapZoom();
      renderMap();
    });

    els.mapColorMode.addEventListener('change', () => {
      state.mapColorMode = els.mapColorMode.value;
      renderMap();
    });

    els.mapInspectorOpenBtn.addEventListener('click', () => {
      if (state.mapInspectedIndex !== undefined) {
        setAnchorVerse(state.mapInspectedIndex, null);
        switchView('read');
      }
    });

    // Original applet.py spatial neighborhood jumps (Move Up/Down/Left/Right in Top 50)
    function moveSpatialExtreme(axis, mode) {
      if (!state.top50.length) return;
      const sub = state.top50.slice(0, 51);
      let bestIdx = sub[0].index;
      let bestVal = axis === 'x' ? state.xs[bestIdx] : state.ys[bestIdx];

      for (let i = 1; i < sub.length; i++) {
        const idx = sub[i].index;
        const val = axis === 'x' ? state.xs[idx] : state.ys[idx];
        if ((mode === 'max' && val > bestVal) || (mode === 'min' && val < bestVal)) {
          bestVal = val;
          bestIdx = idx;
        }
      }
      setAnchorVerse(bestIdx, null);
    }

    els.spatialUpBtn.addEventListener('click', () => moveSpatialExtreme('y', 'max'));
    els.spatialDownBtn.addEventListener('click', () => moveSpatialExtreme('y', 'min'));
    els.spatialLeftBtn.addEventListener('click', () => moveSpatialExtreme('x', 'min'));
    els.spatialRightBtn.addEventListener('click', () => moveSpatialExtreme('x', 'max'));

    canvas.addEventListener('pointerdown', (e) => {
      isPanning = true;
      movedDuringPointer = false;
      panStartX = e.clientX - state.mapTransform.x;
      panStartY = e.clientY - state.mapTransform.y;
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isPanning) {
        if (!state.loaded || !state.stories.length) return;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        let hoveredStory = null;
        let bestDistSq = 14 * 14;
        for (let i = 0; i < state.stories.length; i++) {
          const s = state.stories[i];
          if (s.startIdx === undefined) continue;
          const [px, py] = dataToScreen(state.xs[s.startIdx], state.ys[s.startIdx]);
          const dSq = (px - sx) * (px - sx) + (py - sy) * (py - sy);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            hoveredStory = s;
          }
        }
        canvas.style.cursor = hoveredStory ? 'pointer' : '';
        if (state.mapHoveredStory !== hoveredStory) {
          state.mapHoveredStory = hoveredStory;
          renderMap();
        }
        return;
      }
      const nx = e.clientX - panStartX;
      const ny = e.clientY - panStartY;
      if (Math.hypot(nx - state.mapTransform.x, ny - state.mapTransform.y) > 4) {
        movedDuringPointer = true;
      }
      state.mapTransform.x = nx;
      state.mapTransform.y = ny;
      renderMap();
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!isPanning) return;
      isPanning = false;
      if (!movedDuringPointer) {
        pickPointAtClientPos(e.clientX, e.clientY);
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const newK = Math.max(0.6, Math.min(25, state.mapTransform.k * zoomFactor));
      const ratio = newK / state.mapTransform.k;

      state.mapTransform.x = mx - (mx - state.mapTransform.x) * ratio;
      state.mapTransform.y = my - (my - state.mapTransform.y) * ratio;
      state.mapTransform.k = newK;
      renderMap();
    }, { passive: false });
  }

  function resetMapZoom() {
    const rect = els.mapWrapper.getBoundingClientRect();
    const pad = 28;
    const w = Math.max(100, rect.width - pad * 2);
    const h = Math.max(100, rect.height - pad * 2);
    const dataW = state.xMax - state.xMin || 1;
    const dataH = state.yMax - state.yMin || 1;
    const scale = Math.min(w / dataW, h / dataH);

    state.mapTransform.k = scale;
    state.mapTransform.x = (rect.width - dataW * scale) / 2;
    state.mapTransform.y = (rect.height - dataH * scale) / 2;
  }

  function focusMapOnNeighborhood() {
    if (!state.loaded || !state.top50.length) return;
    const rect = els.mapWrapper.getBoundingClientRect();
    if (rect.width < 10) return;

    const top = state.top50.slice(0, 51);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < top.length; i++) {
      const idx = top[i].index;
      const x = state.xs[idx];
      const y = state.ys[idx];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    // Add 18-unit margin just like applet.py (domain=[min-20, max+20])
    minX -= 18;
    maxX += 18;
    minY -= 18;
    maxY += 18;

    const spanX = Math.max(10, maxX - minX);
    const spanY = Math.max(10, maxY - minY);
    const scale = Math.min(rect.width / spanX, rect.height / spanY);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    state.mapTransform.k = scale;
    state.mapTransform.x = rect.width / 2 - cx * scale;
    state.mapTransform.y = rect.height / 2 - (state.yMax - cy) * scale;
  }

  function dataToScreen(x, y) {
    const { x: tx, y: ty, k } = state.mapTransform;
    return [
      tx + x * k,
      ty + (state.yMax - y) * k
    ];
  }

  function pickPointAtClientPos(clientX, clientY) {
    const rect = els.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    const xs = state.xs;
    const ys = state.ys;

    // 1. Check Story Markers first — clicking a Story Marker navigates directly to its starting verse
    let bestStory = null;
    let bestStoryDistSq = 16 * 16; // 16px click/tap target radius for story diamonds
    for (let i = 0; i < state.stories.length; i++) {
      const s = state.stories[i];
      if (s.startIdx === undefined) continue;
      const [px, py] = dataToScreen(xs[s.startIdx], ys[s.startIdx]);
      const dSq = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      if (dSq < bestStoryDistSq) {
        bestStoryDistSq = dSq;
        bestStory = s;
      }
    }

    if (bestStory) {
      setAnchorVerse(bestStory.startIdx, null);
      switchView('read');
      return;
    }

    // 2. Otherwise inspect the nearest scripture point
    const n = xs.length;
    let bestIdx = -1;
    let bestDistSq = 22 * 22; // 22px click radius

    for (let i = 0; i < n; i++) {
      const [px, py] = dataToScreen(xs[i], ys[i]);
      const dSq = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      state.mapInspectedIndex = bestIdx;
      renderMap();
    }
  }

  function renderMap() {
    if (!state.loaded || state.activeView !== 'map') return;
    const canvas = els.canvas;
    const rect = els.mapWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const xs = state.xs;
    const ys = state.ys;
    const verses = state.verses;
    const n = xs.length;
    const topSet = new Set(state.top50.slice(0, 51).map((t) => t.index));
    const currIdx = getCurrentVerseIndex();
    const anchorIdx = state.anchorIndex;

    // Draw background points
    const mode = state.mapColorMode;
    ctx.globalAlpha = mode === 'highlight' ? 0.28 : 0.55;

    for (let i = 0; i < n; i++) {
      if (topSet.has(i)) continue;
      const [px, py] = dataToScreen(xs[i], ys[i]);
      if (px < -4 || px > width + 4 || py < -4 || py > height + 4) continue;

      if (mode === 'highlight') {
        ctx.fillStyle = '#8a867c';
      } else if (mode === 'volume') {
        ctx.fillStyle = VOLUME_COLORS[verses[i].volume] || '#8a867c';
      } else {
        const hue = (verses[i].cluster * 137.5) % 360;
        ctx.fillStyle = `hsl(${hue}, 65%, 52%)`;
      }
      ctx.fillRect(px - 1.2, py - 1.2, 2.4, 2.4);
    }

    // Draw Top 50 closest points
    ctx.globalAlpha = 1;
    state.top50.slice(0, 51).forEach((item) => {
      const idx = item.index;
      const [px, py] = dataToScreen(xs[idx], ys[idx]);
      ctx.beginPath();
      ctx.arc(px, py, idx === anchorIdx || idx === currIdx ? 6.5 : 4.2, 0, Math.PI * 2);
      ctx.fillStyle = idx === anchorIdx ? '#2b59c3' : '#0f766e';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    // Draw clickable golden diamond Story Markers (◆) for every story in state.stories
    for (let i = 0; i < state.stories.length; i++) {
      const s = state.stories[i];
      if (s.startIdx === undefined) continue;
      const [px, py] = dataToScreen(xs[s.startIdx], ys[s.startIdx]);
      if (px < -14 || px > width + 14 || py < -14 || py > height + 14) continue;

      const isHovered = state.mapHoveredStory === s;
      const isCurrentStory = currIdx >= s.startIdx && currIdx <= (s.endIdx ?? s.startIdx);
      const r = isHovered || isCurrentStory ? 8.5 : 6.2;

      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.lineTo(px + r, py);
      ctx.lineTo(px, py + r);
      ctx.lineTo(px - r, py);
      ctx.closePath();

      ctx.fillStyle = isHovered ? '#d97706' : '#f59e0b';
      ctx.fill();
      ctx.lineWidth = isHovered || isCurrentStory ? 2 : 1.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Draw reticle on inspected / current verse
    const inspectIdx = state.mapInspectedIndex ?? currIdx;
    const [ix, iy] = dataToScreen(xs[inspectIdx], ys[inspectIdx]);
    ctx.beginPath();
    ctx.arc(ix, iy, 10, 0, Math.PI * 2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.restore();

    // Update map inspector bar (prioritizing hovered story if present)
    const hoveredStory = state.mapHoveredStory;
    if (hoveredStory) {
      els.mapInspectorBadge.textContent = '📖 Story Marker (Click to Open)';
      els.mapInspectorRef.textContent = hoveredStory.title;
      els.mapInspectorCoords.textContent = `${hoveredStory.startRef} – ${hoveredStory.endRef}`;
      els.mapInspectorText.textContent = hoveredStory.summary;
      return;
    }

    const iv = state.verses[inspectIdx];
    if (iv) {
      const matchingStory = state.stories.find((s) => s.startIdx === inspectIdx);
      els.mapInspectorBadge.textContent = matchingStory
        ? `📖 Story: ${matchingStory.shortTitle}`
        : inspectIdx === anchorIdx
          ? 'Anchor'
          : topSet.has(inspectIdx)
            ? 'Top 50 Neighbor'
            : 'Selected Point';
      els.mapInspectorRef.textContent = iv.ref;
      els.mapInspectorCoords.textContent = `(${iv.x.toFixed(1)}, ${iv.y.toFixed(1)}) • Cluster ${iv.cluster}`;
      els.mapInspectorText.textContent = iv.text;
    }
  }

  /* ========================================================================
     9. BOTTOM NAVIGATION & URL HASH ROUTING
     ======================================================================== */
  function switchView(viewName) {
    if (!els.views[viewName]) return;
    state.activeView = viewName;

    Object.entries(els.views).forEach(([key, section]) => {
      if (key === viewName) {
        section.removeAttribute('hidden');
        section.classList.add('is-active');
      } else {
        section.setAttribute('hidden', '');
        section.classList.remove('is-active');
      }
    });

    els.navButtons.forEach((btn) => {
      if (btn.dataset.view === viewName) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    if (viewName === 'select' && state.loaded) {
      const curr = state.verses[getCurrentVerseIndex()];
      state.pickerBook = curr.book;
      state.pickerChapter = curr.chapter;
      state.pickerVerse = curr.verse;
      renderPickerBooks();
      renderPickerChapters();
      renderPickerVerses();
      updatePickerPreview();
    } else if (viewName === 'similar' && state.loaded) {
      renderSimilarView();
    } else if (viewName === 'map' && state.loaded) {
      requestAnimationFrame(() => {
        focusMapOnNeighborhood();
        renderMap();
      });
    }
  }

  function syncURLHash(verseIndex) {
    const v = state.verses[verseIndex];
    if (!v) return;
    const slug = encodeURIComponent(v.ref.replace(/\s+/g, '-'));
    history.replaceState(null, '', `#${slug}`);
  }

  function resolveHashToIndex() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, '')).replace(/-/g, ' ').trim().toLowerCase();
    if (!raw) return null;
    if (state.refMap.has(raw)) return state.refMap.get(raw);
    return null;
  }

  /* ========================================================================
     10. DIALOG & SETTINGS SETUP (modern-web-guidance: dialog)
     ======================================================================== */
  function setupDialogAndSettings() {
    const dialog = els.shortcutsDialog;

    // Fallback for browsers without Invoker Commands (`command="show-modal"`)
    if (!('commandForElement' in HTMLButtonElement.prototype)) {
      els.shortcutsBtn.addEventListener('click', () => {
        if (!dialog.open) dialog.showModal();
      });
    }

    // Reset returnValue on close per `dialog` guide
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });

    // Light-dismiss fallback for browsers without `<dialog closedby="any">`
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dlg) => {
        const r = dlg.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }

    // Apply initial saved preferences
    document.documentElement.dataset.fontSize = state.fontSize;
    if (state.theme === 'light' || state.theme === 'dark') {
      document.documentElement.dataset.theme = state.theme;
    } else {
      delete document.documentElement.dataset.theme;
    }

    els.settingSwipeMode.value = state.swipeMode;
    els.settingFontSize.value = state.fontSize;
    els.settingTheme.value = state.theme;

    els.settingSwipeMode.addEventListener('change', () => {
      state.swipeMode = els.settingSwipeMode.value;
      localStorage.setItem('verses_swipe_mode_v2', state.swipeMode);
      renderReadView();
    });

    els.settingFontSize.addEventListener('change', () => {
      state.fontSize = els.settingFontSize.value;
      document.documentElement.dataset.fontSize = state.fontSize;
      localStorage.setItem('verses_font_size', state.fontSize);
    });

    els.settingTheme.addEventListener('change', () => {
      state.theme = els.settingTheme.value;
      localStorage.setItem('verses_theme', state.theme);
      if (state.theme === 'light' || state.theme === 'dark') {
        document.documentElement.dataset.theme = state.theme;
      } else {
        delete document.documentElement.dataset.theme;
      }
    });
  }

  /* ========================================================================
     11. BOOTSTRAP
     ======================================================================== */
  function init() {
    setupDialogAndSettings();
    setupSwipeGestures();
    setupSelectAndSearchUI();
    setupMapInteractions();

    // Bottom navigation clicks
    els.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Quick view links on card
    els.cardChangeRefBtn.addEventListener('click', () => switchView('select'));
    els.cardViewSimilarBtn.addEventListener('click', () => switchView('similar'));
    els.cardViewMapBtn.addEventListener('click', () => switchView('map'));

    // Story badge click on Swipe card: jump to the story's starting verse
    if (els.cardStoryBadge) {
      els.cardStoryBadge.addEventListener('click', () => {
        const startIdx = parseInt(els.cardStoryBadge.dataset.storyStartIdx, 10);
        if (!Number.isNaN(startIdx)) {
          setAnchorVerse(startIdx, null);
        }
      });
    }

    // Filter toggle in Similar view
    els.excludeSameBookToggle.addEventListener('change', renderSimilarView);

    // Random verse button (on 2D Map view)
    els.randomHeaderBtn.addEventListener('click', () => {
      if (!state.loaded) return;
      const randIdx = Math.floor(Math.random() * state.verses.length);
      setAnchorVerse(randIdx, null);
    });

    loadScriptures();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
