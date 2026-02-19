// Video assembler module — FFmpeg-based segment concatenation
import { exec } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { formatSRTTime } from './tts.js';

const execAsync = promisify(exec);

export interface SegmentFile {
  segmentId: string;
  videoPath: string;
  srtContent: string | null;
  startTime: number;
  duration: number;
}

/**
 * Assemble multiple segment video files into a single lesson video.
 */
export async function assembleLesson(
  segments: SegmentFile[],
  outputDir: string,
  lessonId: string
): Promise<{ videoPath: string; srtPath: string }> {
  await mkdir(outputDir, { recursive: true });

  const videoPath = join(outputDir, `${lessonId}.mp4`);
  const srtPath = join(outputDir, `${lessonId}.srt`);
  const concatListPath = join(outputDir, `${lessonId}_concat.txt`);

  // Create FFmpeg concat list
  const concatContent = segments
    .map(s => `file '${s.videoPath.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await writeFile(concatListPath, concatContent, 'utf-8');

  // Concatenate videos using FFmpeg
  try {
    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${videoPath}"`
    );
    console.log(`  Video assembled: ${videoPath}`);
  } catch (error) {
    throw new Error(`FFmpeg assembly failed: ${error instanceof Error ? error.message : error}`);
  }

  // Assemble SRT subtitles with adjusted timestamps
  const srtContent = assembleSRT(segments);
  await writeFile(srtPath, srtContent, 'utf-8');
  console.log(`  SRT assembled: ${srtPath}`);

  // Cleanup temp concat file
  await unlink(concatListPath).catch(() => { /* ignore */ });

  return { videoPath, srtPath };
}

/**
 * Assemble SRT from multiple segments, adjusting timestamps.
 */
function assembleSRT(segments: SegmentFile[]): string {
  let entryIndex = 1;
  const srtEntries: string[] = [];

  for (const segment of segments) {
    if (!segment.srtContent) continue;

    const adjustedEntries = adjustSRTTimestamps(
      segment.srtContent,
      segment.startTime,
      entryIndex
    );
    srtEntries.push(adjustedEntries.content);
    entryIndex = adjustedEntries.nextIndex;
  }

  return srtEntries.join('\n');
}

/**
 * Adjust SRT timestamps by adding an offset.
 */
export function adjustSRTTimestamps(
  srtContent: string,
  offsetSeconds: number,
  startIndex: number
): { content: string; nextIndex: number } {
  const lines = srtContent.split('\n');
  const adjustedLines: string[] = [];
  let currentIndex = startIndex;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match timestamp line: 00:00:01,000 --> 00:00:05,000
    const timestampMatch = line.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );

    if (timestampMatch) {
      const startTime = parseSRTTime(timestampMatch[1]) + offsetSeconds;
      const endTime = parseSRTTime(timestampMatch[2]) + offsetSeconds;
      adjustedLines.push(`${currentIndex}`);
      adjustedLines.push(`${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`);
      currentIndex++;
    } else if (line && !/^\d+$/.test(line)) {
      // Content line (not index number or empty)
      adjustedLines.push(line);
      adjustedLines.push('');
    }
  }

  return { content: adjustedLines.join('\n'), nextIndex: currentIndex };
}

/** Parse SRT time format to seconds */
function parseSRTTime(timeStr: string): number {
  const [hms, ms] = timeStr.split(',');
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s + parseInt(ms) / 1000;
}
