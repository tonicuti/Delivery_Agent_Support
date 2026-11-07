"""Decide from the question which read-only facts to look up; no model involved."""

import re
import sqlite3

from .prompts import MAX_STEPS

LIST_WORDS = re.compile(r"which orders?|all orders|highest|riskiest|cao nhất|work ?list|queue|attention|brief|priorit|urgent|most at risk|high.?risk|"
                        r"\bfirst\b|\btoday\b|shift|(who|what)('s| is| are)? at risk|ưu tiên|khẩn|danh sách|đơn nào|"
                        r"cần xử lý|rủi ro cao", re.I)
KPI_WORDS = re.compile(r"decision|how (are|is) (we|it|things)|kpi|statistic|numbers|progress|performance|so far|"
                       r"quyết định|thống kê|tiến độ", re.I)
WAREHOUSE_WORDS = re.compile(r"warehouse|picking|backlog|workload|\bkho\b", re.I)
DATA_WORDS = re.compile(r"risk|late|delay|order|ship|stock|deliver|promise|alert|\beta\b|arriv|why|flag|action|do about|"
                        r"recommend|suggest|status|truck|route|customer|detail|analy|explain|chi tiết|phân tích|giải thích|rủi ro|trễ|giao|đơn|hàng|kho|cảnh báo|tại sao|vì sao", re.I)
REFERS_BACK = re.compile(r"\b(it|this|that|them|its|more)\b|nó|này|đó|thêm|rõ hơn|tiếp", re.I)
SMALL_TALK = re.compile(r"^\W*(hi|hello|hey|yo|thanks?|thank you|ok(ay)?|bye|good (morning|afternoon|evening)|"
                        r"xin chào|chào|cảm ơn|cám ơn|tạm biệt|hej|tack)\b", re.I)
SAFEST_WORDS = re.compile(r"lowest|safest|least (at )?risk|least likely|low.?risk|thấp nhất|an toàn nhất|ít rủi ro", re.I)
ORDER_NUMBER = re.compile(r"(?<![\d.:])(\d{3,})(?![\d:])")
# A number right after the word order ('ORDER-77') is an order reference however short it is.
PREFIXED_ORDER = re.compile(r"\b(?:order|ord|đơn|don)[\s#:-]*(\d+)\b", re.I)
REGION_IN_QUESTION = re.compile(r"\borders?\s+(?:in|from|at)\s+([^\W\d_]+)|\b(?:đơn|don)\s+(?:ở|tại|o|tai)\s+([^\W\d_]+)", re.I)
NOT_A_REGION = {"the", "a", "my", "our", "risk", "total", "general", "order", "orders", "stock", "transit", "progress", "time"}


def find_order(db: sqlite3.Connection, text: str) -> int | None:
    for number in ORDER_NUMBER.findall(text):
        row = db.execute("""SELECT order_id FROM customer_order
                            WHERE order_id = ? OR external_order_id LIKE ?""", (int(number), f"%{number}")).fetchone()
        if row:
            return row["order_id"]
    return None


def _order_from_context(db: sqlite3.Connection, history: list[dict], scope_order: int | None) -> int | None:
    """The order discussed earlier in the conversation, else the one open on screen."""
    for earlier in reversed(history[:-1]):
        if earlier["role"] == "user" and (order := find_order(db, earlier["content"])):
            return order
    return scope_order


def plan(db: sqlite3.Connection, question: str, history: list[dict], scope_order: int | None) -> tuple[list[str], int | None]:
    """Choose what to read. Greetings and general chat read nothing; order questions read that order,
    the one discussed earlier or the one on screen; other order questions read the worklist."""
    asks_safest = bool(SAFEST_WORDS.search(question))
    asks_list = bool(LIST_WORDS.search(question)) or asks_safest
    asks_kpi = bool(KPI_WORDS.search(question))
    asks_warehouse = bool(WAREHOUSE_WORDS.search(question))
    named = find_order(db, question)
    about_orders = bool(DATA_WORDS.search(question))
    chatting = bool(SMALL_TALK.match(question)) and not (named or asks_list or asks_kpi or asks_warehouse)
    order = named
    if order is None and not chatting and not asks_list and (about_orders or REFERS_BACK.search(question)):
        order = _order_from_context(db, history, scope_order)
    steps: list[str] = []
    if order is not None:
        steps.append("order")
    elif asks_safest:
        steps.append("safest")
    elif asks_list or (about_orders and not (asks_kpi or asks_warehouse)):
        steps.append("worklist")
    if asks_kpi:
        steps.append("kpis")
    if asks_warehouse:
        steps.append("warehouse")
    return steps[:MAX_STEPS], order


def unresolved_order_number(db: sqlite3.Connection, text: str) -> str | None:
    """A number that looks like an order but matches none: a typo must be told, not answered with another order."""
    numbers = PREFIXED_ORDER.findall(text) or ORDER_NUMBER.findall(text)
    if not numbers:
        return None
    return numbers[0] if len(numbers[0]) < 3 or find_order(db, numbers[0]) is None else None


def region_in_question(text: str) -> str | None:
    """'orders in Stockholm' -> 'Stockholm'. Whether the region exists is for the lookup to say."""
    match = REGION_IN_QUESTION.search(text)
    word = next((g for g in match.groups() if g), None) if match else None
    return word if word and word.lower() not in NOT_A_REGION else None


def is_overview_question(db: sqlite3.Connection, question: str) -> bool:
    """Asks about the orders as a group ('which has the highest risk?'), not about one named or 'this' order."""
    return (bool(LIST_WORDS.search(question) or SAFEST_WORDS.search(question))
            and find_order(db, question) is None and not REFERS_BACK.search(question))
