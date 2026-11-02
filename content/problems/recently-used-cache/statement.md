# Recently-used cache

Write a class `RecentCache` that keeps up to `capacity` key-value pairs and, when it's full, makes room by dropping the pair that was used longest ago.

- `RecentCache(capacity)` makes an empty cache that holds at most `capacity` pairs.
- `get(key)` returns the value stored for `key`, or `-1` if the cache doesn't have it.
- `put(key, value)` stores `value` for `key`, replacing any value it had. If that adds a pair to a full cache, the pair used longest ago is dropped first.

Both `get` and `put` should take O(1) time on average.

## Example

```
cache = RecentCache(2)
cache.put(1, 10)
cache.put(2, 20)
cache.get(1)      # 10
cache.put(3, 30)  # the cache is full: key 2 was used longest ago, so it's dropped
cache.get(2)      # -1
cache.get(3)      # 30
```

Reading key 1 counted as using it, so key 2 was the one dropped.

## Constraints

- `1 ≤ capacity ≤ 1,000`
- Keys and values are integers, `0 ≤ key, value ≤ 10,000`.
- At most `100,000` calls to `get` and `put` in all.
