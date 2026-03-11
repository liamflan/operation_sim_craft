const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'planner/plannerFixtures.ts');
let content = fs.readFileSync(targetPath, 'utf8');

const diffMap = {
  'Easy': 2,
  'Medium': 3,
  'Hard': 4
};

// Regex to match "totalTimeMinutes: 90, prepTimeMinutes: 15, difficulty: 'Medium'"
const regex = /totalTimeMinutes:\s*(\d+),\s*prepTimeMinutes:\s*(\d+),\s*difficulty:\s*'([^']+)'/g;

content = content.replace(regex, (match, total, prep, difficulty) => {
  const complexity = diffMap[difficulty] || 3;
  return `activePrepMinutes: ${prep}, totalMinutes: ${total}, complexityScore: ${complexity}, cleanupBurden: 'Medium',\n  ${match}`;
});

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Upgraded plannerFixtures.ts');
