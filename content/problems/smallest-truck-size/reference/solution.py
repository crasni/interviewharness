def smallest_truck(weights: list[int], days: int) -> int:
    def days_needed(capacity: int) -> int:
        trips, load = 1, 0
        for weight in weights:
            if load + weight > capacity:
                trips, load = trips + 1, 0
            load += weight
        return trips

    low, high = max(weights), sum(weights)
    while low < high:
        middle = (low + high) // 2
        if days_needed(middle) <= days:
            high = middle
        else:
            low = middle + 1
    return low
