def merge_meetings(meetings: list[list[int]]) -> list[list[int]]:
    busy: list[list[int]] = []
    for start, end in sorted(meetings):
        if busy and start <= busy[-1][1]:
            busy[-1][1] = max(busy[-1][1], end)
        else:
            busy.append([start, end])
    return busy
