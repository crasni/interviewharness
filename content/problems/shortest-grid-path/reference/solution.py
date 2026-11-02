from collections import deque


def shortest_path(grid: list[str]) -> int:
    rows, columns = len(grid), len(grid[0])
    if grid[0][0] == "#" or grid[-1][-1] == "#":
        return -1
    steps_to = {(0, 0): 0}
    queue = deque([(0, 0)])
    while queue:
        row, column = queue.popleft()
        if (row, column) == (rows - 1, columns - 1):
            return steps_to[(row, column)]
        for next_row, next_column in ((row + 1, column), (row - 1, column), (row, column + 1), (row, column - 1)):
            if (
                0 <= next_row < rows
                and 0 <= next_column < columns
                and grid[next_row][next_column] == "."
                and (next_row, next_column) not in steps_to
            ):
                steps_to[(next_row, next_column)] = steps_to[(row, column)] + 1
                queue.append((next_row, next_column))
    return -1
