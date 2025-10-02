#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

// Configuration
const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = 'llama3.1:8b';

// Conversation history
let conversationHistory = [];

// Create readline interface with better handling for large inputs
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

// Function to get multi-line input
function getMultiLineInput() {
    return new Promise((resolve) => {
        console.log('Enter your message (type /send when done, or /quit to exit):');
        
        let input = '';
        
        const collectInput = () => {
            rl.question('', (line) => {
                if (line.trim() === '/send') {
                    resolve(input.trim());
                } else if (line.trim() === '/quit') {
                    resolve('quit');
                } else {
                    input += line + '\n';
                    collectInput();
                }
            });
        };
        
        collectInput();
    });
}

// Function to send request to Ollama API
function askOllama(prompt, model = DEFAULT_MODEL) {
    return new Promise((resolve, reject) => {
        // Build the full conversation context
        const fullContext = conversationHistory.length > 0 
            ? conversationHistory.join('\n') + '\n' + prompt
            : prompt;

        // Log the size of the context being sent
        const contextSize = Buffer.byteLength(fullContext, 'utf8');
        console.log(`📊 Sending ${contextSize} bytes of context to AI...`);

        const postData = JSON.stringify({
            model: model,
            prompt: fullContext,
            stream: false
        });

        const options = {
            hostname: OLLAMA_HOST,
            port: OLLAMA_PORT,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            console.log(`Debug - Status: ${res.statusCode}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.response) {
                        resolve(response.response);
                    } else if (response.error) {
                        reject(new Error('Ollama error: ' + response.error));
                    } else {
                        console.log('Debug - Raw response:', JSON.stringify(response, null, 2));
                        reject(new Error('Unexpected response format from Ollama'));
                    }
                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error('Request failed: ' + error.message));
        });

        req.write(postData);
        req.end();
    });
}

// Function to check if Ollama is running
function checkOllamaStatus() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: OLLAMA_HOST,
            port: OLLAMA_PORT,
            path: '/api/tags',
            method: 'GET'
        }, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.end();
    });
}

// Main interactive loop
async function startChat() {
    console.log('🤖 Ollama AI Chat Interface (Enhanced)');
    console.log('=====================================');
    console.log(`Using model: ${DEFAULT_MODEL}`);
    console.log('Type "/quit" to exit');
    console.log('Type "/send" when done with your message');
    console.log('');

    // Check if Ollama is running
    const isRunning = await checkOllamaStatus();
    if (!isRunning) {
        console.log('❌ Error: Ollama is not running or not accessible.');
        console.log('Please start Ollama with: ollama serve');
        process.exit(1);
    }

    console.log('✅ Connected to Ollama');
    console.log('');

    const askQuestion = async () => {
        try {
            const input = await getMultiLineInput();
            
            if (input === 'quit') {
                console.log('👋 Goodbye!');
                rl.close();
                return;
            }

            if (input.trim() === '') {
                askQuestion();
                return;
            }

            console.log('🤖 AI is thinking...');
            const response = await askOllama(input);
            console.log(`\nAI: ${response}\n`);
            
            // Add the exchange to conversation history
            conversationHistory.push(`User: ${input}`);
            conversationHistory.push(`AI: ${response}`);
            
            // Show conversation history size
            const historySize = conversationHistory.join('\n').length;
            console.log(`📝 Conversation history: ${historySize} characters\n`);
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
        }

        askQuestion();
    };

    askQuestion();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    rl.close();
    process.exit(0);
});

// Start the chat
startChat().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
}); 