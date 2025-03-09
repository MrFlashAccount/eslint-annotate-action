import type {AnalyzedESLintReport} from '../types'

// Expected analyzed report - only one unique error expected in the markdown
const analyzedReport: AnalyzedESLintReport = {
  errorCount: 3,
  warningCount: 0,
  markdown: `## 3 Error(s):
### [\`src/example.ts\` line \`20\`](https://github.com/ataylorme/eslint-annotate-github-action/blob/8e80ec28fec6ef9763aacbabb452bcb5d92315ca/src/example.ts#L20:L20)
- Start Line: \`20\`
- End Line: \`20\`
- Message: Delete \`;\`
  - From: [\`prettier/prettier\`]

`,
  success: false,
  summary: '3 ESLint error(s) and 0 ESLint warning(s) found',
  annotations: [
    {
      path: 'src/example.ts',
      start_line: 20,
      end_line: 20,
      start_column: 6,
      end_column: 7,
      annotation_level: 'failure',
      message: '[prettier/prettier] Delete `;`',
    },
    {
      path: 'src/example.ts',
      start_line: 20,
      end_line: 20,
      start_column: 6,
      end_column: 7,
      annotation_level: 'failure',
      message: '[prettier/prettier] Delete `;`',
    },
    {
      path: 'src/example.ts',
      start_line: 20,
      end_line: 20,
      start_column: 6,
      end_column: 7,
      annotation_level: 'failure',
      message: '[prettier/prettier] Delete `;`',
    },
  ],
}

export default analyzedReport
