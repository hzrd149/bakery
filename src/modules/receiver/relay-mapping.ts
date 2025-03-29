import SuperMap from "../../helpers/super-map.js";

// TODO: this is written by AI, it probably needs to be optimized
export function groupPubkeysByRelay(
  directory: Record<string, string[]>,
  minRelaysPerPubkey: number,
  maxRelaysPerPubkey: number,
): Map<string, Set<string>> {
  const relayMap = new SuperMap<string, Set<string>>(() => new Set());
  const pubkeyRelayCount = new Map<string, number>();

  // Sort relays by frequency in the directory to prioritize commonly requested relays
  const relayFrequency = new Map<string, number>();
  for (const relays of Object.values(directory)) {
    for (const relay of relays) {
      relayFrequency.set(relay, (relayFrequency.get(relay) || 0) + 1);
    }
  }

  const sortedRelays = [...relayFrequency.entries()].sort((a, b) => b[1] - a[1]).map(([relay]) => relay);

  // First pass - assign pubkeys to their most frequently requested relays up to max
  for (const [pubkey, requestedRelays] of Object.entries(directory)) {
    pubkeyRelayCount.set(pubkey, 0);

    // Sort requested relays by frequency
    const sortedRequestedRelays = requestedRelays.sort(
      (a, b) => (relayFrequency.get(b) || 0) - (relayFrequency.get(a) || 0),
    );

    for (const relay of sortedRequestedRelays) {
      if (pubkeyRelayCount.get(pubkey)! < maxRelaysPerPubkey) {
        relayMap.get(relay).add(pubkey);
        pubkeyRelayCount.set(pubkey, pubkeyRelayCount.get(pubkey)! + 1);
      }
    }
  }

  // Second pass - ensure minimum relays for each pubkey
  // and balance the distribution across existing relays
  for (const [pubkey, count] of pubkeyRelayCount.entries()) {
    if (count < minRelaysPerPubkey) {
      // Find relays with the lowest number of pubkeys
      const relaysBySize = sortedRelays
        .map((relay) => ({
          relay,
          size: relayMap.get(relay).size,
        }))
        .sort((a, b) => a.size - b.size);

      // Add pubkey to least populated relays until minimum is met
      for (const { relay } of relaysBySize) {
        if (pubkeyRelayCount.get(pubkey)! >= minRelaysPerPubkey) break;

        if (!relayMap.get(relay).has(pubkey)) {
          relayMap.get(relay).add(pubkey);
          pubkeyRelayCount.set(pubkey, pubkeyRelayCount.get(pubkey)! + 1);
        }
      }
    }
  }

  // Third pass - optimize relay usage by redistributing from sparsely populated relays
  const SPARSE_THRESHOLD = Math.min(2, Object.keys(directory).length * 0.1);

  for (const [relay, pubkeys] of relayMap.entries()) {
    if (pubkeys.size <= SPARSE_THRESHOLD) {
      for (const pubkey of pubkeys) {
        // Find more populated relays that don't have this pubkey
        const betterRelays = sortedRelays
          .filter((r) => r !== relay && !relayMap.get(r).has(pubkey) && relayMap.get(r).size > SPARSE_THRESHOLD)
          .sort((a, b) => relayMap.get(a).size - relayMap.get(b).size);

        // If we found a better relay and we're still above minRelaysPerPubkey
        if (betterRelays.length > 0 && pubkeyRelayCount.get(pubkey)! > minRelaysPerPubkey) {
          // Remove from sparse relay
          pubkeys.delete(pubkey);
          pubkeyRelayCount.set(pubkey, pubkeyRelayCount.get(pubkey)! - 1);

          // Add to better utilized relay
          const betterRelay = betterRelays[0];
          relayMap.get(betterRelay).add(pubkey);
          pubkeyRelayCount.set(pubkey, pubkeyRelayCount.get(pubkey)! + 1);
        }
      }
    }
  }

  // Remove any relays that have no pubkeys
  for (const [relay, pubkeys] of relayMap.entries()) {
    if (pubkeys.size === 0) {
      relayMap.delete(relay);
    }
  }

  return relayMap;
}
