FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY engine ./engine

# Download the correct Linux Stockfish binary and NNUE eval files
RUN apt-get update && apt-get install -y wget tar && \
    wget -q https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64.tar && \
    tar -xf stockfish-ubuntu-x86-64.tar && \
    mv stockfish/stockfish-ubuntu-x86-64 /app/engine/bin/stockfish && \
    chmod +x /app/engine/bin/stockfish && \
    rm -rf stockfish stockfish-ubuntu-x86-64.tar && \
    wget -q -O /app/engine/bin/nn-c288c895ea92.nnue https://tests.stockfishchess.org/api/nn/nn-c288c895ea92.nnue && \
    wget -q -O /app/engine/bin/nn-37f18f62d772.nnue https://tests.stockfishchess.org/api/nn/nn-37f18f62d772.nnue && \
    apt-get remove -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]