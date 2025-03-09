import * as glob from '@actions/glob';
import fs from 'fs';
import path from 'path';
import * as core from '@actions/core';

import type { ESLintReport } from './types';

/**
 * Parses a single ESLint report file and returns its contents as a JavaScript object
 * @param reportFile Path to an ESLint JSON report file
 * @returns Parsed ESLint report
 */
function parseReportFile(reportFile: string): ESLintReport {
  try {
    const reportPath = path.resolve(reportFile);

    // Check if file exists before trying to read it
    if (!fs.existsSync(reportPath)) {
      throw new Error(`The report-json file "${reportFile}" could not be resolved.`);
    }

    // Read and parse the file in one operation
    const reportParsed = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

    // Log success for debugging
    core.debug(`Successfully parsed report file: ${reportFile}`);

    return reportParsed;
  } catch (error) {
    // Provide more specific error messages based on error type
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in report file "${reportFile}": ${error.message}`);
    } else if (error instanceof Error) {
      throw new Error(`Error processing "${reportFile}": ${error.message}`);
    } else {
      throw new Error(`Error parsing the report-json file "${reportFile}".`);
    }
  }
}

/**
 * Converts ESLint report JSON files to an array of JavaScript objects
 * @param reportFilesGlob Glob pattern for ESLint JSON files
 * @returns Promise resolving to an array of ESLint report objects
 */
export default async function eslintJsonReportToJs(reportFilesGlob: string): Promise<ESLintReport> {
  // Log the start of processing
  core.debug(`Processing ESLint report files matching pattern: ${reportFilesGlob}`);

  // Create globber with concurrency to improve performance on large numbers of files
  const globber = await glob.create(reportFilesGlob, { matchDirectories: false });

  // Get all matching files
  const files = await globber.glob();

  const uniqueFiles = [...new Set(files)];

  // Log number of files found
  core.debug(`Found ${files.length} ESLint report files to process`);

  if (uniqueFiles.length === 0) {
    core.warning(`No ESLint report files found matching pattern: ${reportFilesGlob}`);
    return [];
  }

  // Process all files and flatten the results
  // Use Promise.all to process files in parallel if there are multiple
  if (uniqueFiles.length === 1) {
    // Optimize for common case of single file
    return parseReportFile(files[0]);
  } else {
    // Process multiple files in parallel
    return (await Promise.all(uniqueFiles.map(parseReportFile))).flat();
  }
}
