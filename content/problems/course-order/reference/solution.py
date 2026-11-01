from collections import deque


def course_order(count: int, prerequisites: list[list[int]]) -> list[int]:
    unlocks: list[list[int]] = [[] for _ in range(count)]
    waiting_on = [0] * count
    for course, before in prerequisites:
        unlocks[before].append(course)
        waiting_on[course] += 1
    ready = deque(course for course in range(count) if waiting_on[course] == 0)
    order: list[int] = []
    while ready:
        course = ready.popleft()
        order.append(course)
        for next_course in unlocks[course]:
            waiting_on[next_course] -= 1
            if waiting_on[next_course] == 0:
                ready.append(next_course)
    return order if len(order) == count else []
