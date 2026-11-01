# Recently-used cache: interviewer notes

Never shown to the candidate. The interviewer uses these to answer questions, judge the code and give hints.

## Notes

The key idea: a hash map from each key to a node in a doubly linked list that keeps the pairs in order of use, most recent at one end. `get` finds the node through the map and moves it to the recent end. `put` updates and moves an existing node, or adds a new one at the recent end and, if the cache is now over capacity, removes the node at the other end and its key from the map. Every step is O(1); space is O(capacity). Sentinel head and tail nodes remove the special cases for an empty list. A list or array kept in order of use makes each move O(n).

In Python, `collections.OrderedDict` (with `move_to_end` and `popitem(last=False)`) does the linked-list part. It's a fine answer; then ask how they'd build it themselves, since that's the heart of the question.

Answers to likely questions:

- Both `get` and `put` count as using a key, including a `put` that only changes the value of a key already there.
- A `get` for a missing key returns -1 and changes nothing.
- Putting a key that's already there never drops anything, even in a full cache.
- Capacity is at least 1.
- One thread only; no need for locking.

Common mistakes:

- Not moving a key to the recent end on `get`, so a key that's read often is still dropped.
- Dropping a pair before checking whether the key being put is already there, which loses a pair for nothing.
- Removing a node from the list but not its key from the map, or the other way round.
- Losing the links when moving a node in a doubly linked list (updating `next` but not `prev`).

When the candidate says they're done, a good check is to ask them to trace a cache of capacity 1: `put(1, 1)`, `put(2, 2)`, `get(1)`, `get(2)`.

## Hint ladder

- Nudge: Think about what each call needs to find quickly, and what order it needs to keep.
- Question: A hash map finds a key in O(1). What else would you need to know, also in O(1), to drop the pair used longest ago?
- Concrete: If the pairs sat in a list ordered by use, you'd move one to the end on every call and drop from the front. What kind of list lets you take an item out of the middle in O(1), and how would the map help you find it?

## Follow-ups

- How would you add a time limit, so a pair also expires a fixed time after it was put?
- What if several threads used the cache at once?
- How would you drop the pair used least often instead of longest ago?
