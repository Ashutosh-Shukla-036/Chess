from __future__ import annotations

import io
import math
import os
import queue
import re
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, List, Tuple

import chess
import chess.pgn

from app.core.config import settings



# ============================================================
# Exceptions
# ============================================================
class StockfishError(Exception):
    pass


class EngineNotRunning(StockfishError):
    pass


class EngineTimeout(StockfishError):
    pass


class IllegalMoveError(StockfishError):
    pass


# ============================================================
# Piece value constants
# ============================================================
PIECE_VALUES = {
    chess.PAWN: 1.0,
    chess.KNIGHT: 3.0,
    chess.BISHOP: 3.25,
    chess.ROOK: 5.0,
    chess.QUEEN: 9.0,
    chess.KING: 0.0,
}

PIECE_NAMES = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}


# ============================================================
# Thresholds
# ============================================================
class Thresholds:
    WP_BEST_LOSS = 2.0          
    WP_EXCELLENT_LOSS = 5.0     
    WP_GOOD_LOSS = 10.0         
    WP_INACCURACY_LOSS = 20.0   
    WP_MISTAKE_LOSS = 35.0      

    # ── Missed Win ──
    WP_MISSED_WIN_MOVER_BEFORE = 85.0   
    WP_MISSED_WIN_LOSS = 20.0           
    WP_MISSED_WIN_STILL_WINNING = 65.0  

    # ── Book ──
    WP_BOOK_MAX_LOSS = 5.0

    # ── Brilliant ──
    BRILLIANT_MIN_SACRIFICE = 1.5       
    BRILLIANT_MAX_EVAL_DROP = 0.60      
    BRILLIANT_SECOND_BEST_GAP = 1.2    
    BRILLIANT_MAX_PER_GAME = 10          

    # ── Great ──
    GREAT_SECOND_BEST_EVAL_GAP = 1.5   
    GREAT_SECOND_BEST_WP_GAP = 10.0    
    GREAT_MIN_COMPLEXITY = 0.20         
    GREAT_MIN_LEGAL_MOVES = 4           

    # ── Critical positions ──
    CRITICAL_SECOND_BEST_GAP = 1.5     

    # ── Sacrifice detection ──
    SACRIFICE_MIN_NET_LOSS = 1.0        

    # ── Turnaround / Saving moves ──
    WP_LOSING_THRESHOLD   = 35.0   
    WP_DRAW_MIN           = 42.0   
    WP_DRAW_MAX           = 58.0   
    WP_EQUAL_MIN          = 38.0   
    WP_EQUAL_MAX          = 62.0   
    WP_WIN_MIN            = 65.0   

    # Turnaround gain thresholds
    WP_TURNAROUND_GREAT      = 15.0   
    WP_TURNAROUND_BRILLIANT  = 28.0   

    # ── Accuracy ──
    ACCURACY_K = 0.006

    # ── Mate accuracy ──
    MATE_IN_1_MISSED_ACCURACY = 0.0
    MATE_IN_2_MISSED_ACCURACY = 5.0
    MATE_ACCURACY_PENALTY_PER_MOVE = 15.0
    MATE_ACCURACY_FLOOR = 10.0

    # ── Phase — Pure material ──
    ENDGAME_MAX_NON_PAWN_MATERIAL = 14.0
    OPENING_MIN_NON_PAWN_MATERIAL = 58.0

    # ── Position ──
    COMPLEXITY_NORMALIZATION = 30.0    

    # ── Engine timing ──
    MIN_MOVETIME_MS = 200
    MAX_MOVETIME_MS = 3000
    CRITICAL_TIME_MULTIPLIER = 1.3
    ENDGAME_TIME_MULTIPLIER = 0.6
    OPENING_TIME_MULTIPLIER = 0.7    

    # ── Tablebase ──
    TABLEBASE_MAX_PIECES = 7

    # ── Circuit breaker ──
    CIRCUIT_BREAKER_MAX_FAILURES = 3
    CIRCUIT_BREAKER_COOLDOWN = 60.0

    # ── API ──
    MASTERS_MIN_GAMES = 5
    LICHESS_MIN_GAMES = 100
    API_RATE_LIMIT = 0.1

    # ── Recovery ──
    MAX_RESTART_ATTEMPTS = 3
    RESTART_DELAY = 1.0
    FALLBACK_MOVETIME_MS = 300

    # ── Win% sigmoid ──
    WIN_PERCENT_K = 0.00368208


# ============================================================
# Enums
# ============================================================
class GamePhase(Enum):
    OPENING = "opening"
    MIDDLEGAME = "middlegame"
    ENDGAME = "endgame"


class MoveQuality(Enum):
    BRILLIANT = "Brilliant"
    GREAT = "Great"
    BEST = "Best"
    EXCELLENT = "Excellent"
    GOOD = "Good"
    BOOK = "Book"
    FORCED = "Forced"
    INACCURACY = "Inaccuracy"
    MISTAKE = "Mistake"
    BLUNDER = "Blunder"
    MISSED_WIN = "Missed Win"


# ============================================================
# Data Classes
# ============================================================
@dataclass(frozen=True)
class MoveInput:
    move_number: int
    side: str
    san: str
    uci: str

    def __post_init__(self):
        if self.side not in ("white", "black"):
            raise ValueError(f"Invalid side: {self.side!r}")
        if not self.uci:
            raise ValueError("UCI string cannot be empty")
        if self.move_number < 1:
            raise ValueError(f"Bad move number: {self.move_number}")

    @property
    def is_white(self) -> bool:
        return self.side == "white"


@dataclass
class EvalResult:
    score_type: str = "cp"
    score_value: float = 0.0
    eval_cp: Optional[float] = None
    mate: Optional[int] = None
    best_move: Optional[str] = None
    pv: List[str] = field(default_factory=list)
    depth: int = 0
    nodes: int = 0
    nps: int = 0
    is_checkmate: bool = False

    def __post_init__(self):
        if self.mate is not None:
            self.score_type = "mate"
            self.score_value = float(self.mate)
        elif self.eval_cp is not None:
            self.score_type = "cp"
            self.score_value = self.eval_cp

    @property
    def is_mate(self) -> bool:
        return self.mate is not None

    def mover_eval(self, is_white: bool) -> Optional[float]:
        if self.eval_cp is None:
            return None
        return self.eval_cp if is_white else -self.eval_cp

    def mover_mate(self, is_white: bool) -> Optional[int]:
        if self.mate is None:
            return None
        return self.mate if is_white else -self.mate

    def is_mover_winning_mate(self, is_white: bool) -> bool:
        m = self.mover_mate(is_white)
        return m is not None and m > 0


@dataclass
class MultiPVResult:
    pvs: List[EvalResult] = field(default_factory=list)

    @property
    def best(self) -> Optional[EvalResult]:
        return self.pvs[0] if self.pvs else None

    @property
    def second_best(self) -> Optional[EvalResult]:
        return self.pvs[1] if len(self.pvs) > 1 else None

    @property
    def empty(self) -> bool:
        return len(self.pvs) == 0


@dataclass
class TacticalInfo:
    is_capture: bool = False
    is_check: bool = False
    is_checkmate: bool = False
    is_castle: bool = False
    is_promotion: bool = False
    is_en_passant: bool = False
    is_sacrifice: bool = False
    sacrifice_value: float = 0.0
    captured_piece_value: float = 0.0
    moved_piece: Optional[str] = None
    moved_piece_value: float = 0.0
    is_exchange_sacrifice: bool = False
    is_recapture: bool = False

    @property
    def is_tactical(self) -> bool:
        return self.is_capture or self.is_check or self.is_sacrifice


@dataclass
class PositionInfo:
    phase: GamePhase = GamePhase.OPENING
    material_white: float = 0.0
    material_black: float = 0.0
    material_balance: float = 0.0
    non_pawn_material: float = 0.0
    is_endgame: bool = False
    total_pieces: int = 0
    has_queens: bool = True
    is_critical: bool = False
    complexity: float = 0.0
    legal_move_count: int = 10


@dataclass
class AnalysisResult:
    move_number: int
    side: str
    san: str
    uci: str
    eval_before: Optional[float]
    eval_after: Optional[float]
    delta: Optional[float]
    mate_before: Optional[int]
    mate_after: Optional[int]
    label: str
    best_move: Optional[str]
    best_move_san: Optional[str] = None
    opening: Optional[str] = None
    phase: Optional[str] = None
    win_percent_before: Optional[float] = None
    win_percent_after: Optional[float] = None
    win_percent_delta: Optional[float] = None
    is_critical: bool = False
    is_sacrifice: bool = False
    tactical_info: Optional[Dict] = None
    accuracy: Optional[float] = None

    def to_dict(self) -> Dict:
        d = asdict(self)
        # Always include structural fields even if None
        always_include = {
            'move_number', 'side', 'san', 'uci', 'label',
            'eval_before', 'eval_after', 'delta',
            'mate_before', 'mate_after',
            'best_move', 'best_move_san',
            'win_percent_before', 'win_percent_after', 'win_percent_delta',
            'accuracy', 'is_critical', 'is_sacrifice',
            'phase', 'opening',
        }
        return {
            k: v for k, v in d.items()
            if v is not None or k in always_include
        }


@dataclass
class ClassificationContext:
    eval_before: EvalResult
    eval_after: EvalResult
    move: MoveInput
    played: str
    best: Optional[str]
    delta: Optional[float]
    legal_count: int
    is_book: bool
    opening_name: Optional[str]
    multi_pv: MultiPVResult
    tactical: TacticalInfo
    position: PositionInfo
    wp_before: float
    wp_after: float
    tablebase: Optional[Dict]
    board_before: chess.Board

    @property
    def is_white(self) -> bool:
        return self.move.is_white

    @property
    def is_best_move(self) -> bool:
        if not self.best:
            return False
        # Normalize UCI to lowercase to handle promotion suffix differences
        # (e2e1Q vs e2e1q are the same move)
        return self.played.lower() == self.best.lower()

    @property
    def mover_wp_before(self) -> float:
        return self.wp_before if self.is_white else (100.0 - self.wp_before)

    @property
    def mover_wp_after(self) -> float:
        return self.wp_after if self.is_white else (100.0 - self.wp_after)

    @property
    def wp_loss(self) -> float:
        return max(0.0, self.mover_wp_before - self.mover_wp_after)

    @property
    def wp_gain(self) -> float:
        return max(0.0, self.mover_wp_after - self.mover_wp_before)

    @property
    def mover_eval_before(self) -> Optional[float]:
        return self.eval_before.mover_eval(self.is_white)

    @property
    def mover_eval_after(self) -> Optional[float]:
        return self.eval_after.mover_eval(self.is_white)

    @property
    def eval_drop(self) -> float:
        if self.mover_eval_before is None or self.mover_eval_after is None:
            return 0.0
        return self.mover_eval_before - self.mover_eval_after


# ============================================================
# Helpers
# ============================================================
def get_piece_value(pt: int) -> float:
    return PIECE_VALUES.get(pt, 0.0)


def calculate_material(board: chess.Board) -> Tuple[float, float]:
    w = b = 0.0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p:
            v = get_piece_value(p.piece_type)
            if p.color == chess.WHITE:
                w += v
            else:
                b += v
    return w, b


def calculate_non_pawn_material(board: chess.Board) -> float:
    total = 0.0
    for sq in chess.SQUARES:
        p = board.piece_at(sq)
        if p and p.piece_type != chess.PAWN and p.piece_type != chess.KING:
            total += get_piece_value(p.piece_type)
    return total


def count_pieces(board: chess.Board) -> int:
    return bin(board.occupied).count("1") - 2


def cp_to_win_percent(
    cp: Optional[float] = None,
    mate: Optional[int] = None,
    is_checkmate: bool = False,
    side_delivered_mate: Optional[bool] = None,
) -> float:
    """
    Convert evaluation to White's win percentage.
    """
    if is_checkmate:
        if side_delivered_mate is True:
            return 100.0
        if side_delivered_mate is False:
            return 0.0
        # Fallback: use mate sign if available
        if mate is not None:
            return 100.0 if mate > 0 else 0.0
        # Absolute last resort — should not happen in practice
        return 50.0
    if mate is not None:
        return 100.0 if mate > 0 else 0.0
    if cp is None:
        return 50.0
    try:
        k = Thresholds.WIN_PERCENT_K
        return round(
            max(0.0, min(100.0,
                50 + 50 * (2 / (1 + math.exp(-k * cp * 100)) - 1))),
            1,
        )
    except OverflowError:
        return 100.0 if cp > 0 else 0.0


def _eval_to_mover_wp(eval_result: EvalResult, is_white: bool) -> float:
    wp_white = cp_to_win_percent(
        eval_result.eval_cp, eval_result.mate, eval_result.is_checkmate
    )
    return wp_white if is_white else (100.0 - wp_white)


def calculate_move_accuracy(
    eval_before_cp: Optional[float],
    eval_after_cp: Optional[float],
    is_white: bool,
) -> float:
    if eval_before_cp is None or eval_after_cp is None:
        return 100.0
    wp_before = cp_to_win_percent(eval_before_cp)
    wp_after  = cp_to_win_percent(eval_after_cp)
    # Convert to mover's perspective
    if not is_white:
        wp_before = 100.0 - wp_before
        wp_after  = 100.0 - wp_after
    wp_loss = max(0.0, wp_before - wp_after)
    # chess.com formula approximation
    accuracy = 103.1668 * math.exp(-0.04354 * wp_loss) - 3.1668
    return round(max(0.0, min(100.0, accuracy)), 1)


def calculate_mate_accuracy(
    mate_before: int,
    mate_after: Optional[int],
    eval_after_cp: Optional[float],
    is_white: bool,
) -> float:
    mover_mate_before = mate_before if is_white else -mate_before

    if mover_mate_before > 0:
        if mate_after is None:
            if mover_mate_before == 1:
                return Thresholds.MATE_IN_1_MISSED_ACCURACY
            if mover_mate_before == 2:
                return Thresholds.MATE_IN_2_MISSED_ACCURACY
            if eval_after_cp is not None:
                mover_cp = eval_after_cp if is_white else -eval_after_cp
                if mover_cp >= 5.0:
                    return 70.0
                if mover_cp >= 3.0:
                    return 50.0
                if mover_cp >= 1.0:
                    return 30.0
            return 20.0

        mover_mate_after = mate_after if is_white else -mate_after
        if mover_mate_after > 0:
            if mover_mate_after <= mover_mate_before:
                return 100.0
            extra = mover_mate_after - mover_mate_before
            if mover_mate_before == 1:
                return Thresholds.MATE_IN_1_MISSED_ACCURACY
            return max(
                Thresholds.MATE_ACCURACY_FLOOR,
                100.0 - extra * Thresholds.MATE_ACCURACY_PENALTY_PER_MOVE,
            )
        if mover_mate_after < 0:
            return 0.0

    elif mover_mate_before < 0:
        if mate_after is None:
            return 100.0
        mover_mate_after = mate_after if is_white else -mate_after
        if mover_mate_after > 0:
            return 100.0
        if mover_mate_after < 0:
            if abs(mover_mate_after) >= abs(mover_mate_before):
                return 100.0
            return 50.0

    return 100.0


# ============================================================
# Position & Tactical Analysis
# ============================================================
def _compute_multi_pv_gap(
    multi_pv: Optional[MultiPVResult],
    is_white: bool,
) -> Optional[float]:
    """
    Return the eval gap (in pawns, from mover's perspective)
    between the best and second-best PV.
    Returns None when the gap cannot be computed.
    Mate-vs-cp is treated as infinite gap.
    """
    if multi_pv is None or multi_pv.empty or len(multi_pv.pvs) < 2:
        return None

    best = multi_pv.best
    second = multi_pv.second_best
    if best is None or second is None:
        return None

    # Mate vs cp → infinite
    if best.is_mate and not second.is_mate:
        if best.is_mover_winning_mate(is_white):
            return 999.0
        return None
    if not best.is_mate and second.is_mate:
        if second.is_mover_winning_mate(is_white):
            return -999.0  # second is better
        return 999.0

    # Both mate
    if best.is_mate and second.is_mate:
        bm = best.mover_mate(is_white)
        sm = second.mover_mate(is_white)
        if bm is not None and sm is not None:
            if bm > 0 and sm > 0:
                return float(sm - bm)
            if bm > 0 and sm < 0:
                return 999.0
            if bm < 0 and sm > 0:
                return -999.0
            if bm < 0 and sm < 0:
                return float(abs(bm) - abs(sm))
        return None

    # Both cp
    be = best.mover_eval(is_white)
    se = second.mover_eval(is_white)
    if be is not None and se is not None:
        return be - se
    return None


def analyze_position_info(
    board: chess.Board,
    multi_pv: Optional[MultiPVResult] = None,
    is_white: bool = True,
) -> PositionInfo:
    """
    Phase: pure material (no move number).
    Critical: multi-PV gap ≥ 1.5 only. In-check is always critical.
    """
    w_mat, b_mat = calculate_material(board)
    non_pawn_mat = calculate_non_pawn_material(board)
    total_pieces = count_pieces(board)
    has_queens = bool(
        board.pieces(chess.QUEEN, chess.WHITE)
        or board.pieces(chess.QUEEN, chess.BLACK)
    )
    legal_count = board.legal_moves.count()

    # ── Phase: pure material ──
    if non_pawn_mat <= Thresholds.ENDGAME_MAX_NON_PAWN_MATERIAL:
        phase = GamePhase.ENDGAME
    elif non_pawn_mat >= Thresholds.OPENING_MIN_NON_PAWN_MATERIAL:
        phase = GamePhase.OPENING
    else:
        phase = GamePhase.MIDDLEGAME

    # ── Critical: multi-PV gap ──
    is_critical = False
    if board.is_check():
        is_critical = True
    else:
        gap = _compute_multi_pv_gap(multi_pv, is_white)
        if gap is not None and gap >= Thresholds.CRITICAL_SECOND_BEST_GAP:
            is_critical = True

    return PositionInfo(
        phase=phase,
        material_white=w_mat,
        material_black=b_mat,
        material_balance=w_mat - b_mat,
        non_pawn_material=non_pawn_mat,
        is_endgame=(phase == GamePhase.ENDGAME),
        total_pieces=total_pieces,
        has_queens=has_queens,
        is_critical=is_critical,
        complexity=min(1.0, legal_count / Thresholds.COMPLEXITY_NORMALIZATION),
        legal_move_count=legal_count,
    )


def _is_likely_recapture(board: chess.Board, move: chess.Move) -> bool:
    if not board.is_capture(move):
        return False
    if board.move_stack:
        last = board.peek()
        if last.to_square == move.to_square:
            return True
    return False


def _is_obvious_capture(board: chess.Board, move: chess.Move) -> bool:
    if not board.is_capture(move):
        return False
    if _is_likely_recapture(board, move):
        return True
    moved = board.piece_at(move.from_square)
    captured = board.piece_at(move.to_square)
    if not moved or not captured:
        return False
    moved_val = get_piece_value(moved.piece_type)
    captured_val = get_piece_value(captured.piece_type)
    if captured_val > moved_val + 1.0:
        return True
    if not board.is_attacked_by(not moved.color, move.to_square):
        return True
    return False


def _is_obvious_tactic(board: chess.Board, move: chess.Move) -> bool:
    test = board.copy()
    test.push(move)
    if test.is_checkmate():
        return True
    if _is_obvious_capture(board, move):
        return True
    return False


def analyze_tactical_info(
    board: chess.Board, move: chess.Move
) -> TacticalInfo:
    info = TacticalInfo()
    moved = board.piece_at(move.from_square)
    captured = board.piece_at(move.to_square)

    if moved:
        info.moved_piece = PIECE_NAMES.get(moved.piece_type)
        info.moved_piece_value = get_piece_value(moved.piece_type)

    info.is_capture = board.is_capture(move)
    info.is_castle = board.is_castling(move)
    info.is_promotion = move.promotion is not None
    info.is_en_passant = board.is_en_passant(move)
    info.is_recapture = _is_likely_recapture(board, move)

    if captured:
        info.captured_piece_value = get_piece_value(captured.piece_type)
    elif info.is_en_passant:
        info.captured_piece_value = 1.0

    test = board.copy()
    test.push(move)
    info.is_check = test.is_check()
    info.is_checkmate = test.is_checkmate()

    if moved:
        mover_color = moved.color
        moved_value = get_piece_value(moved.piece_type)
        material_gained = info.captured_piece_value
        piece_is_hanging = test.is_attacked_by(not mover_color, move.to_square)

        if piece_is_hanging:
            has_defender = test.is_attacked_by(mover_color, move.to_square)
            if not has_defender:
                net_loss = moved_value - material_gained
                if net_loss >= Thresholds.SACRIFICE_MIN_NET_LOSS:
                    info.is_sacrifice = True
                    info.sacrifice_value = net_loss
                    if (moved.piece_type == chess.ROOK and captured
                            and captured.piece_type in (chess.KNIGHT, chess.BISHOP)):
                        info.is_exchange_sacrifice = True
            else:
                attackers = test.attackers(not mover_color, move.to_square)
                if attackers:
                    min_att_val = 10.0
                    for sq in attackers:
                        att = test.piece_at(sq)
                        if att:
                            min_att_val = min(min_att_val, get_piece_value(att.piece_type))
                    # sacrifice if cheapest attacker can recapture for less than what we moved
                    if min_att_val < moved_value:
                        net_loss = moved_value - material_gained
                        if net_loss >= Thresholds.SACRIFICE_MIN_NET_LOSS:
                            info.is_sacrifice = True
                            info.sacrifice_value = net_loss

        elif not info.is_capture and moved_value >= 3.0:
            # Non-capture landing on attacked square (positional sac like Na4)
            if board.is_attacked_by(not mover_color, move.to_square):
                if not board.is_attacked_by(mover_color, move.to_square):
                    # Completely undefended — clear sac
                    info.is_sacrifice = True
                    info.sacrifice_value = moved_value
                else:
                    # Defended but cheapest attacker < piece value — still a sac offer
                    attackers = test.attackers(not mover_color, move.to_square)
                    if attackers:
                        min_att_val = 10.0
                        for sq in attackers:
                            att = test.piece_at(sq)
                            if att:
                                min_att_val = min(min_att_val, get_piece_value(att.piece_type))
                        if min_att_val < moved_value:
                            net_loss = moved_value - material_gained
                            if net_loss >= Thresholds.SACRIFICE_MIN_NET_LOSS:
                                info.is_sacrifice = True
                                info.sacrifice_value = net_loss

    return info


# ============================================================
# Circuit Breaker
# ============================================================
class CircuitBreakerMixin:
    def _init_circuit_breaker(self):
        self._consecutive_failures: int = 0
        self._circuit_open_until: float = 0.0

    def _circuit_is_open(self) -> bool:
        if self._consecutive_failures >= Thresholds.CIRCUIT_BREAKER_MAX_FAILURES:
            if time.time() < self._circuit_open_until:
                return True
            return False
        return False

    def _record_success(self):
        if self._consecutive_failures > 0:
            print(f"✅ {self.__class__.__name__} recovered after {self._consecutive_failures} failures")
        self._consecutive_failures = 0

    def _record_failure(self):
        self._consecutive_failures += 1
        if self._consecutive_failures >= Thresholds.CIRCUIT_BREAKER_MAX_FAILURES:
            self._circuit_open_until = (
                time.time() + Thresholds.CIRCUIT_BREAKER_COOLDOWN
            )
            print(f"⚠️ {self.__class__.__name__} circuit OPEN after {self._consecutive_failures} failures")


# ============================================================
# Lichess APIs
# ============================================================
def _optional_import_requests():
    try:
        import requests as _r
        return _r
    except ImportError:
        return None


class LichessOpeningExplorer(CircuitBreakerMixin):
    BASE_URL = "https://explorer.lichess.ovh"

    def __init__(self, timeout: float = 3.0):
        self._requests = _optional_import_requests()
        if self._requests is None:
            raise ImportError("requests required")
        self.timeout = timeout
        self.last_req = 0.0
        self._cache: Dict[str, Tuple[bool, Optional[str], List[str]]] = {}
        self._init_circuit_breaker()

    def _rate_limit(self):
        wait = Thresholds.API_RATE_LIMIT - (time.time() - self.last_req)
        if wait > 0:
            time.sleep(wait)

    @staticmethod
    def _norm_fen(fen: str) -> str:
        parts = fen.split()
        return " ".join(parts[:4]) if len(parts) >= 4 else fen

    def is_book_position(
        self, fen: str
    ) -> Tuple[bool, Optional[str], List[str]]:
        key = self._norm_fen(fen)
        if key in self._cache:
            return self._cache[key]
        if self._circuit_is_open():
            return False, None, []
        result = self._fetch_masters(fen)
        if not result[0]:
            if self._circuit_is_open():
                self._cache[key] = result
                return result
            result = self._fetch_lichess(fen)
        self._cache[key] = result
        return result

    def _fetch_masters(self, fen: str) -> Tuple[bool, Optional[str], List[str]]:
        self._rate_limit()
        try:
            r = self._requests.get(
                f"{self.BASE_URL}/masters",
                params={"fen": fen, "moves": 15},
                timeout=self.timeout,
            )
            self.last_req = time.time()
            if r.status_code != 200:
                return False, None, []
            data = r.json()
            total = data.get("white", 0) + data.get("draws", 0) + data.get("black", 0)
            if total < Thresholds.MASTERS_MIN_GAMES:
                self._record_success()
                return False, None, []
            opening = data.get("opening")
            name = opening.get("name") if opening else None
            moves = [m["uci"] for m in data.get("moves", []) if m.get("uci")]
            self._record_success()
            return True, name, moves
        except self._requests.ConnectionError as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except self._requests.Timeout as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except self._requests.RequestException as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except (ValueError, KeyError) as e:
            self.last_req = time.time()
            return False, None, []

    def _fetch_lichess(self, fen: str) -> Tuple[bool, Optional[str], List[str]]:
        if self._circuit_is_open():
            return False, None, []
        self._rate_limit()
        try:
            r = self._requests.get(
                f"{self.BASE_URL}/lichess",
                params={
                    "fen": fen, "moves": 15,
                    "ratings": "2000,2200,2500",
                    "speeds": "rapid,classical",
                },
                timeout=self.timeout,
            )
            self.last_req = time.time()
            if r.status_code != 200:
                return False, None, []
            data = r.json()
            total = data.get("white", 0) + data.get("draws", 0) + data.get("black", 0)
            if total < Thresholds.LICHESS_MIN_GAMES:
                self._record_success()
                return False, None, []
            opening = data.get("opening")
            name = opening.get("name") if opening else None
            moves = [m["uci"] for m in data.get("moves", []) if m.get("uci")]
            self._record_success()
            return True, name, moves
        except self._requests.ConnectionError as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except self._requests.Timeout as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except self._requests.RequestException as e:
            self.last_req = time.time()
            self._record_failure()
            return False, None, []
        except (ValueError, KeyError) as e:
            self.last_req = time.time()
            return False, None, []


class SyzygyTablebase(CircuitBreakerMixin):
    BASE_URL = "https://tablebase.lichess.ovh/standard"

    def __init__(self, timeout: float = 3.0):
        self._requests = _optional_import_requests()
        if self._requests is None:
            raise ImportError("requests required")
        self.timeout = timeout
        self._cache: Dict[str, Optional[Dict]] = {}
        self.last_req = 0.0
        self._init_circuit_breaker()

    def probe(self, fen: str) -> Optional[Dict]:
        key = fen.split(" ")[0]
        if key in self._cache:
            return self._cache[key]
        if self._circuit_is_open():
            return None
        wait = Thresholds.API_RATE_LIMIT - (time.time() - self.last_req)
        if wait > 0:
            time.sleep(wait)
        try:
            r = self._requests.get(
                self.BASE_URL, params={"fen": fen}, timeout=self.timeout
            )
            self.last_req = time.time()
            if r.status_code != 200:
                self._cache[key] = None
                return None
            data = r.json()
            result = {
                "category": data.get("category"),
                "dtm": data.get("dtm"),
                "dtz": data.get("dtz"),
                "best_move": None,
            }
            moves = data.get("moves", [])
            if moves:
                result["best_move"] = moves[0].get("uci")
            self._cache[key] = result
            self._record_success()
            return result
        except self._requests.ConnectionError as e:
            self.last_req = time.time()
            self._record_failure()
            self._cache[key] = None
            return None
        except self._requests.Timeout as e:
            self.last_req = time.time()
            self._record_failure()
            self._cache[key] = None
            return None
        except self._requests.RequestException as e:
            self.last_req = time.time()
            self._record_failure()
            self._cache[key] = None
            return None
        except (ValueError, KeyError) as e:
            self.last_req = time.time()
            self._cache[key] = None
            return None

    @staticmethod
    def should_probe(board: chess.Board) -> bool:
        return count_pieces(board) + 2 <= Thresholds.TABLEBASE_MAX_PIECES


# ============================================================
# Stockfish Engine
# ============================================================
class StockfishEngine:
    _SEARCH_PATHS = [
        "bin/stockfish", "bin/stockfish.exe", "../bin/stockfish",
        "/usr/games/stockfish", "/usr/local/bin/stockfish",
        "/usr/bin/stockfish", "/opt/homebrew/bin/stockfish",
        "/snap/bin/stockfish",
    ]

    def __init__(
        self,
        stockfish_path: Optional[str] = None,
        depth: int = 16,
        move_time_ms: int = 500,
        timeout: float = 10.0,
        use_lichess: bool = True,
        use_tablebase: bool = True,
        multi_pv: int = 3,
        threads: int = 1,
        hash_mb: int = 128,
        adaptive_depth: bool = True,
    ):
        self.binary_path = stockfish_path or self._find_stockfish()
        self.base_depth = min(depth, 20)
        self.move_time_ms = move_time_ms
        self.timeout = timeout
        self.multi_pv = multi_pv
        self.threads = threads
        self.hash_mb = hash_mb
        self.adaptive_depth = adaptive_depth
        self.process: Optional[subprocess.Popen] = None
        self.board = chess.Board()
        self._stdout_queue: queue.Queue[str] = queue.Queue()
        self._reader_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self.opening_explorer: Optional[LichessOpeningExplorer] = None
        self.tablebase: Optional[SyzygyTablebase] = None

        if use_lichess:
            try:
                self.opening_explorer = LichessOpeningExplorer()
            except Exception as e:
                print(f"⚠️ Failed to initialize Lichess opening explorer: {e}")
        if use_tablebase:
            try:
                self.tablebase = SyzygyTablebase()
            except Exception as e:
                print(f"⚠️ Failed to initialize Syzygy tablebase: {e}")

    def __enter__(self) -> StockfishEngine:
        self.start()
        return self

    def __exit__(self, *a) -> bool:
        self.close()
        return False

    @classmethod
    def _find_stockfish(cls) -> str:
        here = Path(__file__).resolve().parent
        for rel in cls._SEARCH_PATHS:
            p = here / rel
            if p.is_file() and os.access(str(p), os.X_OK):
                return str(p)
        cwd = Path.cwd()
        for n in ("stockfish", "stockfish.exe"):
            p = cwd / n
            if p.is_file() and os.access(str(p), os.X_OK):
                return str(p)
        found = shutil.which("stockfish")
        if found:
            return found
        raise StockfishError("Stockfish not found")

    def start(self):
        if not os.path.exists(self.binary_path):
            raise StockfishError(f"Not found: {self.binary_path}")
        try:
            self.process = subprocess.Popen(
                [self.binary_path],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, universal_newlines=True, bufsize=1,
            )
            time.sleep(0.1)
            if self.process.poll() is not None:
                raise StockfishError("Crashed on start")
            self._stdout_queue = queue.Queue()
            self._reader_thread = threading.Thread(
                target=self._stdout_reader, daemon=True, name="sf-reader"
            )
            self._reader_thread.start()
            self._send("uci")
            self._wait_for("uciok")
            self._send(f"setoption name Threads value {self.threads}")
            self._send(f"setoption name Hash value {self.hash_mb}")
            self._send("setoption name UCI_AnalyseMode value true")
            self._send("isready")
            self._wait_for("readyok")
            self._send("ucinewgame")
            self._send("isready")
            self._wait_for("readyok")
        except StockfishError:
            self._cleanup()
            raise
        except Exception as e:
            self._cleanup()
            raise StockfishError(f"Start failed: {e}") from e

    def close(self):
        if not self.process:
            return
        try:
            self._send("quit")
            self.process.wait(timeout=2)
        except Exception:
            pass
        finally:
            self._cleanup()

    def _cleanup(self):
        proc = self.process
        self.process = None
        if proc is None:
            return
        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=1)
            except Exception:
                try:
                    proc.kill()
                    proc.wait(timeout=1)
                except Exception:
                    pass
        if self._reader_thread and self._reader_thread.is_alive():
            self._reader_thread.join(timeout=2)
        self._reader_thread = None

    def _stdout_reader(self):
        try:
            proc = self.process
            if not proc or not proc.stdout:
                return
            for line in proc.stdout:
                s = line.strip()
                if s:
                    self._stdout_queue.put(s)
        except Exception as e:
            pass

    def _read_line(self, timeout: float = None) -> Optional[str]:
        try:
            return self._stdout_queue.get(timeout=timeout or self.timeout)
        except queue.Empty:
            return None

    def _send(self, cmd: str):
        if not self.process or not self.process.stdin:
            raise EngineNotRunning("Not running")
        try:
            self.process.stdin.write(f"{cmd}\n")
            self.process.stdin.flush()
        except BrokenPipeError as e:
            raise EngineNotRunning("Died") from e

    def _wait_for(self, expected: str, timeout_override: float = None) -> List[str]:
        lines = []
        t = timeout_override or self.timeout
        deadline = time.time() + t
        while time.time() < deadline:
            rem = deadline - time.time()
            if rem <= 0:
                break
            line = self._read_line(timeout=min(rem, 2.0))
            if line is None:
                if self.process and self.process.poll() is not None:
                    raise EngineNotRunning("Died")
                continue
            lines.append(line)
            if expected in line:
                return lines
        raise EngineTimeout(f"Timeout ({t:.1f}s) for '{expected}'")

    def get_movetime(self, pos_info: PositionInfo) -> int:
        """Get analysis time based on position phase and criticality."""
        
        # Fixed time allocation for better consistency
        if pos_info.is_critical:
            return 5000  # 5 seconds for critical positions
        elif pos_info.phase == GamePhase.ENDGAME:
            return 4000  # 4 seconds for endgame
        elif pos_info.phase == GamePhase.OPENING:
            return 2500  # 2.5 seconds for opening
        else:
            return 3000  # 3 seconds for middlegame (default)

    def evaluate_position(
        self, movetime_ms: Optional[int] = None, num_pvs: int = 3
    ) -> MultiPVResult:
        with self._lock:
            return self._evaluate_locked(movetime_ms, num_pvs)

    def _evaluate_locked(self, movetime_ms: Optional[int], num_pvs: int) -> MultiPVResult:
        if not self.process:
            raise EngineNotRunning("Not started")
        legal = self.board.legal_moves.count()
        num_pvs = min(num_pvs, max(legal, 1))
        if num_pvs <= 0:
            return MultiPVResult()
        mt = movetime_ms or self.move_time_ms
        fen = self.board.fen()
        is_w = self.board.turn == chess.WHITE

        if num_pvs > 1:
            self._send(f"setoption name MultiPV value {num_pvs}")
        self._send(f"position fen {fen}")
        self._send("isready")
        self._wait_for("readyok")
        self._send(f"go movetime {mt}")
        lines = self._wait_for("bestmove", timeout_override=(mt / 1000.0) + 5.0)
        if num_pvs > 1:
            self._send("setoption name MultiPV value 1")

        return self._parse_multi_pv(lines, is_w, num_pvs)

    def _parse_multi_pv(
        self, lines: List[str], is_white_to_move: bool, num_pvs: int,
    ) -> MultiPVResult:
        max_depth = 0
        for line in lines:
            if "info" not in line or "score" not in line or " depth " not in line:
                continue
            parts = line.split()
            try:
                d = int(parts[parts.index("depth") + 1])
                max_depth = max(max_depth, d)
            except (ValueError, IndexError):
                continue

        pv_data: Dict[int, Dict] = {}
        for line in lines:
            if "info" not in line or "score" not in line:
                continue
            parts = line.split()
            try:
                if int(parts[parts.index("depth") + 1]) != max_depth:
                    continue
            except (ValueError, IndexError):
                continue

            pv_num = 1
            if "multipv" in parts:
                try:
                    pv_num = int(parts[parts.index("multipv") + 1])
                except (ValueError, IndexError):
                    pass

            entry: Dict = {"cp": None, "mate": None, "pv": [], "depth": max_depth}
            if "score cp" in line:
                try:
                    entry["cp"] = int(parts[parts.index("cp") + 1])
                except (ValueError, IndexError):
                    pass
            if "score mate" in line:
                try:
                    entry["mate"] = int(parts[parts.index("mate") + 1])
                    entry["cp"] = None
                except (ValueError, IndexError):
                    pass
            if "pv" in parts:
                try:
                    entry["pv"] = parts[parts.index("pv") + 1:]
                except (ValueError, IndexError):
                    pass
            pv_data[pv_num] = entry

        bestmove_uci = None
        for line in lines:
            if line.startswith("bestmove"):
                tokens = line.split()
                if len(tokens) >= 2 and tokens[1] != "(none)":
                    bestmove_uci = tokens[1]

        result = MultiPVResult()
        for i in range(1, num_pvs + 1):
            if i not in pv_data:
                continue
            d = pv_data[i]
            bm = d["pv"][0] if d["pv"] else (bestmove_uci if i == 1 else None)
            if d["mate"] is not None:
                mv = d["mate"]
                if not is_white_to_move:
                    mv = -mv
                result.pvs.append(EvalResult(
                    score_type="mate", score_value=float(mv),
                    mate=mv, best_move=bm, pv=d["pv"], depth=d["depth"],
                ))
            else:
                cp = d["cp"]
                ep = 0.0
                if cp is not None:
                    ep = cp / 100.0
                    if not is_white_to_move:
                        ep = -ep
                result.pvs.append(EvalResult(
                    score_type="cp", score_value=round(ep, 2),
                    eval_cp=round(ep, 2), best_move=bm,
                    pv=d["pv"], depth=d["depth"],
                ))

        if result.empty and bestmove_uci:
            result.pvs.append(EvalResult(
                score_type="cp", score_value=0.0,
                eval_cp=0.0, best_move=bestmove_uci,
            ))

        return result

    def push_move(self, uci: str):
        with self._lock:
            try:
                move = chess.Move.from_uci(uci)
            except ValueError as e:
                raise IllegalMoveError(f"Bad UCI '{uci}': {e}") from e
            if move not in self.board.legal_moves:
                raise IllegalMoveError(f"Illegal {uci} at {self.board.fen()}")
            self.board.push(move)

    def reset(self):
        with self._lock:
            self.board.reset()
            if self.process:
                self._send("ucinewgame")
                self._send("isready")
                self._wait_for("readyok")

    def restart_engine(self):
        self.close()
        time.sleep(Thresholds.RESTART_DELAY)
        self.board = chess.Board()
        self.start()

    def replay_moves(self, moves: List[MoveInput], up_to_index: int):
        self.board = chess.Board()
        if self.process:
            self._send("ucinewgame")
            self._send("isready")
            self._wait_for("readyok")
        for i in range(up_to_index):
            m = chess.Move.from_uci(moves[i].uci)
            if m not in self.board.legal_moves:
                raise IllegalMoveError(
                    f"Replay failed at index {i}: "
                    f"{moves[i].uci} illegal at {self.board.fen()}"
                )
            self.board.push(m)

    def get_book_move_info(self, move_uci: str) -> Tuple[bool, Optional[str]]:
        if not self.opening_explorer:
            return False, None
        try:
            fen = self.board.fen()
            is_book, _, valid = self.opening_explorer.is_book_position(fen)
            if not (is_book and move_uci in valid):
                return False, None
            temp = self.board.copy()
            temp.push(chess.Move.from_uci(move_uci))
            _, name, _ = self.opening_explorer.is_book_position(temp.fen())
            return True, name
        except Exception as e:
            return False, None

    def probe_tablebase(self) -> Optional[Dict]:
        if not self.tablebase:
            return None
        if not SyzygyTablebase.should_probe(self.board):
            return None
        return self.tablebase.probe(self.board.fen())


# ============================================================
# Move Classifier
# ============================================================
class MoveClassifier:
    """
    Stateful per-game classifier.  Tracks brilliant count.
    Must be instantiated once per game and reset() between games.
    """

    def __init__(self):
        self._brilliant_count: int = 0

    def reset(self):
        self._brilliant_count = 0

    # ------------------------------------------------------------------ build
    @staticmethod
    def build_context(
        eval_before: EvalResult,
        eval_after: EvalResult,
        move: MoveInput,
        legal_count: int,
        is_book: bool,
        opening_name: Optional[str],
        multi_pv: MultiPVResult,
        tactical: TacticalInfo,
        pos_info: PositionInfo,
        tb: Optional[Dict],
        board_before: chess.Board,
    ) -> ClassificationContext:
        is_w = move.is_white
        played = move.uci
        best = eval_before.best_move

        if eval_before.is_mate or eval_after.is_mate:
            delta = None
        elif eval_before.eval_cp is not None and eval_after.eval_cp is not None:
            raw = eval_after.eval_cp - eval_before.eval_cp
            delta = round(raw if is_w else -raw, 2)
        else:
            delta = None

        # Use the fixed cp_to_win_percent for checkmate positions
        if eval_after.is_checkmate:
            wp_a = 100.0 if is_w else 0.0
        else:
            wp_a = cp_to_win_percent(eval_after.eval_cp, eval_after.mate)

        wp_b = cp_to_win_percent(eval_before.eval_cp, eval_before.mate)

        return ClassificationContext(
            eval_before=eval_before,
            eval_after=eval_after,
            move=move,
            played=played,
            best=best,
            delta=delta,
            legal_count=legal_count,
            is_book=is_book,
            opening_name=opening_name,
            multi_pv=multi_pv,
            tactical=tactical,
            position=pos_info,
            wp_before=wp_b,
            wp_after=wp_a,
            tablebase=tb,
            board_before=board_before,
        )

    # --------------------------------------------------------------- classify
    def classify(self, ctx: ClassificationContext) -> AnalysisResult:
        wp_d = round(ctx.mover_wp_after - ctx.mover_wp_before, 1)
        accuracy = self._compute_accuracy(ctx)
        label = self._determine_label(ctx)

        best_san = None
        if ctx.best and ctx.best != ctx.played:
            try:
                m = chess.Move.from_uci(ctx.best)
                if m in ctx.board_before.legal_moves:
                    best_san = ctx.board_before.san(m)
            except (ValueError, chess.InvalidMoveError):
                pass

        tac_dict = None
        if ctx.tactical.is_tactical:
            tac_dict = {
                "is_capture": ctx.tactical.is_capture,
                "is_check": ctx.tactical.is_check,
                "is_checkmate": ctx.tactical.is_checkmate,
                "is_sacrifice": ctx.tactical.is_sacrifice,
                "sacrifice_value": ctx.tactical.sacrifice_value,
                "moved_piece": ctx.tactical.moved_piece,
                "is_exchange_sacrifice": ctx.tactical.is_exchange_sacrifice,
                "is_recapture": ctx.tactical.is_recapture,
            }

        return AnalysisResult(
            move_number=ctx.move.move_number,
            side=ctx.move.side,
            san=ctx.move.san,
            uci=ctx.move.uci,
            eval_before=ctx.eval_before.eval_cp,
            eval_after=ctx.eval_after.eval_cp,
            delta=ctx.delta,
            mate_before=ctx.eval_before.mate,
            mate_after=ctx.eval_after.mate,
            label=label,
            best_move=ctx.best if ctx.best != ctx.played else None,
            best_move_san=best_san,
            opening=ctx.opening_name,
            phase=ctx.position.phase.value,
            win_percent_before=round(ctx.wp_before, 1),
            win_percent_after=round(ctx.wp_after, 1),
            win_percent_delta=wp_d,
            is_critical=ctx.position.is_critical,
            is_sacrifice=ctx.tactical.is_sacrifice,
            tactical_info=tac_dict,
            accuracy=accuracy,
        )

    # ------------------------------------------------------------ accuracy
    def _compute_accuracy(self, ctx: ClassificationContext) -> float:
        is_w = ctx.is_white
        eb, ea = ctx.eval_before, ctx.eval_after

        # Forced move or delivered checkmate → always 100%
        if ctx.legal_count <= 1 or ea.is_checkmate:
            return 100.0

        # Both in mate sequences → use mate accuracy
        if eb.is_mate and ea.is_mate:
            return calculate_mate_accuracy(eb.mate, ea.mate, None, is_w)

        # Had mate before, lost it → use mate accuracy
        if eb.is_mate and not ea.is_mate:
            return calculate_mate_accuracy(eb.mate, None, ea.eval_cp, is_w)

        # No mate before, found winning mate → 100%; found losing mate → 0%
        if not eb.is_mate and ea.is_mate:
            return 100.0 if ea.is_mover_winning_mate(is_w) else 0.0

        # Both cp → wp-based accuracy
        if eb.eval_cp is not None and ea.eval_cp is not None:
            return calculate_move_accuracy(eb.eval_cp, ea.eval_cp, is_w)

        return 100.0

    # -------------------------------------------------------- determine label
    def _determine_label(self, ctx: ClassificationContext) -> str:
        if ctx.legal_count == 1:
            return MoveQuality.FORCED.value

        # Book: only if within acceptable loss AND not a serious error
        # Protects against outdated opening theory being rubber-stamped as Book
        if ctx.is_book and ctx.wp_loss <= Thresholds.WP_BOOK_MAX_LOSS:
            return MoveQuality.BOOK.value
        # Book move but bad — fall through to normal classification
        # (a move Lichess calls "book" but costs 10%+ is just a mistake)

        if ctx.tactical.is_checkmate:
            # Check if brilliant/great first — a sacrificial checkmate deserves the label
            if self._is_brilliant(ctx):
                if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                    self._brilliant_count += 1
                    return MoveQuality.BRILLIANT.value
                return MoveQuality.GREAT.value
            if self._is_great(ctx):
                return MoveQuality.GREAT.value
            return MoveQuality.BEST.value

        if ctx.tablebase:
            tb = ctx.tablebase
            tb_best = tb.get("best_move")
            tb_result = tb.get("result")  # "win", "draw", "loss" from mover's view
            tb_played_result = tb.get("played_result")  # result after played move

            # Played the tablebase best move
            if tb_best == ctx.played:
                return MoveQuality.BEST.value

            # Tablebase result degraded: win→draw, win→loss, draw→loss
            if tb_result and tb_played_result:
                if tb_result == "win" and tb_played_result == "loss":
                    return MoveQuality.BLUNDER.value
                if tb_result == "win" and tb_played_result == "draw":
                    return MoveQuality.MISTAKE.value
                if tb_result == "draw" and tb_played_result == "loss":
                    return MoveClassifier._downgrade_if_already_winning(
                        MoveQuality.BLUNDER.value, ctx
                    )

        # --- Mate-phase handling ---
        # If a mate exists before the move, classify ONLY by mate distance changes
        if ctx.eval_before.is_mate:
            return self._classify_mate_transition(ctx)

        # Brilliant — gate on _is_brilliant then cap
        if self._is_brilliant(ctx):
            if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                self._brilliant_count += 1
                return MoveQuality.BRILLIANT.value
            # cap exceeded → downgrade to Great
            return MoveQuality.GREAT.value

        if self._is_great(ctx):
            return MoveQuality.GREAT.value

        if ctx.eval_before.is_mate or ctx.eval_after.is_mate:
            return self._classify_mate(ctx)

        # ── Turnaround detection ──
        # These run after Brilliant/Great so a turnaround that already qualifies
        # as Brilliant/Great gets the higher label. These catch the remaining cases.

        gain = ctx.wp_gain  # how much mover's win% improved

        # Losing → Win (biggest turnaround — always at least Great)
        if self._is_losing_to_win(ctx):
            if gain >= Thresholds.WP_TURNAROUND_BRILLIANT and ctx.is_best_move:
                if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                    self._brilliant_count += 1
                    return MoveQuality.BRILLIANT.value
                return MoveQuality.GREAT.value
            return MoveQuality.GREAT.value

        # Losing → Draw (saved a lost game — stalemate, perpetual, fortress)
        if self._is_losing_to_draw(ctx):
            if gain >= Thresholds.WP_TURNAROUND_BRILLIANT and ctx.is_best_move:
                if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                    self._brilliant_count += 1
                    return MoveQuality.BRILLIANT.value
                return MoveQuality.GREAT.value
            if gain >= Thresholds.WP_TURNAROUND_GREAT:
                return MoveQuality.GREAT.value
            # Smaller save — still noteworthy
            return MoveQuality.BEST.value

        # Draw → Win (converted an equal position decisively)
        if self._is_draw_to_win(ctx):
            if gain >= Thresholds.WP_TURNAROUND_BRILLIANT and ctx.is_best_move:
                if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                    self._brilliant_count += 1
                    return MoveQuality.BRILLIANT.value
                return MoveQuality.GREAT.value
            if gain >= Thresholds.WP_TURNAROUND_GREAT:
                return MoveQuality.GREAT.value
            return MoveQuality.BEST.value

        if self._is_missed_win(ctx):
            return MoveQuality.MISSED_WIN.value

        return self._classify_by_wp(ctx)

    # -------------------------------------------------------- mate transition
    def _classify_mate_transition(self, ctx: ClassificationContext) -> str:
        """
        Handles classification when a forced mate exists before the move.
        Centipawn logic is ignored — only mate distances matter.
        """
        is_w = ctx.is_white
        mb = ctx.eval_before.mate
        ma = ctx.eval_after.mate
        tac = ctx.tactical

        # Mate disappeared after the move
        if mb is not None and ma is None:
            mover_mb = mb if is_w else -mb
            if mover_mb > 0:
                # Was winning mate, now no mate — catastrophic blunder
                return MoveQuality.BLUNDER.value
            # Was LOSING mate, now no mate — escaped forced mate!
            # How good the escape is depends on what the position is now
            gain = ctx.wp_gain
            if gain >= Thresholds.WP_TURNAROUND_BRILLIANT and ctx.is_best_move:
                if self._brilliant_count < Thresholds.BRILLIANT_MAX_PER_GAME:
                    self._brilliant_count += 1
                    return MoveQuality.BRILLIANT.value
                return MoveQuality.GREAT.value
            if gain >= Thresholds.WP_TURNAROUND_GREAT:
                return MoveQuality.GREAT.value
            return MoveQuality.BEST.value

        if mb is not None and ma is not None:
            mover_mb = mb if is_w else -mb
            mover_ma = ma if is_w else -ma

            # ── Was winning mate ──
            if mover_mb > 0:
                if mover_ma > 0:
                    improvement = abs(mover_mb) - abs(mover_ma)
                    # Found a significantly faster mate — potentially Great
                    if improvement >= 5:
                        return MoveQuality.GREAT.value
                    if improvement > 0:
                        return MoveQuality.BEST.value
                    if improvement == 0:
                        return MoveQuality.BEST.value
                    # Slower mate — how much slower determines severity
                    delay = abs(mover_ma) - abs(mover_mb)
                    if delay <= 2:
                        return MoveQuality.BEST.value   # still short mate, acceptable
                    if delay <= 5:
                        return MoveQuality.INACCURACY.value
                    return MoveQuality.MISTAKE.value
                else:
                    # Was winning mate, now opponent has mate — catastrophic
                    return MoveClassifier._downgrade_if_already_winning(
                        MoveQuality.BLUNDER.value, ctx
                    )

            # ── Was losing mate ──
            if mover_mb < 0:
                if mover_ma < 0:
                    prolonged = abs(mover_ma) - abs(mover_mb)
                    # Significantly prolonged the game — defensive brilliance
                    if prolonged >= 5:
                        return MoveQuality.GREAT.value
                    if prolonged > 0:
                        return MoveQuality.BEST.value
                    if prolonged == 0:
                        return MoveQuality.BEST.value
                    # Got mated faster — how much faster
                    faster = abs(mover_mb) - abs(mover_ma)
                    if faster <= 1:
                        return MoveQuality.BEST.value   # within 1 = basically same
                    if faster <= 3:
                        return MoveClassifier._downgrade_if_already_winning(
                            MoveQuality.INACCURACY.value, ctx
                        )
                    return MoveClassifier._downgrade_if_already_winning(
                        MoveQuality.MISTAKE.value, ctx
                    )
                else:
                    # Was losing mate, now winning mate — escaped!
                    # Check if it involved a sacrifice (extra credit)
                    if tac.is_sacrifice:
                        return MoveQuality.GREAT.value
                    return MoveQuality.BEST.value

        return MoveQuality.BEST.value

    # ------------------------------------------------------------ brilliant
    @staticmethod
    def _is_brilliant(ctx: ClassificationContext) -> bool:
        """
        ALL conditions must be true.

        1. exact best move
        2. second-best gap ≥ threshold
        3. real sacrifice ≥ threshold
        4. eval_after ≥ eval_before − max_drop
        5. not forced
        6. not recapture
        7. not already clearly winning
        8. position sufficiently complex
        9. reasonable branching factor
        """

        tac = ctx.tactical
        is_w = ctx.is_white

        # 1 — exact best move (or within rounding tolerance of best)
        # Stockfish sometimes ranks two nearly-equal moves differently across
        # depths; we allow a tiny cp tolerance to avoid losing brilliancies
        # to engine noise.
        if not ctx.is_best_move:
            # Allow if the played move is within 0.05 pawns of the best eval
            me_after = ctx.mover_eval_after
            mpv_best = ctx.multi_pv.best
            if mpv_best is not None and me_after is not None:
                best_eval = mpv_best.mover_eval(ctx.is_white)
                if best_eval is None or me_after < best_eval - 0.05:
                    return False
                # Within tolerance — allow through
            else:
                return False

        # 5 — not forced
        if ctx.legal_count <= 1:
            return False

        # 6 — not recapture
        if tac.is_recapture:
            return False

        # 3 — real sacrifice OR extraordinarily unique move (huge gap, no alternatives)
        # A non-sacrifice can still be Brilliant if the gap to second-best is massive
        # (e.g. a deeply hidden quiet move that wins by 4+ pawns with no alternatives)
        if not tac.is_sacrifice:
            # Allow non-sacrifice brilliant only with very large gap
            mpv_check = ctx.multi_pv
            gap_check = _compute_multi_pv_gap(mpv_check, ctx.is_white)
            if gap_check is None or gap_check < Thresholds.BRILLIANT_SECOND_BEST_GAP * 2.5:
                return False
            # Also must not be a capture (captures have obvious material reasons)
            if tac.is_capture:
                return False
        elif tac.sacrifice_value < Thresholds.BRILLIANT_MIN_SACRIFICE:
            return False

        # 2 — second-best gap
        mpv = ctx.multi_pv
        if mpv.empty or len(mpv.pvs) < 2:
            return False

        gap = _compute_multi_pv_gap(mpv, is_w)
        if gap is None:
            return False
        if gap < Thresholds.BRILLIANT_SECOND_BEST_GAP:
            return False

        # 4 — evaluation stability
        me_before = ctx.mover_eval_before
        me_after = ctx.mover_eval_after

        if me_before is not None and me_after is not None:
            # cp -> cp: eval must not drop more than threshold
            if me_after < me_before - Thresholds.BRILLIANT_MAX_EVAL_DROP:
                return False
        elif ctx.eval_before.is_mate:
            # already in mate sequence before move
            if ctx.eval_before.is_mover_winning_mate(is_w):
                return False  # can't be brilliant if already winning with mate
            # losing mate -> allow (sacrificing while losing to complicate)
        elif ctx.eval_after.is_mate:
            # cp -> mate: the sacrifice leads to forced mate = valid
            if not ctx.eval_after.is_mover_winning_mate(is_w):
                return False
        else:
            return False  # no eval data, can't verify

        # 7 — not already completely crushing (raised from 3.0 to 4.0)
        if me_before is not None:
            if me_before >= 4.0:
                return False

        # 8 — position must be complex enough
        # Use legal move count as primary signal (more reliable than raw complexity ratio)
        if ctx.position.legal_move_count < 8 and ctx.position.complexity < Thresholds.GREAT_MIN_COMPLEXITY:
            return False

        # 9 — avoid tiny branching positions
        if ctx.position.legal_move_count < 6:
            return False

        return True

    # ------------------------------------------------------------- great
    @staticmethod
    def _is_great(ctx: ClassificationContext) -> bool:
        tac = ctx.tactical

        if tac.is_recapture:
            return False
        if tac.is_capture and not tac.is_sacrifice:
            try:
                chess_move = chess.Move.from_uci(ctx.played)
                if _is_obvious_capture(ctx.board_before, chess_move):
                    return False
            except (ValueError, chess.InvalidMoveError):
                pass
        if tac.is_checkmate:
            # Still allow Great for a checkmate that involves a sacrifice
            if not tac.is_sacrifice:
                return False
        # Must be best move or within 0.10 pawn tolerance (engine ranking noise)
        if not ctx.is_best_move:
            me_after = ctx.mover_eval_after
            mpv_best_res = ctx.multi_pv.best
            if mpv_best_res is not None and me_after is not None:
                best_eval = mpv_best_res.mover_eval(ctx.is_white)
                if best_eval is None or me_after < best_eval - 0.10:
                    return False
            else:
                return False

        mpv = ctx.multi_pv
        if mpv.empty or len(mpv.pvs) < 2:
            return False
        if ctx.position.legal_move_count < Thresholds.GREAT_MIN_LEGAL_MOVES:
            return False

        second = mpv.second_best
        if second is None:
            return False

        is_w = ctx.is_white

        # Mate cases
        if ctx.eval_after.is_mate or second.is_mate:
            if ctx.eval_after.is_mate and second.is_mate:
                our = ctx.eval_after.mover_mate(is_w)
                their = second.mover_mate(is_w)
                if our is not None and their is not None and our > 0 and their > 0:
                    if abs(their) - abs(our) >= 3:
                        return True
                return False
            if ctx.eval_after.is_mover_winning_mate(is_w) and not second.is_mate:
                return True
            return False

        # Both cp — use BOTH eval gap AND win% gap (either is enough)
        eval_best = ctx.eval_after.mover_eval(is_w)
        eval_second = second.mover_eval(is_w)
        if eval_best is not None and eval_second is not None:
            if eval_best - eval_second >= Thresholds.GREAT_SECOND_BEST_EVAL_GAP:
                return True

        wp_best = ctx.mover_wp_after
        wp_second = _eval_to_mover_wp(second, is_w)
        if wp_best - wp_second >= Thresholds.GREAT_SECOND_BEST_WP_GAP:
            return True

        # Sacrifice that is also best move and has meaningful gap — allow Great
        # even if gap is below threshold (positional sacs often have smaller gaps)
        if tac.is_sacrifice and ctx.is_best_move:
            if eval_best is not None and eval_second is not None:
                if eval_best - eval_second >= Thresholds.GREAT_SECOND_BEST_EVAL_GAP * 0.6:
                    return True
            if wp_best - wp_second >= Thresholds.GREAT_SECOND_BEST_WP_GAP * 0.6:
                return True

        return False

    # ------------------------------------------------- losing → draw (save)
    @staticmethod
    def _is_losing_to_draw(ctx: ClassificationContext) -> bool:
        """
        Detects moves that save a lost position: stalemate traps, perpetual
        check offers, fortress setups, underpromotion tricks, etc.
        """
        if ctx.eval_before.is_mate or ctx.eval_after.is_mate:
            return False
        if ctx.mover_wp_before > Thresholds.WP_LOSING_THRESHOLD:
            return False
        if ctx.mover_wp_after < Thresholds.WP_DRAW_MIN:
            return False
        if ctx.mover_wp_after > Thresholds.WP_DRAW_MAX:
            return False  # went all the way to winning — handled by _is_losing_to_win
        # Must be best or near-best — random moves that stumble into draws don't qualify
        me_after = ctx.mover_eval_after
        mpv_best = ctx.multi_pv.best
        if not ctx.is_best_move and mpv_best is not None and me_after is not None:
            best_eval = mpv_best.mover_eval(ctx.is_white)
            if best_eval is not None and me_after < best_eval - 0.15:
                return False
        return True

    # ------------------------------------------------- draw → win (convert)
    @staticmethod
    def _is_draw_to_win(ctx: ClassificationContext) -> bool:
        """
        Detects moves that convert an equal/drawn position into a winning one:
        subtle pawn breaks, zugzwang setups, piece activity that tips the balance.
        """
        if ctx.eval_before.is_mate or ctx.eval_after.is_mate:
            return False
        if ctx.mover_wp_before < Thresholds.WP_EQUAL_MIN:
            return False
        if ctx.mover_wp_before > Thresholds.WP_EQUAL_MAX:
            return False
        if ctx.mover_wp_after < Thresholds.WP_WIN_MIN:
            return False
        # Must be best or near-best
        me_after = ctx.mover_eval_after
        mpv_best = ctx.multi_pv.best
        if not ctx.is_best_move and mpv_best is not None and me_after is not None:
            best_eval = mpv_best.mover_eval(ctx.is_white)
            if best_eval is not None and me_after < best_eval - 0.15:
                return False
        return True

    # ------------------------------------------------- losing → win (escape)
    @staticmethod
    def _is_losing_to_win(ctx: ClassificationContext) -> bool:
        """
        Detects moves that escape a losing position directly into a winning one.
        Rarer but real — e.g. a counter-attack that flips the game completely.

        Criteria:
        - Position was losing (mover_wp_before ≤ 35%)
        - Position is now clearly winning (mover_wp_after ≥ 65%)
        - Not a mate sequence (those are handled separately)
        """
        if ctx.eval_before.is_mate or ctx.eval_after.is_mate:
            return False
        if ctx.mover_wp_before > Thresholds.WP_LOSING_THRESHOLD:
            return False
        if ctx.mover_wp_after < Thresholds.WP_WIN_MIN:
            return False
        return True

    # --------------------------------------------------------- missed win
    @staticmethod
    def _is_missed_win(ctx: ClassificationContext) -> bool:
        # Must not already be in a mate sequence (handled by other paths)
        if ctx.eval_before.is_mate or ctx.eval_after.is_mate:
            return False
        # Must have been clearly winning before
        if ctx.mover_wp_before < Thresholds.WP_MISSED_WIN_MOVER_BEFORE:
            return False
        # Must have lost significant win%
        if ctx.wp_loss < Thresholds.WP_MISSED_WIN_LOSS:
            return False
        # Must now be below "still comfortably winning" threshold
        if ctx.mover_wp_after > Thresholds.WP_MISSED_WIN_STILL_WINNING:
            return False
        # Must not be the best move (if it's the best, it can't be a missed win)
        if ctx.is_best_move:
            return False
        return True

    # -------------------------------------------------------- classify mate
    # Called ONLY when eval_after.is_mate but NOT eval_before.is_mate.
    # (eval_before.is_mate cases are routed to _classify_mate_transition earlier.)
    @staticmethod
    def _classify_mate(ctx: ClassificationContext) -> str:
        ea = ctx.eval_after
        is_w = ctx.is_white
        tac = ctx.tactical

        # Delivered checkmate — already handled upstream but guard here too
        if ea.is_checkmate:
            return MoveQuality.BEST.value

        ma = ea.mate

        # Opponent now has forced mate on us — we walked into it
        if ma is not None:
            mover_ma = ma if is_w else -ma

            if mover_ma > 0:
                # We found a winning forced mate from a non-mate position.
                # This is always at least Best. Brilliant/Great already checked
                # upstream before this function is called, so just return Best.
                return MoveQuality.BEST.value

            # mover_ma < 0: we gave the opponent a forced mate
            # Severity depends on how short the mate is
            abs_mate = abs(mover_ma)
            if abs_mate == 1:
                # Mate in 1 missed AND we gave immediate mate — catastrophic
                return MoveClassifier._downgrade_if_already_winning(
                    MoveQuality.BLUNDER.value, ctx
                )
            if abs_mate <= 3:
                return MoveClassifier._downgrade_if_already_winning(
                    MoveQuality.BLUNDER.value, ctx
                )
            if abs_mate <= 6:
                return MoveClassifier._downgrade_if_already_winning(
                    MoveQuality.MISTAKE.value, ctx
                )
            # Long forced mate — treated as a bad move but not catastrophic
            return MoveClassifier._downgrade_if_already_winning(
                MoveQuality.INACCURACY.value, ctx
            )

        return MoveQuality.GOOD.value

    # -------------------------------------------------- downgrade if winning
    @staticmethod
    def _downgrade_if_already_winning(label: str, ctx: ClassificationContext) -> str:
        """
        Reduce error severity when the position is already decided.
        
        Rationale: a blunder in a +8 position is less significant than
        a blunder in a +0.3 position. We downgrade one level when either
        side is clearly winning (±4 pawns) and two levels when completely
        crushing (±7 pawns).
        """
        me_before = ctx.mover_eval_before
        if me_before is None:
            return label

        abs_eval = abs(me_before)

        # Completely crushing position (±7) → downgrade 2 levels
        if abs_eval >= 7.0:
            if label == MoveQuality.BLUNDER.value:
                return MoveQuality.INACCURACY.value
            if label == MoveQuality.MISTAKE.value:
                return MoveQuality.GOOD.value
            if label == MoveQuality.INACCURACY.value:
                return MoveQuality.GOOD.value

        # Clearly decided position (±4) → downgrade 1 level
        elif abs_eval >= 4.0:
            if label == MoveQuality.BLUNDER.value:
                return MoveQuality.MISTAKE.value
            if label == MoveQuality.MISTAKE.value:
                return MoveQuality.INACCURACY.value

        return label

    # -------------------------------------------------------- classify wp
    @staticmethod
    def _classify_by_wp(ctx: ClassificationContext) -> str:
        loss = ctx.wp_loss

        # Exact best move → always Best regardless of wp
        if ctx.is_best_move:
            return MoveQuality.BEST.value

        # Complexity-based hysteresis: in sharp/complex positions (20+ legal moves),
        # shift thresholds slightly upward to reduce harsh cliffs.
        # A 21% loss in a 35-move position is less egregious than in a 5-move endgame.
        complexity_bonus = 2.0 if ctx.position.legal_move_count >= 20 else 0.0

        best_t       = Thresholds.WP_BEST_LOSS       + complexity_bonus
        excellent_t  = Thresholds.WP_EXCELLENT_LOSS  + complexity_bonus
        good_t       = Thresholds.WP_GOOD_LOSS        + complexity_bonus
        inaccuracy_t = Thresholds.WP_INACCURACY_LOSS  + complexity_bonus
        mistake_t    = Thresholds.WP_MISTAKE_LOSS     + complexity_bonus

        # Not the best move but within threshold → Best
        if loss <= best_t:
            return MoveQuality.BEST.value

        # Excellent
        if loss <= excellent_t:
            return MoveQuality.EXCELLENT.value

        # Good
        if loss <= good_t:
            return MoveQuality.GOOD.value

        # Inaccuracy (downgraded in decided positions)
        if loss <= inaccuracy_t:
            return MoveClassifier._downgrade_if_already_winning(
                MoveQuality.INACCURACY.value, ctx
            )

        # Mistake (downgraded in decided positions)
        if loss <= mistake_t:
            return MoveClassifier._downgrade_if_already_winning(
                MoveQuality.MISTAKE.value, ctx
            )

        # Blunder (downgraded in decided positions)
        return MoveClassifier._downgrade_if_already_winning(
            MoveQuality.BLUNDER.value, ctx
        )


# ============================================================
# Game Analysis
# ============================================================

def analyze_game(
    moves: list,
    stockfish_path: Optional[str] = None,
    depth: int = 22,
    move_time_ms: int = 3000,
    use_lichess_api: bool = True,
    use_tablebase: bool = True,
    multi_pv: int = 5,
    threads: int = 2,
    hash_mb: int = 512,
    adaptive_depth: bool = False,
    min_depth: int = 18,
    max_depth: int = 28,
    timeout: float = 600.0,
    engine: Optional[StockfishEngine] = None,
    progress_callback = None,  # Can be sync or async callable
    event_loop = None,          # Pass asyncio event loop when calling from a thread
) -> Dict:
    validated = _validate_moves(moves)
    if not validated:
        return {"moves": [], "summary": _build_summary([], [], [])}

    if engine:
        try:
            result = _run_analysis(engine, validated, multi_pv, progress_callback, event_loop)
        except Exception as e:
            raise
    else:
        with StockfishEngine(
            stockfish_path=stockfish_path, depth=depth,
            move_time_ms=move_time_ms, timeout=timeout,
            use_lichess=use_lichess_api, use_tablebase=use_tablebase,
            multi_pv=multi_pv, threads=threads, hash_mb=hash_mb,
            adaptive_depth=adaptive_depth,
        ) as new_engine:
            result = _run_analysis(new_engine, validated, multi_pv, progress_callback, event_loop)

    expected = len(validated)
    actual = len(result["moves"])
    if actual != expected:
        result["summary"]["warning"] = f"Incomplete: {actual}/{expected} moves analyzed"
        result["summary"]["is_complete"] = False
    else:
        result["summary"]["is_complete"] = True

    return result


def _run_analysis(
    engine: StockfishEngine,
    moves: List[MoveInput],
    multi_pv: int,
    progress_callback = None,
    event_loop = None,      # Pass the asyncio event loop when calling from a thread
) -> Dict:
    results: List[AnalysisResult] = []
    w_acc: List[float] = []
    b_acc: List[float] = []

    classifier = MoveClassifier()

    is_white_turn = engine.board.turn == chess.WHITE
    pos = analyze_position_info(engine.board, None, is_white_turn)
    mt = engine.get_movetime(pos)
    current_mpv = engine.evaluate_position(
        movetime_ms=mt, num_pvs=min(multi_pv, pos.legal_move_count),
    )
    current_eval = current_mpv.best or EvalResult(eval_cp=0.0)

    # Recompute position with multi-PV for critical detection
    pos = analyze_position_info(engine.board, current_mpv, is_white_turn)

    total = len(moves)
    restart_count = 0

    for idx, mi in enumerate(moves):
        try:
            print(f"Move {idx + 1}/{total}: {mi.move_number}.{'.' if not mi.is_white else ''} {mi.san} ({mi.uci})")

            is_white_turn = engine.board.turn == chess.WHITE
            pos = analyze_position_info(engine.board, current_mpv, is_white_turn)
            legal_count = pos.legal_move_count
            is_book, opening = engine.get_book_move_info(mi.uci)
            mt = engine.get_movetime(pos)

            chess_move = chess.Move.from_uci(mi.uci)
            tac = analyze_tactical_info(engine.board, chess_move)

            eb = current_eval
            mpv = (
                current_mpv
                if (not is_book and legal_count > 1)
                else MultiPVResult()
            )
            tb = engine.probe_tablebase()
            board_before = engine.board.copy()

            engine.push_move(mi.uci)
            ea, next_mpv = _evaluate_after_move(engine, mi, multi_pv)

            ctx = classifier.build_context(
                eval_before=eb, eval_after=ea, move=mi,
                legal_count=legal_count, is_book=is_book,
                opening_name=opening, multi_pv=mpv, tactical=tac,
                pos_info=pos, tb=tb, board_before=board_before,
            )
            analysis = classifier.classify(ctx)
            results.append(analysis)

            if analysis.accuracy is not None:
                (w_acc if mi.is_white else b_acc).append(analysis.accuracy)

            # Call progress callback if provided
            if progress_callback:
                try:
                    import asyncio
                    if asyncio.iscoroutinefunction(progress_callback):
                        # _run_analysis runs in a ThreadPoolExecutor thread.
                        # asyncio.create_task() requires the current thread to
                        # HAVE a running event loop — thread pools don't.
                        # Use run_coroutine_threadsafe() to safely schedule the
                        # coroutine onto the main event loop from this thread.
                        # Use the pre-captured event loop if provided (thread-safe),
                        # otherwise try to detect it.
                        loop = event_loop
                        if loop is None:
                            try:
                                loop = asyncio.get_event_loop()
                            except RuntimeError:
                                loop = None

                        if loop and loop.is_running():
                            # Thread-safe scheduling onto the main event loop
                            asyncio.run_coroutine_threadsafe(
                                progress_callback(analysis.to_dict(), idx + 1, total),
                                loop
                            )
                        else:
                            # Direct async context (shouldn't happen but safe fallback)
                            asyncio.create_task(
                                progress_callback(analysis.to_dict(), idx + 1, total)
                            )
                    else:
                        # Sync callback — call directly
                        progress_callback(analysis.to_dict(), idx + 1, total)
                except Exception as e:
                    pass

            current_eval = ea
            current_mpv = next_mpv

        except EngineNotRunning:
            recovered = _recover_engine(engine, moves, idx, multi_pv, restart_count)
            if recovered is None:
                break
            restart_count += 1
            current_eval, current_mpv = recovered
            results.append(_make_fallback_result(mi, engine.board))

        except EngineTimeout:
            recovered = _recover_from_timeout(engine, mi, moves, idx, multi_pv)
            if recovered is None:
                break
            current_eval, current_mpv = recovered
            results.append(_make_fallback_result(mi, engine.board))

        except Exception as e:
            try:
                chess_m = chess.Move.from_uci(mi.uci)
                if chess_m in engine.board.legal_moves:
                    engine.push_move(mi.uci)
                is_white_turn = engine.board.turn == chess.WHITE
                new_pos = analyze_position_info(engine.board, None, is_white_turn)
                new_mt = engine.get_movetime(new_pos)
                current_mpv = engine.evaluate_position(
                    movetime_ms=new_mt,
                    num_pvs=min(multi_pv, new_pos.legal_move_count),
                )
                current_eval = current_mpv.best or EvalResult(eval_cp=0.0)
                results.append(_make_fallback_result(mi, engine.board))
            except Exception as e2:
                break

    return {
        "moves": [r.to_dict() for r in results],
        "summary": _build_summary(results, w_acc, b_acc),
    }


def _evaluate_after_move(
    engine: StockfishEngine, move: MoveInput, multi_pv: int,
) -> Tuple[EvalResult, MultiPVResult]:
    board = engine.board
    if board.is_game_over():
        if board.is_checkmate():
            ea = EvalResult(
                score_type="mate",
                score_value=1.0 if move.is_white else -1.0,
                mate=1 if move.is_white else -1,
                is_checkmate=True,
            )
        else:
            ea = EvalResult(score_type="cp", score_value=0.0, eval_cp=0.0)
        return ea, MultiPVResult(pvs=[ea])

    is_white_turn = board.turn == chess.WHITE
    new_pos = analyze_position_info(board, None, is_white_turn)
    new_mt = engine.get_movetime(new_pos)
    next_mpv = engine.evaluate_position(
        movetime_ms=new_mt,
        num_pvs=min(multi_pv, new_pos.legal_move_count),
    )
    ea = next_mpv.best or EvalResult(score_type="cp", score_value=0.0, eval_cp=0.0)
    return ea, next_mpv


def _recover_engine(
    engine: StockfishEngine,
    moves: List[MoveInput],
    failed_idx: int,
    multi_pv: int,
    restart_count: int,
) -> Optional[Tuple[EvalResult, MultiPVResult]]:
    if restart_count >= Thresholds.MAX_RESTART_ATTEMPTS:
        return None
    try:
        engine.restart_engine()
        engine.replay_moves(moves, failed_idx + 1)
        is_white_turn = engine.board.turn == chess.WHITE
        new_pos = analyze_position_info(engine.board, None, is_white_turn)
        new_mt = engine.get_movetime(new_pos)
        mpv = engine.evaluate_position(
            movetime_ms=new_mt,
            num_pvs=min(multi_pv, new_pos.legal_move_count),
        )
        ev = mpv.best or EvalResult(eval_cp=0.0)
        return ev, mpv
    except Exception as e:
        return None


def _recover_from_timeout(
    engine: StockfishEngine,
    move: MoveInput,
    moves: List[MoveInput],
    failed_idx: int,
    multi_pv: int,
) -> Optional[Tuple[EvalResult, MultiPVResult]]:
    try:
        engine._send("stop")
        time.sleep(0.5)
        engine._send("isready")
        engine._wait_for("readyok", timeout_override=5.0)

        chess_m = chess.Move.from_uci(move.uci)
        if chess_m in engine.board.legal_moves:
            engine.push_move(move.uci)

        is_white_turn = engine.board.turn == chess.WHITE
        new_pos = analyze_position_info(engine.board, None, is_white_turn)
        new_mt = max(engine.get_movetime(new_pos), Thresholds.FALLBACK_MOVETIME_MS)
        mpv = engine.evaluate_position(
            movetime_ms=new_mt,
            num_pvs=min(multi_pv, new_pos.legal_move_count),
        )
        ev = mpv.best or EvalResult(eval_cp=0.0)
        return ev, mpv
    except Exception as e:
        return _recover_engine(engine, moves, failed_idx, multi_pv, 0)


def _make_fallback_result(mi: MoveInput, board: chess.Board) -> AnalysisResult:
    try:
        is_white_turn = board.turn == chess.WHITE
        pos = analyze_position_info(board, None, is_white_turn)
        phase = pos.phase.value
    except Exception:
        phase = "middlegame"

    return AnalysisResult(
        move_number=mi.move_number, side=mi.side, san=mi.san, uci=mi.uci,
        eval_before=None, eval_after=None, delta=None,
        mate_before=None, mate_after=None,
        # Use GOOD as a neutral fallback — not Best (inflates accuracy),
        # not Blunder (unfair). accuracy=None excludes it from the average.
        label=MoveQuality.GOOD.value, best_move=None,
        accuracy=None, phase=phase,
    )


# ============================================================
# Input Parsing
# ============================================================
def _validate_moves(moves: list) -> List[MoveInput]:
    validated: List[MoveInput] = []
    for i, m in enumerate(moves):
        try:
            if isinstance(m, MoveInput):
                validated.append(m)
            elif isinstance(m, dict):
                validated.append(MoveInput(
                    move_number=m["move_number"], side=m["side"],
                    san=m.get("san", ""), uci=m["uci"],
                ))
            else:
                raise ValueError("Expected dict or MoveInput")
        except (ValueError, KeyError) as e:
            raise ValueError(f"Invalid move at index {i}: {e}") from e
    return validated


def _build_summary(
    results: List[AnalysisResult],
    w_acc: List[float],
    b_acc: List[float],
) -> Dict:
    def count_labels(labels: List[str]) -> Dict[str, int]:
        return {
            q.value: labels.count(q.value)
            for q in MoveQuality
            if labels.count(q.value) > 0
        }

    w_labels = [r.label for r in results if r.side == "white"]
    b_labels = [r.label for r in results if r.side == "black"]
    all_labels = [r.label for r in results]

    # Critical moments: all high-impact labels + positionally critical moves
    critical_label_set = {
        MoveQuality.BRILLIANT.value,
        MoveQuality.GREAT.value,
        MoveQuality.BLUNDER.value,
        MoveQuality.MISSED_WIN.value,
        MoveQuality.MISTAKE.value,   # Mistakes are also turning points
    }
    critical = [
        {
            "move_number": r.move_number,
            "side": r.side,
            "san": r.san,
            "label": r.label,
            "delta": r.delta,
            "eval_before": r.eval_before,
            "eval_after": r.eval_after,
            "win_percent_before": r.win_percent_before,
            "win_percent_after": r.win_percent_after,
        }
        for r in results
        if r.is_critical or r.label in critical_label_set
    ]

    # Opening = the last book/opening-named move (deepest theory reached)
    # This correctly picks the most specific opening name (e.g. "Ruy Lopez, Berlin Defense"
    # rather than just "Ruy Lopez" from move 1)
    opening = None
    for r in results:
        if r.opening:
            opening = r.opening
        # Stop updating once we leave the opening phase
        if r.phase and r.phase != "opening":
            break

    def mean_accuracy(acc_list: List[float]) -> float:
        if not acc_list:
            return 0.0
        return round(sum(acc_list) / len(acc_list), 1)

    # Game-level stats: count of each phase per side
    def count_phases(side: str) -> Dict[str, int]:
        phases = [r.phase for r in results if r.side == side and r.phase]
        return {p: phases.count(p) for p in set(phases)}

    return {
        "total_moves": len(results),
        "opening": opening,
        "accuracy": {
            "white": mean_accuracy(w_acc),
            "black": mean_accuracy(b_acc),
        },
        "white": count_labels(w_labels),
        "black": count_labels(b_labels),
        "combined": count_labels(all_labels),
        "critical_moments": critical,
        "phases": {
            "white": count_phases("white"),
            "black": count_phases("black"),
        },
    }


def parse_pgn(pgn_text: str) -> List[MoveInput]:
    if len(pgn_text.encode("utf-8")) > settings.PGN_MAX_SIZE_BYTES:
        raise ValueError(f"PGN exceeds maximum size of {settings.PGN_MAX_SIZE_BYTES} bytes")
    if pgn_text.count("{") > settings.PGN_MAX_COMMENTS:
        raise ValueError(f"PGN contains too many comments (max {settings.PGN_MAX_COMMENTS})")

    try:
        game = chess.pgn.read_game(io.StringIO(pgn_text))
    except Exception as e:
        raise ValueError(f"PGN error: {e}") from e
    if game is None:
        raise ValueError("No game found in PGN")

    moves: List[MoveInput] = []
    board = game.board()

    for node in game.mainline():
        move = node.move
        if move is None:
            continue
        try:
            san = board.san(move)
        except Exception:
            san = move.uci()

        moves.append(MoveInput(
            move_number=board.fullmove_number,
            side="white" if board.turn == chess.WHITE else "black",
            san=san, uci=move.uci(),
        ))
        board.push(move)

    if not moves or len(moves) < 10:
        print(f"⚠️ PGN mainline yielded only {len(moves)} moves. Attempting manual parse...")
        manual = _parse_pgn_manual(pgn_text)
        if len(manual) > len(moves):
            return manual

    return moves


def _parse_pgn_manual(pgn_text: str) -> List[MoveInput]:
    lines = pgn_text.strip().split("\n")
    move_lines = []
    in_moves = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("["):
            continue
        if stripped:
            in_moves = True
        if in_moves:
            move_lines.append(stripped)
    move_text = " ".join(move_lines)

    move_text = re.sub(r"\{[^}]*\}", "", move_text)
    move_text = re.sub(r"\([^)]*\)", "", move_text)
    move_text = re.sub(r"(1-0|0-1|1/2-1/2|\*)\s*$", "", move_text)

    tokens = re.findall(
        r"([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)",
        move_text,
    )

    board = chess.Board()
    moves: List[MoveInput] = []

    for token in tokens:
        resolved = _resolve_san(board, token)
        if resolved is None:
            break
        try:
            san = board.san(resolved)
        except Exception:
            san = token

        moves.append(MoveInput(
            move_number=board.fullmove_number,
            side="white" if board.turn == chess.WHITE else "black",
            san=san, uci=resolved.uci(),
        ))
        board.push(resolved)

    return moves


def _resolve_san(board: chess.Board, san: str) -> Optional[chess.Move]:
    try:
        return board.parse_san(san)
    except (ValueError, chess.InvalidMoveError, chess.AmbiguousMoveError):
        pass

    candidates = []
    for move in board.legal_moves:
        try:
            move_san = board.san(move)
            if move_san == san:
                return move
            if _san_matches(san, move_san, board, move):
                candidates.append(move)
        except Exception:
            continue

    if len(candidates) == 1:
        return candidates[0]

    if san in ("O-O", "O-O-O"):
        for move in board.legal_moves:
            if board.is_castling(move):
                move_san = board.san(move)
                if move_san.replace("+", "").replace("#", "") == san:
                    return move

    return candidates[0] if candidates else None


def _san_matches(
    input_san: str, actual_san: str,
    board: chess.Board, move: chess.Move,
) -> bool:
    clean_input = input_san.replace("+", "").replace("#", "").replace("x", "")
    clean_actual = actual_san.replace("+", "").replace("#", "").replace("x", "")

    if len(clean_input) >= 2:
        dest = clean_input[-2:]
        actual_dest = clean_actual[-2:]
        if dest != actual_dest:
            return False
        input_piece = clean_input[0] if clean_input[0].isupper() else ""
        actual_piece = clean_actual[0] if clean_actual[0].isupper() else ""
        if input_piece != actual_piece:
            return False
        return True
    return False


def parse_uci_moves(uci_string: str) -> List[MoveInput]:
    board = chess.Board()
    moves: List[MoveInput] = []
    for token in uci_string.strip().split():
        try:
            m = chess.Move.from_uci(token)
        except ValueError as e:
            raise ValueError(f"Bad UCI '{token}': {e}") from e
        if m not in board.legal_moves:
            raise IllegalMoveError(f"Illegal {token} at {board.fen()}")
        moves.append(MoveInput(
            move_number=board.fullmove_number,
            side="white" if board.turn == chess.WHITE else "black",
            san=board.san(m), uci=token,
        ))
        board.push(m)
    return moves