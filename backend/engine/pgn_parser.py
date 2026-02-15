"""
PGN Utilities

- Game metadata extraction
- PGNParseError exception class

Note: Move parsing is handled by engine/stockfish_engine.py → parse_pgn()
"""

import chess.pgn
from io import StringIO
from typing import Dict, Optional


class PGNParseError(Exception):
    """Raised when PGN parsing fails"""
    pass


def get_game_info(pgn_string: str) -> Optional[Dict]:
    """
    Extract game metadata from PGN headers.

    Args:
        pgn_string: Raw PGN string

    Returns:
        Dictionary with game info or None if parsing fails
    """
    try:
        pgn_io = StringIO(pgn_string)
        game = chess.pgn.read_game(pgn_io)

        if game is None:
            return None

        return {
            "event": game.headers.get("Event", "Unknown"),
            "site": game.headers.get("Site", "Unknown"),
            "white": game.headers.get("White", "Unknown"),
            "black": game.headers.get("Black", "Unknown"),
            "result": game.headers.get("Result", "*"),
            "date": game.headers.get("Date", "Unknown"),
            "white_elo": game.headers.get("WhiteElo"),
            "black_elo": game.headers.get("BlackElo"),
            "time_control": game.headers.get("TimeControl"),
            "termination": game.headers.get("Termination"),
            "eco": game.headers.get("ECO"),
        }
    except Exception:
        return None