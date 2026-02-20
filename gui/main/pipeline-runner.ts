import type { IpcMain } from 'electron';
import { injectEnv } from './env-manager.js';

// Pipeline state
let isRunning = false;
let abortController: AbortController | null = null;

/** Register IPC handlers for pipeline execution */
export function registerPipelineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('pipeline:start', async (event, { stage, params }: { stage: string; params: Record<string, unknown> }) => {
    if (isRunning) {
      return { success: false, error: 'Pipeline is already running' };
    }

    isRunning = true;
    abortController = new AbortController();

    // Inject API keys into process.env
    injectEnv();

    try {
      const result = await executePipelineStage(stage, params, event.sender);
      event.sender.send('pipeline:result', { success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      event.sender.send('pipeline:result', { success: false, error: message });
    } finally {
      isRunning = false;
      abortController = null;
    }
  });

  ipcMain.handle('pipeline:stop', async () => {
    if (abortController) {
      abortController.abort();
    }
    isRunning = false;
  });
}

/** Execute a specific pipeline stage — imports src/lib/ SSOT modules */
async function executePipelineStage(
  stage: string,
  params: Record<string, unknown>,
  sender: Electron.WebContents
): Promise<unknown> {
  const sendProgress = (current: number, total: number, message: string) => {
    sender.send('pipeline:progress', { stage, current, total, message });
  };

  switch (stage) {
    case 'knowledge': {
      // Dynamically import to avoid loading all modules at startup
      const { generateKnowledgeBase } = await import('../../src/lib/generate-knowledge.js');
      sendProgress(0, 1, '正在生成知識深挖...');
      const result = await generateKnowledgeBase(
        params.courseName as string,
        params.audience as string,
        params.coreValue as string
      );
      sendProgress(1, 1, '知識深挖完成');
      return result;
    }

    case 'syllabus': {
      const { generateSyllabus } = await import('../../src/lib/generate-syllabus.js');
      sendProgress(0, 1, '正在生成課程大綱...');
      const result = await generateSyllabus(
        params.courseName as string,
        params.audience as string,
        params.coreValue as string,
        params.knowledgeBase as import('../../src/types/knowledge.js').KnowledgeBase
      );
      sendProgress(1, 1, '課程大綱生成完成');
      return result;
    }

    case 'lessons': {
      const { generateLessonScript, extractLessonsFromSyllabus } = await import('../../src/lib/generate-lesson.js');
      const { safeParseJSON } = await import('../../src/lib/safe-json.js');
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const syllabusData = typeof params.syllabus === 'string'
        ? safeParseJSON(params.syllabus)
        : params.syllabus;

      if (!syllabusData) {
        throw new Error('Invalid syllabus data');
      }

      const lessons = extractLessonsFromSyllabus(
        syllabusData as import('../../src/types/syllabus.js').Syllabus,
        params.courseId as string | undefined
      );

      const outputDir = (params.outputDir as string) || 'output/lessons';
      await mkdir(outputDir, { recursive: true });

      const results = [];
      for (let i = 0; i < lessons.length; i++) {
        if (abortController?.signal.aborted) {
          throw new Error('Pipeline aborted by user');
        }

        const lesson = lessons[i];
        sendProgress(i + 1, lessons.length, `正在生成 ${lesson.lesson_id}...`);

        if (params.dryRun) {
          results.push({ lesson_id: lesson.lesson_id, status: 'dry-run' });
          continue;
        }

        const script = await generateLessonScript(lesson);
        const outputPath = join(outputDir, `${lesson.lesson_id}.json`);
        await writeFile(outputPath, JSON.stringify(script, null, 2), 'utf-8');
        results.push({ lesson_id: lesson.lesson_id, status: 'success', path: outputPath });
      }
      return results;
    }

    case 'quality': {
      const { checkQuality } = await import('../../src/lib/check-quality.js');
      const { qualityCheckWithSampling } = await import('../../src/lib/auto-fix.js');
      const { readFile, readdir, writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { safeParseJSON } = await import('../../src/lib/safe-json.js');

      const lessonsDir = (params.lessonsDir as string) || 'output/lessons';
      const reportsDir = (params.reportsDir as string) || 'output/reports';
      await mkdir(reportsDir, { recursive: true });

      const files = (await readdir(lessonsDir)).filter(f => f.endsWith('.json')).sort();
      const sampleRate = (params.sampleRate as number) || 5;
      const results = [];

      for (let i = 0; i < files.length; i++) {
        if (abortController?.signal.aborted) {
          throw new Error('Pipeline aborted by user');
        }

        sendProgress(i + 1, files.length, `正在檢查 ${files[i]}...`);

        if (params.dryRun) {
          results.push({ file: files[i], status: 'dry-run' });
          continue;
        }

        const raw = await readFile(join(lessonsDir, files[i]), 'utf-8');
        const lesson = safeParseJSON(raw);
        if (!lesson) {
          results.push({ file: files[i], status: 'parse-error' });
          continue;
        }

        const result = await qualityCheckWithSampling(
          lesson as import('../../src/types/lesson.js').LessonScript,
          i,
          checkQuality,
          { sampleRate }
        );

        const reportPath = join(reportsDir, `${files[i].replace('.json', '-report.json')}`);
        await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');
        results.push({ file: files[i], verdict: result.finalReport.verdict, status: 'checked' });
      }
      return results;
    }

    case 'video': {
      sendProgress(0, 1, '影片生成功能將在後續版本啟用');
      return { message: 'Video pipeline not yet integrated into GUI' };
    }

    default:
      throw new Error(`Unknown pipeline stage: ${stage}`);
  }
}
