const express = require('express');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS and ensure preflight & method safety across all environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Allow', 'GET, POST, OPTIONS, HEAD');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

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
// POST / GET /api/generate-floorplan: Spatial Text-to-JSON Generator
// Supports both POST and GET to prevent 405 Method Not Allowed
// -------------------------------------------------------------
app.all(['/api/generate-floorplan', '/api/generate-floorplan/'], async (req, res) => {
  res.setHeader('Allow', 'GET, POST, OPTIONS, HEAD');
  const prompt = (req.body && (req.body.prompt || req.body.description)) || req.query.prompt || req.query.description || '';
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

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
    for (const modelName of modelsToTry) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI generation timeout')), 18000)
        );

        const aiPromise = ai.models.generateContent({
          model: modelName,
          contents: prompt.trim(),
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                venueTitle: { type: Type.STRING },
                roomSummary: { type: Type.STRING },
                estimatedGuestCapacity: { type: Type.INTEGER },
                elements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      type: { type: Type.STRING },
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                      rotation: { type: Type.NUMBER },
                      label: { type: Type.STRING },
                      seats: { type: Type.INTEGER },
                      category: { type: Type.STRING }
                    },
                    required: ["type", "x", "y", "width", "height"]
                  }
                }
              },
              required: ["venueTitle", "elements"]
            }
          }
        });

        const response = await Promise.race([aiPromise, timeoutPromise]);

        if (response && response.text) {
          const parsed = JSON.parse(response.text);
          if (parsed.elements && Array.isArray(parsed.elements) && parsed.elements.length > 0) {
            generatedData = parsed;
            modelUsed = modelName;
            break;
          }
        }
      } catch (_ignored) {
        // Continue seamlessly to next candidate model
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
// POST / GET /api/smart-seating: Option 1 Seating Optimization Engine
// -------------------------------------------------------------
app.all(['/api/smart-seating', '/api/smart-seating/'], async (req, res) => {
  res.setHeader('Allow', 'GET, POST, OPTIONS, HEAD');
  let tables = req.body?.tables;
  let guests = req.body?.guests;
  if (!tables && req.query.tables) {
    try { tables = JSON.parse(req.query.tables); } catch(e) {}
  }
  if (!guests && req.query.guests) {
    try { guests = JSON.parse(req.query.guests); } catch(e) {}
  }
  if (!Array.isArray(tables) || !Array.isArray(guests)) {
    return res.status(400).json({ error: 'Tables and guests arrays are required.' });
  }

  const ai = getGeminiClient();
  let assignments = null;

  if (ai && guests.length > 0 && tables.length > 0) {
    const seatingModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
    for (const mName of seatingModels) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI seating timeout')), 14000)
        );

        const aiPromise = ai.models.generateContent({
          model: mName,
          contents: JSON.stringify({ tables, guests }),
          config: {
            systemInstruction: `You are an advanced Event Seating Optimization Engine. Assign guests to available tables based on social dynamics, group tags, dietary tags, VIP status, and table capacities. Output ONLY JSON array mapping guestId to tableId and seatNumber: [{"guestId":"g1","tableId":"t1","seatNumber":0}]`,
            temperature: 0.1,
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

        const response = await Promise.race([aiPromise, timeoutPromise]);
        if (response && response.text) {
          assignments = JSON.parse(response.text);
          if (Array.isArray(assignments) && assignments.length > 0) {
            break;
          }
        }
      } catch (_ignored) {
        // Proceed silently to next candidate model
      }
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

// --- In-Memory Authentication & Project Workspace Store ---
const USERS = [
  {
    id: 'usr_ishan_01',
    email: 'ishan@floorplanpro.com',
    password: 'password123',
    name: 'Ishan Jadhav',
    role: 'planner',
    roleTitle: 'Lead Event Architect',
    initials: 'IJ',
    avatarGradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    joined: 'Jan 2026',
    projects: [
      { id: 'proj_01', name: 'Grand Ballroom Gala 2026', guests: 96, tables: 12, modified: 'Just now' },
      { id: 'proj_02', name: 'Rooftop Summit Keynote', guests: 64, tables: 8, modified: '2 hours ago' },
      { id: 'proj_03', name: 'Sunset Terrace Reception', guests: 120, tables: 15, modified: 'Yesterday' }
    ]
  },
  {
    id: 'usr_elena_02',
    email: 'elena@grandballroom.com',
    password: 'password123',
    name: 'Elena Rostova',
    role: 'venue',
    roleTitle: 'Grand Ballroom Director',
    initials: 'ER',
    avatarGradient: 'linear-gradient(135deg, #0ea5e9, #10b981)',
    joined: 'Feb 2026',
    projects: [
      { id: 'proj_venue_01', name: 'Grand Ballroom Master CAD', guests: 160, tables: 20, modified: '3 days ago' }
    ]
  },
  {
    id: 'usr_marcus_03',
    email: 'marcus@summit.org',
    password: 'password123',
    name: 'Marcus Vance',
    role: 'client',
    roleTitle: 'VIP Host & Client',
    initials: 'MV',
    avatarGradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    joined: 'Mar 2026',
    projects: [
      { id: 'proj_vip_01', name: 'Executive Retreat Seating', guests: 32, tables: 4, modified: '5 hours ago' }
    ]
  }
];

const SESSIONS = new Map();

function generateToken(userId) {
  const token = `fpsess_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  SESSIONS.set(token, {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  });
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const session = SESSIONS.get(cleanToken);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(cleanToken);
    return null;
  }
  return USERS.find(u => u.id === session.userId) || null;
}

// Public demo users list for aesthetic quick-login
app.get('/api/auth/demo-users', (req, res) => {
  const publicProfiles = USERS.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    roleTitle: u.roleTitle,
    initials: u.initials,
    avatarGradient: u.avatarGradient
  }));
  res.json({ success: true, users: publicProfiles });
});

// Authentication: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email address is required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  let user = USERS.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    // Graceful onboarding: Auto-create account for new users
    const defaultName = cleanEmail.split('@')[0].replace(/[._-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    const initials = defaultName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'FP';
    user = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      password: password || 'demo123',
      name: defaultName,
      role: 'planner',
      roleTitle: 'Event Architect',
      initials,
      avatarGradient: 'linear-gradient(135deg, #6366f1, #14b8a6)',
      joined: 'Just now',
      projects: [
        { id: `proj_${Date.now()}`, name: 'Grand Ballroom Gala 2026', guests: 96, tables: 12, modified: 'Just now' }
      ]
    };
    USERS.push(user);
  }

  const token = generateToken(user.id);
  const safeUser = { ...user };
  delete safeUser.password;

  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token,
    user: safeUser
  });
});

// Authentication: Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Name and email are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = USERS.find(u => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    const token = generateToken(existing.id);
    const safeUser = { ...existing };
    delete safeUser.password;
    return res.json({ success: true, token, user: safeUser });
  }

  const roleMap = {
    planner: 'Lead Event Architect',
    venue: 'Venue Operations Director',
    client: 'Event Host & VIP Client',
    caterer: 'Catering & Banquet Director'
  };

  const initials = String(name).trim().split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'FP';
  const newUser = {
    id: `usr_${Date.now()}`,
    email: cleanEmail,
    password: password || 'pass123',
    name: String(name).trim(),
    role: role || 'planner',
    roleTitle: roleMap[role] || 'Event Architect',
    initials,
    avatarGradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
    joined: 'Today',
    projects: [
      { id: `proj_${Date.now()}`, name: 'Grand Ballroom Gala 2026', guests: 96, tables: 12, modified: 'Just now' }
    ]
  };
  USERS.push(newUser);

  const token = generateToken(newUser.id);
  const safeUser = { ...newUser };
  delete safeUser.password;

  res.json({
    success: true,
    message: `Welcome to FloorPlan Pro, ${newUser.name}!`,
    token,
    user: safeUser
  });
});

// Authentication: Current User
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || req.query.token;
  const user = getUserFromToken(authHeader);
  if (!user) {
    return res.status(401).json({ success: false, error: 'No active session or token expired.' });
  }
  const safeUser = { ...user };
  delete safeUser.password;
  res.json({ success: true, user: safeUser });
});

// Authentication: Switch Active Role
app.post('/api/auth/switch-role', (req, res) => {
  const authHeader = req.headers.authorization || req.body.token;
  const user = getUserFromToken(authHeader);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  const { role } = req.body;
  const roleTitles = {
    planner: 'Lead Event Architect',
    venue: 'Venue Operations Director',
    client: 'Event Host & VIP Client',
    caterer: 'Catering & Banquet Director'
  };
  if (roleTitles[role]) {
    user.role = role;
    user.roleTitle = roleTitles[role];
  }
  const safeUser = { ...user };
  delete safeUser.password;
  res.json({ success: true, user: safeUser });
});

// Authentication: Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || req.body.token;
  if (authHeader) {
    const cleanToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    SESSIONS.delete(cleanToken);
  }
  res.json({ success: true, message: 'Signed out successfully.' });
});

// AI Configuration / Status check
app.all(['/api/ai-status', '/api/ai-status/'], (req, res) => {
  res.setHeader('Allow', 'GET, POST, OPTIONS, HEAD');
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
