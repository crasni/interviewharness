// Pure domain types. No I/O, no imports from other packages.

export const ROUND_KINDS = ['coding', 'system-design', 'ai-assisted'] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

export const CODING_PHASES = ['clarify', 'approach', 'code', 'test', 'complexity', 'wrap-up'] as const;
export type CodingPhase = (typeof CODING_PHASES)[number];
