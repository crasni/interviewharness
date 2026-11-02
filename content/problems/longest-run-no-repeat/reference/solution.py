def longest_run(s: str) -> int:
    last_seen: dict[str, int] = {}
    left = 0
    longest = 0
    for right, letter in enumerate(s):
        if last_seen.get(letter, -1) >= left:
            left = last_seen[letter] + 1
        last_seen[letter] = right
        longest = max(longest, right - left + 1)
    return longest
