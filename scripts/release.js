#!/usr/bin/env node
import { spawnSync } from 'child_process';

/**
 * Smart release script that handles:
 * 1. Custom tags: pnpm release platform-v3
 * 2. Date-based tags with auto-increment: pnpm release
 *    - Creates: 2025-10-11, then 2025-10-11-2, 2025-10-11-3, etc.
 */

// Get custom tag from command line argument
const customTag = process.argv[2];

let releaseTag;
if (customTag) {
    // Use custom tag if provided
    releaseTag = customTag;
    console.log(`Creating release with custom tag: ${releaseTag}`);
} else {
    // Auto-generate date-based tag with sequence
    const today = new Date().toISOString().split('T')[0];

    // Get all existing tags
    const tagsResult = spawnSync('git', ['tag', '--list'], {
        encoding: 'utf8',
    });
    if (tagsResult.error) {
        console.error('Error fetching git tags:', tagsResult.error);
        process.exit(1);
    }

    const existingTags = tagsResult.stdout.trim().split('\n').filter(Boolean);

    // Find the next available sequence number for today
    let sequence = 0;
    let candidateTag = today;

    while (existingTags.includes(candidateTag)) {
        sequence++;
        candidateTag = `${today}-${sequence}`;
    }

    releaseTag = candidateTag;

    if (sequence > 0) {
        console.log(`Tag ${today} already exists. Using ${releaseTag}`);
    } else {
        console.log(`Creating release with date tag: ${releaseTag}`);
    }
}

// Create the GitHub release
const result = spawnSync('gh', ['release', 'create', releaseTag, '--generate-notes'], {
    stdio: 'inherit',
});

process.exit(result.status ?? 1);
