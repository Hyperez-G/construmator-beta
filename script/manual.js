// Global variables for manual input
let selectedHouseType = null;
let projectData = {};

// Data handler for SDK
let dataSdk;
let isLoading = false;

// Initialize SDK
async function initializeManualApp() {
    if (window.dataSdk) {
        const dataHandler = {
            onDataChanged(data) {
                console.log('Data updated:', data.length, 'projects');
            }
        };
        const result = await window.dataSdk.init(dataHandler);
        if (result.isOk) {
            dataSdk = window.dataSdk;
        }
    }
}

// Toast notification
function showToast(message, type = 'success') {
    // Try SweetAlert2 first if available
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: type === 'error' ? 'error' : 'success',
            title: type === 'error' ? 'Error' : 'Success',
            text: message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        return;
    }
    
    // Fallback to simple toast
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type === 'error' ? 'bg-red-500' : ''}`;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `
        <div style="display: flex; align-items: center;">
            <span style="margin-right: 0.5rem;">${type === 'error' ? '❌' : '✅'}</span>
            ${message}
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Page navigation function
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
}

// House type selection
function selectHouseType(type, element) {
    selectedHouseType = type;
    document.querySelectorAll('.house-type-card').forEach(card => {
        card.classList.remove('selected');
    });
    element.classList.add('selected');
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} house selected! 🏠`);
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

// Material costs
const materialCosts = {
    block: 14,
    cement: 240,
    steel: 300,
    sand: 2400,
    ceramic_tile: 250,
    metal_sheet: 312
};

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
    if (remaining >= 0) {
        remainingElement.className = 'results-value';
        remainingElement.style.color = '#10b981';
    } else {
        remainingElement.className = 'results-value';
        remainingElement.style.color = '#ef4444';
    }

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

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeManualApp();
});

