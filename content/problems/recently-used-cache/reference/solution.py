class Node:
    def __init__(self, key: int = 0, value: int = 0):
        self.key, self.value = key, value
        self.prev: "Node | None" = None
        self.next: "Node | None" = None


class RecentCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.nodes: dict[int, Node] = {}
        # Sentinels: oldest.next is the pair used longest ago, newest.prev the one used last.
        self.oldest, self.newest = Node(), Node()
        self.oldest.next, self.newest.prev = self.newest, self.oldest

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._add_newest(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        node = self.nodes.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
        else:
            if len(self.nodes) == self.capacity:
                dropped = self.oldest.next
                self._unlink(dropped)
                del self.nodes[dropped.key]
            node = Node(key, value)
            self.nodes[key] = node
        self._add_newest(node)

    def _unlink(self, node: Node) -> None:
        node.prev.next, node.next.prev = node.next, node.prev

    def _add_newest(self, node: Node) -> None:
        node.prev, node.next = self.newest.prev, self.newest
        self.newest.prev.next = node
        self.newest.prev = node
