import heapq


def closest_stores(stores: list[list[int]], home: list[int], k: int) -> list[list[int]]:
    farthest_first: list[tuple[int, int]] = []
    for index, (x, y) in enumerate(stores):
        squared = (x - home[0]) ** 2 + (y - home[1]) ** 2
        heapq.heappush(farthest_first, (-squared, index))
        if len(farthest_first) > k:
            heapq.heappop(farthest_first)
    return [stores[index] for _, index in farthest_first]
