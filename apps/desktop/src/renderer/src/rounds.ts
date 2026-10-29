import type { CodingPhase, RoundKind } from '@interviewharness/core';

export const roundKinds: { kind: RoundKind; label: string; startLabel: string; available: boolean }[] = [
  { kind: 'coding', label: 'Coding round', startLabel: 'Start coding round', available: true },
  { kind: 'system-design', label: 'System design round', startLabel: 'Start system design round', available: false },
  { kind: 'ai-assisted', label: 'AI-assisted round', startLabel: 'Start AI-assisted round', available: false },
];

export function roundLabel(kind: RoundKind) {
  return roundKinds.find((r) => r.kind === kind)?.label ?? kind;
}

export const phaseLabels: Record<CodingPhase, string> = {
  clarify: 'Clarify',
  approach: 'Approach',
  code: 'Code',
  test: 'Test',
  complexity: 'Complexity',
  'wrap-up': 'Wrap-up',
};
