import type { ScriptedCandidate } from '@interviewharness/engine/scripted-candidate';

// Scripted candidates for Two sum. Their lines are fixed: they don't react to what the interviewer says,
// so read each round for what the interviewer did with the same moves, not for a natural conversation.

const minute = 60_000;

const bruteForce = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
`;

const withMap = `def two_sum(nums, target):
    index_of = {}
    for i, n in enumerate(nums):
        want = target - n
        if want in index_of:
            return [index_of[want], i]
        index_of[n] = i
`;

// Stores each value before looking for its partner, so a value half the target pairs with itself.
const storesFirst = `def two_sum(nums, target):
    index_of = {}
    for i, n in enumerate(nums):
        index_of[n] = i
        if target - n in index_of:
            return [index_of[target - n], i]
`;

export const scriptedCandidates: ScriptedCandidate[] = [
  {
    name: 'silent',
    about:
      'Silent for long stretches, then working fine. Check-ins should be neutral and rare, never a hint, and nothing should be asked of their testing or complexity just because they left it out.',
    steps: [
      { silentFor: 4 * minute },
      { say: 'Sorry, I was reading it again. I think a dictionary from value to index works, one pass.' },
      { silentFor: 3 * minute },
      { typeFor: 4 * minute, code: withMap },
      { silentFor: 6 * minute },
      { say: 'Okay. I think this is it.' },
      { silentFor: 3 * minute },
    ],
  },
  {
    name: 'stuck-says-so',
    about:
      "Stuck and says so, turns down help once, later asks for a small hint. Being stuck allows one neutral question, then waiting; the turned-down help shouldn't come back unasked; the hint asked for should be small and leave the work to them.",
    steps: [
      { say: 'Can I assume there is always exactly one answer?' },
      { silentFor: 1 * minute },
      { say: "Hmm. I'm stuck. All I can think of is checking every pair, which is slow." },
      { say: "No, don't tell me yet, let me think a bit more." },
      { silentFor: 3 * minute },
      { typeFor: 2 * minute, code: bruteForce },
      { say: 'I wrote the slow version with two loops. Could you give me a small hint toward something faster?' },
      { silentFor: 2 * minute },
      { say: 'Oh, so I remember what I have already seen. Let me rewrite it.' },
      { typeFor: 3 * minute, code: withMap },
      { say: 'Done, this is one pass now.' },
    ],
  },
  {
    name: 'buggy-asks-help',
    about:
      "Writes code with a bug, tests it themselves, can't find it and asks for help. Before the request, the bug must not be named; after it, help should fit the request and leave the fix to them.",
    steps: [
      { say: "I'll use a dictionary of values I've seen and look up target minus the current value." },
      { typeFor: 3 * minute, code: storesFirst },
      { say: 'Let me try the second example, five one five with target ten. That gives zero and two, good.' },
      { typeFor: 30_000 },
      { say: 'Now six three nine with target twelve. I get zero and zero? That is wrong and I am not sure why.' },
      { silentFor: 1 * minute },
      { say: "I've looked at it for a while and I don't see it. Can you help me find what is wrong?" },
      { silentFor: 1 * minute },
      { say: 'Oh, I put the value in before I check for its partner. If I swap those two lines it works.' },
      { typeFor: 1 * minute, code: withMap },
      { say: 'Fixed. Six three nine gives one and two now.' },
    ],
  },
  {
    name: 'finishes-early',
    about:
      'Finishes everything well inside the time. Follow-ups should be asked one at a time after they say they are done, then the round should close naturally, with no work made up to fill the clock.',
    steps: [
      { say: 'Can values repeat, and does the order of the two indexes matter?' },
      { say: "Okay. I'd keep a dictionary from value to index, and for each number look up target minus it. Linear time." },
      { typeFor: 2 * minute, code: withMap },
      { say: 'Checking example one: three, nine, fourteen, two with eleven. At two, nine is in the map at index one, so one and three.' },
      { say: 'It is O(n) time and O(n) space for the dictionary. I think I am done.' },
      { say: "If the list were sorted, I'd use two pointers from both ends and get constant space." },
      { say: 'That is all I have. Thanks!' },
      { silentFor: 2 * minute },
    ],
  },
  {
    name: 'fishing',
    about:
      "Guesses at the approach to get it confirmed instead of reasoning it out or asking for a hint. A fishing guess counts as asking for help: it may get the next rung, counted as a hint taken, but never a yes or no on the idea and never more than one rung at a time.",
    steps: [
      { say: 'Is the trick something with sorting first?' },
      { silentFor: 1 * minute },
      { say: 'Or would a hash map help here?' },
      { silentFor: 1 * minute },
      { say: 'So I should store what I have seen, right? Like value to index?' },
      { typeFor: 3 * minute, code: withMap },
      { say: 'Done. Five one five with ten gives zero and two.' },
      { silentFor: 1 * minute },
    ],
  },
  {
    name: 'works-through-everything',
    about:
      "Clarifies, explains, codes, tests and gives complexity, all without being asked. The interviewer should mostly listen and acknowledge, and never ask again for anything they've already covered.",
    steps: [
      { say: 'Before I start: the list has at least two numbers, and exactly one pair works, right?' },
      { silentFor: 30_000 },
      { say: 'The brute force checks every pair, O(n squared). Better: one pass with a dictionary from value to index.' },
      { say: "I'll look up the partner before storing the current value, so a number never pairs with itself." },
      { typeFor: 3 * minute, code: withMap },
      { say: "Okay, that's the code. Now testing." },
      { say: 'Example two, five one five with ten: at index two, five is in the map at zero, so zero and two. Correct.' },
      { say: 'Six three nine with twelve: six alone is never matched with itself, and at nine I find three, so one and two.' },
      { say: 'Time is O(n), one pass with constant-time lookups. Space is O(n) for the dictionary.' },
      { say: "I'm happy with it." },
      { silentFor: 1 * minute },
    ],
  },
];
