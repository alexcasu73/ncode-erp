// Test service name extraction

const testCases = [
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 31/12/25 ORE 11:08 C /O ANTHROPIC +14152360599 USA",
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 13/01/26 ORE 15:26 C /O FIGMA +14158905404 USA",
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 02/01/26 ORE 15:52 C /O ANTHROPIC +14152360599 USA",
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 03/01/26 ORE 16:52 C /O OPENAI *CHATGPT SUBS +14158799686 USA",
  "OPENAI *CHATGPT SUBS",
  "VERISURE ITALY SRL"
];

console.log("Testing service name extraction (NEW VERSION):\n");

testCases.forEach((description, idx) => {
  console.log(`Test ${idx + 1}: "${description}"`);

  // NEW: Extract multiple service names from "C /O [SERVICES]" pattern
  const serviceNames = [];
  const servicePattern = /C\s*\/\s*O\s+([A-Z*\s]+?)(?:\+|\s+\+)/i;
  const serviceMatch = description.match(servicePattern);

  if (serviceMatch) {
    // Extract all capitalized words from the matched text
    const words = serviceMatch[1]
      .split(/[\s*]+/)  // Split by spaces and asterisks
      .filter(w => w.length > 0 && /^[A-Z]+$/i.test(w))  // Only alphabetic words
      .map(w => w.toLowerCase());

    serviceNames.push(...words);
    console.log(`  ✅ Match found: "C /O ${serviceMatch[1]}"`);
    console.log(`  → Service names: [${serviceNames.join(', ')}]\n`);
  } else {
    console.log(`  ❌ No match found\n`);
  }
});

// Test NEW LOGIC: check if cashflow notes appear in transaction description
console.log("\n" + "=".repeat(60));
console.log("Testing NEW LOGIC (notes → description):\n");

const cashflows = [
  { id: "CF-0058", note: "Chatgpt" },
  { id: "CF-0145", note: "Figma" },
  { id: "CF-0282", note: "Anthropic" }
];

const transactions = [
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 31/12/25 ORE 11:08 C /O ANTHROPIC +14152360599 USA",
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 13/01/26 ORE 15:26 C /O FIGMA +14158905404 USA",
  "POS CARTA CA DEBIT VISA N. ****0428 DEL 03/01/26 ORE 16:52 C /O OPENAI *CHATGPT SUBS +14158799686 USA"
];

transactions.forEach((txDesc, idx) => {
  console.log(`\n${idx + 1}. Transaction: "${txDesc}"`);
  const descLower = txDesc.toLowerCase();

  cashflows.forEach(cf => {
    const noteWords = (cf.note || '')
      .toLowerCase()
      .split(/[\s*]+/)
      .filter(w => w.length > 3 && /^[a-z]+$/i.test(w));

    const found = noteWords.some(word => descLower.includes(word));

    console.log(`   ${found ? '✅' : '❌'} ${cf.id} (note: "${cf.note}") → ${found ? 'MATCH' : 'NO MATCH'}`);
    if (found) {
      const matchedWord = noteWords.find(word => descLower.includes(word));
      console.log(`      → Matched word: "${matchedWord}"`);
    }
  });
});
