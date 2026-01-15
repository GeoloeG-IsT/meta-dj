---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ["docs/provided-prd.md", "_bmad-output/planning-artifacts/architecture.md", "_bmad-output/planning-artifacts/ux-design-specification.md"]
---

# meta-dj - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for meta-dj, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: **Library Ingestion** - Ingest and manage local music libraries via File System Access API from local disk.
- FR2: **Database Management** - Maintain a strict Engine DJ compatible SQLite database (m.db) including linked-list playlist hierarchies.
- FR3: **Advanced Search** - Provide Full-Text Search (FTS) and Smartlist rule builder for filtering tracks.
- FR4: **Audio Playback** - 4-deck playback with 3-band EQ, gain staging, and limitation via Web Audio API.
- FR5: **DSP & Time-Stretch** - High-quality real-time time-stretching (Key Lock) and pitch shifting using Rubberband WASM.
- FR6: **Performance Tools** - Hot Cues, Loops, and Beatgrid editing with "magnetic snap".
- FR7: **Stem Separation** - Client-side real-time stem separation (Vocals, Drums, Bass, Other) using ONNX Runtime/WebGPU.
- FR8: **Hardware Integration** - 1:1 hardware control via WebMIDI (standard) and WebHID (screens/haptics).
- FR9: **Sync Manager** - Differential sync to external USB drives with database patching (INSERT INTO).
- FR10: **Visualizations** - 60fps high-performance waveform rendering (RGB, Blue, 3-Band) using WebGL/Pixi.js.

### NonFunctional Requirements

- NFR1: **Performance** - Locked 60fps UI with <16ms interaction latency.
- NFR2: **Reliability** - Zero audio dropouts; audio processing must be isolated from main thread GC.
- NFR3: **Data Integrity** - ACID-compliant data storage using SQLite WASM over OPFS (WAL mode).
- NFR4: **Scalability** - specific support for 50,000+ track libraries using virtual scrolling.
- NFR5: **Compatibility** - Strict binary compatibility with Engine DJ schemas (m.db, p.db).
- NFR6: **Privacy** - Local-first architecture; no user data or audio leaves the device.
- NFR7: **Platform** - Desktop Chromium (Chrome/Edge) support only.

### Additional Requirements

- **Architecture:** Implement "Split-Brain Actor Model" with Worker/Shell separation.
- **Architecture:** Use Vite + React + TypeScript starter template.
- **Architecture:** Enforce WebGPU requirement for Stems feature.
- **UX:** "Zero-Install" ingestion workflow via Drag & Drop.
- **UX:** "Surgical" grid editing with "slip-under" interaction mechanic.
- **UX:** "Cockpit" density design with OLED Black theme and "Engine Green" accents.
- **UX:** "No Visible Inputs" strategy to prevent keyboard focus trapping (Spacebar must always be Play).
- **UX:** "Active Ring" focus strategy for keyboard navigation.

### FR Coverage Map

FR1: Epic 1 - Ingest and manage local music
FR2: Epic 1 - Database and playlist management
FR3: Epic 1 - Search and smartlists
FR4: Epic 3 - Audio playback and mixing
FR5: Epic 2 - Time-Stretch/Key Lock (DSP)
FR6: Epic 2 - Beatgrid Analysis / Epic 3 - Cues & Loops (Mixed)
FR7: Epic 2 - Stem Separation
FR8: Epic 4 - Hardware Integration
FR9: Epic 4 - Sync Manager
FR10: Epic 3 - Visualizations

## Epic List

### Epic 1: Core Library Management
**Goal:** Enable DJs to ingest their local music folder, organize tracks into playlists, and search their collection with instant performance.
**User Value:** "I can get my music into the app and organize it exactly like I do on my hardware."
**FRs Covered:** FR1, FR2, FR3, NFR3, NFR4

### Epic 2: Track Analysis & DSP
**Goal:** Enable DJs to process their tracks to extract Stems, Key, and Beatgrid data required for professional performance.
**User Value:** "I can prepare my tracks with high-quality stem separation and accurate beatgrids."
**FRs Covered:** FR5, FR7, FR6 (Analysis)

### Epic 3: Professional Performance Deck
**Goal:** Enable DJs to load tracks, visualize waveforms at 60fps, and perform mixes with EQ, Loops, and Hot Cues.
**User Value:** "I can actually mix and perform with my music in the browser with hardware-grade response."
**FRs Covered:** FR4, FR6 (Performance), FR10, NFR1, NFR2

### Epic 4: Hardware Export & Integration
**Goal:** Enable DJs to bridge their web library to the physical world by exporting to USB and connecting hardware controllers.
**User Value:** "I can take my work from the browser to the stage."
**FRs Covered:** FR8, FR9, FR5 (Compatibility)

## Epic 1: Core Library Management

**Goal:** Enable DJs to ingest their local music folder, organize tracks into playlists, and search their collection with instant performance.

### Story 1.1: Architecture & Database Initialization

As a Developer,
I want to initialize the "Split-Brain" Worker and SQLite database,
So that the heavy business logic runs off the main thread.

**Acceptance Criteria:**

**Given** the application loads
**When** the app initializes
**Then** it should spawn a dedicated Web Worker (the "Brain")
**And** establish a robust messaging bridge (e.g., Comlink or custom UUID system) between UI and Worker
**And** the Worker should initialize SQLite WASM and mount OPFS
**And** create the `m.db` and `p.db` files with the correct Engine DJ schema (Track, Playlist tables)
**And** verify WAL mode is active

### Story 1.2: Local Folder Ingestion

As a DJ,
I want to import a local folder of music files,
So that I can populate my library with my existing collection.

**Acceptance Criteria:**

**Given** the user is on the Library screen
**When** they drag and drop a folder or click "Import Folder"
**Then** the browser should request read permission via File System Access API
**And** the app should scan the folder recursively for supported audio files (MP3, WAV, AIFF, FLAC, M4A)
**And** for each file, extract metadata (Artist, Title, BMP, Key, Artwork) using a parsing library
**And** insert a record into the `Track` table for each file
**And** show a progress bar indicating import status
**And** handle duplicates by checking file hashes or filenames

### Story 1.3: Library UI - Virtualized Track List

As a DJ,
I want to scroll through my library of 50,000+ tracks smoothly at 60fps,
So that I can find music instantly without interface lag.

**Acceptance Criteria:**

**Given** the library contains >50,000 tracks
**When** the user scrolls the track list quickly
**Then** the scrolling should remain fluid (60fps) using DOM virtualization (windowing)
**And** only the visible rows should be rendered in the DOM
**And** columns (Status, Title, Artist, BPM, Key, Rating) should be properly aligned
**And** I should be able to sort by clicking column headers
**And** the currently playing track should be visually distinct (highlighted)

### Story 1.4: Playlist Management (Linked Lists)

As a DJ,
I want to create playlists and reorder tracks within them,
So that I can curate specific sets for my performances.

**Acceptance Criteria:**

**Given** I have tracks in my collection
**When** I create a new Playlist
**Then** a new record is inserted into the `Playlist` table
**And** I can drag tracks from the Collection into the Playlist
**When** I drag tracks *within* a playlist to reorder them
**Then** the UI should update immediately
**And** the `PlaylistEntity` table should be updated to reflect the new linked-list order (`nextEntityId` pointers)
**And** the order must be preserved when reloading the application

### Story 1.5: Advanced Search & Smartlists

As a DJ,
I want to search my library using text and dynamic rules,
So that I can instantly execute complex queries to find specific tracks.

**Acceptance Criteria:**

**Given** a populated library
**When** I type in the global search bar
**Then** results should appear instantly (<100ms) filtering by Title, Artist, Album, or Comment
**And** the search should use SQLite's FTS5 (Full Text Search) module for performance
**When** I create a Smartlist with rules (e.g., "BPM > 120" AND "Genre contains House")
**Then** the list should auto-populate with matching tracks
**And** the rules should be translated to valid SQL `WHERE` clauses for execution

## Epic 2: Track Analysis & DSP

**Goal:** Enable DJs to process their tracks to extract Stems, Key, and Beatgrid data required for professional performance.

### Story 2.1: Audio Analysis Core (BPM & Key)

As a DJ,
I want the system to analyze my tracks for BPM and Key,
So that I can mix tracks harmonically and keep them in sync.

**Acceptance Criteria:**

**Given** a track is imported but unanalyzed
**When** the user triggers "Analyze Track" (or auto-analysis runs)
**Then** the audio should be decoded and processed by a WASM analysis module (e.g., based on aubio or librosa)
**And** the BPM should be detected with <1% variance
**And** the Musical Key should be detected and mapped to the Camelot System (e.g., "8A", "1B")
**And** the results should be saved to the `Track` table in `m.db`

### Story 2.2: Stem Separation Pipeline (AI)

As a DJ,
I want to separate a track into Vocals, Drums, Bass, and Instruments,
So that I can perform live remixing.

**Acceptance Criteria:**

**Given** a compatible browser with WebGPU support
**When** I request "Analyze Stems" for a track
**Then** the application should initialize the ONNX Runtime Web session with the quantized Demucs model
**And** process the audio using client-side GPU acceleration
**And** return 4 synchronized stereo audio buffers (one for each stem)
**And** fail gracefully with an error if WebGPU is unavailable

### Story 2.3: Stems Persistence & Management

As a DJ,
I want my generated stems to be saved to disk,
So that I don't have to re-analyze the track every time I load it.

**Acceptance Criteria:**

**Given** the stem separation (Story 2.2) has completed successfully
**When** the analysis finishes
**Then** the 4 stems should be interleaved into a multi-channel/stem file format (or managed folder structure)
**And** saved to the Stems folder in OPFS or the local file system
**And** the database record for the track should be updated to link to this new stem file
**And** loading the track subsequently should load the pre-separated stems instantly

### Story 2.4: Beatgrid & Transient Detection

As a DJ,
I want accurate beatgrids generated for my tracks,
So that the "Sync" button works correctly during a mix.

**Acceptance Criteria:**

**Given** an audio file is being analyzed
**When** transient detection runs
**Then** it should identify the specific sample position of the first beat (downbeat)
**And** calculate the sample interval between beats based on the BPM
**And** generate the binary `beatData` blob required by the `p.db` schema
**And** this data must match the binary format expected by Denon DJ hardware

### Story 2.5: Time-Stretching & Pitch-Shifting (Rubberband)

As a DJ,
I want to change the tempo of a song without changing its pitch (Key Lock),
So that I can mix tracks of different speeds without them sounding like chipmunks.

**Acceptance Criteria:**

**Given** a track is playing
**When** I enable "Key Lock" and move the pitch fader
**Then** the playback speed should change BUT the pitch should remain constant
**And** the audio artifacting should be minimal (professional quality) using the Rubberband library (WASM) running in an AudioWorklet
**And** the audio artifacting should be minimal (professional quality) using the Rubberband library (WASM) running in an AudioWorklet
**And** the processing latency should remain low enough for real-time scratching or manipulation

## Epic 3: Professional Performance Deck

**Goal:** Enable DJs to load tracks, visualize waveforms at 60fps, and perform mixes with EQ, Loops, and Hot Cues.

### Story 3.1: Audio Graph Architecture (The AudioWorklet)

As a Developer,
I want to establish the Web Audio API graph with independent AudioWorklets,
So that audio processing happens on a separate thread from the UI to prevent dropouts.

**Acceptance Criteria:**

**Given** the application initializes
**When** the audio engine starts
**Then** it should create an `AudioContext` and load the custom AudioWorklet processor
**And** the audio graph should support 4 independent deck channels summing to a Master output
**And** the processing loop should run in the AudioWorklet thread, isolated from the main thread garbage collection
**And** communication between UI and Audio thread should use `SharedArrayBuffer` for low-latency control

### Story 3.2: Waveform Visualization System (WebGL)

As a DJ,
I want smooth 60fps scrolling waveforms that visualize the music's frequency content,
So that I can visually align beats and see drops coming.

**Acceptance Criteria:**

**Given** a track is loaded and analyzing/analyzed
**When** the track plays
**Then** the waveform should render using Pixi.js (WebGL) for GPU acceleration
**And** it should support "RGB" (frequency), "Blue" (intensity), and "3-Band" color modes matching Engine DJ
**And** the playhead should remain centered (or moving) with 60fps smoothness
**And** zoom levels should be adjustable via pinch or UI controls

### Story 3.3: Transport & Playback Logic

As a DJ,
I want standard transport controls (Play, Pause, Cue) that react instantly,
So that I can start and stop tracks precisely on beat.

**Acceptance Criteria:**

**Given** a track is loaded
**When** I press the Play/Pause button (or Spacebar)
**Then** playback should toggle instantly (<16ms latency)
**When** I press CUE
**Then** it should return to the cue point and pause
**And** finding a cue point using the jogwheel/scrub should allow "stutter" preview logic

### Story 3.4: Mixer & EQ Implementation

As a DJ,
I want to control the volume and equalization of each deck,
So that I can blend tracks together smoothly.

**Acceptance Criteria:**

**Given** audio is playing
**When** I adjust the High, Mid, or Low EQ knobs
**Then** the specific frequency bands should be attenuated or boosted using BiquadFilterNodes
**When** I move the deck fader or crossfader
**Then** the volume should adjust according to the selected fader curve (Linear, Logarithmic)
**And** a Limiter should prevent the Master output from clipping (distorting)

### Story 3.5: Performance Pad Features

As a DJ,
I want to trigger Hot Cues and Auto Loops using pads,
So that I can remix and extend tracks live.

**Acceptance Criteria:**

**Given** a track is playing
**When** I press a Hot Cue pad
**Then** playback should jump instantly to that position
**And** if Quantize is ON, it should snap to the nearest beat
**When** I engage an Auto Loop (e.g., 4 beats)
**Then** the playback should cycle seamlessly within that region
**And** the loop UI should clearly indicate the active region

## Epic 4: Hardware Export & Integration

**Goal:** Enable DJs to bridge their web library to the physical world by exporting to USB and connecting hardware controllers.

### Story 4.1: USB Export Manager (Sync)

As a DJ,
I want to sync my library changes to a USB drive,
So that I can plug it into a Denon DJ player and perform without my laptop.

**Acceptance Criteria:**

**Given** a USB drive is selected
**When** I click "Sync Manager"
**Then** the system should compare the local database with the USB database
**And** identify new tracks and playlists
**And** copy the audio files to the USB drive
**And** execute `INSERT` or `UPDATE` SQL statements on the USB's `m.db` to add the metadata
**And** ensure the resulting database is readable by Engine OS hardware

### Story 4.2: WebMIDI Controller Support

As a DJ,
I want to use my physical DJ controller to mix,
So that I have tactile control over the software.

**Acceptance Criteria:**

**Given** a certified MIDI controller is connected via USB
**When** the application detects the device via WebMIDI API
**Then** it should load the correct MIDI mapping profile
**And** pressing physical buttons (Play, Cue, Pads) should trigger the corresponding app actions
**And** moving faders and knobs should adjust the app UI and audio parameters instantly
**And** button LEDs on the hardware should light up to reflect the app state

### Story 4.3: WebHID Screen & Haptics Integration

As a DJ,
I want to see track info on my controller's screen and feel the jogwheel spin,
So that I have a complete professional experience.

**Acceptance Criteria:**

**Given** a compatible HID device (e.g., Prime 4, SC6000)
**When** the HID connection is established
**Then** the app should send track metadata and artwork buffer to the hardware screens
**And** the motorized platters (if available) should spin at the correct BPM
**And** the screen updates should happen at a high refresh rate to prevent lag
**And** specific proprietary HID protocols must be reverse-engineered or implemented correctly
