document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const urlInput = document.getElementById('url-input');
    const helpInput = document.getElementById('help-input');
    const sendBtn = document.getElementById('send-btn');
    const centerStage = document.getElementById('center-stage');
    const pipelineView = document.getElementById('pipeline-view');
    const timelineSteps = document.getElementById('timeline-steps');
    const tickerContainer = document.getElementById('slideshow-ticker');
    const tickerText = document.getElementById('ticker-text');
    const modePills = document.querySelectorAll('.mode-pill');

    // ───────────────────────── SLIDESHOW PROMPT TICKER ─────────────────────────
    const promptIdeas = [
        "Find the most viral 30s clips (Hook Score > 85)",
        "Extract funny punchlines with audience laughter peaks",
        "Generate YouTube chapters with timestamps",
        "Transcribe fast Hinglish comedy with speaker personas",
        "Isolate dramatic pauses & Karan Aujla entrance theme",
        "Analyze speaking pace (WPM) & tone inflections"
    ];

    let currentIdeaIndex = 0;
    let tickerInterval = null;

    function cycleTicker() {
        if (!tickerText) return;
        
        // Slide out to top
        tickerText.classList.add('slide-out');
        tickerText.classList.remove('slide-in');

        setTimeout(() => {
            currentIdeaIndex = (currentIdeaIndex + 1) % promptIdeas.length;
            tickerText.textContent = promptIdeas[currentIdeaIndex];
            
            // Slide in from bottom
            tickerText.classList.remove('slide-out');
            tickerText.classList.add('slide-in');
        }, 350);
    }

    tickerInterval = setInterval(cycleTicker, 3200);

    // Clicking the ticker copies text to helpInput
    if (tickerContainer) {
        tickerContainer.addEventListener('click', () => {
            const idea = promptIdeas[currentIdeaIndex];
            helpInput.value = idea;
            helpInput.focus();
            updateSendButtonState();
        });
    }

    // ───────────────────────── MODE PILLS TOGGLE ─────────────────────────
    modePills.forEach(pill => {
        pill.addEventListener('click', () => {
            modePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // ───────────────────────── INPUT & SEND BUTTON ACTIVE STATE ─────────────────────────
    function updateSendButtonState() {
        const hasUrl = urlInput.value.trim().length > 0;
        const hasHelp = helpInput.value.trim().length > 0;
        if (hasUrl || hasHelp) {
            sendBtn.classList.add('active');
        } else {
            sendBtn.classList.remove('active');
        }
    }

    urlInput.addEventListener('input', updateSendButtonState);
    helpInput.addEventListener('input', updateSendButtonState);

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startPipeline();
    });

    helpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startPipeline();
    });

    sendBtn.addEventListener('click', startPipeline);

    // ───────────────────────── TIMELINE ICONS & MOCK STEPS ─────────────────────────
    const ICONS = {
        code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
        command: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
        edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`
    };

    const EXECUTION_STEPS = [
        { type: 'code', text: 'Created app.js' },
        { type: 'code', text: 'Created selftest.py' },
        { type: 'command', text: 'Ran command: python -m venv env' },
        { type: 'command', text: 'Ran command: pip install -r requirements.txt' },
        { type: 'command', text: 'Ran command: yt-dlp extracting audio stream' },
        { type: 'edit', text: 'Edited selftest.py (added Hinglish whisper model)' },
        { type: 'command', text: 'Ran command: transcribing audio chunks (CTranslate2 int8)' },
        { type: 'command', text: 'Ran command: diarizing speakers (PyAnnote CUDA)' },
        { type: 'command', text: 'Ran command: extracting acoustic sound reactions (PANNs CNN14)' },
        { type: 'command', text: 'Ran command: computing Viral Hook Scores (0-100)' }
    ];

    // ───────────────────────── RUN PIPELINE TRANSITION ─────────────────────────
    let isRunning = false;

    async function startPipeline() {
        if (isRunning) return;
        const targetUrl = urlInput.value.trim();
        const instructions = helpInput.value.trim();

        if (!targetUrl && !instructions) {
            urlInput.focus();
            return;
        }

        isRunning = true;
        clearInterval(tickerInterval);

        // 1. Transition center stage to docked bottom
        centerStage.classList.add('docked-bottom');

        // 2. Reveal pipeline execution tree
        pipelineView.classList.remove('hidden');
        timelineSteps.innerHTML = '';

        // Reset inputs
        urlInput.value = '';
        helpInput.value = '';
        updateSendButtonState();

        // 3. Incrementally render timeline steps
        for (let i = 0; i < EXECUTION_STEPS.length; i++) {
            await sleep(400 + Math.random() * 500);
            renderStep(EXECUTION_STEPS[i]);
            
            // Auto scroll down canvas
            const canvas = document.getElementById('canvas');
            if (canvas) {
                canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'smooth' });
            }
        }

        isRunning = false;
    }

    function renderStep(step) {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="item-icon">${ICONS[step.type] || ICONS.command}</div>
            <div class="item-label active">${step.text}</div>
        `;
        timelineSteps.appendChild(item);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
