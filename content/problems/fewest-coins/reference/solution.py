def fewest_coins(coins: list[int], amount: int) -> int:
    cannot = amount + 1  # more coins than any real answer could need
    fewest = [0] + [cannot] * amount
    for total in range(1, amount + 1):
        for coin in coins:
            if coin <= total:
                fewest[total] = min(fewest[total], fewest[total - coin] + 1)
    return fewest[amount] if fewest[amount] != cannot else -1
