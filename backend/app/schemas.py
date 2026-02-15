"""
Pydantic Schemas for Chess Analysis API

Defines the JSON contract between backend and frontend.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict
from uuid import uuid4
from app.core.config import settings


class AnalyzeRequest(BaseModel):
    """Request schema for /analyze endpoint"""
    pgn: str = Field(..., description="Raw PGN string of the chess game")

    @field_validator("pgn")
    @classmethod
    def validate_pgn(cls, v: str) -> str:
        if len(v.encode("utf-8")) > settings.PGN_MAX_SIZE_BYTES:
            raise ValueError(f"PGN exceeds maximum size of {settings.PGN_MAX_SIZE_BYTES} bytes")
        if v.count("{") > settings.PGN_MAX_COMMENTS:
            raise ValueError(f"PGN contains too many comments (max {settings.PGN_MAX_COMMENTS})")
        return v

    depth: Optional[int] = Field(22, ge=5, le=30, description="Max search depth (5-30)")
    move_time_ms: Optional[int] = Field(3000, ge=300, le=10000, description="Time per position in ms (300-10000)")
    threads: Optional[int] = Field(1, ge=1, le=8, description="Engine threads (1-8)")
    hash_mb: Optional[int] = Field(128, ge=16, le=2048, description="Hash table size in MB (16-2048)")
    use_lichess: bool = Field(True, description="Use Lichess opening explorer for book moves")
    use_tablebase: bool = Field(True, description="Use Syzygy tablebase for endgame")

    class Config:
        json_schema_extra = {
            "example": {
                "pgn": '[Event "Game"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *',
                "depth": 22,
                "move_time_ms": 3000,
                "threads": 2,
                "hash_mb": 512,
                "use_lichess": True,
                "use_tablebase": True
            }
        }


class TacticalInfoSchema(BaseModel):
    """Tactical properties of a move"""
    is_capture: Optional[bool] = None
    is_check: Optional[bool] = None
    is_checkmate: Optional[bool] = None
    is_sacrifice: Optional[bool] = None
    sacrifice_value: Optional[float] = None
    moved_piece: Optional[str] = None

    class Config:
        extra = "allow"


class MoveAnalysis(BaseModel):
    """Analysis result for a single move"""

    # Core
    move_number: int = Field(..., description="Move number in the game")
    side: str = Field(..., description="'white' or 'black'")
    san: str = Field(..., description="Move in Standard Algebraic Notation")
    uci: str = Field(..., description="Move in UCI notation")

    # Evaluation (always from White's perspective, in pawns)
    eval_before: Optional[float] = Field(None, description="Eval before move (pawns)")
    eval_after: Optional[float] = Field(None, description="Eval after move (pawns)")
    delta: Optional[float] = Field(None, description="Eval change from mover's perspective")

    # Mate scores (always from White's perspective)
    mate_before: Optional[int] = Field(None, description="Mate score before (positive=White mates)")
    mate_after: Optional[int] = Field(None, description="Mate score after (positive=White mates)")

    # Classification
    label: str = Field(..., description="Move label: Brilliant, Great, Best, Excellent, Good, Book, Forced, Inaccuracy, Mistake, Blunder, Missed Win")
    best_move: Optional[str] = Field(None, description="Engine best move UCI (null if played move is best)")
    best_move_san: Optional[str] = Field(None, description="Engine best move SAN")

    # Opening
    opening: Optional[str] = Field(None, description="Opening name from Lichess database")

    # Position context
    phase: Optional[str] = Field(None, description="Game phase: opening, middlegame, endgame")

    # Win probability (always from White's perspective)
    win_percent_before: Optional[float] = Field(None, description="Win% before move (White's perspective)")
    win_percent_after: Optional[float] = Field(None, description="Win% after move (White's perspective)")
    win_percent_delta: Optional[float] = Field(None, description="Win% change from mover's perspective")

    # Flags
    is_critical: Optional[bool] = Field(None, description="Position was critical (check, imbalance, few moves)")
    is_sacrifice: Optional[bool] = Field(None, description="Move involves material sacrifice")

    # Tactical info
    tactical_info: Optional[TacticalInfoSchema] = Field(None, description="Tactical properties")

    # Accuracy
    accuracy: Optional[float] = Field(None, description="Per-move accuracy 0-100 (chess.com style)")

    class Config:
        extra = "allow"
        json_schema_extra = {
            "example": {
                "move_number": 1,
                "side": "white",
                "san": "e4",
                "uci": "e2e4",
                "eval_before": 0.24,
                "eval_after": 0.18,
                "delta": -0.06,
                "mate_before": None,
                "mate_after": None,
                "label": "Best",
                "best_move": None,
                "best_move_san": None,
                "opening": "King's Pawn Game",
                "phase": "opening",
                "win_percent_before": 53.2,
                "win_percent_after": 52.8,
                "win_percent_delta": -0.4,
                "is_critical": False,
                "is_sacrifice": False,
                "tactical_info": None,
                "accuracy": 99.2
            }
        }


class GameInfo(BaseModel):
    """Game metadata from PGN headers"""
    event: Optional[str] = None
    site: Optional[str] = None
    white: Optional[str] = None
    black: Optional[str] = None
    result: Optional[str] = None
    date: Optional[str] = None
    white_elo: Optional[str] = None
    black_elo: Optional[str] = None
    time_control: Optional[str] = None
    termination: Optional[str] = None
    eco: Optional[str] = None

    class Config:
        extra = "allow"


class GameSummary(BaseModel):
    """Summary statistics for the entire game"""
    total_moves: int = Field(..., description="Total half-moves")
    opening: Optional[str] = Field(None, description="Opening name")
    accuracy: Dict[str, float] = Field(..., description="Accuracy per side")
    white: Dict[str, int] = Field(default_factory=dict, description="White label counts")
    black: Dict[str, int] = Field(default_factory=dict, description="Black label counts")
    combined: Dict[str, int] = Field(default_factory=dict, description="Combined label counts")
    critical_moments: List[Dict] = Field(default_factory=list, description="Key moments")
    game_info: Optional[GameInfo] = Field(None, description="Game metadata from PGN")

    class Config:
        extra = "allow"


class AnalyzeResponse(BaseModel):
    """Response schema for /analyze endpoint"""
    game_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique analysis ID")
    moves: List[MoveAnalysis] = Field(..., description="Move-by-move analysis")
    summary: Optional[GameSummary] = Field(None, description="Game summary statistics")

    class Config:
        extra = "allow"
        json_schema_extra = {
            "example": {
                "game_id": "550e8400-e29b-41d4-a716-446655440000",
                "moves": [],
                "summary": {
                    "total_moves": 72,
                    "opening": "Ruy Lopez",
                    "accuracy": {"white": 82.5, "black": 71.3},
                    "white": {"Best": 15},
                    "black": {"Best": 12},
                    "combined": {"Best": 27},
                    "critical_moments": []
                }
            }
        }