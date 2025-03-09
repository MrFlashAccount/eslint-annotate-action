import getPullRequestFiles from './getPullRequestFiles'
import getAnalyzedReport from './getAnalyzedReport'
import type {ESLintReport, AnalyzedESLintReport} from './types'
import constants from './constants'
const {GITHUB_WORKSPACE, OWNER, REPO, pullRequest, onlyChangedFiles} = constants

/**
 * Analyzes an ESLint report, separating pull request changed files
 * @param reportJS a JavaScript representation of an ESLint JSON report
 */
export default async function getPullRequestChangedAnalyzedReport(
  reportJS: ESLintReport,
): Promise<AnalyzedESLintReport> {
  // Get all files changed in the pull request
  const changedFiles = await getPullRequestFiles({
    owner: OWNER,
    repo: REPO,
    pull_number: pullRequest.number,
  })

  // Create a Set for faster lookup of changed files
  const changedFilesSet = new Set(changedFiles)

  // Cache the workspace path for efficient replacement
  const workspacePath = `${GITHUB_WORKSPACE}/`
  const workspacePathLength = workspacePath.length

  // Normalize all file paths in the report once
  const normalizedReport = reportJS.map((file) => {
    // Create a shallow copy to avoid mutating the original
    const normalizedFile = {...file}

    // Strip the workspace prefix if it exists
    if (normalizedFile.filePath.startsWith(workspacePath)) {
      normalizedFile.filePath = normalizedFile.filePath.substring(workspacePathLength)
    }

    return normalizedFile
  })

  // Efficiently filter for PR files using the Set
  const pullRequestFilesReportJS: ESLintReport = normalizedReport.filter((file) => changedFilesSet.has(file.filePath))

  // Analyze the PR files
  const analyzedPullRequestReport = getAnalyzedReport(pullRequestFilesReportJS)

  // Build the summary and markdown for PR files
  let summary = `${analyzedPullRequestReport.summary} in pull request changed files.`
  let markdown = `# Pull Request Changed Files ESLint Results:\n**${analyzedPullRequestReport.summary}**\n${analyzedPullRequestReport.markdown}`

  // Only process non-PR files if we're not limiting to changed files
  if (!onlyChangedFiles) {
    // Efficiently filter for non-PR files using the Set
    const nonPullRequestFilesReportJS: ESLintReport = normalizedReport.filter(
      (file) => !changedFilesSet.has(file.filePath),
    )

    // Analyze the non-PR files
    const analyzedNonPullRequestReport = getAnalyzedReport(nonPullRequestFilesReportJS)

    // Add to the summary and markdown
    summary += `${analyzedNonPullRequestReport.summary} in files outside of the pull request.`
    markdown += `\n\n# Non-Pull Request Changed Files ESLint Results:\n**${analyzedNonPullRequestReport.summary}**\n${analyzedNonPullRequestReport.markdown}`
  }

  // Truncate markdown if it's too long (GitHub has a 65535 character limit)
  const MAX_MARKDOWN_LENGTH = 65535
  const TRUNCATION_BUFFER = 285 // Buffer for the truncation message

  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    markdown = markdown.slice(0, MAX_MARKDOWN_LENGTH - TRUNCATION_BUFFER) + '\n\n...summary too long, truncated.'
  }

  // Return the report with the correct annotations
  return {
    errorCount: analyzedPullRequestReport.errorCount,
    warningCount: analyzedPullRequestReport.warningCount,
    markdown,
    success: analyzedPullRequestReport.success,
    summary,
    annotations: analyzedPullRequestReport.annotations,
  }
}
