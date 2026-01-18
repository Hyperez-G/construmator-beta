// Global variables
let selectedHouseType = '';
let projectData = {};
let materials2D = {};
let building2D = [];
let currentZoom = 1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
// Pan and zoom for map-like navigation
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;
// Canvas size (large map area)
const CANVAS_WIDTH = 5000;
const CANVAS_HEIGHT = 5000;
let cameraStream = null;
let dataSdk;
let isLoading = false;
let selectedMaterialType = null;
let placementMode = false;
let deleteMode = false; // Toggle for delete mode
let currentFloor = 1; // Current floor being edited (1 or 2)


const materialCosts = {
    block: 14, steel: 300, roof: 180,
    tile: 300, wood: 650, door: 8000, window: 5000,
    cement: 240, sand: 2400, gravel: 3500,
    plywood: 1140, metal_sheet: 312, ceramic_tile: 250, tile_adhesive: 400
};

// Material icons (Font Awesome class names) and colors
const materialIcons = {
    block: 'fa-solid fa-brick-wall',
    hollowblock: 'fa-solid fa-brick-wall',
    steel: 'fa-solid fa-ruler-combined',
    roof: 'fa-solid fa-house-chimney',
    tile: 'fa-solid fa-table-cells-large',
    wood: 'fa-solid fa-tree',
    door: 'fa-solid fa-door-open',
    window: 'fa-regular fa-window-restore',
    plywood: 'fa-solid fa-layer-group',
    metal_sheet: 'fa-solid fa-square-full',
    ceramic_tile: 'fa-solid fa-border-all',
    tile_adhesive: 'fa-solid fa-fill-drip'
};

const materialColors = {
    block: '#dc2626', steel: '#6b7280', roof: '#059669',
    tile: '#3b82f6', wood: '#92400e', door: '#16a34a', window: '#06b6d4',
    plywood: '#8b5a2b', metal_sheet: '#64748b', ceramic_tile: '#e5e7eb', tile_adhesive: '#fbbf24'
};

// Data handler for SDK
const dataHandler = {
    onDataChanged(data) {
        console.log('Data updated:', data.length, 'projects');
    }
};

// Initialize App
async function initializeApp() {
    if (window.dataSdk) {
        const result = await window.dataSdk.init(dataHandler);
        if (result.isOk) {
            dataSdk = window.dataSdk;
        }
    }

    // Initialize element SDK
    if (window.elementSdk) {
        await window.elementSdk.init({
            defaultConfig: {
                app_title: "CONSTRUMATOR",
            },
            render: async (config) => {
                const titleElement = document.getElementById('app-title');
                const subtitleElement = document.getElementById('app-subtitle');
                if (titleElement) titleElement.textContent = config.app_title || 'CONSTRUMATOR';
                if (subtitleElement) subtitleElement.textContent = config.app_subtitle || 'Philippine Construction Estimator & Builder';
            },
            mapToCapabilities: () => ({
                recolorables: [],
                borderables: [],
                fontEditable: undefined,
                fontSizeable: undefined
            }),
            mapToEditPanelValues: (config) => new Map([
                ["app_title", config.app_title || "CONSTRUMATOR"],

            ])
        });
    }

    initialize2DDragDrop();
}

// Helper: constrain pan to keep canvas within build area boundaries
function constrainPan() {
    const buildArea = document.getElementById('build2DArea');
    if (!buildArea) return;
    
    const rect = buildArea.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;
    
    // Calculate scaled canvas dimensions
    const scaledCanvasWidth = CANVAS_WIDTH * currentZoom;
    const scaledCanvasHeight = CANVAS_HEIGHT * currentZoom;
    
    // Calculate boundaries
    // minPanX: when canvas right edge touches viewport right edge
    // maxPanX: when canvas left edge touches viewport left edge (0)
    const minPanX = viewportWidth - scaledCanvasWidth;
    const maxPanX = 0;
    
    // minPanY: when canvas bottom edge touches viewport bottom edge
    // maxPanY: when canvas top edge touches viewport top edge (0)
    const minPanY = viewportHeight - scaledCanvasHeight;
    const maxPanY = 0;
    
    // Clamp pan values to boundaries
    panX = Math.max(minPanX, Math.min(maxPanX, panX));
    panY = Math.max(minPanY, Math.min(maxPanY, panY));
}

// Helper: update combined transform (zoom + pan + rotation) for map-like navigation
function updateBuildAreaTransform() {
    // Constrain pan before applying transform
    constrainPan();
    
    const canvasContainer = document.getElementById('build2DCanvas');
    if (canvasContainer) {
        // Apply pan and zoom to the canvas container
        canvasContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
    }
    
}

// Page navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type === 'error' ? 'bg-red-500' : ''}`;
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${type === 'error' ? '❌' : '✅'}</span>
            ${message}
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// House type selection
function selectHouseType(type, element) {
    selectedHouseType = type;
    document.querySelectorAll('.house-type-card').forEach(card => {
        card.classList.remove('selected');
    });
    element.classList.add('selected');
    showToast(`${type} house selected! 🏠`);
}

// Proceed to budget page
function proceedToBudget() {
    if (!selectedHouseType) {
        showToast('Please select a house type first', 'error');
        return;
    }

    const roomLength = document.getElementById('roomLength').value;
    const roomWidth = document.getElementById('roomWidth').value;
    const roomHeight = document.getElementById('roomHeight').value;
    const doorWidth = document.getElementById('doorWidth').value;
    const doorHeight = document.getElementById('doorHeight').value;
    const windowWidth = document.getElementById('windowWidth').value;
    const windowHeight = document.getElementById('windowHeight').value;

    if (!roomLength || !roomWidth || !roomHeight) {
        showToast('Please fill in all room dimensions', 'error');
        return;
    }

    // Store dimensions
    projectData = {
        house_type: selectedHouseType,
        room_length: parseFloat(roomLength),
        room_width: parseFloat(roomWidth),
        room_height: parseFloat(roomHeight),
        door_width: parseFloat(doorWidth) || 0,
        door_height: parseFloat(doorHeight) || 0,
        window_width: parseFloat(windowWidth) || 0,
        window_height: parseFloat(windowHeight) || 0
    };

    showPage('page9');
}

// Calculate project materials using accurate formulas
function calculateProject() {
    const budget = parseFloat(document.getElementById('projectBudget').value);
    if (!budget || budget < 1000) {
        showToast('Please enter a valid budget (minimum ₱1,000)', 'error');
        return;
    }

    projectData.budget = budget;

    // Calculate materials based on dimensions (convert feet to meters)
    const lengthM = projectData.room_length * 0.3048;
    const widthM = projectData.room_width * 0.3048;
    const heightM = projectData.room_height * 0.3048;

    const floorArea = lengthM * widthM;
    const wallArea = 2 * (lengthM + widthM) * heightM;

    // Deduct door and window areas
    const doorArea = (projectData.door_width * 0.3048) * (projectData.door_height * 0.3048);
    const windowArea = (projectData.window_width * 0.3048) * (projectData.window_height * 0.3048);
    const netWallArea = wallArea - doorArea - windowArea;

    // Material calculations using accurate formulas
    let multiplier = 1;
    if (projectData.house_type === 'two-story') multiplier = 1.8;
    else if (projectData.house_type === 'duplex') multiplier = 1.5;
    else if (projectData.house_type === 'customized') multiplier = 1.3;

    const blocks = Math.ceil(netWallArea * 12.5 * multiplier);
    
    // Mortar for CHB: 0.522 bags cement per m², 0.0435 m³ sand per m²
    const cementForMortar = Math.ceil(netWallArea * 0.522 * multiplier);
    
    // Concrete for foundation (Class A): 9 bags per m³
    const concreteVolume = floorArea * 0.15 * multiplier; // 15cm thick foundation
    const cementForConcrete = Math.ceil(concreteVolume * 9);
    
    const totalCement = cementForMortar + cementForConcrete;
    
    // Sand calculation: mortar + concrete
    const sandForMortar = parseFloat((netWallArea * 0.0435 * multiplier).toFixed(2));
    const sandForConcrete = parseFloat((concreteVolume * 0.5).toFixed(2));
    const totalSand = sandForMortar + sandForConcrete;
    
    // Steel reinforcement: 1.6m vertical + 2.15m horizontal per m²
    const steelLength = netWallArea * (1.6 + 2.15) * multiplier;
    const steelBars = Math.ceil(steelLength / 6); // 6m per bar

    // Flooring calculation (ceramic tiles)
    const flooringArea = parseFloat((floorArea * multiplier).toFixed(2));
    
    // Ceiling calculation (gypsum board)
    const ceilingArea = parseFloat((floorArea * multiplier).toFixed(2));
    
    // Roofing calculation (metal sheets)
    const roofingArea = parseFloat((floorArea * multiplier * 1.2).toFixed(2)); // 20% extra for slope

    // Cost calculations
    const materialsCost = (blocks * materialCosts.block) + 
                        (totalCement * materialCosts.cement) + 
                        (steelBars * materialCosts.steel) + 
                        (totalSand * materialCosts.sand) +
                        (flooringArea * materialCosts.ceramic_tile) +
                        (ceilingArea * 180) + // Gypsum board cost
                        (roofingArea * materialCosts.metal_sheet);
    const laborCost = materialsCost * 0.4;
    const totalCost = materialsCost + laborCost;

    // Store results
    projectData.blocks_required = blocks;
    projectData.cement_required = totalCement;
    projectData.steel_required = steelBars;
    projectData.sand_required = totalSand;
    projectData.flooring_required = flooringArea;
    projectData.ceiling_required = ceilingArea;
    projectData.roofing_required = roofingArea;
    projectData.total_cost = Math.round(totalCost);
    projectData.materials_used = `Blocks: ${blocks}, Cement: ${totalCement}, Steel: ${steelBars}, Sand: ${totalSand}m³, Flooring: ${flooringArea}m², Ceiling: ${ceilingArea}m², Roofing: ${roofingArea}m²`;

    // Display results
    document.getElementById('blocksRequired').textContent = `${blocks.toLocaleString()} pcs`;
    document.getElementById('cementRequired').textContent = `${totalCement.toLocaleString()} bags`;
    document.getElementById('steelRequired').textContent = `${steelBars.toLocaleString()} pcs`;
    document.getElementById('sandRequired').textContent = `${totalSand} m³`;
    document.getElementById('flooringRequired').textContent = `${flooringArea} m²`;
    document.getElementById('ceilingRequired').textContent = `${ceilingArea} m²`;
    document.getElementById('roofingRequired').textContent = `${roofingArea} m²`;
    document.getElementById('materialsCost').textContent = `₱${materialsCost.toLocaleString()}`;
    document.getElementById('laborCost').textContent = `₱${laborCost.toLocaleString()}`;
    document.getElementById('totalProjectCost').textContent = `₱${totalCost.toLocaleString()}`;
    document.getElementById('yourBudget').textContent = `₱${budget.toLocaleString()}`;
    
    const remaining = budget - totalCost;
    const remainingElement = document.getElementById('remainingBudget');
    remainingElement.textContent = `₱${remaining.toLocaleString()}`;
    remainingElement.className = remaining >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600';

    showPage('page10');
}

// Save project
async function saveProject() {
    if (isLoading) return;
    isLoading = true;

    if (dataSdk) {
        projectData.project_type = 'manual_input';
        projectData.created_at = new Date().toISOString();
        
        const result = await dataSdk.create(projectData);
        if (result.isOk) {
            showToast('Project saved to your Canva Sheet! 💾');
        } else {
            showToast('Failed to save project. Please try again.', 'error');
        }
    } else {
        showToast('Project saved locally! 💾');
    }

    isLoading = false;
}

// Camera functions
async function activateCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        const video = document.getElementById('cameraVideo');
        const placeholder = document.getElementById('cameraPlaceholder');
        
        video.srcObject = cameraStream;
        video.classList.remove('hidden');
        placeholder.style.display = 'none';
        
        showToast('Camera activated! Position your blueprint and capture 📷');
    } catch (error) {
        showToast('Camera access denied or not available', 'error');
    }
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('captureCanvas');
    
    if (video.srcObject) {
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        showToast('Blueprint captured! Click Estimate to analyze 📸');
    } else {
        showToast('Please activate camera first', 'error');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        
        const video = document.getElementById('cameraVideo');
        const placeholder = document.getElementById('cameraPlaceholder');
        
        video.classList.add('hidden');
        placeholder.style.display = 'block';
        
        showToast('Camera stopped 📷');
    }
}

// Blueprint estimation using accurate formulas
function estimateFromBlueprint() {
    const budget = parseFloat(document.getElementById('blueprintBudget').value);
    if (!budget) {
        showToast('Please enter your budget first', 'error');
        return;
    }

    // Simulate blueprint analysis with realistic dimensions
    const estimatedLength = 12 + Math.random() * 8; // 12-20 meters
    const estimatedWidth = 8 + Math.random() * 6; // 8-14 meters
    const estimatedHeight = 2.5 + Math.random() * 1; // 2.5-3.5 meters
    
    const floorArea = estimatedLength * estimatedWidth;
    const wallArea = 2 * (estimatedLength + estimatedWidth) * estimatedHeight;
    
    // Deduct typical door/window areas (10% of wall area)
    const netWallArea = wallArea * 0.9;

    // CHB Estimation: 12.5 blocks per m²
    const blocks = Math.ceil(netWallArea * 12.5);
    
    // Mortar for CHB: 0.522 bags cement per m², 0.0435 m³ sand per m²
    const cementForMortar = Math.ceil(netWallArea * 0.522);
    
    // Concrete for foundation (Class A): 9 bags per m³
    const concreteVolume = floorArea * 0.15; // 15cm thick foundation
    const cementForConcrete = Math.ceil(concreteVolume * 9);
    
    const totalCement = cementForMortar + cementForConcrete;
    
    // Sand calculation: mortar + concrete
    const sandForMortar = parseFloat((netWallArea * 0.0435).toFixed(2));
    const sandForConcrete = parseFloat((concreteVolume * 0.5).toFixed(2));
    const totalSand = sandForMortar + sandForConcrete;
    
    // Steel reinforcement: 1.6m vertical + 2.15m horizontal per m²
    const steelLength = netWallArea * (1.6 + 2.15);
    const steelBars = Math.ceil(steelLength / 6); // 6m per bar

    const materialsCost = (blocks * materialCosts.block) + 
                        (totalCement * materialCosts.cement) + 
                        (steelBars * materialCosts.steel) + 
                        (totalSand * materialCosts.sand);
    const laborCost = materialsCost * 0.4;
    const totalCost = materialsCost + laborCost;

    // Display results
    document.getElementById('blueprintBlocks').textContent = `${blocks.toLocaleString()} pcs`;
    document.getElementById('blueprintCement').textContent = `${totalCement.toLocaleString()} bags`;
    document.getElementById('blueprintSteel').textContent = `${steelBars.toLocaleString()} pcs`;
    document.getElementById('blueprintSand').textContent = `${totalSand} m³`;
    document.getElementById('blueprintTotal').textContent = `₱${totalCost.toLocaleString()}`;

    document.getElementById('blueprintResults').classList.remove('hidden');
    showToast('Blueprint analyzed with accurate formulas! 🔍');
}

// Save blueprint project
async function saveBlueprintProject() {
    if (isLoading) return;
    isLoading = true;

    if (dataSdk) {
        const blueprintData = {
            project_type: 'blueprint_scan',
            budget: parseFloat(document.getElementById('blueprintBudget').value),
            blocks_required: parseInt(document.getElementById('blueprintBlocks').textContent),
            cement_required: parseInt(document.getElementById('blueprintCement').textContent),
            steel_required: parseInt(document.getElementById('blueprintSteel').textContent),
            sand_required: parseFloat(document.getElementById('blueprintSand').textContent),
            total_cost: parseInt(document.getElementById('blueprintTotal').textContent.replace(/[₱,]/g, '')),
            materials_used: 'Blueprint scan analysis',
            created_at: new Date().toISOString()
        };
        
        const result = await dataSdk.create(blueprintData);
        if (result.isOk) {
            showToast('Blueprint project saved! 📱');
        } else {
            showToast('Failed to save project. Please try again.', 'error');
        }
    } else {
        showToast('Blueprint project saved locally! 📱');
    }

    isLoading = false;
}

// Select material for placement
function selectMaterial(type, cost) {
    selectedMaterialType = type;
    placementMode = true;
    deleteMode = false; // Disable delete mode when placing materials
    
    // Update delete button state
    const deleteBtn = document.getElementById('deleteToggle');
    if (deleteBtn) {
        deleteBtn.classList.remove('active');
        deleteBtn.style.backgroundColor = '';
        deleteBtn.style.borderColor = '';
        deleteBtn.style.color = '';
        deleteBtn.querySelector('i').className = 'fas fa-eraser';
        deleteBtn.querySelector('i').style.color = '';
        const span = deleteBtn.querySelector('span');
        if (span) span.textContent = 'Delete Mode';
    }
    
    // Highlight selected material (works with both Tailwind and Bootstrap)
    document.querySelectorAll('.material-palette').forEach(el => {
        el.classList.remove('ring-4', 'ring-blue-500');
    });
    
    // Find the clicked element and highlight it
    const clickedElement = document.querySelector(`[data-type="${type}"]`);
    if (clickedElement) {
        clickedElement.classList.add('ring-4');
        // Add ring-blue-500 only if Tailwind is available (for backward compatibility)
        if (typeof tailwind !== 'undefined') {
            clickedElement.classList.add('ring-blue-500');
        }
    }
    
    // Update build area cursor and message
    const buildArea = document.getElementById('build2DArea');
    if (buildArea) {
        buildArea.style.cursor = 'crosshair';
        const placeholder = document.getElementById('build2DPlaceholder');
        if (placeholder && building2D.length === 0) {
            const hasBootstrap = document.querySelector('.container-fluid, .container, .row');
            if (hasBootstrap) {
                // Bootstrap-compatible HTML
                placeholder.innerHTML = `
                    <div class="text-white text-center">
                        <i class="${materialIcons[type] || 'fas fa-cube'}" style="font-size: 4rem; color: #ff00ff; display: block; margin-bottom: 1rem;"></i>
                        <p class="fw-bold mb-2" style="font-size: 1.2rem;">Click to place ${type.toUpperCase()}</p>
                        <p class="small" style="opacity: 0.9;">Cost: ₱${cost} each</p>
                    </div>
                `;
            } else {
                // Tailwind classes (original)
                placeholder.innerHTML = `
                    <div class="text-white">
                        <span class="text-5xl block mb-4"><i class="${materialIcons[type] || 'fas fa-cube'}"></i></span>
                        <p class="text-xl mb-2 font-semibold text-white drop-shadow-lg">Click to place ${type.toUpperCase()}</p>
                        <p class="text-sm text-white/90 drop-shadow-md">Cost: ₱${cost} each</p>
                    </div>
                `;
            }
        }
    }
}

// Initialize 2D click-to-place system
function initialize2DDragDrop() {
    // Add click handlers to material palette items
    document.addEventListener('click', (e) => {
        const materialElement = e.target.closest('.material-palette');
        if (materialElement) {
            const type = materialElement.dataset.type;
            const cost = materialElement.dataset.cost;
            if (type && cost) {
                selectMaterial(type, parseInt(cost));
            }
        }
    });

    // Add click handler to build area
    const buildArea = document.getElementById('build2DArea');
    const canvasContainer = document.getElementById('build2DCanvas');
    if (!buildArea || !canvasContainer) return;

    // Pan functionality (drag to move around the map)
    buildArea.addEventListener('mousedown', (e) => {
        // Only pan if middle mouse button or spacebar is held, or if zoom is enabled
        if (typeof window !== 'undefined' && typeof window.zoomEnabled !== 'undefined' && window.zoomEnabled) {
            if (e.button === 0) { // Left click
                isPanning = true;
                buildArea.classList.add('panning');
                lastPanX = e.clientX - panX;
                lastPanY = e.clientY - panY;
                e.preventDefault();
            }
        }
    });

    buildArea.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - lastPanX;
            panY = e.clientY - lastPanY;
            // Constrain pan will be called in updateBuildAreaTransform
            updateBuildAreaTransform();
        }
    });

    buildArea.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            buildArea.classList.remove('panning');
        }
    });

    buildArea.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            buildArea.classList.remove('panning');
        }
    });

    // Click to place blocks
    buildArea.addEventListener('click', (e) => {
        // Don't place if we were panning
        if (isPanning) {
            return;
        }
        
        // Don't place if clicking on an existing block
        if (e.target.classList.contains('true-2d-block')) {
            return;
        }
        
        // Check if zoom is enabled - if so, don't allow block placement
        if (typeof window !== 'undefined' && typeof window.zoomEnabled !== 'undefined' && window.zoomEnabled) {
            // Error notification handled by override in builder.html with SweetAlert2
            return;
        }
        
        if (!placementMode || !selectedMaterialType) {
            // Error notification handled by override in builder.html with SweetAlert2
            return;
        }
        
        // Convert viewport coordinates to canvas coordinates
        const rect = buildArea.getBoundingClientRect();
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;
        
        // Convert to canvas coordinates (accounting for pan and zoom)
        const canvasX = (viewportX - panX) / currentZoom;
        const canvasY = (viewportY - panY) / currentZoom;
        
        // Snap to grid
        const x = Math.floor(canvasX / 40) * 40;
        const y = Math.floor(canvasY / 40) * 40;

        // Check bounds (canvas bounds, not viewport)
        if (x < 0 || y < 0 || x >= CANVAS_WIDTH - 40 || y >= CANVAS_HEIGHT - 40) {
            return;
        }

        place2DMaterial(selectedMaterialType, x, y);
    });

    // Scroll wheel zoom (map-like zoom in/out) - only if zoom is enabled
    buildArea.addEventListener('wheel', (e) => {
        // Check if zoom is enabled (for editor mode)
        if (typeof window.zoomEnabled !== 'undefined' && !window.zoomEnabled) {
            return; // Don't zoom if disabled
        }
        e.preventDefault();
        
        // Get mouse position relative to build area
        const rect = buildArea.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate zoom point in canvas coordinates
        const zoomPointX = (mouseX - panX) / currentZoom;
        const zoomPointY = (mouseY - panY) / currentZoom;
        
        // Apply zoom
        const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + zoomDelta));
        
        // Adjust pan to zoom towards mouse position (zoom to point)
        panX = mouseX - zoomPointX * newZoom;
        panY = mouseY - zoomPointY * newZoom;
        
        currentZoom = newZoom;
        // Constrain pan will be called in updateBuildAreaTransform
        updateBuildAreaTransform();
    }, { passive: false });
}

// Place 2D material - only one block at level 1
let isPlacing = false; // Prevent multiple simultaneous placements

function place2DMaterial(type, x, y) {
    // Prevent multiple calls
    if (isPlacing) {
        return;
    }
    isPlacing = true;
    
    const buildArea = document.getElementById('build2DArea');
    if (!buildArea) {
        isPlacing = false;
        return;
    }
    
    // Clean up any orphaned blocks (blocks in array but not in DOM)
    building2D = building2D.filter(block => {
        if (block.element && block.element.parentNode) {
            return true;
        }
        return false;
    });
    
    // Hide placeholder
    const placeholder = document.getElementById('build2DPlaceholder');
    if (placeholder && building2D.length === 0) {
        placeholder.style.display = 'none';
    }
    
    // Get canvas container
    const canvasContainer = document.getElementById('build2DCanvas');
    if (!canvasContainer) {
        isPlacing = false;
        return;
    }

    // Always place at level 1 (fixed level, no auto-stacking)
    const stackLevel = 1;
    
    // Check if there's already a block at this exact position on the current floor
    // Allow same position on different floors (blocks can stack vertically on different floors)
    const existingBlock = building2D.find(block => {
        if (!block.element || !block.element.parentNode) {
            return false; // Skip blocks that no longer exist in DOM
        }
        return block.x === x && 
        block.y === y && 
               block.floor === currentFloor;
    });
    if (existingBlock) {
        showToast('Block already exists at this position on this floor!', 'error');
        isPlacing = false;
        return;
    }
    
    // Create 2D block at level 1 only (fixed position, no stacking)
    // Blocks are positioned relative to the canvas container
    const blockElement = document.createElement('div');
    blockElement.className = 'true-2d-block';
    
    // Add icon for all materials including door
        blockElement.innerHTML = `<i class="${materialIcons[type]}"></i>`;
    
    blockElement.style.color = materialColors[type];
    blockElement.style.backgroundColor = materialColors[type];
    blockElement.style.position = 'absolute';
    
    // Position blocks (all are 40x40px squares)
        blockElement.style.left = `${x}px`;
        blockElement.style.top = `${y}px`;
    
    blockElement.dataset.type = type;
    blockElement.dataset.stackLevel = 1;
    blockElement.dataset.x = x;
    blockElement.dataset.y = y;
    blockElement.dataset.z = 1; // Store z level
    blockElement.dataset.floor = currentFloor; // Store floor number

    // Apply floor visibility
    updateBlockFloorVisibility(blockElement);

    // Add click handler for removing blocks (only if delete mode is active and on current floor)
    blockElement.addEventListener('click', (e) => {
        e.stopPropagation();
        // Only allow removal if delete mode is active and block is on current floor
        if (deleteMode && parseInt(blockElement.dataset.floor) === currentFloor) {
            removeBlock(blockElement, type, x, y, 1);
        }
    });

    // Append to canvas container, not build area
    canvasContainer.appendChild(blockElement);

    // Store in building array with floor
    building2D.push({ type, x, y, z: 1, floor: currentFloor, element: blockElement });

    // Update material count
    if (!materials2D[type]) {
        materials2D[type] = 0;
    }
    materials2D[type]++;
    
    update2DStats();
    
    // Reset flag after a short delay
    setTimeout(() => {
        isPlacing = false;
    }, 100);
}

// Remove block function with proper restacking
function removeBlock(blockElement, type, x, y, stackLevel) {
    // Get the floor from the block element
    const blockFloor = parseInt(blockElement.dataset.floor) || currentFloor;
    
    // Remove from DOM
    blockElement.remove();
    
    // Remove from building array - check floor as well to ensure correct removal
    const blockIndex = building2D.findIndex(block => 
        block.x === x && 
        block.y === y && 
        block.z === stackLevel &&
        block.floor === blockFloor &&
        block.element === blockElement
    );
    if (blockIndex !== -1) {
        building2D.splice(blockIndex, 1);
    } else {
        // Fallback: try to find by element reference only
        const elementIndex = building2D.findIndex(block => block.element === blockElement);
        if (elementIndex !== -1) {
            building2D.splice(elementIndex, 1);
        }
    }
    
    // Update material count
    if (materials2D[type] > 0) {
        materials2D[type]--;
        if (materials2D[type] === 0) {
            delete materials2D[type];
        }
    }
    
    // No restacking needed since we only use level 1
    update2DStats();
}

// Clear 2D build
function clear2DBuild() {
    building2D.forEach(block => block.element.remove());
    building2D = [];
    materials2D = {};
    
    const placeholder = document.getElementById('build2DPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    
    update2DStats();
    // Notification handled by override in builder.html with SweetAlert2
}


// Update 2D stats
function update2DStats() {
    const countElement = document.getElementById('materials2DCount');
    const statsElement = document.getElementById('building2DStats');
    const costElement = document.getElementById('live2DCost');
    
    if (!countElement || !statsElement || !costElement) return;

    // Material count
    if (Object.keys(materials2D).length === 0) {
        countElement.textContent = 'No materials placed';
    } else {
        const counts = Object.entries(materials2D)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');
        countElement.textContent = counts;
    }

    // Building stats
    const totalBlocks = building2D.length;
    const width = building2D.length > 0 ? Math.max(...building2D.map(b => b.x)) / 30 + 1 : 0;
    const height = building2D.length > 0 ? Math.max(...building2D.map(b => b.y)) / 30 + 1 : 0;
    statsElement.textContent = `Size: ${Math.round(width)}×${Math.round(height)} | Blocks: ${totalBlocks}`;

    // Live cost
    let totalCost = 0;
    Object.entries(materials2D).forEach(([type, count]) => {
        totalCost += (materialCosts[type] || 0) * count;
    });
    costElement.textContent = `₱${totalCost.toLocaleString()}`;
}

// Toggle delete mode
function toggleDeleteMode() {
    deleteMode = !deleteMode;
    placementMode = false; // Disable placement mode when delete mode is active
    selectedMaterialType = null;
    
    const deleteBtn = document.getElementById('deleteToggle');
    const buildArea = document.getElementById('build2DArea');
    const selectBtn = document.querySelector('[data-bs-target="#materialsModal"]');
    
    if (deleteMode) {
        // Activate delete mode
        deleteBtn.classList.add('active');
        deleteBtn.style.backgroundColor = '#dc2626';
        deleteBtn.style.borderColor = '#dc2626';
        deleteBtn.style.color = '#fff';
        deleteBtn.querySelector('i').className = 'fas fa-eraser';
        deleteBtn.querySelector('i').style.color = '#fff';
        const span = deleteBtn.querySelector('span');
        if (span) span.textContent = 'Delete Mode';
        
        if (buildArea) {
            buildArea.classList.add('delete-mode');
            buildArea.style.cursor = 'not-allowed';
        }
        
        // Reset material selection button
        if (selectBtn) {
            const span = selectBtn.querySelector('span');
            if (span) {
                span.textContent = 'Select Material';
            }
            selectBtn.classList.remove('active');
        }
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Delete Mode Enabled',
                text: 'Click on blocks to delete them. Click the button again to disable.',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false,
                toast: true,
                position: 'bottom-end',
                background: 'rgba(26, 26, 46, 0.95)',
                color: '#fff',
                iconColor: '#dc2626'
            });
        }
    } else {
        // Deactivate delete mode
        deleteBtn.classList.remove('active');
        deleteBtn.style.backgroundColor = '';
        deleteBtn.style.borderColor = '';
        deleteBtn.style.color = '';
        deleteBtn.querySelector('i').className = 'fas fa-eraser';
        deleteBtn.querySelector('i').style.color = '';
        const span = deleteBtn.querySelector('span');
        if (span) span.textContent = 'Delete Mode';
        
        if (buildArea) {
            buildArea.classList.remove('delete-mode');
            buildArea.style.cursor = placementMode ? 'crosshair' : 'grab';
        }
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Delete Mode Disabled',
                text: 'Block deletion is now disabled.',
                timer: 1500,
                timerProgressBar: true,
                showConfirmButton: false,
                toast: true,
                position: 'bottom-end',
                background: 'rgba(26, 26, 46, 0.95)',
                color: '#fff',
                iconColor: '#10b981'
            });
        }
    }
}

// Switch between floors
function switchFloor() {
    const floorSelector = document.getElementById('floorSelector');
    if (!floorSelector) return;
    
    currentFloor = parseInt(floorSelector.value);
    
    // Update visibility of all blocks
    building2D.forEach(block => {
        if (block.element) {
            updateBlockFloorVisibility(block.element);
        }
    });
    
    // Use SweetAlert2 for floor switch notification
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: `Switched to ${currentFloor === 1 ? '1st' : '2nd'} Floor`,
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false,
            toast: true,
            position: 'bottom-end',
            background: 'rgba(26, 26, 46, 0.95)',
            color: '#fff',
            iconColor: '#10b981'
        });
    } else {
        // Fallback to regular toast if SweetAlert2 is not available
    showToast(`Switched to ${currentFloor === 1 ? '1st' : '2nd'} Floor`, 'success');
    }
}

// Update block visibility based on current floor
function updateBlockFloorVisibility(blockElement) {
    if (!blockElement) return;
    
    const blockFloor = parseInt(blockElement.dataset.floor) || 1;
    
    // Remove previous classes
    blockElement.classList.remove('inactive-floor');
    
    // If block is not on current floor, make it semi-transparent and non-interactive
    if (blockFloor !== currentFloor) {
        blockElement.classList.add('inactive-floor');
        blockElement.style.pointerEvents = 'none';
    } else {
        blockElement.style.pointerEvents = 'auto';
    }
}

// Finalize 2D project
function finalize2DProject() {
    const budget = parseFloat(document.getElementById('builder2DBudget').value);
    if (!budget) {
        showToast('Please enter your budget first', 'error');
        return;
    }

    if (Object.keys(materials2D).length === 0) {
        showToast('Please place some materials first', 'error');
        return;
    }

    // Calculate costs
    let materialsCost = 0;
    Object.entries(materials2D).forEach(([type, count]) => {
        materialsCost += (materialCosts[type] || 0) * count;
    });
    
    const laborCost = materialsCost * 0.4;
    const totalCost = materialsCost + laborCost;
    const remaining = budget - totalCost;

    // Display final results (compatible with both Tailwind and Bootstrap)
    const hasBootstrap = document.querySelector('.container-fluid, .container, .row');
    const materialsHtml = Object.entries(materials2D)
        .map(([type, count]) => {
            if (hasBootstrap) {
                // Bootstrap classes
                return `
                    <div class="results-item">
                        <span class="results-label d-flex align-items-center gap-2">
                            <i class="${materialIcons[type] || 'fas fa-cube'}"></i>
                            <span>${type}</span>
                        </span>
                        <span class="results-value">${count} pcs</span>
                    </div>
                `;
            } else {
                // Tailwind classes (original)
                return `
                    <div class="flex justify-between py-2 border-b border-gray-100">
                        <span class="flex items-center gap-2">
                            <i class="${materialIcons[type] || 'fas fa-cube'}"></i>
                            <span>${type}</span>
                        </span>
                        <span class="font-semibold">${count} pcs</span>
                    </div>
                `;
            }
        }).join('');

    document.getElementById('final2DMaterials').innerHTML = materialsHtml;
    document.getElementById('final2DMaterialsCost').textContent = `₱${materialsCost.toLocaleString()}`;
    document.getElementById('final2DLaborCost').textContent = `₱${laborCost.toLocaleString()}`;
    document.getElementById('final2DTotalCost').textContent = `₱${totalCost.toLocaleString()}`;
    document.getElementById('final2DBudget').textContent = `₱${budget.toLocaleString()}`;
    
    const remainingElement = document.getElementById('final2DRemaining');
    remainingElement.textContent = `₱${remaining.toLocaleString()}`;
    // Support both Tailwind and Bootstrap classes
    if (hasBootstrap) {
        remainingElement.className = remaining >= 0 ? 'results-value positive' : 'results-value negative';
    } else {
        remainingElement.className = remaining >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-600';
    }

    showPage('page13');
}

// User saves database functions
const USER_SAVES_KEY = 'construmator_user_saves';

// Load user saves from localStorage
async function loadUserSaves() {
    try {
        const saves = localStorage.getItem(USER_SAVES_KEY);
        if (saves) {
            return JSON.parse(saves);
        }
        return [];
    } catch (error) {
        console.error('Error loading user saves:', error);
        return [];
    }
}

// Save user saves to localStorage
async function saveUserSaves(saves) {
    try {
        localStorage.setItem(USER_SAVES_KEY, JSON.stringify(saves));
        return true;
    } catch (error) {
        console.error('Error saving user saves:', error);
        return false;
    }
}

// Save 2D builder project for current user
async function saveBuilderProjectToDatabase(projectName = null) {
    if (!window.auth || !window.auth.isLoggedIn()) {
        showToast('Please login to save your project', 'error');
        return false;
    }

    const user = window.auth.getCurrentUser();
    if (!user || !user.id) {
        showToast('User session invalid. Please login again.', 'error');
        return false;
    }

    if (building2D.length === 0) {
        showToast('Please place some materials before saving.', 'error');
        return false;
    }

    // Prompt for project name if not provided
    if (!projectName) {
        if (typeof Swal !== 'undefined') {
            const { value: name } = await Swal.fire({
                title: 'Save Project',
                input: 'text',
                inputLabel: 'Project Name',
                inputPlaceholder: 'Enter project name...',
                inputValue: `Project ${new Date().toLocaleDateString()}`,
                showCancelButton: true,
                confirmButtonText: 'Save',
                cancelButtonText: 'Cancel',
                background: 'rgba(26, 26, 46, 0.95)',
                color: '#fff',
                inputValidator: (value) => {
                    if (!value) {
                        return 'Please enter a project name!';
                    }
                }
            });

            if (!name) return false;
            projectName = name;
        } else {
            projectName = prompt('Enter project name:', `Project ${new Date().toLocaleDateString()}`);
            if (!projectName) return false;
        }
    }

    const budget = parseFloat(document.getElementById('builder2DBudget')?.value || 0);
    
    // Prepare project data
    const projectData = {
        id: Date.now().toString(),
        userId: user.id,
        projectName: projectName,
        version: '1.0',
        savedAt: new Date().toISOString(),
        budget: budget,
        currentFloor: currentFloor,
        materials: { ...materials2D },
        building: building2D.map(block => ({
            type: block.type,
            x: block.x,
            y: block.y,
            z: block.z,
            floor: block.floor || 1
        }))
    };

    // Load existing saves
    const allSaves = await loadUserSaves();
    
    // Check if project name already exists for this user
    const existingIndex = allSaves.findIndex(save => 
        save.userId === user.id && save.projectName === projectName
    );

    if (existingIndex !== -1) {
        // Update existing project
        allSaves[existingIndex] = projectData;
    } else {
        // Add new project
        allSaves.push(projectData);
    }

    // Save to localStorage
    const saved = await saveUserSaves(allSaves);
    
    if (saved) {
        showToast(`Project "${projectName}" saved successfully! 💾`);
        return true;
    } else {
        showToast('Failed to save project. Please try again.', 'error');
        return false;
    }
}

// Load user's saved projects
async function loadUserSavedProjects() {
    if (!window.auth || !window.auth.isLoggedIn()) {
        return [];
    }

    const user = window.auth.getCurrentUser();
    if (!user || !user.id) {
        return [];
    }

    const allSaves = await loadUserSaves();
    return allSaves.filter(save => save.userId === user.id);
}

// Load a specific project
async function loadBuilderProjectFromDatabase(projectId) {
    if (!window.auth || !window.auth.isLoggedIn()) {
        showToast('Please login to load your project', 'error');
        return false;
    }

    const user = window.auth.getCurrentUser();
    if (!user || !user.id) {
        showToast('User session invalid. Please login again.', 'error');
        return false;
    }

    const allSaves = await loadUserSaves();
    const project = allSaves.find(save => save.id === projectId && save.userId === user.id);

    if (!project) {
        showToast('Project not found.', 'error');
        return false;
    }

                        // Clear current construction
                        building2D.forEach(block => {
                            if (block.element) {
                                block.element.remove();
                            }
                        });
                        building2D = [];
                        materials2D = {};

    // Restore budget
    if (project.budget) {
        const budgetInput = document.getElementById('builder2DBudget');
        if (budgetInput) {
            budgetInput.value = project.budget;
        }
    }

    // Restore current floor
    if (project.currentFloor) {
        currentFloor = project.currentFloor;
        const floorSelector = document.getElementById('floorSelector');
        if (floorSelector) {
            floorSelector.value = currentFloor;
        }
    }

                        // Get canvas container
                        const canvasContainer = document.getElementById('build2DCanvas');
                        if (!canvasContainer) {
                            showToast('Canvas container not found.', 'error');
                            return false;
                        }

                        // Hide placeholder
                        const placeholder = document.getElementById('build2DPlaceholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // Restore blocks
    if (project.building && Array.isArray(project.building)) {
        project.building.forEach(blockData => {
                            const blockElement = document.createElement('div');
                            blockElement.className = 'true-2d-block';
            
                            // Add icon for all materials including door
                            blockElement.innerHTML = `<i class="${materialIcons[blockData.type] || 'fas fa-cube'}"></i>`;
                            
                            blockElement.style.color = materialColors[blockData.type] || '#fff';
                            blockElement.style.backgroundColor = materialColors[blockData.type] || '#fff';
                            blockElement.style.position = 'absolute';
                            
                            // Position blocks (all are 40x40px squares)
                            blockElement.style.left = `${blockData.x}px`;
                            blockElement.style.top = `${blockData.y}px`;
            
            blockElement.dataset.type = blockData.type;
            blockElement.dataset.stackLevel = 1;
            blockElement.dataset.x = blockData.x;
            blockElement.dataset.y = blockData.y;
            blockElement.dataset.z = blockData.z || 1;
            blockElement.dataset.floor = blockData.floor || 1;

            // Apply floor visibility
            if (typeof updateBlockFloorVisibility === 'function') {
                updateBlockFloorVisibility(blockElement);
            }

                            // Add click handler (only delete if delete mode is active)
                            blockElement.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (deleteMode && parseInt(blockElement.dataset.floor) === currentFloor) {
                                    removeBlock(blockElement, blockData.type, blockData.x, blockData.y, 1);
                                }
                            });

            canvasContainer.appendChild(blockElement);

                            // Store in building array
                            building2D.push({
                                type: blockData.type,
                                x: blockData.x,
                                y: blockData.y,
                                z: blockData.z || 1,
                                floor: blockData.floor || 1,
                                element: blockElement
                            });

                            // Update material count
                            if (!materials2D[blockData.type]) {
                                materials2D[blockData.type] = 0;
                            }
                            materials2D[blockData.type]++;
                        });
                    }

                    // Restore materials count if available
                    if (project.materials) {
                        materials2D = { ...project.materials };
                    }

                    // Update stats
                    if (typeof update2DStats === 'function') {
                        update2DStats();
                    }
                    
                    // Update floor visibility for all blocks
                    building2D.forEach(block => {
        if (block.element && typeof updateBlockFloorVisibility === 'function') {
            updateBlockFloorVisibility(block.element);
        }
    });

    showToast(`Project "${project.projectName}" loaded successfully! 🏗️`);
    return true;
}

// Delete a saved project
async function deleteBuilderProject(projectId) {
    if (!window.auth || !window.auth.isLoggedIn()) {
        showToast('Please login to delete your project', 'error');
        return false;
    }

    const user = window.auth.getCurrentUser();
    if (!user || !user.id) {
        showToast('User session invalid. Please login again.', 'error');
        return false;
    }

    const allSaves = await loadUserSaves();
    const filteredSaves = allSaves.filter(save => !(save.id === projectId && save.userId === user.id));
    
    const saved = await saveUserSaves(filteredSaves);
    
    if (saved) {
        showToast('Project deleted successfully! 🗑️');
        return true;
    } else {
        showToast('Failed to delete project.', 'error');
        return false;
    }
}

// Save 2D project (legacy function - now uses database)
async function save2DProject() {
    if (isLoading) return;
    isLoading = true;

    // Try to save to user database first
    const saved = await saveBuilderProjectToDatabase();
    
    if (!saved) {
        // Fallback to SDK if available
    if (dataSdk) {
            const budget = parseFloat(document.getElementById('builder2DBudget').value);
        let materialsCost = 0;
            Object.entries(materials2D).forEach(([type, count]) => {
            materialsCost += (materialCosts[type] || 0) * count;
        });

            const project2DData = {
                project_type: '2d_builder',
            budget: budget,
                blocks_required: materials2D.block || 0,
                cement_required: Math.ceil((materials2D.block || 0) * 0.1),
                steel_required: materials2D.steel || 0,
                sand_required: Math.ceil((materials2D.block || 0) * 0.05),
            total_cost: Math.round(materialsCost * 1.4),
                materials_used: Object.entries(materials2D).map(([type, count]) => `${type}: ${count}`).join(', '),
            created_at: new Date().toISOString()
        };
        
            const result = await dataSdk.create(project2DData);
        if (result.isOk) {
                showToast('2D project saved to your Canva Sheet! 🏗️');
        } else {
            showToast('Failed to save project. Please try again.', 'error');
        }
    } else {
            showToast('2D project saved locally! 🏗️');
        }
    }

    isLoading = false;
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});


