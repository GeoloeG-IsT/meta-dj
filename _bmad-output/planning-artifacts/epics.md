---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ["docs/provided-prd.md", "_bmad-output/planning-artifacts/architecture.md", "_bmad-output/planning-artifacts/ux-design-specification.md"]
---

# meta-dj - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for meta-dj, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The system must ingest music from local storage or cloud services, analyzing it for musical metadata (Key, BPM, Beatgrid).
FR2: The system must allow for granular performance data editing (Hot Cues, Loops).
FR3: The system must export performance data to external media in the exact SQLite format (m.db, p.db) required by the hardware firmware.
FR4: The system must perform differential sync to external USB drives with database patching (INSERT INTO) to preserve existing history or cues.
FR5: The system must provide 4-layer deck playback with 3-band EQ, gain staging, and master limiter.
FR6: The system must implement high-quality time-stretching (Rubberband WASM) for Key Lock and Pitch Shifting.
FR7: The system must support client-side stem separation (Vocals, Drums, Bass, Other) using ONNX Runtime Web and WebGPU.
FR8: The system must render 60fps waveforms with "RGB", "Blue", and "3-Band" color modes.
FR9: The system must support Full-Text Search and Smartlists with a visual query builder.
FR10: The system must support standard MIDI control and Denon DJ HID protocols via WebMIDI and WebHID.

### NonFunctional Requirements

NFR1: The interface must maintain a locked 60fps refresh rate.
NFR2: Interaction latency must be <16ms; zero audio dropouts are acceptable.
NFR3: Database operations must use transactional integrity (WAL mode) to prevent corruption.
NFR4: The system must maintain strict binary compatibility with Engine DJ SQLite schemas (m.db, p.db).
NFR5: All processing must happen locally; no user data or audio leaves the device.
NFR6: The system must support libraries of 50,000+ tracks.
NFR7: Restrict support to Desktop Chromium-based browsers (Chrome/Edge).

### Additional Requirements

- Starter Template: Use `npm create vite@latest meta-dj -- --template react-ts`.
- Split-Brain Architecture: Core logic (Audio, Database, Hardware) must run in a dedicated `SharedWorker` or `AudioWorklet`.
- Data Transport: Use `SharedArrayBuffer` for high-frequency data transmission.
- Database Engine: Use SQLite WASM with OPFS backend.
- Audio Pipeline: Use AudioWorklet for DSP processing.
- Naming Conventions: Strict `snake_case` for DB, `PascalCase` for Components, `SCREAMING_SNAKE_CASE` for events.
- Project Structure: Feature-first modular structure (`src/modules/*`).
- Visual Precision: Render 60fps waveforms via WebGL.
- Input Strategy: No persistent visible inputs to prevent focus traps; "Type-Ahead" search.
- Destructive Actions: "Hold-to-Confirm" interaction (1.5s long press) for destructive actions.
- Theme: "OLED Black" (#000000) background with "Engine Green" (#4DFA90) accents.
- Keyboard Shortcuts: Specific mappings for Play (`Space`), Load (`Enter`), Nudge (`Shift+Arrows`), Search (`Ctrl+F`).
- Virtualization: Use DOM virtualization for track lists to support infinite scrolling.
- Pointer Lock: Use Pointer Lock API for rotary knobs to allow infinite drag.

### FR Coverage Map

### FR Coverage Map

FR1 (Ingest/Analysis): Epic 1 - Library ingestion and database creation.
FR2 (Cues/Loops): Epic 2 - Performance data editing.
FR3 (Export): Epic 4 - Export to SQLite m.db/p.db.
FR4 (Sync): Epic 4 - Differential sync to USB.
FR5 (Playback): Epic 3 - Audio engine and mixing.
FR6 (Time Stretch): Epic 2 (Analysis) & Epic 3 (Playback) - Analysis and real-time processing.
FR7 (Stems): Epic 2 - Client-side stem separation.
FR8 (Waveforms): Epic 2 - Visualization and rendering.
FR9 (Search): Epic 1 - Full-text search and smartlists.
FR10 (Hardware): Epic 4 - WebMIDI/WebHID control.

## Epic List

### Epic 1: The Librarian (Ingest & Organization)
**Goal:** Enable users to ingest local music libraries, manage metadata, and organize tracks into playlists and smartlists, establishing the foundational database structure.
**FRs covered:** FR1, FR9
**Key Features:** OPFS Database Mount, File Ingest, Playlist Management, Smartlist Query Builder, Full-Text Search.

### Epic 2: The Analyst (Preparation & Visualization)
**Goal:** Enable users to visualize audio with high precision, perform detailed track analysis (including stems), and prepare performance data (cues, loops, grids).
**FRs covered:** FR2, FR6 (Analysis), FR7, FR8
**Key Features:** 60fps WebGL Waveforms, Beatgrid Editing, Hot Cue/Loop Management, Stem Separation (WebGPU), Key/BPM Detection.

### Epic 3: The Performer (Playback & DSP)
**Goal:** Enable users to perform full DJ mixes with low-latency audio playback, time-stretching, and professional mixing controls (EQ, Gain, Filters).
**FRs covered:** FR5, FR6 (Playback)
**Key Features:** 4-Deck Audio Engine, Rubberband Time-Stretch, 3-Band EQ, Limiter, AudioWorklet DSP.

### Epic 1: The Librarian (Ingest & Organization)

**Goal:** Enable users to ingest local music libraries, manage metadata, and organize tracks into playlists and smartlists, establishing the foundational database structure.

**FRs covered:** FR1, FR9



### Story 1.1: Project Scaffolding & Shared Worker Setup



As a developer,

I want to initialize the project with Vite and establish the SharedWorker-based messaging kernel,

So that I have a high-performance foundation for the "Split-Brain" architecture that prevents UI lag from affecting core logic.



**Acceptance Criteria:**



**Given** the architecture requirements for meta-dj

**When** I initialize the project using the Vite React-TS template

**Then** the directory structure must match the "Feature-First" pattern defined in `architecture.md` (e.g., `src/modules`, `src/shared/kernel`)

**And** a `SharedWorker` must be successfully instantiated and connected to the main thread

**And** a typed message bus must be established supporting `WorkerMessage<T>` shapes with UUID correlation

**And** the Vite development server must be configured with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to enable `SharedArrayBuffer`

**And** the project must pass a basic "Heartbeat" test where the UI sends a `PING` and receives a `PONG` from the Worker.

### Story 1.2: OPFS Database Initialization & Mounting

As a developer,
I want to implement the SQLite WASM layer with the OPFS Access Handle backend,
So that I can mount and manipulate the Engine DJ database files (`m.db`, `p.db`) with native performance and binary compatibility.

**Acceptance Criteria:**

**Given** the SharedWorker established in Story 1.1
**When** the `database.worker.ts` starts
**Then** it must initialize SQLite WASM and request an OPFS file system handle
**And** it must expose a transactional API for executing raw SQL queries using WAL (Write-Ahead Logging) mode
**And** it must successfully mount an existing `m.db` file (if provided) or initialize a new one with the strict Engine DJ schema (Tables: Track, Playlist, PlaylistEntity, etc.)
**And** it must ensure all database writes are persisted to the OPFS handle such that they survive a page refresh.

### Story 1.3: Local Folder Ingestion & Track Scanning

As a user,
I want to select a local folder of music files and have them ingested into the library,
So that I can build my database without manually importing files one by one.

**Acceptance Criteria:**

**Given** the initialized database from Story 1.2
**When** I select a folder using the File System Access API
**Then** the system must recursively scan for supported audio files (MP3, WAV, AAC, FLAC, AIFF)
**And** it must read metadata (ID3 tags: Title, Artist, Album, BPM, Key) using a library like `music-metadata-browser`
**And** it must calculate a hash for each file to prevent duplicates
**And** it must INSERT new records into the `Track` table and persisting their relative paths
**And** it must display a progress bar in the UI reflecting the ingestion status.

### Story 1.4: Track List Virtualization & Rendering

As a user,
I want a high-performance track list that can handle tens of thousands of songs,
So that I can browse my collection smoothly without UI lag or memory issues.

**Acceptance Criteria:**

**Given** a database with thousands of ingested tracks
**When** I scroll through the main library view
**Then** the list must use DOM virtualization (e.g., `TanStack Virtual`) to render only the visible rows
**And** it must maintain a consistent 60fps refresh rate during scrolling
**And** it must apply the "OLED Black" design tokens and "Engine Blue" selection highlights defined in the UX spec
**And** it must use `tabular-nums` for numeric columns (BPM, Time) to prevent text jitter.

### Story 1.5: Playlist Tree Management

As a user,
I want to create and organize crates and playlists in a hierarchical structure,
So that I can categorize my music according to my performance needs.

**Acceptance Criteria:**

**Given** the library structure from previous stories
**When** I create a new crate or playlist
**Then** the system must add a row to the `Playlist` table with the correct `parentListId` to maintain the tree hierarchy
**And** when I add tracks to a playlist, it must correctly update the `PlaylistEntity` linked-list structure (`nextEntityId`) to preserve custom ordering
**And** the UI must render this as a recursive tree view with drag-and-drop support for moving tracks and reordering playlists.

### Story 1.6: Full-Text Search (FTS) & Type-Ahead

As a user,
I want to instantly find tracks by typing, without clicking a search bar,
So that I can search quickly during a performance without risk of "focus trapping" my keyboard shortcuts.

**Acceptance Criteria:**

**Given** the library view is active
**When** I start typing any character
**Then** the UI must automatically capture the input and filter the track list
**And** the backend must execute a Full-Text Search (FTS5) query against the `Track` table (Title, Artist, Album)
**And** the results must update with <50ms latency
**And** pressing `Esc` must clear the search and return focus to the track list.

### Story 1.7: Smartlist Visual Query Builder

As a user,
I want to create dynamic playlists based on rules (e.g., BPM > 120 and Genre is 'House'),
So that my music collection organizes itself automatically as I add new tracks.

**Acceptance Criteria:**

**Given** the library metadata from previous stories
**When** I open the Smartlist builder
**Then** I must be able to add multiple rules with logic (AND/OR) for fields like BPM, Key, Genre, Rating, and Date Added
**And** the system must translate these rules into a SQL `WHERE` clause to execute against the `Track` table
**And** the resulting smartlist must update dynamically whenever the library database changes.

### Epic 2: The Analyst (Preparation & Visualization)
**Goal:** Enable users to visualize audio with high precision, perform detailed track analysis (including stems), and prepare performance data (cues, loops, grids).
**FRs covered:** FR2, FR6 (Analysis), FR7, FR8

### Story 2.1: WebGL Waveform Renderer

As a user,
I want to see a high-resolution, frequency-colored waveform of the playing track,
So that I can anticipate track structure and transients visually.

**Acceptance Criteria:**

**Given** an analyzed audio track
**When** the track is loaded into a deck
**Then** the system must compute a 3-band FFT and render the waveform using WebGL (`Pixi.js` or custom fragment shader)
**And** it must support "RGB" (frequency-colored), "Blue", and "3-Band" color modes at 60fps
**And** the visualization must remain synchronized with the audio playhead with <16ms latency
**And** the "Overview Waveform" must allow "Needle Drop" seeking with visual feedback.

### Story 2.2: Automated Track Analysis (BPM/Key/Grid)

As a user,
I want the system to automatically calculate the BPM, Key, and Beatgrid for my music,
So that I have accurate data for syncing and performance without manual entry.

**Acceptance Criteria:**

**Given** an ingested track with no analysis data
**When** I trigger a "Track Analysis" action
**Then** the system must utilize a WASM-compiled library (e.g., ported from `librosa` or `aubio`) to detect BPM and musical Key
**And** it must generate a `beatData` binary blob containing beatgrid anchors
**And** it must store this analysis data in the `PerformanceData` table of the `p.db` database
**And** it must update the UI with the detected BPM and Camelot Key (e.g., "8A") instantly.

### Story 2.3: "Slip-Under" Beatgrid Editing

As a user,
I want to surgically adjust the beatgrid by moving the audio waveform under a fixed grid marker,
So that I can ensure 100% accurate sync for tracks with complex transients.

**Acceptance Criteria:**

**Given** the WebGL waveform from Story 2.1
**When** I hover over the waveform and use `Shift + Drag`
**Then** the system must enter "Slip Mode" where the waveform follows the mouse 1:1 while the playhead remains static
**And** it must show "Magnetic Snap" visual feedback when a transient aligns with a grid marker
**And** it must update the `beatData` binary blob in `p.db` with the new sample offset upon release
**And** it must show a brief "Saved" toast to confirm the database write.

### Story 2.4: Hot Cue & Loop Management

As a user,
I want to set, color-code, and name Hot Cues and Loops on the waveform,
So that I can mark specific performance sections and trigger them during a set.

**Acceptance Criteria:**

**Given** a loaded track in the deck
**When** I press a performance pad (UI or MIDI)
**Then** the system must record the current sample position and add a `quickCue` or `loop` entry in the `p.db` database
**And** it must visually render the cue/loop marker on the WebGL waveform at the exact sample position
**And** it must support renaming and color selection for each cue via a custom context menu
**And** the changes must be reflected instantly in the UI and persisted to the SQLite database.

### Story 2.5: Client-Side Stem Separation (WebGPU)

As a user,
I want to isolate or mute vocals, drums, bass, and other instruments from a track,
So that I can create live remixes and mashups without specialized source files.

**Acceptance Criteria:**

**Given** a track and a browser supporting WebGPU
**When** I trigger "Analyze Stems"
**Then** the system must initialize an `ONNX Runtime Web` session using the `Demucs v4` model
**And** it must perform the inference locally using WebGPU acceleration (with a WASM fallback if necessary)
**And** it must generate 4 distinct audio buffers (Vocals, Drums, Bass, Other)
**And** it must provide UI toggles to mute/solo these stems in real-time during playback.

### Epic 3: The Performer (Playback & DSP)
**Goal:** Enable users to perform full DJ mixes with low-latency audio playback, time-stretching, and professional mixing controls (EQ, Gain, Filters).
**FRs covered:** FR5, FR6 (Playback)

### Story 3.1: AudioWorklet Deck Engine

As a developer,
I want to implement a sample-accurate audio engine in an `AudioWorklet`,
So that playback remains glitch-free even during heavy UI rendering or garbage collection.

**Acceptance Criteria:**

**Given** the "Split-Brain" architecture from Epic 1
**When** a track is loaded into a deck
**Then** the `AudioWorkletNode` must handle the audio buffer processing in a high-priority thread
**And** it must support standard transport controls (Play, Pause, Cue, Seek) with <16ms latency
**And** it must provide high-resolution playhead position data to the UI via `SharedArrayBuffer`
**And** it must handle sample-rate conversion to ensure tracks play correctly regardless of hardware output settings.

### Story 3.2: 3-Band EQ & Master Limiter

As a user,
I want to adjust the High, Mid, and Low frequencies and control the overall volume of each deck,
So that I can blend tracks smoothly and prevent audio clipping.

**Acceptance Criteria:**

**Given** the AudioWorklet engine from Story 3.1
**When** I adjust the EQ knobs in the UI
**Then** the `AudioWorklet` must apply a 3-band filter chain (Low, Mid, High) with adjustable crossover frequencies
**And** it must include a `GainNode` for channel volume and a master `DynamicsCompressorNode` to act as a limiter
**And** it must provide real-time peak metering data to the UI via `SharedArrayBuffer` for visual feedback.

### Story 3.3: Real-Time Time-Stretching (Rubberband WASM)

As a user,
I want to change the tempo of a track without changing its musical pitch (Keylock),
So that I can mix tracks of different BPMs while maintaining harmonic compatibility.

**Acceptance Criteria:**

**Given** the AudioWorklet engine from Story 3.1
**When** I activate "Keylock" and adjust the tempo slider
**Then** the `AudioWorklet` must process the audio buffer through a WASM-compiled `Rubberband` library instance
**And** it must allow independent manipulation of tempo and pitch in real-time
**And** the audio quality must match "professional grade" standards with minimal artifacts even at +/- 20% tempo changes.

### Story 3.4: "Pointer Lock" Rotary Controls

As a user,
I want to adjust knobs with extreme precision without the mouse cursor hitting the edge of the screen,
So that I have a tactile and reliable control experience similar to physical hardware.

**Acceptance Criteria:**

**Given** the EQ and Gain knobs in the UI
**When** I click and drag a knob
**Then** the system must utilize the `Pointer Lock API` to hide the cursor and capture infinite mouse movement
**And** the knob value must update based on vertical mouse movement with adjustable sensitivity
**And** releasing the mouse must release the pointer lock and return the cursor to its original position.

### Story 3.5: Master Clock & Sync Logic

As a user,
I want to synchronize the phase and tempo of multiple decks automatically,
So that I can maintain perfectly aligned mixes with minimal manual "nudging".

**Acceptance Criteria:**

**Given** multiple decks with analyzed beatgrid data from Story 2.2
**When** I press "Sync" on a target deck
**Then** the system must calculate the phase difference relative to the "Master" deck and apply a temporary playback rate adjustment to align them
**And** it must set the target deck's tempo to match the Master deck's BPM
**And** it must maintain this synchronization even if the Master deck's tempo changes.

### Epic 4: The Touring Pro (Hardware Sync & Control)
**Goal:** Enable users to export their prepared library to external media for standalone hardware use and control the application via physical DJ hardware.
**FRs covered:** FR3, FR4, FR10

### Story 4.1: USB Drive Detection & Access

As a user,
I want to select an external USB drive as an export target,
So that I can transfer my prepared library to physical media.

**Acceptance Criteria:**

**Given** the library manager view
**When** I connect a USB drive and select "Add Drive"
**Then** the system must invoke `window.showDirectoryPicker()` to request access
**And** it must check if a valid Engine DJ database structure already exists on the drive
**And** it must generate a new UUID for the drive if it's a fresh initialization
**And** it must mount the external `m.db` via SQLite WASM (if present) for reading.

### Story 4.2: Differential Library Export & Verification

As a user,
I want to sync only the new or changed tracks to my USB drive,
So that the export process is fast and I can trust my data is valid.

**Acceptance Criteria:**

**Given** a connected USB drive from Story 4.1
**When** I trigger an "Export" for a playlist
**Then** the system must identify tracks present in the collection but missing from the drive
**And** it must stream the audio files to the USB drive handle and perform an `INSERT INTO` patch on the drive's SQLite database
**And** it must calculate and compare checksums for each transferred file to ensure 100% data integrity
**And** it must show a detailed progress bar and a final "Safe to Eject" confirmation upon successful verification.

### Story 4.3: WebMIDI Controller Mapping

As a user,
I want to control the application using any standard MIDI DJ controller,
So that I have tactile control over my mix.

**Acceptance Criteria:**

**Given** the isolated `hardware.worker.ts` from Epic 1
**When** a MIDI device is connected via `navigator.requestMIDIAccess()`
**Then** the system must allow users to "learn" mappings for Play, Cue, Faders, and Knobs
**And** it must normalize MIDI CC and Note signals into application events (e.g., `LOAD_TRACK_DECK_A`)
**And** it must support MIDI output (feedback) to light up buttons and LED rings on the controller.

### Story 4.4: WebHID Denon DJ Prime Integration

As a user,
I want advanced control over my Denon DJ hardware, including high-resolution platter data,
So that I have a 1:1 hardware control experience previously only available on desktop.

**Acceptance Criteria:**

**Given** a connected Denon DJ Prime controller (SC6000, Prime 4)
**When** the user grants permission for the specific `VendorID/ProductID`
**Then** the system must open a `WebHID` connection and poll for input reports
**And** it must parse HID reports to handle platter velocity for scratching, RGB pad colors, and button presses not exposed via MIDI
**And** it must send HID "Feature Reports" to control brake settings on motorized platters.

### Story 4.5: Hardware Screen Painting via WebHID

As a user,
I want to see my track waveforms and album art on the controller's physical screens,
So that I don't have to look at my laptop screen during a performance.

**Acceptance Criteria:**

**Given** the WebHID connection from Story 4.4
**When** a track is loaded and playing
**Then** the system must construct binary feature reports containing waveform peak data and album art bitmaps (JPEGs)
**And** it must send these reports via WebHID to the hardware's display endpoint
**And** the data must update in real-time (at least 20-30fps) to provide smooth visual feedback on the hardware screens.
