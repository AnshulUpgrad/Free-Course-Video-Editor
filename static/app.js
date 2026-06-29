// Application State
let projects = [];
let activeProjectId = '';
let activeProject = null;
let activeTimeline = null;
let selectedSlideIndex = -1;

// Constant Configurations
const FPS = 30;
const TEMPLATES = [
    { id: 'FaceOnly', name: 'Face Only Shot', desc: 'No slide overlay (only show the presenter)' },
    { id: 'ChapterDivider', name: 'Chapter Divider', desc: 'Introduces a new course module' },
    { id: 'ConceptCard', name: 'Concept Card', desc: 'Centered card introducing a core concept' },
    { id: 'KeywordCard', name: 'Keyword Card', desc: 'Full emphasis on a single key term' },
    { id: 'DefinitionCard', name: 'Definition Card', desc: 'Term definition (auto corner/half screen)' },
    { id: 'BulletList', name: 'Bullet List', desc: 'List of points (fullscreen/halfscreen)' },
    { id: 'StepSequence', name: 'Step Sequence', desc: 'Numbered procedure list' },
    { id: 'ComparisonCard', name: 'Comparison Card', desc: 'Side-by-side comparison table' },
    { id: 'VisualExplanation', name: 'Visual Explanation', desc: 'Vertical flowchart process diagram' },
    { id: 'PostcardBullets', name: 'Postcard (Bullets)', desc: 'Split-screen with image and bullets' },
    { id: 'PostcardParagraph', name: 'Postcard (Paragraph)', desc: 'Split-screen with image and summary' },
    { id: 'Takeaways', name: 'Takeaways', desc: 'Outro summary of key lessons' }
];

// DOM Elements
const projectSelector = document.getElementById('project-selector');
const btnRefreshProjects = document.getElementById('btn-refresh-projects');
const projectMetaCard = document.getElementById('project-meta');
const metaOriginalName = document.getElementById('meta-original-name');
const metaUploadedAt = document.getElementById('meta-uploaded-at');
const metaType = document.getElementById('meta-type');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadFilename = document.getElementById('upload-filename');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const uploadPercentage = document.getElementById('upload-percentage');

const stepTranscribe = document.getElementById('step-transcribe');
const btnTranscribe = document.getElementById('btn-transcribe');
const whisperModel = document.getElementById('whisper-model');

const stepAnalyze = document.getElementById('step-analyze');
const btnAnalyze = document.getElementById('btn-analyze');
const llmModel = document.getElementById('llm-model');

const stepRender = document.getElementById('step-render');
const btnRender = document.getElementById('btn-render');

const renderPreviewContainer = document.getElementById('render-preview-container');
const renderedVideoPlayer = document.getElementById('rendered-video-player');
const btnDownloadRender = document.getElementById('btn-download-render');

const btnAddSlide = document.getElementById('btn-add-slide');
const btnSaveSync = document.getElementById('btn-save-sync');
const slidesList = document.getElementById('slides-list');
const slideEditorContainer = document.getElementById('slide-editor-container');
const toastContainer = document.getElementById('toast-container');
const btnStudioLink = document.getElementById('btn-studio-link');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchProjects();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    btnRefreshProjects.addEventListener('click', fetchProjects);
    projectSelector.addEventListener('change', (e) => {
        selectProject(e.target.value);
    });

    // Upload triggers
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadMediaFile(e.target.files[0]);
        }
    });

    // Drag and drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            uploadMediaFile(e.dataTransfer.files[0]);
        }
    });

    // Pipeline processing actions
    btnTranscribe.addEventListener('click', triggerTranscription);
    btnAnalyze.addEventListener('click', triggerAnalysis);
    btnRender.addEventListener('click', triggerRender);

    // Save & sync timeline
    btnSaveSync.addEventListener('click', saveTimeline);

    // Add slide
    btnAddSlide.addEventListener('click', addDefaultSlide);
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Fetch available projects
async function fetchProjects() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) throw new Error('Failed to fetch projects');
        projects = await response.json();
        
        // Populate selector
        const currentValue = projectSelector.value;
        projectSelector.innerHTML = '<option value="">-- Select or Upload Project --</option>';
        
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.original_filename + ` (${p.type})`;
            projectSelector.appendChild(option);
        });

        // Restore active selection if possible
        if (currentValue && projects.some(p => p.id === currentValue)) {
            projectSelector.value = currentValue;
            updatePipelineUI(projects.find(p => p.id === currentValue));
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Select a project
function selectProject(projectId) {
    activeProjectId = projectId;
    selectedSlideIndex = -1;
    activeTimeline = null;
    
    if (!projectId) {
        activeProject = null;
        projectMetaCard.style.display = 'none';
        btnTranscribe.disabled = true;
        btnAnalyze.disabled = true;
        btnRender.disabled = true;
        btnAddSlide.disabled = true;
        btnSaveSync.disabled = true;
        renderPreviewContainer.style.display = 'none';
        resetSlidesUI();
        resetSlideEditorUI();
        return;
    }
    
    activeProject = projects.find(p => p.id === projectId);
    
    // Display metadata
    metaOriginalName.textContent = activeProject.original_filename;
    metaUploadedAt.textContent = new Date(activeProject.uploaded_at).toLocaleString();
    metaType.textContent = activeProject.type;
    metaType.className = `meta-value badge ${activeProject.type === 'video' ? 'badge-blue' : 'badge-gray'}`;
    projectMetaCard.style.display = 'flex';
    
    updatePipelineUI(activeProject);
    
    // Load timeline if exists
    if (activeProject.has_timeline) {
        loadProjectTimeline(projectId);
    } else {
        resetSlidesUI();
        resetSlideEditorUI();
        showToast('Timeline has not been generated yet. Please run analyze step.', 'info');
    }
}

// Updates the step badges & buttons depending on project completion state
function updatePipelineUI(proj) {
    // 1. Transcription status
    const step1Status = stepTranscribe.querySelector('.step-status');
    if (proj.has_transcription) {
        stepTranscribe.className = 'pipeline-step success';
        step1Status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete';
        btnTranscribe.disabled = false;
        btnTranscribe.textContent = 'Re-transcribe';
    } else {
        stepTranscribe.className = 'pipeline-step active';
        step1Status.innerHTML = '<i class="fa-solid fa-circle-play"></i> Ready';
        btnTranscribe.disabled = false;
        btnTranscribe.textContent = 'Transcribe';
    }

    // 2. Timeline analysis status
    const step2Status = stepAnalyze.querySelector('.step-status');
    if (proj.has_timeline) {
        stepAnalyze.className = 'pipeline-step success';
        step2Status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete';
        btnAnalyze.disabled = !proj.has_transcription;
        btnAnalyze.textContent = 'Re-analyze';
        btnAddSlide.disabled = false;
        btnSaveSync.disabled = false;
    } else {
        stepAnalyze.className = proj.has_transcription ? 'pipeline-step active' : 'pipeline-step';
        step2Status.innerHTML = proj.has_transcription ? '<i class="fa-solid fa-circle-play"></i> Ready' : '<i class="fa-regular fa-circle-question"></i> Pending';
        btnAnalyze.disabled = !proj.has_transcription;
        btnAnalyze.textContent = 'Analyze Script';
        btnAddSlide.disabled = true;
        btnSaveSync.disabled = true;
    }

    // 3. Render status
    const step3Status = stepRender.querySelector('.step-status');
    if (proj.has_render) {
        stepRender.className = 'pipeline-step success';
        step3Status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Rendered';
        btnRender.disabled = !proj.has_timeline;
        btnRender.textContent = 'Re-render Video';
        
        // Show video player
        renderedVideoPlayer.src = `/renders/${proj.render_file}?t=${new Date().getTime()}`;
        btnDownloadRender.href = `/renders/${proj.render_file}`;
        renderPreviewContainer.style.display = 'block';
    } else {
        stepRender.className = proj.has_timeline ? 'pipeline-step active' : 'pipeline-step';
        step3Status.innerHTML = proj.has_timeline ? '<i class="fa-solid fa-circle-play"></i> Ready' : '<i class="fa-regular fa-circle-question"></i> Pending';
        btnRender.disabled = !proj.has_timeline;
        btnRender.textContent = 'Start Video Render';
        renderPreviewContainer.style.display = 'none';
    }
}

// Load and display the timeline
async function loadProjectTimeline(projectId) {
    try {
        const response = await fetch(`/api/timeline/${projectId}`);
        if (!response.ok) throw new Error('Failed to load project timeline');
        activeTimeline = await response.json();
        
        // Sort the timeline segments by start time to make sure they are in order
        if (activeTimeline.timeline) {
            activeTimeline.timeline.sort((a, b) => a.startTime - b.startTime);
        }
        
        renderSlidesList();
        
        // Select first slide by default
        if (activeTimeline.timeline && activeTimeline.timeline.length > 0) {
            selectSlide(0);
        } else {
            resetSlideEditorUI();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Upload Media File
function uploadMediaFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    uploadFilename.textContent = file.name;
    uploadPercentage.textContent = '0%';
    uploadProgressBar.style.width = '0%';
    uploadProgressContainer.style.display = 'block';
    dropzone.style.display = 'none';
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            uploadPercentage.textContent = percentComplete + '%';
            uploadProgressBar.style.width = percentComplete + '%';
        }
    };
    
    xhr.onload = () => {
        uploadProgressContainer.style.display = 'none';
        dropzone.style.display = 'block';
        
        if (xhr.status === 200) {
            const res = JSON.parse(xhr.responseText);
            showToast('Media uploaded successfully!', 'success');
            fetchProjects().then(() => {
                // Select the new project
                const baseName = res.filename.rsplit ? res.filename.rsplit('.', 1)[0] : res.filename.substring(0, res.filename.lastIndexOf('.'));
                projectSelector.value = baseName;
                selectProject(baseName);
            });
        } else {
            const res = JSON.parse(xhr.responseText);
            showToast('Upload failed: ' + (res.error || 'Unknown error'), 'error');
        }
    };
    
    xhr.onerror = () => {
        uploadProgressContainer.style.display = 'none';
        dropzone.style.display = 'block';
        showToast('Network error during upload', 'error');
    };
    
    xhr.send(formData);
}

// Trigger Transcription (Whisper)
async function triggerTranscription() {
    if (!activeProjectId) return;
    
    btnTranscribe.disabled = true;
    const originalText = btnTranscribe.textContent;
    btnTranscribe.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transcribing...';
    showToast('Starting transcription on background. Please wait...', 'info');
    
    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: activeProject.filename,
                model_size: whisperModel.value
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to transcribe');
        }
        
        showToast('Audio transcription completed successfully!', 'success');
        await fetchProjects();
        selectProject(activeProjectId);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnTranscribe.disabled = false;
        btnTranscribe.textContent = originalText;
    }
}

// Trigger Script Analysis (Gemini timeline mapping)
async function triggerAnalysis() {
    if (!activeProjectId) return;
    
    btnAnalyze.disabled = true;
    const originalText = btnAnalyze.textContent;
    btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
    showToast('AI script analysis and slide planning started...', 'info');
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: activeProject.filename,
                model: llmModel.value
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to analyze script');
        }
        
        showToast('Timeline generated by AI successfully!', 'success');
        await fetchProjects();
        selectProject(activeProjectId);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.textContent = originalText;
    }
}

// Trigger Remotion Render
async function triggerRender() {
    if (!activeProjectId) return;
    
    btnRender.disabled = true;
    const originalText = btnRender.textContent;
    btnRender.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering MP4...';
    showToast('Remotion CLI render process spawned. This might take a few minutes.', 'info');
    
    try {
        const response = await fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: activeProject.filename
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Rendering failed');
        }
        
        showToast('Remotion MP4 rendering completed successfully!', 'success');
        await fetchProjects();
        selectProject(activeProjectId);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnRender.disabled = false;
        btnRender.textContent = originalText;
    }
}

// Render Timeline Slides List in Column 2
function renderSlidesList() {
    slidesList.innerHTML = '';
    slidesList.className = 'slides-list';
    
    if (!activeTimeline || !activeTimeline.timeline || activeTimeline.timeline.length === 0) {
        slidesList.className = 'slides-list empty-state';
        slidesList.innerHTML = `
            <div class="empty-message">
                <i class="fa-solid fa-circle-exclamation"></i>
                <p>Timeline is empty. Try generating or adding a slide.</p>
            </div>
        `;
        return;
    }
    
    activeTimeline.timeline.forEach((slide, idx) => {
        const requiresImage = ['PostcardBullets', 'PostcardParagraph'].includes(slide.templateId);
        const hasImage = slide.data && slide.data.image && slide.data.image.trim() !== '';
        const isWarning = requiresImage && !hasImage;
        
        const card = document.createElement('div');
        card.className = `slide-card${idx === selectedSlideIndex ? ' active' : ''}${isWarning ? ' warning-no-image' : ''}`;
        card.setAttribute('data-template', slide.templateId);
        card.setAttribute('data-index', idx);
        
        // Get visual summary description based on template type
        let contentSummary = '';
        const d = slide.data || {};
        switch (slide.templateId) {
            case 'FaceOnly':
                contentSummary = 'Presenter footage (no slide card overlay)';
                break;
            case 'ChapterDivider':
                contentSummary = `[${d.module || 'NO MODULE'}] ${d.title || ''}`;
                break;
            case 'ConceptCard':
                contentSummary = d.concept || '';
                break;
            case 'KeywordCard':
                contentSummary = d.keyword || '';
                break;
            case 'DefinitionCard':
                contentSummary = `<strong>${d.term || ''}</strong>: ${d.definition || ''}`;
                break;
            case 'BulletList':
            case 'StepSequence':
            case 'Takeaways':
                const items = d.items || d.steps || d.points || [];
                contentSummary = `<strong>${d.title || ''}</strong> (${items.length} items) - layout: ${d.layout || 'halfscreen'}`;
                break;
            case 'ComparisonCard':
                contentSummary = `${d.title || ''} (${d.leftTitle || ''} vs ${d.rightTitle || ''})`;
                break;
            case 'VisualExplanation':
                contentSummary = d.caption || `Nodes: ${(d.nodes || []).join(' -> ')}`;
                break;
            case 'PostcardBullets':
                contentSummary = `[Bullets] ${d.title || ''} (Bullets: ${(d.bullets || []).length})`;
                break;
            case 'PostcardParagraph':
                contentSummary = `[Summary] ${d.title || ''}: ${d.paragraph || ''}`;
                break;
            default:
                contentSummary = JSON.stringify(d);
        }
        
        const formattedStart = formatTime(slide.startTime);
        const formattedEnd = formatTime(slide.endTime);
        const durationSec = (slide.durationInFrames / FPS).toFixed(2);
        
        const badgeContent = isWarning ? `<i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>${slide.templateId}` : slide.templateId;
        
        card.innerHTML = `
            <div class="slide-card-header">
                <span class="slide-index">Slide ${idx + 1}</span>
                <span class="slide-template-badge">${badgeContent}</span>
            </div>
            <div class="slide-card-body">${contentSummary}</div>
            <div class="slide-card-footer">
                <span class="slide-card-timing">
                    <i class="fa-regular fa-clock"></i> ${formattedStart} - ${formattedEnd}
                </span>
                <span class="slide-card-duration">${slide.durationInFrames} frames (${durationSec}s)</span>
                <button class="btn-card-delete" onclick="event.stopPropagation(); deleteSlide(${idx});" title="Delete Slide">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        
        card.addEventListener('click', () => selectSlide(idx));
        slidesList.appendChild(card);
    });
}

// Select a slide for editing
function selectSlide(index) {
    selectedSlideIndex = index;
    
    // Update active visual border on cards
    const cards = slidesList.querySelectorAll('.slide-card');
    cards.forEach(c => c.classList.remove('active'));
    const selectedCard = slidesList.querySelector(`.slide-card[data-index="${index}"]`);
    if (selectedCard) selectedCard.classList.add('active');
    
    renderSlideEditor();
}

// Render dynamic forms for editing the selected slide
function renderSlideEditor() {
    slideEditorContainer.innerHTML = '';
    slideEditorContainer.className = 'slide-editor-container';
    
    if (selectedSlideIndex === -1 || !activeTimeline || !activeTimeline.timeline[selectedSlideIndex]) {
        slideEditorContainer.className = 'slide-editor-container empty-state';
        slideEditorContainer.innerHTML = `
            <div class="empty-message">
                <i class="fa-solid fa-sliders"></i>
                <p>Select a slide from the timeline to edit its contents and properties.</p>
            </div>
        `;
        return;
    }
    
    const slide = activeTimeline.timeline[selectedSlideIndex];
    const data = slide.data || {};
    
    // Timing Form Elements
    const timingHTML = `
        <div class="panel-section-title" style="margin-bottom: 12px; font-weight: 700; font-size: 13px;">Timing Details (30 fps)</div>
        <div class="form-row-3">
            <div class="form-group">
                <label for="slide-start">Start Time (sec)</label>
                <input type="number" step="0.01" min="0" class="form-control" id="slide-start" value="${slide.startTime}">
            </div>
            <div class="form-group">
                <label for="slide-end">End Time (sec)</label>
                <input type="number" step="0.01" min="0.01" class="form-control" id="slide-end" value="${slide.endTime}">
            </div>
            <div class="form-group">
                <label for="slide-duration">Duration (frames)</label>
                <input type="number" step="1" min="15" class="form-control" id="slide-duration" value="${slide.durationInFrames}">
            </div>
        </div>
        <div class="form-group">
            <label for="slide-template-select">Template Layout</label>
            <div class="select-wrapper">
                <select id="slide-template-select">
                    ${TEMPLATES.map(t => `<option value="${t.id}" ${t.id === slide.templateId ? 'selected' : ''}>${t.name} - ${t.desc}</option>`).join('')}
                </select>
                <i class="fa-solid fa-chevron-down select-arrow"></i>
            </div>
        </div>
        <div class="border-divider" style="height:1px; background:var(--border-color); margin:18px 0;"></div>
    `;

    // Generate specific input fields depending on templateId
    let fieldsHTML = '';
    
    switch (slide.templateId) {
        case 'ChapterDivider':
            fieldsHTML = `
                <div class="form-group">
                    <label for="cd-module">Module Indicator (e.g. MODULE 01)</label>
                    <input type="text" class="form-control" id="cd-module" value="${data.module || ''}">
                </div>
                <div class="form-group">
                    <label for="cd-title">Chapter Title</label>
                    <input type="text" class="form-control" id="cd-title" value="${data.title || ''}">
                </div>
            `;
            break;
            
        case 'ConceptCard':
            fieldsHTML = `
                <div class="form-group">
                    <label for="cc-concept">Concept Name</label>
                    <input type="text" class="form-control" id="cc-concept" value="${data.concept || ''}">
                </div>
            `;
            break;
            
        case 'KeywordCard':
            fieldsHTML = `
                <div class="form-group">
                    <label for="kc-keyword">Emphasis Keyword</label>
                    <input type="text" class="form-control" id="kc-keyword" value="${data.keyword || ''}">
                </div>
            `;
            break;
            
        case 'DefinitionCard':
            fieldsHTML = `
                <div class="form-group">
                    <label for="dc-term">Term</label>
                    <input type="text" class="form-control" id="dc-term" value="${data.term || ''}">
                </div>
                <div class="form-group">
                    <label for="dc-definition">Definition Text</label>
                    <textarea class="form-control" id="dc-definition">${data.definition || ''}</textarea>
                    <span class="form-help">Layout snaps to Corner-Box if short (&le;15 words) or right Half-Screen if long (&gt;15 words).</span>
                </div>
            `;
            break;
            
        case 'BulletList':
        case 'StepSequence':
        case 'Takeaways':
            const isBullet = slide.templateId === 'BulletList';
            const isStep = slide.templateId === 'StepSequence';
            const titleVal = data.title || '';
            const layoutVal = data.layout || 'halfscreen';
            
            // Get array
            let arr = [];
            if (isBullet) arr = data.items || [];
            else if (isStep) arr = data.steps || [];
            else arr = data.points || [];
            
            fieldsHTML = `
                <div class="form-group">
                    <label for="list-title">Title / Header</label>
                    <input type="text" class="form-control" id="list-title" value="${titleVal}">
                </div>
                <div class="form-group">
                    <label for="list-layout">Layout Variant</label>
                    <div class="select-wrapper">
                        <select id="list-layout">
                            <option value="halfscreen" ${layoutVal === 'halfscreen' ? 'selected' : ''}>Half-Screen (Recommended, runs alongside speaker)</option>
                            <option value="fullscreen" ${layoutVal === 'fullscreen' ? 'selected' : ''}>Full-Screen (Standalone backdrop)</option>
                        </select>
                        <i class="fa-solid fa-chevron-down select-arrow"></i>
                    </div>
                </div>
                <div class="form-group">
                    <label>List Items (max 8)</label>
                    <div class="dynamic-list-container" id="list-items-container">
                        ${arr.map((item, i) => `
                            <div class="dynamic-list-row">
                                <input type="text" class="form-control list-item-input" value="${item}">
                                <button type="button" class="btn-row-action btn-row-remove" onclick="removeListRow(this)"><i class="fa-solid fa-minus"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary w-full" style="margin-top:8px;" onclick="addListRow()"><i class="fa-solid fa-plus"></i> Add Item</button>
                </div>
            `;
            break;
            
        case 'ComparisonCard':
            const rows = data.rows || [];
            fieldsHTML = `
                <div class="form-group">
                    <label for="comp-title">Comparison Title</label>
                    <input type="text" class="form-control" id="comp-title" value="${data.title || ''}">
                </div>
                <div class="form-row-2">
                    <div class="form-group">
                        <label for="comp-left-title">Left Column Header</label>
                        <input type="text" class="form-control" id="comp-left-title" value="${data.leftTitle || ''}">
                    </div>
                    <div class="form-group">
                        <label for="comp-right-title">Right Column Header</label>
                        <input type="text" class="form-control" id="comp-right-title" value="${data.rightTitle || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Row Cells</label>
                    <div class="dynamic-list-container" id="comparison-rows-container">
                        ${rows.map((row, i) => `
                            <div class="dynamic-list-row comparison-row-inputs">
                                <input type="text" class="form-control comp-col1" placeholder="Left cell text" value="${row[0] || ''}">
                                <input type="text" class="form-control comp-col2" placeholder="Right cell text" value="${row[1] || ''}">
                                <button type="button" class="btn-row-action btn-row-remove" onclick="removeComparisonRow(this)"><i class="fa-solid fa-minus"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary w-full" style="margin-top:8px;" onclick="addComparisonRow()"><i class="fa-solid fa-plus"></i> Add Row</button>
                </div>
            `;
            break;
            
        case 'VisualExplanation':
            const nodes = data.nodes || [];
            fieldsHTML = `
                <div class="form-group">
                    <label for="vis-caption">Explanation Caption</label>
                    <input type="text" class="form-control" id="vis-caption" value="${data.caption || ''}">
                </div>
                <div class="form-group">
                    <label>Flowchart Process Nodes (stages)</label>
                    <div class="dynamic-list-container" id="vis-nodes-container">
                        ${nodes.map((node, i) => `
                            <div class="dynamic-list-row">
                                <input type="text" class="form-control node-input" value="${node}">
                                <button type="button" class="btn-row-action btn-row-remove" onclick="removeNodeRow(this)"><i class="fa-solid fa-minus"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary w-full" style="margin-top:8px;" onclick="addNodeRow()"><i class="fa-solid fa-plus"></i> Add Process Node</button>
                </div>
            `;
            break;
            
        case 'PostcardBullets':
        case 'PostcardParagraph':
            const isBulletPost = slide.templateId === 'PostcardBullets';
            const postTitle = data.title || '';
            const postImage = data.image || '';
            const isImageWarning = !postImage || postImage.trim() === '';
            
            // Build image path
            let displayImageUrl = '';
            if (postImage) {
                displayImageUrl = postImage.startsWith('uploads/') ? `/${postImage}` : `/uploads/${postImage}`;
            }

            let detailInputHTML = '';
            if (isBulletPost) {
                const bList = data.bullets || [];
                detailInputHTML = `
                    <div class="form-group">
                        <label>Bullets (max 4)</label>
                        <div class="dynamic-list-container" id="postcard-bullets-container">
                            ${bList.map((bullet, i) => `
                                <div class="dynamic-list-row">
                                    <input type="text" class="form-control p-bullet-input" value="${bullet}">
                                    <button type="button" class="btn-row-action btn-row-remove" onclick="removePostcardBulletRow(this)"><i class="fa-solid fa-minus"></i></button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary w-full" style="margin-top:8px;" onclick="addPostcardBulletRow()"><i class="fa-solid fa-plus"></i> Add Bullet</button>
                    </div>
                `;
            } else {
                detailInputHTML = `
                    <div class="form-group">
                        <label for="p-paragraph">Summary Paragraph</label>
                        <textarea class="form-control" id="p-paragraph">${data.paragraph || ''}</textarea>
                    </div>
                `;
            }
            
            fieldsHTML = `
                <div class="form-group">
                    <label for="p-title">Postcard Title</label>
                    <input type="text" class="form-control" id="p-title" value="${postTitle}">
                </div>
                <div class="form-group">
                    <label>Image Plate File</label>
                    <div class="image-upload-wrapper">
                        <div class="image-preview-box ${isImageWarning ? 'warning-empty' : ''}" id="p-image-preview">
                            ${postImage ? `<img src="${displayImageUrl}" alt="Preview">` : '<i class="fa-solid fa-triangle-exclamation"></i>'}
                        </div>
                        <div class="image-upload-controls">
                            <input type="text" class="form-control" id="p-image-path" placeholder="uploads/image.png" value="${postImage}">
                            <label class="image-upload-label">
                                <input type="file" id="p-image-file-input" accept="image/*" style="display:none;" onchange="uploadPostcardImage(this)">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Upload Custom Image
                            </label>
                            ${isImageWarning ? '<span class="form-help" style="color:#ef4444; font-weight:500;"><i class="fa-solid fa-triangle-exclamation"></i> Image required for rendering</span>' : ''}
                        </div>
                    </div>
                </div>
                ${detailInputHTML}
            `;
            break;
        case 'FaceOnly':
            fieldsHTML = `
                <div class="empty-message" style="min-height: 100px; padding: 10px;">
                    <i class="fa-solid fa-user-tie" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px;"></i>
                    <p style="font-size: 12px; max-width: 320px;">Face Only Shot. For this duration, only the background presenter footage will render with no slide overlay cards.</p>
                </div>
            `;
            break;
    }

    // Append submit buttons
    const actionsHTML = `
        <div class="editor-footer-actions">
            <button id="btn-save-slide" class="btn btn-secondary w-full">
                <i class="fa-solid fa-check"></i> Apply Slide Changes
            </button>
        </div>
    `;

    slideEditorContainer.innerHTML = timingHTML + fieldsHTML + actionsHTML;
    
    // Add change triggers to sync timing inputs
    const startInput = document.getElementById('slide-start');
    const endInput = document.getElementById('slide-end');
    const durationInput = document.getElementById('slide-duration');
    const templateSelect = document.getElementById('slide-template-select');
    const btnSaveSlide = document.getElementById('btn-save-slide');
    
    startInput.addEventListener('input', () => {
        const startVal = parseFloat(startInput.value) || 0;
        const endVal = parseFloat(endInput.value) || 0;
        if (startVal >= endVal) {
            endInput.value = (startVal + 1).toFixed(2);
        }
        const updatedEnd = parseFloat(endInput.value);
        durationInput.value = Math.round((updatedEnd - startVal) * FPS);
    });
    
    endInput.addEventListener('input', () => {
        const startVal = parseFloat(startInput.value) || 0;
        const endVal = parseFloat(endInput.value) || 0;
        if (endVal <= startVal) {
            startInput.value = Math.max(0, endVal - 1).toFixed(2);
        }
        const updatedStart = parseFloat(startInput.value);
        durationInput.value = Math.round((endVal - updatedStart) * FPS);
    });
    
    durationInput.addEventListener('input', () => {
        const startVal = parseFloat(startInput.value) || 0;
        const frames = parseInt(durationInput.value) || 30;
        endInput.value = (startVal + frames / FPS).toFixed(2);
    });

    templateSelect.addEventListener('change', (e) => {
        // Just save in memory what we have so far, change template type, and re-render editor
        collectCurrentSlideData();
        slide.templateId = e.target.value;
        // Inject empty defaults if missing
        if (!slide.data) slide.data = {};
        renderSlideEditor();
    });

    btnSaveSlide.addEventListener('click', () => {
        collectCurrentSlideData();
        renderSlidesList();
        showToast('Changes applied to slide in-memory. Click "Save & Sync to Remotion" to write to file.', 'info');
    });
}

// Collect values from the active form and write back to the activeTimeline memory
function collectCurrentSlideData() {
    if (selectedSlideIndex === -1 || !activeTimeline) return;
    
    const slide = activeTimeline.timeline[selectedSlideIndex];
    
    // Set timing
    slide.startTime = parseFloat(document.getElementById('slide-start').value) || 0;
    slide.endTime = parseFloat(document.getElementById('slide-end').value) || 0;
    slide.durationInFrames = parseInt(document.getElementById('slide-duration').value) || 30;
    
    // Initialize data object
    const data = {};
    
    switch (slide.templateId) {
        case 'ChapterDivider':
            data.module = document.getElementById('cd-module').value;
            data.title = document.getElementById('cd-title').value;
            break;
            
        case 'ConceptCard':
            data.concept = document.getElementById('cc-concept').value;
            break;
            
        case 'KeywordCard':
            data.keyword = document.getElementById('kc-keyword').value;
            break;
            
        case 'DefinitionCard':
            data.term = document.getElementById('dc-term').value;
            data.definition = document.getElementById('dc-definition').value;
            break;
            
        case 'BulletList':
        case 'StepSequence':
        case 'Takeaways':
            data.title = document.getElementById('list-title').value;
            data.layout = document.getElementById('list-layout').value;
            
            const listInputs = document.querySelectorAll('.list-item-input');
            const listVals = Array.from(listInputs).map(inp => inp.value.strip ? inp.value.strip() : inp.value.trim()).filter(v => v);
            
            if (slide.templateId === 'BulletList') {
                data.items = listVals;
            } else if (slide.templateId === 'StepSequence') {
                data.steps = listVals;
            } else {
                data.points = listVals;
            }
            break;
            
        case 'ComparisonCard':
            data.title = document.getElementById('comp-title').value;
            data.leftTitle = document.getElementById('comp-left-title').value;
            data.rightTitle = document.getElementById('comp-right-title').value;
            
            const rowsList = [];
            const rowElements = document.querySelectorAll('.comparison-row-inputs');
            rowElements.forEach(row => {
                const c1 = row.querySelector('.comp-col1').value;
                const c2 = row.querySelector('.comp-col2').value;
                if (c1 || c2) {
                    rowsList.push([c1, c2]);
                }
            });
            data.rows = rowsList;
            break;
            
        case 'VisualExplanation':
            data.caption = document.getElementById('vis-caption').value;
            const nodeInputs = document.querySelectorAll('.node-input');
            data.nodes = Array.from(nodeInputs).map(inp => inp.value.trim()).filter(v => v);
            break;
            
        case 'PostcardBullets':
        case 'PostcardParagraph':
            data.title = document.getElementById('p-title').value;
            data.image = document.getElementById('p-image-path').value;
            
            if (slide.templateId === 'PostcardBullets') {
                data.variant = 'bullets';
                const bulletInputs = document.querySelectorAll('.p-bullet-input');
                data.bullets = Array.from(bulletInputs).map(inp => inp.value.trim()).filter(v => v);
            } else {
                data.variant = 'paragraph';
                data.paragraph = document.getElementById('p-paragraph').value;
            }
            break;
        case 'FaceOnly':
            break;
    }
    
    slide.data = data;
}

// Reset UI helper functions
function resetSlidesUI() {
    slidesList.className = 'slides-list empty-state';
    slidesList.innerHTML = `
        <div class="empty-message">
            <i class="fa-solid fa-film"></i>
            <p>No project loaded. Upload or select a project to display the timeline slides.</p>
        </div>
    `;
}

function resetSlideEditorUI() {
    slideEditorContainer.className = 'slide-editor-container empty-state';
    slideEditorContainer.innerHTML = `
        <div class="empty-message">
            <i class="fa-solid fa-sliders"></i>
            <p>Select a slide from the timeline to edit its contents and properties.</p>
        </div>
    `;
}

// Dynamic List input row modifiers (global scope window handlers)
window.removeListRow = function(btn) {
    btn.parentElement.remove();
};

window.addListRow = function() {
    const container = document.getElementById('list-items-container');
    const row = document.createElement('div');
    row.className = 'dynamic-list-row';
    row.innerHTML = `
        <input type="text" class="form-control list-item-input" placeholder="Enter list point">
        <button type="button" class="btn-row-action btn-row-remove" onclick="removeListRow(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(row);
};

window.removeComparisonRow = function(btn) {
    btn.parentElement.remove();
};

window.addComparisonRow = function() {
    const container = document.getElementById('comparison-rows-container');
    const row = document.createElement('div');
    row.className = 'dynamic-list-row comparison-row-inputs';
    row.innerHTML = `
        <input type="text" class="form-control comp-col1" placeholder="Left cell text">
        <input type="text" class="form-control comp-col2" placeholder="Right cell text">
        <button type="button" class="btn-row-action btn-row-remove" onclick="removeComparisonRow(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(row);
};

window.removeNodeRow = function(btn) {
    btn.parentElement.remove();
};

window.addNodeRow = function() {
    const container = document.getElementById('vis-nodes-container');
    const row = document.createElement('div');
    row.className = 'dynamic-list-row';
    row.innerHTML = `
        <input type="text" class="form-control node-input" placeholder="Enter process step name">
        <button type="button" class="btn-row-action btn-row-remove" onclick="removeNodeRow(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(row);
};

window.removePostcardBulletRow = function(btn) {
    btn.parentElement.remove();
};

window.addPostcardBulletRow = function() {
    const container = document.getElementById('postcard-bullets-container');
    const row = document.createElement('div');
    row.className = 'dynamic-list-row';
    row.innerHTML = `
        <input type="text" class="form-control p-bullet-input" placeholder="Enter bullet text">
        <button type="button" class="btn-row-action btn-row-remove" onclick="removePostcardBulletRow(this)"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(row);
};

// Upload custom images for postcard templates
window.uploadPostcardImage = async function(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    const pImagePreview = document.getElementById('p-image-preview');
    const pImagePath = document.getElementById('p-image-path');
    
    pImagePreview.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    showToast('Uploading image plate...', 'info');
    
    try {
        const response = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Upload failed');
        }
        
        const data = await response.json();
        
        // Update paths
        pImagePath.value = data.filename;
        pImagePreview.innerHTML = `<img src="${data.url}" alt="Uploaded preview">`;
        showToast('Custom image plate uploaded and selected!', 'success');
    } catch (err) {
        pImagePreview.innerHTML = '<i class="fa-regular fa-image"></i>';
        showToast(err.message, 'error');
    }
};

// Save and sync the full timeline JSON to files
async function saveTimeline() {
    if (!activeProjectId || !activeTimeline) return;
    
    // Auto save the currently selected slide first if form is active
    if (selectedSlideIndex !== -1) {
        collectCurrentSlideData();
    }
    
    btnSaveSync.disabled = true;
    const originalText = btnSaveSync.textContent;
    btnSaveSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
    
    try {
        const response = await fetch(`/api/timeline/${activeProjectId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activeTimeline)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save timeline');
        }
        
        showToast('Timeline successfully saved and synced to Remotion!', 'success');
        
        // Reload projects and timeline list to reflect any name updates or indices
        await fetchProjects();
        renderSlidesList();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btnSaveSync.disabled = false;
        btnSaveSync.textContent = originalText;
    }
}

// Add a default slide to the timeline
function addDefaultSlide() {
    if (!activeTimeline) return;
    
    // Calculate new slide timing
    let nextStart = 0;
    if (activeTimeline.timeline && activeTimeline.timeline.length > 0) {
        const lastSlide = activeTimeline.timeline[activeTimeline.timeline.length - 1];
        nextStart = lastSlide.endTime;
    }
    
    const newSlide = {
        templateId: 'ConceptCard',
        startTime: parseFloat(nextStart.toFixed(2)),
        endTime: parseFloat((nextStart + 5.0).toFixed(2)),
        durationInFrames: 150,
        data: {
            concept: 'New Concept'
        }
    };
    
    if (!activeTimeline.timeline) activeTimeline.timeline = [];
    activeTimeline.timeline.push(newSlide);
    
    renderSlidesList();
    selectSlide(activeTimeline.timeline.length - 1);
    showToast('New slide added to the end of the timeline.', 'success');
}

// Delete slide
window.deleteSlide = function(index) {
    if (!activeTimeline || !activeTimeline.timeline) return;
    
    if (!confirm(`Are you sure you want to delete Slide ${index + 1}?`)) return;
    
    activeTimeline.timeline.splice(index, 1);
    
    if (selectedSlideIndex === index) {
        selectedSlideIndex = -1;
    } else if (selectedSlideIndex > index) {
        selectedSlideIndex--;
    }
    
    renderSlidesList();
    if (selectedSlideIndex !== -1) {
        selectSlide(selectedSlideIndex);
    } else {
        resetSlideEditorUI();
    }
    
    showToast('Slide deleted.', 'success');
};

// Utilities
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
