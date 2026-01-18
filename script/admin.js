// Admin Dashboard Script

// Check if user is admin and redirect if not
function checkAdminAccess() {
    if (!window.auth || !window.auth.isLoggedIn()) {
        Swal.fire({
            icon: 'warning',
            title: 'Access Denied',
            text: 'Please login to access the admin dashboard.',
            confirmButtonText: 'Go to Login',
            confirmButtonColor: '#ff00ff',
            background: 'rgba(26, 26, 46, 0.95)',
            color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '../login.html';
            } else {
                window.location.href = '../../home.html';
            }
        });
        return false;
    }

    const user = window.auth.getCurrentUser();
    if (!user || user.userType !== 'admin') {
        Swal.fire({
            icon: 'error',
            title: 'Access Denied',
            text: 'You do not have permission to access the admin dashboard.',
            confirmButtonText: 'Go to Home',
            confirmButtonColor: '#ff00ff',
            background: 'rgba(26, 26, 46, 0.95)',
            color: '#fff'
        }).then(() => {
            window.location.href = '../../home.html';
        });
        return false;
    }

    return true;
}

// Initialize admin dashboard
async function initAdminDashboard() {
    if (!checkAdminAccess()) {
        return;
    }

    // Update user info in navbar
    const user = window.auth.getCurrentUser();
    if (user) {
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) {
            const displayName = user.name || user.email;
            userNameEl.textContent = displayName;
            userNameEl.title = displayName;
        }
        
        if (userAvatarEl) {
            const initials = (user.name || user.email).charAt(0).toUpperCase();
            userAvatarEl.textContent = initials;
        }
    }

    // Load dashboard data
    await loadDashboardStats();
    await loadUsersTable();
    await loadProjectsTable();
    await loadRecentActivity();
    await loadProjectStats();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Load users - use auth.getUsers() if available
        let users = [];
        if (window.auth && typeof window.auth.getUsers === 'function') {
            users = await window.auth.getUsers();
        } else {
            users = await loadUsers();
        }
        const totalUsers = users.length;
        const totalAdmins = users.filter(u => u.userType === 'admin').length;
        const activeUsers = users.length; // In a real app, track last login time

        // Load projects
        const allProjects = await loadAllProjects();
        const totalProjects = allProjects.length;

        // Update UI
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('totalAdmins').textContent = totalAdmins;
        document.getElementById('activeUsers').textContent = activeUsers;
        document.getElementById('totalProjects').textContent = totalProjects;
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load users table
async function loadUsersTable() {
    try {
        // Use auth.getUsers() if available, otherwise use loadUsers()
        let users = [];
        if (window.auth && typeof window.auth.getUsers === 'function') {
            users = await window.auth.getUsers();
        } else {
            users = await loadUsers();
        }
        
        console.log('Loaded users:', users); // Debug log
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4" style="color: rgba(255, 255, 255, 0.5);">
                        No users found.
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by registration date (newest first)
        users.sort((a, b) => {
            const dateA = new Date(a.registeredAt || 0);
            const dateB = new Date(b.registeredAt || 0);
            return dateB - dateA;
        });

        tbody.innerHTML = users.map(user => {
            const registeredDate = user.registeredAt 
                ? new Date(user.registeredAt).toLocaleDateString() 
                : 'N/A';
            
            const userTypeBadge = user.userType === 'admin' 
                ? '<span class="badge-admin">Admin</span>' 
                : '<span class="badge-customer">Customer</span>';

            return `
                <tr>
                    <td>${user.name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${userTypeBadge}</td>
                    <td>${registeredDate}</td>
                    <td>
                        <button class="btn btn-sm" style="background: rgba(255, 0, 255, 0.2); border: 1px solid var(--pink-accent); color: #fff; padding: 0.25rem 0.75rem;" onclick="viewUser('${user.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading users table:', error);
        document.getElementById('usersTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4" style="color: rgba(255, 0, 0, 0.7);">
                    Error loading users.
                </td>
            </tr>
        `;
    }
}

// Load projects table
async function loadProjectsTable() {
    try {
        const allProjects = await loadAllProjects();
        const users = window.auth && typeof window.auth.getUsers === 'function' 
            ? await window.auth.getUsers() 
            : await loadUsers();
        
        // Create user lookup map
        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user;
        });

        const tbody = document.getElementById('projectsTableBody');
        
        if (allProjects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4" style="color: rgba(255, 255, 255, 0.5);">
                        No projects found.
                    </td>
                </tr>
            `;
            return;
        }

        // Sort by saved date (newest first)
        allProjects.sort((a, b) => {
            const dateA = new Date(a.savedAt || 0);
            const dateB = new Date(b.savedAt || 0);
            return dateB - dateA;
        });

        tbody.innerHTML = allProjects.map(project => {
            const user = userMap[project.userId];
            const userName = user ? (user.name || user.email) : 'Unknown User';
            const blockCount = project.building ? project.building.length : 0;
            const budget = project.budget ? `₱${parseFloat(project.budget).toLocaleString()}` : 'N/A';
            const savedDate = project.savedAt 
                ? new Date(project.savedAt).toLocaleDateString() 
                : 'N/A';

            return `
                <tr>
                    <td>${project.projectName || 'Unnamed Project'}</td>
                    <td>${userName}</td>
                    <td>${blockCount}</td>
                    <td>${budget}</td>
                    <td>${savedDate}</td>
                    <td>
                        <button class="btn btn-sm" style="background: rgba(0, 212, 255, 0.2); border: 1px solid var(--blue-accent); color: #fff; padding: 0.25rem 0.75rem;" onclick="viewProject('${project.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading projects table:', error);
        document.getElementById('projectsTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4" style="color: rgba(255, 0, 0, 0.7);">
                    Error loading projects.
                </td>
            </tr>
        `;
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const allProjects = await loadAllProjects();
        const users = window.auth && typeof window.auth.getUsers === 'function' 
            ? await window.auth.getUsers() 
            : await loadUsers();
        
        // Create user lookup map
        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user;
        });

        // Get recent projects (last 10)
        const recentProjects = allProjects
            .sort((a, b) => {
                const dateA = new Date(a.savedAt || 0);
                const dateB = new Date(b.savedAt || 0);
                return dateB - dateA;
            })
            .slice(0, 10);

        const activityEl = document.getElementById('recentActivity');
        
        if (recentProjects.length === 0) {
            activityEl.innerHTML = `
                <p style="color: rgba(255, 255, 255, 0.5); text-align: center; padding: 2rem;">
                    No recent activity.
                </p>
            `;
            return;
        }

        activityEl.innerHTML = recentProjects.map(project => {
            const user = userMap[project.userId];
            const userName = user ? (user.name || user.email) : 'Unknown User';
            const savedDate = project.savedAt 
                ? new Date(project.savedAt).toLocaleString() 
                : 'N/A';

            return `
                <div style="padding: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--pink-accent), var(--purple-light)); display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #fff; margin-bottom: 0.25rem;">
                            ${project.projectName || 'Unnamed Project'}
                        </div>
                        <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6);">
                            by ${userName} • ${savedDate}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading recent activity:', error);
        document.getElementById('recentActivity').innerHTML = `
            <p style="color: rgba(255, 0, 0, 0.7); text-align: center; padding: 2rem;">
                Error loading recent activity.
            </p>
        `;
    }
}

// Load project statistics
async function loadProjectStats() {
    try {
        const allProjects = await loadAllProjects();
        
        const stats = {
            total: allProjects.length,
            withBudget: allProjects.filter(p => p.budget).length,
            totalBlocks: allProjects.reduce((sum, p) => sum + (p.building ? p.building.length : 0), 0),
            avgBlocks: allProjects.length > 0 
                ? Math.round(allProjects.reduce((sum, p) => sum + (p.building ? p.building.length : 0), 0) / allProjects.length)
                : 0
        };

        const statsEl = document.getElementById('projectStats');
        statsEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.5rem;">Total Projects</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${stats.total}</div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.5rem;">With Budget</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${stats.withBudget}</div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.5rem;">Total Blocks</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${stats.totalBlocks}</div>
                </div>
                <div style="padding: 1rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.5rem;">Avg Blocks/Project</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${stats.avgBlocks}</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading project stats:', error);
    }
}

// Helper function to load users
async function loadUsers() {
    try {
        // First check localStorage (where users are actually stored in this client-side app)
        const localUsers = localStorage.getItem('construmator_users');
        if (localUsers) {
            try {
                const parsed = JSON.parse(localUsers);
                if (Array.isArray(parsed)) {
                    console.log('Found users in localStorage:', parsed.length);
                    return parsed;
                }
            } catch (parseError) {
                console.error('Error parsing localStorage users:', parseError);
            }
        }
        
        // Fallback to JSON file
        try {
            const response = await fetch('../../database/users.json');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    console.log('Found users in JSON file:', data.length);
                    return data;
                }
            }
        } catch (fetchError) {
            console.error('Error fetching users.json:', fetchError);
        }
        
        console.log('No users found in localStorage or JSON file');
        return [];
    } catch (error) {
        console.error('Error loading users:', error);
        // Final fallback to localStorage
        const localUsers = localStorage.getItem('construmator_users');
        if (localUsers) {
            try {
                return JSON.parse(localUsers);
            } catch (e) {
                console.error('Error parsing localStorage in fallback:', e);
            }
        }
        return [];
    }
}

// Helper function to load all projects
async function loadAllProjects() {
    try {
        const response = await fetch('../../database/users-saves.json');
        if (!response.ok) {
            const localSaves = localStorage.getItem('construmator_user_saves');
            return localSaves ? JSON.parse(localSaves) : [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error loading projects:', error);
        const localSaves = localStorage.getItem('construmator_user_saves');
        return localSaves ? JSON.parse(localSaves) : [];
    }
}

// Show section
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected section
    const selectedSection = document.getElementById(`${sectionName}-section`);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }

    // Update active menu item
    document.querySelectorAll('.sidebar-menu-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Reload section data if needed
    if (sectionName === 'users') {
        loadUsersTable();
    } else if (sectionName === 'projects') {
        loadProjectsTable();
    } else if (sectionName === 'analytics') {
        loadProjectStats();
    }
}

// Toggle user dropdown
function toggleUserDropdown() {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

// Close user dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.user-dropdown');
    const menu = document.getElementById('userDropdownMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// Toggle sidebar (mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
}

// Toggle sidebar (desktop)
let sidebarCollapsed = false;
function toggleSidebarDesktop() {
    sidebarCollapsed = !sidebarCollapsed;
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
    
    if (mainContent) {
        mainContent.classList.toggle('expanded');
    }
}

// View user details
function viewUser(userId) {
    Swal.fire({
        title: 'User Details',
        html: 'Loading user information...',
        icon: 'info',
        confirmButtonText: 'Close',
        confirmButtonColor: '#ff00ff',
        background: 'rgba(26, 26, 46, 0.95)',
        color: '#fff'
    });

    // Load and display user details
    const loadUsersFunc = window.auth && typeof window.auth.getUsers === 'function' 
        ? window.auth.getUsers 
        : loadUsers;
    loadUsersFunc().then(users => {
        const user = users.find(u => u.id === userId);
        if (user) {
            Swal.fire({
                title: 'User Details',
                html: `
                    <div style="text-align: left; color: rgba(255, 255, 255, 0.9);">
                        <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Type:</strong> ${user.userType === 'admin' ? 'Admin' : 'Customer'}</p>
                        <p><strong>Registered:</strong> ${user.registeredAt ? new Date(user.registeredAt).toLocaleString() : 'N/A'}</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Close',
                confirmButtonColor: '#ff00ff',
                background: 'rgba(26, 26, 46, 0.95)',
                color: '#fff'
            });
        }
    });
}

// View project details
function viewProject(projectId) {
    Swal.fire({
        title: 'Project Details',
        html: 'Loading project information...',
        icon: 'info',
        confirmButtonText: 'Close',
        confirmButtonColor: '#ff00ff',
        background: 'rgba(26, 26, 46, 0.95)',
        color: '#fff'
    });

    // Load and display project details
    loadAllProjects().then(projects => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const blockCount = project.building ? project.building.length : 0;
            const budget = project.budget ? `₱${parseFloat(project.budget).toLocaleString()}` : 'N/A';
            const savedDate = project.savedAt ? new Date(project.savedAt).toLocaleString() : 'N/A';

            Swal.fire({
                title: 'Project Details',
                html: `
                    <div style="text-align: left; color: rgba(255, 255, 255, 0.9);">
                        <p><strong>Project Name:</strong> ${project.projectName || 'Unnamed Project'}</p>
                        <p><strong>Blocks:</strong> ${blockCount}</p>
                        <p><strong>Budget:</strong> ${budget}</p>
                        <p><strong>Saved Date:</strong> ${savedDate}</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Close',
                confirmButtonColor: '#ff00ff',
                background: 'rgba(26, 26, 46, 0.95)',
                color: '#fff'
            });
        }
    });
}

// Handle logout from dropdown
document.addEventListener('DOMContentLoaded', () => {
    const logoutItem = document.querySelector('.user-dropdown-item:last-child');
    if (logoutItem && logoutItem.textContent.includes('Logout')) {
        logoutItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.auth) {
                window.auth.logout();
                window.location.href = '../../home.html';
            }
        });
    }

    // Initialize dashboard
    initAdminDashboard();
});



