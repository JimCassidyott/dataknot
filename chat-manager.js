const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * ChatManager - Handles all business logic for chat history and artifacts
 */
class ChatManager {
    constructor() {
        this.fs = fs;
        this.path = path;
        this.chatHistoryDir = 'chat_history';
    }

    /**
     * Initialize chat history directory and load saved conversations
     */
    initChatHistory() {
        try {
            // Create chat history directory if it doesn't exist
            if (!this.fs.existsSync(this.chatHistoryDir)) {
                this.fs.mkdirSync(this.chatHistoryDir, { recursive: true });
            }
            
            // Create artifacts directories for all existing conversations
            this.createArtifactsDirectories();
            
            // Initialize default project types for all existing chats
            this.initializeDefaultProjectTypes();
            
            // Load saved conversations
            return this.loadChatHistory();
        } catch (error) {
            console.error('Error initializing chat history:', error);
            return [];
        }
    }

    /**
     * Save all conversations to chat history folders
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
                
                // Check if the last user message is a DataKnot command
                const lastUserMessage = conversation.messages
                    .filter(msg => msg.role === 'user')
                    .pop();
                
                if (lastUserMessage) {
                    const messageContent = lastUserMessage.content.trim().toLowerCase();
                    console.log(`Checking last user message: "${messageContent}"`);
                    
                    // Check for DataKnot command - extract everything after "dataknot:" and strip spaces
                    if (messageContent.startsWith('dataknot:')) {
                        const command = messageContent.substring(9).trim(); // Remove 'dataknot:' prefix and strip spaces
                        console.log(`DataKnot command detected: "${command}"`);
                        
                        if (command === 'start recipe') {
                            console.log(`DataKnot start recipe command confirmed: changing projectType to "recipe" for conversation ${conversation.id}`);
                            console.log(`Original projectType: "${metadata.projectType}"`);
                            
                            // Update the projectType to "recipe" and update lastModified
                            metadata.projectType = 'recipe';
                            metadata.lastModified = Date.now();
                            
                            console.log(`Updated projectType to: "${metadata.projectType}"`);
                            console.log(`Updated lastModified to: ${metadata.lastModified}`);
                        } else {
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
     */
    async sendMessageToAPI(messageContent, conversationBuffer = [], model = 'mistral:latest', claudeApiKey = null) {
        try {
            // Build the full conversation context from the buffer
            let fullPrompt = messageContent;
            if (conversationBuffer.length > 0) {
                // Include all messages from the buffer
                const contextMessages = conversationBuffer.map(msg => 
                    `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`
                ).join('\n\n');
                fullPrompt = `${contextMessages}\n\nUser: ${messageContent}`;
            }
            
            const postData = JSON.stringify({
                prompt: fullPrompt,
                model: model,
                reset_conversation: false
            });
            
            return new Promise((resolve, reject) => {
                // Prepare headers
                const headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                };
                
                // Add Claude API key header if using Claude model
                if (model === 'claude-3-5-sonnet' && claudeApiKey) {
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