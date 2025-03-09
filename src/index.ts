import * as core from '@actions/core'
import eslintJsonReportToJs from './eslintJsonReportToJs'
import getAnalyzedReport from './getAnalyzedReport'
import openStatusCheck from './openStatusCheck'
import closeStatusCheck from './closeStatusCheck'
import addAnnotationsToStatusCheck from './addAnnotationsToStatusCheck'
import getPullRequestChangedAnalyzedReport from './getPullRequestChangedAnalyzedReport'
import addSummary from './addSummary'
import constants from './constants'
const {reportFile, onlyChangedFiles, failOnError, failOnWarning, markdownReportOnStepSummary} = constants

/**
 * Main function that runs the ESLint report analysis
 */
async function run(): Promise<void> {
  let checkId: number | undefined

  try {
    core.info(`Starting analysis of the ESLint report ${reportFile.replace(/\n/g, ', ')}. Standby...`)

    // Parse the ESLint report file(s)
    const startTime = Date.now()
    const reportJS = await eslintJsonReportToJs(reportFile)
    core.debug(`ESLint report parsed in ${Date.now() - startTime}ms`)

    // If no report data found, exit early
    if (!reportJS || !reportJS.length) {
      core.warning('No ESLint report data found. Skipping analysis.')
      return
    }

    // Analyze the report - either all files or just changed files
    const analysisStartTime = Date.now()
    const analyzedReport = onlyChangedFiles
      ? await getPullRequestChangedAnalyzedReport(reportJS)
      : getAnalyzedReport(reportJS)
    core.debug(`Report analysis completed in ${Date.now() - analysisStartTime}ms`)

    const annotations = analyzedReport.annotations
    const conclusion = analyzedReport.success ? 'success' : 'failure'

    // Log summary and set outputs
    core.info(analyzedReport.summary)
    core.setOutput('summary', analyzedReport.summary)
    core.setOutput('errorCount', analyzedReport.errorCount)
    core.setOutput('warningCount', analyzedReport.warningCount)
    core.setOutput('markdown', analyzedReport.markdown)

    // Create a new, in-progress status check
    const checkStartTime = Date.now()
    checkId = await openStatusCheck()
    core.debug(`Status check created in ${Date.now() - checkStartTime}ms`)

    // Add all the annotations to the status check
    if (annotations.length > 0) {
      const annotationStartTime = Date.now()
      await addAnnotationsToStatusCheck(annotations, checkId)
      core.debug(`Annotations added in ${Date.now() - annotationStartTime}ms`)
    } else {
      core.info('No annotations to add to the status check')
    }

    // Add report to job summary if requested
    if (markdownReportOnStepSummary) {
      await addSummary(analyzedReport.markdown)
    }

    // Close the GitHub check as completed
    await closeStatusCheck(
      conclusion,
      checkId,
      analyzedReport.summary,
      markdownReportOnStepSummary ? analyzedReport.markdown : '',
    )
    core.debug(`Status check completed in ${Date.now() - checkStartTime}ms`)

    // Fail the Action if the report analysis conclusion is failure
    if ((failOnWarning || failOnError) && conclusion === 'failure') {
      core.setFailed(`${analyzedReport.errorCount} errors and ${analyzedReport.warningCount} warnings`)
      return
    }

    // If we got this far things were a success
    core.info(`ESLint report analysis complete in ${Date.now() - startTime}ms. No errors found!`)
  } catch (err) {
    // Try to close the check if it was opened and there was an error
    if (checkId) {
      try {
        await closeStatusCheck('failure', checkId, 'Error analyzing ESLint report', '')
      } catch (closeErr) {
        core.warning('Failed to close the status check after an error occurred')
      }
    }

    const errorMessage = 'Error creating a status check for the ESLint analysis.'
    // err only has an error message if it is an instance of Error
    if (err instanceof Error) {
      core.setFailed(err.message ? err.message : errorMessage)
    } else {
      core.setFailed(errorMessage)
    }
  }
}

// Execute the main function
run().catch((error) => {
  console.error('Unhandled error:', error)
  core.setFailed(`Unhandled error: ${error.message || 'Unknown error'}`)
  process.exit(1)
})
