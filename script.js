class TranscriptNamer {
    constructor() {
        this.srtData = [];
        this.speakers = new Map();
        this.speakerNames = new Map();
        this.manualSpeakers = new Map(); // For manually added speakers
        this.videoElement = null;
        this.init();
    }

    init() {
        document.getElementById('srtFile').addEventListener('change', (e) => this.handleSrtFile(e));
        document.getElementById('videoFile').addEventListener('change', (e) => this.handleVideoFile(e));
    }

    handleSrtFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseSrtFile(e.target.result);
            this.displayTranscript();
            this.displaySpeakers();
            document.getElementById('videoContainer').style.display = 'block';
        };
        reader.readAsText(file);
    }

    handleVideoFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const video = document.getElementById('videoPlayer');
        const url = URL.createObjectURL(file);
        video.src = url;
        this.videoElement = video;
    }

    parseSrtFile(content) {
        this.srtData = [];
        this.speakers.clear();
        
        const lines = content.trim().split('\n');
        let currentEntry = {};
        let lineIndex = 0;

        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            
            if (line === '') {
                lineIndex++;
                continue;
            }
            
            // Check if line is a sequence number
            if (/^\d+$/.test(line)) {
                if (Object.keys(currentEntry).length > 0) {
                    this.processEntry(currentEntry);
                }
                currentEntry = { sequence: parseInt(line) };
                lineIndex++;
                continue;
            }
            
            // Check if line is a timestamp
            if (line.includes('-->')) {
                currentEntry.timestamp = line;
                lineIndex++;
                continue;
            }
            
            // Everything else is text
            if (currentEntry.sequence !== undefined) {
                if (!currentEntry.text) {
                    currentEntry.text = '';
                }
                currentEntry.text += (currentEntry.text ? ' ' : '') + line;
            }
            
            lineIndex++;
        }
        
        // Process the last entry
        if (Object.keys(currentEntry).length > 0) {
            this.processEntry(currentEntry);
        }
    }

    processEntry(entry) {
        if (!entry.text) return;
        
        // Look for speaker patterns like [SPEAKER_1]:, SPEAKER 1:, or Speaker 1:
        const speakerMatch = entry.text.match(/\[?SPEAKER[_\s]?(\d+)\]?\s*:?\s*(.*)/i);
        
        if (speakerMatch) {
            const speakerId = speakerMatch[1];
            const text = speakerMatch[2].trim();
            
            entry.speakerId = speakerId;
            entry.cleanText = text;
            
            // Track speaker info
            if (!this.speakers.has(speakerId)) {
                this.speakers.set(speakerId, {
                    id: speakerId,
                    firstAppearance: entry.timestamp,
                    firstText: text.split(' ').slice(0, 10).join(' '),
                    sequence: entry.sequence,
                    entries: []
                });
            }
            
            this.speakers.get(speakerId).entries.push(entry);
        } else {
            // No speaker annotation found - treat as regular transcript
            entry.cleanText = entry.text;
            entry.speakerId = null;
        }
        
        this.srtData.push(entry);
    }

    displayTranscript() {
        const container = document.getElementById('transcriptDisplay');
        container.innerHTML = '';
        
        this.srtData.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'transcript-line';
            div.id = `transcript-line-${entry.sequence}`;
            div.onclick = () => this.seekToTimestamp(entry.timestamp);
            
            const timestamp = entry.timestamp ? entry.timestamp.split(' --> ')[0] : '';
            const speaker = entry.speakerId ? `Speaker ${entry.speakerId}` : 'Unassigned';
            const text = entry.cleanText || entry.text || '';
            
            // Add speaker selection dropdown for unassigned entries
            const speakerSelect = entry.speakerId ? '' : 
                `<select onchange="app.assignSpeaker(${entry.sequence}, this.value)" style="margin-left: 10px;">
                    <option value="">Assign Speaker</option>
                    ${this.generateSpeakerOptions()}
                </select>`;
            
            div.innerHTML = `
                <span class="transcript-timestamp">${timestamp}</span>
                <span class="transcript-speaker">${speaker}:</span>
                ${text}
                ${speakerSelect}
            `;
            
            container.appendChild(div);
        });
    }

    displaySpeakers() {
        const container = document.getElementById('speakerList');
        container.innerHTML = '';
        
        // If no speakers detected, show manual assignment tools
        if (this.speakers.size === 0) {
            container.innerHTML = `
                <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    <h4>No speakers detected automatically</h4>
                    <p>This transcript doesn't have speaker annotations. You can:</p>
                    <ol>
                        <li>Use the dropdowns next to each line to assign speakers</li>
                        <li>Or add speakers manually below and then assign them</li>
                    </ol>
                </div>
                <div style="background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd;">
                    <h4>Add New Speaker</h4>
                    <input type="text" id="newSpeakerName" placeholder="Enter speaker name" style="width: 70%; margin-right: 10px;">
                    <button onclick="app.addManualSpeaker()" style="padding: 6px 12px;">Add Speaker</button>
                    <div id="manualSpeakers" style="margin-top: 10px;"></div>
                </div>
            `;
            this.updateManualSpeakersDisplay();
            return;
        }
        
        this.speakers.forEach((speaker, speakerId) => {
            const div = document.createElement('div');
            div.className = 'speaker-item';
            
            const prevSpeaker = this.getPreviousSpeaker(speaker.sequence);
            const prevText = prevSpeaker ? this.getPreviousText(prevSpeaker) : 'None';
            const currentName = this.speakerNames.get(speakerId) || '';
            
            div.innerHTML = `
                <div class="speaker-id">Speaker ${speakerId}</div>
                <a href="#" class="timestamp-link" onclick="app.seekAndScrollToTimestamp('${speaker.firstAppearance}', ${speaker.sequence})">
                    First appears: ${speaker.firstAppearance}
                </a>
                <div class="speaker-text">"${speaker.firstText}..."</div>
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">
                    Previous speaker: ${prevSpeaker || 'None'}<br>
                    Previous text: "${prevText}"
                </div>
                <input type="text" class="name-input" placeholder="Enter speaker name" 
                       value="${currentName}"
                       onchange="app.setSpeakerName('${speakerId}', this.value)"
                       onkeypress="if(event.key==='Enter') app.setSpeakerName('${speakerId}', this.value)">
                <button onclick="app.setSpeakerName('${speakerId}', this.previousElementSibling.value)" 
                        style="margin-top: 5px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
                    Set Name
                </button>
            `;
            
            container.appendChild(div);
        });
        
        this.updateGenerateButton();
    }

    getPreviousSpeaker(currentSequence) {
        let prevSpeaker = null;
        for (let i = currentSequence - 2; i >= 1; i--) {
            const entry = this.srtData.find(e => e.sequence === i);
            if (entry && entry.speakerId) {
                prevSpeaker = `Speaker ${entry.speakerId}`;
                break;
            }
        }
        return prevSpeaker;
    }

    getPreviousText(prevSpeaker) {
        const speakerId = prevSpeaker.replace('Speaker ', '');
        const speaker = this.speakers.get(speakerId);
        if (speaker && speaker.entries.length > 0) {
            const lastEntry = speaker.entries[speaker.entries.length - 1];
            return lastEntry.cleanText.split(' ').slice(-10).join(' ');
        }
        return '';
    }

    setSpeakerName(speakerId, name) {
        console.log(`Setting speaker ${speakerId} to name: "${name}"`);
        if (name.trim()) {
            this.speakerNames.set(speakerId, name.trim());
            console.log(`Speaker names now:`, Array.from(this.speakerNames.entries()));
        } else {
            this.speakerNames.delete(speakerId);
        }
        this.updateGenerateButton();
        this.displaySpeakers(); // Refresh the display to show updated names
    }

    updateGenerateButton() {
        const btn = document.getElementById('generateBtn');
        
        // For auto-detected speakers (your case)
        if (this.speakers.size > 0) {
            const namedSpeakers = this.speakerNames.size;
            const totalSpeakers = this.speakers.size;
            
            btn.disabled = namedSpeakers === 0;
            
            if (namedSpeakers === 0) {
                btn.textContent = `Name speakers to generate (0/${totalSpeakers} named)`;
            } else if (namedSpeakers === totalSpeakers) {
                btn.textContent = 'Generate Named Transcript';
            } else {
                btn.textContent = `Generate Transcript (${namedSpeakers}/${totalSpeakers} speakers named)`;
            }
            return;
        }
        
        // For manual speakers (files without annotations)
        const assignedEntries = this.srtData.filter(entry => entry.speakerId).length;
        const totalEntries = this.srtData.length;
        const hasAssignments = this.manualSpeakers.size > 0 && assignedEntries > 0;
        
        btn.disabled = !hasAssignments;
        
        if (this.manualSpeakers.size === 0) {
            btn.textContent = 'Add speakers first';
        } else if (assignedEntries === 0) {
            btn.textContent = 'Assign speakers to transcript lines';
        } else {
            btn.textContent = `Generate Transcript (${assignedEntries}/${totalEntries} assigned)`;
        }
    }

    seekToTimestamp(timestamp) {
        if (!this.videoElement || !timestamp) return;
        
        const timeStr = timestamp.split(' --> ')[0];
        const seconds = this.timestampToSeconds(timeStr);
        this.videoElement.currentTime = seconds;
        this.videoElement.play();
    }

    seekAndScrollToTimestamp(timestamp, sequence) {
        // Seek video to timestamp
        this.seekToTimestamp(timestamp);
        
        // Scroll transcript to the line
        const targetElement = document.getElementById(`transcript-line-${sequence}`);
        if (targetElement) {
            targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Highlight the line briefly
            targetElement.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
                targetElement.style.backgroundColor = '';
            }, 2000);
        }
    }

    timestampToSeconds(timestamp) {
        const parts = timestamp.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    generateOutput() {
        if (this.speakerNames.size === 0) return;
        
        // Generate named SRT
        const namedSrt = this.generateNamedSrt();
        
        // Generate collated text
        const collatedText = this.generateCollatedText();
        
        // Display output
        document.getElementById('outputArea').style.display = 'block';
        document.getElementById('outputContent').textContent = 
            `Named SRT generated with ${this.speakerNames.size} speakers.\n\n` +
            `Preview of collated text:\n${collatedText.substring(0, 500)}...`;
        
        // Store for download
        this.namedSrtContent = namedSrt;
        this.collatedTextContent = collatedText;
    }

    generateNamedSrt() {
        let result = '';
        
        this.srtData.forEach(entry => {
            if (!entry.sequence) return;
            
            result += `${entry.sequence}\n`;
            result += `${entry.timestamp}\n`;
            
            if (entry.speakerId && (this.speakerNames.has(entry.speakerId) || this.manualSpeakers.has(entry.speakerId))) {
                const name = this.manualSpeakers.get(entry.speakerId) || this.speakerNames.get(entry.speakerId);
                result += `${name}: ${entry.cleanText}\n`;
            } else {
                result += `${entry.text}\n`;
            }
            
            result += '\n';
        });
        
        return result;
    }

    generateCollatedText() {
        const speakerTexts = new Map();
        
        // Group texts by speaker
        this.srtData.forEach(entry => {
            if (entry.speakerId && (this.speakerNames.has(entry.speakerId) || this.manualSpeakers.has(entry.speakerId))) {
                const name = this.manualSpeakers.get(entry.speakerId) || this.speakerNames.get(entry.speakerId);
                if (!speakerTexts.has(name)) {
                    speakerTexts.set(name, []);
                }
                speakerTexts.get(name).push(entry.cleanText);
            }
        });
        
        // Generate collated output
        let result = '';
        speakerTexts.forEach((texts, name) => {
            result += `${name}: ${texts.join(' ')}\n\n`;
        });
        
        return result;
    }

    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateSpeakerOptions() {
        let options = '';
        this.manualSpeakers.forEach((name, id) => {
            options += `<option value="${id}">${name}</option>`;
        });
        return options;
    }

    addManualSpeaker() {
        const nameInput = document.getElementById('newSpeakerName');
        const name = nameInput.value.trim();
        if (!name) return;
        
        const speakerId = Date.now().toString(); // Simple unique ID
        this.manualSpeakers.set(speakerId, name);
        this.speakerNames.set(speakerId, name);
        
        nameInput.value = '';
        this.updateManualSpeakersDisplay();
        this.displayTranscript(); // Refresh to show new speaker options
    }

    updateManualSpeakersDisplay() {
        const container = document.getElementById('manualSpeakers');
        if (!container) return;
        
        container.innerHTML = '';
        this.manualSpeakers.forEach((name, id) => {
            const div = document.createElement('div');
            div.style.cssText = 'margin: 5px 0; padding: 5px; background: #f8f9fa; border-radius: 4px;';
            div.innerHTML = `
                <span>${name}</span>
                <button onclick="app.removeManualSpeaker('${id}')" style="margin-left: 10px; padding: 2px 6px; background: #dc3545; color: white; border: none; border-radius: 3px;">Remove</button>
            `;
            container.appendChild(div);
        });
    }

    removeManualSpeaker(speakerId) {
        this.manualSpeakers.delete(speakerId);
        this.speakerNames.delete(speakerId);
        
        // Remove assignments from transcript entries
        this.srtData.forEach(entry => {
            if (entry.speakerId === speakerId) {
                entry.speakerId = null;
            }
        });
        
        this.updateManualSpeakersDisplay();
        this.displayTranscript();
        this.updateGenerateButton();
    }

    assignSpeaker(sequence, speakerId) {
        if (!speakerId) return;
        
        const entry = this.srtData.find(e => e.sequence === sequence);
        if (entry) {
            entry.speakerId = speakerId;
            this.displayTranscript();
            this.updateGenerateButton();
        }
    }
}

// Global functions for onclick handlers
function downloadNamedSrt() {
    if (app.namedSrtContent) {
        app.downloadFile(app.namedSrtContent, 'named_transcript.srt');
    }
}

function downloadCollatedText() {
    if (app.collatedTextContent) {
        app.downloadFile(app.collatedTextContent, 'collated_transcript.txt');
    }
}

function generateOutput() {
    app.generateOutput();
}

// Initialize the app
const app = new TranscriptNamer();