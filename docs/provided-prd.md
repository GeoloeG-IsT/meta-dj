# MetaDJ: A Comprehensive Product Requirements Document for a Professional Browser-Based DJ Ecosystem

## 1. Executive Summary and Strategic Vision

### 1.1 The Shift to Browser-Based Professional Audio
The landscape of professional audio software has historically been tethered to high-performance desktop operating systems, primarily macOS and Windows, due to the stringent requirements of low-latency audio processing, direct hardware access, and massive file management. However, the maturation of web standards in 2025—specifically WebAssembly (WASM), the File System Access API, and WebGPU—has created an inflection point. It is now theoretically and practically feasible to deploy a Digital Audio Workstation (DAW) or professional DJ performance tool entirely within a Chromium-based browser. MetaDJ is conceived as the vanguard of this shift: a 1:1 web-based replication of the industry-standard Engine DJ desktop software.

Unlike simplified consumer web DJ applications that rely on streaming libraries and basic crossfading, MetaDJ targets the professional "embedded systems" workflow. Its primary mandate is to serve as a platform-agnostic library management and performance tool that maintains binary compatibility with the proprietary database architectures used by Denon DJ and Numark hardware. By decoupling the DJ's library from the operating system, MetaDJ resolves critical pain points regarding database corruption, cross-platform file system incompatibilities (NTFS vs APFS vs exFAT), and the accessibility of library management tools in "emergency" scenarios where a DJ's primary laptop is unavailable.

### 1.2 Product Philosophy and User Persona
The target user for MetaDJ is the "Touring Professional" and the "Hardware Purist." This user owns standalone hardware (e.g., SC6000 Prime, Prime 4) and views the computer merely as a staging ground for preparing USB drives.1 They require absolute reliability; a corrupted database or a misaligned beatgrid is a show-stopping failure. Consequently, MetaDJ prioritizes data integrity and precision over "toy" features.

The application must function as a seamless bridge. It must ingest music from local storage or cloud services, analyze it for musical metadata (Key, BPM, Beatgrid), allow for granular performance data editing (Hot Cues, Loops), and export this data to external media in the exact SQLite format (m.db, p.db) required by the hardware firmware. The user interface (UI) must mirror the dark, high-contrast, touch-friendly aesthetic of the Engine OS to minimize cognitive load during the transition between software and hardware environments.

### 1.3 Scope of the PRD
This Product Requirements Document (PRD) outlines the technical and functional specifications for building MetaDJ. It translates the feature set documented in the Engine DJ User Guide v4.3.0 1 into a modern web application architecture. The document dissects the proprietary database schema, proposes a high-performance technology stack capable of handling 50,000+ track libraries 1, and details the implementation of client-side DSP (Digital Signal Processing) for features like time-stretching and stem separation.

## 2. Technical Architecture and Proposed Stack
The construction of MetaDJ requires a departure from traditional "MERN stack" web development. The requirements for real-time audio scheduling, binary file manipulation, and hardware communication demand a systems-programming approach adapted for the browser execution environment.

### 2.1 Core Application Framework: React 19
The foundational layer of MetaDJ will be built on React 19, utilizing its latest concurrent rendering features. While Vue.js offers a rapid development curve, React's ecosystem for complex state management and its specific optimizations for high-frequency updates make it the superior choice for a DAW-like interface.3

In a DJ application, the state changes hundreds of times per second—playheads move, volume meters fluctuate, and beat counters tick. React's virtual DOM, when combined with transient state managers like Zustand or Jotai, allows for these updates to occur bypassing the traditional React render cycle for specific, high-performance components. This "transient update" pattern is crucial for maintaining a locked 60fps (or higher on high refresh displays) interface while the main thread handles heavy I/O operations.

Furthermore, the component architecture must be strictly typed using TypeScript. The Engine DJ database schema involves complex relationships between Tracks, Playlists, and Performance Data blobs.2 TypeScript interfaces mirroring these C++ structures (as seen in libdjinterop 5) are essential for preventing runtime errors during database serialization.

### 2.2 The Database Engine: SQLite WASM over OPFS
The single most critical technical decision for MetaDJ is the database engine. Engine DJ uses SQLite files (m.db, p.db) to store all metadata and performance information.2 Browsers natively support IndexedDB, but IndexedDB is a document/object store and is not binary-compatible with the SQL files required by the hardware players.

Therefore, MetaDJ must utilize SQLite WASM (the official WebAssembly build of SQLite). However, running SQLite in the browser presents a persistence challenge. Standard local storage or IndexedDB backends for SQLite WASM are slow and can block the main thread. The solution is the Origin Private File System (OPFS). OPFS provides a high-performance, file-system-like storage bucket that SQLite WASM can interface with via the Access Handle backend.6

This architecture allows MetaDJ to:
Mount the user's existing m.db file from their local disk into the browser's virtual file system.
Perform complex SQL JOIN operations (e.g., linking PlaylistEntity to Track) with near-native performance.7
Write changes back to the disk file safely using transactional integrity (WAL mode), ensuring the database is not corrupted if the browser crashes or the tab is closed.8

### 2.3 The Audio Core: Web Audio API & AudioWorklet
The main JavaScript thread is prone to "jank" caused by garbage collection or heavy UI layout thrashing. For a professional DJ application, audio dropouts are unacceptable. MetaDJ will leverage the Web Audio API with a strict reliance on AudioWorklet.

The AudioWorklet interface allows custom audio processing scripts to run in a separate, high-priority thread, distinct from the main UI thread.9 This is where the mixing engine (EQs, filters, summing), gain staging, and metering logic will reside.

For the specific requirement of "Key Lock" (Time-Stretching) and Pitch Shifting 1, the native browser playback rate algorithms are insufficient in quality. MetaDJ must implement the Rubberband Library, a high-quality C++ time-stretching library, compiled to WebAssembly.11 This WASM module will run inside the AudioWorklet, processing the audio buffer in real-time to allow independent manipulation of tempo and pitch, replicating the "Elastique Pro" algorithms used in the desktop software.

### 2.4 Stem Separation: Client-Side AI with ONNX
Engine DJ features Stem separation 1, a processor-intensive task typically reserved for high-end GPUs. To bring this to the web without incurring massive server costs or latency, MetaDJ will utilize ONNX Runtime Web.

We will deploy a quantized version of the Demucs v4 Hybrid Transformer model.13 ONNX Runtime Web can accelerate this model using WebGPU, the successor to WebGL, which provides low-level access to the user's GPU compute shaders.15 This allows the stem separation (splitting a track into Vocals, Drums, Bass, Other) to happen locally on the user's device, respecting privacy and enabling offline functionality.

### 2.5 Hardware Abstraction Layer: WebHID & WebMIDI
To fulfill the requirement of "Engine DJ Hardware" compatibility, the browser must communicate with physical devices.

WebMIDI API: This will handle standard control signals—fader movements, button presses, and knob turns.17 It is widely supported and offers low-latency communication.
WebHID API: Denon DJ Prime hardware uses Human Interface Device (HID) protocols for advanced features, such as sending album art bitmaps to the jog wheel displays, receiving high-resolution platter position data (essential for scratching), and controlling the RGB feedback on performance pads.18 WebHID allows the browser to send and receive these raw "Feature Reports," enabling deep integration previously possible only with native drivers.

### 2.6 The Tech Stack Summary Table
Component | Technology Selection | Justification
--- | --- | ---
Frontend Framework | React 19 + TypeScript | Concurrent rendering for high-freq UI; Type safety for complex schemas.
State Management | Zustand (Transient Updates) | High-performance, unopinionated state management without re-render overhead.
Database Engine | SQLite WASM (OPFS Backend) | Binary compatibility with Engine OS; High-performance SQL queries.
Audio DSP | AudioWorklet + Rubberband (WASM) | Glitch-free audio thread; Professional grade time-stretching.
AI / Stems | ONNX Runtime Web (WebGPU) | Client-side inference of Demucs models; Privacy and offline capability.
Hardware I/O | WebMIDI + WebHID | Full support for controllers, screens, and haptic platters.
File Access | File System Access API | Direct read/write to local HDD/USB without upload.
Visualizations | Pixi.js (WebGL) | GPU-accelerated 2D rendering for 60fps waveforms.20

## 3. Detailed Data Architecture and Schema Analysis
The interoperability of MetaDJ hinges entirely on its ability to correctly parse and modify the Engine Library database. The Engine Library consists of a folder structure containing audio files and a Database2 folder housing the SQLite files.1

### 3.1 The Schema Breakdown
Based on the analysis of libdjinterop and community reverse-engineering efforts 2, the database is split into two primary files: m.db (Metadata) and p.db (Performance). MetaDJ must treat these schemas as rigid contracts.

#### 3.1.1 The Metadata Database (m.db)
This database acts as the catalog. It contains the following critical tables:
Track: The central entity. Columns include id, filename (name of the file), path (relative path from the database root), bpm (analyzed tempo), key (musical key index), duration, and foreign keys to album art.
Playlist & PlaylistEntity: This implements a nested tree structure for crates and playlists.
Playlist: Contains id, title, and parentListId. The parentListId allows for the folder hierarchies described in the User Guide.1
PlaylistEntity: This is the join table linking Playlist to Track. Crucially, it creates an ordered list using a nextEntityId linked-list pattern, which allows for specific track ordering within a playlist.
AlbumArt: Stores the images. Unlike typical web apps that store URLs, Engine DJ stores the raw binary image data (JPEG/PNG) directly in a BLOB column, hashed to prevent duplicates.2 MetaDJ must render these blobs using URL.createObjectURL(blob) for display in the browser.

#### 3.1.2 The Performance Database (p.db)
This database stores the analysis data required for playback features.
PerformanceData: This table links 1:1 with the Track table in m.db. It contains heavy binary blobs:
trackData: A compressed representation of the overview waveform (the small waveform showing the whole track).2
highResolutionWaveFormData: The detailed zoom waveform data.
beatData: The Beatgrid anchors. This is a binary structure containing the sample offset of beat markers. MetaDJ must parse this binary format to render grid lines on the waveform and support the "Sync" feature.
quickCues & loops: Stores the position (in samples), color, and name of Hot Cues and Loops.

### 3.2 Database constraints and Integrity
The Engine OS hardware is extremely sensitive to schema deviations.
UUIDs: The Information table contains a UUID that uniquely identifies the database.2 When syncing to an external drive, MetaDJ must generate a new UUID for the external database to ensure the hardware treats it as a distinct library.
Path Resolution: The path column in the Track table is relative. MetaDJ must dynamically resolve this path based on the root directory handle obtained via the File System Access API. This allows the library to be portable; if the user moves the "Engine Library" folder, the relative paths within the database remain valid.

## 4. Functional Module: The Librarian (Collection Management)
The "Librarian" module is the user's entry point, replicating the "Collection Pane" and "Track List" functionality of the desktop software.1

### 4.1 Library Ingestion and File System Access
Requirement: Users must be able to load their existing Engine DJ library or create a new one from a folder of music files.
Implementation:
Upon launch, MetaDJ requests access to a local directory via window.showDirectoryPicker().
It scans for Engine Library/Database2/m.db.
If found, it mounts the file into SQLite WASM.
If not found, it initializes a fresh SQLite database in memory and offers to "Import Music."
Import Logic: When dragging a folder of music into the browser, MetaDJ traverses the file handles. It reads ID3 tags (using a library like music-metadata-browser), calculates the file hash (for duplicate detection), and inserts records into the Track table. It simultaneously copies the audio file to the local OPFS mirror if necessary for offline persistence.

### 4.2 Advanced Search and Smartlists
The Engine DJ User Guide highlights "Smartlists" as a key feature.1 This is a dynamic playlist generated by rules (e.g., "BPM > 120 AND Rating >= 4").
Query Builder: The UI must provide a visual builder for these rules.
Translation Layer: MetaDJ must translate these UI rules into standard SQL WHERE clauses to execute against the Track table.
Example: A rule "Genre contains House" becomes SELECT * FROM Track WHERE genre LIKE '%House%'.
Full-Text Search: The Global Search bar must query an FTS (Full-Text Search) virtual table in SQLite to provide instant results across Title, Artist, Album, and Comment fields, supporting the specific search operators described in the manual.1

### 4.3 Playlist Management
Tree View: The "Collection Pane" must render the playlist hierarchy. This requires a recursive component in React that visualizes the parentListId relationships.
Drag and Drop: Moving a track from the "Collection" to a "Playlist" involves:
Getting the id of the target playlist.
Finding the last track in that playlist (tail of the linked list).
Inserting a new row in PlaylistEntity linking the track ID and playlist ID.
Updating the nextEntityId of the previous tail to point to the new row.
This strict linked-list maintenance is required for the hardware players to respect the custom sort order.2

## 5. Functional Module: The Deck (Playback & Performance)
This module replicates the "Deck" section of the user guide 1, handling the actual playback and manipulation of audio.

### 5.1 The Audio Graph
Each "Deck" in MetaDJ (supporting up to 4 layers) corresponds to a branch in the Web Audio API graph.
Source: An AudioBufferSourceNode or a custom AudioWorkletNode (if using WASM streaming).
Processing Chain:
GainNode: For track volume and crossfader curve application.
BiquadFilterNode (x3): Implementing the 3-band EQ (High, Mid, Low) with adjustable crossover frequencies.
DynamicsCompressorNode: A limiter on the master output to prevent digital clipping.
Rubberband Worklet: The time-stretching processor inserted into the chain when "Key Lock" is active.

### 5.2 Waveform Visualization
Engine DJ offers distinctive waveform views: "RGB" (frequency-colored), "Blue" (intensity-colored), and "3-Band".1
Generation: On track load, MetaDJ computes the FFT (Fast Fourier Transform) of the audio buffer. It calculates the RMS (Root Mean Square) energy for Low, Mid, and High frequency bands for every "pixel" of the waveform.
Rendering: This data is passed to a Pixi.js (WebGL) container. A custom fragment shader maps the frequency energy to the RGB channels. This ensures the waveform can scroll smoothly at 60fps even at high zoom levels, which is computationally impossible with standard HTML Canvas drawImage calls for large datasets.20
Interaction: Clicking the "Overview Waveform" performs a "needle drop," seeking the audio buffer. This interaction must be quantized if "Snap" is enabled.

### 5.3 Sync and Beatgrid Logic
The "Sync" button behavior 1 relies entirely on the beatData blob from the database.
Beatgrid Engine: MetaDJ parses the binary beatgrid anchors.
Phase Alignment: When "Sync" is pressed, the engine calculates the phase difference (in milliseconds) between the current deck's beat and the Master Deck's nearest beat. It applies a temporary playback rate adjustment (nudge) to align them.
Tempo Matching: The engine sets the playbackRate of the target deck to match the Master Deck's effective BPM.

### 5.4 Performance Pads
The pads trigger Hot Cues and Loops.
Hot Cues: When a pad is pressed, MetaDJ records the currentTime. It updates the UI immediately (optimistic UI) and writes the cue point data (position + color) to the quickCues blob in p.db asynchronously. This persistence allows the cues to appear on the hardware player later.
Loops: The "Auto Loop" encoder logic (User Guide p.8) must be implemented. Turning the knob changes the loop size (1, 2, 4, 8 beats). The loop region is calculated based on the BPM: LoopDuration = (60 / BPM) * Beats.

## 6. Functional Module: Client-Side Analysis & Stems
Engine DJ's value proposition is "Embedded Analysis." MetaDJ must replicate this in the browser.

### 6.1 Stem Separation Workflow
As described in the User Guide 1, Stems separation creates a companion file.
Trigger: User right-clicks a track -> "Analyze Stems."
Process: MetaDJ initializes the ONNX Runtime Web session with the Demucs model.
Inference: The audio buffer is fed into the model. WebGPU acceleration is requested. If the user's GPU is unsupported, it falls back to WASM SIMD (slower).
Output: The model returns 4 stereo buffers (Vocals, Drums, Bass, Other).
Storage: These buffers are interleaved into a multi-channel .m4a or .stem.mp4 file and saved to the Stems folder in the file system. The database is updated to link the track to this new stem file.

### 6.2 Key and BPM Detection
BPM: Uses an autocorrelation algorithm running in a WASM module (ported from librosa or aubio C++ libraries).
Key: Uses a Chromagram analysis to detect the pitch class profile. The result is mapped to the Camelot wheel (e.g., "1A", "8B") as per the user preference settings.1

## 7. Functional Module: Hardware Sync Manager
This feature allows the "Touring Professional" to prepare a USB drive for a gig.1

### 7.1 Drive Detection & Formatting
Limitation: The browser cannot format drives (erase disk). The user must provide a pre-formatted (exFAT/FAT32) drive.
Access: The user selects the USB drive via the File System Access API.

### 7.2 The Sync Process
Diffing: MetaDJ compares the "Collection" database (m.db in OPFS) with the "Drive" database (m.db on USB). It identifies tracks present in the Collection playlists but missing from the Drive.
File Transfer: It iterates through the missing tracks. For each track, it reads the source file (from local disk or cloud) and streams it to the USB drive handle. Optimization: This must be done sequentially or with limited concurrency to avoid choking the browser's I/O.
Database Patching: Instead of overwriting the entire m.db on the USB (which is risky), it performs an INSERT INTO operation on the USB's SQLite database to add the metadata for the new tracks and playlists. This preserves any existing history or cues created on the player.

## 8. Hardware Integration: WebHID & WebMIDI

### 8.1 The "Screen" Problem
Denon DJ Prime players have screens that display the waveform. Standard MIDI cannot send graphical data.
Solution: Reverse engineering of the StagelinQ or USB-HID protocol used by Denon is required.21
Implementation: MetaDJ will open a WebHID connection to the specific VendorID/ProductID of the controller. It will construct binary Feature Reports containing the waveform data (likely a simplified array of peaks) and album art bitmaps, sending them to the device endpoint. This allows the browser to "paint" the screen of the hardware controller.

### 8.2 Haptic Feedback
Motorized platters (SC6000M, Prime 4) use HID to report platter rotation and receive "brake" signals. MetaDJ must listen to the HID input reports for platter velocity to drive the "scratch" algorithm in the audio engine, ensuring the audio stops instantly when the user touches the physical platter.

## 9. UI/UX Design System
The interface must mirror Engine DJ's desktop layout to ensure familiarity.1
Color Palette:
Background: #121212 (OLED Black)
Accents: #00E0FF (Engine Blue), #4DFA90 (Success/Analyze)
Layout:
Top Bar: Transport status, global quantization settings, recording.
Decks Area: Two distinct panels (Layer A/B). Large waveforms, track art, loop controls.
Library (Bottom): Split view. Left sidebar for Playlist Tree/Drives. Right panel for Track List.
Accessibility: Full keyboard navigation support (Space to play, Ctrl+F to search). ARIA labels for all knobs/faders for screen reader support.

## 10. Conclusion and Implementation Roadmap
MetaDJ is an ambitious project that pushes the boundaries of the modern web platform. By combining the persistence of SQLite/OPFS, the performance of AudioWorklet/WASM, and the hardware access of WebHID, it is possible to build a professional-grade DJ library tool that lives in the cloud but works on the ground.
Phase 1 (The Librarian): Build the SQLite WASM + OPFS layer. Implement File System Access to read/write the m.db. Create the React UI for the Library/Playlist management. Goal: User can organize crates and edit metadata.
Phase 2 (The Player): Implement the Audio Engine with AudioWorklet. Build the WebGL waveform renderer. Add basic Play/Pause/Cue. Goal: User can audition tracks.
Phase 3 (The Analyst): Compile Rubberband and Demucs to WASM. Implement on-device analysis. Goal: Parity with Engine DJ analysis features.
Phase 4 (The Ecosystem): Build the Sync Manager and WebHID integration. Goal: User can export to USB and control via hardware.

### 10.1 Outstanding Questions for the User
Hardware Screen Support: Supporting the screens on Denon DJ hardware via WebHID requires reverse-engineering proprietary protocols. Is this a "Phase 1" requirement, or is standard MIDI control sufficient for the MVP?
Cloud Storage Auth: The User Guide mentions Dropbox. Does MetaDJ need to implement the full OAuth flow to stream directly from Dropbox, or should it focus initially on local files?
Browser Scope: Are you comfortable restricting support to Desktop Chrome/Edge? Firefox/Safari lack complete support for WebHID and File System Access API, which would severely limit functionality.
