

<div align="center">

<img src="assets/banner.svg" alt="乌木智书" width="800"/>

# WUMU AI Novel Studio

**AI-Powered Smart Novel Writing Studio**

[![版本](https://img.shields.io/badge/version-0.2.0-667eea?style=flat-square)](https://github.com/ziwalia/WUMU-AI-Novel-Studio/releases)
[![平台](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Web-764ba2?style=flat-square)]()
[![许可](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24243e?style=flat-square&logo=tauri)](https://tauri.app)

[Features](#-features) · [Installation](#-installation) · [Usage](#-usage) · [Tech Stack](#-tech-stack) · [Development](#-development)

</div>

---

## 📖 Project Introduction

WUMU AI Novel Studio is an AI-powered long-form novel writing tool that helps authors go from concept to completion. Through an intelligent wizard workflow and fully automated generation capabilities, you can focus on creativity and storytelling while AI assists you through the entire process—from worldbuilding to finalizing the ending.

---

## ✨ Features

### 🎯 Intelligent Writing Wizard

From scratch, step-by-step guidance to complete a full novel:

```
Project Info → Novel Architecture → Novel Outline → Chapter Directory → Draft Generation → Consistency Review → Revision → Finalization → Export
```

Functionality per step:

| Step | Description |
|------|---------|
| **Project Info** | Fill in novel title, genre, chapter count, target word count, story synopsis, narrative perspective, writing guidelines, etc. |
| **Novel Architecture** | AI generates core mission, worldbuilding, main plot, character system, character relationships, and narrative style. |
| **Novel Outline** | AI divides the story into phases, generating themes, chapter ranges, key events, emotional tone, and character arcs for each phase. |
| **Chapter Directory** | AI generates titles and summaries for each chapter, automatically detecting and deduplicating similar chapters. |
| **Draft Generation** | AI generates the first draft for each chapter based on the directory and context. |
| **Consistency Review** | AI reviews chapter quality and scores it across 11 dimensions. |
| **Revision** | AI performs targeted revisions based on review feedback. |
| **Finalization** | Confirm final text and mark the chapter as completed. |
| **Export** | Supports export in TXT, Markdown, and JSON formats. |

### 🤖 AI Fully Automated Generation

Set the novel title and genre, then kick off fully automated generation with one click:

- **End-to-End Automation**: Automatically completes architecture → outline → directory → all chapter drafts → review → revision → finalization.
- **Configurable Review Rounds**: Supports 1-5 rounds of review and revision, with scoring followed by targeted revisions per round.
- **Smart Skipping**: Automatically skips revision if the review score is ≥ 90, saving token usage.
- **Chapter Deduplication**: Automatically detects duplicate or similar titles and plots in the chapter directory, with up to 5 rounds of automatic rewriting.
- **Checkpoint Resumption**: Resumes generation from the last completed chapter if interrupted.
- **Full-Text Review**: Automatically triggers 4 rounds of full-text review and scoring once all chapters are completed.

### 👥 Character Tracking System

AI automatically tracks and manages character states to ensure consistent memory throughout the novel:

- **Character Attributes**: Name, weight (protagonist/key supporting/secondary/background), age, personality, abilities, basic info.
- **Character State Tracking**: Automatically tracks survival status (alive/dead), current location trajectory, emotional state, and dialogue keywords.
- **Character Arcs**: Records the growth and change history for each character.
- **Ability Tracking**: Automatically records new abilities acquired and items held by characters.
- **Character Snapshots**: Saves character state snapshots per chapter, allowing rollback during revisions.

### 🔗 Character Relationship Network

- **8 Relationship Types**: Lovers, Master-Apprentice, Hostile, Fellow Disciples, Allies, Friends, Relatives, Others.
- **Relationship Visualization**: Color-coded indicators for different relationship types.
- **Dynamic Tracking**: AI automatically detects new relationships and changes between characters.
- **Relationship Descriptions**: Each relationship includes a specific description.

### 🪝 Foreshadowing Management System

AI automatically plants and resolves foreshadowing to ensure narrative completeness:

- **5 Foreshadowing Types**: Main Plot (MF), Action (AF), Character (CF), Setting (SF), Prophecy (YF).
- **Auto Placement**: AI automatically plants foreshadowing during writing and records it.
- **Auto Resolution**: AI automatically resolves foreshadowing when the timing is appropriate.
- **Foreshadowing Alerts**: Automatically reminds AI to resolve all unfinished foreshadowing in the last 2 chapters.
- **Priority Markers**: High, Medium, Low.

### 📊 Chapter Metadata Extraction

After each chapter is generated, AI automatically extracts structured metadata:

- **Chapter Summary**: 50-100 word summary of core events.
- **Timeline**: In-story time nodes.
- **Scene Types**: 20+ categories including battle escalation, cultivation breakthrough, romance development, daily banter, etc.
- **Pacing Tags**: Tension / Calm / Transition.
- **Emotional Intensity**: High / Medium / Low.
- **Character Changes**: New character appearances, state changes, location moves, ability acquisition, life/death changes.
- **Relationship Changes**: New relationships, relationship type changes.

### 📝 Consistency Review System

AI reviews each chapter across 11 dimensions:

1. **Chapter Title**: Format correctness, consistency with directory.
2. **Chapter Opening**: Natural and complete scene entry.
3. **Character Consistency**: Behavior, personality, speaking style match settings, reasonable locations, no unauthorized appearances of dead characters.
4. **Plot Coherence**: Logical loopholes and contradictions.
5. **Timeline**: Reasonable time progression.
6. **Foreshadowing Management**: Forgotten foreshadowing needs resolution, new foreshadowing can be planted.
7. **Writing Quality**: Repetitive wording, awkward phrasing.
8. **Continuity**: Consistency with previous chapters, setting conflicts or timeline errors.
9. **Scene Diversity**: Whether this chapter's scene types overly repeat previous chapters.
10. **Transition Quality**: Whether the opening naturally connects to the previous chapter's ending.
11. **Plan Completion**: Whether core events planned in the directory are fulfilled.

Review Scoring Mechanism:
- **≥ 90**: Excellent quality, skip revision.
- **80-89**: Has room for improvement, execute revision.
- **< 80**: Multiple quality issues, execute revision.

### 🔄 Revision System

- AI extracts a list of specific issues based on review feedback.
- Fixes issues specifically, preserving the overall structure and pacing of the original text.
- Makes no major changes to problem-free sections.
- Supports strict word count control mode (±5%).
- Re-extracts chapter metadata after revision.

### 📖 4-Round Full-Text Review

After all chapters are finalized, 4 rounds of full-text review are automatically executed:

| Round | Focus | Dimensions |
|-------|-------|------------|
| **Pass 1 - Structural Overview** | Overall architecture, main plot, plot coherence, pacing control, character arcs, foreshadowing management, paragraph transitions, climax design, ending satisfaction, thematic depth | 10 |
| **Pass 2 - Opening Review** | Opening appeal, worldbuilding, protagonist shaping, writing style, dialogue quality, scene description, emotional rendering, reader immersion | 8 |
| **Pass 3 - Mid-Story Sampling** | Conflict escalation, supporting character shaping, foreshadowing usage, pacing changes, emotional tension, worldbuilding expansion, narrative perspective consistency | 7 |
| **Pass 4 - Ending Review** | Climax impact, foreshadowing resolution rate, ending rationality for characters, thematic elevation, emotional aftermath, ending completeness | 6 |

Outputs a comprehensive score, per-dimension scores, overall evaluation, and specific revision suggestions.

### 🧠 Context Management System

During draft generation, rich structured context is automatically injected per chapter to ensure AI writing continuity:

- **Full content of the previous 1-2 chapters**: Ensures scene continuity.
- **Ending paragraphs of recent chapters** (500 words each): Maintains suspense.
- **Progressive Master Summary**: Overview of the entire book's progress.
- **Summaries of the last 10 chapters**: Recent plot review.
- **Scene types/pacing/emotions of the last 5 chapters**: Avoids scene repetition.
- **Active Character States**: Locations and emotions of the protagonist + characters appearing in the last 3 chapters.
- **Unresolved Foreshadowing List**: Reminds AI of resolution timing.
- **Current Timeline**: Ensures reasonable time progression.
- **User Plot Guidance**: Supports users in presetting the direction of the next chapter.
- **Complete Character Roster + Relationship Network**: Injects full character information into each chapter.
- **Complete Chapter Directory**: Injects full directory information into each chapter.

### 📤 Multi-Format Export

| Format | Description |
|--------|-------------|
| **TXT** | Plain text format, suitable for uploading to major reading platforms. |
| **Markdown** | Preserves chapter structure and metadata, suitable for secondary editing. |
| **JSON** | Contains complete metadata (architecture, outline, directory, all chapters), suitable for programmatic processing. |

Supports **Download File** and **Copy All** operations. The export page displays the number of generated chapters, finalized chapters, and total word count.

### 🎨 Novel Genre System

Built-in **209** web novel genres/subgenres, divided into Male-Frequency and Female-Frequency channels:

- Each genre includes: definition, tag description, recommended elements, non-recommended elements, popular settings.
- Genre data is automatically injected into prompts for architecture/outline/directory/draft, guiding AI to write in the genre's style.
- Supports custom addition of new genres.

### ✍️ Writing Style System

Built-in **13** preset writing styles:

- Each style includes a name and description.
- Style settings are injected into the writing prompt.
- Supports custom addition of new styles.

### 🔌 Multi-LLM Integration

Supports **12** LLM interface formats:

| Platform | Interface Format |
|----------|------------------|
| OpenAI | Standard OpenAI-compatible interface |
| Claude | Anthropic Claude interface |
| DeepSeek | DeepSeek interface |
| Gemini | Google Gemini interface |
| Ollama | Ollama local model interface |
| LM Studio | LM Studio local model interface |
| Azure OpenAI | Azure-hosted OpenAI interface |
| Azure AI | Azure AI interface |
| Volcano Engine | Volcano Engine interface |
| SiliconFlow | SiliconFlow interface |
| Tongyi Qianwen | Alibaba Qwen interface |
| Zhipu AI | Zhipu AI interface |

Each LLM configuration supports: API Key, Base URL, Model Name, Temperature, Top P, Max Tokens, Timeout, Proxy Settings.

Supports **Streaming Output** to display AI-generated content in real-time.

### 📐 Model Recommendations

Automatically calculates and recommends appropriate model context window sizes (32K / 64K / 128K) based on the novel's chapter count and words per chapter.

### 🎨 Additional Features

- 🌗 Light / Dark / System-follow theme modes
- 📏 Global font configuration (font, size, line height)
- 📁 Multi-project management (create, switch, rename)
- 💾 Local persistent project storage, data security
- 🔔 Toast notification system (success/error/warning/info)
- 📊 Sidebar displays generation progress
- 🖥️ Dual-mode operation: Desktop (Tauri v2) + Web
- ⏹️ Ability to abort generation at any time, supports checkpoint resumption
- 🔢 Real-time token usage statistics (input/output)

---

## 📥 Installation

### Desktop Version (Recommended)

Download the latest installer from the [Releases page](https://github.com/ziwalia/WUMU-AI-Novel-Studio/releases/latest):

| File | OS | Description |
|------|----|-------------|
| `WUMU AI Novel_x64-setup.exe` | Windows | NSIS installer, double-click to install |
| `WUMU AI Novel_x64_en-US.msi` | Windows | MSI installer, suitable for enterprise deployment |

### Web Version

No installation required; simply access via a web browser.

---

## 📚 Usage Guide

### 1. Configure AI Models

First-time use requires configuring the LLM interface:

1. Click the ⚙️ **Settings** button in the top right corner.
2. Click **Add Configuration**.
3. Select the LLM interface format (e.g., OpenAI, Ollama, LM Studio, etc.).
4. Enter the API URL and key.
5. Select the model.
6. Click **Test Connection** to verify availability.
7. You can create multiple configurations and switch between them at any time.

### 2. Create a New Project

1. Click **New Project** on the left sidebar.
2. Enter the project name.
3. Click **Create** to enter the writing wizard.

### 3. Fill in Project Information

Fill in during the **Project Info** step:

| Field | Description | Required |
|-------|-------------|----------|
| Novel Title | Work title | ✅ |
| Novel Genre | Select from 209 built-in genres | ✅ |
| Total Chapters | Planned number of chapters | ✅ |
| Words per Chapter | Target word count per chapter | ✅ |
| Strict Word Count Control | Forces ±5% word count range when enabled | Optional |
| Story Synopsis | General plot direction | Optional |
| Narrative Perspective | First person / Third-person limited / Third-person omniscient | Optional |
| Writing Guidelines | Additional requirements for AI | Optional |
| Writing Style | Select from 13 preset styles | Optional |
| Core Characters | Descriptions of main characters | Optional |
| Key Items | Important items in the story | Optional |
| Scene Locations | Main scene settings | Optional |
| Time Pressure | Sense of urgency within the story | Optional |

### 4. Manual Writing Workflow

Proceed step-by-step through the left sidebar:

| Step | Description |
|------|-------------|
| **Project Info** | Fill in basic novel parameters and set the writing direction. |
| **Novel Architecture** | AI generates worldbuilding, character systems, main plot, and relationship networks (JSON format, card display). |
| **Novel Outline** | AI generates outlines by phase, including key events and character changes. |
| **Chapter Directory** | AI generates titles and summaries for each chapter, with automatic deduplication detection. |
| **Draft Generation** | AI generates first drafts based on the directory and context, supporting streaming output. |
| **Consistency Review** | AI reviews and scores across 11 dimensions, outputting detailed feedback. |
| **Revision** | AI performs targeted revisions on problematic parts based on feedback. |
| **Finalization** | Confirm final text and mark chapters as completed. |
| **Export** | Choose format to export TXT / Markdown / JSON. |

### 5. Fully Automated Generation (Recommended)

After filling in the novel title and genre, click the **Fully Automated Generation** button at the bottom of the project info page:

1. Set the number of review/revision rounds (1-5, default 1).
2. Click **Start** to confirm.
3. The system automatically completes:
   - Generate novel architecture → Extract characters and relationships
   - Generate novel outline
   - Generate chapter directory → Automatic deduplication detection and rewriting
   - Chapter-by-chapter loop: Draft → Review & Score → Revision → Finalization
   - Execute 4 rounds of full-text review upon completion
4. You can click **Abort** at any time, and resume from the checkpoint next time.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 6 |
| **CSS Framework** | Tailwind CSS 4 |
| **State Management** | Zustand 5 (persist middleware) |
| **Desktop Framework** | Tauri v2 (Rust) |
| **LLM Integration** | OpenAI-compatible streaming interface |
| **Testing** | Vitest |

---

## 💻 Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) (Desktop development)
- [Tauri CLI](https://tauri.app/guides/prerequisites/)

### Local Execution

```bash
# Clone the repository
git clone https://github.com/ziwalia/WUMU-AI-Novel-Studio.git
cd WUMU-AI-Novel-Studio

# Install dependencies
npm install

# Web version dev mode
npm run dev

# Desktop version dev mode
npm run tauri dev
```

### Build

```bash
# Build frontend
npm run build

# Build desktop installer
npm run tauri build
```

---

## 📋 Changelog

### v0.2.0

**Architecture Refactoring**
- Removed "volume/volume" concept, simplified to a flat structure of Architecture → Outline → Chapter Directory.
- Merged architecture steps into `StepArchitecture`, unifying architecture generation and data extraction.

**Writing Wizard**
- Added **Novel Outline** step (`StepOutline`), generating detailed outlines divided by phases.
- Enhanced Chapter Directory step (`StepBlueprint`): Automatic deduplication detection + up to 5 rounds of automatic rewriting for similar chapters.

**Fully Automated Generation Enhancements**
- Full workflow automation: Architecture → Outline → Directory Deduplication → Chapter-by-chapter (Draft → Review → Revision → Finalization) → Full-text review.
- Review score gating: Automatically skips revision if score ≥ 90, saving tokens.
- Checkpoint resumption: Resumes from the last completed chapter if interrupted.
- Automatic full-text review trigger: 4 rounds (Structural Overview, Opening Review, Mid-Story Sampling, Ending Review).

**Character Tracking System**
- AI automatically extracts character changes per chapter: new appearances, state changes, location moves, ability acquisition, life/death changes.
- Character attribute tracking: Survival status, location trajectory, emotional state, dialogue keywords, growth arcs.
- Character snapshots: Saves character states per chapter, allowing rollback during revisions.

**Relationship Network**
- AI automatically detects and records relationship changes between characters.
- 8 relationship types with color-coded visualization.

**Foreshadowing Management**
- AI automatically plants and resolves 5 types of foreshadowing.
- Automatic reminders in the last 2 chapters to resolve unfinished foreshadowing.
- Foreshadowing status tracking: Placed / Resolved.

**Consistency Review**
- Expanded review dimensions from 6 to 11.
- Added: Chapter opening, continuity, scene diversity, transition quality, plan completion.
- Review scoring mechanism (0-100 points).

**Context Management**
- Rich structured context injected during draft generation: full content of previous 1-2 chapters, summaries of last 10 chapters, scene type stats, active character states, foreshadowing list, timeline, etc.
- Progressive master summary system: Automatically maintains a structured overview of the entire book's progress.

**Chapter Metadata**
- AI automatically extracts: summary, timeline, scene types, pacing tags, emotional intensity, character changes, relationship changes.
- Scene deduplication alerts based on metadata.

**Multi-Format Export**
- Added Markdown and JSON export formats.
- Added "Copy All" feature.
- Export page displays statistical information.

**LLM Support**
- Expanded supported interfaces from 1 to 12 (added Claude, DeepSeek, Gemini, Ollama, LM Studio, Azure, Volcano Engine, SiliconFlow, Tongyi Qianwen, Zhipu).
- Streaming output supports `stream_options.include_usage`.
- Real-time token usage statistics.

**Genre System**
- Built-in 209 web novel genres/subgenres (Male + Female).
- Built-in 13 preset writing styles.
- Genre and style data automatically injected into writing prompts.

**UI Improvements**
- Theme modes: Light / Dark / System-follow.
- Global font configuration (font, size, line height).
- Toast notification system.
- Collapsible and adjustable width sidebar.
- Right panel: Dual tabs for Context / Characters.
- Status bar displays generation progress and token statistics.

### v0.1.3

- Initial release version.
- Basic writing wizard workflow.
- OpenAI-compatible interface.
- TXT export.

---

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).

---

<div align="center">

**WUMU AI Novel Studio** — Let AI be your creative partner

⭐ If this project helps you, please give it a Star to show your support.

</div>
