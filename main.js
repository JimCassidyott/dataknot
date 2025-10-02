const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
// Keep a global reference of the window object
let mainWindow;

// Initialize secure storage for API keys (will be set up after import)
let store;

/**
 * Handles menu action execution based on the action name
 * @param {string} action - The action name from the menu YAML file
 */
function handleMenuAction(action) {
    switch (action) {
        case 'exitApp':
            app.quit();
            break;
        case 'newWindow':
            // TODO: Implement new window functionality
            break;
        case 'openFile':
            // TODO: Implement open file functionality
            break;
        case 'saveFile':
            // TODO: Implement save file functionality
            break;
        case 'undo':
            // TODO: Implement undo functionality
            break;
        case 'redo':
            // TODO: Implement redo functionality
            break;
        case 'cut':
            // TODO: Implement cut functionality
            break;
        case 'copy':
            // TODO: Implement copy functionality
            break;
        case 'paste':
            // TODO: Implement paste functionality
            break;
        case 'reload':
            mainWindow.reload();
            break;
        case 'toggleFullScreen':
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
            break;
        case 'toggleDevTools':
            mainWindow.webContents.toggleDevTools();
            break;
        case 'showAbout':
            // TODO: Implement about dialog
            break;
        default:
            console.log('Unknown menu action:', action);
    }
}

/**
 * Loads and parses menu definitions from a specified directory
 * Reads all YAML files in the directory and extracts menu sections
 * @param {string} menusDir - Path to the directory containing menu YAML files
 * @returns {Array} Array of menu section objects with label and submenu properties
 */
function loadMenusFromDir(menusDir) {
    let menuSections = [];
    try {
        // Find all YAML files in the specified directory
        const files = fs.readdirSync(menusDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        
        // Process each YAML file
        for (const file of files) {
            const filePath = path.join(menusDir, file);
            const doc = yaml.load(fs.readFileSync(filePath, 'utf8'));
            
            // Validate that the parsed document is an object
            if (doc && typeof doc === 'object') {
                // Iterate through each top-level key in the YAML (e.g., "File", "Edit", "Food")
                for (const key in doc) {
                    if (Array.isArray(doc[key])) {
                        // Create a menu section for each top-level key
                        menuSections.push({
                            label: key,
                            submenu: doc[key].map(item => ({
                                label: item.label || 'Untitled',
                                click: () => {
                                    // Handle function-based actions
                                    if (item.function) {
                                        handleMenuAction(item.function);
                                    } 
                                    // Handle link-based actions
                                    else if (item.link) {
                                        // TODO: Handle navigation to link
                                        console.log('Navigate to:', item.link);
                                    }
                                }
                            }))
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error loading menus from', menusDir, ':', err);
    }
    return menuSections;
}

/**
 * Builds the complete menu template by loading menus from multiple directories
 * Combines main application menus with feature-specific menus (e.g., recipe menus)
 * @returns {Array} Complete menu template array for Electron's Menu.buildFromTemplate()
 */
function buildMenuTemplate() {
    // Define paths for different menu directories
    const rootMenusDir = path.join(__dirname, 'menus'); // Main app menus
    const recipeMenusDir = path.join(__dirname, 'projects', 'project types', 'recipe', 'menus'); // Feature-specific menus
    
    // Load menus from both directories
    const mainMenus = loadMenusFromDir(rootMenusDir);
    const recipeMenus = loadMenusFromDir(recipeMenusDir);
    
    // Combine main menus with feature menus (feature menus appear at the end)
    const menuTemplate = mainMenus.concat(recipeMenus);
    
    // Return fallback menu if no menus were loaded
    return menuTemplate.length > 0 ? menuTemplate : [{ label: 'Menu', submenu: [{ label: 'No items found' }] }];
}

/**
 * Creates the main application window and sets up the dynamic menu system
 */
function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        },
        icon: path.join(__dirname, 'assets/logo.jpeg')
    });

    // Load the index.html file
    mainWindow.loadFile('index.html');

    // Build and set the dynamic application menu
    const menu = Menu.buildFromTemplate(buildMenuTemplate());
    Menu.setApplicationMenu(menu);

    // Open the DevTools in development mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
    // Initialize electron-store
    const Store = (await import('electron-store')).default;
    store = new Store({
        name: 'api-keys',
        encryptionKey: 'recipe-navigator-secure-storage'
    });
    
    createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers for API key management
ipcMain.handle('get-claude-api-key', () => {
    return store.get('claudeApiKey', '');
});

ipcMain.handle('set-claude-api-key', (event, apiKey) => {
    store.set('claudeApiKey', apiKey);
    return true;
});

ipcMain.handle('has-claude-api-key', () => {
    const apiKey = store.get('claudeApiKey', '');
    return apiKey && apiKey.length > 0;
});
