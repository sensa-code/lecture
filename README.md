# vet-course-generator

AI-powered veterinary course generation pipeline — converts vet expertise into structured online video courses through an 8-stage automated workflow.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment (only ANTHROPIC_API_KEY is required to start)
cp .env.example .env
# Edit .env and add your Claude API key

# 3. Run a dry-run to verify setup
npx tsx scripts/batch-generate-scripts.ts --syllabus output/syllabus.json --dry-run
```

## Pipeline Stages

| Stage | Command | Description |
|-------|---------|-------------|
| 00 | Knowledge Deep Dive | Extract 7-dimension knowledge base from topic |
| 01 | Syllabus Generation | Generate course outline with Bloom's Taxonomy |
| 02 | Lesson Script | Generate 5-8 segment scripts per lesson |
| 03 | Case Dialogue | Generate veterinary case dialogues (optional) |
| 04 | Quality Check | Automated review with sampling (F-3) |
| 05 | DB Storage | Persist to Supabase with versioning (F-14) |
| 06 | Video Pipeline | HeyGen avatar + ElevenLabs TTS + Remotion slides |
| 07 | Batch Automation | Orchestrate full pipeline with budget caps |

## Available Commands

```bash
# Batch generate lesson scripts from syllabus
npm run batch:scripts -- --syllabus output/syllabus.json --budget 5 [--dry-run]

# Batch quality check with sampling
npm run batch:quality -- --course vet-comm-001 --budget 3 [--dry-run]

# Batch generate videos
npm run batch:videos -- --course vet-comm-001 [--dry-run]

# View pipeline progress
npm run status -- --course vet-comm-001 [--detailed]
```

## Environment Variables

| Variable | Required | Purpose | Where to get |
|----------|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | **Yes** | Claude API for all generation stages | [console.anthropic.com](https://console.anthropic.com) |
| `SUPABASE_URL` | No | Database persistence | [supabase.com/dashboard](https://supabase.com/dashboard) |
| `SUPABASE_KEY` | No | Database access | Same as above |
| `HEYGEN_API_KEY` | No | Avatar video generation (Stage 06) | [app.heygen.com](https://app.heygen.com) |
| `ELEVENLABS_API_KEY` | No | Text-to-speech (Stage 06) | [elevenlabs.io](https://elevenlabs.io) |

## Tech Stack

- **Runtime**: Node.js 20 LTS + TypeScript 5.3+ (strict mode)
- **LLM**: Claude API via @anthropic-ai/sdk
- **Validation**: Zod schemas for all AI outputs
- **Database**: Supabase (PostgreSQL) with owner-based RLS
- **Video**: HeyGen + ElevenLabs + Remotion + FFmpeg
- **Testing**: Vitest (133 tests)

## Architecture

- `src/types/` — SSOT type definitions (7 files)
- `src/schemas/` — Zod validation schemas (5 files)
- `src/lib/` — Core generation modules (stages 00-04)
- `src/lib/video-pipeline/` — Video generation (stage 06)
- `scripts/` — CLI batch automation (stage 07)
- `tests/` — Unit and integration tests
- `supabase/migrations/` — Database schema
- `docs/` — Detailed specification documents

## License

Private — Shangxian Animal Biotech
