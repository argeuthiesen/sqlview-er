/**
 * Application Controller for sqldesigner
 */

// Imports removed for global script loading

class SQLDesignerApp {
  constructor() {
    this.sqlEditor = document.getElementById('sql-editor-input');

    this.projectSelect = document.getElementById('project-select');
    this.uploadBtn = document.getElementById('upload-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.saveProjectBtn = document.getElementById('save-project-btn');
    this.openProjectBtn = document.getElementById('open-project-btn');
    this.fileInput = document.getElementById('sql-file-input');
    this.projectFileInput = document.getElementById('project-file-input');
    this.outlineList = document.getElementById('table-outline-list');

    this.projects = {};
    this.currentName = null;
    this.regenTimer = null;

    this.sidebarEl = document.querySelector('.sidebar');
    this.sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
    this.sidebarOpenBtn = document.getElementById('sidebar-open-btn');
    this.editorFoldBtn = document.getElementById('editor-fold-btn');
    this.highlightCode = document.getElementById('sql-highlight-code');
    this.highlightLayer = document.getElementById('sql-highlight-layer');
    this.cleanView = document.getElementById('sql-clean-view');
    this.cleanCode = document.getElementById('sql-clean-code');
    this.snippetEl = document.getElementById('sql-snippet');
    this.snippetName = document.getElementById('snippet-name');
    this.snippetCode = document.getElementById('snippet-code');
    this.switchComments = document.getElementById('switch-comments');
    this.commentsToggle = document.getElementById('comments-toggle');
    this.hideComments = false;
    this._mirror = null;
    
    // Floating tools
    this.zoomInBtn = document.getElementById('zoom-in-btn');
    this.zoomOutBtn = document.getElementById('zoom-out-btn');
    this.zoomResetBtn = document.getElementById('zoom-reset-btn');
    this.zoomFitBtn = document.getElementById('zoom-fit-btn');
    
    this.arrangeForceBtn = document.getElementById('arrange-force-btn');
    this.arrangeGridBtn = document.getElementById('arrange-grid-btn');
    this.arrangeCircleBtn = document.getElementById('arrange-circle-btn');
    
    this.exportSvgBtn = document.getElementById('export-svg-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.settingsCloseBtn = document.getElementById('settings-close-btn');
    this.settingsLangList = document.getElementById('settings-lang-list');
    this.switchTriggers = document.getElementById('switch-triggers');
    this.switchProcs = document.getElementById('switch-procs');
    
    // Initialize Canvas Controller
    this.canvas = new ERCanvas('canvas-container', 'svg-connections', 'card-container');
    
    this.initEvents();
    this.initUiState();
    this.initProjects();
  }

  initUiState() {
    let ui = {};
    try {
      ui = JSON.parse(localStorage.getItem('sqldesigner_ui')) || {};
    } catch (e) { /* ignore */ }
    this.setSidebarCollapsed(ui.sidebar === 'closed', false);
    // Editor starts folded by default — expand only when the user asks
    this.setEditorFolded(ui.editor !== 'open');
    this.applyCommentsMode(ui.hideComments === true);
    this.buildLangList();
    I18N.apply();
  }

  // "Ocultar comentários": troca o editor por uma visão limpa somente leitura
  applyCommentsMode(on) {
    this.hideComments = on;
    this.sqlEditor.style.display = on ? 'none' : '';
    this.highlightLayer.style.display = on ? 'none' : '';
    this.cleanView.hidden = !on;
    this.commentsToggle.classList.toggle('on', on);
    if (this.switchComments) this.switchComments.checked = on;
    if (on) this.renderCleanView(this.canvas ? this.canvas.selectedTable : null);
    this.saveUiState();
    if (this.canvas) this.refreshSnippet(this.canvas.selectedTable);
  }

  stripComments(sql) {
    return sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '')
      .replace(/^[ \t]*#[^\n]*/gm, '')
      .replace(/^[ \t]*;[ \t;]*$/gm, '') // ';' órfãos deixados por /*!...*/;
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n';
  }

  renderCleanView(selectedName) {
    const filtered = this.stripComments(this.sqlEditor.value);
    const range = selectedName ? this.findStatementRange(selectedName, filtered) : null;

    if (range) {
      this.cleanCode.innerHTML =
        SQLHighlighter.highlight(filtered.slice(0, range.start)) +
        '<span class="stmt-focus">' +
        SQLHighlighter.highlight(filtered.slice(range.start, range.end)) +
        '</span>' +
        SQLHighlighter.highlight(filtered.slice(range.end));
      const focusEl = this.cleanView.querySelector('.stmt-focus');
      if (focusEl) this.cleanView.scrollTop = Math.max(0, focusEl.offsetTop - 44);
    } else {
      this.cleanCode.innerHTML = SQLHighlighter.highlight(filtered);
    }
  }

  // Mede a posição em pixels de um offset do texto reproduzindo a quebra
  // de linha real do editor (linhas longas quebram — contar '\n' não basta)
  measureEditorOffsetY(charOffset) {
    if (!this._mirror) {
      this._mirror = document.createElement('div');
      this._mirror.className = 'sql-editor sql-mirror';
      document.body.appendChild(this._mirror);
    }
    const style = getComputedStyle(this.sqlEditor);
    const lineHeight = parseFloat(style.lineHeight) || 21;
    const padBottom = parseFloat(style.paddingBottom) || 0;
    this._mirror.style.width = this.sqlEditor.clientWidth + 'px';
    this._mirror.textContent = this.sqlEditor.value.slice(0, charOffset) + '​';
    return { y: this._mirror.scrollHeight - padBottom - lineHeight, lineHeight };
  }

  // Language options are built dynamically from whatever lang.js publishes —
  // adding a language there is all it takes for it to show up here
  buildLangList() {
    this.settingsLangList.innerHTML = '';
    Object.keys(LANGS).forEach(code => {
      const btn = document.createElement('button');
      btn.className = 'lang-option' + (code === I18N.current ? ' active' : '');
      btn.innerHTML = `<span class="lang-flag">${LANGS[code].flag}</span><span>${LANGS[code].name}</span>`;
      btn.addEventListener('click', () => {
        I18N.set(code);
        this.settingsLangList.querySelectorAll('.lang-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      this.settingsLangList.appendChild(btn);
    });
  }

  syncSettingsUI() {
    this.switchTriggers.checked = this.canvas.showTriggers;
    this.switchProcs.checked = this.canvas.showProcs;
    this.switchComments.checked = this.hideComments;
  }

  openSettings() {
    this.syncSettingsUI();
    this.settingsOverlay.hidden = false;
  }

  closeSettings() {
    this.settingsOverlay.hidden = true;
  }

  onLanguageChange() {
    // Rebuild everything that renders translated strings from JS
    this.updateProjectSelect();
    this.updateFoldHint();
    this.generateDiagram(false, false);
  }

  saveUiState() {
    localStorage.setItem('sqldesigner_ui', JSON.stringify({
      sidebar: this.sidebarEl.classList.contains('collapsed') ? 'closed' : 'open',
      editor: this.sidebarEl.classList.contains('editor-folded') ? 'folded' : 'open',
      hideComments: this.hideComments === true
    }));
  }

  setSidebarCollapsed(collapsed, save = true) {
    this.sidebarEl.classList.toggle('collapsed', collapsed);
    this.sidebarOpenBtn.hidden = !collapsed;
    if (save) this.saveUiState();
  }

  setEditorFolded(folded) {
    this.sidebarEl.classList.toggle('editor-folded', folded);
    this.updateFoldHint();
    this.saveUiState();
    // Snippet only makes sense while the editor is folded
    if (this.canvas) this.refreshSnippet(this.canvas.selectedTable);
  }

  updateFoldHint() {
    const folded = this.sidebarEl.classList.contains('editor-folded');
    document.getElementById('fold-hint').textContent = t(folded ? 'foldShow' : 'foldHide');
  }

  // Re-render the syntax highlight layer under the textarea
  updateHighlightLayer() {
    const code = this.sqlEditor.value;
    if (code.length < 300000) {
      // trailing newline keeps the layer height in sync with the textarea
      this.highlightCode.innerHTML = SQLHighlighter.highlight(code) + '\n';
    } else {
      this.highlightCode.textContent = code + '\n'; // plain fallback for huge dumps
    }
    this.highlightLayer.scrollTop = this.sqlEditor.scrollTop;
    if (this.hideComments) {
      this.renderCleanView(this.canvas ? this.canvas.selectedTable : null);
    }
  }

  initEvents() {
    // Auto-regenerate the diagram while typing (debounced);
    // the highlight layer updates immediately
    this.sqlEditor.addEventListener('input', () => {
      this.updateHighlightLayer();
      clearTimeout(this.regenTimer);
      this.regenTimer = setTimeout(() => this.generateDiagram(false, false), 600);
    });

    // Keep the highlight layer scrolled in lockstep with the textarea
    this.sqlEditor.addEventListener('scroll', () => {
      this.highlightLayer.scrollTop = this.sqlEditor.scrollTop;
      this.highlightLayer.scrollLeft = this.sqlEditor.scrollLeft;
    });

    // Import SQL file → becomes a new named project
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const suggested = file.name.replace(/\.(sql|txt)$/i, '');
        const name = this.askProjectName(t('promptImportName'), suggested);
        if (!name) return;
        this.saveState(); // persist the outgoing project first
        this.projects[name] = { sql: String(evt.target.result), positions: {} };
        this.currentName = name;
        localStorage.setItem('sqldesigner_current', name);
        this.sqlEditor.value = this.projects[name].sql;
        this.canvas.selectedTable = null;
        this.canvas.focusReturnPositions = null;
        this.generateDiagram(true); // arranges, fits and saves
        this.updateProjectSelect();
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset so the same file can be reloaded
    });

    // Clear Editor (current project only)
    this.clearBtn.addEventListener('click', () => {
      this.sqlEditor.value = '';
      this.generateDiagram(false, false);
    });

    // Project switcher combo
    this.projectSelect.addEventListener('change', (e) => {
      const value = e.target.value;
      if (value === '__new__') {
        const name = this.askProjectName(t('promptNewName'), t('defaultNewName'));
        if (name) {
          this.saveState();
          this.projects[name] = { sql: '', positions: {} };
          this.currentName = name;
          localStorage.setItem('sqldesigner_current', name);
          this.saveStore();
          this.loadCurrentProject(false);
        }
        this.updateProjectSelect();
      } else if (value === '__delete__') {
        if (confirm(t('confirmDeleteProject', { name: this.currentName }))) {
          delete this.projects[this.currentName];
          if (Object.keys(this.projects).length === 0) {
            this.projects['Projeto 1'] = { sql: '', positions: {} };
          }
          this.currentName = Object.keys(this.projects)[0];
          localStorage.setItem('sqldesigner_current', this.currentName);
          this.saveStore();
          this.loadCurrentProject(true);
        }
        this.updateProjectSelect();
      } else {
        this.switchProject(value);
      }
    });

    // Sidebar collapse / editor fold
    this.sidebarCollapseBtn.addEventListener('click', () => this.setSidebarCollapsed(true));
    this.sidebarOpenBtn.addEventListener('click', () => this.setSidebarCollapsed(false));
    this.editorFoldBtn.addEventListener('click', () => {
      this.setEditorFolded(!this.sidebarEl.classList.contains('editor-folded'));
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.setSidebarCollapsed(!this.sidebarEl.classList.contains('collapsed'));
      }
    });

    // Project file backup (.json): save current / open into a new project
    this.saveProjectBtn.addEventListener('click', () => this.saveProjectFile());
    this.openProjectBtn.addEventListener('click', () => this.projectFileInput.click());
    this.projectFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.openProjectFile(file);
      e.target.value = '';
    });

    // Zoom handlers
    this.zoomInBtn.addEventListener('click', () => this.canvas.zoomIn());
    this.zoomOutBtn.addEventListener('click', () => this.canvas.zoomOut());
    this.zoomResetBtn.addEventListener('click', () => this.canvas.resetZoom());
    this.zoomFitBtn.addEventListener('click', () => this.canvas.fitToScreen());

    // Layout arrangement handlers
    this.arrangeForceBtn.addEventListener('click', () => this.canvas.arrangeLayout('force'));
    this.arrangeGridBtn.addEventListener('click', () => this.canvas.arrangeLayout('grid'));
    this.arrangeCircleBtn.addEventListener('click', () => this.canvas.arrangeLayout('circle'));

    // Export SVG
    this.exportSvgBtn.addEventListener('click', () => this.exportSVG());

    // Settings modal
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.settingsCloseBtn.addEventListener('click', () => this.closeSettings());
    this.settingsOverlay.addEventListener('click', (e) => {
      if (e.target === this.settingsOverlay) this.closeSettings();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.settingsOverlay.hidden) this.closeSettings();
    });

    // Routine visibility switches (inside the settings modal)
    this.switchTriggers.addEventListener('change', () => {
      if (this.switchTriggers.checked !== this.canvas.showTriggers) {
        this.canvas.toggleRoutineVisibility('trigger');
      }
    });
    this.switchProcs.addEventListener('change', () => {
      if (this.switchProcs.checked !== this.canvas.showProcs) {
        this.canvas.toggleRoutineVisibility('proc');
      }
    });
    this.switchComments.addEventListener('change', () => {
      this.applyCommentsMode(this.switchComments.checked);
    });
    this.commentsToggle.addEventListener('click', () => {
      this.applyCommentsMode(!this.hideComments);
    });

    // Watch node drag changes in Canvas
    this.canvas.onStateChange = () => this.saveState();

    // When a table gains/loses focus on the canvas, mirror it in the SQL editor
    this.canvas.onFocusChange = (tableName) => this.highlightTableInEditor(tableName);
  }

  // Find the [start, end) range of the CREATE statement for a table or routine
  findStatementRange(name, src) {
    const sql = src !== undefined ? src : this.sqlEditor.value;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isRoutine = this.canvas.routines && this.canvas.routines[name];

    let match, start, end = sql.length;

    if (isRoutine) {
      // CREATE TRIGGER/PROCEDURE/FUNCTION name — up to the closing END
      const re = new RegExp('(?:TRIGGER|PROCEDURE|FUNCTION)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[`"\\[]?' + escaped + '[`"\\]]?', 'i');
      match = re.exec(sql);
      if (!match) return null;
      start = match.index;

      const endRe = /\bEND\b\s*(?:;;|\$\$|\*\/\s*;{0,2}|;)/g;
      endRe.lastIndex = start;
      const em = endRe.exec(sql);
      end = em ? em.index + em[0].length : Math.min(sql.length, start + 400);
    } else {
      // CREATE TABLE statement (quoted or bare identifier)
      const re = new RegExp('CREATE\\s+TABLE[^(;]*?[`"\\[]?' + escaped + '[`"\\]]?\\s*\\(', 'i');
      match = re.exec(sql);
      if (!match) return null;
      start = match.index;

      // Find the end of the statement: matching closing paren, then the semicolon
      let depth = 0;
      for (let i = sql.indexOf('(', start); i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') {
          depth--;
          if (depth === 0) {
            const semi = sql.indexOf(';', i);
            end = semi === -1 ? i + 1 : semi + 1;
            break;
          }
        }
      }
    }

    return { start, end };
  }

  // Contextual DDL snippet in the sidebar — visible only while the editor
  // is folded and something is selected on the canvas
  refreshSnippet(name) {
    const folded = this.sidebarEl.classList.contains('editor-folded');
    if (!name || !folded) {
      this.snippetEl.hidden = true;
      return;
    }
    const range = this.findStatementRange(name);
    if (!range) {
      this.snippetEl.hidden = true;
      return;
    }
    let code = this.sqlEditor.value.slice(range.start, range.end);
    if (this.hideComments) code = this.stripComments(code).trim();
    this.snippetName.textContent = name;
    this.snippetCode.innerHTML = SQLHighlighter.highlight(code);
    this.snippetEl.hidden = false;
  }

  highlightTableInEditor(tableName) {
    this.refreshSnippet(tableName);

    if (!tableName) {
      // Collapse any selection when focus is cleared
      this.sqlEditor.setSelectionRange(0, 0);
      return;
    }

    // With the editor folded, the snippet is the code view — nothing to scroll
    if (this.sidebarEl.classList.contains('editor-folded')) return;

    // Clean mode: highlight and scroll inside the read-only view
    if (this.hideComments) {
      this.renderCleanView(tableName);
      return;
    }

    const range = this.findStatementRange(tableName);
    if (!range) return;

    // Scroll using real wrapped-line metrics (long dump lines wrap in the
    // sidebar, so counting '\n' lands in the wrong place)
    const pos = this.measureEditorOffsetY(range.start);
    this.sqlEditor.scrollTop = Math.max(0, pos.y - pos.lineHeight * 2);
    this.highlightLayer.scrollTop = this.sqlEditor.scrollTop;

    // Select the block (focus is required for the selection to be visible)
    this.sqlEditor.focus({ preventScroll: true });
    this.sqlEditor.setSelectionRange(range.start, range.end);
  }

  loadStore() {
    try {
      return JSON.parse(localStorage.getItem('sqldesigner_projects')) || {};
    } catch (e) {
      return {};
    }
  }

  saveStore() {
    localStorage.setItem('sqldesigner_projects', JSON.stringify(this.projects));
  }

  initProjects() {
    this.projects = this.loadStore();

    // Migrate legacy single-project storage keys
    if (Object.keys(this.projects).length === 0) {
      const legacySql = localStorage.getItem('sqldesigner_sql');
      if (legacySql) {
        let legacyPositions = {};
        try {
          legacyPositions = JSON.parse(localStorage.getItem('sqldesigner_positions')) || {};
        } catch (e) { /* ignore corrupt cache */ }
        this.projects['Projeto 1'] = { sql: legacySql, positions: legacyPositions };
        localStorage.removeItem('sqldesigner_sql');
        localStorage.removeItem('sqldesigner_positions');
        this.saveStore();
      }
    }

    if (Object.keys(this.projects).length === 0) {
      this.projects['Projeto 1'] = { sql: '', positions: {} };
    }

    const saved = localStorage.getItem('sqldesigner_current');
    this.currentName = (saved && this.projects[saved]) ? saved : Object.keys(this.projects)[0];

    this.updateProjectSelect();
    this.loadCurrentProject(true);
  }

  loadCurrentProject(applyView) {
    const project = this.projects[this.currentName] || { sql: '', positions: {} };

    this.sqlEditor.value = project.sql || '';

    // Restore visibility toggles before rendering
    const toggles = project.toggles || {};
    this.canvas.showTriggers = toggles.triggers !== false;
    this.canvas.showProcs = toggles.procs !== false;
    this.syncSettingsUI();

    this.canvas.selectedTable = null;
    this.canvas.focusReturnPositions = null;

    this.generateDiagram(false, false);

    if (applyView && project.view) {
      this.canvas.zoom = project.view.zoom;
      this.canvas.panX = project.view.panX;
      this.canvas.panY = project.view.panY;
      this.canvas.updateTransform();
    } else {
      this.canvas.fitToScreen();
    }
  }

  switchProject(name) {
    if (!this.projects[name] || name === this.currentName) return;
    this.saveState(); // persist the outgoing project
    this.currentName = name;
    localStorage.setItem('sqldesigner_current', name);
    this.loadCurrentProject(true);
    this.updateProjectSelect();
  }

  updateProjectSelect() {
    this.projectSelect.innerHTML = '';

    Object.keys(this.projects).sort().forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = '🗂 ' + name;
      if (name === this.currentName) opt.selected = true;
      this.projectSelect.appendChild(opt);
    });

    const sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '──────────';
    this.projectSelect.appendChild(sep);

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = t('newProject');
    this.projectSelect.appendChild(newOpt);

    const delOpt = document.createElement('option');
    delOpt.value = '__delete__';
    delOpt.textContent = t('deleteProject');
    this.projectSelect.appendChild(delOpt);
  }

  askProjectName(message, suggested) {
    let name = prompt(message, suggested);
    if (name === null) return null; // user cancelled
    name = name.trim() || suggested;
    let unique = name;
    let i = 2;
    while (this.projects[unique]) unique = `${name} (${i++})`;
    return unique;
  }

  saveProjectFile() {
    this.saveState();
    const project = this.projects[this.currentName] || {};
    const payload = {
      app: 'sqldesigner',
      version: 1,
      name: this.currentName,
      ...project
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentName.replace(/[^\w\-]+/g, '_')}.sqldesigner.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openProjectFile(file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      let payload;
      try {
        payload = JSON.parse(evt.target.result);
      } catch (e) {
        alert(t('invalidProject'));
        return;
      }
      if (!payload || typeof payload.sql !== 'string') {
        alert(t('invalidProject'));
        return;
      }

      const suggested = payload.name || file.name.replace(/(\.sqldesigner)?\.json$/i, '');
      const name = this.askProjectName(t('promptOpenName'), suggested);
      if (!name) return;

      this.saveState();
      this.projects[name] = {
        sql: payload.sql,
        positions: payload.positions || {},
        view: payload.view,
        toggles: payload.toggles
      };
      this.currentName = name;
      localStorage.setItem('sqldesigner_current', name);
      this.saveStore();
      this.loadCurrentProject(true);
      this.updateProjectSelect();
    };
    reader.readAsText(file);
  }

  generateDiagram(forceAutoArrange = false, fitView = true) {
    const sql = this.sqlEditor.value.trim();
    const parsed = SQLParser.parse(sql);

    // Cached positions live inside the current project
    const project = this.projects[this.currentName] || {};
    const positions = project.positions || {};

    // Apply positions to tables and routines ('~' prefix avoids name clashes)
    for (const key in parsed.tables) {
      const table = parsed.tables[key];
      if (!forceAutoArrange && positions[key]) {
        table.x = positions[key].x;
        table.y = positions[key].y;
      }
    }
    for (const key in parsed.routines) {
      const routine = parsed.routines[key];
      const cached = positions['~' + key];
      if (!forceAutoArrange && cached) {
        routine.x = cached.x;
        routine.y = cached.y;
      }
    }

    // Load data into Canvas
    this.canvas.setData(parsed.tables, parsed.relationships, parsed.routines, parsed.routineLinks);

    // Update Sidebar Table Outline list
    this.updateOutline(parsed.tables, parsed.routines);
    
    // Center/Fit to canvas (arrangeLayout already fits by itself)
    if (forceAutoArrange) {
      this.canvas.arrangeLayout('grid');
    } else if (fitView) {
      this.canvas.fitToScreen();
    }

    this.updateHighlightLayer();
    this.saveState();
  }

  updateOutline(tables, routines = {}) {
    this.outlineList.innerHTML = '';
    const sortedNames = Object.keys(tables).sort();
    const sortedRoutines = Object.keys(routines).sort();

    if (sortedNames.length === 0 && sortedRoutines.length === 0) {
      this.outlineList.innerHTML = `<div style="color: var(--text-dark); font-size: 13px; text-align: center; margin-top: 20px;">${t('noTables')}</div>`;
      return;
    }

    sortedNames.forEach(name => {
      const table = tables[name];
      const item = document.createElement('div');
      item.className = 'outline-item';

      item.innerHTML = `
        <span class="outline-item-name">${table.name}</span>
        <span class="outline-item-count">${table.columns.length} ${t('colSuffix')}</span>
      `;

      // Outline item interaction: click to center canvas on table
      item.addEventListener('click', () => {
        this.focusOnTable(table.name);
      });

      this.outlineList.appendChild(item);
    });

    sortedRoutines.forEach(name => {
      const routine = routines[name];
      const icons = { trigger: '⚡', procedure: '⚙️', function: '𝑓' };
      const item = document.createElement('div');
      item.className = 'outline-item outline-routine';

      item.innerHTML = `
        <span class="outline-item-name">${icons[routine.kind] || '⚙️'} ${routine.name}</span>
        <span class="outline-item-count">${routine.kind === 'trigger' ? routine.label.toLowerCase() : routine.kind}</span>
      `;

      item.addEventListener('click', () => {
        this.focusOnTable(routine.name);
      });

      this.outlineList.appendChild(item);
    });
  }

  focusOnTable(tableName) {
    const table = this.canvas.tables[tableName] || this.canvas.routines[tableName];
    if (!table) return;

    // Focus mode handles highlighting, gathering and camera framing
    this.canvas.focusTableRelationships(tableName);
  }

  collectPositions() {
    // During focus mode, displaced nodes report their ORIGINAL coordinates
    const overrides = this.canvas.focusReturnPositions || {};
    const positions = {};
    for (const key in this.canvas.tables) {
      const src = overrides[key] || this.canvas.tables[key];
      if (src.x !== undefined && src.y !== undefined) {
        positions[key] = { x: src.x, y: src.y };
      }
    }
    for (const key in this.canvas.routines) {
      const src = overrides[key] || this.canvas.routines[key];
      if (src.x !== undefined && src.y !== undefined) {
        positions['~' + key] = { x: src.x, y: src.y };
      }
    }
    return positions;
  }

  saveState() {
    if (!this.currentName) return;
    const project = this.projects[this.currentName] || (this.projects[this.currentName] = {});

    project.sql = this.sqlEditor.value;
    // Merge so a briefly-invalid statement while typing doesn't lose positions
    project.positions = { ...(project.positions || {}), ...this.collectPositions() };
    // Don't capture the camera mid-focus (it's zoomed into the cluster)
    if (!this.canvas.selectedTable && !this.canvas.focusReturnPositions) {
      project.view = {
        zoom: this.canvas.zoom,
        panX: this.canvas.panX,
        panY: this.canvas.panY
      };
    }
    project.toggles = {
      triggers: this.canvas.showTriggers,
      procs: this.canvas.showProcs
    };
    project.savedAt = new Date().toISOString();

    this.saveStore();
    localStorage.setItem('sqldesigner_current', this.currentName);
  }

  exportSVG() {
    const tables = this.canvas.tables;
    const routines = this.canvas.routines || {};
    const keys = Object.keys(tables);
    if (keys.length === 0) return;

    // Clone the background connections SVG element as base
    const svgClone = this.canvas.svgBack.cloneNode(true);
    
    // Merge any relationship lines from the foreground SVG
    if (this.canvas.svgFront) {
      const frontClone = this.canvas.svgFront.cloneNode(true);
      const groups = frontClone.querySelectorAll('.relationship-group');
      groups.forEach(g => {
        svgClone.appendChild(g);
      });
    }
    
    // Get bounds of all tables to size the SVG output
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    keys.forEach(key => {
      const table = tables[key];
      minX = Math.min(minX, table.x);
      minY = Math.min(minY, table.y);
      maxX = Math.max(maxX, table.x + 240);
      maxY = Math.max(maxY, table.y + 250);
    });
    Object.keys(routines).forEach(key => {
      const routine = routines[key];
      if (routine.x === undefined) return;
      minX = Math.min(minX, routine.x);
      minY = Math.min(minY, routine.y);
      maxX = Math.max(maxX, routine.x + 220);
      maxY = Math.max(maxY, routine.y + 80);
    });

    const padding = 60;
    const width = (maxX - minX) + padding * 2;
    const height = (maxY - minY) + padding * 2;
    
    // Group wrapper to shift coords to positive area
    const wrapperGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapperGroup.setAttribute('transform', `translate(${padding - minX}, ${padding - minY})`);
    
    // Transfer children from clone to wrapper
    while (svgClone.firstChild) {
      wrapperGroup.appendChild(svgClone.firstChild);
    }
    svgClone.appendChild(wrapperGroup);
    
    // Append styles directly into the self-contained SVG
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      svg { background-color: #0b0f19; }
      .rel-main-line { stroke: rgba(99, 102, 241, 0.6); stroke-width: 2px; fill: none; vector-effect: non-scaling-stroke; }
      .pk-marker-dot { fill: #fbbf24; }
      .fk-marker-arrow { fill: #38bdf8; }
      .table-card {
        font-family: 'Outfit', -apple-system, sans-serif;
        width: 240px;
        background: #111827;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        color: #f3f4f6;
        overflow: hidden;
      }
      .table-header {
        padding: 12px 16px;
        background: rgba(99, 102, 241, 0.15);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-weight: 600;
        font-size: 14px;
      }
      .table-title { font-weight: 600; color: #fff; }
      .table-action-btn { display: none; }
      .table-columns { padding: 6px 0; }
      .column-row {
        padding: 8px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.01);
      }
      .col-meta { display: flex; align-items: center; gap: 8px; }
      .col-name { color: #e2e8f0; }
      .key-icon { font-size: 11px; display: inline-flex; align-items: center; width: 14px; }
      .col-type { color: #94a3b8; font-size: 11px; font-family: monospace; }
      .routine-card {
        font-family: 'Outfit', -apple-system, sans-serif;
        background: #111827;
        border: 1px solid rgba(251, 191, 36, 0.4);
        border-radius: 10px;
        padding: 10px 14px;
        color: #f3f4f6;
      }
      .routine-procedure, .routine-function { border-color: rgba(192, 132, 252, 0.45); }
      .routine-kind { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #fbbf24; margin-bottom: 4px; }
      .routine-procedure .routine-kind, .routine-function .routine-kind { color: #c084fc; }
      .routine-name { font-size: 13px; font-weight: 600; font-family: monospace; }
      .routine-link .rel-main-line { stroke-dasharray: 5, 4; stroke: rgba(251, 191, 36, 0.5); }
      .routine-link.routine-link-proc .rel-main-line { stroke: rgba(192, 132, 252, 0.5); }
    `;
    svgClone.appendChild(style);
    
    // Add all table cards as <foreignObject> elements inside SVG
    keys.forEach(key => {
      const table = tables[key];
      const cardEl = document.querySelector(`[data-table-card="${table.name}"]`);
      if (!cardEl) return;
      
      const foreignObj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObj.setAttribute('x', table.x);
      foreignObj.setAttribute('y', table.y);
      foreignObj.setAttribute('width', '240');
      
      const elHeight = cardEl.offsetHeight || (45 + table.columns.length * 35);
      foreignObj.setAttribute('height', elHeight);
      
      const cardClone = cardEl.cloneNode(true);
      cardClone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      
      foreignObj.appendChild(cardClone);
      wrapperGroup.appendChild(foreignObj);
    });

    // Add routine cards as <foreignObject> elements too
    Object.keys(routines).forEach(key => {
      const routine = routines[key];
      const cardEl = document.querySelector(`[data-routine-card="${routine.name}"]`);
      if (!cardEl || routine.x === undefined) return;

      const foreignObj = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      foreignObj.setAttribute('x', routine.x);
      foreignObj.setAttribute('y', routine.y);
      foreignObj.setAttribute('width', cardEl.offsetWidth || 200);
      foreignObj.setAttribute('height', cardEl.offsetHeight || 60);

      const cardClone = cardEl.cloneNode(true);
      cardClone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

      foreignObj.appendChild(cardClone);
      wrapperGroup.appendChild(foreignObj);
    });

    // Set SVG attributes
    svgClone.setAttribute('width', width);
    svgClone.setAttribute('height', height);
    svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgClone.removeAttribute('style'); // strip main scale transform
    
    // Serialize to XML string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    
    // Create download link
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${keys[0]}_schema_diagram.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}

// Start App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SQLDesignerApp();
});
