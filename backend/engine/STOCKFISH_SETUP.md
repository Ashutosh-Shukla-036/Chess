# Stockfish Binary Setup Instructions

## CRITICAL: Download Stockfish Binary

The chess analysis backend requires the Stockfish chess engine binary.

### Download Steps

1. **Go to Stockfish Official Releases**:
   - GitHub: https://github.com/official-stockfish/Stockfish/releases
   - Download: **Stockfish 16 or later**

2. **Select the Correct Binary**:
   - Platform: **Linux**
   - Architecture: **x86-64** (for Docker/WSL)
   - File: `stockfish-ubuntu-x86-64-avx2` or similar

3. **Place Binary in Project**:
   ```bash
   # From WSL or Git Bash
   cd /mnt/c/Users/Ashutosh\ Shukla/ChessProject/chess-analyzer
   
   # Copy downloaded binary to correct location
   cp ~/Downloads/stockfish-ubuntu-x86-64-avx2 backend/engine/bin/stockfish
   
   # Make it executable
   chmod +x backend/engine/bin/stockfish
   ```

4. **Verify Binary**:
   ```bash
   # Test that it works
   backend/engine/bin/stockfish
   # Should output: Stockfish <version> by the Stockfish developers
   # Type 'quit' to exit
   ```

### Important Notes

- ❌ **DO NOT** download Windows `.exe` version
- ❌ **DO NOT** use `apt install stockfish` (version drift)
- ✅ **DO** use the official Linux x86-64 binary
- ✅ **DO** ensure it's executable with `chmod +x`

### File Location

The binary MUST be at:
```
backend/engine/bin/stockfish
```

This path is hardcoded in the engine wrapper for Docker compatibility.

### After Download

Once the binary is in place, rebuild and start the containers:

```bash
# From project root
./build.sh
```

The backend will now be able to analyze chess games!
