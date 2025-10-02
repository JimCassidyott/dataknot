/**
 * Recipe Navigator - Renderer Process Script
 * 
 * This file runs in the renderer process (the web page context) and handles:
 * - Client-side JavaScript functionality
 * - HTMx integration for dynamic content updates
 * - DOM manipulation and event handling
 * - Window management (close button functionality)
 * - Development and debugging features
 */

// Log that the renderer process has loaded successfully
console.log('Recipe Navigator app loaded!');

/**
 * Send message to main process for terminal logging
 * 
 * This function allows the renderer process to send messages
 * to the main process, which can then log them to the terminal.
 */
function logToTerminal(message) {
    if (window.require) {
        try {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('log-to-terminal', message);
        } catch (error) {
            console.log('Error sending to main process:', error);
            console.log(message); // Fallback to console
        }
    } else {
        console.log(message); // Fallback to console
    }
}

// Make logToTerminal available globally
window.logToTerminal = logToTerminal;

/**
 * Electron API Interface
 * 
 * Provides a secure interface for communication between renderer and main process
 * for API key management and other sensitive operations.
 */
if (window.require) {
    try {
        const { ipcRenderer } = require('electron');
        
        // Create electronAPI object for secure communication
        window.electronAPI = {
            invoke: (channel, ...args) => {
                return ipcRenderer.invoke(channel, ...args);
            }
        };
        
        console.log('Electron API interface initialized');
    } catch (error) {
        console.error('Error initializing Electron API:', error);
        // Fallback for non-Electron environments
        window.electronAPI = {
            invoke: () => Promise.resolve(false)
        };
    }
} else {
    // Fallback for non-Electron environments
    window.electronAPI = {
        invoke: () => Promise.resolve(false)
    };
}

/**
 * HTMx Integration
 * 
 * Import HTMx from node_modules for dynamic content updates.
 * HTMx allows for AJAX-like functionality without writing JavaScript,
 * enabling server-side rendering with client-side interactivity.
 */
const htmx = require('htmx.org');

/**
 * DOM Ready Event Handler
 * 
 * This function runs after the HTML document has been completely loaded
 * and parsed. It's the main initialization point for client-side functionality.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    /**
     * Content Initialization
     * 
     * Add any initialization code here that needs to run when the page loads.
     * This section can be used to set up initial state, load data, or
     * configure UI components.
     */
    const content = document.querySelector('.content');
    if (content) {
        // Add a visual indicator that the renderer process is active
        content.innerHTML += '<p>Renderer process active</p>';
    }
    
    /**
     * Close Button Functionality
     * 
     * Set up the close button to properly close the Electron window.
     * This handles different Electron versions and provides fallbacks
     * for different scenarios.
     */
    const closeButton = document.getElementById('closeButton');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            /**
             * Window Closing Logic
             * 
             * Try multiple approaches to close the window, handling different
             * Electron versions and configurations:
             * 
             * 1. Try using the remote module (older Electron versions)
             * 2. Fall back to window.close() if remote is not available
             * 3. Handle cases where neither approach works
             */
            
            // Check if we're running in an Electron environment
            if (window.require) {
                try {
                    // Try to use the remote module (available in older Electron versions)
                    const { remote } = require('electron');
                    if (remote && remote.getCurrentWindow) {
                        remote.getCurrentWindow().close();
                    } else {
                        // Fallback for newer Electron versions where remote is deprecated
                        console.log('Remote module not available, using window.close()');
                        window.close();
                    }
                } catch (error) {
                    // If remote module fails, fall back to window.close()
                    console.log('Error accessing remote module:', error);
                    window.close();
                }
            } else {
                // Fallback if require is not available (non-Electron environment)
                console.log('Not in Electron environment, using window.close()');
                window.close();
            }
        });
    }
}); 