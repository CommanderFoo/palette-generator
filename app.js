/**
 * Low-Poly Palette Generator
 * Generates material palettes for Blender with semantic color rules
 */

// ===== Configuration (Easy to Modify) =====
const TILE_SIZE = 4;
const CANVAS_SIZE = 1024;
const GRID_SIZE = 256;
const PADDING_TILES = 8;  // Adjust this to change padding (tiles, not pixels)
const PADDING_PX = PADDING_TILES * TILE_SIZE;
const LABEL_HEIGHT_PX = 18; // Vertical spacing for labels above each row

// ===== Zoom Configuration =====
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.25;
const ZOOM_WHEEL_FACTOR = 0.001;

// ===== LocalStorage =====
const STORAGE_KEY = "lowpoly-palette-selections";
const SETTINGS_KEY = "lowpoly-palette-settings";

// ===== Theme Definitions =====
const THEMES = {
	none: {
		name: "None (Default)",
		hue_shift: 0,
		saturation_mult: 1.0,
		lightness_shift: 0,
		category_adjustments: {}
	},
	sunset: {
		name: "Sunset",
		hue_shift: -20,
		saturation_mult: 1.1,
		lightness_shift: 5,
		category_adjustments: {
			wood: { hue_shift: 10, saturation_mult: 1.2 },
			foliage: { hue_shift: -30, saturation_mult: 1.3 },
			water: { hue_shift: -60, lightness_shift: 10 },
			stone: { hue_shift: 15, saturation_mult: 0.8 },
			emissive: { hue_shift: -30, saturation_mult: 1.4 }
		}
	},
	icy: {
		name: "Icy / Winter",
		hue_shift: 30,
		saturation_mult: 0.7,
		lightness_shift: 15,
		category_adjustments: {
			wood: { saturation_mult: 0.5, lightness_shift: -10 },
			foliage: { hue_shift: 60, saturation_mult: 0.4 },
			water: { hue_shift: 20, lightness_shift: 20 },
			stone: { saturation_mult: 0.3, lightness_shift: 20 },
			grass: { hue_shift: 40, saturation_mult: 0.3 }
		}
	},
	rustic: {
		name: "Rustic / Earthy",
		hue_shift: 10,
		saturation_mult: 0.85,
		lightness_shift: -10,
		category_adjustments: {
			wood: { saturation_mult: 1.3, lightness_shift: -5 },
			metal_raw: { hue_shift: 20, saturation_mult: 1.2 },
			stone: { hue_shift: 15, saturation_mult: 0.9 },
			dirt: { saturation_mult: 1.2 },
			foliage: { hue_shift: 20, saturation_mult: 0.7 }
		}
	},
	tropical: {
		name: "Tropical",
		hue_shift: -10,
		saturation_mult: 1.3,
		lightness_shift: 5,
		category_adjustments: {
			foliage: { saturation_mult: 1.5, lightness_shift: 10 },
			water: { saturation_mult: 1.4, lightness_shift: 15 },
			flowers: { saturation_mult: 1.5 },
			sand: { hue_shift: -10, lightness_shift: 10 }
		}
	},
	midnight: {
		name: "Midnight",
		hue_shift: 60,
		saturation_mult: 0.6,
		lightness_shift: -25,
		category_adjustments: {
			emissive: { saturation_mult: 1.5, lightness_shift: 20 },
			water: { hue_shift: 40, lightness_shift: -15 },
			foliage: { saturation_mult: 0.4, lightness_shift: -20 },
			magic: { saturation_mult: 1.6, lightness_shift: 15 }
		}
	},
	autumn: {
		name: "Autumn",
		hue_shift: -15,
		saturation_mult: 1.1,
		lightness_shift: -5,
		category_adjustments: {
			foliage: { hue_shift: -40, saturation_mult: 1.4 },
			grass: { hue_shift: -50, saturation_mult: 1.2 },
			wood: { hue_shift: -10, saturation_mult: 1.1 }
		}
	},
	pastel: {
		name: "Pastel",
		hue_shift: 0,
		saturation_mult: 0.5,
		lightness_shift: 25,
		category_adjustments: {}
	},
	neon: {
		name: "Neon / Cyberpunk",
		hue_shift: 0,
		saturation_mult: 1.5,
		lightness_shift: 0,
		category_adjustments: {
			emissive: { saturation_mult: 1.8, lightness_shift: 15 },
			magic: { saturation_mult: 1.8, lightness_shift: 10 },
			plastic: { saturation_mult: 1.6, lightness_shift: 10 },
			metal_raw: { hue_shift: 60, saturation_mult: 0.3 }
		}
	}
};

// ===== Colorblind Simulation Matrices =====
// Based on color transformation research for accurate simulation
const COLORBLIND_MATRICES = {
	none: null,
	protanopia: [
		[0.567, 0.433, 0.000],
		[0.558, 0.442, 0.000],
		[0.000, 0.242, 0.758]
	],
	deuteranopia: [
		[0.625, 0.375, 0.000],
		[0.700, 0.300, 0.000],
		[0.000, 0.300, 0.700]
	],
	tritanopia: [
		[0.950, 0.050, 0.000],
		[0.000, 0.433, 0.567],
		[0.000, 0.475, 0.525]
	],
	achromatopsia: [
		[0.299, 0.587, 0.114],
		[0.299, 0.587, 0.114],
		[0.299, 0.587, 0.114]
	]
};

function apply_colorblind_simulation(r, g, b) {
	var mode = state.colorblind_mode;
	if (mode === "none" || !COLORBLIND_MATRICES[mode]) {
		return { r: r, g: g, b: b };
	}

	var matrix = COLORBLIND_MATRICES[mode];
	var new_r = Math.round(matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b);
	var new_g = Math.round(matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b);
	var new_b = Math.round(matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b);

	return {
		r: Math.max(0, Math.min(255, new_r)),
		g: Math.max(0, Math.min(255, new_g)),
		b: Math.max(0, Math.min(255, new_b))
	};
}

// ===== Category Definitions =====
const CATEGORIES = [
	{
		id: "wood",
		name: "Wood",
		icon: "🪵",
		description: "Light to dark wood tones, warm to cool",
		tiles: { w: 48, h: 48 },
		position: { x: 0, y: 0 },
		colors: {
			hue_range: [20, 40],
			sat_range: [30, 60],
			light_range: [25, 70]
		}
	},
	{
		id: "bark",
		name: "Bark",
		icon: "🌳",
		description: "Darker, textured tree bark tones",
		tiles: { w: 32, h: 32 },
		position: { x: 48, y: 0 },
		colors: {
			hue_range: [15, 35],
			sat_range: [20, 45],
			light_range: [15, 40]
		}
	},
	{
		id: "metal_raw",
		name: "Metal (Raw)",
		icon: "⚙️",
		description: "Steel, iron, silver - raw metal surfaces",
		tiles: { w: 40, h: 40 },
		position: { x: 80, y: 0 },
		colors: {
			hue_range: [200, 220],
			sat_range: [0, 15],
			light_range: [30, 85]
		}
	},
	{
		id: "metal_painted",
		name: "Painted Metal",
		icon: "🎨",
		description: "Industrial painted surfaces",
		tiles: { w: 32, h: 32 },
		position: { x: 120, y: 0 },
		colors: {
			hue_range: [0, 360],
			sat_range: [40, 70],
			light_range: [35, 65]
		}
	},
	{
		id: "plastic",
		name: "Plastic",
		icon: "🧴",
		description: "Bright and muted plastic colors",
		tiles: { w: 32, h: 32 },
		position: { x: 152, y: 0 },
		colors: {
			hue_range: [0, 360],
			sat_range: [50, 85],
			light_range: [45, 75]
		}
	},
	{
		id: "rubber",
		name: "Rubber",
		icon: "⚫",
		description: "Dark, low saturation rubber",
		tiles: { w: 24, h: 24 },
		position: { x: 184, y: 0 },
		colors: {
			hue_range: [0, 30],
			sat_range: [5, 20],
			light_range: [10, 35]
		}
	},
	{
		id: "glass",
		name: "Glass",
		icon: "🔮",
		description: "Clear, frosted, and tinted glass",
		tiles: { w: 24, h: 24 },
		position: { x: 208, y: 0 },
		colors: {
			hue_range: [180, 220],
			sat_range: [10, 40],
			light_range: [60, 95]
		}
	},
	{
		id: "stone",
		name: "Stone",
		icon: "🪨",
		description: "Natural stone and rock surfaces",
		tiles: { w: 32, h: 32 },
		position: { x: 0, y: 48 },
		colors: {
			hue_range: [20, 50],
			sat_range: [5, 20],
			light_range: [25, 70]
		}
	},
	{
		id: "concrete",
		name: "Concrete",
		icon: "🏗️",
		description: "Neutral grey concrete",
		tiles: { w: 24, h: 24 },
		position: { x: 32, y: 48 },
		colors: {
			hue_range: [40, 60],
			sat_range: [0, 10],
			light_range: [35, 65]
		}
	},
	{
		id: "brick",
		name: "Brick / Masonry",
		icon: "🧱",
		description: "Red and brown brick shades",
		tiles: { w: 24, h: 24 },
		position: { x: 56, y: 48 },
		colors: {
			hue_range: [5, 25],
			sat_range: [40, 65],
			light_range: [25, 50]
		}
	},
	{
		id: "dirt",
		name: "Dirt / Soil",
		icon: "🌍",
		description: "Warm earth tones",
		tiles: { w: 24, h: 24 },
		position: { x: 80, y: 48 },
		colors: {
			hue_range: [20, 40],
			sat_range: [30, 55],
			light_range: [15, 40]
		}
	},
	{
		id: "sand",
		name: "Sand / Gravel",
		icon: "🏖️",
		description: "Light neutral sandy tones",
		tiles: { w: 24, h: 24 },
		position: { x: 104, y: 48 },
		colors: {
			hue_range: [35, 50],
			sat_range: [20, 45],
			light_range: [55, 85]
		}
	},
	{
		id: "foliage",
		name: "Foliage",
		icon: "🍃",
		description: "Leaves and plant greens",
		tiles: { w: 32, h: 32 },
		position: { x: 128, y: 48 },
		colors: {
			hue_range: [80, 140],
			sat_range: [35, 70],
			light_range: [25, 60]
		}
	},
	{
		id: "grass",
		name: "Grass / Ground",
		icon: "🌿",
		description: "Fresh and dry grass",
		tiles: { w: 24, h: 24 },
		position: { x: 160, y: 48 },
		colors: {
			hue_range: [60, 120],
			sat_range: [30, 65],
			light_range: [30, 55]
		}
	},
	{
		id: "snow",
		name: "Snow",
		icon: "❄️",
		description: "White and blue-white shades",
		tiles: { w: 24, h: 24 },
		position: { x: 0, y: 80 },
		colors: {
			hue_range: [200, 220],
			sat_range: [0, 15],
			light_range: [85, 100]
		}
	},
	{
		id: "ice",
		name: "Ice",
		icon: "🧊",
		description: "Cool blue ice tones",
		tiles: { w: 24, h: 24 },
		position: { x: 24, y: 80 },
		colors: {
			hue_range: [190, 210],
			sat_range: [20, 50],
			light_range: [65, 90]
		}
	},
	{
		id: "water",
		name: "Water",
		icon: "💧",
		description: "Deep to shallow water blues",
		tiles: { w: 24, h: 24 },
		position: { x: 48, y: 80 },
		colors: {
			hue_range: [190, 220],
			sat_range: [40, 70],
			light_range: [30, 70]
		}
	},
	{
		id: "fabric",
		name: "Fabric / Cloth",
		icon: "🧵",
		description: "Varied cloth colors",
		tiles: { w: 24, h: 24 },
		position: { x: 72, y: 80 },
		colors: {
			hue_range: [0, 360],
			sat_range: [25, 60],
			light_range: [35, 70]
		}
	},
	{
		id: "leather",
		name: "Leather",
		icon: "👜",
		description: "Brown and black leather",
		tiles: { w: 24, h: 24 },
		position: { x: 96, y: 80 },
		colors: {
			hue_range: [15, 35],
			sat_range: [30, 55],
			light_range: [15, 45]
		}
	},
	{
		id: "paper",
		name: "Paper / Cardboard",
		icon: "📄",
		description: "Warm neutral paper tones",
		tiles: { w: 24, h: 24 },
		position: { x: 120, y: 80 },
		colors: {
			hue_range: [35, 50],
			sat_range: [15, 35],
			light_range: [65, 90]
		}
	},
	{
		id: "emissive",
		name: "Emissive",
		icon: "💡",
		description: "Bright glowing colors",
		tiles: { w: 24, h: 24 },
		position: { x: 144, y: 80 },
		colors: {
			hue_range: [0, 360],
			sat_range: [70, 100],
			light_range: [55, 80]
		}
	},
	// ===== Row 3: Natural + Environmental =====
	{
		id: "coral",
		name: "Coral",
		icon: "🐚",
		description: "Ocean coral and shell tones",
		tiles: { w: 20, h: 20 },
		position: { x: 0, y: 112 },
		colors: {
			hue_range: [0, 40],
			sat_range: [40, 70],
			light_range: [60, 85]
		}
	},
	{
		id: "moss",
		name: "Moss",
		icon: "🌱",
		description: "Damp green moss and lichen",
		tiles: { w: 20, h: 20 },
		position: { x: 20, y: 112 },
		colors: {
			hue_range: [70, 130],
			sat_range: [25, 55],
			light_range: [20, 45]
		}
	},
	{
		id: "flowers",
		name: "Flowers",
		icon: "🌸",
		description: "Colorful flower petals",
		tiles: { w: 20, h: 20 },
		position: { x: 40, y: 112 },
		colors: {
			hue_range: [280, 360],
			sat_range: [50, 85],
			light_range: [50, 80]
		}
	},
	{
		id: "mud",
		name: "Mud",
		icon: "🟤",
		description: "Wet muddy earth tones",
		tiles: { w: 20, h: 20 },
		position: { x: 60, y: 112 },
		colors: {
			hue_range: [20, 35],
			sat_range: [35, 60],
			light_range: [10, 30]
		}
	},
	{
		id: "smoke",
		name: "Smoke",
		icon: "�️",
		description: "Atmospheric smoke and fog",
		tiles: { w: 20, h: 20 },
		position: { x: 80, y: 112 },
		colors: {
			hue_range: [200, 220],
			sat_range: [0, 10],
			light_range: [60, 90]
		}
	},
	{
		id: "ash",
		name: "Ash",
		icon: "🌑",
		description: "Dark ash and dust particles",
		tiles: { w: 20, h: 20 },
		position: { x: 100, y: 112 },
		colors: {
			hue_range: [0, 30],
			sat_range: [0, 15],
			light_range: [15, 40]
		}
	},
	{
		id: "frost",
		name: "Frost",
		icon: "❄️",
		description: "Crystalline ice and frost",
		tiles: { w: 20, h: 20 },
		position: { x: 120, y: 112 },
		colors: {
			hue_range: [190, 220],
			sat_range: [30, 60],
			light_range: [75, 98]
		}
	},
	{
		id: "water_variants",
		name: "Water+",
		icon: "🌊",
		description: "Shallow, deep, murky water",
		tiles: { w: 20, h: 20 },
		position: { x: 140, y: 112 },
		colors: {
			hue_range: [180, 220],
			sat_range: [35, 75],
			light_range: [25, 70]
		}
	},
	{
		id: "autumn",
		name: "Autumn",
		icon: "�",
		description: "Red, orange, yellow fall colors",
		tiles: { w: 20, h: 20 },
		position: { x: 160, y: 112 },
		colors: {
			hue_range: [10, 50],
			sat_range: [60, 90],
			light_range: [35, 65]
		}
	},
	{
		id: "spring",
		name: "Spring",
		icon: "🌷",
		description: "Fresh greens, floral accents",
		tiles: { w: 20, h: 20 },
		position: { x: 180, y: 112 },
		colors: {
			hue_range: [80, 150],
			sat_range: [50, 80],
			light_range: [45, 75]
		}
	},
	// ===== Row 4: Metals + Synthetic =====
	{
		id: "rusty_metal",
		name: "Rusty",
		icon: "�",
		description: "Corroded iron and steel",
		tiles: { w: 20, h: 20 },
		position: { x: 0, y: 136 },
		colors: {
			hue_range: [15, 35],
			sat_range: [50, 75],
			light_range: [20, 45]
		}
	},
	{
		id: "brushed_metal",
		name: "Brushed",
		icon: "�",
		description: "Aluminum, chrome, steel finishes",
		tiles: { w: 20, h: 20 },
		position: { x: 20, y: 136 },
		colors: {
			hue_range: [200, 220],
			sat_range: [5, 20],
			light_range: [50, 90]
		}
	},
	{
		id: "gems",
		name: "Gems",
		icon: "💎",
		description: "Diamond, ruby, sapphire, emerald",
		tiles: { w: 24, h: 20 },
		position: { x: 40, y: 136 },
		colors: {
			hue_range: [0, 360],
			sat_range: [60, 95],
			light_range: [40, 75]
		}
	},
	{
		id: "ceramic",
		name: "Ceramic",
		icon: "🏺",
		description: "Glazed ceramic and porcelain",
		tiles: { w: 20, h: 20 },
		position: { x: 64, y: 136 },
		colors: {
			hue_range: [200, 240],
			sat_range: [10, 40],
			light_range: [70, 95]
		}
	},
	{
		id: "foam",
		name: "Foam",
		icon: "🧽",
		description: "Soft foam and sponge materials",
		tiles: { w: 20, h: 20 },
		position: { x: 84, y: 136 },
		colors: {
			hue_range: [40, 60],
			sat_range: [40, 70],
			light_range: [65, 90]
		}
	},
	{
		id: "vinyl",
		name: "Vinyl",
		icon: "📀",
		description: "Glossy or matte vinyl",
		tiles: { w: 20, h: 20 },
		position: { x: 104, y: 136 },
		colors: {
			hue_range: [0, 360],
			sat_range: [40, 80],
			light_range: [50, 80]
		}
	},
	{
		id: "synthetic_fabric",
		name: "Synth",
		icon: "🧥",
		description: "Nylon, polyester, synthetic leather",
		tiles: { w: 20, h: 20 },
		position: { x: 124, y: 136 },
		colors: {
			hue_range: [0, 360],
			sat_range: [30, 60],
			light_range: [25, 55]
		}
	},
	{
		id: "carpet",
		name: "Carpet",
		icon: "🧶",
		description: "Patterned carpet textures",
		tiles: { w: 20, h: 20 },
		position: { x: 144, y: 136 },
		colors: {
			hue_range: [0, 40],
			sat_range: [30, 60],
			light_range: [30, 55]
		}
	},
	{
		id: "winter",
		name: "Winter",
		icon: "🌨️",
		description: "Icy blue, white, subtle purple",
		tiles: { w: 20, h: 20 },
		position: { x: 164, y: 136 },
		colors: {
			hue_range: [200, 280],
			sat_range: [15, 45],
			light_range: [70, 95]
		}
	},
	{
		id: "desert",
		name: "Desert",
		icon: "🏜️",
		description: "Warm sands, dry foliage",
		tiles: { w: 20, h: 20 },
		position: { x: 184, y: 136 },
		colors: {
			hue_range: [30, 55],
			sat_range: [35, 65],
			light_range: [50, 80]
		}
	},
	// ===== Row 5: Stylized + Game =====
	{
		id: "alien",
		name: "Alien",
		icon: "👽",
		description: "Unusual hues, glowing surfaces",
		tiles: { w: 20, h: 20 },
		position: { x: 0, y: 160 },
		colors: {
			hue_range: [140, 200],
			sat_range: [60, 95],
			light_range: [30, 65]
		}
	},
	{
		id: "magic",
		name: "Magic",
		icon: "✨",
		description: "Glowing crystals, runes, energy",
		tiles: { w: 20, h: 20 },
		position: { x: 20, y: 160 },
		colors: {
			hue_range: [260, 320],
			sat_range: [70, 100],
			light_range: [50, 80]
		}
	},
	{
		id: "cartoon",
		name: "Cartoon",
		icon: "�",
		description: "Saturated or pastel plastics",
		tiles: { w: 20, h: 20 },
		position: { x: 40, y: 160 },
		colors: {
			hue_range: [0, 360],
			sat_range: [70, 100],
			light_range: [60, 85]
		}
	},
	{
		id: "food",
		name: "Food",
		icon: "�",
		description: "Bread, fruit, vegetables, meat",
		tiles: { w: 24, h: 20 },
		position: { x: 60, y: 160 },
		colors: {
			hue_range: [0, 60],
			sat_range: [45, 80],
			light_range: [35, 70]
		}
	},
	{
		id: "rubber_variants",
		name: "Rubber+",
		icon: "🛞",
		description: "Colored and transparent rubber",
		tiles: { w: 20, h: 20 },
		position: { x: 84, y: 160 },
		colors: {
			hue_range: [0, 360],
			sat_range: [20, 50],
			light_range: [15, 40]
		}
	},
	{
		id: "sand_variants",
		name: "Sand+",
		icon: "�️",
		description: "Desert, volcanic, colored sand",
		tiles: { w: 20, h: 20 },
		position: { x: 104, y: 160 },
		colors: {
			hue_range: [25, 50],
			sat_range: [30, 60],
			light_range: [45, 80]
		}
	}
];


// ===== State =====
const state = {
	selected_categories: new Set(),
	hovered_category: null,
	zoom: 1,
	pan_x: 0,
	pan_y: 0,
	is_panning: false,
	pan_start_x: 0,
	pan_start_y: 0,
	grid_visible: false,
	current_theme: "none",
	warmth: 0,
	colorblind_mode: "none",
	omit_unselected: false
};

// ===== DOM Elements =====
const category_list = document.getElementById("categoryList");
const canvas = document.getElementById("paletteCanvas");
const ctx = canvas.getContext("2d");
const grid_canvas = document.getElementById("gridCanvas");
const grid_ctx = grid_canvas.getContext("2d");
const download_btn = document.getElementById("downloadBtn");
const select_all_btn = document.getElementById("selectAll");
const clear_all_btn = document.getElementById("clearAll");
const category_count_el = document.querySelector(".category-count");
const canvas_overlay = document.getElementById("canvasOverlay");
const canvas_container = document.getElementById("canvasContainer");
const canvas_wrapper = document.getElementById("canvasWrapper");
const zoom_in_btn = document.getElementById("zoomIn");
const zoom_out_btn = document.getElementById("zoomOut");
const zoom_reset_btn = document.getElementById("zoomReset");
const zoom_level_el = document.getElementById("zoomLevel");
const grid_toggle_btn = document.getElementById("gridToggle");
const theme_select = document.getElementById("themeSelect");
const warmth_slider = document.getElementById("warmthSlider");
const warmth_value_el = document.getElementById("warmthValue");
const colorblind_select = document.getElementById("colorblindSelect");
const omit_unselected_toggle = document.getElementById("omitUnselected");


// ===== LocalStorage Functions =====

function save_selections() {
	try {
		const selections = Array.from(state.selected_categories);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));

		const settings = {
			omit_unselected: state.omit_unselected
		};
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	} catch (err) {
		console.warn("Could not save to localStorage:", err);
	}
}

function load_selections() {
	try {
		const stored_selections = localStorage.getItem(STORAGE_KEY);
		if (stored_selections) {
			const selections = JSON.parse(stored_selections);
			if (Array.isArray(selections)) {
				for (const id of selections) {
					const exists = CATEGORIES.some(function (cat) {
						return cat.id === id;
					});
					if (exists) {
						state.selected_categories.add(id);
					}
				}
			}
		}

		const stored_settings = localStorage.getItem(SETTINGS_KEY);
		if (stored_settings) {
			const settings = JSON.parse(stored_settings);
			if (settings.omit_unselected !== undefined) {
				state.omit_unselected = settings.omit_unselected;
				omit_unselected_toggle.checked = state.omit_unselected;
			}
		}
	} catch (err) {
		console.warn("Could not load from localStorage:", err);
	}
}

// ===== Color Generation =====

function hsl_to_rgb(h, s, l) {
	h = h / 360;
	s = s / 100;
	l = l / 100;

	var r, g, b;

	if (s === 0) {
		r = g = b = l;
	} else {
		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;

		r = hue_to_rgb(p, q, h + 1 / 3);
		g = hue_to_rgb(p, q, h);
		b = hue_to_rgb(p, q, h - 1 / 3);
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hue_to_rgb(p, q, t) {
	if (t < 0) {
		t += 1;
	}
	if (t > 1) {
		t -= 1;
	}
	if (t < 1 / 6) {
		return p + (q - p) * 6 * t;
	}
	if (t < 1 / 2) {
		return q;
	}
	if (t < 2 / 3) {
		return p + (q - p) * (2 / 3 - t) * 6;
	}
	return p;
}

function generate_category_colors(category) {
	var tiles = category.tiles;
	var colors = category.colors;
	var hue_range = colors.hue_range;
	var sat_range = colors.sat_range;
	var light_range = colors.light_range;
	var color_grid = [];

	// Get theme adjustments
	var theme = THEMES[state.current_theme] || THEMES.none;
	var cat_adj = theme.category_adjustments[category.id] || {};

	// Calculate final adjustments (theme base + category-specific + warmth)
	var hue_adj = (theme.hue_shift || 0) + (cat_adj.hue_shift || 0) + state.warmth;
	var sat_mult = (theme.saturation_mult || 1) * (cat_adj.saturation_mult || 1);
	var light_adj = (theme.lightness_shift || 0) + (cat_adj.lightness_shift || 0);

	for (var y = 0; y < tiles.h; y++) {
		var row = [];
		for (var x = 0; x < tiles.w; x++) {
			// Map x to lightness (light on left, dark on right)
			var light_t = x / (tiles.w - 1);
			var lightness = light_range[1] - light_t * (light_range[1] - light_range[0]);

			// Map y to hue (warm at top, cool at bottom)
			var hue_t = y / (tiles.h - 1);
			var hue = hue_range[0] + hue_t * (hue_range[1] - hue_range[0]);

			// Saturation varies slightly with position
			var sat_t = (x + y) / (tiles.w + tiles.h - 2);
			var saturation = sat_range[0] + sat_t * (sat_range[1] - sat_range[0]);

			// Apply theme adjustments
			hue = (hue + hue_adj + 360) % 360;
			saturation = Math.max(0, Math.min(100, saturation * sat_mult));
			lightness = Math.max(5, Math.min(95, lightness + light_adj));

			var rgb = hsl_to_rgb(hue, saturation, lightness);

			// Apply colorblind simulation if enabled
			var simulated = apply_colorblind_simulation(rgb[0], rgb[1], rgb[2]);
			row.push(simulated);
		}
		color_grid.push(row);
	}

	return color_grid;
}

function generate_muted_colors(category) {
	var tiles = category.tiles;
	var color_grid = [];

	for (var y = 0; y < tiles.h; y++) {
		var row = [];
		for (var x = 0; x < tiles.w; x++) {
			// Subtle checkerboard pattern
			var is_light = (x + y) % 2 === 0;
			var val = is_light ? 25 : 20;
			row.push({ r: val, g: val, b: val });
		}
		color_grid.push(row);
	}

	return color_grid;
}

// ===== Canvas Rendering =====

// Calculate which row a category is in based on Y position
function get_category_row(position_y) {
	if (position_y === 0) {
		return 0;
	} else if (position_y < 80) {
		return 1;
	} else if (position_y < 112) {
		return 2;
	} else if (position_y < 136) {
		return 3;
	} else if (position_y < 160) {
		return 4;
	} else {
		return 5;
	}
}

function render_canvas() {
	// Clear with dark background
	ctx.fillStyle = "#0a0a0a";
	ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

	// Draw each category region with padding offset
	for (var i = 0; i < CATEGORIES.length; i++) {
		var category = CATEGORIES[i];
		var is_selected = state.selected_categories.has(category.id);

		// Skip unselected categories if the option is enabled
		if (!is_selected && state.omit_unselected) {
			continue;
		}

		var color_grid = is_selected
			? generate_category_colors(category)
			: generate_muted_colors(category);

		var position = category.position;
		var tiles = category.tiles;

		// Calculate row-based vertical offset for label spacing
		var row = get_category_row(position.y);
		var row_offset = row * LABEL_HEIGHT_PX;

		// Draw tiles with padding and row offset
		for (var y = 0; y < tiles.h; y++) {
			for (var x = 0; x < tiles.w; x++) {
				var color = color_grid[y][x];
				var px = PADDING_PX + (position.x + x) * TILE_SIZE;
				var py = PADDING_PX + row_offset + (position.y + y) * TILE_SIZE;

				ctx.fillStyle = "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";
				ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
			}
		}

		// Draw subtle border around region
		var border_x = PADDING_PX + position.x * TILE_SIZE;
		var border_y = PADDING_PX + row_offset + position.y * TILE_SIZE;
		var border_w = tiles.w * TILE_SIZE;
		var border_h = tiles.h * TILE_SIZE;

		if (is_selected) {
			ctx.strokeStyle = "rgba(74, 222, 128, 0.3)";
		} else {
			ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
		}
		ctx.lineWidth = 1;
		ctx.strokeRect(border_x + 0.5, border_y + 0.5, border_w - 1, border_h - 1);

		// Draw category name label above the region
		var label_x = border_x + border_w / 2;
		var label_y = border_y - 4;

		ctx.font = "bold 10px Inter, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "bottom";

		if (is_selected) {
			ctx.fillStyle = "rgba(74, 222, 128, 0.95)";
		} else {
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		}
		ctx.fillText(category.name, label_x, label_y);
	}
}

// ===== UI Building =====

function build_category_list() {
	category_list.innerHTML = "";

	for (var i = 0; i < CATEGORIES.length; i++) {
		var category = CATEGORIES[i];
		var item = document.createElement("div");
		item.className = "category-item";
		item.dataset.id = category.id;
		item.dataset.tooltip = category.description;

		var icon_bg = get_icon_background(category);

		item.innerHTML =
			"<div class=\"category-icon\" style=\"background: " + icon_bg + "\">" +
			category.icon +
			"</div>" +
			"<div class=\"category-info\">" +
			"<div class=\"category-name\">" + category.name + "</div>" +
			"<div class=\"category-size\">" + category.tiles.w + "×" + category.tiles.h + " tiles</div>" +
			"</div>" +
			"<div class=\"category-check\">" +
			"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\">" +
			"<polyline points=\"20 6 9 17 4 12\"></polyline>" +
			"</svg>" +
			"</div>";

		item.addEventListener("click", create_toggle_handler(category.id));
		category_list.appendChild(item);
	}
}

function create_toggle_handler(id) {
	return function () {
		toggle_category(id);
	};
}

function get_icon_background(category) {
	var colors = category.colors;
	var hue = (colors.hue_range[0] + colors.hue_range[1]) / 2;
	var sat = Math.min((colors.sat_range[0] + colors.sat_range[1]) / 2 + 10, 100);
	var light = Math.min((colors.light_range[0] + colors.light_range[1]) / 2, 50);
	return "hsl(" + hue + ", " + sat + "%, " + light + "%)";
}

function toggle_category(id) {
	if (state.selected_categories.has(id)) {
		state.selected_categories.delete(id);
	} else {
		state.selected_categories.add(id);
	}
	update_ui();
}

function update_ui() {
	// Update category items
	var items = document.querySelectorAll(".category-item");
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		var id = item.dataset.id;
		if (state.selected_categories.has(id)) {
			item.classList.add("selected");
		} else {
			item.classList.remove("selected");
		}
	}

	// Update count
	category_count_el.textContent = state.selected_categories.size + " / " + CATEGORIES.length + " selected";

	// Save to localStorage
	save_selections();

	// Re-render canvas
	render_canvas();
}

// ===== Canvas Hover Interaction =====

function setup_canvas_hover() {
	canvas_container.addEventListener("mousemove", function (e) {
		if (state.is_panning) {
			return;
		}

		var rect = canvas.getBoundingClientRect();
		var scale_x = CANVAS_SIZE / rect.width;
		var scale_y = CANVAS_SIZE / rect.height;

		var canvas_x = (e.clientX - rect.left) * scale_x;
		var canvas_y = (e.clientY - rect.top) * scale_y;

		var tile_x = Math.floor(canvas_x / TILE_SIZE);
		var tile_y = Math.floor(canvas_y / TILE_SIZE);

		var category = find_category_at_tile(tile_x, tile_y);

		if (category && category.id !== state.hovered_category) {
			state.hovered_category = category.id;
			show_region_highlight(category, rect);
		} else if (!category && state.hovered_category) {
			state.hovered_category = null;
			hide_region_highlight();
		}
	});

	canvas_container.addEventListener("mouseleave", function () {
		state.hovered_category = null;
		hide_region_highlight();
	});
}

function find_category_at_tile(tile_x, tile_y) {
	// Account for padding offset
	var adjusted_x = tile_x - PADDING_TILES;
	var adjusted_y_px = (tile_y - PADDING_TILES) * TILE_SIZE;

	for (var i = 0; i < CATEGORIES.length; i++) {
		var cat = CATEGORIES[i];
		var is_selected = state.selected_categories.has(cat.id);

		// Skip unselected categories if the option is enabled
		if (!is_selected && state.omit_unselected) {
			continue;
		}

		var position = cat.position;
		var tiles = cat.tiles;

		// Calculate row offset for this category
		var row = get_category_row(position.y);
		var row_offset = row * LABEL_HEIGHT_PX;

		// Calculate actual pixel bounds with row offset
		var cat_top = row_offset + position.y * TILE_SIZE;
		var cat_bottom = cat_top + tiles.h * TILE_SIZE;
		var cat_left = position.x;
		var cat_right = position.x + tiles.w;

		if (adjusted_x >= cat_left &&
			adjusted_x < cat_right &&
			adjusted_y_px >= cat_top &&
			adjusted_y_px < cat_bottom) {
			return cat;
		}
	}
	return null;
}

function show_region_highlight(category, canvas_rect) {
	var position = category.position;
	var tiles = category.tiles;
	var scale = canvas_rect.width / CANVAS_SIZE;

	// Calculate row offset
	var row = get_category_row(position.y);
	var row_offset = row * LABEL_HEIGHT_PX;

	var left = (PADDING_PX + position.x * TILE_SIZE) * scale;
	var top = (PADDING_PX + row_offset + position.y * TILE_SIZE) * scale;
	var width = tiles.w * TILE_SIZE * scale;
	var height = tiles.h * TILE_SIZE * scale;

	// Position label above if region is in bottom half of canvas
	var region_center_y = position.y + tiles.h / 2;
	var label_class = region_center_y > (GRID_SIZE / 2) ? "region-label label-top" : "region-label";

	canvas_overlay.innerHTML =
		"<div class=\"region-highlight\" style=\"" +
		"left: " + left + "px; " +
		"top: " + top + "px; " +
		"width: " + width + "px; " +
		"height: " + height + "px;" +
		"\">" +
		"<div class=\"" + label_class + "\">" + category.name + "</div>" +
		"</div>";
}

function hide_region_highlight() {
	canvas_overlay.innerHTML = "";
}

// ===== Export =====

function download_png() {
	var link = document.createElement("a");
	link.download = "lowpoly-palette.png";
	link.href = canvas.toDataURL("image/png");
	link.click();
}

// ===== Button Handlers =====

function select_all() {
	for (var i = 0; i < CATEGORIES.length; i++) {
		state.selected_categories.add(CATEGORIES[i].id);
	}
	update_ui();
}

function clear_all() {
	state.selected_categories.clear();
	update_ui();
}

// ===== Zoom Functions =====

function set_zoom(new_zoom) {
	state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, new_zoom));
	apply_zoom();
}

function zoom_in() {
	set_zoom(state.zoom + ZOOM_STEP);
}

function zoom_out() {
	set_zoom(state.zoom - ZOOM_STEP);
}

function zoom_reset() {
	state.zoom = 1;
	state.pan_x = 0;
	state.pan_y = 0;
	apply_zoom();
	center_canvas();
}

function apply_zoom() {
	var size = CANVAS_SIZE * state.zoom;
	canvas.style.width = size + "px";
	canvas.style.height = size + "px";
	grid_canvas.style.width = size + "px";
	grid_canvas.style.height = size + "px";
	canvas_container.style.width = size + "px";
	canvas_container.style.height = size + "px";

	// Update zoom level display
	var percent = Math.round(state.zoom * 100);
	zoom_level_el.textContent = percent + "%";

	// Clear hover highlight since positions changed
	state.hovered_category = null;
	hide_region_highlight();
}

function center_canvas() {
	var wrapper_width = canvas_wrapper.clientWidth;
	var wrapper_height = canvas_wrapper.clientHeight;
	var canvas_width = CANVAS_SIZE * state.zoom;
	var canvas_height = CANVAS_SIZE * state.zoom;

	if (canvas_width < wrapper_width) {
		canvas_wrapper.scrollLeft = 0;
	} else {
		canvas_wrapper.scrollLeft = (canvas_width - wrapper_width) / 2;
	}

	if (canvas_height < wrapper_height) {
		canvas_wrapper.scrollTop = 0;
	} else {
		canvas_wrapper.scrollTop = (canvas_height - wrapper_height) / 2;
	}
}

function setup_zoom_controls() {
	zoom_in_btn.addEventListener("click", zoom_in);
	zoom_out_btn.addEventListener("click", zoom_out);
	zoom_reset_btn.addEventListener("click", zoom_reset);

	// Mouse wheel zoom
	canvas_wrapper.addEventListener("wheel", function (e) {
		e.preventDefault();
		var delta = -e.deltaY * ZOOM_WHEEL_FACTOR;
		set_zoom(state.zoom + delta);
	}, { passive: false });
}

// ===== Pan Functions =====

function setup_pan_controls() {
	canvas_wrapper.addEventListener("mousedown", function (e) {
		if (e.button === 0) {
			e.preventDefault();
			state.is_panning = true;
			state.pan_start_x = e.clientX + canvas_wrapper.scrollLeft;
			state.pan_start_y = e.clientY + canvas_wrapper.scrollTop;
			canvas_wrapper.classList.add("panning");
		}
	});

	window.addEventListener("mousemove", function (e) {
		if (state.is_panning) {
			canvas_wrapper.scrollLeft = state.pan_start_x - e.clientX;
			canvas_wrapper.scrollTop = state.pan_start_y - e.clientY;
		}
	});

	window.addEventListener("mouseup", function () {
		if (state.is_panning) {
			state.is_panning = false;
			canvas_wrapper.classList.remove("panning");
		}
	});
}

// ===== Grid Overlay =====

function render_grid() {
	grid_ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

	grid_ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
	grid_ctx.lineWidth = 1;

	// Draw category region borders
	for (var i = 0; i < CATEGORIES.length; i++) {
		var cat = CATEGORIES[i];
		var x = PADDING_PX + cat.position.x * TILE_SIZE;
		var y = PADDING_PX + cat.position.y * TILE_SIZE;
		var w = cat.tiles.w * TILE_SIZE;
		var h = cat.tiles.h * TILE_SIZE;

		grid_ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	}

	// Draw fine grid lines (every 8 tiles = 32px)
	grid_ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
	var grid_step = 8 * TILE_SIZE;

	for (var gx = PADDING_PX; gx <= CANVAS_SIZE - PADDING_PX; gx += grid_step) {
		grid_ctx.beginPath();
		grid_ctx.moveTo(gx + 0.5, PADDING_PX);
		grid_ctx.lineTo(gx + 0.5, CANVAS_SIZE - PADDING_PX);
		grid_ctx.stroke();
	}

	for (var gy = PADDING_PX; gy <= CANVAS_SIZE - PADDING_PX; gy += grid_step) {
		grid_ctx.beginPath();
		grid_ctx.moveTo(PADDING_PX, gy + 0.5);
		grid_ctx.lineTo(CANVAS_SIZE - PADDING_PX, gy + 0.5);
		grid_ctx.stroke();
	}
}

function toggle_grid() {
	state.grid_visible = !state.grid_visible;

	if (state.grid_visible) {
		grid_canvas.classList.add("visible");
		grid_toggle_btn.classList.add("active");
	} else {
		grid_canvas.classList.remove("visible");
		grid_toggle_btn.classList.remove("active");
	}
}

function setup_grid_toggle() {
	render_grid();
	grid_toggle_btn.addEventListener("click", toggle_grid);
}

// ===== Theme Controls =====

function setup_theme_controls() {
	// Theme dropdown
	theme_select.addEventListener("change", function () {
		state.current_theme = theme_select.value;
		update_ui();
	});

	// Warmth slider
	warmth_slider.addEventListener("input", function () {
		state.warmth = parseInt(warmth_slider.value, 10);
		warmth_value_el.textContent = state.warmth > 0 ? "+" + state.warmth : state.warmth;
		update_ui();
	});

	// Colorblind simulation
	colorblind_select.addEventListener("change", function () {
		state.colorblind_mode = colorblind_select.value;
		update_ui();
	});

	// Omit unselected
	omit_unselected_toggle.addEventListener("change", function () {
		state.omit_unselected = omit_unselected_toggle.checked;
		save_selections();
		render_canvas();
	});
}

// ===== Initialization =====

function init() {
	// Load saved selections from localStorage
	load_selections();

	build_category_list();
	update_ui();
	setup_canvas_hover();
	setup_zoom_controls();
	setup_pan_controls();
	setup_grid_toggle();
	setup_theme_controls();

	download_btn.addEventListener("click", download_png);
	select_all_btn.addEventListener("click", select_all);
	clear_all_btn.addEventListener("click", clear_all);

	// Initial zoom state
	apply_zoom();
}

// Start the app
init();
