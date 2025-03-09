import type {ESLintReport, ChecksUpdateParamsOutputAnnotations, AnalyzedESLintReport} from './types'
import constants from './constants'
const {core, GITHUB_WORKSPACE, OWNER, REPO, SHA, failOnWarning, unusedDirectiveMessagePrefix} = constants

/**
 * Analyzes an ESLint report JS object and returns a report
 * @param files a JavaScript representation of an ESLint JSON report
 */
export default function getAnalyzedReport(files: ESLintReport): AnalyzedESLintReport {
  // Create arrays for error and warning messages to build markdown more efficiently
  const errorMessages: string[] = []
  const warningMessages: string[] = []

  // Start the error and warning counts at 0
  let errorCount = 0
  let warningCount = 0

  // Create an array for annotations
  const annotations: ChecksUpdateParamsOutputAnnotations[] = []

  // Track unique error/warning messages to prevent duplicates in markdown report
  const seenMessages = new Set<string>()

  // Cache the GitHub workspace path replacement to avoid repeated string operations
  const githubWorkspacePath = `${GITHUB_WORKSPACE}/`
  const githubWorkspacePathLength = githubWorkspacePath.length

  // Prepare the repository URL prefix once
  const repoUrlPrefix = `https://github.com/${OWNER}/${REPO}/blob/${SHA}/`

  // Loop through each file
  for (const file of files) {
    // Get the file path and any warning/error messages
    const {filePath, messages, errorCount: fileErrorCount, warningCount: fileWarningCount} = file

    // Skip files with no error or warning messages
    if (!messages.length) {
      continue
    }

    core.info(`Analyzing ${filePath}`)

    // Increment the error and warning counts
    errorCount += fileErrorCount
    warningCount += fileWarningCount

    // Trim the absolute path prefix from the file path - do this once per file
    const filePathTrimmed = filePath.startsWith(githubWorkspacePath)
      ? filePath.substring(githubWorkspacePathLength)
      : filePath

    // Loop through all the error/warning messages for the file
    for (const lintMessage of messages) {
      // Pull out information about the error/warning message
      const {column, severity, ruleId, message} = lintMessage

      // Skip messages without a rule ID unless they're unused directive messages
      if (!ruleId && !message.startsWith(unusedDirectiveMessagePrefix)) continue

      // Default line to 1 if it's not present
      const line = lintMessage.line || 1
      const endLine = lintMessage.endLine || line
      const endColumn = lintMessage.endColumn || column

      // Check if it a warning or error
      const isWarning = severity < 2

      /**
       * Create a GitHub annotation object for the error/warning
       * See https://developer.github.com/v3/checks/runs/#annotations-object
       */
      const annotation: ChecksUpdateParamsOutputAnnotations = {
        path: filePathTrimmed,
        start_line: line,
        end_line: endLine,
        annotation_level: isWarning ? 'warning' : 'failure',
        message: `[${ruleId}] ${message}`,
      }

      /**
       * Start and end column can only be added to the
       * annotation if start_line and end_line are equal
       */
      if (line === endLine) {
        annotation.start_column = column
        if (endColumn !== null) {
          annotation.end_column = endColumn
        }
      }

      // Add the annotation object to the array
      annotations.push(annotation)

      // Create a unique identifier for this error/warning message
      const messageId = `${filePathTrimmed}:${line}:${endLine}:${ruleId}:${message}`

      // Skip if we've already seen this exact message
      if (seenMessages.has(messageId)) {
        continue
      }

      // Mark this message as seen
      seenMessages.add(messageId)

      // Create the link to the specific line in GitHub
      const link = `${repoUrlPrefix}${filePathTrimmed}#L${line}:L${endLine}`

      // Create the message text more efficiently using template literals
      const messageText = `### [\`${filePathTrimmed}\` line \`${line}\`](${link})
- Start Line: \`${line}\`
- End Line: \`${endLine}\`
- Message: ${message}
  - From: [\`${ruleId}\`]
`

      // Add the markdown text to the appropriate array
      if (isWarning) {
        warningMessages.push(messageText)
      } else {
        errorMessages.push(messageText)
      }
    }
  }

  // Build markdown text more efficiently
  let markdownText = ''

  // If there is any markdown error text, add it to the markdown output
  if (errorMessages.length) {
    markdownText += `## ${errorCount} Error(s):\n${errorMessages.join('')}\n`
  }

  // If there is any markdown warning text, add it to the markdown output
  if (warningMessages.length) {
    markdownText += `## ${warningCount} Warning(s):\n${warningMessages.join('')}\n`
  }

  // Determine success based on error count and warning count (if failOnWarning is true)
  const success = errorCount === 0 && !(failOnWarning && warningCount > 0)

  // Return the ESLint report analysis
  return {
    errorCount,
    warningCount,
    markdown: markdownText,
    success,
    summary: `${errorCount} ESLint error(s) and ${warningCount} ESLint warning(s) found`,
    annotations,
  }
}
