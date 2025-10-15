const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * ChatManager - Comprehensive chat history and artifact management system
 *
 * ARCHITECTURE OVERVIEW:
 * This class manages persistent chat conversations for the Recipe Navigator Electron app.
 * It handles saving/loading conversations to disk, managing artifacts (files generated
 * during conversations), and communicating with the Python FastAPI server.
 *
 * KEY FEATURES:
 * - Persistent conversation storage in individual folders (chat_1234567890/)
 * - Artifact management (JSON, text, binary files per conversation)
 * - Project type classification (chat vs recipe projects)
 * - DataKnot command processing for project type transitions
 * - Integration with Python API server via HTTP requests
 * - Metadata management for conversation properties
 *
 * DATA STRUCTURE:
 * chat_history/
 * ├── chat_1234567890/
 * │   ├── conversation.json    # Full conversation data
 * │   ├── metadata.json        # Conversation properties (title, type, etc.)
 * │   └── artifacts/           # Generated files during conversation
 * │       ├── recipe.json
 * │       └── ingredients.txt
 * └── chat_1234567891/
 *     └── ...
 *
 * INTEGRATION POINTS:
 * - Communicates with Python FastAPI server at localhost:8000
 * - Uses Node.js fs/path modules for file operations
 * - Integrates with Electron's main process for API key management
 * - Supports both Ollama (via Python server) and Claude models
 */
class ChatManager {
    /**
     * Constructor - Initialize ChatManager instance
     *
     * Sets up core dependencies and configuration:
     * - fs: Node.js filesystem module for file operations
     * - path: Node.js path module for cross-platform path handling
     * - chatHistoryDir: Base directory for storing all chat conversations
     *
     * The chatHistoryDir defaults to 'chat_history' in the application root.
     * All conversation data is stored under this directory in timestamped folders.
     */
    constructor() {
        this.fs = fs;
        this.path = path;
        this.chatHistoryDir = 'chat_history';
    }

    /**
     * Initialize chat history directory and load saved conversations
     *
     * This is the main initialization method called when the application starts.
     * It performs a complete setup of the chat persistence system:
     *
     * 1. Creates the base chat_history directory if it doesn't exist
     * 2. Ensures all existing conversations have artifacts directories
     * 3. Initializes project types for legacy conversations
     * 4. Loads all saved conversations into memory
     *
     * @returns {Array} Array of conversation objects sorted by creation time (newest first)
     * @throws {Error} Logs errors but doesn't throw - returns empty array on failure
     *
     * USAGE:
     * const chatManager = new ChatManager();
     * const conversations = chatManager.initChatHistory();
     * // conversations is now populated with all saved chat data
     */
    initChatHistory() {
        try {
            // Step 1: Create chat history directory if it doesn't exist
            // This is the root directory where all conversation folders are stored
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                this.fs.mkdirSync(this.chatHistoryDir, { recursive: true });
            }

            // Step 2: Create artifacts directories for all existing conversations
            // Each conversation needs an 'artifacts' subdirectory for generated files
            this.createArtifactsDirectories();

            // Step 3: Initialize default project types for all existing chats
            // Legacy conversations might not have projectType metadata - this adds it
            this.initializeDefaultProjectTypes();

            // Step 4: Load saved conversations from disk into memory
            // Returns conversations sorted by creation time (newest first)
            return this.loadChatHistory();
        } catch (error) {
            console.error('Error initializing chat history:', error);
            return [];
        }
    }

    /**
     * Save all conversations to chat history folders
     *
     * This method performs a complete save operation for all conversations:
     * 1. Clears existing conversation folders to prevent data conflicts
     * 2. Creates new folder structure for each conversation
     * 3. Saves conversation data and metadata
     * 4. Processes DataKnot commands to update project types
     *
     * DATAKNOT COMMAND SYSTEM:
     * Users can send special commands prefixed with "dataknot:" to control
     * conversation behavior. Currently supported:
     * - "dataknot: start recipe" - Changes conversation projectType to "recipe"
     *
     * METADATA STRUCTURE:
     * {
     *   "id": "1234567890",           // Conversation timestamp ID
     *   "title": "User's title",      // Conversation title
     *   "created": "1234567890",      // Creation timestamp
     *   "lastModified": "1234567890", // Last modification timestamp
     *   "messageCount": 5,           // Number of messages in conversation
     *   "version": "1.0",            // Metadata format version
     *   "projectType": "chat|recipe" // Type of project this conversation represents
     * }
     *
     * @param {Array} conversations - Array of conversation objects to save
     * @returns {void}
     * @throws {Error} Logs errors but continues processing other conversations
     */
    saveChatHistory(conversations) {
        try {
            // Ensure directory exists
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                this.fs.mkdirSync(this.chatHistoryDir, { recursive: true });
            }
            
            // Clear existing conversation folders
            const files = this.fs.readdirSync(this.chatHistoryDir);
            files.forEach(file => {
                const filePath = this.path.join(this.chatHistoryDir, file);
                const stat = this.fs.statSync(filePath);
                if (stat.isDirectory() && file.startsWith('chat_')) {
                    // Remove entire conversation folder
                    this.removeDirectoryRecursive(filePath);
                }
            });
            
            // Save each conversation to its own folder
            conversations.forEach((conversation, index) => {
                const conversationDir = `chat_${conversation.id}`;
                const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
                
                // Create conversation directory
                if (!this.fs.existsSync(conversationPath)) {
                    this.fs.mkdirSync(conversationPath, { recursive: true });
                }
                
                // Create artifacts directory for this conversation
                const artifactsPath = this.path.join(conversationPath, 'artifacts');
                if (!this.fs.existsSync(artifactsPath)) {
                    this.fs.mkdirSync(artifactsPath, { recursive: true });
                }
                
                // Save main conversation data
                const conversationFile = this.path.join(conversationPath, 'conversation.json');
                this.fs.writeFileSync(conversationFile, JSON.stringify(conversation, null, 2));
                
                // Create or update metadata file
                const metadataFile = this.path.join(conversationPath, 'metadata.json');
                let metadata;
                
                // Try to read existing metadata to preserve custom fields
                if (this.fs.existsSync(metadataFile)) {
                    try {
                        const existingMetadata = this.fs.readFileSync(metadataFile, 'utf8');
                        metadata = JSON.parse(existingMetadata);
                    } catch (error) {
                        console.warn('Could not parse existing metadata, creating new:', error);
                        metadata = {};
                    }
                } else {
                    metadata = {};
                }
                
                // Update standard fields
                metadata.id = conversation.id;
                metadata.title = conversation.title;
                metadata.created = conversation.id;
                metadata.lastModified = Date.now();
                metadata.messageCount = conversation.messages.length;
                metadata.version = '1.0';
                
                // Set default projectType if not already set (preserve existing projectType)
                if (!metadata.projectType || metadata.projectType === '') {
                    metadata.projectType = 'chat';
                }
                
                // DATAKNOT COMMAND PROCESSING:
                // Check if the last user message is a DataKnot command
                // DataKnot commands allow users to control conversation behavior
                // Format: "dataknot: <command>"
                const lastUserMessage = conversation.messages
                    .filter(msg => msg.role === 'user')
                    .pop();

                if (lastUserMessage) {
                    const messageContent = lastUserMessage.content.trim().toLowerCase();
                    console.log(`Checking last user message: "${messageContent}"`);

                    // Check for DataKnot command - extract everything after "dataknot:" and strip spaces
                    // Example: "dataknot: start recipe" -> command = "start recipe"
                    if (messageContent.startsWith('dataknot:')) {
                        const command = messageContent.substring(9).trim(); // Remove 'dataknot:' prefix and strip spaces
                        console.log(`DataKnot command detected: "${command}"`);

                        // COMMAND: "start recipe"
                        // Changes conversation from generic "chat" to "recipe" project type
                        // This enables recipe-specific features and UI elements
                        if (command === 'start recipe') {
                            console.log(`DataKnot start recipe command confirmed: changing projectType to "recipe" for conversation ${conversation.id}`);
                            console.log(`Original projectType: "${metadata.projectType}"`);

                            // Update the projectType to "recipe" and update lastModified timestamp
                            // This triggers UI changes and enables recipe-specific functionality
                            metadata.projectType = 'recipe';
                            metadata.lastModified = Date.now();

                            console.log(`Updated projectType to: "${metadata.projectType}"`);
                            console.log(`Updated lastModified to: ${metadata.lastModified}`);
                        } else {
                            // Log unsupported DataKnot commands for debugging
                            // Future commands can be added here (e.g., "export", "archive", etc.)
                            console.log(`DataKnot command "${command}" is not "start recipe"`);
                        }
                    }
                }
                
                // Write the updated metadata
                const updatedContent = JSON.stringify(metadata, null, 2);
                this.fs.writeFileSync(metadataFile, updatedContent, 'utf8');
                
                // Verify the write was successful (only log if DataKnot command was processed)
                if (lastUserMessage) {
                    const lastMessageContent = lastUserMessage.content.trim().toLowerCase();
                    if (lastMessageContent.startsWith('dataknot:')) {
                        const command = lastMessageContent.substring(9).trim();
                        if (command === 'start recipe') {
                            try {
                                const verifyContent = this.fs.readFileSync(metadataFile, 'utf8');
                                const verifyMetadata = JSON.parse(verifyContent);
                                console.log(`✅ Verified metadata write successful - projectType: "${verifyMetadata.projectType}"`);
                            } catch (verifyError) {
                                console.error('❌ Failed to verify metadata write:', verifyError);
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    /**
     * Initialize all existing chats with default projectType 'chat'
     */
    initializeDefaultProjectTypes() {
        try {
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                return; // No chat history directory exists
            }
            
            const files = this.fs.readdirSync(this.chatHistoryDir);
            files.forEach(file => {
                const filePath = this.path.join(this.chatHistoryDir, file);
                const stat = this.fs.statSync(filePath);
                
                if (stat.isDirectory() && file.startsWith('chat_')) {
                    const metadataFile = this.path.join(filePath, 'metadata.json');
                    
                    if (this.fs.existsSync(metadataFile)) {
                        try {
                            const metadataContent = this.fs.readFileSync(metadataFile, 'utf8');
                            const metadata = JSON.parse(metadataContent);
                            
                            // Add default projectType if it doesn't exist
                            if (!metadata.projectType) {
                                metadata.projectType = 'chat';
                                metadata.lastModified = Date.now();
                                
                                this.fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
                                console.log(`Added default projectType 'chat' to ${file}`);
                            }
                        } catch (error) {
                            console.warn(`Could not update metadata for ${file}:`, error);
                        }
                    }
                }
            });
            
            console.log('Initialized default project types for all existing chats');
        } catch (error) {
            console.error('Error initializing default project types:', error);
        }
    }

    /**
     * Update metadata.json with projectType for a specific conversation
     */
    updateMetadataWithProjectType(conversationId, projectType = "recipe") {
        try {
            const conversationDir = `chat_${conversationId}`;
            const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
            const metadataFile = this.path.join(conversationPath, 'metadata.json');
            
            // Check if the conversation directory exists
            if (!this.fs.existsSync(conversationPath)) {
                throw new Error(`Conversation directory not found: ${conversationPath}`);
            }
            
            // Read existing metadata
            let metadata;
            if (this.fs.existsSync(metadataFile)) {
                const metadataContent = this.fs.readFileSync(metadataFile, 'utf8');
                metadata = JSON.parse(metadataContent);
            } else {
                throw new Error(`Metadata file not found: ${metadataFile}`);
            }
            
            // Add or update the projectType attribute
            metadata.projectType = projectType;
            metadata.lastModified = Date.now();
            
            // Write the updated metadata back to the file
            const updatedContent = JSON.stringify(metadata, null, 2);
            this.fs.writeFileSync(metadataFile, updatedContent, 'utf8');
            
            console.log(`Successfully updated metadata.json with projectType: ${projectType}`);
            
            return true;
        } catch (error) {
            console.error('Error updating metadata:', error);
            throw error;
        }
    }

    /**
     * Load saved conversations from chat history folders
     */
    loadChatHistory() {
        try {
            // Only try to load if directory exists
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                return []; // Directory doesn't exist yet, nothing to load
            }
            
            const files = this.fs.readdirSync(this.chatHistoryDir);
            
            const conversationDirs = files.filter(file => {
                const filePath = this.path.join(this.chatHistoryDir, file);
                const stat = this.fs.statSync(filePath);
                return stat.isDirectory() && file.startsWith('chat_');
            });
            
            const conversations = [];
            
            conversationDirs.forEach(dir => {
                try {
                    const conversationPath = this.path.join(this.chatHistoryDir, dir);
                    const conversationFile = this.path.join(conversationPath, 'conversation.json');
                    
                    if (this.fs.existsSync(conversationFile)) {
                        const data = this.fs.readFileSync(conversationFile, 'utf8');
                        const conversation = JSON.parse(data);
                        conversations.push(conversation);
                    }
                } catch (error) {
                    console.error(`ChatManager: Error loading conversation folder ${dir}:`, error);
                }
            });
            
            // Sort conversations by creation time (newest first)
            conversations.sort((a, b) => b.id - a.id);
            
            return conversations;
        } catch (error) {
            console.error('ChatManager: Error loading chat history:', error);
            return [];
        }
    }

    /**
     * Delete a specific conversation folder
     */
    deleteChatFile(conversationId) {
        try {
            const conversationDir = `chat_${conversationId}`;
            const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
            if (this.fs.existsSync(conversationPath)) {
                this.removeDirectoryRecursive(conversationPath);
            }
        } catch (error) {
            console.error('Error deleting conversation folder:', error);
        }
    }

    /**
     * Helper function to recursively remove a directory and its contents
     */
    removeDirectoryRecursive(dirPath) {
        if (this.fs.existsSync(dirPath)) {
            const files = this.fs.readdirSync(dirPath);
            files.forEach(file => {
                const filePath = this.path.join(dirPath, file);
                const stat = this.fs.statSync(filePath);
                if (stat.isDirectory()) {
                    this.removeDirectoryRecursive(filePath);
                } else {
                    this.fs.unlinkSync(filePath);
                }
            });
            this.fs.rmdirSync(dirPath);
        }
    }

    /**
     * Create artifacts directories for all existing conversations
     */
    createArtifactsDirectories() {
        try {
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                return; // No chat history directory exists yet
            }
            
            const files = this.fs.readdirSync(this.chatHistoryDir);
            
            files.forEach(file => {
                const filePath = this.path.join(this.chatHistoryDir, file);
                const stat = this.fs.statSync(filePath);
                
                if (stat.isDirectory() && file.startsWith('chat_')) {
                    // This is a conversation directory
                    const artifactsPath = this.path.join(filePath, 'artifacts');
                    
                    // Create artifacts directory if it doesn't exist
                    if (!this.fs.existsSync(artifactsPath)) {
                        this.fs.mkdirSync(artifactsPath, { recursive: true });
                        console.log(`Created artifacts directory for conversation: ${file}`);
                    }
                }
            });
        } catch (error) {
            console.error('Error creating artifacts directories:', error);
        }
    }

    /** hm hmm
     * Save an artifact to a conversation folder
     * @param {number} conversationId - The conversation ID
     * @param {string} artifactName - Name of the artifact file
     * @param {any} data - Data to save
     * @param {string} type - Type of data ('json', 'text', 'binary')
     */
    saveConversationArtifact(conversationId, artifactName, data, type = 'json') {
        try {
            const conversationDir = `chat_${conversationId}`;
            const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
            const artifactsPath = this.path.join(conversationPath, 'artifacts');
            
            // Create conversation directory if it doesn't exist
            if (!this.fs.existsSync(conversationPath)) {
                this.fs.mkdirSync(conversationPath, { recursive: true });
            }
            
            // Create artifacts subdirectory if it doesn't exist
            if (!this.fs.existsSync(artifactsPath)) {
                this.fs.mkdirSync(artifactsPath, { recursive: true });
            }
            
            const artifactPath = this.path.join(artifactsPath, artifactName);
            
            switch (type) {
                case 'json':
                    this.fs.writeFileSync(artifactPath, JSON.stringify(data, null, 2));
                    break;
                case 'text':
                    this.fs.writeFileSync(artifactPath, data, 'utf8');
                    break;
                case 'binary':
                    this.fs.writeFileSync(artifactPath, data);
                    break;
                default:
                    throw new Error(`Unsupported artifact type: ${type}`);
            }
            
            console.log(`Saved artifact ${artifactName} to conversation ${conversationId}/artifacts/`);
        } catch (error) {
            console.error('Error saving conversation artifact:', error);
        }
    }

    /**
     * Load an artifact from a conversation folder
     * @param {number} conversationId - The conversation ID
     * @param {string} artifactName - Name of the artifact file
     * @param {string} type - Type of data ('json', 'text', 'binary')
     * @returns {any} The loaded data
     */
    loadConversationArtifact(conversationId, artifactName, type = 'json') {
        try {
            const conversationDir = `chat_${conversationId}`;
            const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
            const artifactsPath = this.path.join(conversationPath, 'artifacts');
            const artifactPath = this.path.join(artifactsPath, artifactName);
            
            if (!this.fs.existsSync(artifactPath)) {
                return null;
            }
            
            const data = this.fs.readFileSync(artifactPath, type === 'binary' ? null : 'utf8');
            
            switch (type) {
                case 'json':
                    return JSON.parse(data);
                case 'text':
                    return data;
                case 'binary':
                    return data;
                default:
                    throw new Error(`Unsupported artifact type: ${type}`);
            }
        } catch (error) {
            console.error('Error loading conversation artifact:', error);
            return null;
        }
    }

    /**
     * Get list of artifacts for a conversation
     * @param {number} conversationId - The conversation ID
     * @returns {Array} List of artifact filenames
     */
    getConversationArtifacts(conversationId) {
        try {
            const conversationDir = `chat_${conversationId}`;
            const conversationPath = this.path.join(this.chatHistoryDir, conversationDir);
            const artifactsPath = this.path.join(conversationPath, 'artifacts');
            
            if (!this.fs.existsSync(artifactsPath)) {
                return [];
            }
            
            const files = this.fs.readdirSync(artifactsPath);
            return files;
        } catch (error) {
            console.error('Error getting conversation artifacts:', error);
            return [];
        }
    }

    /**
     * Reset the AI's memory by sending a special reset message
     *
     * This method performs a complete AI memory reset by:
     * 1. Sending a special "SYSTEM" prompt that instructs the AI to forget all previous context
     * 2. Calling the server's /reset-model endpoint to clear any server-side state
     *
     * RESET PROCESS:
     * - Sends a system message telling the AI to start fresh with no memory
     * - Uses reset_conversation=true flag in the API request
     * - Calls /reset-model endpoint to clear any model-specific state
     * - Both operations are attempted independently (failures in one don't affect the other)
     *
     * WHY THIS WORKS:
     * - The Python API server is stateless, so the main reset happens via the system prompt
     * - The /reset-model endpoint attempts to restart the Ollama model if needed
     * - This ensures both client-side conversation context and server-side model state are cleared
     *
     * @param {string} model - The AI model to reset (defaults to 'mistral:latest')
     * @returns {Promise<void>}
     * @throws {Error} Logs errors but doesn't throw - reset is best-effort
     */
    async resetAIMemory(model = 'mistral:latest') {
        try {
            console.log('Resetting AI memory...');
            
            // Send a special reset message that tells the AI to forget everything
            const resetPrompt = `SYSTEM: You are starting a completely new conversation. Forget everything from previous conversations. You have no memory of any previous interactions. Start fresh.`;
            
            const postData = JSON.stringify({
                prompt: resetPrompt,
                model: model,
                reset_conversation: true
            });
            
            await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 8000,
                    path: '/chat',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    res.on('end', () => {
                        console.log('AI memory reset response:', responseData);
                        resolve();
                    });
                });
                
                req.on('error', (error) => {
                    console.error('Error resetting AI memory:', error);
                    reject(error);
                });
                
                req.write(postData);
                req.end();
            });
            
            console.log('AI memory reset successfully');
            
            // Also try to reset the model itself
            try {
                await new Promise((resolve, reject) => {
                    const req = http.request({
                        hostname: '127.0.0.1',
                        port: 8000,
                        path: '/reset-model',
                        method: 'POST'
                    }, (res) => {
                        let responseData = '';
                        res.on('data', (chunk) => {
                            responseData += chunk;
                        });
                        res.on('end', () => {
                            console.log('Model reset response:', responseData);
                            resolve();
                        });
                    });
                    
                    req.on('error', (error) => {
                        console.error('Error resetting model:', error);
                        reject(error);
                    });
                    
                    req.end();
                });
                console.log('Model reset completed');
            } catch (modelError) {
                console.error('Error resetting model:', modelError);
            }
        } catch (error) {
            console.error('Error resetting AI memory:', error);
        }
    }

    /**
     * Send a message to the FastAPI server
     *
     * This is the core method for communicating with the Python API server.
     * It handles the complete request/response cycle for AI chat interactions.
     *
     * API COMMUNICATION ARCHITECTURE:
     * - Client (Electron) -> HTTP POST to Python FastAPI server (localhost:8000)
     * - Server routes to appropriate AI backend (Ollama or Claude)
     * - Response flows back through the same HTTP connection
     *
     * REQUEST FORMAT:
     * POST http://localhost:8000/chat
     * {
     *   "prompt": "User message with full conversation context",
     *   "model": "mistral:latest|claude-sonnet-4-5",
     *   "reset_conversation": false
     * }
     *
     * CONTEXT BUILDING:
     * The method builds conversation context by concatenating all previous messages
     * from the conversationBuffer. Format: "User: message1\n\nAI: response1\n\nUser: message2"
     * This provides the AI with full conversation history for context-aware responses.
     *
     * MODEL SUPPORT:
     * - Ollama models (default): Communicates via Python server to local Ollama instance
     * - Claude models: Requires API key, uses Anthropic's Claude API via Python server
     *
     * ERROR HANDLING:
     * - Network errors: Connection failures, timeouts
     * - API errors: Invalid responses, server errors (5xx)
     * - JSON parsing errors: Malformed responses from server
     *
     * @param {string} messageContent - The user's message to send
     * @param {Array} conversationBuffer - Array of previous conversation messages
     * @param {string} model - AI model to use ('mistral:latest', 'claude-sonnet-4-5', etc.)
     * @param {string|null} claudeApiKey - API key for Claude models (null for Ollama)
     * @returns {Promise<string>} AI response text
     * @throws {Error} Throws on network/API errors
     */
    async sendMessageToAPI(messageContent, conversationBuffer = [], model = 'mistral:latest', claudeApiKey = null) {
        try {
            // CONTEXT BUILDING ALGORITHM:
            // Build the full conversation context from the buffer to provide AI with conversation history
            let fullPrompt = messageContent;

            if (conversationBuffer.length > 0) {
                // Include all messages from the buffer to maintain conversation context
                // Format: "User: message1\n\nAI: response1\n\nUser: message2"
                // This gives the AI full context of the conversation for coherent responses
                const contextMessages = conversationBuffer.map(msg =>
                    `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`
                ).join('\n\n');

                // Append current message to the context
                fullPrompt = `${contextMessages}\n\nUser: ${messageContent}`;
            }
            
            const postData = JSON.stringify({
                prompt: fullPrompt,
                model: model,
                reset_conversation: false
            });
            
            return new Promise((resolve, reject) => {
                // HTTP REQUEST PREPARATION:
                // Prepare standard headers for the API request
                const headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                };

                // CLAUDE API AUTHENTICATION:
                // Add Claude API key header if using Claude model
                // The API key is passed from Electron's main process via IPC
                // Format: headers['claude-api-key'] = 'sk-ant-...' (passed in header)
                // Note: For security, API keys should never be stored in renderer process
                if (model === 'claude-sonnet-4-5' && claudeApiKey) {
                    headers['claude-api-key'] = claudeApiKey;
                }
                
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 8000,
                    path: '/chat',
                    method: 'POST',
                    headers: headers
                }, (res) => {
                    let responseData = '';
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    res.on('end', () => {
                        try {
                            const data = JSON.parse(responseData);
                            resolve(data.response);
                        } catch (error) {
                            reject(new Error('Invalid JSON response from server'));
                        }
                    });
                });
                
                req.on('error', (error) => {
                    reject(error);
                });
                
                req.write(postData);
                req.end();
            });
        } catch (error) {
            throw error;
        }
    }
}

// Export the ChatManager class
module.exports = ChatManager; 