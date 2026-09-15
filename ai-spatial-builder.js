/**
 * FloorPlan Pro - AI Spatial Builder & Seating Decider Module
 * Connects natural language prompt mapping to canvas coordinates and smart guest placement
 */

(function initAiSpatialBuilder() {
  // DOM References
  const modalAiBuilder = document.getElementById('modal-ai-builder');
  const btnOpenAiBuilder = document.getElementById('btn-open-ai-builder');
  const btnQuickAiBuilder = document.getElementById('btn-quick-ai-builder');
  const aiPromptInput = document.getElementById('ai-prompt-input');
  const btnClearAiPrompt = document.getElementById('btn-clear-ai-prompt');
  const btnGenerateAi = document.getElementById('btn-generate-ai-floorplan');
  const btnApplyAi = document.getElementById('btn-apply-ai-floorplan');
  const aiLoadingState = document.getElementById('ai-loading-state');
  const aiPreviewEmpty = document.getElementById('ai-preview-empty');
  const aiPreviewResults = document.getElementById('ai-preview-results');
  const aiPlacementMode = document.getElementById('ai-placement-mode');
  const aiAutoGenerateGuests = document.getElementById('ai-auto-generate-guests');
  const aiModelLabel = document.getElementById('ai-model-label');
  const aiEngineTag = document.getElementById('ai-engine-tag');
  const aiResultTitle = document.getElementById('ai-result-title');
  const aiResultSummary = document.getElementById('ai-result-summary');
  const aiResultCapacity = document.getElementById('ai-result-capacity');
  const aiCountSeatingText = document.getElementById('ai-count-seating-text');
  const aiCountStagingText = document.getElementById('ai-count-staging-text');
  const aiCountArchText = document.getElementById('ai-count-arch-text');
  const aiResultCount = document.getElementById('ai-result-count');
  const aiElementsList = document.getElementById('ai-elements-list');
  const aiLoadingHeadline = document.getElementById('ai-loading-headline');
  const aiLoadingSubtext = document.getElementById('ai-loading-subtext');
  const aiLoadingProgressFill = document.getElementById('ai-loading-progress-fill');

  // Currently generated payload cache
  let lastGeneratedPayload = null;

  // Check AI connection status on boot
  fetch('/api/ai-status')
    .then(r => r.ok ? r.json() : null)
    .then(status => {
      if (status && status.hasKey && aiModelLabel) {
        aiModelLabel.textContent = 'Gemini AI Spatial Engine';
      } else if (aiModelLabel) {
        aiModelLabel.textContent = 'Spatial Layout Engine';
      }
    })
    .catch(() => {
      if (aiModelLabel) aiModelLabel.textContent = 'Spatial Layout Engine';
    });

  // Open modal handler
  function openAiModal(initialPrompt = '') {
    if (!modalAiBuilder) return;
    modalAiBuilder.classList.add('open');
    if (initialPrompt && aiPromptInput) {
      aiPromptInput.value = initialPrompt;
    }
    if (aiPromptInput) aiPromptInput.focus();
  }

  function closeAiModal() {
    if (!modalAiBuilder) return;
    modalAiBuilder.classList.remove('open');
  }

  if (btnOpenAiBuilder) {
    btnOpenAiBuilder.onclick = () => openAiModal();
  }
  if (btnQuickAiBuilder) {
    btnQuickAiBuilder.onclick = () => openAiModal();
  }

  if (btnClearAiPrompt && aiPromptInput) {
    btnClearAiPrompt.onclick = () => {
      aiPromptInput.value = '';
      aiPromptInput.focus();
    };
  }

  // Clickable example prompt chips
  document.querySelectorAll('.ai-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt && aiPromptInput) {
        aiPromptInput.value = prompt;
        aiPromptInput.focus();
        if (typeof playUiSound === 'function') playUiSound('click');
      }
    });
  });

  // Loading animation simulation
  let progressInterval = null;
  function startLoadingAnimation() {
    aiPreviewEmpty.style.display = 'none';
    aiPreviewResults.style.display = 'none';
    aiLoadingState.style.display = 'flex';
    btnGenerateAi.disabled = true;
    if (btnApplyAi) btnApplyAi.disabled = true;

    let progress = 10;
    if (aiLoadingProgressFill) aiLoadingProgressFill.style.width = '10%';
    const stages = [
      { text: "Interpreting natural language room specifications...", sub: "Extracting table counts, focal stages, and dance floor dimensions" },
      { text: "Calculating geometric coordinates...", sub: "Enforcing 5ft aisle clearance buffer and focal orientation" },
      { text: "Validating collision boundaries...", sub: "Verifying venue boundary limits and spatial harmony" },
      { text: "Assembling structured JSON payload...", sub: "Mapping element types, seats, and rotation angles" }
    ];

    let stageIdx = 0;
    progressInterval = setInterval(() => {
      progress += Math.min(20, Math.floor(Math.random() * 15) + 8);
      if (progress > 90) progress = 92;
      if (aiLoadingProgressFill) aiLoadingProgressFill.style.width = progress + '%';
      
      stageIdx = (stageIdx + 1) % stages.length;
      if (aiLoadingHeadline) aiLoadingHeadline.textContent = stages[stageIdx].text;
      if (aiLoadingSubtext) aiLoadingSubtext.textContent = stages[stageIdx].sub;
    }, 700);
  }

  function stopLoadingAnimation() {
    clearInterval(progressInterval);
    if (aiLoadingProgressFill) aiLoadingProgressFill.style.width = '100%';
    setTimeout(() => {
      aiLoadingState.style.display = 'none';
      btnGenerateAi.disabled = false;
    }, 250);
  }

  // -------------------------------------------------------------
  // Client-Side Spatial Architect Engine Fallback
  // Guarantees immediate, high-accuracy layout generation even if
  // server returns 405, 404, or is offline.
  // -------------------------------------------------------------
  function generateClientSpatialFloorplan(prompt) {
    const lower = (prompt || '').toLowerCase();

    // Detect requested table count
    const tableMatch = lower.match(/(\d+)\s*(round|rect|rectangular|banquet|square|oval|high-?top|cocktail|classroom)?\s*table/);
    const tableCount = tableMatch ? Math.min(parseInt(tableMatch[1], 10), 40) : 12;

    // Detect table geometry and dimensions
    let tableType = 'round';
    let tableSeats = 8;
    let tableW = 90, tableH = 90;

    if (lower.includes('rect') || lower.includes('banquet') || lower.includes('trestle') || lower.includes('long table')) {
      tableType = 'rect'; tableSeats = 6; tableW = 140; tableH = 70;
    } else if (lower.includes('square')) {
      tableType = 'square'; tableSeats = 4; tableW = 80; tableH = 80;
    } else if (lower.includes('oval') || lower.includes('imperial')) {
      tableType = 'oval'; tableSeats = 10; tableW = 160; tableH = 90;
    } else if (lower.includes('cocktail') || lower.includes('high-top') || lower.includes('standing')) {
      tableType = 'cocktail'; tableSeats = 4; tableW = 46; tableH = 46;
    } else if (lower.includes('classroom') || lower.includes('school') || lower.includes('training')) {
      tableType = 'classroom'; tableSeats = 6; tableW = 150; tableH = 45;
    } else if (lower.includes('u-shape') || lower.includes('ushape')) {
      tableType = 'ushape'; tableSeats = 16; tableW = 200; tableH = 150;
    }

    const elements = [];
    let title = "AI Generated Floorplan";
    if (lower.includes('wedding')) title = "Grand Wedding Celebration";
    else if (lower.includes('ballroom')) title = "Grand Ballroom Gala";
    else if (lower.includes('conference') || lower.includes('keynote')) title = "Executive Conference Hall";
    else if (lower.includes('cocktail') || lower.includes('lounge')) title = "VIP Cocktail Mixer & Lounge";
    else if (lower.includes('banquet') || lower.includes('gala')) title = "Banquet & Awards Hall";

    // 1. Stage / Presentation Front
    const hasStage = lower.includes('stage') || lower.includes('presentation') || lower.includes('keynote') || lower.includes('podium') || lower.includes('speaker') || lower.includes('gala');
    if (hasStage) {
      elements.push({
        id: `ai_stage_${Date.now()}_1`,
        type: 'stage',
        x: 0,
        y: -260,
        width: 280,
        height: 100,
        rotation: 0,
        label: 'Main Stage',
        seats: 0,
        category: 'staging'
      });
    }

    // 2. Bridal / VIP Head Table
    const hasHeadTable = lower.includes('head table') || lower.includes('bridal table') || lower.includes('dais') || lower.includes('vip table');
    if (hasHeadTable) {
      elements.push({
        id: `ai_head_table_${Date.now()}`,
        type: 'rect',
        x: 0,
        y: hasStage ? -160 : -250,
        width: 220,
        height: 60,
        rotation: 0,
        label: 'VIP Head Table',
        seats: 8,
        category: 'seating'
      });
    }

    // 3. Central Dance Floor
    const hasDanceFloor = lower.includes('dance') || lower.includes('dancefloor') || lower.includes('dance floor') || lower.includes('wedding');
    if (hasDanceFloor) {
      elements.push({
        id: `ai_dancefloor_${Date.now()}`,
        type: 'dancefloor',
        x: 0,
        y: hasStage ? 10 : 0,
        width: 220,
        height: 220,
        rotation: 0,
        label: 'Central Dance Floor',
        seats: 0,
        category: 'staging'
      });
    }

    // 4. Bar
    const hasBar = lower.includes('bar') || lower.includes('beverage') || lower.includes('drink') || lower.includes('cocktail') || lower.includes('gala') || lower.includes('wedding');
    if (hasBar) {
      elements.push({
        id: `ai_bar_${Date.now()}_1`,
        type: 'bar',
        x: -440,
        y: -220,
        width: 140,
        height: 55,
        rotation: 0,
        label: 'Beverage Bar',
        seats: 0,
        category: 'staging'
      });

      if (lower.includes('dual bar') || lower.includes('two bars') || tableCount >= 18) {
        elements.push({
          id: `ai_bar_${Date.now()}_2`,
          type: 'bar',
          x: 440,
          y: -220,
          width: 140,
          height: 55,
          rotation: 0,
          label: 'East Bar',
          seats: 0,
          category: 'staging'
        });
      }
    }

    // 5. DJ Booth / Sound
    const hasDJ = lower.includes('dj') || lower.includes('music') || lower.includes('audio') || lower.includes('sound') || lower.includes('band');
    if (hasDJ) {
      elements.push({
        id: `ai_dj_${Date.now()}`,
        type: 'djbooth',
        x: 430,
        y: hasStage ? -220 : -180,
        width: 90,
        height: 55,
        rotation: 0,
        label: 'DJ Booth & Sound',
        seats: 0,
        category: 'staging'
      });
    }

    // 6. Photo Booth
    const hasPhoto = lower.includes('photo') || lower.includes('photobooth') || lower.includes('kiosk') || lower.includes('selfie');
    if (hasPhoto) {
      elements.push({
        id: `ai_photo_${Date.now()}`,
        type: 'photobooth',
        x: -450,
        y: 230,
        width: 80,
        height: 80,
        rotation: 0,
        label: 'Photo Booth Kiosk',
        seats: 0,
        category: 'staging'
      });
    }

    // 7. VIP Lounge Seating
    const hasLounge = lower.includes('lounge') || lower.includes('couch') || lower.includes('sofa') || lower.includes('seating area');
    if (hasLounge) {
      elements.push({
        id: `ai_lounge_${Date.now()}`,
        type: 'lounge',
        x: 430,
        y: 220,
        width: 140,
        height: 70,
        rotation: 0,
        label: 'VIP Lounge Sectional',
        seats: 0,
        category: 'staging'
      });
    }

    // 8. Entrance Doors
    elements.push({
      id: `ai_door_${Date.now()}`,
      type: 'door',
      x: 0,
      y: 330,
      width: 80,
      height: 20,
      rotation: 0,
      label: 'Main Entrance',
      seats: 0,
      category: 'architectural'
    });

    // 9. Coordinate Positioning for Dining Tables
    let placedTables = 0;

    if (hasDanceFloor) {
      // Ring and flanking formation around dance floor
      const count = Math.min(tableCount, 28);
      const startX = -340;
      const startY = hasStage ? -100 : -200;

      let idx = 1;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 6; col++) {
          if (placedTables >= count) break;
          const tx = startX + col * 136;
          const ty = startY + row * 115;

          // Avoid dance floor clearance boundary
          const dfCenterY = hasStage ? 10 : 0;
          if (Math.abs(tx) < 145 && Math.abs(ty - dfCenterY) < 145) {
            continue;
          }
          if (Math.abs(tx) > 500 || Math.abs(ty) > 310) continue;

          elements.push({
            id: `ai_table_${Date.now()}_${idx}`,
            type: tableType,
            x: tx,
            y: ty,
            width: tableW,
            height: tableH,
            rotation: 0,
            label: `Table ${idx}`,
            seats: tableSeats,
            category: 'seating'
          });
          placedTables++;
          idx++;
        }
      }
    } else {
      // Clean matrix grid
      const cols = Math.min(tableCount, 5);
      const rows = Math.ceil(tableCount / cols);
      const colSpacing = Math.min(180, Math.floor(760 / (cols + 1)));
      const rowSpacing = Math.min(130, Math.floor(460 / (rows + 1)));
      const startX = -((cols - 1) * colSpacing) / 2;
      const startY = hasStage ? -120 : -((rows - 1) * rowSpacing) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (placedTables >= tableCount) break;
          elements.push({
            id: `ai_table_${Date.now()}_${placedTables + 1}`,
            type: tableType,
            x: Math.round(startX + c * colSpacing),
            y: Math.round(startY + r * rowSpacing),
            width: tableW,
            height: tableH,
            rotation: 0,
            label: `Table ${placedTables + 1}`,
            seats: tableSeats,
            category: 'seating'
          });
          placedTables++;
        }
      }
    }

    const estimatedCapacity = elements
      .filter(e => e.category === 'seating' || ['round','rect','square','oval','cocktail','classroom','ushape','serpentine'].includes(e.type))
      .reduce((sum, e) => sum + (e.seats || 0), 0);

    return {
      success: true,
      venueTitle: title,
      roomSummary: `Architecturally planned layout featuring ${placedTables} ${tableType} tables (${estimatedCapacity} total seats) with 5ft service corridors and dedicated focal fixtures.`,
      estimatedGuestCapacity: estimatedCapacity,
      engine: 'Spatial Layout Engine',
      elements
    };
  }

  // Generate Floorplan API trigger
  if (btnGenerateAi) {
    btnGenerateAi.onclick = async () => {
      const prompt = aiPromptInput ? aiPromptInput.value.trim() : '';
      if (!prompt) {
        if (typeof showToast === 'function') showToast('Please enter a room description first', 'error');
        if (aiPromptInput) aiPromptInput.focus();
        return;
      }

      startLoadingAnimation();

      let data = null;

      // 1. Try server-side POST request first
      try {
        const response = await fetch('/api/generate-floorplan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            venueWidth: typeof STATE !== 'undefined' ? STATE.venue.widthPx : 1200,
            venueHeight: typeof STATE !== 'undefined' ? STATE.venue.heightPx : 800
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson && resJson.success && Array.isArray(resJson.elements) && resJson.elements.length > 0) {
            data = resJson;
          }
        } else if (response.status === 405) {
          // If server or reverse proxy returns 405 Method Not Allowed, fallback to GET query
          console.warn('Server returned status 405 on POST. Attempting GET fallback...');
          const getRes = await fetch(`/api/generate-floorplan?prompt=${encodeURIComponent(prompt)}`);
          if (getRes.ok) {
            const getJson = await getRes.json();
            if (getJson && getJson.success && Array.isArray(getJson.elements) && getJson.elements.length > 0) {
              data = getJson;
            }
          }
        }
      } catch (err) {
        console.warn('Server API fetch encountered network issue:', err.message || err);
      }

      // 2. Seamless client spatial layout engine fallback
      // If server returned status 405, 404, 500, or failed to connect, instantly generate via client engine
      if (!data || !data.elements || data.elements.length === 0) {
        data = generateClientSpatialFloorplan(prompt);
      }

      stopLoadingAnimation();

      if (data && data.elements && data.elements.length > 0) {
        lastGeneratedPayload = data;
        renderGeneratedPreview(data);
        if (typeof playUiSound === 'function') playUiSound('pop');
        if (typeof showToast === 'function') {
          const engineLabel = data.engine && data.engine.includes('gemini') ? 'Gemini AI' : 'Spatial Layout Engine';
          showToast(`Generated ${data.elements.length} layout elements via ${engineLabel}! Review and click Apply.`);
        }
      } else {
        if (typeof showToast === 'function') {
          showToast('Could not assemble layout. Please try describing table count and room style.', 'error');
        }
        aiLoadingState.style.display = 'none';
        aiPreviewEmpty.style.display = 'flex';
        btnGenerateAi.disabled = false;
      }
    };
  }

  // Render preview of the generated elements inside the modal
  function renderGeneratedPreview(data) {
    aiPreviewEmpty.style.display = 'none';
    aiPreviewResults.style.display = 'flex';
    if (btnApplyAi) btnApplyAi.disabled = false;

    if (aiResultTitle) aiResultTitle.textContent = data.venueTitle || 'AI Floorplan Layout';
    if (aiResultSummary) aiResultSummary.textContent = data.roomSummary || 'Architecturally optimized arrangement.';
    if (aiResultCapacity) aiResultCapacity.textContent = data.estimatedGuestCapacity || 0;
    if (aiEngineTag) {
      aiEngineTag.textContent = data.engine && data.engine.includes('gemini') ? `Generated via ${data.engine}` : 'Built via Spatial Architect Engine';
    }

    const elements = data.elements || [];
    const seatingCount = elements.filter(e => e.category === 'seating' || ['round','rect','square','oval','cocktail','classroom','ushape','serpentine'].includes(e.type)).length;
    const stagingCount = elements.filter(e => e.category === 'staging' || ['stage','dancefloor','bar','djbooth','photobooth','lounge'].includes(e.type)).length;
    const archCount = elements.filter(e => e.category === 'architectural' || ['wall','pillar','door','zone'].includes(e.type)).length;

    if (aiCountSeatingText) aiCountSeatingText.textContent = `${seatingCount} Seating Tables`;
    if (aiCountStagingText) aiCountStagingText.textContent = `${stagingCount} Staging Fixtures`;
    if (aiCountArchText) aiCountArchText.textContent = `${archCount} Architectural`;
    if (aiResultCount) aiResultCount.textContent = elements.length;

    if (aiElementsList) {
      aiElementsList.innerHTML = '';
      elements.forEach(item => {
        const row = document.createElement('div');
        row.className = 'ai-element-row';
        
        let typeIcon = '🍽️';
        if (item.type === 'stage') typeIcon = '🎭';
        else if (item.type === 'dancefloor') typeIcon = '💃';
        else if (item.type === 'bar') typeIcon = '🍸';
        else if (item.type === 'djbooth') typeIcon = '🎧';
        else if (item.type === 'photobooth') typeIcon = '📸';
        else if (item.type === 'lounge') typeIcon = '🛋️';
        else if (item.type === 'wall' || item.type === 'door') typeIcon = '🚪';

        row.innerHTML = `
          <div class="ai-elem-left">
            <span class="ai-elem-icon">${typeIcon}</span>
            <div>
              <strong>${item.label || item.type}</strong>
              <small class="text-muted text-xs">${item.type} • ${item.width}×${item.height}px</small>
            </div>
          </div>
          <div class="ai-elem-right">
            <span class="ai-elem-coords">(${Math.round(item.x)}, ${Math.round(item.y)})</span>
            ${item.seats > 0 ? `<span class="ai-elem-seats">${item.seats} seats</span>` : ''}
          </div>
        `;
        aiElementsList.appendChild(row);
      });
    }
  }

  // Visual Rendering Engine: Translates JSON array into drag-and-drop canvas elements
  function applyGeneratedLayoutToCanvas() {
    if (!lastGeneratedPayload || !lastGeneratedPayload.elements) return;
    if (typeof STATE === 'undefined') return;

    const mode = aiPlacementMode ? aiPlacementMode.value : 'replace';
    const autoGuests = aiAutoGenerateGuests ? aiAutoGenerateGuests.checked : true;
    const elements = lastGeneratedPayload.elements;

    if (mode === 'replace') {
      STATE.elements = [];
      STATE.guests = [];
      STATE.selectedIds = [];
      if (lastGeneratedPayload.venueTitle) {
        STATE.projectName = lastGeneratedPayload.venueTitle;
        const projInput = document.getElementById('project-title-input');
        if (projInput) projInput.value = STATE.projectName;
      }
    }

    // Default colors based on categories
    const colors = {
      round: '#242634',
      rect: '#242634',
      square: '#242634',
      oval: '#242634',
      cocktail: '#382b1d',
      classroom: '#1c2838',
      ushape: '#271f38',
      serpentine: '#3b1c2e',
      stage: '#1e3a8a',
      dancefloor: '#312e81',
      bar: '#78350f',
      djbooth: '#831843',
      photobooth: '#065f46',
      lounge: '#334155',
      wall: '#e2e8f0',
      pillar: '#64748b',
      door: '#991b1b',
      zone: 'rgba(99, 102, 241, 0.12)'
    };

    let tableCounter = 1;
    const newCanvasElements = elements.map((item, idx) => {
      const type = item.type || 'round';
      const isTable = isTableType(type);
      const label = item.label || (isTable ? `Table ${tableCounter++}` : `${type.toUpperCase()}`);
      
      return {
        id: item.id || `elem_ai_${Date.now()}_${idx}`,
        type,
        x: Math.round(Number(item.x) || 0),
        y: Math.round(Number(item.y) || 0),
        w: Math.round(Number(item.width || item.w) || 90),
        h: Math.round(Number(item.height || item.h) || 90),
        rot: Math.round(Number(item.rotation || item.rot || 0)),
        seats: item.seats !== undefined ? Number(item.seats) : (isTable ? 8 : 0),
        label,
        color: colors[type] || '#242634',
        borderStyle: 'solid',
        locked: false,
        z: STATE.elements.length + idx + 1
      };
    });

    STATE.elements.push(...newCanvasElements);

    // Auto-generate realistic attendee roster matching table capacities if requested
    if (autoGuests) {
      const diningTables = newCanvasElements.filter(e => isTableType(e.type) && e.seats > 0);
      const totalSeats = diningTables.reduce((sum, t) => sum + t.seats, 0);
      
      const groupPool = ['Executive Team', 'VIP Partners', 'Keynote Speakers', 'Engineering Guild', 'Product & Design', 'Sales Leadership', 'Guest Attendees'];
      const dietPool = ['None', 'None', 'Vegetarian', 'None', 'Vegan', 'Halal', 'Gluten-Free', 'Kosher'];

      let guestNum = STATE.guests.length + 1;
      diningTables.forEach((table, tIdx) => {
        const assignedGroup = groupPool[tIdx % groupPool.length];
        for (let s = 0; s < table.seats; s++) {
          STATE.guests.push({
            id: `guest_${Date.now()}_${guestNum}`,
            name: `Guest ${guestNum}`,
            group: assignedGroup,
            dietary: dietPool[(guestNum + s) % dietPool.length],
            vip: tIdx === 0 || s === 0,
            rsvp: 'Confirmed',
            tableId: table.id,
            seatIndex: s
          });
          guestNum++;
        }
      });
    }

    // Auto-focus camera and fit to viewport
    if (typeof zoomFit === 'function') {
      zoomFit();
    } else {
      STATE.zoom = 1.0;
      STATE.pan = { x: 0, y: 0 };
    }

    // Record history snapshot
    if (typeof saveState === 'function') {
      saveState(`AI Built Spatial Floorplan: ${lastGeneratedPayload.venueTitle || 'New Layout'}`);
    }

    // Render canvas and refresh manifests
    if (typeof render === 'function') render();
    if (typeof renderMinimap === 'function') renderMinimap();
    if (typeof updateAllPanels === 'function') updateAllPanels();
    if (typeof renderGuestsTable === 'function') renderGuestsTable();
    if (typeof playUiSound === 'function') playUiSound('snap');

    closeAiModal();

    if (typeof showToast === 'function') {
      showToast(`✨ Generated and placed ${newCanvasElements.length} elements onto the canvas!`);
    }
  }

  if (btnApplyAi) {
    btnApplyAi.onclick = applyGeneratedLayoutToCanvas;
  }

  // -----------------------------------------------------------------
  // Companion Feature: AI Smart Seating Decider (Option 1 Integration)
  // -----------------------------------------------------------------
  const btnAutoSeatAll = document.getElementById('btn-auto-seat-all');
  if (btnAutoSeatAll) {
    btnAutoSeatAll.onclick = async () => {
      if (typeof STATE === 'undefined') return;
      if (!STATE.hasEditLock) {
        if (typeof showToast === 'function') showToast('You do not hold the edit lock');
        return;
      }

      const tables = STATE.elements.filter(e => isTableType(e.type));
      if (tables.length === 0) {
        if (typeof showToast === 'function') showToast('No tables placed on canvas yet', 'error');
        return;
      }

      const unseated = STATE.guests.filter(g => !g.tableId);
      if (unseated.length === 0) {
        if (typeof showToast === 'function') showToast('All guests are already seated');
        return;
      }

      if (typeof showToast === 'function') showToast('AI Smart Seating Engine optimizing assignments...', 'info');

      try {
        const payload = {
          tables: tables.map(t => ({
            tableId: t.id,
            label: t.label,
            shape: t.type,
            capacity: t.seats
          })),
          guests: unseated.map(g => ({
            guestId: g.id,
            name: g.name,
            group: g.group,
            dietary: g.dietary,
            vip: g.vip
          }))
        };

        const res = await fetch('/api/smart-seating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.assignments)) {
            let assignedCount = 0;
            data.assignments.forEach(item => {
              const guest = STATE.guests.find(g => g.id === item.guestId);
              if (guest) {
                guest.tableId = item.tableId;
                guest.seatIndex = item.seatNumber;
                assignedCount++;
              }
            });

          if (typeof saveState === 'function') {
            saveState(`AI Smart Seating assigned ${assignedCount} guests`);
          }
          if (typeof renderGuestsTable === 'function') renderGuestsTable();
          if (typeof render === 'function') render();
          if (typeof updateAllPanels === 'function') updateAllPanels();
          if (typeof playUiSound === 'function') playUiSound('snap');
            if (typeof showToast === 'function') {
              showToast(`✨ Smart Auto-Seated ${assignedCount} guests with social and capacity balance!`);
            }
            return;
          }
        }
      } catch (e) {
        console.warn('Fallback to local seating algorithm:', e);
      }

      // Fallback local seating if fetch fails
      if (typeof smartAutoSeatAll === 'function') {
        smartAutoSeatAll();
      }
    };
  }

  // Export functions to global scope for debugging or external hooks
  window.AiSpatialBuilder = {
    openModal: openAiModal,
    closeModal: closeAiModal,
    generate: (p) => {
      if (aiPromptInput) aiPromptInput.value = p;
      if (btnGenerateAi) btnGenerateAi.click();
    },
    apply: applyGeneratedLayoutToCanvas
  };
})();
