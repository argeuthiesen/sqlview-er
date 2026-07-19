/**
 * Interactive ER Canvas Logic for sqldesigner
 */

class ERCanvas {
  constructor(canvasContainerId, svgContainerId, cardContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.svgBack = document.getElementById('svg-connections-back') || document.getElementById(svgContainerId);
    this.svgFront = document.getElementById('svg-connections-front');
    this.cardContainer = document.getElementById(cardContainerId);
    this.cardTopContainer = document.getElementById('card-container-top');
    
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    
    this.tables = {};
    this.relationships = [];
    this.routines = {};
    this.routineLinks = [];
    this.showTriggers = true;
    this.showProcs = true;
    
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.hasPaged = false; // Track if current canvas pan moved significantly
    
    this.activeDragNode = null;
    this.dragStart = { x: 0, y: 0 };
    this.nodeStart = { x: 0, y: 0 };
    this.hasDragged = false; // Track if current drag moved the node significantly
    
    this.selectedTable = null; // Track current focused table
    this.onStateChange = null; // Callback for state updates
    this.focusReturnPositions = null; // Original coords of nodes displaced by focus mode
    this.focusAnimFrame = null;
    this.animDuration = 380; // ms; focus gather/restore animation length
    
    this.initEvents();
  }

  setData(tables, relationships, routines = {}, routineLinks = []) {
    this.tables = tables;
    this.relationships = relationships;
    this.routines = routines;
    this.routineLinks = routineLinks;
    this.render();
  }

  // Unified node map (tables + routines) for layout and lookups
  getAllNodes() {
    const map = {};
    for (const k in this.tables) map[k] = this.tables[k];
    for (const k in this.routines) if (!map[k]) map[k] = this.routines[k];
    return map;
  }

  // All connections as [nameA, nameB] pairs (FKs + routine links)
  getAllLinkPairs() {
    const pairs = [];
    this.relationships.forEach(r => pairs.push([r.fromTable, r.toTable]));
    this.routineLinks.forEach(l => pairs.push([l.routine, l.table]));
    return pairs;
  }

  getCardEl(name) {
    return document.querySelector(`[data-table-card="${name}"], [data-routine-card="${name}"]`);
  }

  isRoutineVisible(routine) {
    return routine.kind === 'trigger' ? this.showTriggers : this.showProcs;
  }

  toggleRoutineVisibility(kind) {
    if (kind === 'trigger') {
      this.showTriggers = !this.showTriggers;
    } else {
      this.showProcs = !this.showProcs;
    }

    // Clear focus (with position restore) if the selected routine just got hidden
    const selected = this.selectedTable && this.routines[this.selectedTable];
    if (selected && !this.isRoutineVisible(selected)) {
      this.clearTableFocus();
    }

    this.render();
    return kind === 'trigger' ? this.showTriggers : this.showProcs;
  }

  initEvents() {
    // Zooming
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      let newZoom = this.zoom;
      
      if (e.deltaY < 0) {
        newZoom *= zoomFactor;
      } else {
        newZoom /= zoomFactor;
      }
      
      // Clamp zoom between 0.15 and 3.0
      newZoom = Math.max(0.15, Math.min(3.0, newZoom));
      
      // Zoom relative to cursor position
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Canvas coordinates before zoom change
      const cx = (mouseX - this.panX) / this.zoom;
      const cy = (mouseY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      this.panX = mouseX - cx * this.zoom;
      this.panY = mouseY - cy * this.zoom;
      
      this.updateTransform();
    }, { passive: false });

    // Panning (Middle click or Space+Drag or background click-drag)
    this.container.addEventListener('mousedown', (e) => {
      // Check if clicked directly on container or SVG (the grid background)
      const isBg = e.target === this.container || e.target === this.svgBack || e.target === this.svgFront || e.target.tagName === 'line' || e.target.classList.contains('canvas-grid');
      const isMiddle = e.button === 1;
      
      if (isBg || isMiddle || e.button === 2) {
        this.isPanning = true;
        this.panStart.x = e.clientX - this.panX;
        this.panStart.y = e.clientY - this.panY;
        this.container.style.cursor = 'grabbing';
        this.hasPaged = false; // Reset pan movement flag
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStart.x - this.panX;
        const dy = e.clientY - this.panStart.y - this.panY;
        if (Math.hypot(dx, dy) > 3) {
          this.hasPaged = true; // Canvas was panned significantly
        }
        
        this.panX = e.clientX - this.panStart.x;
        this.panY = e.clientY - this.panStart.y;
        this.updateTransform();
      } else if (this.activeDragNode) {
        const dx = (e.clientX - this.dragStart.x) / this.zoom;
        const dy = (e.clientY - this.dragStart.y) / this.zoom;
        
        if (Math.hypot(dx, dy) > 4 && !this.hasDragged) {
          this.hasDragged = true; // Node was dragged, do not trigger click select
          // Bring card to top only now: re-appending the node on mousedown would
          // detach/reattach it mid-click, which suppresses the click event in Chrome
          const dragCard = this.getCardEl(this.activeDragNode);
          // Keep the card in its current layer (base or elevated) when bringing to top
          if (dragCard && dragCard.parentElement) dragCard.parentElement.appendChild(dragCard);
        }

        const node = this.tables[this.activeDragNode] || this.routines[this.activeDragNode];
        if (node) {
          node.x = this.nodeStart.x + dx;
          node.y = this.nodeStart.y + dy;

          // Update DOM node position
          const cardEl = this.getCardEl(this.activeDragNode);
          if (cardEl) {
            cardEl.style.left = `${node.x}px`;
            cardEl.style.top = `${node.y}px`;
          }
          
          // Redraw lines
          this.drawRelationships();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.container.style.cursor = 'default';
      }
      
      if (this.activeDragNode) {
        this.activeDragNode = null;
        if (this.onStateChange) this.onStateChange();
      }
    });

    // Click on canvas background to clear selection
    this.container.addEventListener('click', (e) => {
      if (this.hasPaged) {
        this.hasPaged = false; // Ignore click since it was a pan drag
        return;
      }
      const isBg = e.target === this.container || e.target === this.svgBack || e.target === this.svgFront || e.target.classList.contains('canvas-grid') || e.target.tagName === 'line';
      if (isBg) {
        this.clearTableFocus();
      }
    });

    // Prevent context menu on right click to allow panning
    this.container.addEventListener('contextmenu', e => e.preventDefault());

    // ESC clears the current table focus (unless a modal is open — it wins)
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const overlay = document.getElementById('settings-overlay');
      if (overlay && !overlay.hidden) return;
      if (this.selectedTable) {
        this.clearTableFocus();
      }
    });
  }

  updateTransform() {
    // Apply transform to the SVG and card containers
    const transformStr = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.svgBack.style.transform = transformStr;
    if (this.svgFront) this.svgFront.style.transform = transformStr;
    this.cardContainer.style.transform = transformStr;
    if (this.cardTopContainer) this.cardTopContainer.style.transform = transformStr;
    
    // Update grid background offset to make it infinite
    const gridSize = 40;
    this.container.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    this.container.style.backgroundSize = `${gridSize * this.zoom}px ${gridSize * this.zoom}px`;
  }

  zoomIn() {
    this.zoom = Math.min(3.0, this.zoom * 1.2);
    this.updateTransform();
  }

  zoomOut() {
    this.zoom = Math.max(0.15, this.zoom / 1.2);
    this.updateTransform();
  }

  resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }

  fitToScreen() {
    const camera = this.computeFitCamera();
    if (!camera) return;
    this.zoom = camera.zoom;
    this.panX = camera.panX;
    this.panY = camera.panY;
    this.updateTransform();
  }

  // Camera (zoom/pan) that frames every visible node. `overrides` maps
  // node names to positions to use instead of their current coords —
  // lets the defocus animation target the restored layout.
  computeFitCamera(overrides = null) {
    const allNodes = this.getAllNodes();
    const keys = Object.keys(allNodes).filter(key => {
      const node = allNodes[key];
      if (!this.tables[key] && this.routines[key] && !this.isRoutineVisible(node)) return false;
      return node.x !== undefined || (overrides && overrides[key]);
    });
    if (keys.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    keys.forEach(key => {
      const pos = (overrides && overrides[key]) || allNodes[key];
      const d = this.getNodeDims(key);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + d.w);
      maxY = Math.max(maxY, pos.y + d.h);
    });

    const padding = 60;
    const cw = this.container.clientWidth || 1200;
    const ch = this.container.clientHeight || 800;

    const zoom = Math.max(0.15, Math.min(1.2, Math.min(
      cw / (maxX - minX + padding * 2),
      ch / (maxY - minY + padding * 2)
    )));

    return {
      zoom,
      panX: cw / 2 - (minX + (maxX - minX) / 2) * zoom,
      panY: ch / 2 - (minY + (maxY - minY) / 2) * zoom
    };
  }

  render() {
    // 1. Clear previous drawings
    this.cardContainer.innerHTML = '';
    if (this.cardTopContainer) this.cardTopContainer.innerHTML = '';
    this.svgBack.innerHTML = '';
    if (this.svgFront) this.svgFront.innerHTML = '';
    
    // Create marker definitions for both foreign key relations SVGs
    this.createSvgMarkers();

    // 2a. Seed missing routine coordinates near their anchor table so a
    // cached-layout reload doesn't force a full re-arrange
    let seedOffset = 0;
    for (const key in this.routines) {
      const routine = this.routines[key];
      if (routine.x === undefined || routine.y === undefined) {
        const anchor = this.tables[routine.onTable] || this.tables[(routine.refs || [])[0]];
        if (anchor && anchor.x !== undefined) {
          routine.x = anchor.x + 270;
          routine.y = anchor.y - 70 + (seedOffset % 4) * 75;
          seedOffset++;
        }
      }
    }

    // 2b. Coordinates: full layout only when NOTHING is placed yet;
    // otherwise seed just the newcomers (typing a new table must not
    // shuffle the whole diagram)
    const allNodes = this.getAllNodes();
    const allKeys = Object.keys(allNodes);
    const placed = allKeys.filter(k => allNodes[k].x !== undefined && allNodes[k].y !== undefined);

    if (placed.length === 0 && allKeys.length > 0) {
      // Compute coordinates only — calling arrangeLayout() here would
      // re-enter render() and duplicate every card
      this.computeLayout('force');
    } else if (placed.length < allKeys.length) {
      let maxX = -Infinity, minY = Infinity;
      placed.forEach(k => {
        maxX = Math.max(maxX, allNodes[k].x);
        minY = Math.min(minY, allNodes[k].y);
      });
      const pairs = this.getAllLinkPairs();
      let i = 0;
      allKeys.forEach(k => {
        const node = allNodes[k];
        if (node.x !== undefined) return;
        // Prefer a spot next to a connected node that already has coords
        let anchor = null;
        pairs.forEach(([a, b]) => {
          if (anchor) return;
          if (a === k && allNodes[b] && allNodes[b].x !== undefined) anchor = allNodes[b];
          else if (b === k && allNodes[a] && allNodes[a].x !== undefined) anchor = allNodes[a];
        });
        if (anchor) {
          node.x = anchor.x + 300;
          node.y = anchor.y + 40 + (i % 3) * 140;
        } else {
          node.x = maxX + 340;
          node.y = minY + i * 260;
        }
        i++;
      });
    }

    // 3. Render table and routine cards
    for (const key in this.tables) {
      this.renderTableCard(this.tables[key]);
    }
    for (const key in this.routines) {
      if (this.isRoutineVisible(this.routines[key])) {
        this.renderRoutineCard(this.routines[key]);
      }
    }

    // Selected node may no longer exist after a re-parse
    if (this.selectedTable && !this.tables[this.selectedTable] && !this.routines[this.selectedTable]) {
      this.selectedTable = null;
    }
    this.applyCardFocusStyles();

    // 4. Draw connection lines
    // Wait a brief tick for offset Heights to populate in DOM
    setTimeout(() => {
      this.drawRelationships();
    }, 50);
  }

  createSvgMarkers() {
    const createDefs = () => {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      
      // Primary key endpoint marker (circle dot)
      const pkMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      pkMarker.setAttribute('id', 'pk-marker');
      pkMarker.setAttribute('markerWidth', '8');
      pkMarker.setAttribute('markerHeight', '8');
      pkMarker.setAttribute('refX', '4');
      pkMarker.setAttribute('refY', '4');
      pkMarker.setAttribute('orient', 'auto');
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '4');
      circle.setAttribute('cy', '4');
      circle.setAttribute('r', '3');
      circle.setAttribute('class', 'pk-marker-dot');
      
      pkMarker.appendChild(circle);
      defs.appendChild(pkMarker);

      // Foreign key endpoint marker (crow's foot / fork or arrowhead)
      const fkMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      fkMarker.setAttribute('id', 'fk-marker');
      fkMarker.setAttribute('markerWidth', '10');
      fkMarker.setAttribute('markerHeight', '10');
      fkMarker.setAttribute('refX', '0'); // start of path
      fkMarker.setAttribute('refY', '5');
      fkMarker.setAttribute('orient', 'auto-start-reverse');
      
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', 'M 0 2 L 6 5 L 0 8 Z'); // triangular arrowhead pointing out
      arrow.setAttribute('class', 'fk-marker-arrow');
      
      fkMarker.appendChild(arrow);
      defs.appendChild(fkMarker);
      
      return defs;
    };
    
    this.svgBack.appendChild(createDefs());
    if (this.svgFront) {
      this.svgFront.appendChild(createDefs());
    }
  }

  renderTableCard(table) {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.setAttribute('data-table-card', table.name);
    card.style.left = `${table.x}px`;
    card.style.top = `${table.y}px`;

    // Card Header
    const header = document.createElement('div');
    header.className = 'table-header';
    header.innerHTML = `
      <span class="table-title">${table.name}</span>
      <span class="table-actions">
        <button class="table-action-btn delete-table-btn" title="${t('deleteTable')}">×</button>
      </span>
    `;
    
    // Drag start handler on header
    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('.table-action-btn')) return;
      
      this.activeDragNode = table.name;
      this.dragStart.x = e.clientX;
      this.dragStart.y = e.clientY;
      this.nodeStart.x = table.x;
      this.nodeStart.y = table.y;
      this.hasDragged = false; // Reset drag state flag on every mouse interaction

      e.stopPropagation();
    });

    card.appendChild(header);

    // Columns Container
    const colsContainer = document.createElement('div');
    colsContainer.className = 'table-columns';

    table.columns.forEach(col => {
      const colRow = document.createElement('div');
      colRow.className = 'column-row';
      colRow.setAttribute('data-column-row', col.name);
      
      if (col.isPK) colRow.classList.add('pk-column');
      if (col.isFK) colRow.classList.add('fk-column');

      // Key icon / Indicator
      let keyIcon = '';
      if (col.isPK && col.isFK) {
        keyIcon = '<span class="key-icon pk-fk">🔑🔗</span>';
      } else if (col.isPK) {
        keyIcon = `<span class="key-icon pk" title="${t('pkTitle')}">🔑</span>`;
      } else if (col.isFK) {
        keyIcon = `<span class="key-icon fk" title="${t('fkTitle')}">🔗</span>`;
      } else {
        keyIcon = '<span class="key-icon empty"></span>';
      }

      const nullability = col.isNullable ? '' : `<span class="not-null-indicator" title="${t('notNullTitle')}">*</span>`;

      colRow.innerHTML = `
        <div class="col-meta">
          ${keyIcon}
          <span class="col-name">${col.name}${nullability}</span>
        </div>
        <span class="col-type">${col.type.toLowerCase()}</span>
      `;

      colsContainer.appendChild(colRow);
    });

    card.appendChild(colsContainer);
    
    // Action: Delete Table Button
    header.querySelector('.delete-table-btn').addEventListener('click', (e) => {
      this.deleteTable(table.name);
      e.stopPropagation(); // Prevent card focus toggle
    });

    // Toggle focus highlighting on click
    card.addEventListener('click', (e) => {
      if (e.target.closest('.table-action-btn')) return;
      if (this.hasDragged) {
        this.hasDragged = false; // Reset flag and ignore click highlight
        return;
      }
      this.toggleTableFocus(table.name);
      e.stopPropagation();
    });

    this.cardContainer.appendChild(card);
  }

  renderRoutineCard(routine) {
    const card = document.createElement('div');
    card.className = `routine-card routine-${routine.kind}`;
    card.setAttribute('data-routine-card', routine.name);
    card.style.left = `${routine.x}px`;
    card.style.top = `${routine.y}px`;

    const icons = { trigger: '⚡', procedure: '⚙️', function: '𝑓' };
    card.innerHTML = `
      <div class="routine-kind">${icons[routine.kind] || '⚙️'} ${routine.label}</div>
      <div class="routine-name">${routine.name}</div>
    `;

    // Whole card is the drag handle
    card.addEventListener('mousedown', (e) => {
      this.activeDragNode = routine.name;
      this.dragStart.x = e.clientX;
      this.dragStart.y = e.clientY;
      this.nodeStart.x = routine.x;
      this.nodeStart.y = routine.y;
      this.hasDragged = false;
      e.stopPropagation();
    });

    card.addEventListener('click', (e) => {
      if (this.hasDragged) {
        this.hasDragged = false;
        return;
      }
      this.toggleTableFocus(routine.name);
      e.stopPropagation();
    });

    this.cardContainer.appendChild(card);
  }

  deleteTable(tableName) {
    if (confirm(t('confirmDeleteTable', { name: tableName }))) {
      // Remove relationships connected to this table
      this.relationships = this.relationships.filter(r => r.fromTable !== tableName && r.toTable !== tableName);

      // Remove table
      delete this.tables[tableName];

      // Remove triggers attached to this table and any dangling routine links
      for (const rn in this.routines) {
        if (this.routines[rn].onTable === tableName) delete this.routines[rn];
      }
      this.routineLinks = this.routineLinks.filter(l => l.table !== tableName && this.routines[l.routine]);

      // Drop focus if the focused table was deleted
      if (this.selectedTable === tableName) this.selectedTable = null;
      
      // Re-render
      this.render();
      
      if (this.onStateChange) this.onStateChange();
    }
  }

  getConnectorPoint(tableName, columnName, otherTableName, isSource) {
    const table = this.tables[tableName];
    if (!table) return null;

    const cardEl = document.querySelector(`[data-table-card="${tableName}"]`);
    if (!cardEl) return { x: table.x + 120, y: table.y + 40, side: 'right' };

    const colEl = cardEl.querySelector(`[data-column-row="${columnName}"]`);
    if (!colEl) return { x: table.x + 120, y: table.y + 50, side: 'right' };

    const cardWidth = cardEl.offsetWidth || 240;
    const rowY = table.y + colEl.offsetTop + colEl.offsetHeight / 2;

    const otherTable = this.tables[otherTableName];
    let rowX = table.x;
    let side = 'left';

    if (otherTable) {
      // Choose side based on relative position
      if (table.x + cardWidth / 2 < otherTable.x + 120) {
        rowX = table.x + cardWidth;
        side = 'right';
      } else {
        rowX = table.x;
        side = 'left';
      }
    } else {
      rowX = isSource ? table.x + cardWidth : table.x;
      side = isSource ? 'right' : 'left';
    }

    return { x: rowX, y: rowY, side };
  }

  drawRelationships() {
    // Remove existing relationship/routine lines from both SVGs
    this.svgBack.querySelectorAll('.relationship-group').forEach(l => l.remove());
    if (this.svgFront) {
      this.svgFront.querySelectorAll('.relationship-group').forEach(l => l.remove());
    }

    this.relationships.forEach((rel, index) => {
      const fromPt = this.getConnectorPoint(rel.fromTable, rel.fromCol, rel.toTable, true);
      const toPt = this.getConnectorPoint(rel.toTable, rel.toCol, rel.fromTable, false);

      if (!fromPt || !toPt) return;

      // Draw bezier path
      const dx = Math.max(60, Math.abs(toPt.x - fromPt.x) / 1.5);
      const cp1x = fromPt.side === 'right' ? fromPt.x + dx : fromPt.x - dx;
      const cp1y = fromPt.y;
      const cp2x = toPt.side === 'left' ? toPt.x - dx : toPt.x + dx;
      const cp2y = toPt.y;

      const pathData = `M ${fromPt.x} ${fromPt.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPt.x} ${toPt.y}`;

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'relationship-group');
      group.setAttribute('data-rel-index', index);

      // Glow effect background line
      const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glowLine.setAttribute('d', pathData);
      glowLine.setAttribute('class', 'rel-glow-line');
      
      // Main visible line
      const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      mainLine.setAttribute('d', pathData);
      mainLine.setAttribute('class', 'rel-main-line');
      mainLine.setAttribute('marker-start', 'url(#fk-marker)'); 
      mainLine.setAttribute('marker-end', 'url(#pk-marker)');   

      group.appendChild(glowLine);
      group.appendChild(mainLine);
      
      // Decide classes and target SVG based on focus state
      const isRelated = this.selectedTable && (rel.fromTable === this.selectedTable || rel.toTable === this.selectedTable);
      let targetSvg = this.svgBack;

      if (this.selectedTable) {
        if (isRelated) {
          group.classList.add('highlight-active');
          targetSvg = this.svgFront;
        } else {
          group.classList.add('is-faded');
          targetSvg = this.svgBack;
        }
      }

      // Hover / Interaction logic
      group.addEventListener('mouseenter', () => {
        group.classList.add('active');
        this.highlightTable(rel.fromTable, true);
        this.highlightTable(rel.toTable, true);
      });

      group.addEventListener('mouseleave', () => {
        group.classList.remove('active');
        // Restore selection-driven styles instead of blindly stripping classes,
        // so hovering a line never erases the active table focus highlight
        this.applyCardFocusStyles();
      });

      targetSvg.appendChild(group);
    });

    this.drawRoutineLinks();
  }

  drawRoutineLinks() {
    this.routineLinks.forEach((link, index) => {
      const routine = this.routines[link.routine];
      const table = this.tables[link.table];
      if (!routine || !table || routine.x === undefined || table.x === undefined) return;
      if (!this.isRoutineVisible(routine)) return;

      const rEl = this.getCardEl(routine.name);
      const tEl = this.getCardEl(table.name);
      const rw = (rEl && rEl.offsetWidth) || 200;
      const rh = (rEl && rEl.offsetHeight) || 56;
      const tw = (tEl && tEl.offsetWidth) || 240;

      // Routine connects from its side; table receives on its header
      const routineOnLeft = routine.x + rw / 2 < table.x + tw / 2;
      const fromX = routineOnLeft ? routine.x + rw : routine.x;
      const fromY = routine.y + rh / 2;
      const toX = routineOnLeft ? table.x : table.x + tw;
      const toY = table.y + 24;

      const dx = Math.max(50, Math.abs(toX - fromX) / 1.5);
      const cp1x = routineOnLeft ? fromX + dx : fromX - dx;
      const cp2x = routineOnLeft ? toX - dx : toX + dx;
      const pathData = `M ${fromX} ${fromY} C ${cp1x} ${fromY}, ${cp2x} ${toY}, ${toX} ${toY}`;

      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const kindClass = routine.kind === 'trigger' ? 'routine-link-trigger' : 'routine-link-proc';
      group.setAttribute('class', `relationship-group routine-link ${kindClass}`);
      group.setAttribute('data-routine-link-index', index);

      const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glowLine.setAttribute('d', pathData);
      glowLine.setAttribute('class', 'rel-glow-line');

      const mainLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      mainLine.setAttribute('d', pathData);
      mainLine.setAttribute('class', 'rel-main-line');

      group.appendChild(glowLine);
      group.appendChild(mainLine);

      const isRelated = this.selectedTable &&
        (link.routine === this.selectedTable || link.table === this.selectedTable);
      let targetSvg = this.svgBack;

      if (this.selectedTable) {
        if (isRelated) {
          group.classList.add('highlight-active');
          targetSvg = this.svgFront || this.svgBack;
        } else {
          group.classList.add('is-faded');
        }
      }

      group.addEventListener('mouseenter', () => {
        group.classList.add('active');
        this.highlightTable(link.routine, true);
        this.highlightTable(link.table, true);
      });

      group.addEventListener('mouseleave', () => {
        group.classList.remove('active');
        this.applyCardFocusStyles();
      });

      targetSvg.appendChild(group);
    });
  }

  highlightTable(tableName, active) {
    const cardEl = this.getCardEl(tableName);
    if (cardEl) {
      if (active) {
        cardEl.classList.add('highlight-connected');
      } else {
        cardEl.classList.remove('highlight-connected');
      }
    }
  }

  arrangeLayout(type = 'grid') {
    // A full re-arrange invalidates focus mode and its saved return positions
    if (this.focusAnimFrame) cancelAnimationFrame(this.focusAnimFrame);
    this.focusAnimFrame = null;
    this.focusReturnPositions = null;
    if (this.selectedTable) {
      this.selectedTable = null;
      if (this.onFocusChange) this.onFocusChange(null);
    }

    this.computeLayout(type);
    this.render();
    // Frame the result so the arrangement is immediately visible
    this.fitToScreen();
    if (this.onStateChange) this.onStateChange();
  }

  computeLayout(type = 'grid') {
    const w = this.container.clientWidth || 1200;
    const h = this.container.clientHeight || 800;
    const allNodes = this.getAllNodes();
    const keys = Object.keys(allNodes);

    if (keys.length === 0) return;

    if (type === 'grid') {
      const cardWidth = 240;
      const gapX = 120;
      const gapY = 60;
      
      const count = keys.length;
      const containerW = w || 1200;
      const containerH = h || 800;
      const aspect = containerW / containerH;
      
      // Average cell width and estimated average cell height
      const wCell = cardWidth + gapX; // 360
      const hCell = 310; // Avg card height (~250px) + gapY (~60px)
      
      // Calculate optimal column count to match the window's aspect ratio
      let cols = Math.round(Math.sqrt(aspect * count * hCell / wCell));
      cols = Math.max(2, Math.min(count, cols)); // Clamp columns count
      
      // Track the next available Y coordinate for each column
      const colY = new Array(cols).fill(80);

      keys.forEach((key) => {
        const node = allNodes[key];

        // Find the column with the minimum height to place the node
        let minColIdx = 0;
        let minY = colY[0];
        for (let c = 1; c < cols; c++) {
          if (colY[c] < minY) {
            minY = colY[c];
            minColIdx = c;
          }
        }

        // Assign coordinates
        node.x = 80 + minColIdx * wCell;
        node.y = minY;

        // Estimate height: tables = header + columns; routines = small card
        const estimatedHeight = node.columns ? 50 + (node.columns.length * 33) : 80;

        // Advance Y for this column
        colY[minColIdx] += estimatedHeight + gapY;
      });
    } 
    else if (type === 'circle') {
      const count = keys.length;
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(centerX, centerY) * 0.65;

      keys.forEach((key, index) => {
        const angle = (index / count) * 2 * Math.PI;
        allNodes[key].x = centerX + radius * Math.cos(angle) - 120;
        allNodes[key].y = centerY + radius * Math.sin(angle) - 100;
      });
    } 
    else if (type === 'force') {
      // Force-directed layout over tables + routines.
      // Springs have a size-aware rest length and a final pass removes
      // any remaining card overlap (cards are rectangles, not points).
      const nodes = keys.map(key => allNodes[key]);
      const count = nodes.length;
      const centerX = w / 2;
      const centerY = h / 2;

      // Real card dimensions when rendered; estimates otherwise
      const dims = nodes.map(node => {
        const el = this.getCardEl(node.name);
        return {
          w: (el && el.offsetWidth) || (node.columns ? 240 : 200),
          h: (el && el.offsetHeight) || (node.columns ? 50 + node.columns.length * 33 : 60)
        };
      });

      // Initial circle to avoid degenerate stacking
      const radius = Math.max(300, count * 30);
      nodes.forEach((node, i) => {
        const angle = (i / count) * 2 * Math.PI;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });

      // Resolve links to node indices once
      const nameToIdx = new Map(nodes.map((n, i) => [n.name, i]));
      const links = [];
      this.getAllLinkPairs().forEach(([a, b]) => {
        const ai = nameToIdx.get(a);
        const bi = nameToIdx.get(b);
        if (ai === undefined || bi === undefined || ai === bi) return;
        links.push([ai, bi]);
      });

      // Ideal separation between two nodes, derived from their sizes
      const sep = (i, j) => (dims[i].w + dims[j].w) / 2 + (dims[i].h + dims[j].h) / 2;

      const iterations = 220;
      for (let step = 0; step < iterations; step++) {
        const cooling = 1 - step / iterations;
        const forces = nodes.map(() => ({ fx: 0, fy: 0 }));

        // Repulsion between all node pairs (size-aware)
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const dx = (nodes[i].x + dims[i].w / 2) - (nodes[j].x + dims[j].w / 2);
            const dy = (nodes[i].y + dims[i].h / 2) - (nodes[j].y + dims[j].h / 2);
            const rawDist = Math.hypot(dx, dy);
            const dist = Math.max(40, rawDist || 1);
            const ideal = sep(i, j) * 0.9;

            if (dist < ideal * 2.5) {
              const f = (ideal * ideal) / dist * 0.35;
              const dirX = rawDist === 0 ? Math.cos(i) : dx / rawDist;
              const dirY = rawDist === 0 ? Math.sin(i) : dy / rawDist;
              forces[i].fx += dirX * f;
              forces[i].fy += dirY * f;
              forces[j].fx -= dirX * f;
              forces[j].fy -= dirY * f;
            }
          }
        }

        // Springs on links WITH a rest length: attract only when farther
        // than it, push apart when closer (the old version collapsed hubs)
        links.forEach(([ai, bi]) => {
          const dx = (nodes[ai].x + dims[ai].w / 2) - (nodes[bi].x + dims[bi].w / 2);
          const dy = (nodes[ai].y + dims[ai].h / 2) - (nodes[bi].y + dims[bi].h / 2);
          const dist = Math.hypot(dx, dy) || 1;
          const rest = sep(ai, bi) * 0.8 + 60;
          const f = (dist - rest) * 0.08;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          forces[ai].fx -= fx;
          forces[ai].fy -= fy;
          forces[bi].fx += fx;
          forces[bi].fy += fy;
        });

        // Apply with cooling and displacement clamp
        nodes.forEach((node, i) => {
          let dispX = forces[i].fx * 0.1 * cooling;
          let dispY = forces[i].fy * 0.1 * cooling;
          const maxDisp = 40 * cooling + 5;
          const dispDist = Math.hypot(dispX, dispY);
          if (dispDist > maxDisp) {
            dispX = (dispX / dispDist) * maxDisp;
            dispY = (dispY / dispDist) * maxDisp;
          }
          node.x += dispX;
          node.y += dispY;
        });
      }

      // Final pass: remove any remaining rectangle overlap
      const margin = 40;
      for (let pass = 0; pass < 60; pass++) {
        let moved = false;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const cxi = nodes[i].x + dims[i].w / 2;
            const cyi = nodes[i].y + dims[i].h / 2;
            const cxj = nodes[j].x + dims[j].w / 2;
            const cyj = nodes[j].y + dims[j].h / 2;
            const overlapX = (dims[i].w + dims[j].w) / 2 + margin - Math.abs(cxi - cxj);
            const overlapY = (dims[i].h + dims[j].h) / 2 + margin - Math.abs(cyi - cyj);

            if (overlapX > 0 && overlapY > 0) {
              moved = true;
              // Push apart along the axis needing the smallest shift
              if (overlapX < overlapY) {
                const shift = (overlapX / 2 + 1) * (cxi >= cxj ? 1 : -1);
                nodes[i].x += shift;
                nodes[j].x -= shift;
              } else {
                const shift = (overlapY / 2 + 1) * (cyi >= cyj ? 1 : -1);
                nodes[i].y += shift;
                nodes[j].y -= shift;
              }
            }
          }
        }
        if (!moved) break;
      }

      // Re-center the result on the viewport
      let avgX = 0, avgY = 0;
      nodes.forEach(n => { avgX += n.x; avgY += n.y; });
      avgX /= count;
      avgY /= count;
      const shiftX = centerX - avgX;
      const shiftY = centerY - avgY;
      nodes.forEach(n => {
        n.x += shiftX;
        n.y += shiftY;
      });
    }
  }

  toggleTableFocus(tableName) {
    if (this.selectedTable === tableName) {
      this.clearTableFocus();
    } else {
      this.focusTableRelationships(tableName);
    }
  }

  clearTableFocus() {
    this.selectedTable = null;
    this.applyCardFocusStyles();

    // Fly displaced nodes back to their original coordinates
    const targets = {};
    if (this.focusReturnPositions) {
      for (const name in this.focusReturnPositions) {
        const node = this.tables[name] || this.routines[name];
        if (node) targets[name] = { ...this.focusReturnPositions[name] };
      }
      this.focusReturnPositions = null;
    }

    // Zoom out to frame the whole diagram (at the restored positions)
    const camera = this.computeFitCamera(targets);

    if (Object.keys(targets).length || camera) {
      this.animateNodes(targets, camera, () => {
        if (this.onStateChange) this.onStateChange();
      });
    } else {
      this.drawRelationships();
    }

    if (this.onFocusChange) this.onFocusChange(null);
  }

  focusTableRelationships(tableName) {
    this.selectedTable = tableName;
    this.applyCardFocusStyles();
    // Redraw lines: drawRelationships routes related lines to svgFront
    // with .highlight-active and fades the rest in svgBack
    this.drawRelationships();
    // Temporarily gather the related nodes around the focused one
    this.applyFocusLayout(tableName);
    if (this.onFocusChange) this.onFocusChange(tableName);
  }

  getNodeDims(name) {
    const node = this.tables[name] || this.routines[name];
    const el = this.getCardEl(name);
    return {
      w: (el && el.offsetWidth) || (node && node.columns ? 240 : 200),
      h: (el && el.offsetHeight) || (node && node.columns ? 50 + node.columns.length * 33 : 60)
    };
  }

  applyFocusLayout(centerName) {
    const centerNode = this.tables[centerName] || this.routines[centerName];
    if (!centerNode || centerNode.x === undefined) return;

    if (!this.focusReturnPositions) this.focusReturnPositions = {};

    const involvedNames = [...this.getConnectedTables(centerName)].filter(name => {
      if (name === centerName) return false;
      if (this.tables[name]) return true;
      const routine = this.routines[name];
      return routine && this.isRoutineVisible(routine);
    });

    const cDim = this.getNodeDims(centerName);
    const cCy = centerNode.y + cDim.h / 2;

    // Split related nodes between the two flanks of the focused node
    const left = [], right = [];
    involvedNames.forEach((name, i) => (i % 2 === 0 ? right : left).push(name));

    const targets = {};
    const gapY = 40;
    const gapX = 120;
    const colW = 250; // column slot width (card + slack)

    const vw = this.container.clientWidth || 1200;
    const vh = this.container.clientHeight || 800;

    // Each side fills as many columns as needed so the cluster's shape
    // roughly matches the viewport aspect — wide, not one endless column
    const placeSide = (names, side) => {
      if (!names.length) return;
      const totalH = names.reduce((sum, n) => sum + this.getNodeDims(n).h + gapY, 0);

      // Solve for the column height limit L from the side's aspect ratio:
      // aspect * L^2 - (centerW/2) * L - totalH * slotW = 0
      const aspect = Math.max(0.4, (vw / 2) / vh);
      const qb = -(cDim.w / 2);
      const qc = -totalH * (colW + gapX);
      let L = (-qb + Math.sqrt(qb * qb - 4 * aspect * qc)) / (2 * aspect);
      L = Math.max(L, this.getNodeDims(names[0]).h + gapY, cDim.h);

      // Greedy fill: stack cards in a column until L, then open the next
      const columns = [[]];
      const colHeights = [0];
      names.forEach(name => {
        const h = this.getNodeDims(name).h + gapY;
        let c = columns.length - 1;
        if (colHeights[c] > 0 && colHeights[c] + h > L) {
          columns.push([]);
          colHeights.push(0);
          c++;
        }
        columns[c].push(name);
        colHeights[c] += h;
      });

      columns.forEach((colNames, c) => {
        const colH = colHeights[c] - gapY;
        let cursor = cCy - colH / 2;
        const colX = side === 'right'
          ? centerNode.x + cDim.w + gapX + c * (colW + gapX)
          : centerNode.x - gapX - colW - c * (colW + gapX);
        colNames.forEach(name => {
          const d = this.getNodeDims(name);
          // On the left flank, right-align cards toward the center (shorter lines)
          targets[name] = {
            x: side === 'left' ? colX + (colW - d.w) : colX,
            y: cursor
          };
          cursor += d.h + gapY;
        });
      });
    };
    placeSide(right, 'right');
    placeSide(left, 'left');

    // Nodes displaced by a previous focus that are not part of this one fly home
    for (const name in this.focusReturnPositions) {
      if (!(name in targets) && name !== centerName) {
        const node = this.tables[name] || this.routines[name];
        if (node) targets[name] = { ...this.focusReturnPositions[name] };
      }
    }

    // Record originals for newly displaced nodes (keep earlier originals intact)
    involvedNames.forEach(name => {
      if (!(name in this.focusReturnPositions)) {
        const node = this.tables[name] || this.routines[name];
        if (node) this.focusReturnPositions[name] = { x: node.x, y: node.y };
      }
    });

    // Camera target: frame the whole cluster
    let minX = centerNode.x, minY = centerNode.y;
    let maxX = centerNode.x + cDim.w, maxY = centerNode.y + cDim.h;
    involvedNames.forEach(name => {
      const t = targets[name];
      if (!t) return;
      const d = this.getNodeDims(name);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + d.w);
      maxY = Math.max(maxY, t.y + d.h);
    });

    const pad = 80;
    const cw = this.container.clientWidth || 1200;
    const ch = this.container.clientHeight || 800;
    const zoom = Math.max(0.15, Math.min(1.1, Math.min(
      cw / (maxX - minX + pad * 2),
      ch / (maxY - minY + pad * 2)
    )));
    const camera = {
      zoom,
      panX: cw / 2 - (minX + (maxX - minX) / 2) * zoom,
      panY: ch / 2 - (minY + (maxY - minY) / 2) * zoom
    };

    this.animateNodes(targets, camera);
  }

  animateNodes(targets, camera = null, onDone = null) {
    if (this.focusAnimFrame) cancelAnimationFrame(this.focusAnimFrame);

    const start = {};
    for (const name in targets) {
      const node = this.tables[name] || this.routines[name];
      if (node) start[name] = { x: node.x, y: node.y };
    }
    const camStart = camera ? { zoom: this.zoom, panX: this.panX, panY: this.panY } : null;

    // animDuration <= 0: apply instantly, no animation
    if (this.animDuration <= 0) {
      for (const name in targets) {
        const node = this.tables[name] || this.routines[name];
        if (!node) continue;
        node.x = targets[name].x;
        node.y = targets[name].y;
        const el = this.getCardEl(name);
        if (el) {
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
        }
      }
      if (camera) {
        this.zoom = camera.zoom;
        this.panX = camera.panX;
        this.panY = camera.panY;
        this.updateTransform();
      }
      this.drawRelationships();
      if (onDone) onDone();
      return;
    }

    const duration = this.animDuration;
    let t0 = null; // anchor to the first rAF timestamp (same clock as `now`)

    const tick = (now) => {
      if (t0 === null) t0 = now;
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

      for (const name in start) {
        const node = this.tables[name] || this.routines[name];
        if (!node) continue;
        node.x = start[name].x + (targets[name].x - start[name].x) * ease;
        node.y = start[name].y + (targets[name].y - start[name].y) * ease;
        const el = this.getCardEl(name);
        if (el) {
          el.style.left = `${node.x}px`;
          el.style.top = `${node.y}px`;
        }
      }

      if (camera && camStart) {
        this.zoom = camStart.zoom + (camera.zoom - camStart.zoom) * ease;
        this.panX = camStart.panX + (camera.panX - camStart.panX) * ease;
        this.panY = camStart.panY + (camera.panY - camStart.panY) * ease;
        this.updateTransform();
      }

      this.drawRelationships();

      if (t < 1) {
        this.focusAnimFrame = requestAnimationFrame(tick);
      } else {
        this.focusAnimFrame = null;
        if (onDone) onDone();
      }
    };

    this.focusAnimFrame = requestAnimationFrame(tick);
  }

  getConnectedTables(tableName) {
    const connected = new Set();
    if (!tableName) return connected;
    connected.add(tableName);
    this.relationships.forEach(rel => {
      if (rel.fromTable === tableName) connected.add(rel.toTable);
      if (rel.toTable === tableName) connected.add(rel.fromTable);
    });
    // Routine links connect in both directions (table→routine, routine→table)
    this.routineLinks.forEach(link => {
      if (link.routine === tableName) connected.add(link.table);
      if (link.table === tableName) connected.add(link.routine);
    });
    return connected;
  }

  applyCardFocusStyles() {
    const connectedTables = this.getConnectedTables(this.selectedTable);
    const containers = [this.cardContainer];
    if (this.cardTopContainer) containers.push(this.cardTopContainer);

    containers.forEach(container => {
      container.querySelectorAll('.table-card, .routine-card').forEach(card => {
        const name = card.getAttribute('data-table-card') || card.getAttribute('data-routine-card');
        card.classList.remove('highlight-focused', 'highlight-connected', 'is-faded');

        let involved = false;
        if (this.selectedTable) {
          if (name === this.selectedTable) {
            card.classList.add('highlight-focused');
            involved = true;
          } else if (connectedTables.has(name)) {
            card.classList.add('highlight-connected');
            involved = true;
          } else {
            card.classList.add('is-faded');
          }
        }

        // Layering: involved cards live in the elevated container (above svg-front)
        // so highlighted lines pass under them; everyone else stays in the base layer.
        // Only re-parent when needed — moving a node mid-click suppresses the click event.
        const targetContainer = (involved && this.cardTopContainer) ? this.cardTopContainer : this.cardContainer;
        if (card.parentElement !== targetContainer) {
          targetContainer.appendChild(card);
        }
      });
    });
  }
}

window.ERCanvas = ERCanvas;
