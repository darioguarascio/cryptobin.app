#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const summaryPath = process.env.GITHUB_STEP_SUMMARY;

const reports = [
  { title: '@cryptobin/web', path: 'apps/web/coverage/coverage-summary.json' },
  { title: '@cryptobin/cli', path: 'packages/cli/coverage/coverage-summary.json' },
];

function formatSection(title, filePath) {
  if (!existsSync(filePath)) {
    return `### ${title}\n\nCoverage summary not found (\`${filePath}\`). Tests may have failed before coverage was written.\n\n`;
  }

  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const total = data.total;
  if (!total) {
    return `### ${title}\n\nInvalid coverage summary at \`${filePath}\`.\n\n`;
  }

  const row = (label, key) => `| ${label} | ${total[key].pct}% |`;

  return [
    `### ${title}`,
    '',
    '| Metric | Coverage |',
    '| --- | --- |',
    row('Lines', 'lines'),
    row('Statements', 'statements'),
    row('Functions', 'functions'),
    row('Branches', 'branches'),
    '',
  ].join('\n');
}

let markdown = '# Code coverage\n\n';

for (const report of reports) {
  markdown += `${formatSection(report.title, report.path)}\n`;
}

markdown += [
  '#### HTML reports (in **unit-coverage** artifact)',
  '',
  '- `apps/web/coverage/index.html`',
  '- `packages/cli/coverage/index.html`',
  '',
].join('\n');

if (summaryPath) {
  appendFileSync(summaryPath, markdown);
} else {
  process.stdout.write(`${markdown}\n`);
}
