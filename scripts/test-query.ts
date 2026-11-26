import { cleanSearchQuery } from "../lib/search/query";

interface TestCase {
  name: string;
  input: string;
  expectedQuery: string;
  expectedMaxPrice?: number;
}

const testCases: TestCase[] = [
  {
    name: "Example 1: Study chair with repeated purpose and filler",
    input: "am liking to buy a new study chair for study under 3000",
    expectedQuery: "study chair",
    expectedMaxPrice: 3000,
  },
  {
    name: "Example 2: Phones under budget",
    input: "phones under 20000",
    expectedQuery: "phones",
    expectedMaxPrice: 20000,
  },
  {
    name: "Example 3: Hindi price phrase with fillers",
    input: "3000 के अंदर अच्छा वायरलेस ईयरबड्स दिखाओ",
    expectedQuery: "वायरलेस ईयरबड्स",
    expectedMaxPrice: 3000,
  },
  {
    name: "Example 4: Running shoes with politeness fillers and currency symbol",
    input: "can you please show me best running shoes under ₹2500",
    expectedQuery: "running shoes",
    expectedMaxPrice: 2500,
  },
  {
    name: "Example 5: Mechanical keyboard with below pattern",
    input: "i want to buy a new mechanical keyboard below 5000",
    expectedQuery: "mechanical keyboard",
    expectedMaxPrice: 5000,
  },
  {
    name: "Example 6: Coffee mug with 'for me' and 'less than'",
    input: "looking for good coffee mug for me less than 800",
    expectedQuery: "coffee mug",
    expectedMaxPrice: 800,
  },
];

console.log("==========================================");
console.log("KARTLY SEARCH QUERY CLEANER TEST SUITE");
console.log("==========================================\n");

let passed = 0;
let failed = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const result = cleanSearchQuery(tc.input);

  const queryMatch = result.searchQuery === tc.expectedQuery;
  const priceMatch = result.maxPrice === tc.expectedMaxPrice;

  console.log(`Test ${i + 1}: ${tc.name}`);
  console.log(`  Input:          "${tc.input}"`);
  console.log(`  Result Query:   "${result.searchQuery}" (expected: "${tc.expectedQuery}")`);
  console.log(`  Result Price:   ${result.maxPrice} (expected: ${tc.expectedMaxPrice})`);

  if (queryMatch && priceMatch) {
    console.log("  ✓ PASS\n");
    passed++;
  } else {
    console.error("  ✗ FAIL\n");
    failed++;
  }
}

console.log("==========================================");
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL QUERY CLEANER TESTS PASSED SUCCESSFULLY.");
  process.exit(0);
}
