from __future__ import annotations

import re


_SPACES = re.compile(r"\s+")
_DETAIL = re.compile(r"\s*(?:\([^)]*\)|(?:지하\s*)?\d+층(?:\s*\d+호)?|\d+호)\s*$")


def normalize_address(value: str) -> str:
    """검색 결과의 주소를 지오코딩하기 좋은 보수적 형태로 정리한다."""
    text = value.strip().replace("，", ",")
    text = _SPACES.sub(" ", text)
    text = _DETAIL.sub("", text)
    return text.strip(" ,")

