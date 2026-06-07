// Quick sanity tests for the poker hand evaluator. Run with:
//   npx tsx lib/handEval.test.mjs
import { findWinners, bestHand, compareHands } from "./handEval.ts";

let failures = 0;

function check(name, ok) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}`);
  }
}

console.log("hand evaluator");

// User-reported scenario:
// Community has a 7, Player 1 has Ace high, Player 2 has a 7 -> pair of 7s.
{
  const community = ["7D", "QS", "JC", "2H", "5D"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["AS", "3C"] },
      { playerId: "p2", holeCards: ["7H", "4C"] },
    ],
    community,
  );
  check(
    "pair of 7s beats ace-high",
    winners.length === 1 && winners[0].playerId === "p2",
  );

  const p1 = bestHand(["AS", "3C"], community);
  const p2 = bestHand(["7H", "4C"], community);
  check("player 1 best is high_card", p1?.category === "high_card");
  check("player 2 best is pair", p2?.category === "pair");
  check("compareHands: pair > high_card", compareHands(p2, p1) > 0);
}

// Higher pair beats lower pair.
{
  const community = ["7D", "QS", "JC", "2H", "5D"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["7H", "3C"] },
      { playerId: "p2", holeCards: ["QH", "4C"] },
    ],
    community,
  );
  check("pair of Qs beats pair of 7s", winners[0].playerId === "p2");
}

// Two pair beats one pair.
{
  const community = ["7D", "QS", "JC", "2H", "5D"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["QH", "4C"] }, // pair of Qs
      { playerId: "p2", holeCards: ["JH", "2D"] }, // two pair J & 2
    ],
    community,
  );
  check("two pair beats pair", winners[0].playerId === "p2");
}

// Flush beats straight.
{
  const community = ["9S", "8S", "7S", "2H", "3D"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["6H", "5C"] }, // straight 5..9
      { playerId: "p2", holeCards: ["AS", "2S"] }, // flush in spades
    ],
    community,
  );
  check("flush beats straight", winners[0].playerId === "p2");
}

// Royal flush vs straight flush.
{
  const community = ["10S", "JS", "QS", "KS", "2H"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["AS", "3C"] }, // royal flush
      { playerId: "p2", holeCards: ["9S", "8S"] }, // straight flush 8..Q
    ],
    community,
  );
  check("royal flush beats straight flush", winners[0].playerId === "p1");
}

// Split pot: both make the same straight on the board.
{
  const community = ["10D", "9S", "8C", "7H", "6S"];
  const winners = findWinners(
    [
      { playerId: "p1", holeCards: ["2C", "3D"] },
      { playerId: "p2", holeCards: ["4D", "5C"] },
    ],
    community,
  );
  check("split pot when board makes the straight", winners.length === 2);
}

// Wheel (A-2-3-4-5) straight is 5-high, not Ace-high.
{
  const community = ["AS", "2H", "3D", "4C", "KS"];
  const wheel = bestHand(["5C", "9H"], community);
  check(
    "wheel straight has 5 high",
    wheel?.category === "straight" && wheel.kickers[0] === 5,
  );
}

// Hand labels should use poker rank names, not raw numbers.
{
  const cases = [
    {
      name: "Pair of Jacks",
      hole: ["JH", "JC"],
      community: ["2S", "4D", "7C", "9H", "KS"],
      expected: "Pair of Jacks",
    },
    {
      name: "Pair of Aces",
      hole: ["AH", "AC"],
      community: ["2S", "4D", "7C", "9H", "KS"],
      expected: "Pair of Aces",
    },
    {
      name: "Two pair Queens & 7s",
      hole: ["QH", "7C"],
      community: ["QS", "7D", "JC", "2H", "5D"],
      expected: "Two pair, Queens and 7s",
    },
    {
      name: "Three Kings",
      hole: ["KH", "KC"],
      community: ["KS", "2H", "5D", "9C", "4S"],
      expected: "Three of a kind, Kings",
    },
    {
      name: "Full house Aces over Kings",
      hole: ["AH", "AC"],
      community: ["AS", "KH", "KD", "2C", "5S"],
      expected: "Full house, Aces full of Kings",
    },
    {
      name: "Four of a kind Queens",
      hole: ["QH", "QC"],
      community: ["QS", "QD", "2H", "5C", "9S"],
      expected: "Four of a kind, Queens",
    },
    {
      name: "Straight Ace high",
      hole: ["AS", "KC"],
      community: ["QH", "JD", "10C", "2H", "5S"],
      expected: "Straight, Ace high",
    },
    {
      name: "Flush Queen high",
      hole: ["QS", "8S"],
      community: ["10S", "5S", "2S", "JH", "9D"],
      expected: "Flush, Queen high",
    },
    {
      name: "Royal flush",
      hole: ["AS", "KS"],
      community: ["QS", "JS", "10S", "2H", "5D"],
      expected: "Royal flush",
    },
    {
      name: "High card Ace",
      hole: ["AS", "3C"],
      community: ["JH", "9D", "7C", "2H", "5S"],
      expected: "High card Ace",
    },
  ];
  for (const c of cases) {
    const got = bestHand(c.hole, c.community)?.label;
    check(`label: ${c.expected}`, got === c.expected);
    if (got !== c.expected) {
      console.log(`        got: ${got}`);
    }
  }
}

console.log(failures === 0 ? "\nall pass" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
