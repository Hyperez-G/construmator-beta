// Authentication System with JSON Database
// Simple password hashing (for demo purposes - in production use proper hashing)

// Database file path
const DB_PATH = 'database/users.json';

// Simple hash function (for demo - use proper bcrypt in production)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

// Load users from JSON file
async function loadUsers() {
    try {
        const response = await fetch(DB_PATH);
        if (!response.ok) {
            // If file doesn't exist or can't be read, return empty array
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

// Save users to JSON file (using fetch POST to a server endpoint)
// Note: In a real application, you'd need a backend server to write files
// For now, we'll use localStorage as a fallback
async function saveUsers(users) {
    try {
        // Try to save to localStorage as fallback
        localStorage.setItem('construmator_users', JSON.stringify(users));
        
        // In a real app, you'd POST to a server endpoint:
        // await fetch('/api/users', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(users)
        // });
        
        return true;
    } catch (error) {
        console.error('Error saving users:', error);
        return false;
    }
}

// Load users (check localStorage first, then try JSON file)
async function getUsers() {
    // Check localStorage first
    const localUsers = localStorage.getItem('construmator_users');
    if (localUsers) {
        try {
            return JSON.parse(localUsers);
        } catch (e) {
            console.error('Error parsing localStorage users:', e);
        }
    }
    
    // Fallback to JSON file
    return await loadUsers();
}

// Save users (save to both localStorage and try to sync with file)
async function setUsers(users) {
    // Save to localStorage
    localStorage.setItem('construmator_users', JSON.stringify(users));
    
    // Try to save to file (would need backend in production)
    await saveUsers(users);
}

// Check if user is logged in
function isLoggedIn() {
    const session = localStorage.getItem('construmator_session');
    if (!session) return false;
    
    try {
        const sessionData = JSON.parse(session);
        // Check if session is expired (24 hours)
        if (Date.now() > sessionData.expires) {
            logout();
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

// Get current user
function getCurrentUser() {
    const session = localStorage.getItem('construmator_session');
    if (!session) return null;
    
    try {
        const sessionData = JSON.parse(session);
        if (Date.now() > sessionData.expires) {
            logout();
            return null;
        }
        return sessionData.user;
    } catch (e) {
        return null;
    }
}

// Set session
function setSession(user) {
    const sessionData = {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.userType || 'customer'
        },
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem('construmator_session', JSON.stringify(sessionData));
}

// Logout
function logout() {
    localStorage.removeItem('construmator_session');
    window.location.href = '../home.html';
}

// Register new user
async function register(email, password, name, userType = 'customer') {
    // Validation
    if (!email || !password || !name) {
        return { success: false, message: 'All fields are required' };
    }
    
    if (!userType || (userType !== 'customer' && userType !== 'admin')) {
        return { success: false, message: 'Please select a valid user type' };
    }
    
    if (password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { success: false, message: 'Invalid email format' };
    }
    
    // Load existing users
    const users = await getUsers();
    
    // Check if user already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, message: 'Email already registered' };
    }
    
    // Create new user
    const newUser = {
        id: Date.now().toString(),
        email: email.toLowerCase(),
        password: simpleHash(password), // In production, use proper hashing
        name: name,
        userType: userType, // 'customer' or 'admin'
        createdAt: new Date().toISOString(),
        projects: []
    };
    
    // Add user to array
    users.push(newUser);
    
    // Save users
    await setUsers(users);
    
    return { success: true, message: 'Registration successful!', user: newUser };
}

// Login user
async function login(email, password) {
    // Validation
    if (!email || !password) {
        return { success: false, message: 'Email and password are required' };
    }
    
    // Load users
    const users = await getUsers();
    
    // Find user
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        return { success: false, message: 'Invalid email or password' };
    }
    
    // Check password
    const hashedPassword = simpleHash(password);
    if (user.password !== hashedPassword) {
        return { success: false, message: 'Invalid email or password' };
    }
    
    // Set session
    setSession(user);
    
    return { success: true, message: 'Login successful!', user: user };
}

// Check if user is admin
function isAdmin() {
    const user = getCurrentUser();
    return user && user.userType === 'admin';
}

// Check if user is customer
function isCustomer() {
    const user = getCurrentUser();
    return user && user.userType === 'customer';
}

// Export functions for use in other scripts
window.auth = {
    register,
    login,
    logout,
    isLoggedIn,
    getCurrentUser,
    getUsers,
    setUsers,
    isAdmin,
    isCustomer
};

