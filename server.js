const express = require('express');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Serve static assets from project root
app.use(express.static(path.join(__dirname, '.')));

// Lazy Gemini client helper
let aiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Fallback intelligent spatial engine when offline or model unavailable
function generateAlgorithmicFloorplan(prompt) {
  const lower = (prompt || '').toLowerCase();
  
  // Extract table count
  const tableMatch = lower.match(/(\d+)\s*(round|rect|rectangular|banquet|square|oval|high-?top|cocktail)?\s*table/);
  const tableCount = tableMatch ? Math.min(parseInt(tableMatch[1], 10), 36) : 12;

  // Detect table type
  let tableType = 'round';
  let tableSeats = 8;
  let tableW = 90, tableH = 90;

  if (lower.includes('rect') || lower.includes('trestle') || lower.includes('long table')) {
    tableType = 'rect'; tableSeats = 6; tableW = 140; tableH = 70;
  } else if (lower.includes('square')) {
    tableType = 'square'; tableSeats = 4; tableW = 80; tableH = 80;
  } else if (lower.includes('oval') || lower.includes('imperial')) {
    tableType = 'oval'; tableSeats = 10; tableW = 160; tableH = 90;
  } else if (lower.includes('cocktail') || lower.includes('high-top') || lower.includes('standing')) {
    tableType = 'cocktail'; tableSeats = 4; tableW = 46; tableH = 46;
  } else if (lower.includes('classroom') || lower.includes('school') || lower.includes('training')) {
    tableType = 'classroom'; tableSeats = 6; tableW = 150; tableH = 45;
  }

  const elements = [];
  let title = "AI Generated Event Floorplan";
  if (lower.includes('wedding')) title = "Wedding Banquet & Celebration";
  else if (lower.includes('ballroom')) title = "Grand Gala Ballroom";
  else if (lower.includes('conference') || lower.includes('keynote')) title = "Keynote Conference Hall";
  else if (lower.includes('cocktail') || lower.includes('lounge')) title = "VIP Cocktail Lounge";

  // Check for Stage
  const hasStage = lower.includes('stage') || lower.includes('presentation') || lower.includes('keynote') || lower.includes('podium');
  if (hasStage) {
    elements.push({
      id: 'ai_stage_1',
      type: 'stage',
      x: 0,
      y: -260,
      width: 280,
      height: 110,
      rotation: 0,
      label: 'Main Stage',
      seats: 0,
      category: 'staging'
    });
  }

  // Check for Head Table / Dais
  if (lower.includes('head table') || lower.includes('bridal table') || lower.includes('dais')) {
    elements.push({
      id: 'ai_head_table_1',
      type: 'rect',
      x: 0,
      y: hasStage ? -160 : -240,
      width: 220,
      height: 60,
      rotation: 0,
      label: 'Bridal Head Table',
      seats: 8,
      category: 'seating'
    });
  }

  // Check for Dance Floor
  const hasDanceFloor = lower.includes('dance') || lower.includes('dance floor') || lower.includes('dancefloor') || lower.includes('circular dance');
  if (hasDanceFloor) {
    elements.push({
      id: 'ai_dancefloor_1',
      type: 'dancefloor',
      x: 0,
      y: hasStage ? 40 : 0,
      width: 220,
      height: 220,
      rotation: 0,
      label: 'Dance Floor',
      seats: 0,
      category: 'staging'
    });
  }

  // Check for Bars
  const hasBar = lower.includes('bar') || lower.includes('drinks') || lower.includes('cocktail');
  const barCount = lower.includes('2 corner') || lower.includes('two bar') || lower.includes('2 bar') ? 2 : (hasBar ? 1 : 0);
  if (barCount >= 1) {
    elements.push({
      id: 'ai_bar_1',
      type: 'bar',
      x: -440,
      y: -240,
      width: 170,
      height: 60,
      rotation: 0,
      label: 'North Bar',
      seats: 0,
      category: 'staging'
    });
  }
  if (barCount >= 2) {
    elements.push({
      id: 'ai_bar_2',
      type: 'bar',
      x: 440,
      y: -240,
      width: 170,
      height: 60,
      rotation: 0,
      label: 'South Bar',
      seats: 0,
      category: 'staging'
    });
  }

  // Check for DJ Booth
  if (lower.includes('dj') || lower.includes('audio') || lower.includes('music')) {
    elements.push({
      id: 'ai_dj_1',
      type: 'djbooth',
      x: -430,
      y: 240,
      width: 110,
      height: 70,
      rotation: 0,
      label: 'DJ Station',
      seats: 0,
      category: 'staging'
    });
  }

  // Check for Photo Booth
  if (lower.includes('photo') || lower.includes('photobooth')) {
    elements.push({
      id: 'ai_photobooth_1',
      type: 'photobooth',
      x: 430,
      y: 240,
      width: 90,
      height: 90,
      rotation: 0,
      label: 'Photo Booth',
      seats: 0,
      category: 'staging'
    });
  }

  // Check for Lounge / Sofas
  if (lower.includes('lounge') || lower.includes('couch') || lower.includes('sofa')) {
    elements.push({
      id: 'ai_lounge_1',
      type: 'lounge',
      x: -360,
      y: 0,
      width: 140,
      height: 70,
      rotation: 90,
      label: 'VIP Lounge A',
      seats: 0,
      category: 'staging'
    });
    elements.push({
      id: 'ai_lounge_2',
      type: 'lounge',
      x: 360,
      y: 0,
      width: 140,
      height: 70,
      rotation: 270,
      label: 'VIP Lounge B',
      seats: 0,
      category: 'staging'
    });
  }

  // Generate Table Coordinates in clean geometric pattern
  let placedTables = 0;
  
  if (hasDanceFloor) {
    // Symmetrical flanking or ring around the dance floor
    const ringRadius = 260;
    const angles = [];
    const count = Math.min(tableCount, 24);
    
    // Grid around center
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const startX = -320;
    const endX = 320;
    const startY = hasStage ? -80 : -200;
    const endY = 280;

    let index = 1;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        if (placedTables >= count) break;
        const tx = startX + col * 128;
        const ty = startY + row * 115;
        
        // Avoid center dance floor collision (-140 to 140)
        if (Math.abs(tx) < 140 && Math.abs(ty - (hasStage ? 40 : 0)) < 140) {
          continue;
        }

        elements.push({
          id: `ai_table_${index}`,
          type: tableType,
          x: tx,
          y: ty,
          width: tableW,
          height: tableH,
          rotation: 0,
          label: `Table ${index}`,
          seats: tableSeats,
          category: 'seating'
        });
        placedTables++;
        index++;
      }
    }
  } else {
    // Clean rectangular matrix
    const cols = Math.min(tableCount, 5);
    const rows = Math.ceil(tableCount / cols);
    const colSpacing = Math.min(180, Math.floor(800 / (cols + 1)));
    const rowSpacing = Math.min(130, Math.floor(480 / (rows + 1)));
    const startX = -((cols - 1) * colSpacing) / 2;
    const startY = hasStage ? -120 : -((rows - 1) * rowSpacing) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (placedTables >= tableCount) break;
        elements.push({
          id: `ai_table_${placedTables + 1}`,
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

  const estimatedGuestCapacity = elements
    .filter(e => e.category === 'seating' || ['round','rect','square','oval','cocktail','classroom','ushape','serpentine'].includes(e.type))
    .reduce((acc, cur) => acc + (cur.seats || 0), 0);

  return {
    venueTitle: title,
    roomSummary: `Architecturally planned layout featuring ${placedTables} ${tableType} tables (${estimatedGuestCapacity} total seats) with clearance corridors and dedicated focal zones.`,
    estimatedGuestCapacity: estimatedGuestCapacity,
    engine: 'spatial-rule-architect',
    elements
  };
}

// -------------------------------------------------------------
// POST /api/generate-floorplan: Spatial Text-to-JSON Generator
// -------------------------------------------------------------
app.post('/api/generate-floorplan', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt description is required.' });
  }

  const ai = getGeminiClient();
  let generatedData = null;
  let modelUsed = null;

  if (ai) {
    const systemInstruction = `You are a Spatial Layout AI Architect specializing in interior floor planning and venue event mapping. Your role is to convert a natural language room description into a logically structured, mathematically sound coordinate map.

### VENUE GEOMETRY & COORDINATES
The venue coordinate space is centered at (0, 0).
- X coordinate bounds: between -520 and +520
- Y coordinate bounds: between -320 and +320
- Top/Front: (0, -260) to (0, -240) is ideal for a presentation Stage or Bridal Head Table
- Center: (0, 0) or (0, 30) is ideal for a Dance Floor or central focal point
- Corners: (-440, -240), (440, -240), (-440, 240), (440, 240) are ideal for Bars, DJ Booths, Photo Booths, Lounges
- Tables: Dining tables must be placed symmetrically with at least 80px center-to-center distance to maintain open service aisles. Do NOT overlap elements.

### ALLOWED TYPES
- Tables: "round", "rect", "square", "oval", "cocktail", "classroom", "ushape", "serpentine"
- Staging: "stage", "dancefloor", "bar", "djbooth", "photobooth", "lounge"
- Architectural: "wall", "pillar", "door", "zone"

Output clean JSON matching the requested schema. Return every single table and fixture needed to fulfill the user's room prompt.`;

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash'];
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt.trim(),
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                venueTitle: { type: Type.STRING, description: "Descriptive name of the event or room" },
                roomSummary: { type: Type.STRING, description: "One-sentence architectural layout overview" },
                estimatedGuestCapacity: { type: Type.INTEGER, description: "Total seating capacity across all tables" },
                elements: {
                  type: Type.ARRAY,
                  description: "Complete list of furniture, tables, and fixtures",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      type: { type: Type.STRING, description: "round, rect, square, oval, cocktail, classroom, ushape, serpentine, stage, dancefloor, bar, djbooth, photobooth, lounge, wall, door" },
                      x: { type: Type.NUMBER, description: "X coordinate centered at 0 (-520 to 520)" },
                      y: { type: Type.NUMBER, description: "Y coordinate centered at 0 (-320 to 320)" },
                      width: { type: Type.NUMBER, description: "Width in pixels" },
                      height: { type: Type.NUMBER, description: "Height in pixels" },
                      rotation: { type: Type.NUMBER, description: "Rotation in degrees (0, 90, 180, etc.)" },
                      label: { type: Type.STRING, description: "Label like Table 1, Main Stage, North Bar" },
                      seats: { type: Type.INTEGER, description: "Seating capacity (0 for fixtures like stage/dancefloor)" },
                      category: { type: Type.STRING, description: "seating, staging, or architectural" }
                    },
                    required: ["type", "x", "y", "width", "height"]
                  }
                }
              },
              required: ["venueTitle", "elements"]
            }
          }
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed.elements && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
            generatedData = parsed;
            modelUsed = modelName;
            break;
          }
        }
      } catch (err) {
        console.warn(`Attempt with ${modelName} failed:`, err.message || err);
      }
    }
  }

  // Fallback to algorithmic generator if Gemini call failed or key not present
  if (!generatedData) {
    generatedData = generateAlgorithmicFloorplan(prompt);
    modelUsed = 'algorithmic-spatial-engine';
  }

  // Sanitize and ensure coordinates stay within venue viewport bounds
  const sanitizedElements = (generatedData.elements || []).map((el, i) => {
    const rawType = (el.type || 'round').toLowerCase().replace(/[\s_-]/g, '');
    let safeType = 'round';
    if (['round','rect','square','oval','cocktail','classroom','ushape','serpentine','stage','dancefloor','bar','djbooth','photobooth','lounge','wall','pillar','door','zone'].includes(rawType)) {
      safeType = rawType;
    } else if (rawType.includes('dance')) {
      safeType = 'dancefloor';
    } else if (rawType.includes('stage')) {
      safeType = 'stage';
    } else if (rawType.includes('bar')) {
      safeType = 'bar';
    } else if (rawType.includes('booth')) {
      safeType = rawType.includes('dj') ? 'djbooth' : 'photobooth';
    }

    const w = Math.max(20, Math.min(800, Number(el.width || el.w) || (safeType === 'stage' ? 260 : safeType === 'dancefloor' ? 220 : 90)));
    const h = Math.max(20, Math.min(800, Number(el.height || el.h) || (safeType === 'stage' ? 110 : safeType === 'dancefloor' ? 220 : 90)));
    const x = Math.max(-540, Math.min(540, Math.round(Number(el.x) || 0)));
    const y = Math.max(-330, Math.min(330, Math.round(Number(el.y) || 0)));
    const rot = Math.round(Number(el.rotation || el.rot || 0)) % 360;

    let category = el.category;
    if (!category) {
      if (['round','rect','square','oval','cocktail','classroom','ushape','serpentine'].includes(safeType)) category = 'seating';
      else if (['stage','dancefloor','bar','djbooth','photobooth','lounge'].includes(safeType)) category = 'staging';
      else category = 'architectural';
    }

    const defaultSeats = category === 'seating' ? (safeType === 'square' ? 4 : safeType === 'rect' ? 6 : safeType === 'oval' ? 10 : 8) : 0;
    const seats = el.seats !== undefined ? Number(el.seats) : defaultSeats;

    return {
      id: el.id || `el_${Date.now()}_${i}`,
      type: safeType,
      x,
      y,
      width: w,
      height: h,
      rotation: rot,
      label: el.label || `${safeType.charAt(0).toUpperCase() + safeType.slice(1)} ${i + 1}`,
      seats,
      category
    };
  });

  const totalSeats = sanitizedElements
    .filter(e => e.category === 'seating')
    .reduce((acc, cur) => acc + (cur.seats || 0), 0);

  res.json({
    success: true,
    engine: modelUsed,
    venueTitle: generatedData.venueTitle || 'AI Spatial Floorplan',
    roomSummary: generatedData.roomSummary || `Floorplan with ${sanitizedElements.length} elements and ${totalSeats} seats.`,
    estimatedGuestCapacity: generatedData.estimatedGuestCapacity || totalSeats,
    elements: sanitizedElements
  });
});

// -------------------------------------------------------------
// POST /api/smart-seating: Option 1 Seating Optimization Engine
// -------------------------------------------------------------
app.post('/api/smart-seating', async (req, res) => {
  const { tables, guests } = req.body;
  if (!Array.isArray(tables) || !Array.isArray(guests)) {
    return res.status(400).json({ error: 'Tables and guests arrays are required.' });
  }

  const ai = getGeminiClient();
  let assignments = null;

  if (ai && guests.length > 0 && tables.length > 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: JSON.stringify({ tables, guests }),
        config: {
          systemInstruction: `You are an advanced Event Seating Optimization Engine. Your task is to assign a list of guests to a specific set of available tables based on social dynamics, group tags, dietary tags, VIP status, and table capacities.
Output ONLY a JSON array mapping guestId to tableId and seatNumber:
[
  { "guestId": "g1", "tableId": "t1", "seatNumber": 0 }
]`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                guestId: { type: Type.STRING },
                tableId: { type: Type.STRING },
                seatNumber: { type: Type.INTEGER }
              },
              required: ["guestId", "tableId", "seatNumber"]
            }
          }
        }
      });

      if (response && response.text) {
        assignments = JSON.parse(response.text);
      }
    } catch (e) {
      console.warn('AI Smart Seating API error, using algorithmic sorter:', e.message);
    }
  }

  // Fallback to local group-balanced seating algorithm
  if (!assignments || !Array.isArray(assignments)) {
    assignments = [];
    const sortedGuests = [...guests].sort((a, b) => {
      // VIPs first, then group
      if (a.vip !== b.vip) return a.vip ? -1 : 1;
      return (a.group || '').localeCompare(b.group || '');
    });

    for (const table of tables) {
      const cap = Number(table.capacity || table.seats) || 8;
      for (let s = 0; s < cap; s++) {
        if (sortedGuests.length === 0) break;
        const g = sortedGuests.shift();
        assignments.push({
          guestId: g.guestId || g.id,
          tableId: table.tableId || table.id,
          seatNumber: s
        });
      }
    }
  }

  res.json({
    success: true,
    assignments
  });
});

// AI Configuration / Status check
app.get('/api/ai-status', (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    active: true,
    hasKey,
    model: 'gemini-3.8-flash / gemini-3.6-flash',
    features: ['text-to-floorplan', 'smart-seating-decider']
  });
});

// SPA / static fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FloorPlan Pro server running on http://0.0.0.0:${PORT}`);
});
