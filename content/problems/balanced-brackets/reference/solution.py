def is_balanced(s: str) -> bool:
    opening_for = {")": "(", "]": "[", "}": "{"}
    open_brackets: list[str] = []
    for char in s:
        if char in opening_for:
            if not open_brackets or open_brackets.pop() != opening_for[char]:
                return False
        else:
            open_brackets.append(char)
    return not open_brackets
