# Recipe Navigator

A chat and data exploration tool using Ollama (Llama models), CozoDB, and FastAPI.

---

## 1. System Requirements

- Ubuntu 22.04 or later (should work on most modern Ubuntu versions)
- Python 3.12+ (recommended: use `pyenv` or system Python)
- Internet connection (for downloading models and packages)

---

## 2. Install Ollama (Llama Models)

Ollama is used to run Llama and other large language models locally.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

- This will install the `ollama` CLI and system service.
- To start Ollama:
  ```bash
  ollama serve
  ```
- To pull a model (e.g., Llama 3):
  ```bash
  ollama pull llama3
  ```

See [Ollama documentation](https://ollama.com/docs) for more.

---

## 3. Install Cursor IDE

Cursor is a modern AI-powered code editor.

```bash
# Download the latest .deb from https://www.cursor.so/download
wget https://download.cursor.so/builds/cursor_0.40.2_amd64.deb
sudo apt install ./cursor_0.40.2_amd64.deb
```

- Replace the version number with the latest from their [website](https://www.cursor.so/download).
- You can also install via Snap (if available):
  ```bash
  sudo snap install cursor
  ```

---

## 4. Install Google Chrome

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb
```

---

## 5. Install CozoDB (Python Embedded)

This project uses the embedded version of CozoDB via the `pycozo` and `cozo_embedded` Python packages.

**You do NOT need to install the Rust toolchain for the Python version!**

### **Install with pip (Recommended for Python users)**

```bash
pip install cozo_embedded==0.7.6 pycozo==0.7.6
```

- This should work out-of-the-box on Ubuntu, as prebuilt wheels are available for most platforms.
- If you see errors about missing shared libraries or `.so` files, try:
  ```bash
  pip install --force-reinstall --no-cache-dir cozo_embedded==0.7.6
  ```
- If you get errors about missing RocksDB, install the system library:
  ```bash
  sudo apt install librocksdb-dev
  ```
- For advanced troubleshooting, see [CozoDB GitHub Issues](https://github.com/cozodb/cozo/issues).

---

## 6. Project Setup

1. **Clone this repository:**

   ```bash
   git clone <your-repo-url>
   cd recipe-navigator
   ```

2. **Create and activate a Python virtual environment:**

   ```bash
   python3 -m venv python_code/venv
   source python_code/venv/bin/activate
   ```

3. **Install Python dependencies:**

   ```bash
   pip install -r python_code/requirements.txt
   ```

   - If you encounter issues with `cozo_embedded` or `pycozo`, see the CozoDB section above.

4. **Run the FastAPI server:**
   ```bash
   cd python_code
   uvicorn api_server:app --reload
   ```

---

## 7. Why Python for CozoDB?

- **Simplicity:** Installing and using CozoDB in Python is much easier than in JavaScript, especially on WSL or Linux. The Python packages (`pycozo`, `cozo_embedded`) provide prebuilt binaries, so you don't need to build anything from source or install Rust.
- **JS/Node Challenges:** The JavaScript/Node.js version of CozoDB often requires building native modules, which can be tricky in WSL due to dependency and toolchain issues (Rust, C++ compilers, etc.). Many users report frustration with this process.
- **Python Ecosystem:** Python is well-supported for data science, scripting, and backend work. The CozoDB Python client is mature and easy to use.
- **No Rust Required:** For Python, you do NOT need to install the Rust toolchain or build anything from source. Just use pip!

If you want to use CozoDB from JavaScript, you may need to:

- Install Rust and Node.js build tools
- Troubleshoot native module builds
- Deal with platform-specific issues (especially in WSL)

For most users, Python is the path of least resistance.

---

## 8. Troubleshooting CozoDB

- If you see errors like `ImportError: cozo_embedded.abi3.so: cannot open shared object file`, ensure:
  - You are using a compatible Python version (3.7+).
  - You have the correct version of `cozo_embedded` and `pycozo`.
  - Try reinstalling with `pip install --force-reinstall --no-cache-dir cozo_embedded==0.7.6`.
- If you get errors about missing RocksDB, install:
  ```bash
  sudo apt install librocksdb-dev
  ```
- For advanced troubleshooting, see [CozoDB GitHub Issues](https://github.com/cozodb/cozo/issues).

---

## 9. Additional Notes

- Ollama, Cursor, and Chrome can all be installed via .deb packages on Ubuntu.
- This project is designed to run in a Linux environment (not Windows).
- For best results, always use a Python virtual environment.

---

## 10. References

- [Ollama Documentation](https://ollama.com/docs)
- [CozoDB Python Docs](https://github.com/cozodb/cozo/tree/main/python)
- [Cursor IDE](https://www.cursor.so/)
- [Google Chrome](https://www.google.com/chrome/)
