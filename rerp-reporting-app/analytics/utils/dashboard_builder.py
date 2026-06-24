"""
dashboard_builder.py

Transforms raw chat messages (from the DB via format_chat_message) into the
five data structures the AskMe Analytics Dashboard expects.

This is the Python equivalent of scripts/parseNewLogs.js in the dashboard repo.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Optional

# ── Constants ─────────────────────────────────────────────────────────────────

MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

# Accounts that should never appear in dashboard metrics
EXCLUDED_USERS = {'QUADDEBUG'}

# ── Question category classifiers ─────────────────────────────────────────────

_DATA_QUERY_RE    = re.compile(r'\b(show|list|how many|total|count|give me|display|what is|average|sum|report)\b', re.I)
_PROCESS_RE       = re.compile(r'\b(how to|what is the process|steps to|procedure|explain|guide|process for)\b', re.I)
_TRANSACTIONAL_RE = re.compile(r'\b(create|update|delete|post|submit|approve|reject|record|enter|add new)\b', re.I)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_display_date(raw) -> str:
    """Normalise any date value to DD-MM-YYYY string."""
    if raw is None:
        return ''
    if isinstance(raw, datetime):
        return raw.strftime('%d-%m-%Y')
    s = str(raw).strip()
    if not s:
        return ''
    # Already DD-MM-YYYY
    if re.match(r'^\d{1,2}-\d{1,2}-\d{4}$', s):
        return s
    # YYYY-MM-DD (ISO)
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # MM/DD/YYYY
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', s)
    if m:
        return f"{m.group(2).zfill(2)}-{m.group(1).zfill(2)}-{m.group(3)}"
    return s


def _month_from_date(date_str: str) -> str:
    """Convert DD-MM-YYYY to Mon-YYYY (e.g. '17-06-2026' → 'Jun-2026')."""
    if not date_str:
        return ''
    m = re.match(r'^(\d{1,2})-(\d{1,2})-(\d{4})$', date_str)
    if m:
        idx = int(m.group(2)) - 1
        if 0 <= idx < 12:
            return f"{MONTH_NAMES[idx]}-{m.group(3)}"
    return ''


def _parse_response_generation(s: str) -> Optional[dict]:
    """Parse Python-dict-style response_generation string into a dict."""
    if not s or s == 'undefined':
        return None
    try:
        cleaned = (
            s.replace("'", '"')
             .replace('\\n', ' ')
        )
        cleaned = re.sub(r'\bFalse\b', 'false', cleaned)
        cleaned = re.sub(r'\bTrue\b',  'true',  cleaned)
        cleaned = re.sub(r'\bNone\b',  'null',  cleaned)
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)
        return json.loads(cleaned)
    except Exception:
        return None


def _infer_bot_type(rg: Optional[dict]) -> str:
    if not rg or not isinstance(rg.get('token_usage'), dict):
        return ''
    if any('sql' in step for step in rg['token_usage']):
        return 'NLSQLAgent'
    return ''


def _infer_module(rg: Optional[dict]) -> str:
    if not rg:
        return ''
    return (
        rg.get('modulename')
        or (rg.get('token_usage') or {}).get('modulename')
        or ''
    )


def _classify_question(message: str) -> str:
    if not message:
        return 'Unclassified'
    if _TRANSACTIONAL_RE.search(message):
        return 'Transactional'
    if _PROCESS_RE.search(message):
        return 'Process/How-To'
    if _DATA_QUERY_RE.search(message):
        return 'Data Query'
    return 'Unclassified'


def _parse_ts(raw) -> Optional[datetime]:
    """Parse a raw timestamp value to a datetime (for response-time calc)."""
    if isinstance(raw, datetime):
        return raw
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace('Z', '+00:00'))
    except Exception:
        return None


# ── Main builder ──────────────────────────────────────────────────────────────

def build_dashboard_data(messages: list[dict]) -> dict:
    """
    Transform a list of FormattedChatMessage dicts (from format_chat_message)
    into the five data arrays the AskMe Analytics Dashboard expects.

    Args:
        messages: List of dicts produced by format_chat_message().

    Returns:
        Dict with keys: cleaned, llm_steps, token_usage, response_times, flat_table.
        Each value is a list of dicts matching the column structure of the
        corresponding Excel sheet in AskQ_Master_Dashboard.xlsx.
    """
    # Filter excluded users
    messages = [m for m in messages if m.get('user_name', '') not in EXCLUDED_USERS]

    # Group by session + sort by timestamp for response-time calculation
    by_session: dict[str, list[dict]] = {}
    for msg in messages:
        sid = msg.get('chat_message_session_id', '')
        by_session.setdefault(sid, []).append(msg)
    for msgs in by_session.values():
        msgs.sort(key=lambda x: str(x.get('chat_message_created_at') or ''))

    cleaned: list[dict]       = []
    llm_steps: list[dict]     = []
    token_usage: list[dict]   = []
    response_times: list[dict] = []
    flat_table: list[dict]    = []

    for msg in messages:
        session_id   = msg.get('chat_message_session_id', '')
        sender_raw   = (msg.get('chat_message_sender_type') or '').lower()
        sender_type  = 'bot' if sender_raw == 'bot' else 'Human'
        is_bot       = sender_type == 'bot'
        raw_date     = msg.get('chat_message_created_at', '')
        date_str     = _to_display_date(raw_date)
        month        = _month_from_date(date_str)
        message_text = msg.get('chat_message_text') or ''
        user_name    = msg.get('user_name') or ''
        rg           = _parse_response_generation(msg.get('response_generation') or '')
        module       = _infer_module(rg)
        bot_type     = _infer_bot_type(rg) if is_bot else ''
        query_failed = 1 if rg and rg.get('query_exce_failed_status') is True else 0
        category     = '' if is_bot else _classify_question(message_text)
        feedback_raw = (msg.get('feedback') or '').upper()
        feedback     = feedback_raw if feedback_raw in ('LIKE', 'DISLIKE') else ''

        # ── AskQ_Cleaned ──────────────────────────────────────────────────────
        cleaned.append({
            'Date':                  date_str,
            'Month':                 month,
            'Session_ID':            session_id,
            'Sender_Type':           sender_type,
            'Human_Message_Flag':    0 if is_bot else 1,
            'Bot_Message_Flag':      1 if is_bot else 0,
            'User_Name':             '' if is_bot else user_name,
            'User_Display':          '' if is_bot else user_name,
            'Bot_Type':              bot_type,
            'Message':               message_text,
            'Question_Category':     category,
            'Feedback':              feedback,
            'Is_User_Question_Flag': 0 if is_bot else 1,
            'Is_System_Error':       query_failed if is_bot else 0,
            'Is_Issue':              query_failed if is_bot else 0,
            'user_name':             user_name,
            'chat_message_sender_id': msg.get('chat_message_sender_id') or '',
        })

        if not is_bot:
            continue

        # ── LLM steps + token aggregation ─────────────────────────────────────
        tu = rg.get('token_usage') if rg else None
        if isinstance(tu, dict):
            total_prompt = total_completion = total_all = 0

            for step_name, step_data in tu.items():
                if not isinstance(step_data, dict) or 'total_tokens' not in step_data:
                    continue
                prompt     = step_data.get('prompt_tokens', 0) or 0
                completion = step_data.get('completion_tokens', 0) or 0
                total      = step_data.get('total_tokens', 0) or 0

                llm_steps.append({
                    'Session_ID':        session_id,
                    'Month':             month,
                    'Module':            module,
                    'Bot_Type':          bot_type,
                    'LLM_Step':          step_name,
                    'Prompt_Tokens':     prompt,
                    'Completion_Tokens': completion,
                    'Total_Tokens':      total,
                })
                total_prompt     += prompt
                total_completion += completion
                total_all        += total

            if total_all > 0:
                token_usage.append({
                    'Session_ID':        session_id,
                    'Month':             month,
                    'Module_Clean':      module,
                    'Bot_Type':          bot_type,
                    'Prompt_Tokens':     total_prompt,
                    'Completion_Tokens': total_completion,
                    'Total_Tokens':      total_all,
                })

        # ── AskQ_ResponseTime — user→bot timestamp delta ─────────────────────
        session_msgs = by_session.get(session_id, [])
        this_index   = next((i for i, m in enumerate(session_msgs) if m is msg), -1)
        if this_index > 0:
            prev = session_msgs[this_index - 1]
            prev_is_user = (prev.get('chat_message_sender_type') or '').lower() != 'bot'
            if prev_is_user:
                t0 = _parse_ts(prev.get('chat_message_created_at_raw') or prev.get('chat_message_created_at'))
                t1 = _parse_ts(msg.get('chat_message_created_at_raw') or msg.get('chat_message_created_at'))
                if t0 and t1:
                    diff_sec = (t1 - t0).total_seconds()
                    if 0 < diff_sec < 300:
                        response_times.append({
                            'Session_ID':            session_id,
                            'Month':                 month,
                            'Bot_Type':              bot_type,
                            'Response_Time_Seconds': round(diff_sec, 1),
                        })

        # ── PowerBI_Flat_Table ────────────────────────────────────────────────
        flat_table.append({
            'Session_ID':          session_id,
            'Month':               month,
            'Module':              module,
            'Bot_Type':            bot_type,
            'Is_Issue':            query_failed,
            'Is_System_Error':     query_failed,
            'Is_KB_Gap':           0,
            'Is_Placeholder_Data': 0,
            'Is_Copilot_Loop':     0,
            'Is_Context_Drop':     0,
        })

    return {
        'cleaned':        cleaned,
        'llm_steps':      llm_steps,
        'token_usage':    token_usage,
        'response_times': response_times,
        'flat_table':     flat_table,
    }
