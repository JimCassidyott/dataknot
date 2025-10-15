#!/usr/bin/env python3
"""
FastAPI Chat Server
Leverages the same Ollama API logic as ai.js to provide a REST API endpoint for chat.
"""

# Import standard and third-party libraries
import asyncio
import aiohttp  # For making async HTTP requests
import json
from typing import Optional
from fastapi import FastAPI, HTTPException, Header  # FastAPI framework and error handling
from fastapi.middleware.cors import CORSMiddleware  # For CORS support
from pydantic import BaseModel  # For request/response data validation
import logging

# Configure logging for the server
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration (same as ai.js)
OLLAMA_HOST = 'localhost'  # Host for Ollama backend
OLLAMA_PORT = 11434        # Port for Ollama backend
DEFAULT_MODEL = 'mistral'  # Default AI model to use
# DEFAULT_MODEL = 'qwen2.5:14b'  # Alternative model (commented out)
# DEFAULT_MODEL = 'llama3.1:8b'  # Alternative model (commented out)

# # Claude API Configuration
# CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
# CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'  # Latest Claude Sonnet 45 model

# Claude API Configuration
CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'  # Claude Sonnet 4.5 - smartest model

# No server-side conversation history - stateless design

# Initialize FastAPI app with metadata
app = FastAPI(
    title="Recipe Navigator Chat API",
    description="FastAPI server for chat functionality using Ollama",
    version="1.0.0"
)

# Add CORS middleware to allow requests from Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Electron app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request schema for chat endpoint
class ChatRequest(BaseModel):
    prompt: str  # User's prompt to the AI
    model: Optional[str] = DEFAULT_MODEL  # Model to use (optional)
    reset_conversation: Optional[bool] = False  # Whether to reset conversation (no-op here)

# Define response schema for chat endpoint
class ChatResponse(BaseModel):
    response: str  # AI's response
    conversation_history_size: int  # Always 0 (stateless)
    context_size_bytes: int  # Size of prompt in bytes

async def check_ollama_status() -> bool:
    """Check if Ollama is running and accessible by pinging its /api/tags endpoint."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f'http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/tags') as response:
                return response.status == 200
    except Exception as e:
        logger.error(f"Error checking Ollama status: {e}")
        return False

async def ask_ollama(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Send request to Ollama API and return the AI's response."""
    # Use only the provided prompt - no server-side conversation history
    # This makes the server stateless and prevents conversation pollution
    
    # Check if this is a reset request (special SYSTEM message)
    is_reset = "SYSTEM: You are starting a completely new conversation" in prompt
    
    # Log the size of the context being sent
    context_size = len(prompt.encode('utf-8'))
    logger.info(f"\U0001F4CA Sending {context_size} bytes of context to AI... (Reset: {is_reset})")
    
    # Prepare the request data for Ollama
    post_data = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    
    # For reset requests, add additional parameters to force a fresh start
    if is_reset:
        post_data["options"] = {
            "num_ctx": 0,  # Reset context window
            "temperature": 0.7,  # Reset temperature
            "top_p": 0.9,  # Reset top_p
            "repeat_penalty": 1.1  # Reset repeat penalty
        }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/generate',
                json=post_data,
                headers={'Content-Type': 'application/json'}
            ) as response:
                if response.status != 200:
                    # If Ollama returns an error status, raise HTTPException
                    raise HTTPException(status_code=500, detail=f"Ollama API error: {response.status}")
                
                data = await response.json()
                
                if 'response' in data:
                    return data['response']
                elif 'error' in data:
                    raise HTTPException(status_code=500, detail=f"Ollama error: {data['error']}")
                else:
                    logger.error(f"Unexpected response format: {data}")
                    raise HTTPException(status_code=500, detail="Unexpected response format from Ollama")
                    
    except aiohttp.ClientError as e:
        logger.error(f"Request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

async def ask_claude(prompt: str, api_key: str) -> str:
    """Send request to Claude API and return the AI's response."""
    logger.info(f"🤖 Sending request to Claude API...")
    
    # Prepare the request data for Claude API
    post_data = {
        "model": CLAUDE_MODEL,
        "max_tokens": 4000,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(CLAUDE_API_URL, json=post_data, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Extract the response text from Claude's response format
                    if "content" in data and len(data["content"]) > 0:
                        response_text = data["content"][0]["text"]
                        logger.info(f"✅ Claude response received ({len(response_text)} characters)")
                        return response_text
                    else:
                        logger.error("Unexpected response format from Claude API")
                        raise HTTPException(status_code=500, detail="Unexpected response format from Claude API")
                        
                elif response.status == 401:
                    logger.error("Claude API authentication failed")
                    raise HTTPException(status_code=401, detail="Invalid Claude API key")
                elif response.status == 429:
                    logger.error("Claude API rate limit exceeded")
                    raise HTTPException(status_code=429, detail="Claude API rate limit exceeded")
                else:
                    error_text = await response.text()
                    logger.error(f"Claude API error {response.status}: {error_text}")
                    raise HTTPException(status_code=500, detail=f"Claude API error: {error_text}")
                    
    except aiohttp.ClientError as e:
        logger.error(f"Claude API request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Claude API request failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected Claude API error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected Claude API error: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Check Ollama status on startup and log connection status."""
    logger.info("\U0001F680 Starting Recipe Navigator Chat API...")
    
    is_running = await check_ollama_status()
    if not is_running:
        logger.error("\u274C Error: Ollama is not running or not accessible.")
        logger.error("Please start Ollama with: ollama serve")
        # Don't exit, just log the warning
    else:
        logger.info("\u2705 Connected to Ollama")

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Recipe Navigator Chat API",
        "version": "1.0.0",
        "ollama_host": OLLAMA_HOST,
        "ollama_port": OLLAMA_PORT,
        "default_model": DEFAULT_MODEL,
        "conversation_history_size": 0  # No server-side history
    }

@app.get("/health")
async def health_check():
    """Health check endpoint to verify API and Ollama connectivity."""
    ollama_status = await check_ollama_status()
    return {
        "status": "healthy",
        "ollama_connected": ollama_status,
        "conversation_history_size": 0  # No server-side history
    }

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, claude_api_key: Optional[str] = Header(None)):
    """Main chat endpoint that sends prompts to Ollama and returns responses."""
    # No server-side conversation history - stateless design
    
    # Reset conversation if requested (no-op since no server history)
    if request.reset_conversation:
        logger.info("\U0001F501 Reset requested but no server-side history to reset")
    
    # Validate input prompt
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    
    try:
        logger.info(f"\U0001F916 Processing prompt: {request.prompt[:100]}{'...' if len(request.prompt) > 100 else ''}")
        
        # Route to appropriate API based on model
        if request.model == 'claude-sonnet-4-5':
            # Use Claude API
            if not claude_api_key:
                raise HTTPException(status_code=400, detail="Claude API key required for Claude model")
            response = await ask_claude(request.prompt, claude_api_key)
        else:
            # Use Ollama API
            is_running = await check_ollama_status()
            if not is_running:
                raise HTTPException(status_code=503, detail="Ollama is not running. Please start Ollama with: ollama serve")
            response = await ask_ollama(request.prompt, request.model)
        
        # Don't maintain conversation history on the server
        # This prevents conversation pollution between different chats
        
        # Log the current exchange
        logger.info("=== CURRENT EXCHANGE ===")
        logger.info(f"User: {request.prompt}")
        logger.info(f"AI: {response}")
        logger.info("=========================")
        
        return ChatResponse(
            response=response,
            conversation_history_size=0,  # No server-side history
            context_size_bytes=len(request.prompt.encode('utf-8'))
        )
        
    except Exception as e:
        logger.error(f"\u274C Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversation")
async def get_conversation():
    """Get the current conversation history (always empty/stateless)."""
    return {
        "conversation_history": [],  # No server-side history
        "history_size": 0,
        "context_size_bytes": 0
    }

@app.delete("/conversation")
async def clear_conversation():
    """Clear the conversation history (no-op/stateless)."""
    # No server-side history to clear
    logger.info("\U0001F5D1️ No server-side conversation history to clear")
    return {"message": "No server-side conversation history to clear"}

@app.post("/reset-model")
async def reset_model():
    """Reset the Ollama model to clear any internal state by stopping and pulling the model again."""
    try:
        logger.info("\U0001F501 Attempting to reset Ollama model...")
        
        # Try to restart the model by pulling it again
        async with aiohttp.ClientSession() as session:
            # First, try to stop the current model (send STOP prompt)
            try:
                async with session.post(
                    f'http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/generate',
                    json={
                        "model": DEFAULT_MODEL,
                        "prompt": "STOP",
                        "stream": False
                    }
                ) as response:
                    pass  # Just try to stop any ongoing generation
            except:
                pass  # Ignore errors if model is not running
            
            # Then try to pull the model again to reset it
            async with session.post(
                f'http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/pull',
                json={"name": DEFAULT_MODEL}
            ) as response:
                if response.status == 200:
                    logger.info("\u2705 Model reset successfully")
                    return {"message": "Model reset successfully"}
                else:
                    logger.warning("\u26A0️ Could not reset model, but continuing...")
                    return {"message": "Model reset attempted"}
                    
    except Exception as e:
        logger.error(f"\u274C Error resetting model: {e}")
        return {"message": "Error resetting model", "error": str(e)}

@app.get("/models")
async def get_available_models():
    """Get available Ollama models by querying the /api/tags endpoint."""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f'http://{OLLAMA_HOST}:{OLLAMA_PORT}/api/tags') as response:
                if response.status == 200:
                    data = await response.json()
                    return {"models": data.get('models', [])}
                else:
                    raise HTTPException(status_code=500, detail="Failed to fetch models from Ollama")
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Run the FastAPI app with Uvicorn server
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 