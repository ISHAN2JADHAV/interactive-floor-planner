/**
 * FloorPlan Studio Pro - Core Application Engine
 * Interactive 2D Floor Planner, CAD Underlay, Seating & Guest Management System
 */

// Global Application State
const STATE = {
  projectName: 'Grand Ballroom Gala 2026',
  venue: {
    widthM: 30,
    heightM: 20,
    pxPerMeter: 40,
    get widthPx() { return this.widthM * this.pxPerMeter; },
    get heightPx() { return this.heightM * this.pxPerMeter; }
  },
  elements: [],
  guests: [],
  selectedIds: [],
  activeTool: 'select', // 'select' | 'pan' | 'ruler'
  viewMode: 'design',   // 'design' | 'seating' | 'present'
  zoom: 1.0,
  pan: { x: 0, y: 0 },
  snapToGrid: true,
  gridSize: 20,
  preventOverlap: true,
  layers: {
    grid: true,
    seats: true,
    guestNames: true,
    dimensions: true,
    zones: true
  },
  role: 'planner',      // 'planner' | 'venue' | 'client' | 'caterer'
  hasEditLock: true,
  bgImage: null,
  bgOpacity: 0.4,
  bgVisible: true,
  history: [],
  historyIndex: -1,
  ruler: null, // { start: {x,y}, end: {x,y} }
  alignmentGuides: [] // { type: 'h'|'v', pos }
};

// --- DOM Element References ---
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapRect = document.getElementById('minimap-rect');

// Top Header Elements
const projectTitleInput = document.getElementById('project-title-input');
const saveStatusText = document.getElementById('save-status-text');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnExportDropdown = document.getElementById('btn-export-dropdown');
const exportMenu = document.getElementById('export-menu');

// Floating HUDs
const selectionQuickBar = document.getElementById('selection-quick-bar');
const hudTableLabel = document.getElementById('hud-table-label');
const multiAlignBar = document.getElementById('multi-align-bar');
const selectedCountBadge = document.getElementById('selected-count');
const zoomIndicator = document.getElementById('zoom-indicator');
const readonlyBanner = document.getElementById('readonly-banner');

// Modals
const modalGuestDirectory = document.getElementById('modal-guest-directory');
const modalTemplates = document.getElementById('modal-templates');
const modalShortcuts = document.getElementById('modal-shortcuts');
const seatPickerPopup = document.getElementById('seat-picker-popup');
const toastContainer = document.getElementById('toast-container');

// Sound synthesizer via Web Audio
let audioCtx = null;
function playUiSound(type = 'click') {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'click') {
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'snap') {
      osc.frequency.setValueAtTime(520, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
      osc.start(); osc.stop(audioCtx.currentTime + 0.07);
    } else if (type === 'pop') {
      osc.frequency.setValueAtTime(1100, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.start(); osc.stop(audioCtx.currentTime + 0.08);
    }
  } catch (e) {}
}

// --- Toast System ---
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${msg}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// --- Activity Stream Logger ---
function logActivity(text) {
  const stream = document.getElementById('activity-stream');
  if (!stream) return;
  const entry = document.createElement('div');
  entry.className = 'stream-entry';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const roleName = STATE.role === 'planner' ? 'Planner' : STATE.role === 'venue' ? 'Venue Mgr' : STATE.role === 'client' ? 'Client' : 'Caterer';
  entry.innerHTML = `<span class="time">[${time}]</span> <span class="user">${roleName}:</span> ${text}`;
  stream.appendChild(entry);
  stream.scrollTop = stream.scrollHeight;
}

// --- History / Undo-Redo System ---
let autosaveTimer = null;
function saveState(actionDescription) {
  if (STATE.historyIndex < STATE.history.length - 1) {
    STATE.history = STATE.history.slice(0, STATE.historyIndex + 1);
  }
  const snapshot = {
    projectName: STATE.projectName,
    venue: { ...STATE.venue },
    elements: JSON.parse(JSON.stringify(STATE.elements)),
    guests: JSON.parse(JSON.stringify(STATE.guests))
  };
  STATE.history.push({ snapshot, desc: actionDescription });
  if (STATE.history.length > 50) STATE.history.shift();
  STATE.historyIndex = STATE.history.length - 1;

  updateUndoRedoButtons();
  triggerAutosave();
  if (actionDescription) logActivity(actionDescription);
  updateAllPanels();
}

function undo() {
  if (!STATE.hasEditLock || STATE.historyIndex <= 0) return;
  STATE.historyIndex--;
  restoreSnapshot(STATE.history[STATE.historyIndex].snapshot);
  playUiSound('pop');
  logActivity('Performed Undo');
  showToast('Undo executed');
}

function redo() {
  if (!STATE.hasEditLock || STATE.historyIndex >= STATE.history.length - 1) return;
  STATE.historyIndex++;
  restoreSnapshot(STATE.history[STATE.historyIndex].snapshot);
  playUiSound('pop');
  logActivity('Performed Redo');
  showToast('Redo executed');
}

function restoreSnapshot(snap) {
  STATE.projectName = snap.projectName || STATE.projectName;
  projectTitleInput.value = STATE.projectName;
  STATE.elements = JSON.parse(JSON.stringify(snap.elements));
  STATE.guests = JSON.parse(JSON.stringify(snap.guests));
  STATE.selectedIds = [];
  updateUndoRedoButtons();
  updateAllPanels();
  render();
}

function updateUndoRedoButtons() {
  btnUndo.disabled = !STATE.hasEditLock || STATE.historyIndex <= 0;
  btnRedo.disabled = !STATE.hasEditLock || STATE.historyIndex >= STATE.history.length - 1;
}

function triggerAutosave() {
  saveStatusText.innerText = "Saving...";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveStatusText.innerText = "Autosaved";
    try {
      localStorage.setItem('floorplan_pro_state', JSON.stringify({
        projectName: STATE.projectName,
        venue: STATE.venue,
        elements: STATE.elements,
        guests: STATE.guests
      }));
    } catch(e) {}
  }, 600);
}

// --- Unique ID Counter ---
let idCounter = Date.now();
function generateId(prefix = 'elem_') {
  return prefix + (idCounter++);
}

// --- Element Factory ---
function createElement(type, x, y) {
  const id = generateId('elem_');
  let elem = {
    id,
    type,
    x,
    y,
    w: 80,
    h: 80,
    rot: 0,
    seats: 8,
    label: '',
    color: '#242634',
    borderStyle: 'solid',
    locked: false,
    z: STATE.elements.length + 1
  };

  const tableCount = STATE.elements.filter(e => isTableType(e.type)).length + 1;

  switch (type) {
    case 'round':
      elem.w = 90; elem.h = 90; elem.seats = 8;
      elem.label = `Table ${tableCount}`;
      break;
    case 'rect':
      elem.w = 140; elem.h = 70; elem.seats = 6;
      elem.label = `Table ${tableCount}`;
      break;
    case 'square':
      elem.w = 80; elem.h = 80; elem.seats = 4;
      elem.label = `Table ${tableCount}`;
      break;
    case 'oval':
      elem.w = 160; elem.h = 90; elem.seats = 10;
      elem.label = `Imperial Table ${tableCount}`;
      break;
    case 'cocktail':
      elem.w = 46; elem.h = 46; elem.seats = 4;
      elem.color = '#382b1d';
      elem.label = `HighTop ${tableCount}`;
      break;
    case 'classroom':
      elem.w = 150; elem.h = 45; elem.seats = 6;
      elem.color = '#1c2838';
      elem.label = `Row ${tableCount}`;
      break;
    case 'ushape':
      elem.w = 160; elem.h = 120; elem.seats = 12;
      elem.color = '#271f38';
      elem.label = `Executive Table`;
      break;
    case 'serpentine':
      elem.w = 160; elem.h = 70; elem.seats = 8;
      elem.color = '#3b1c2e';
      elem.label = `Curved Table`;
      break;
    case 'stage':
      elem.w = 260; elem.h = 120; elem.seats = 0;
      elem.color = '#1e3a8a';
      elem.label = 'Main Stage';
      break;
    case 'dancefloor':
      elem.w = 220; elem.h = 220; elem.seats = 0;
      elem.color = '#312e81';
      elem.label = 'Dance Floor';
      break;
    case 'bar':
      elem.w = 180; elem.h = 60; elem.seats = 0;
      elem.color = '#78350f';
      elem.label = 'Cocktail Bar';
      break;
    case 'djbooth':
      elem.w = 100; elem.h = 70; elem.seats = 0;
      elem.color = '#831843';
      elem.label = 'DJ Booth';
      break;
    case 'photobooth':
      elem.w = 90; elem.h = 90; elem.seats = 0;
      elem.color = '#065f46';
      elem.label = 'Photo Booth';
      break;
    case 'lounge':
      elem.w = 140; elem.h = 70; elem.seats = 0;
      elem.color = '#334155';
      elem.label = 'VIP Lounge';
      break;
    case 'wall':
      elem.w = 180; elem.h = 14; elem.seats = 0;
      elem.color = '#e2e8f0';
      elem.label = 'Wall';
      break;
    case 'pillar':
      elem.w = 34; elem.h = 34; elem.seats = 0;
      elem.color = '#64748b';
      elem.label = 'Pillar';
      break;
    case 'door':
      elem.w = 60; elem.h = 20; elem.seats = 0;
      elem.color = '#991b1b';
      elem.label = 'Exit Door';
      break;
    case 'zone':
      elem.w = 300; elem.h = 200; elem.seats = 0;
      elem.color = 'rgba(99, 102, 241, 0.12)';
      elem.label = 'VIP Zone';
      break;
  }
  return elem;
}

function isTableType(type) {
  return ['round', 'rect', 'square', 'oval', 'cocktail', 'classroom', 'ushape', 'serpentine'].includes(type);
}

// --- Seat Reflow Geometry Math ---
function getSeatPositions(t) {
  if (!isTableType(t.type) || t.seats <= 0) return [];
  const positions = [];
  const offset = 18; // Distance from table edge

  if (t.type === 'round' || t.type === 'cocktail') {
    const radius = t.w / 2 + offset;
    for (let i = 0; i < t.seats; i++) {
      const angle = (i * 2 * Math.PI) / t.seats - Math.PI / 2;
      positions.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        seatIndex: i,
        angle: angle + Math.PI / 2
      });
    }
  } else if (t.type === 'rect' || t.type === 'square') {
    const w = t.w;
    const h = t.h;
    const perimeter = 2 * (w + h);
    const step = perimeter / t.seats;

    for (let i = 0; i < t.seats; i++) {
      let d = i * step + step / 2;
      let sx, sy, ang;

      if (d < w) { // Top edge
        sx = -w/2 + d; sy = -h/2 - offset; ang = 0;
      } else if (d < w + h) { // Right edge
        sx = w/2 + offset; sy = -h/2 + (d - w); ang = Math.PI / 2;
      } else if (d < 2 * w + h) { // Bottom edge
        sx = w/2 - (d - (w + h)); sy = h/2 + offset; ang = Math.PI;
      } else { // Left edge
        sx = -w/2 - offset; sy = h/2 - (d - (2 * w + h)); ang = -Math.PI / 2;
      }
      positions.push({ x: sx, y: sy, seatIndex: i, angle: ang });
    }
  } else if (t.type === 'oval') {
    const a = t.w / 2 + offset;
    const b = t.h / 2 + offset;
    for (let i = 0; i < t.seats; i++) {
      const angle = (i * 2 * Math.PI) / t.seats - Math.PI / 2;
      positions.push({
        x: a * Math.cos(angle),
        y: b * Math.sin(angle),
        seatIndex: i,
        angle: angle + Math.PI / 2
      });
    }
  } else if (t.type === 'classroom') {
    // Single-sided row seating (behind desk)
    const step = t.w / (t.seats + 1);
    for (let i = 0; i < t.seats; i++) {
      positions.push({
        x: -t.w/2 + step * (i + 1),
        y: t.h/2 + offset,
        seatIndex: i,
        angle: Math.PI
      });
    }
  } else if (t.type === 'ushape') {
    // Outer perimeter of U-shape
    const legWidth = t.w;
    const legHeight = t.h;
    const totalDist = legHeight + legWidth + legHeight;
    const step = totalDist / t.seats;
    for (let i = 0; i < t.seats; i++) {
      let d = i * step + step / 2;
      let sx, sy, ang;
      if (d < legHeight) { // Left leg
        sx = -legWidth/2 - offset; sy = -legHeight/2 + d; ang = -Math.PI/2;
      } else if (d < legHeight + legWidth) { // Bottom connector
        sx = -legWidth/2 + (d - legHeight); sy = legHeight/2 + offset; ang = Math.PI;
      } else { // Right leg
        sx = legWidth/2 + offset; sy = legHeight/2 - (d - (legHeight + legWidth)); ang = Math.PI/2;
      }
      positions.push({ x: sx, y: sy, seatIndex: i, angle: ang });
    }
  } else {
    // Generic circular fallback
    const radius = Math.max(t.w, t.h) / 2 + offset;
    for (let i = 0; i < t.seats; i++) {
      const angle = (i * 2 * Math.PI) / t.seats;
      positions.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        seatIndex: i,
        angle: angle
      });
    }
  }
  return positions;
}

// --- Overlap & Collision Prevention Math ---
function checkOverlap(targetElem, newX, newY) {
  if (!STATE.preventOverlap || targetElem.type === 'zone') return false;
  const targetRadius = Math.max(targetElem.w, targetElem.h) / 2 + (isTableType(targetElem.type) ? 22 : 8);

  for (let other of STATE.elements) {
    if (other.id === targetElem.id || other.type === 'zone') continue;
    const otherRadius = Math.max(other.w, other.h) / 2 + (isTableType(other.type) ? 22 : 8);
    const dx = newX - other.x;
    const dy = newY - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < (targetRadius + otherRadius) * 0.85) {
      return true; // Collision detected
    }
  }
  return false;
}

// --- Screen <-> World Space Transforms ---
function screenToWorld(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  const clickX = sx - rect.left;
  const clickY = sy - rect.top;
  const wx = (clickX - canvas.width / 2 - STATE.pan.x) / STATE.zoom;
  const wy = (clickY - canvas.height / 2 - STATE.pan.y) / STATE.zoom;
  return { x: wx, y: wy };
}

function worldToScreen(wx, wy) {
  const sx = wx * STATE.zoom + canvas.width / 2 + STATE.pan.x;
  const sy = wy * STATE.zoom + canvas.height / 2 + STATE.pan.y;
  return { x: sx, y: sy };
}

// --- Canvas Hit Testing ---
function hitTestElement(pos) {
  for (let i = STATE.elements.length - 1; i >= 0; i--) {
    const el = STATE.elements[i];
    // Rotate point back to element coordinate space
    const rad = (-el.rot * Math.PI) / 180;
    const dx = pos.x - el.x;
    const dy = pos.y - el.y;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    if (el.type === 'round' || el.type === 'cocktail' || el.type === 'pillar') {
      const dist = Math.sqrt(rx * rx + ry * ry);
      if (dist <= el.w / 2 + 10) return { element: el, type: 'body' };
    } else {
      if (Math.abs(rx) <= el.w / 2 + 8 && Math.abs(ry) <= el.h / 2 + 8) {
        return { element: el, type: 'body' };
      }
    }
  }
  return null;
}

function hitTestRotationGizmo(pos) {
  if (STATE.selectedIds.length !== 1) return null;
  const el = STATE.elements.find(e => e.id === STATE.selectedIds[0]);
  if (!el || el.locked) return null;

  // Gizmo position in world space
  const rad = (el.rot * Math.PI) / 180;
  const stemDist = el.h / 2 + 26;
  const gx = el.x + Math.sin(rad) * stemDist;
  const gy = el.y - Math.cos(rad) * stemDist;

  const dx = pos.x - gx;
  const dy = pos.y - gy;
  if (Math.sqrt(dx * dx + dy * dy) <= 12 / STATE.zoom) {
    return el;
  }
  return null;
}

function hitTestChair(pos) {
  for (let el of STATE.elements) {
    if (!isTableType(el.type)) continue;
    const seats = getSeatPositions(el);
    const rad = (el.rot * Math.PI) / 180;

    for (let s of seats) {
      // Rotate seat offset
      const wx = el.x + s.x * Math.cos(rad) - s.y * Math.sin(rad);
      const wy = el.y + s.x * Math.sin(rad) + s.y * Math.cos(rad);

      const dist = Math.sqrt((pos.x - wx) ** 2 + (pos.y - wy) ** 2);
      if (dist <= 12) {
        return { table: el, seatIndex: s.seatIndex, worldPos: { x: wx, y: wy } };
      }
    }
  }
  return null;
}

// --- Canvas Rendering Engine ---
function resizeCanvas() {
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
  render();
}
window.addEventListener('resize', resizeCanvas);

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  // Apply Viewport Transforms
  ctx.translate(canvas.width / 2 + STATE.pan.x, canvas.height / 2 + STATE.pan.y);
  ctx.scale(STATE.zoom, STATE.zoom);

  const vw = STATE.venue.widthPx;
  const vh = STATE.venue.heightPx;
  const vx = -vw / 2;
  const vy = -vh / 2;

  // 1. Venue Background Floor
  ctx.fillStyle = '#14151c';
  ctx.fillRect(vx, vy, vw, vh);

  // 2. Blueprint CAD Layer (if uploaded)
  if (STATE.bgImage && STATE.bgVisible) {
    ctx.save();
    ctx.globalAlpha = STATE.bgOpacity;
    ctx.drawImage(STATE.bgImage, vx, vy, vw, vh);
    ctx.restore();
  }

  // 3. Coordinate Grid
  if (STATE.layers.grid) {
    ctx.strokeStyle = '#20222e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = vx; x <= vx + vw; x += STATE.gridSize) {
      ctx.moveTo(x, vy); ctx.lineTo(x, vy + vh);
    }
    for (let y = vy; y <= vy + vh; y += STATE.gridSize) {
      ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y);
    }
    ctx.stroke();

    // 1-Meter Major Grid Lines
    const majorStep = STATE.venue.pxPerMeter;
    ctx.strokeStyle = '#2b2d3d';
    ctx.beginPath();
    for (let x = vx; x <= vx + vw; x += majorStep) {
      ctx.moveTo(x, vy); ctx.lineTo(x, vy + vh);
    }
    for (let y = vy; y <= vy + vh; y += majorStep) {
      ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y);
    }
    ctx.stroke();
  }

  // 4. Venue Boundary Outer Wall
  ctx.strokeStyle = '#474b63';
  ctx.lineWidth = 3;
  ctx.strokeRect(vx, vy, vw, vh);

  // 5. Render Zones First (Under furniture)
  if (STATE.layers.zones) {
    STATE.elements.filter(e => e.type === 'zone').forEach(z => drawElement(z));
  }

  // 6. Render Architectural Structures (Walls, Pillars, Doors)
  STATE.elements.filter(e => ['wall', 'pillar', 'door'].includes(e.type)).forEach(el => drawElement(el));

  // 7. Render Event Staging & Fixtures
  STATE.elements.filter(e => ['stage', 'dancefloor', 'bar', 'djbooth', 'photobooth', 'lounge'].includes(e.type)).forEach(el => drawElement(el));

  // 8. Render Tables & Seating
  STATE.elements.filter(e => isTableType(e.type)).forEach(t => drawElement(t));

  // 9. Smart Magnetic Alignment Guide Lines
  if (STATE.alignmentGuides && STATE.alignmentGuides.length > 0) {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let g of STATE.alignmentGuides) {
      if (g.type === 'v') {
        ctx.moveTo(g.pos, vy); ctx.lineTo(g.pos, vy + vh);
      } else {
        ctx.moveTo(vx, g.pos); ctx.lineTo(vx + vw, g.pos);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 10. Selection Gizmo & Bounding Boxes
  drawSelectionGizmo();

  // 11. Measurement Ruler Line (if active)
  if (STATE.ruler) {
    drawRuler();
  }

  ctx.restore();

  // Render Minimap Radar
  renderMinimap();
}

// --- Draw Individual Floor Plan Element ---
function drawElement(el) {
  const isSelected = STATE.selectedIds.includes(el.id);

  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.rotate((el.rot * Math.PI) / 180);

  // A. Draw Perimeter Chairs (if table)
  if (isTableType(el.type) && STATE.layers.seats) {
    drawTableChairs(el);
  }

  // B. Draw Main Element Body
  ctx.fillStyle = el.color;
  ctx.strokeStyle = isSelected ? '#6366f1' : (el.borderStyle === 'accent' ? '#f59e0b' : '#474b63');
  ctx.lineWidth = isSelected ? 3 : 2;

  if (el.borderStyle === 'dashed') ctx.setLineDash([6, 4]);

  if (el.type === 'round' || el.type === 'cocktail') {
    ctx.beginPath();
    ctx.arc(0, 0, el.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (el.type === 'oval') {
    ctx.beginPath();
    ctx.ellipse(0, 0, el.w / 2, el.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (el.type === 'pillar') {
    ctx.beginPath();
    ctx.arc(0, 0, el.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.stroke();
  } else if (el.type === 'dancefloor') {
    // Checkered dance floor pattern
    ctx.beginPath();
    ctx.roundRect(-el.w/2, -el.h/2, el.w, el.h, 6);
    ctx.fill();
    ctx.stroke();

    const sq = 25;
    ctx.fillStyle = '#4338ca';
    for (let row = -el.h/2; row < el.h/2; row += sq) {
      for (let col = -el.w/2; col < el.w/2; col += sq) {
        if ((Math.floor(row/sq) + Math.floor(col/sq)) % 2 === 0) {
          ctx.fillRect(col, row, Math.min(sq, el.w/2 - col), Math.min(sq, el.h/2 - row));
        }
      }
    }
  } else if (el.type === 'stage') {
    // Stage with wooden slats look
    ctx.beginPath();
    ctx.roundRect(-el.w/2, -el.h/2, el.w, el.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let lx = -el.w/2 + 20; lx < el.w/2; lx += 20) {
      ctx.beginPath(); ctx.moveTo(lx, -el.h/2); ctx.lineTo(lx, el.h/2); ctx.stroke();
    }
  } else if (el.type === 'ushape') {
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(-el.w/2 + 10, -el.h/2);
    ctx.lineTo(-el.w/2 + 10, el.h/2 - 10);
    ctx.lineTo(el.w/2 - 10, el.h/2 - 10);
    ctx.lineTo(el.w/2 - 10, -el.h/2);
    ctx.stroke();
  } else {
    // Standard rounded rectangle (rect, square, bar, lounge, wall, door, zone)
    ctx.beginPath();
    ctx.roundRect(-el.w/2, -el.h/2, el.w, el.h, el.type === 'zone' ? 10 : 4);
    ctx.fill();
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // C. Draw Element Label & Stats
  ctx.rotate((-el.rot * Math.PI) / 180); // Keep text horizontal
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 11px Plus Jakarta Sans, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (isTableType(el.type)) {
    const seatedCount = STATE.guests.filter(g => g.tableId === el.id).length;
    ctx.fillText(el.label, 0, -4);
    ctx.fillStyle = seatedCount === el.seats ? '#10b981' : '#94a3b8';
    ctx.font = '500 9px JetBrains Mono, monospace';
    ctx.fillText(`${seatedCount}/${el.seats} seated`, 0, 9);
  } else {
    ctx.fillText(el.label, 0, 0);
  }

  // D. Dimension Badge
  if (STATE.layers.dimensions && isSelected) {
    const wM = (el.w / STATE.venue.pxPerMeter).toFixed(1);
    const hM = (el.h / STATE.venue.pxPerMeter).toFixed(1);
    ctx.font = '500 9px JetBrains Mono, monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${wM}m × ${hM}m`, 0, el.h / 2 + 14);
  }

  ctx.restore();
}

// --- Draw Table Chairs with Seated Guest Metadata ---
function drawTableChairs(t) {
  const seats = getSeatPositions(t);
  const chairRadius = t.type === 'cocktail' ? 6 : 9;

  seats.forEach(s => {
    const assignedGuest = STATE.guests.find(g => g.tableId === t.id && g.seatIndex === s.seatIndex);

    ctx.save();
    ctx.translate(s.x, s.y);

    // Color code by dietary or VIP status
    let chairFill = '#2a2d3d';
    let chairStroke = '#64748b';

    if (assignedGuest) {
      if (assignedGuest.vip) {
        chairFill = '#ca8a04';
        chairStroke = '#fef08a';
      } else if (assignedGuest.dietary === 'Vegan') {
        chairFill = '#065f46'; chairStroke = '#34d399';
      } else if (assignedGuest.dietary === 'Vegetarian') {
        chairFill = '#166534'; chairStroke = '#4ade80';
      } else if (assignedGuest.dietary === 'Halal') {
        chairFill = '#0e7490'; chairStroke = '#38bdf8';
      } else if (assignedGuest.dietary === 'Kosher') {
        chairFill = '#4338ca'; chairStroke = '#818cf8';
      } else if (assignedGuest.dietary === 'Gluten-Free') {
        chairFill = '#b45309'; chairStroke = '#fbbf24';
      } else if (assignedGuest.dietary === 'Nut Allergy') {
        chairFill = '#be123c'; chairStroke = '#fb7185';
      } else {
        chairFill = '#4f46e5'; chairStroke = '#a5b4fc';
      }
    }

    ctx.fillStyle = chairFill;
    ctx.strokeStyle = chairStroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(0, 0, chairRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Chair Number
    ctx.rotate((-t.rot * Math.PI) / 180);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 8px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((s.seatIndex + 1).toString(), 0, 0);

    // Guest Name Tag Overlay (if enabled)
    if (assignedGuest && STATE.layers.guestNames) {
      ctx.font = '600 8px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#f8fafc';
      const shortName = assignedGuest.name.split(' ')[0];
      ctx.fillText(shortName, 0, chairRadius + 7);
    }

    ctx.restore();
  });
}

// --- Draw Selection Gizmo & Rotation Stem ---
function drawSelectionGizmo() {
  if (STATE.selectedIds.length === 0) return;

  if (STATE.selectedIds.length === 1) {
    const el = STATE.elements.find(e => e.id === STATE.selectedIds[0]);
    if (!el) return;

    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.rotate((el.rot * Math.PI) / 180);

    const pad = 8;
    const bw = el.w + pad * 2;
    const bh = el.h + pad * 2;

    // Bounding Box
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.setLineDash([]);

    // Top Rotation Handle & Stem
    if (!el.locked) {
      const stemDist = bh / 2 + 18;
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -bh / 2);
      ctx.lineTo(0, -stemDist);
      ctx.stroke();

      ctx.fillStyle = '#6366f1';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -stemDist, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  } else {
    // Multi-selection bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let id of STATE.selectedIds) {
      const el = STATE.elements.find(e => e.id === id);
      if (el) {
        minX = Math.min(minX, el.x - el.w / 2);
        minY = Math.min(minY, el.y - el.h / 2);
        maxX = Math.max(maxX, el.x + el.w / 2);
        maxY = Math.max(maxY, el.y + el.h / 2);
      }
    }
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
    ctx.setLineDash([]);
  }
}

// --- Draw Interactive Tape Measure Tool ---
function drawRuler() {
  const { start, end } = STATE.ruler;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // End Point Caps
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath(); ctx.arc(start.x, start.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(end.x, end.y, 4, 0, Math.PI * 2); ctx.fill();

  // Distance Measurement Label
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  const distMeters = (distPx / STATE.venue.pxPerMeter).toFixed(2);
  const distFeet = (distMeters * 3.28084).toFixed(1);

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  ctx.fillStyle = '#1e1e24';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(midX - 45, midY - 12, 90, 24, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${distMeters}m (${distFeet}ft)`, midX, midY);
}

// --- Minimap Radar Renderer ---
function renderMinimap() {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const vw = STATE.venue.widthPx;
  const vh = STATE.venue.heightPx;
  const scale = Math.min(minimapCanvas.width / vw, minimapCanvas.height / vh) * 0.9;
  const mx = minimapCanvas.width / 2;
  const my = minimapCanvas.height / 2;

  minimapCtx.save();
  minimapCtx.translate(mx, my);
  minimapCtx.scale(scale, scale);

  // Venue bounds
  minimapCtx.fillStyle = '#1e202c';
  minimapCtx.fillRect(-vw/2, -vh/2, vw, vh);
  minimapCtx.strokeStyle = '#474b63';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(-vw/2, -vh/2, vw, vh);

  // Mini elements
  for (let el of STATE.elements) {
    minimapCtx.fillStyle = STATE.selectedIds.includes(el.id) ? '#6366f1' : '#474b63';
    minimapCtx.fillRect(el.x - el.w/2, el.y - el.h/2, el.w, el.h);
  }

  minimapCtx.restore();

  // Viewport Frame Indicator
  const viewW = canvas.width / STATE.zoom;
  const viewH = canvas.height / STATE.zoom;
  const viewX = -STATE.pan.x / STATE.zoom - viewW / 2;
  const viewY = -STATE.pan.y / STATE.zoom - viewH / 2;

  const rectW = Math.min(viewW * scale, minimapCanvas.width);
  const rectH = Math.min(viewH * scale, minimapCanvas.height);
  const rectLeft = mx + (viewX * scale);
  const rectTop = my + (viewY * scale);

  minimapRect.style.left = `${Math.max(0, rectLeft)}px`;
  minimapRect.style.top = `${Math.max(0, rectTop)}px`;
  minimapRect.style.width = `${Math.max(10, rectW)}px`;
  minimapRect.style.height = `${Math.max(10, rectH)}px`;
}

// --- Canvas Interactive Mouse / Pointer Controller ---
let dragMode = null; // 'pan' | 'move' | 'rotate' | 'ruler' | 'marquee'
let dragStart = { x: 0, y: 0 };
let dragStartWorld = { x: 0, y: 0 };
let initialElementPositions = new Map();
let rotateTarget = null;
let marqueeRect = { x1: 0, y1: 0, x2: 0, y2: 0 };

canvas.addEventListener('mousedown', (e) => {
  const worldPos = screenToWorld(e.clientX, e.clientY);
  dragStart = { x: e.clientX, y: e.clientY };
  dragStartWorld = worldPos;

  // Middle Click or Space/Pan Tool -> Canvas Panning
  if (e.button === 1 || e.button === 2 || STATE.activeTool === 'pan' || e.spaceKey) {
    dragMode = 'pan';
    return;
  }

  // Ruler Mode
  if (STATE.activeTool === 'ruler') {
    dragMode = 'ruler';
    STATE.ruler = { start: worldPos, end: worldPos };
    render();
    return;
  }

  // Check Chair Click (Seat Picker Modal)
  const chairHit = hitTestChair(worldPos);
  if (chairHit) {
    openSeatPicker(chairHit.table, chairHit.seatIndex, e.clientX, e.clientY);
    return;
  }

  // Check Rotation Gizmo Click
  if (STATE.hasEditLock) {
    const rotElem = hitTestRotationGizmo(worldPos);
    if (rotElem) {
      dragMode = 'rotate';
      rotateTarget = rotElem;
      return;
    }
  }

  // Check Element Body Click
  const hit = hitTestElement(worldPos);
  if (hit) {
    const el = hit.element;
    if (e.shiftKey) {
      // Toggle selection
      if (STATE.selectedIds.includes(el.id)) {
        STATE.selectedIds = STATE.selectedIds.filter(id => id !== el.id);
      } else {
        STATE.selectedIds.push(el.id);
      }
    } else {
      if (!STATE.selectedIds.includes(el.id)) {
        STATE.selectedIds = [el.id];
      }
    }

    if (STATE.hasEditLock && !el.locked) {
      dragMode = 'move';
      initialElementPositions.clear();
      for (let id of STATE.selectedIds) {
        const item = STATE.elements.find(x => x.id === id);
        if (item) initialElementPositions.set(id, { x: item.x, y: item.y });
      }
    }
  } else {
    // Click on empty canvas -> Marquee selection or Deselect
    if (!e.shiftKey) {
      STATE.selectedIds = [];
    }
    dragMode = 'marquee';
    marqueeRect = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y };
  }

  playUiSound('click');
  updateAllPanels();
  render();
});

window.addEventListener('mousemove', (e) => {
  const worldPos = screenToWorld(e.clientX, e.clientY);

  if (dragMode === 'pan') {
    STATE.pan.x += (e.clientX - dragStart.x);
    STATE.pan.y += (e.clientY - dragStart.y);
    dragStart = { x: e.clientX, y: e.clientY };
    render();
    return;
  }

  if (dragMode === 'ruler' && STATE.ruler) {
    STATE.ruler.end = worldPos;
    render();
    return;
  }

  if (dragMode === 'rotate' && rotateTarget && STATE.hasEditLock) {
    const dx = worldPos.x - rotateTarget.x;
    const dy = worldPos.y - rotateTarget.y;
    let angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 90;
    if (angleDeg < 0) angleDeg += 360;

    if (e.shiftKey) {
      angleDeg = Math.round(angleDeg / 15) * 15; // 15-degree snap
    }
    rotateTarget.rot = angleDeg % 360;
    render();
    updatePropertiesPanel();
    return;
  }

  if (dragMode === 'move' && STATE.hasEditLock) {
    let dx = worldPos.x - dragStartWorld.x;
    let dy = worldPos.y - dragStartWorld.y;

    STATE.alignmentGuides = [];

    for (let id of STATE.selectedIds) {
      const el = STATE.elements.find(x => x.id === id);
      const orig = initialElementPositions.get(id);
      if (!el || !orig) continue;

      let newX = orig.x + dx;
      let newY = orig.y + dy;

      if (STATE.snapToGrid) {
        newX = Math.round(newX / STATE.gridSize) * STATE.gridSize;
        newY = Math.round(newY / STATE.gridSize) * STATE.gridSize;
      }

      // Check alignment guides against other elements
      for (let other of STATE.elements) {
        if (STATE.selectedIds.includes(other.id)) continue;
        if (Math.abs(newX - other.x) < 4) {
          newX = other.x;
          STATE.alignmentGuides.push({ type: 'v', pos: other.x });
        }
        if (Math.abs(newY - other.y) < 4) {
          newY = other.y;
          STATE.alignmentGuides.push({ type: 'h', pos: other.y });
        }
      }

      if (!checkOverlap(el, newX, newY)) {
        el.x = newX;
        el.y = newY;
      }
    }
    render();
    updatePropertiesPanel();
    return;
  }

  if (dragMode === 'marquee') {
    marqueeRect.x2 = worldPos.x;
    marqueeRect.y2 = worldPos.y;

    const minX = Math.min(marqueeRect.x1, marqueeRect.x2);
    const maxX = Math.max(marqueeRect.x1, marqueeRect.x2);
    const minY = Math.min(marqueeRect.y1, marqueeRect.y2);
    const maxY = Math.max(marqueeRect.y1, marqueeRect.y2);

    const insideIds = STATE.elements.filter(el =>
      el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY
    ).map(el => el.id);

    STATE.selectedIds = insideIds;
    render();
    updateAllPanels();
  }
});

window.addEventListener('mouseup', () => {
  if (dragMode === 'move') {
    STATE.alignmentGuides = [];
    saveState("Repositioned elements");
  } else if (dragMode === 'rotate') {
    saveState("Rotated element");
  }
  dragMode = null;
  rotateTarget = null;
  render();
});

// Canvas Context Menu Prevent
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Smooth Mouse Wheel Zoom (Centered at Cursor)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(Math.max(STATE.zoom * zoomFactor, 0.3), 3.0);

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left - canvas.width / 2 - STATE.pan.x;
  const mouseY = e.clientY - rect.top - canvas.height / 2 - STATE.pan.y;

  STATE.pan.x -= mouseX * (newZoom / STATE.zoom - 1);
  STATE.pan.y -= mouseY * (newZoom / STATE.zoom - 1);
  STATE.zoom = newZoom;

  zoomIndicator.innerText = `${Math.round(STATE.zoom * 100)}%`;
  render();
}, { passive: false });

// --- Sidebars & Inspectors Controller ---
function updateAllPanels() {
  updatePropertiesPanel();
  updateSeatingTab();
  updateSummaryStats();
  updateFloatingHud();
}

function updateFloatingHud() {
  if (STATE.selectedIds.length === 1) {
    const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
    if (el) {
      selectionQuickBar.style.display = 'flex';
      hudTableLabel.innerText = el.label;
    }
  } else {
    selectionQuickBar.style.display = 'none';
  }

  if (STATE.selectedIds.length > 1) {
    multiAlignBar.style.display = 'flex';
    selectedCountBadge.innerText = STATE.selectedIds.length;
  } else {
    multiAlignBar.style.display = 'none';
  }
}

function updatePropertiesPanel() {
  const noSel = document.getElementById('no-selection-msg');
  const form = document.getElementById('element-inspector');
  const tableSpecific = document.getElementById('table-specific-props');

  if (STATE.selectedIds.length !== 1) {
    noSel.style.display = 'flex';
    form.style.display = 'none';
    return;
  }

  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (!el) {
    noSel.style.display = 'flex';
    form.style.display = 'none';
    return;
  }

  noSel.style.display = 'none';
  form.style.display = 'block';

  document.getElementById('inspect-type-badge').innerText = el.type.toUpperCase();
  document.getElementById('prop-elem-label').value = el.label;
  document.getElementById('prop-elem-w').value = el.w;
  document.getElementById('prop-elem-h').value = el.h;
  document.getElementById('prop-elem-rot').value = el.rot;
  document.getElementById('prop-elem-color').value = el.color.startsWith('#') ? el.color : '#242634';
  document.getElementById('color-hex-label').innerText = el.color;
  document.getElementById('prop-border-style').value = el.borderStyle || 'solid';

  if (isTableType(el.type)) {
    tableSpecific.style.display = 'block';
    document.getElementById('prop-elem-seats').value = el.seats;
    const seated = STATE.guests.filter(g => g.tableId === el.id).length;
    document.getElementById('prop-elem-seated-count').value = `${seated} of ${el.seats} Filled`;
  } else {
    tableSpecific.style.display = 'none';
  }

  // Disable inputs if user lacks baton edit lock
  form.querySelectorAll('input, select, button').forEach(ctrl => {
    ctrl.disabled = !STATE.hasEditLock;
  });
}

function updateSeatingTab() {
  const manifest = document.getElementById('table-chair-manifest');
  const title = document.getElementById('seating-tab-table-name');
  const cap = document.getElementById('seating-tab-capacity');
  const badge = document.getElementById('table-seats-tab-badge');

  manifest.innerHTML = '';
  const selectedTable = STATE.elements.find(x => x.id === STATE.selectedIds[0] && isTableType(x.type));

  if (!selectedTable) {
    title.innerText = 'No Table Selected';
    cap.innerText = 'Select a table on canvas to view its seat manifest';
    badge.innerText = '0';
  } else {
    title.innerText = selectedTable.label;
    const seated = STATE.guests.filter(g => g.tableId === selectedTable.id);
    cap.innerText = `${seated.length} of ${selectedTable.seats} seats occupied`;
    badge.innerText = selectedTable.seats.toString();

    for (let i = 0; i < selectedTable.seats; i++) {
      const guest = seated.find(g => g.seatIndex === i);
      const row = document.createElement('div');
      row.className = 'chair-row';
      row.innerHTML = `
        <span class="chair-num">#${i + 1}</span>
        <div class="chair-guest-info">
          <strong>${guest ? guest.name : '<span class="text-muted">Empty Seat</span>'}</strong>
          ${guest ? `<span class="guest-tag tag-${guest.dietary.toLowerCase().replace(/[^a-z]/g,'')}">${guest.dietary} • ${guest.group}</span>` : ''}
        </div>
        <button class="btn btn-secondary text-xs" style="padding:3px 6px;" onclick="handleSeatRowClick('${selectedTable.id}', ${i})">
          ${guest ? 'Change' : 'Assign'}
        </button>
      `;
      manifest.appendChild(row);
    }
  }

  // Update Unassigned Pool
  const unassignedPool = document.getElementById('guest-drag-pool');
  const unassignedCount = document.getElementById('unassigned-count');
  unassignedPool.innerHTML = '';

  const unseatedGuests = STATE.guests.filter(g => !g.tableId);
  unassignedCount.innerText = unseatedGuests.length.toString();

  unseatedGuests.slice(0, 30).forEach(g => {
    const chip = document.createElement('div');
    chip.className = `guest-chip ${g.vip ? 'vip' : ''}`;
    chip.innerHTML = `<span>${g.vip ? '👑 ' : ''}${g.name}</span><small class="text-muted">(${g.group})</small>`;
    chip.title = `Dietary: ${g.dietary}\nGroup: ${g.group}\nClick to assign to selected table`;
    chip.onclick = () => {
      if (selectedTable && STATE.hasEditLock) {
        // Find first empty seat
        const occupied = STATE.guests.filter(x => x.tableId === selectedTable.id).map(x => x.seatIndex);
        for (let i = 0; i < selectedTable.seats; i++) {
          if (!occupied.includes(i)) {
            g.tableId = selectedTable.id;
            g.seatIndex = i;
            saveState(`Assigned ${g.name} to ${selectedTable.label} Seat #${i + 1}`);
            playUiSound('snap');
            break;
          }
        }
      } else {
        showToast('Select a table on canvas first');
      }
    };
    unassignedPool.appendChild(chip);
  });
}

window.handleSeatRowClick = (tableId, seatIndex) => {
  const table = STATE.elements.find(e => e.id === tableId);
  if (!table) return;
  openSeatPicker(table, seatIndex, window.innerWidth / 2 - 100, window.innerHeight / 2 - 100);
};

function updateSummaryStats() {
  const totalTables = STATE.elements.filter(e => isTableType(e.type));
  const totalCapacity = totalTables.reduce((acc, t) => acc + (t.seats || 0), 0);
  const totalSeated = STATE.guests.filter(g => g.tableId).length;
  const totalRegistered = STATE.guests.length;
  const totalUnseated = totalRegistered - totalSeated;

  document.getElementById('stat-count-tables').innerText = totalTables.length;
  document.getElementById('stat-count-fixtures').innerText = STATE.elements.length - totalTables.length;
  document.getElementById('stat-count-guests').innerText = totalRegistered;
  document.getElementById('stat-count-unseated').innerText = totalUnseated;
  document.getElementById('stat-seated-total').innerText = totalSeated;
  document.getElementById('stat-capacity-total').innerText = totalCapacity;
  document.getElementById('seated-ratio-header').innerText = `${totalSeated}/${totalCapacity}`;

  const pct = totalCapacity > 0 ? Math.min(Math.round((totalSeated / totalCapacity) * 100), 100) : 0;
  document.getElementById('capacity-meter-fill').style.width = `${pct}%`;

  // Dietary breakdown
  const dietaryCounts = {};
  STATE.guests.forEach(g => {
    dietaryCounts[g.dietary] = (dietaryCounts[g.dietary] || 0) + 1;
  });

  const dietaryList = document.getElementById('dietary-stats-list');
  dietaryList.innerHTML = '';
  Object.keys(dietaryCounts).forEach(d => {
    const item = document.createElement('div');
    item.className = 'dietary-stat-item';
    item.innerHTML = `<span>${d}</span><strong>${dietaryCounts[d]} meals</strong>`;
    dietaryList.appendChild(item);
  });
}

// --- Seat Assignment Popup Modal ---
let activePickerTarget = null; // { table, seatIndex }

function openSeatPicker(table, seatIndex, clientX, clientY) {
  if (!STATE.hasEditLock) return;
  activePickerTarget = { table, seatIndex };

  const popup = document.getElementById('seat-picker-popup');
  document.getElementById('seat-picker-title').innerText = `Seat #${seatIndex + 1}`;
  document.getElementById('seat-picker-subtitle').innerText = table.label;

  const guestList = document.getElementById('picker-guest-options');
  guestList.innerHTML = '';

  const currentlySeated = STATE.guests.find(g => g.tableId === table.id && g.seatIndex === seatIndex);
  if (currentlySeated) {
    const currItem = document.createElement('div');
    currItem.className = 'picker-guest-item';
    currItem.style.borderLeft = '3px solid #10b981';
    currItem.innerHTML = `<span>✓ ${currentlySeated.name} (Current)</span><small>${currentlySeated.group}</small>`;
    guestList.appendChild(currItem);
  }

  const availableGuests = STATE.guests.filter(g => !g.tableId || (g.tableId === table.id && g.seatIndex === seatIndex));

  availableGuests.forEach(g => {
    if (currentlySeated && g.id === currentlySeated.id) return;
    const item = document.createElement('div');
    item.className = 'picker-guest-item';
    item.innerHTML = `<span>${g.vip ? '👑 ' : ''}${g.name}</span><small class="text-muted">${g.group}</small>`;
    item.onclick = () => {
      // Unseat existing occupant if any
      if (currentlySeated) {
        currentlySeated.tableId = null;
        currentlySeated.seatIndex = null;
      }
      g.tableId = table.id;
      g.seatIndex = seatIndex;
      popup.style.display = 'none';
      saveState(`Seated ${g.name} at ${table.label} Seat #${seatIndex + 1}`);
      playUiSound('snap');
    };
    guestList.appendChild(item);
  });

  popup.style.left = `${Math.min(clientX + 10, window.innerWidth - 260)}px`;
  popup.style.top = `${Math.min(clientY + 10, window.innerHeight - 300)}px`;
  popup.style.display = 'block';
}

document.getElementById('btn-close-seat-picker').onclick = () => {
  seatPickerPopup.style.display = 'none';
};

document.getElementById('btn-unseat-current').onclick = () => {
  if (!activePickerTarget) return;
  const guest = STATE.guests.find(g => g.tableId === activePickerTarget.table.id && g.seatIndex === activePickerTarget.seatIndex);
  if (guest) {
    guest.tableId = null;
    guest.seatIndex = null;
    saveState(`Emptied seat at ${activePickerTarget.table.label}`);
  }
  seatPickerPopup.style.display = 'none';
};

// Search Filter inside Seat Picker
document.getElementById('seat-search-input').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.picker-guest-item').forEach(item => {
    item.style.display = item.innerText.toLowerCase().includes(query) ? 'flex' : 'none';
  });
});

// --- Element Inspector Event Handlers ---
document.getElementById('prop-elem-label').addEventListener('input', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.label = e.target.value;
    render();
  }
});
document.getElementById('prop-elem-label').addEventListener('change', () => saveState("Renamed element"));

document.getElementById('prop-elem-seats').addEventListener('change', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && isTableType(el.type) && STATE.hasEditLock) {
    el.seats = Math.max(1, parseInt(e.target.value) || 1);
    render();
    saveState(`Updated seats for ${el.label}`);
  }
});

document.getElementById('prop-elem-w').addEventListener('change', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.w = Math.max(20, parseInt(e.target.value) || 20);
    render();
    saveState("Resized element width");
  }
});

document.getElementById('prop-elem-h').addEventListener('change', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.h = Math.max(20, parseInt(e.target.value) || 20);
    render();
    saveState("Resized element height");
  }
});

document.getElementById('prop-elem-rot').addEventListener('change', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.rot = (parseInt(e.target.value) || 0) % 360;
    render();
    saveState("Rotated element");
  }
});

document.getElementById('btn-rot-step').onclick = () => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.rot = (el.rot + 45) % 360;
    document.getElementById('prop-elem-rot').value = el.rot;
    render();
    saveState("Rotated element +45°");
  }
};

document.getElementById('prop-elem-color').addEventListener('input', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.color = e.target.value;
    document.getElementById('color-hex-label').innerText = el.color;
    render();
  }
});
document.getElementById('prop-elem-color').addEventListener('change', () => saveState("Changed element color"));

document.getElementById('prop-border-style').addEventListener('change', (e) => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.borderStyle = e.target.value;
    render();
    saveState("Changed border style");
  }
});

document.getElementById('btn-delete-element').onclick = () => deleteSelected();
document.getElementById('hud-btn-delete').onclick = () => deleteSelected();

function deleteSelected() {
  if (STATE.selectedIds.length === 0 || !STATE.hasEditLock) return;
  // Unassign guests from deleted tables
  STATE.guests.forEach(g => {
    if (STATE.selectedIds.includes(g.tableId)) {
      g.tableId = null;
      g.seatIndex = null;
    }
  });
  STATE.elements = STATE.elements.filter(e => !STATE.selectedIds.includes(e.id));
  STATE.selectedIds = [];
  saveState("Deleted elements");
  playUiSound('pop');
}

// Duplicate Functionality
function duplicateSelected() {
  if (STATE.selectedIds.length === 0 || !STATE.hasEditLock) return;
  const newIds = [];
  for (let id of STATE.selectedIds) {
    const orig = STATE.elements.find(e => e.id === id);
    if (orig) {
      const copy = JSON.parse(JSON.stringify(orig));
      copy.id = generateId('elem_');
      copy.x += 40;
      copy.y += 40;
      if (isTableType(copy.type)) {
        copy.label = `Table ${STATE.elements.filter(e => isTableType(e.type)).length + 1}`;
      }
      STATE.elements.push(copy);
      newIds.push(copy.id);
    }
  }
  STATE.selectedIds = newIds;
  saveState("Duplicated elements");
  playUiSound('snap');
}

document.getElementById('hud-btn-duplicate').onclick = duplicateSelected;
document.getElementById('btn-duplicate-elem').onclick = duplicateSelected;
document.getElementById('hud-btn-rotate-45').onclick = () => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.rot = (el.rot + 45) % 360;
    render();
    saveState("Rotated element +45°");
  }
};

document.getElementById('hud-btn-lock').onclick = () => {
  const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
  if (el && STATE.hasEditLock) {
    el.locked = !el.locked;
    showToast(el.locked ? 'Position Locked' : 'Position Unlocked');
    saveState(el.locked ? 'Locked element' : 'Unlocked element');
  }
};

// Alignment Tools
document.getElementById('btn-align-left').onclick = () => {
  if (STATE.selectedIds.length < 2 || !STATE.hasEditLock) return;
  const minX = Math.min(...STATE.elements.filter(e => STATE.selectedIds.includes(e.id)).map(e => e.x));
  STATE.elements.forEach(e => { if (STATE.selectedIds.includes(e.id)) e.x = minX; });
  saveState("Aligned left");
};

document.getElementById('btn-align-center').onclick = () => {
  if (STATE.selectedIds.length < 2 || !STATE.hasEditLock) return;
  const avgX = STATE.elements.filter(e => STATE.selectedIds.includes(e.id)).reduce((a,b)=>a+b.x,0) / STATE.selectedIds.length;
  STATE.elements.forEach(e => { if (STATE.selectedIds.includes(e.id)) e.x = avgX; });
  saveState("Aligned center");
};

document.getElementById('btn-align-top').onclick = () => {
  if (STATE.selectedIds.length < 2 || !STATE.hasEditLock) return;
  const minY = Math.min(...STATE.elements.filter(e => STATE.selectedIds.includes(e.id)).map(e => e.y));
  STATE.elements.forEach(e => { if (STATE.selectedIds.includes(e.id)) e.y = minY; });
  saveState("Aligned top");
};

document.getElementById('btn-distribute-h').onclick = () => {
  if (STATE.selectedIds.length < 3 || !STATE.hasEditLock) return;
  const items = STATE.elements.filter(e => STATE.selectedIds.includes(e.id)).sort((a,b)=>a.x - b.x);
  const startX = items[0].x;
  const endX = items[items.length - 1].x;
  const step = (endX - startX) / (items.length - 1);
  items.forEach((item, idx) => { item.x = startX + step * idx; });
  saveState("Distributed horizontally");
};

// --- Add Elements from Palette ---
document.querySelectorAll('.palette-card').forEach(card => {
  card.addEventListener('click', () => {
    if (!STATE.hasEditLock) {
      showToast('You do not hold the edit lock');
      return;
    }
    const type = card.getAttribute('data-create');
    if (!type) return;

    // Place near center of current view
    const viewCenterWorld = screenToWorld(viewport.clientWidth / 2, viewport.clientHeight / 2);
    let posX = Math.round(viewCenterWorld.x / STATE.gridSize) * STATE.gridSize;
    let posY = Math.round(viewCenterWorld.y / STATE.gridSize) * STATE.gridSize;

    const el = createElement(type, posX, posY);
    if (checkOverlap(el, posX, posY)) {
      el.x += 40; el.y += 40;
    }

    STATE.elements.push(el);
    STATE.selectedIds = [el.id];
    saveState(`Added ${el.label || type}`);
    playUiSound('snap');
  });
});

// --- Tab Switchers (Left & Right Sidebars) ---
document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const leftTab = btn.getAttribute('data-lefttab');
    const rightTab = btn.getAttribute('data-righttab');

    if (leftTab) {
      document.querySelectorAll('[data-lefttab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.left-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${leftTab}`).classList.add('active');
    }
    if (rightTab) {
      document.querySelectorAll('[data-righttab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.right-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${rightTab}`).classList.add('active');
    }
  });
});

// Accordions
document.querySelectorAll('.accordion-header').forEach(header => {
  header.addEventListener('click', () => {
    header.parentElement.classList.toggle('open');
  });
});

// --- Tool Switchers (Select / Pan / Ruler) ---
document.getElementById('btn-tool-select').onclick = () => setTool('select');
document.getElementById('btn-tool-pan').onclick = () => setTool('pan');
document.getElementById('btn-tool-ruler').onclick = () => setTool('ruler');

function setTool(tool) {
  STATE.activeTool = tool;
  document.getElementById('btn-tool-select').classList.toggle('active', tool === 'select');
  document.getElementById('btn-tool-pan').classList.toggle('active', tool === 'pan');
  document.getElementById('btn-tool-ruler').classList.toggle('active', tool === 'ruler');
  canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'ruler' ? 'crosshair' : 'default';
  if (tool !== 'ruler') STATE.ruler = null;
  render();
}

// --- Zoom Controls ---
document.getElementById('btn-zoom-in').onclick = () => {
  STATE.zoom = Math.min(STATE.zoom + 0.15, 3.0);
  zoomIndicator.innerText = `${Math.round(STATE.zoom * 100)}%`;
  render();
};

document.getElementById('btn-zoom-out').onclick = () => {
  STATE.zoom = Math.max(STATE.zoom - 0.15, 0.3);
  zoomIndicator.innerText = `${Math.round(STATE.zoom * 100)}%`;
  render();
};

document.getElementById('btn-zoom-reset').onclick = () => {
  STATE.zoom = 1.0;
  STATE.pan = { x: 0, y: 0 };
  zoomIndicator.innerText = '100%';
  render();
};

document.getElementById('btn-zoom-fit').onclick = () => {
  const scaleX = (canvas.width * 0.85) / STATE.venue.widthPx;
  const scaleY = (canvas.height * 0.85) / STATE.venue.heightPx;
  STATE.zoom = Math.min(scaleX, scaleY);
  STATE.pan = { x: 0, y: 0 };
  zoomIndicator.innerText = `${Math.round(STATE.zoom * 100)}%`;
  render();
};

// --- Snap to Grid & Overlap Switches ---
document.getElementById('chk-grid-snap').addEventListener('change', (e) => {
  STATE.snapToGrid = e.target.checked;
});

document.getElementById('chk-collision-block').addEventListener('change', (e) => {
  STATE.preventOverlap = e.target.checked;
});

// Layer Toggles
document.getElementById('layer-grid').addEventListener('change', (e) => { STATE.layers.grid = e.target.checked; render(); });
document.getElementById('layer-seats').addEventListener('change', (e) => { STATE.layers.seats = e.target.checked; render(); });
document.getElementById('layer-guest-names').addEventListener('change', (e) => { STATE.layers.guestNames = e.target.checked; render(); });
document.getElementById('layer-dimensions').addEventListener('change', (e) => { STATE.layers.dimensions = e.target.checked; render(); });
document.getElementById('layer-zones').addEventListener('change', (e) => { STATE.layers.zones = e.target.checked; render(); });

// --- Collaboration & Baton Lock Switcher ---
const roleSelect = document.getElementById('role-select');
const btnToggleBaton = document.getElementById('btn-toggle-baton');
const batonChip = document.getElementById('baton-chip');
const currentRoleAvatar = document.getElementById('current-role-avatar');
const currentRoleName = document.getElementById('current-role-name');

roleSelect.addEventListener('change', (e) => {
  STATE.role = e.target.value;
  if (STATE.role === 'planner' || STATE.role === 'venue') {
    STATE.hasEditLock = true;
  } else {
    STATE.hasEditLock = false;
  }
  applyCollaborationUI();
});

btnToggleBaton.addEventListener('click', () => {
  STATE.hasEditLock = !STATE.hasEditLock;
  applyCollaborationUI();
  playUiSound('pop');
  logActivity(STATE.hasEditLock ? `Acquired edit baton` : `Released edit baton`);
});

function applyCollaborationUI() {
  const roleDisplayNames = {
    planner: 'Lead Event Planner',
    venue: 'Venue Operations Manager',
    client: 'Client / Host Reviewer',
    caterer: 'Catering Team Head'
  };

  currentRoleName.innerText = roleDisplayNames[STATE.role] || STATE.role;
  currentRoleAvatar.innerText = STATE.role.charAt(0).toUpperCase();

  if (STATE.hasEditLock) {
    batonChip.className = 'lock-status-chip has-lock';
    batonChip.innerHTML = '<span class="pulse-dot"></span> Holding Edit Lock';
    btnToggleBaton.innerText = 'Pass Edit Baton to Others';
    readonlyBanner.style.display = 'none';
  } else {
    batonChip.className = 'lock-status-chip no-lock';
    batonChip.innerHTML = '<span class="pulse-dot"></span> Read-Only Mode';
    btnToggleBaton.innerText = 'Request Edit Access';
    readonlyBanner.style.display = 'flex';
  }

  updateUndoRedoButtons();
  updatePropertiesPanel();
}

// --- Blueprint Reference CAD Image Upload ---
const blueprintDropzone = document.getElementById('blueprint-dropzone');
const blueprintInput = document.getElementById('blueprint-input');
const bpControls = document.getElementById('blueprint-controls');
const bpOpacitySlider = document.getElementById('bp-opacity-slider');
const bpOpacityVal = document.getElementById('bp-opacity-val');

blueprintDropzone.onclick = () => blueprintInput.click();

blueprintInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        STATE.bgImage = img;
        STATE.bgVisible = true;
        bpControls.style.display = 'flex';
        render();
        logActivity('Loaded CAD blueprint underlay');
        showToast('Blueprint CAD Reference Loaded');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }
});

bpOpacitySlider.addEventListener('input', (e) => {
  STATE.bgOpacity = e.target.value / 100;
  bpOpacityVal.innerText = `${e.target.value}%`;
  render();
});

document.getElementById('btn-toggle-bp').onclick = () => {
  STATE.bgVisible = !STATE.bgVisible;
  document.getElementById('btn-toggle-bp').innerText = STATE.bgVisible ? 'Hide' : 'Show';
  render();
};

document.getElementById('btn-remove-bp').onclick = () => {
  STATE.bgImage = null;
  bpControls.style.display = 'none';
  render();
};

// --- Venue Canvas Resizing ---
document.getElementById('btn-apply-venue-size').onclick = () => {
  const wM = parseFloat(document.getElementById('venue-width-m').value) || 30;
  const hM = parseFloat(document.getElementById('venue-height-m').value) || 20;
  STATE.venue.widthM = wM;
  STATE.venue.heightM = hM;
  document.getElementById('scale-badge').innerText = `1m = ${STATE.venue.pxPerMeter}px`;
  saveState(`Resized venue floor to ${wM}m × ${hM}m`);
  render();
};

// --- Guest Directory Master Modal ---
const guestsTableBody = document.getElementById('guests-table-body');
const guestSearchInput = document.getElementById('guest-search-input');

document.getElementById('btn-open-guest-manager').onclick = () => openGuestDirectory();
document.getElementById('btn-manage-all-guests').onclick = () => openGuestDirectory();

function openGuestDirectory() {
  modalGuestDirectory.classList.add('open');
  renderGuestsTable();
}

function renderGuestsTable() {
  guestsTableBody.innerHTML = '';
  const query = guestSearchInput.value.toLowerCase();

  const filtered = STATE.guests.filter(g =>
    g.name.toLowerCase().includes(query) ||
    g.group.toLowerCase().includes(query) ||
    g.dietary.toLowerCase().includes(query)
  );

  document.getElementById('guest-count-visible').innerText = filtered.length;
  document.getElementById('guest-count-all').innerText = STATE.guests.length;

  filtered.forEach(g => {
    const tr = document.createElement('tr');
    const table = STATE.elements.find(e => e.id === g.tableId);
    const seatingText = table ? `${table.label} (Seat #${g.seatIndex + 1})` : '<span class="text-muted">Unassigned</span>';

    tr.innerHTML = `
      <td><strong>${g.name}</strong></td>
      <td><span class="tag-pill">${g.group}</span></td>
      <td><span class="guest-tag tag-${g.dietary.toLowerCase().replace(/[^a-z]/g,'')}">${g.dietary}</span></td>
      <td>${g.vip ? '👑 VIP' : 'Standard'}</td>
      <td><span style="color:#10b981;">Confirmed</span></td>
      <td>${seatingText}</td>
      <td style="text-align:right;">
        <button class="btn btn-danger text-xs" style="padding:2px 6px;" onclick="deleteGuest('${g.id}')">✕</button>
      </td>
    `;
    guestsTableBody.appendChild(tr);
  });
}

guestSearchInput.addEventListener('input', renderGuestsTable);

window.deleteGuest = (id) => {
  STATE.guests = STATE.guests.filter(g => g.id !== id);
  renderGuestsTable();
  saveState("Removed guest");
};

document.getElementById('btn-add-new-guest').onclick = () => {
  const name = prompt("Enter Guest Full Name:");
  if (name && name.trim()) {
    const group = prompt("Enter Group / Party (e.g. VIP, Bride Family, Tech Team):", "General Guests") || "General Guests";
    const dietary = prompt("Enter Dietary Requirement (None, Vegetarian, Vegan, Halal, Kosher, Gluten-Free, Nut Allergy):", "None") || "None";
    STATE.guests.push({
      id: generateId('guest_'),
      name: name.trim(),
      group: group.trim(),
      dietary: dietary.trim(),
      vip: false,
      rsvp: 'Confirmed',
      tableId: null,
      seatIndex: null
    });
    renderGuestsTable();
    saveState(`Added guest ${name}`);
  }
};

// Smart Auto-Seating Algorithm
function smartAutoSeatAll() {
  if (!STATE.hasEditLock) return;
  // Sort guests by group to seat parties together
  const unseated = STATE.guests.filter(g => !g.tableId).sort((a, b) => a.group.localeCompare(b.group));
  const tables = STATE.elements.filter(e => isTableType(e.type));

  let seatedCount = 0;

  for (let table of tables) {
    const occupiedSeats = STATE.guests.filter(g => g.tableId === table.id).map(g => g.seatIndex);
    for (let s = 0; s < table.seats; s++) {
      if (!occupiedSeats.includes(s) && unseated.length > 0) {
        const guest = unseated.shift();
        guest.tableId = table.id;
        guest.seatIndex = s;
        seatedCount++;
      }
    }
  }

  saveState(`Smart Auto-Seated ${seatedCount} guests`);
  showToast(`Auto-Seated ${seatedCount} guests across tables!`);
  renderGuestsTable();
}

document.getElementById('btn-auto-seat-all').onclick = smartAutoSeatAll;
document.getElementById('hud-btn-auto-seat').onclick = () => {
  const table = STATE.elements.find(x => x.id === STATE.selectedIds[0] && isTableType(x.type));
  if (!table) return;
  const unseated = STATE.guests.filter(g => !g.tableId);
  const occupied = STATE.guests.filter(g => g.tableId === table.id).map(g => g.seatIndex);

  let count = 0;
  for (let s = 0; s < table.seats; s++) {
    if (!occupied.includes(s) && unseated.length > 0) {
      const g = unseated.shift();
      g.tableId = table.id;
      g.seatIndex = s;
      count++;
    }
  }
  saveState(`Filled ${count} seats at ${table.label}`);
  showToast(`Assigned ${count} guests to ${table.label}`);
};

document.getElementById('btn-clear-all-seating').onclick = () => {
  if (confirm("Are you sure you want to unseat all guests?")) {
    STATE.guests.forEach(g => { g.tableId = null; g.seatIndex = null; });
    saveState("Unseated all guests");
    renderGuestsTable();
    showToast('All guests unseated');
  }
};

// CSV Import & Export for Guests
document.getElementById('btn-import-csv').onclick = () => document.getElementById('csv-file-input').click();

document.getElementById('csv-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      let imported = 0;

      lines.slice(1).forEach(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts[0]) {
          STATE.guests.push({
            id: generateId('guest_'),
            name: parts[0],
            group: parts[1] || 'General',
            dietary: parts[2] || 'None',
            vip: (parts[3] || '').toLowerCase().includes('vip') || (parts[3] || '').toLowerCase() === 'true',
            rsvp: 'Confirmed',
            tableId: null,
            seatIndex: null
          });
          imported++;
        }
      });
      renderGuestsTable();
      saveState(`Imported ${imported} guests from CSV`);
      showToast(`Imported ${imported} attendees successfully!`);
    };
    reader.readAsText(file);
  }
});

function exportGuestCsv() {
  let csv = 'Name,Group,Dietary,VIP,RSVP,Table,Seat\n';
  STATE.guests.forEach(g => {
    const table = STATE.elements.find(e => e.id === g.tableId);
    const tblName = table ? table.label : 'Unassigned';
    const seatNo = g.seatIndex !== null ? g.seatIndex + 1 : '';
    csv += `"${g.name}","${g.group}","${g.dietary}",${g.vip ? 'VIP' : 'Standard'},"${g.rsvp}","${tblName}","${seatNo}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${STATE.projectName.toLowerCase().replace(/\s+/g, '_')}_guest_roster.csv`;
  a.click();
  showToast('Guest roster CSV downloaded');
}

document.getElementById('btn-export-csv-modal').onclick = exportGuestCsv;
document.getElementById('export-guest-csv').onclick = exportGuestCsv;

// --- Template Library Loader ---
document.getElementById('btn-open-templates').onclick = () => modalTemplates.classList.add('open');

document.querySelectorAll('[data-load-template]').forEach(card => {
  card.addEventListener('click', () => {
    const templateName = card.getAttribute('data-load-template');
    loadTemplate(templateName);
    modalTemplates.classList.remove('open');
  });
});

document.getElementById('btn-clear-canvas-new').onclick = () => {
  if (confirm("Start with a blank canvas? Current layout will be cleared.")) {
    STATE.elements = [];
    STATE.guests = [];
    STATE.selectedIds = [];
    saveState("Cleared canvas for blank project");
    modalTemplates.classList.remove('open');
  }
};

function loadTemplate(name) {
  STATE.elements = [];
  STATE.guests = [];
  STATE.selectedIds = [];

  if (name === 'wedding') {
    STATE.projectName = "Wedding Banquet Gala 2026";
    // Stage & Head Table
    STATE.elements.push(createElement('stage', 0, -280));
    const headTable = createElement('rect', 0, -180);
    headTable.w = 200; headTable.h = 60; headTable.seats = 8; headTable.label = "Bridal Head Table";
    STATE.elements.push(headTable);

    // Dance floor in center
    STATE.elements.push(createElement('dancefloor', 0, 40));

    // DJ & Bar
    const dj = createElement('djbooth', -400, -280);
    const bar = createElement('bar', 400, -280);
    const photo = createElement('photobooth', -420, 240);
    STATE.elements.push(dj, bar, photo);

    // 8 Round Guest Tables surrounding dance floor
    const coords = [
      [-260, -80], [-260, 80], [-260, 240],
      [260, -80], [260, 80], [260, 240],
      [-100, 260], [100, 260]
    ];
    coords.forEach((c, idx) => {
      const t = createElement('round', c[0], c[1]);
      t.seats = 8;
      t.label = `Table ${idx + 1}`;
      STATE.elements.push(t);
    });

    // Populate Sample Guests (72 guests)
    const groups = ['Bride Family', 'Groom Family', 'College Friends', 'VIP Colleagues'];
    const diets = ['None', 'None', 'Vegetarian', 'None', 'Vegan', 'Halal', 'Gluten-Free'];
    for (let i = 1; i <= 72; i++) {
      STATE.guests.push({
        id: generateId('g_'),
        name: `Guest ${i}`,
        group: groups[i % groups.length],
        dietary: diets[i % diets.length],
        vip: i <= 8,
        rsvp: 'Confirmed',
        tableId: null,
        seatIndex: null
      });
    }
  } else if (name === 'gala') {
    STATE.projectName = "Corporate Annual Gala 2026";
    STATE.elements.push(createElement('stage', 0, -320));
    STATE.elements.push(createElement('bar', -450, 0));
    STATE.elements.push(createElement('bar', 450, 0));

    // Grid of 12 round tables
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const t = createElement('round', -330 + col * 220, -140 + row * 180);
        t.seats = 10;
        t.label = `Gala Table ${row * 4 + col + 1}`;
        STATE.elements.push(t);
      }
    }

    for (let i = 1; i <= 120; i++) {
      STATE.guests.push({
        id: generateId('g_'),
        name: `Attendee ${i}`,
        group: i <= 20 ? 'Executive Suite' : i <= 60 ? 'Sales & Eng' : 'Partners',
        dietary: i % 7 === 0 ? 'Vegan' : i % 5 === 0 ? 'Vegetarian' : 'None',
        vip: i <= 20,
        rsvp: 'Confirmed',
        tableId: null,
        seatIndex: null
      });
    }
  } else if (name === 'conference') {
    STATE.projectName = "Global Tech Keynote & Workshop";
    STATE.elements.push(createElement('stage', 0, -280));
    for (let r = 0; r < 4; r++) {
      const leftRow = createElement('classroom', -200, -140 + r * 100);
      const rightRow = createElement('classroom', 200, -140 + r * 100);
      STATE.elements.push(leftRow, rightRow);
    }
    STATE.elements.push(createElement('lounge', 0, 300));
  } else if (name === 'cocktail') {
    STATE.projectName = "Networking Mixer & Cocktail Lounge";
    STATE.elements.push(createElement('bar', 0, 0));
    STATE.elements.push(createElement('djbooth', 0, -280));
    STATE.elements.push(createElement('photobooth', -380, -240));

    const cocktailCoords = [
      [-220, -140], [-220, 140], [220, -140], [220, 140],
      [-360, 0], [360, 0]
    ];
    cocktailCoords.forEach(c => STATE.elements.push(createElement('cocktail', c[0], c[1])));
    STATE.elements.push(createElement('lounge', -260, 260), createElement('lounge', 260, 260));
  }

  smartAutoSeatAll();
  projectTitleInput.value = STATE.projectName;
  saveState(`Loaded ${name} template`);
  showToast(`Template '${name.toUpperCase()}' Loaded`);
  btnUndo.disabled = true;
}

// Modal Close Triggers
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    document.getElementById(modalId).classList.remove('open');
  });
});

document.getElementById('btn-shortcuts-modal').onclick = () => modalShortcuts.classList.add('open');

// --- Export Menu Actions ---
btnExportDropdown.onclick = (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('show');
};
window.addEventListener('click', () => exportMenu.classList.remove('show'));

// Export High-Res PNG (4K / 2X Super Sampled)
document.getElementById('export-png-4k').onclick = () => {
  const offCanvas = document.createElement('canvas');
  const scale = 2; // 2x high resolution
  offCanvas.width = STATE.venue.widthPx * scale;
  offCanvas.height = STATE.venue.heightPx * scale;
  const octx = offCanvas.getContext('2d');

  octx.fillStyle = '#0f1015';
  octx.fillRect(0, 0, offCanvas.width, offCanvas.height);

  octx.save();
  octx.scale(scale, scale);
  octx.translate(STATE.venue.widthPx / 2, STATE.venue.heightPx / 2);

  // Background Blueprint if any
  if (STATE.bgImage && STATE.bgVisible) {
    octx.globalAlpha = STATE.bgOpacity;
    octx.drawImage(STATE.bgImage, -STATE.venue.widthPx/2, -STATE.venue.heightPx/2, STATE.venue.widthPx, STATE.venue.heightPx);
    octx.globalAlpha = 1.0;
  }

  // Draw Grid
  octx.strokeStyle = '#20222e';
  octx.lineWidth = 1;
  octx.beginPath();
  for (let x = -STATE.venue.widthPx/2; x <= STATE.venue.widthPx/2; x += STATE.gridSize) {
    octx.moveTo(x, -STATE.venue.heightPx/2); octx.lineTo(x, STATE.venue.heightPx/2);
  }
  for (let y = -STATE.venue.heightPx/2; y <= STATE.venue.heightPx/2; y += STATE.gridSize) {
    octx.moveTo(-STATE.venue.widthPx/2, y); octx.lineTo(STATE.venue.widthPx/2, y);
  }
  octx.stroke();

  // Draw All Elements Cleanly
  STATE.elements.forEach(el => {
    octx.save();
    octx.translate(el.x, el.y);
    octx.rotate((el.rot * Math.PI) / 180);

    if (isTableType(el.type)) {
      const seats = getSeatPositions(el);
      seats.forEach(s => {
        const guest = STATE.guests.find(g => g.tableId === el.id && g.seatIndex === s.seatIndex);
        octx.fillStyle = guest ? (guest.vip ? '#ca8a04' : '#4f46e5') : '#2a2d3d';
        octx.strokeStyle = '#94a3b8';
        octx.lineWidth = 1.5;
        octx.beginPath();
        octx.arc(s.x, s.y, 8, 0, Math.PI * 2);
        octx.fill(); octx.stroke();
      });
    }

    octx.fillStyle = el.color;
    octx.strokeStyle = '#525266';
    octx.lineWidth = 2;
    if (el.type === 'round' || el.type === 'cocktail') {
      octx.beginPath(); octx.arc(0, 0, el.w/2, 0, Math.PI * 2); octx.fill(); octx.stroke();
    } else {
      octx.beginPath(); octx.roundRect(-el.w/2, -el.h/2, el.w, el.h, 6); octx.fill(); octx.stroke();
    }

    octx.rotate((-el.rot * Math.PI) / 180);
    octx.fillStyle = '#ffffff';
    octx.font = '600 12px Plus Jakarta Sans, sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(el.label, 0, 0);

    octx.restore();
  });

  octx.restore();

  // Watermark Header
  octx.fillStyle = '#ffffff';
  octx.font = '700 24px Plus Jakarta Sans, sans-serif';
  octx.fillText(STATE.projectName, 30, 45);
  octx.font = '500 14px JetBrains Mono, monospace';
  octx.fillStyle = '#94a3b8';
  octx.fillText(`FloorPlan Pro • ${new Date().toLocaleDateString()}`, 30, 70);

  const link = document.createElement('a');
  link.download = `${STATE.projectName.toLowerCase().replace(/\s+/g, '_')}_floorplan.png`;
  link.href = offCanvas.toDataURL('image/png');
  link.click();
  showToast('High-Res 4K Image Exported');
};

// Export Scalable Vector Graphics (SVG)
document.getElementById('export-svg').onclick = () => {
  const vw = STATE.venue.widthPx;
  const vh = STATE.venue.heightPx;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" style="background:#0f1015; font-family:sans-serif;">\n`;
  svg += `<rect x="0" y="0" width="${vw}" height="${vh}" fill="#14151c" stroke="#474b63" stroke-width="4"/>\n`;

  STATE.elements.forEach(el => {
    const cx = el.x + vw / 2;
    const cy = el.y + vh / 2;
    svg += `<g transform="translate(${cx}, ${cy}) rotate(${el.rot})">\n`;
    if (el.type === 'round' || el.type === 'cocktail') {
      svg += `  <circle cx="0" cy="0" r="${el.w/2}" fill="${el.color}" stroke="#64748b" stroke-width="2"/>\n`;
    } else {
      svg += `  <rect x="${-el.w/2}" y="${-el.h/2}" width="${el.w}" height="${el.h}" rx="6" fill="${el.color}" stroke="#64748b" stroke-width="2"/>\n`;
    }
    svg += `  <text x="0" y="4" fill="#ffffff" font-size="12" font-weight="600" text-anchor="middle">${el.label}</text>\n`;
    svg += `</g>\n`;
  });

  svg += `</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = `${STATE.projectName.toLowerCase().replace(/\s+/g, '_')}.svg`;
  link.href = URL.createObjectURL(blob);
  link.click();
  showToast('Vector SVG Exported');
};

// Print / PDF Seating Chart Report
document.getElementById('export-pdf-report').onclick = () => {
  const printWin = window.open('', '_blank', 'width=900,height=800');
  if (!printWin) return;

  let tablesHtml = '';
  STATE.elements.filter(e => isTableType(e.type)).forEach(t => {
    const seated = STATE.guests.filter(g => g.tableId === t.id);
    let guestRows = '';
    for (let i = 0; i < t.seats; i++) {
      const g = seated.find(x => x.seatIndex === i);
      guestRows += `<tr><td>Seat #${i + 1}</td><td><strong>${g ? g.name : '— Empty —'}</strong></td><td>${g ? g.dietary : '—'}</td><td>${g ? g.group : '—'}</td></tr>`;
    }

    tablesHtml += `
      <div style="break-inside:avoid; margin-bottom:24px; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
        <div style="background:#f1f5f9; padding:10px 14px; font-weight:bold; font-size:15px; display:flex; justify-content:space-between;">
          <span>${t.label}</span>
          <span>${seated.length}/${t.seats} Guests</span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead><tr style="background:#fafafa; text-align:left;"><th style="padding:6px 10px;">Seat</th><th>Guest Name</th><th>Dietary Requirements</th><th>Party</th></tr></thead>
          <tbody>${guestRows}</tbody>
        </table>
      </div>
    `;
  });

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${STATE.projectName} - Seating Manifest Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
        h1 { margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
        td, th { padding: 6px 10px; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <h1>${STATE.projectName}</h1>
      <div class="meta">Generated by FloorPlan Studio Pro • ${new Date().toLocaleDateString()} • Total Capacity: ${STATE.guests.filter(g=>g.tableId).length} Seated</div>
      ${tablesHtml}
    </body>
    </html>
  `);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => printWin.print(), 350);
};

// JSON Project File Save & Load
document.getElementById('export-json').onclick = () => {
  const data = {
    projectName: STATE.projectName,
    venue: STATE.venue,
    elements: STATE.elements,
    guests: STATE.guests,
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `${STATE.projectName.toLowerCase().replace(/\s+/g, '_')}_project.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  showToast('Project JSON Saved');
};

document.getElementById('import-json-btn').onclick = () => document.getElementById('import-json-input').click();

document.getElementById('import-json-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.elements && data.guests) {
          STATE.projectName = data.projectName || STATE.projectName;
          projectTitleInput.value = STATE.projectName;
          STATE.elements = data.elements;
          STATE.guests = data.guests;
          STATE.selectedIds = [];
          saveState("Loaded project from JSON file");
          showToast('Project JSON Loaded Successfully');
        }
      } catch (err) {
        showToast('Invalid project JSON file');
      }
    };
    reader.readAsText(file);
  }
});

// --- Keyboard Shortcuts Controller ---
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redo();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  } else if (e.key === 'r' || e.key === 'R') {
    const el = STATE.elements.find(x => x.id === STATE.selectedIds[0]);
    if (el && STATE.hasEditLock) {
      el.rot = (el.rot + 45) % 360;
      render();
      saveState("Rotated element +45°");
    }
  } else if (e.key === 'v' || e.key === 'V') {
    setTool('select');
  } else if (e.key === 'h' || e.key === 'H') {
    setTool('pan');
  } else if (e.key === 'm' || e.key === 'M') {
    setTool('ruler');
  } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
    e.preventDefault();
    document.getElementById('btn-zoom-reset').click();
  } else if (e.key === '?') {
    modalShortcuts.classList.add('open');
  }
});

// --- Undo / Redo Click Handlers ---
btnUndo.onclick = undo;
btnRedo.onclick = redo;

// Project Rename Input
projectTitleInput.addEventListener('change', (e) => {
  STATE.projectName = e.target.value;
  saveState("Renamed project");
});

// --- App Initialization ---
function initApp() {
  resizeCanvas();
  // Check LocalStorage or load default Wedding template
  const saved = localStorage.getItem('floorplan_pro_state');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      STATE.projectName = data.projectName || STATE.projectName;
      projectTitleInput.value = STATE.projectName;
      STATE.elements = data.elements || [];
      STATE.guests = data.guests || [];
      saveState("Restored session from cache");
    } catch(e) {
      loadTemplate('wedding');
    }
  } else {
    loadTemplate('wedding');
  }

  applyCollaborationUI();
  updateAllPanels();
  render();
  logActivity('FloorPlan Studio Pro ready');
}

// Start application
initApp();
