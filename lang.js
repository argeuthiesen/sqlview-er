/**
 * Biblioteca de idiomas do sqlview-er.
 *
 * Nota: é um .js (e não um .lang/.json carregado via fetch) de propósito —
 * a página roda em file:// sem servidor, e fetch de arquivo local é
 * bloqueado pelo navegador. Como script, carrega em qualquer lugar.
 */

const LANGS = {
  'pt-BR': {
    flag: '🇧🇷',
    name: 'Português (Brasil)',
    strings: {
      subtitle: 'Editor de Diagramas ER',
      collapseSidebar: 'Recolher painel (Ctrl+B)',
      expandSidebar: 'Mostrar painel (Ctrl+B)',
      sqlSection: 'CÓDIGO SQL (DDL)',
      foldEditor: 'Mostrar/ocultar o editor SQL',
      projectCombo: 'Alternar entre projetos',
      editorPlaceholder: 'Cole aqui seus comandos SQL CREATE TABLE...',
      btnImport: '📂 Importar SQL',
      titleImport: 'Importar arquivo SQL',
      btnClear: '🧹 Limpar',
      titleClear: 'Limpar editor',
      btnSaveProj: '💾 Salvar projeto',
      titleSaveProj: 'Salvar projeto (SQL + posições + visão)',
      btnOpenProj: '📁 Abrir projeto',
      titleOpenProj: 'Abrir projeto salvo',
      outlineTitle: 'TABELAS EXTRAÍDAS',
      helpMoveTableKey: 'Clique + arrastar cabeçalho',
      helpMoveTable: 'Mover tabela',
      helpPanKey: 'Botão direito/meio + arrastar',
      helpPan: 'Mover canvas',
      helpZoomKey: 'Roda do mouse',
      helpZoom: 'Zoom',
      zoomIn: 'Aproximar',
      zoomOut: 'Afastar',
      zoomReset: 'Restaurar zoom (1:1)',
      zoomFit: 'Ajustar à tela',
      arrangeForce: 'Organizar automaticamente',
      arrangeGrid: 'Organizar em grade',
      arrangeCircle: 'Organizar em círculo',
      toggleTriggers: 'Exibir/ocultar triggers',
      toggleProcs: 'Exibir/ocultar procedures e functions',
      exportSvg: 'Exportar como imagem SVG',
      noTables: 'Nenhuma tabela extraída.',
      colSuffix: 'col',
      newProject: '➕ Novo projeto',
      deleteProject: '🗑 Excluir projeto atual',
      promptImportName: 'Nome do projeto para este SQL:',
      promptNewName: 'Nome do novo projeto:',
      defaultNewName: 'Novo projeto',
      confirmDeleteProject: 'Excluir o projeto "{name}"? Isso não pode ser desfeito.',
      promptOpenName: 'Nome do projeto importado:',
      invalidProject: 'Arquivo de projeto inválido.',
      confirmDeleteTable: 'Tem certeza que deseja excluir a tabela "{name}"?',
      deleteTable: 'Excluir tabela',
      pkTitle: 'Chave primária',
      fkTitle: 'Chave estrangeira',
      notNullTitle: 'Não nulo'
    }
  },

  'en': {
    flag: '🇺🇸',
    name: 'English',
    strings: {
      subtitle: 'ER Diagram Editor',
      collapseSidebar: 'Collapse panel (Ctrl+B)',
      expandSidebar: 'Show panel (Ctrl+B)',
      sqlSection: 'SQL CODE (DDL)',
      foldEditor: 'Show/hide the SQL editor',
      projectCombo: 'Switch between projects',
      editorPlaceholder: 'Paste your SQL CREATE TABLE statements here...',
      btnImport: '📂 Import SQL',
      titleImport: 'Import SQL file',
      btnClear: '🧹 Clear',
      titleClear: 'Clear editor',
      btnSaveProj: '💾 Save project',
      titleSaveProj: 'Save project (SQL + positions + view)',
      btnOpenProj: '📁 Open project',
      titleOpenProj: 'Open a saved project',
      outlineTitle: 'EXTRACTED TABLES',
      helpMoveTableKey: 'Click + drag header',
      helpMoveTable: 'Move table',
      helpPanKey: 'Right/middle click + drag',
      helpPan: 'Pan canvas',
      helpZoomKey: 'Mouse wheel',
      helpZoom: 'Zoom',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      zoomReset: 'Reset zoom (1:1)',
      zoomFit: 'Fit to screen',
      arrangeForce: 'Auto-arrange layout',
      arrangeGrid: 'Arrange in grid',
      arrangeCircle: 'Arrange in circle',
      toggleTriggers: 'Show/hide triggers',
      toggleProcs: 'Show/hide procedures and functions',
      exportSvg: 'Export as SVG image',
      noTables: 'No tables extracted.',
      colSuffix: 'col',
      newProject: '➕ New project',
      deleteProject: '🗑 Delete current project',
      promptImportName: 'Project name for this SQL:',
      promptNewName: 'New project name:',
      defaultNewName: 'New project',
      confirmDeleteProject: 'Delete project "{name}"? This cannot be undone.',
      promptOpenName: 'Imported project name:',
      invalidProject: 'Invalid project file.',
      confirmDeleteTable: 'Are you sure you want to delete table "{name}"?',
      deleteTable: 'Delete table',
      pkTitle: 'Primary key',
      fkTitle: 'Foreign key',
      notNullTitle: 'Not null'
    }
  },

  'fr': {
    flag: '🇫🇷',
    name: 'Français',
    strings: {
      subtitle: 'Éditeur de diagrammes ER',
      collapseSidebar: 'Replier le panneau (Ctrl+B)',
      expandSidebar: 'Afficher le panneau (Ctrl+B)',
      sqlSection: 'CODE SQL (DDL)',
      foldEditor: 'Afficher/masquer l’éditeur SQL',
      projectCombo: 'Changer de projet',
      editorPlaceholder: 'Collez ici vos instructions SQL CREATE TABLE...',
      btnImport: '📂 Importer SQL',
      titleImport: 'Importer un fichier SQL',
      btnClear: '🧹 Effacer',
      titleClear: 'Effacer l’éditeur',
      btnSaveProj: '💾 Enregistrer le projet',
      titleSaveProj: 'Enregistrer le projet (SQL + positions + vue)',
      btnOpenProj: '📁 Ouvrir un projet',
      titleOpenProj: 'Ouvrir un projet enregistré',
      outlineTitle: 'TABLES EXTRAITES',
      helpMoveTableKey: 'Clic + glisser l’en-tête',
      helpMoveTable: 'Déplacer la table',
      helpPanKey: 'Clic droit/molette + glisser',
      helpPan: 'Déplacer le canevas',
      helpZoomKey: 'Molette de la souris',
      helpZoom: 'Zoom',
      zoomIn: 'Zoom avant',
      zoomOut: 'Zoom arrière',
      zoomReset: 'Réinitialiser le zoom (1:1)',
      zoomFit: 'Ajuster à l’écran',
      arrangeForce: 'Organisation automatique',
      arrangeGrid: 'Organiser en grille',
      arrangeCircle: 'Organiser en cercle',
      toggleTriggers: 'Afficher/masquer les triggers',
      toggleProcs: 'Afficher/masquer les procédures et fonctions',
      exportSvg: 'Exporter en image SVG',
      noTables: 'Aucune table extraite.',
      colSuffix: 'col',
      newProject: '➕ Nouveau projet',
      deleteProject: '🗑 Supprimer le projet actuel',
      promptImportName: 'Nom du projet pour ce SQL :',
      promptNewName: 'Nom du nouveau projet :',
      defaultNewName: 'Nouveau projet',
      confirmDeleteProject: 'Supprimer le projet « {name} » ? Cette action est irréversible.',
      promptOpenName: 'Nom du projet importé :',
      invalidProject: 'Fichier de projet invalide.',
      confirmDeleteTable: 'Voulez-vous vraiment supprimer la table « {name} » ?',
      deleteTable: 'Supprimer la table',
      pkTitle: 'Clé primaire',
      fkTitle: 'Clé étrangère',
      notNullTitle: 'Non nul'
    }
  },

  // tlhIngan Hol — traduzido com o rigor científico de um fim de semana livre.
  // Erros gramaticais serão resolvidos em combate singular. Qapla'!
  'tlh': {
    flag: '🖖',
    name: 'tlhIngan Hol',
    strings: {
      subtitle: 'ER De\' nagh beQ',
      collapseSidebar: 'nagh beQ yISo\' (Ctrl+B)',
      expandSidebar: 'nagh beQ yI\'ang (Ctrl+B)',
      sqlSection: 'SQL ghItlh (DDL)',
      foldEditor: 'SQL ghItlhwI\' yI\'ang / yISo\'',
      projectCombo: 'Qu\' yIchoH',
      editorPlaceholder: 'naDev SQL CREATE TABLE ra\'mey tIlan...',
      btnImport: '📂 SQL yIqem',
      titleImport: 'SQL teywI\' yIqem',
      btnClear: '🧹 yIQaw\'',
      titleClear: 'ghItlhwI\' yIQaw\'',
      btnSaveProj: '💾 Qu\' yIpol',
      titleSaveProj: 'Qu\' yIpol (SQL + Daqmey + leghpu\'ghach)',
      btnOpenProj: '📁 Qu\' yIpoSmoH',
      titleOpenProj: 'polta\'bogh Qu\' yIpoSmoH',
      outlineTitle: 'raSmey tu\'lu\'bogh',
      helpMoveTableKey: '\'uS + luSpet yIlel',
      helpMoveTable: 'raS yIvIH',
      helpPanKey: 'nIH \'uS + yIlel',
      helpPan: 'nagh beQ yIvIH',
      helpZoomKey: 'gho yIgho',
      helpZoom: 'Sum / Hop',
      zoomIn: 'yISum',
      zoomOut: 'yIHop',
      zoomReset: 'Sum motlh (1:1)',
      zoomFit: 'Hoch yIlegh',
      arrangeForce: 'HoS lo\'taHvIS yIrach',
      arrangeGrid: 'mIr yIrach',
      arrangeCircle: 'gho yIrach',
      toggleTriggers: 'triggers yI\'ang / yISo\'',
      toggleProcs: 'procedures yI\'ang / yISo\'',
      exportSvg: 'SVG mIllogh yIchenmoH',
      noTables: 'raS tu\'be\'lu\'. Qu\'vatlh!',
      colSuffix: 'col',
      newProject: '➕ Qu\' chu\'',
      deleteProject: '🗑 DaH Qu\' yIQaw\'',
      promptImportName: 'SQLvam Qu\' pong:',
      promptNewName: 'Qu\' chu\' pong:',
      defaultNewName: 'Qu\' chu\'',
      confirmDeleteProject: 'Qu\' «{name}» DaQaw\' DaneH\'a\'? cheghlaHbe\'!',
      promptOpenName: 'qempu\'bogh Qu\' pong:',
      invalidProject: 'Qu\' teywI\' Duj. batlhHa\'!',
      confirmDeleteTable: 'raS «{name}» DaQaw\' DaneH\'a\'? batlh yIQaw\'!',
      deleteTable: 'raS yIQaw\'',
      pkTitle: 'ngeb wa\'DIch (PK)',
      fkTitle: 'ngeb Hop (FK)',
      notNullTitle: 'pagh \'oHlaHbe\''
    }
  }
};

const I18N = {
  current: 'pt-BR',

  detect() {
    const saved = localStorage.getItem('sqldesigner_lang');
    if (saved && LANGS[saved]) return saved;
    const nav = (navigator.language || 'pt-BR').toLowerCase();
    if (nav.startsWith('pt')) return 'pt-BR';
    if (nav.startsWith('fr')) return 'fr';
    return 'en';
  },

  t(key, vars) {
    let s = LANGS[this.current].strings[key];
    if (s === undefined) s = LANGS['pt-BR'].strings[key];
    if (s === undefined) return key;
    if (vars) {
      for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    }
    return s;
  },

  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = this.t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
    });
    document.documentElement.lang = this.current;
  },

  set(lang) {
    if (!LANGS[lang]) return;
    this.current = lang;
    localStorage.setItem('sqldesigner_lang', lang);
    this.apply();
    if (window.app && typeof window.app.onLanguageChange === 'function') {
      window.app.onLanguageChange();
    }
  }
};

I18N.current = I18N.detect();

window.LANGS = LANGS;
window.I18N = I18N;
window.t = (key, vars) => I18N.t(key, vars);
