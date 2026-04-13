// --- 0. DYNAMIC APP ICON ---
function generateAppIcon() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Draw the sleek black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);

    // 2. Set the emoji size (Change 280px to make it bigger or smaller)
    ctx.font = '290px Arial'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 3. Draw the emoji perfectly centered (Y is at 280 to optically center it)
    ctx.fillText('💪🏽', 256, 290); 

    // 4. Convert it to a PNG
    const iconUrl = canvas.toDataURL('image/png');
    
    // 5. Inject it for iOS Home Screen
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleLink);
    }
    appleLink.href = iconUrl;

    // 6. Inject it for standard browser tabs
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    favicon.href = iconUrl;
}

// Run it immediately!
generateAppIcon();


// --- 1. SUPABASE SETUP ---
const supabaseUrl = 'https://jrqevdwotctdohgtyudx.supabase.co';
const supabaseKey = 'sb_publishable_obWjnqgr4tJ0LVcVC5j3Tw_8kCWcsxT';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. STATE MANAGEMENT ---
let appState = {
    categories: [],
    exercises: [],
    logs: [],
    selectedCategoryId: null,
    selectedExerciseId: null,
    userId: null,
};

async function loadDatabaseData() {
    const { data: catData, error: catErr } = await supabaseClient.from('categories').select('*');
    if (!catErr) appState.categories = catData;

    const { data: exData, error: exErr } = await supabaseClient.from('exercises').select('*');
    if (!exErr) appState.exercises = exData;

    const { data: logData, error: logErr } = await supabaseClient.from('workout_logs').select('*');
    if (!logErr) appState.logs = logData;

    renderCategories();
    renderRecentSets();

    // --- THE EMPTY STATE UX FIX ---
    if (appState.categories.length === 0) {
        elements.dynamicFieldsCard.innerHTML = '<p class="muted-text" style="color: var(--primary-green); text-align: center; padding: 20px;">Welcome! 💪🏽<br><br>Start by clicking "+ New" next to <b>Category</b> to set up your first split.</p>';
        elements.addExerciseBtn.style.opacity = '0.3';
        elements.addExerciseBtn.style.pointerEvents = 'none';
    }
}

// --- 3. DOM ELEMENTS ---
const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    viewTitle: document.getElementById('current-view-title'),
    
    categoryGrid: document.getElementById('category-grid'),
    exerciseChips: document.getElementById('exercise-chips'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    
    logSetCard: document.getElementById('log-set-card'),
    logSetTitle: document.getElementById('log-set-title'),
    prDisplay: document.getElementById('pr-display'),
    logSetInputs: document.getElementById('log-set-inputs'),
    saveSetBtn: document.getElementById('save-set-btn'),

    dynamicFieldsCard: document.getElementById('dynamic-fields-card'),

    // Modal Elements
    exerciseModal: document.getElementById('exercise-modal'),
    newExNameInput: document.getElementById('new-ex-name'),
    cancelExBtn: document.getElementById('cancel-ex-btn'),
    saveExBtn: document.getElementById('save-ex-btn'),
    trackCheckboxes: document.querySelectorAll('.track-cb'),

    recentSetsCard: document.getElementById('recent-sets-card'),
    recentSetsList: document.getElementById('recent-sets-list'),

    // Edit Set Modal Elements
    editSetModal: document.getElementById('edit-set-modal'),
    editSetTitle: document.getElementById('edit-set-title'),
    editSetInputs: document.getElementById('edit-set-inputs'),
    saveEditSetBtn: document.getElementById('save-edit-set-btn'),
    deleteSetBtn: document.getElementById('delete-set-btn'),
    closeEditModalBtn: document.getElementById('close-edit-modal-btn')
};

// --- 4. UI & NAVIGATION LOGIC ---
elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        elements.viewSections.forEach(view => view.classList.add('hidden'));
        elements.navItems.forEach(nav => nav.classList.remove('active'));
        
        const targetId = e.currentTarget.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        
        e.currentTarget.classList.add('active');
        elements.viewTitle.textContent = e.currentTarget.querySelector('span:not(.material-icons)').textContent;
    });
});

// --- 5. RENDERING LOGIC ---
function renderCategories() {
    elements.categoryGrid.innerHTML = '';
    appState.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'grid-btn';
        if (appState.selectedCategoryId === cat.id) btn.classList.add('active');
        
        btn.textContent = cat.name;
        
        btn.addEventListener('click', () => {

            appState.selectedCategoryId = cat.id;
            appState.selectedExerciseId = null; 
            renderCategories(); // refresh active state
            renderExercises(cat.id);
            
            elements.logSetCard.classList.add('hidden');
            elements.dynamicFieldsCard.classList.remove('hidden');
            elements.addExerciseBtn.style.opacity = '1';
            elements.addExerciseBtn.style.pointerEvents = 'auto';
        });
        
        elements.categoryGrid.appendChild(btn);
    });
}

function renderExercises(categoryId) {
    elements.exerciseChips.innerHTML = '';
    const filteredExercises = appState.exercises.filter(ex => ex.category_id === categoryId);
    
    if (filteredExercises.length === 0) {
        elements.exerciseChips.innerHTML = '<p class="muted-text">No exercises yet.</p>';
        return;
    }

    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    const recentlyLoggedExIds = new Set(
        appState.logs
            .filter(log => new Date(log.created_at) > fiveHoursAgo && log.exercise_id !== appState.selectedExerciseId)
            .map(log => log.exercise_id)
    );

    filteredExercises.sort((a, b) => {
        const aLogged = recentlyLoggedExIds.has(a.id);
        const bLogged = recentlyLoggedExIds.has(b.id);
        if (aLogged && !bLogged) return 1;
        if (!aLogged && bLogged) return -1;
        return 0;
    });

    if (appState.selectedExerciseId) {
        const selectedEx = filteredExercises.find(ex => ex.id === appState.selectedExerciseId);
        if (selectedEx) {
            const index = filteredExercises.indexOf(selectedEx);
            if (index > -1) {
                filteredExercises.splice(index, 1);
                filteredExercises.unshift(selectedEx);
            }
        }
    }

    filteredExercises.forEach(ex => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        if (appState.selectedExerciseId === ex.id) chip.classList.add('active');
        if (recentlyLoggedExIds.has(ex.id)) chip.classList.add('completed');
        chip.textContent = ex.name;
        
        chip.addEventListener('click', () => {
            appState.selectedExerciseId = ex.id;
            renderExercises(categoryId); 
            renderInputFields(ex.id);
            elements.logSetCard.classList.remove('hidden');
            elements.dynamicFieldsCard.classList.add('hidden');
        });
        elements.exerciseChips.appendChild(chip);
    });
}

function renderInputFields(exerciseId) {
    elements.logSetInputs.innerHTML = ''; 
    const exercise = appState.exercises.find(ex => ex.id === exerciseId);
    
    if (!exercise) {
        elements.logSetCard.classList.add('hidden');
        elements.dynamicFieldsCard.classList.remove('hidden');
        return;
    }

    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    const setsInLast5Hours = appState.logs.filter(log => 
        log.exercise_id === exerciseId && 
        new Date(log.created_at) > fiveHoursAgo
    ).length;

    elements.logSetTitle.textContent = `LOG SET ${setsInLast5Hours + 1}`;

    const allLogsForExercise = appState.logs.filter(log => log.exercise_id === exerciseId && log.logged_data.weight);
    let pr = { weight: 0, reps: 0 };
    if (allLogsForExercise.length > 0) {
        const maxWeight = Math.max(...allLogsForExercise.map(log => log.logged_data.weight));
        const logsAtMaxWeight = allLogsForExercise.filter(log => log.logged_data.weight === maxWeight);
        const maxRepsAtMaxWeight = Math.max(...logsAtMaxWeight.map(log => log.logged_data.reps));
        pr.weight = maxWeight;
        pr.reps = maxRepsAtMaxWeight;
    }

    elements.prDisplay.textContent = `PR: ${pr.weight}kg x ${pr.reps}reps`;
    
    exercise.tracking_fields.forEach(field => {
        // Skip rendering the 'sets' field entirely
        if (field === 'sets' || field === 'quality') return; 

        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        const labelText = field.charAt(0).toUpperCase() + field.slice(1);
        
        if (field === 'form') {
            inputDiv.classList.add('full-width');
            inputDiv.innerHTML = `
                <label>${labelText}</label>
                <input type="range" id="input-${field}" min="1" max="5" step="1" value="3" class="slider">
                <div class="slider-labels">
                    <span>Poor</span>
                    <span>Average</span>
                    <span>Excellent</span>
                </div>
            `;
        } else if (field === 'intensity') {
            inputDiv.classList.add('full-width');
            inputDiv.innerHTML = `
                <label>Intensity (RIR)</label>
                <input type="range" id="input-intensity" min="0" max="3" step="1" value="0" class="slider">
                <div class="slider-labels">
                    <span>Failure</span>
                    <span>1-2</span>
                    <span>3-5</span>
                    <span>6-10</span>
                </div>
            `;
        } else {
             inputDiv.innerHTML = `
                <label>${labelText}</label>
                <input type="number" id="input-${field}" inputmode="decimal">
            `;
        }
        
        elements.logSetInputs.appendChild(inputDiv);
    });
}

function renderRecentSets() {
    elements.recentSetsList.innerHTML = '';
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    const recentLogs = appState.logs
        .filter(log => new Date(log.created_at) > fiveHoursAgo)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (recentLogs.length === 0) {
        elements.recentSetsList.innerHTML = '<p class="muted-text">No sets logged recently.</p>';
        return;
    }

    recentLogs.forEach(log => {
        const exercise = appState.exercises.find(ex => ex.id === log.exercise_id);
        if (!exercise) return;

        const item = document.createElement('div');
        item.className = 'recent-set-item';
        item.style.gridTemplateColumns = '1fr auto auto';

        const time = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let details = '';
        if(log.logged_data.weight && log.logged_data.reps) {
            details = `${log.logged_data.weight}kg x ${log.logged_data.reps} reps`;
        } else {
            for (const key in log.logged_data) {
                details += `${key}: ${log.logged_data[key]} `;
            }
        }

        item.innerHTML = `
            <span class="exercise-name">${exercise.name}</span>
            <span class="time">${time}</span>
            <span class="edit-set-icon material-icons" data-log-id="${log.id}">edit</span>
            <span class="details">${details}</span>
        `;

        // Edit icon click handler
        const editIcon = item.querySelector('.edit-set-icon');
        editIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditSetModal(log, exercise);
        });

        // Clicking the item itself shows details
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-set-icon')) return;
            let details = `Set Details (${exercise.name} at ${time}):\n\n`;
            for (const key in log.logged_data) {
                details += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${log.logged_data[key]}\n`;
            }
            alert(details);
        });

        elements.recentSetsList.appendChild(item);
    });
}

// --- SESSION GROUPING HELPER ---
function groupLogsIntoSessions(logs) {
    if (!logs || logs.length === 0) return [];

    const sorted = [...logs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

    const sessions = [];
    let currentSession = null;

    sorted.forEach(log => {
        const logTime = new Date(log.created_at).getTime();

        if (!currentSession || (logTime - new Date(currentSession.startTime).getTime()) > FIVE_HOURS_MS) {
            currentSession = {
                id: sessions.length + 1,
                startTime: log.created_at,
                logs: []
            };
            sessions.push(currentSession);
        }
        currentSession.logs.push(log);
    });

    // Derive session type from category of exercises within
    sessions.forEach(session => {
        const exIds = [...new Set(session.logs.map(l => l.exercise_id))];
        const categories = exIds.map(eid => {
            const ex = appState.exercises.find(e => e.id === eid);
            return ex ? appState.categories.find(c => c.id === ex.category_id) : null;
        }).filter(Boolean);

        // Use the category name of the first exercise as session type
        const firstCat = categories[0];
        session.type = firstCat ? firstCat.name : 'Mixed';
    });

    return sessions;
}

// --- EDIT SET MODAL LOGIC ---
let editingLogId = null;

function openEditSetModal(log, exercise) {
    editingLogId = log.id;
    elements.editSetTitle.textContent = `EDIT SET — ${exercise.name.toUpperCase()}`;
    elements.editSetInputs.innerHTML = '';

    exercise.tracking_fields.forEach(field => {
        if (field === 'sets' || field === 'quality') return;

        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        const labelText = field.charAt(0).toUpperCase() + field.slice(1);

        if (field === 'form') {
            inputDiv.classList.add('full-width');
            const savedVal = log.logged_data[field] !== undefined ? log.logged_data[field] : 3;
            inputDiv.innerHTML = `
                <label>${labelText}</label>
                <input type="range" id="edit-input-${field}" min="1" max="5" step="1" value="${savedVal}" class="slider">
                <div class="slider-labels">
                    <span>Poor</span>
                    <span>Average</span>
                    <span>Excellent</span>
                </div>
            `;
        } else if (field === 'intensity') {
            inputDiv.classList.add('full-width');
            // Reverse-map the RIR value back to slider index
            const intensityReverseMap = { 0: 0, 1.5: 1, 4: 2, 8: 3 };
            const savedIntensity = log.logged_data[field] !== undefined ? log.logged_data[field] : 0;
            const sliderVal = intensityReverseMap[savedIntensity] !== undefined ? intensityReverseMap[savedIntensity] : 0;
            inputDiv.innerHTML = `
                <label>Intensity (RIR)</label>
                <input type="range" id="edit-input-intensity" min="0" max="3" step="1" value="${sliderVal}" class="slider">
                <div class="slider-labels">
                    <span>Failure</span>
                    <span>1-2</span>
                    <span>3-5</span>
                    <span>6-10</span>
                </div>
            `;
        } else {
            const savedVal = log.logged_data[field] !== undefined ? log.logged_data[field] : '';
            inputDiv.innerHTML = `
                <label>${labelText}</label>
                <input type="number" id="edit-input-${field}" inputmode="decimal" value="${savedVal}">
            `;
        }

        elements.editSetInputs.appendChild(inputDiv);
    });

    elements.editSetModal.classList.remove('hidden');
}

elements.closeEditModalBtn.addEventListener('click', () => {
    elements.editSetModal.classList.add('hidden');
    editingLogId = null;
});

elements.saveEditSetBtn.addEventListener('click', async () => {
    if (!editingLogId) return;

    const log = appState.logs.find(l => l.id === editingLogId);
    if (!log) return;

    const exercise = appState.exercises.find(ex => ex.id === log.exercise_id);
    if (!exercise) return;

    let updatedData = {};
    exercise.tracking_fields.forEach(field => {
        if (field === 'sets') { updatedData[field] = 1; return; }
        const inputEl = document.getElementById(`edit-input-${field}`);
        if (inputEl && inputEl.value !== '') {
            if (field === 'intensity') {
                const intensityMap = [0, 1.5, 4, 8];
                updatedData[field] = intensityMap[parseInt(inputEl.value)];
            } else {
                updatedData[field] = parseFloat(inputEl.value);
            }
        }
    });

    const { data, error } = await supabaseClient
        .from('workout_logs')
        .update({ logged_data: updatedData })
        .eq('id', editingLogId)
        .select();

    if (error) {
        alert("Failed to update set.");
        console.error(error);
    } else {
        const idx = appState.logs.findIndex(l => l.id === editingLogId);
        if (idx !== -1) appState.logs[idx] = data[0];
        renderRecentSets();
        elements.editSetModal.classList.add('hidden');
        editingLogId = null;
    }
});

elements.deleteSetBtn.addEventListener('click', async () => {
    if (!editingLogId) return;

    const { error } = await supabaseClient
        .from('workout_logs')
        .delete()
        .eq('id', editingLogId);

    if (error) {
        alert("Failed to delete set.");
        console.error(error);
    } else {
        appState.logs = appState.logs.filter(l => l.id !== editingLogId);
        renderRecentSets();
        elements.editSetModal.classList.add('hidden');
        editingLogId = null;
    }
});

// --- 6. EVENT LISTENERS ---

elements.addCategoryBtn.addEventListener('click', async () => {
    const name = prompt("Enter new category name (e.g., Legs):");
    if (!name) return;
    
    const { data, error } = await supabaseClient
        .from('categories')
        .insert([{ name: name, user_id: appState.userId }])
        .select();

    if (error) {
        console.error(error);
        alert("Error creating category.");
    } else {
        appState.categories.push(data[0]);
        appState.selectedCategoryId = data[0].id;
        renderCategories();
        renderExercises(data[0].id);
        
        elements.logSetCard.classList.add('hidden');
        elements.dynamicFieldsCard.classList.remove('hidden');
        elements.addExerciseBtn.style.opacity = '1';
        elements.addExerciseBtn.style.pointerEvents = 'auto';
    }
});

elements.addExerciseBtn.addEventListener('click', () => {
    const categoryId = appState.selectedCategoryId;
    if (!categoryId) {
        alert("Please create and select a Category from the dropdown before adding an exercise!");
        return;
    }
    elements.exerciseModal.classList.remove('hidden');
});

elements.saveExBtn.addEventListener('click', async () => {
    const name = elements.newExNameInput.value;
    const categoryId = appState.selectedCategoryId;
    
    if (!categoryId) {
        alert("Critical Error: No category selected. Please close this and select a category first.");
        return;
    }

    let selectedFields = [];
    elements.trackCheckboxes.forEach(cb => {
        if (cb.checked) selectedFields.push(cb.value);
    });

    if (!name || selectedFields.length === 0) {
        alert("Please enter an exercise name and select at least one field to track (like Sets or Reps).");
        return;
    }

    const { data, error } = await supabaseClient
        .from('exercises')
        .insert([{
            name: name,
            category_id: categoryId,
            tracking_fields: selectedFields,
            user_id: appState.userId
        }])
        .select();

    if (error) {
        console.error("Supabase Error:", error);
        alert("Database Error: " + error.message);
    } else {
        appState.exercises.push(data[0]);
        appState.selectedExerciseId = data[0].id;
        renderExercises(categoryId);
        renderInputFields(data[0].id);
        elements.cancelExBtn.click(); 
        elements.logSetCard.classList.remove('hidden');
        elements.dynamicFieldsCard.classList.add('hidden');
    }
});

elements.cancelExBtn.addEventListener('click', () => {
    elements.exerciseModal.classList.add('hidden');
    elements.newExNameInput.value = '';
    elements.trackCheckboxes.forEach(cb => cb.checked = false);
});

elements.saveSetBtn.addEventListener('click', async () => {
    const exerciseId = appState.selectedExerciseId;
    const currentExercise = appState.exercises.find(ex => ex.id === exerciseId);
    let payload = {};

    currentExercise.tracking_fields.forEach(field => {
        // Automatically set 'sets' to 1 for database tracking
        if (field === 'sets') {
            payload[field] = 1;
            return;
        }

        const inputElement = document.getElementById(`input-${field}`);
        if (inputElement && inputElement.value !== '') {
            if (field === 'intensity') {
                const intensityMap = [0, 1.5, 4, 8];
                payload[field] = intensityMap[parseInt(inputElement.value)];
            } else {
                payload[field] = parseFloat(inputElement.value); 
            }
        }
    });

    if (Object.keys(payload).length === 0) {
        alert("Please enter some data before logging!");
        return;
    }

    const { data, error } = await supabaseClient
        .from('workout_logs')
        .insert([{ exercise_id: exerciseId, logged_data: payload, user_id: appState.userId }])
        .select();

    if (error) {
        console.error("Error saving:", error);
        alert("Failed to save set.");
    } else {
        alert("Set logged successfully! 💪🏽");
        appState.logs.push(data[0]);
        renderRecentSets();
        renderExercises(appState.selectedCategoryId);
        renderInputFields(exerciseId);
        
        currentExercise.tracking_fields.forEach(field => {
            const inputElement = document.getElementById(`input-${field}`);
            if (inputElement) {
                if (field === 'quality' || field === 'form') {
                    inputElement.value = '3';
                } else if (field === 'intensity') {
                    inputElement.value = '0';
                } else {
                    inputElement.value = '';
                }
            }
        });
    }
});

// --- 8. ANALYTICS & PLOTTING ---
const analyticsElements = {
    toggleWorkout: document.getElementById('toggle-workout-view'),
    toggleExercise: document.getElementById('toggle-exercise-view'),
    sessionView: document.getElementById('session-view'),
    exerciseView: document.getElementById('exercise-view'),
    sessionCategoryGrid: document.getElementById('session-category-grid'),
    sessionListContainer: document.getElementById('session-list-container'),
    sessionExerciseChipsContainer: document.getElementById('session-exercise-chips-container'),
    sessionExerciseChips: document.getElementById('session-exercise-chips'),
    sessionTableContainer: document.getElementById('session-table-container'),
    plotExerciseChips: document.getElementById('plot-exercise-chips'),
    sessionFilterContainer: document.getElementById('session-filter-container'),
    sessionFilterSelect: document.getElementById('session-filter-select'),
    chartsContainer: document.getElementById('charts-container')
};

let activeCharts = [];
let allSessions = [];
let selectedAnalyticsExerciseId = null;

// Toggle between Workout and Exercise views
analyticsElements.toggleWorkout.addEventListener('click', () => {
    analyticsElements.toggleWorkout.classList.add('active');
    analyticsElements.toggleExercise.classList.remove('active');
    analyticsElements.sessionView.classList.remove('hidden');
    analyticsElements.exerciseView.classList.add('hidden');
    analyticsElements.chartsContainer.innerHTML = '';
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
});

analyticsElements.toggleExercise.addEventListener('click', () => {
    analyticsElements.toggleExercise.classList.add('active');
    analyticsElements.toggleWorkout.classList.remove('active');
    analyticsElements.exerciseView.classList.remove('hidden');
    analyticsElements.sessionView.classList.add('hidden');
    analyticsElements.sessionListContainer.innerHTML = '';
    analyticsElements.sessionExerciseChipsContainer.classList.add('hidden');
    analyticsElements.sessionTableContainer.classList.add('hidden');
    populateExerciseChips();
});

// Load data when Progress tab is clicked
document.querySelector('[data-target="view-analytics"]').addEventListener('click', async () => {
    const { data: logData, error } = await supabaseClient
        .from('workout_logs')
        .select('*')
        .eq('user_id', appState.userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }
    appState.logs = logData;
    allSessions = groupLogsIntoSessions(logData);

    // Reset views
    analyticsElements.toggleWorkout.click();
    renderSessionCategories();
});

// ===== PHASE 3: BY SESSION VIEW =====

function renderSessionCategories() {
    analyticsElements.sessionCategoryGrid.innerHTML = '';
    analyticsElements.sessionListContainer.innerHTML = '';
    analyticsElements.sessionExerciseChipsContainer.classList.add('hidden');
    analyticsElements.sessionTableContainer.classList.add('hidden');

    // Get unique category names from sessions
    const sessionTypes = [...new Set(allSessions.map(s => s.type))];

    sessionTypes.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'grid-btn';
        btn.textContent = type;
        btn.addEventListener('click', () => {
            Array.from(analyticsElements.sessionCategoryGrid.children).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSessionList(type);
        });
        analyticsElements.sessionCategoryGrid.appendChild(btn);
    });
}

function renderSessionList(type) {
    analyticsElements.sessionListContainer.innerHTML = '';
    analyticsElements.sessionExerciseChipsContainer.classList.add('hidden');
    analyticsElements.sessionTableContainer.classList.add('hidden');

    const filtered = allSessions.filter(s => s.type === type).reverse(); // newest first

    if (filtered.length === 0) {
        analyticsElements.sessionListContainer.innerHTML = '<p class="muted-text">No sessions found.</p>';
        return;
    }

    filtered.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        const date = new Date(session.startTime);
        const dateStr = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        item.innerHTML = `
            <span>${dateStr} ${timeStr}</span>
            <div class="session-date">${session.logs.length} set(s)</div>
        `;
        item.addEventListener('click', () => {
            Array.from(analyticsElements.sessionListContainer.querySelectorAll('.session-item')).forEach(si => si.style.borderColor = '');
            item.style.borderColor = 'var(--primary-green)';
            renderSessionExerciseChips(session);
        });
        analyticsElements.sessionListContainer.appendChild(item);
    });
}

function renderSessionExerciseChips(session) {
    analyticsElements.sessionExerciseChipsContainer.classList.remove('hidden');
    analyticsElements.sessionExerciseChips.innerHTML = '';
    analyticsElements.sessionTableContainer.classList.add('hidden');

    const exIds = [...new Set(session.logs.map(l => l.exercise_id))];

    exIds.forEach(eid => {
        const exercise = appState.exercises.find(ex => ex.id === eid);
        if (!exercise) return;

        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = exercise.name;
        chip.addEventListener('click', () => {
            Array.from(analyticsElements.sessionExerciseChips.children).forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderSessionTable(session, eid);
        });
        analyticsElements.sessionExerciseChips.appendChild(chip);
    });
}

function renderSessionTable(session, exerciseId) {
    analyticsElements.sessionTableContainer.classList.remove('hidden');
    analyticsElements.sessionTableContainer.innerHTML = '';

    const exercise = appState.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const sets = session.logs.filter(l => l.exercise_id === exerciseId);

    // Gather all unique keys across all sets for this exercise
    const allKeys = [];
    const keySet = new Set();
    sets.forEach(s => {
        for (const key in s.logged_data) {
            if (!keySet.has(key)) {
                keySet.add(key);
                allKeys.push(key);
            }
        }
    });

    let html = '<table class="data-table"><thead><tr><th>Set #</th>';
    allKeys.forEach(key => {
        html += `<th>${key.charAt(0).toUpperCase() + key.slice(1)}</th>`;
    });
    html += '</tr></thead><tbody>';

    sets.forEach((set, idx) => {
        html += `<tr><td>${idx + 1}</td>`;
        allKeys.forEach(key => {
            const val = set.logged_data[key];
            html += `<td>${val !== undefined ? val : '—'}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    analyticsElements.sessionTableContainer.innerHTML = html;
}

// ===== PHASE 4: BY EXERCISE VIEW =====

function populateExerciseChips() {
    analyticsElements.plotExerciseChips.innerHTML = '';
    analyticsElements.sessionFilterContainer.classList.add('hidden');
    analyticsElements.chartsContainer.innerHTML = '';
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];

    const uniqueExIds = [...new Set(appState.logs.map(log => log.exercise_id))];

    uniqueExIds.forEach(id => {
        const exercise = appState.exercises.find(ex => ex.id === id);
        if (exercise) {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = exercise.name;
            chip.addEventListener('click', () => {
                Array.from(analyticsElements.plotExerciseChips.children).forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedAnalyticsExerciseId = id;
                analyticsElements.sessionFilterContainer.classList.remove('hidden');
                plotExerciseData(id, exercise);
            });
            analyticsElements.plotExerciseChips.appendChild(chip);
        }
    });
}

analyticsElements.sessionFilterSelect.addEventListener('change', () => {
    if (selectedAnalyticsExerciseId) {
        const exercise = appState.exercises.find(ex => ex.id === selectedAnalyticsExerciseId);
        if (exercise) plotExerciseData(selectedAnalyticsExerciseId, exercise);
    }
});

function plotExerciseData(exerciseId, exercise) {
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];
    analyticsElements.chartsContainer.innerHTML = '';

    // Filter sessions that contain this exercise
    let relevantSessions = allSessions.filter(s =>
        s.logs.some(l => l.exercise_id === exerciseId)
    );

    // Apply session filter
    const filterVal = analyticsElements.sessionFilterSelect.value;
    if (filterVal !== 'all') {
        relevantSessions = relevantSessions.slice(-parseInt(filterVal));
    }

    if (relevantSessions.length === 0) {
        analyticsElements.chartsContainer.innerHTML = '<div class="card"><p class="muted-text">No data to plot.</p></div>';
        return;
    }

    // Flatten sets with session grouping for labels
    const flatSets = [];
    relevantSessions.forEach(session => {
        const sessionSets = session.logs.filter(l => l.exercise_id === exerciseId);
        sessionSets.forEach((set, idx) => {
            flatSets.push({
                ...set,
                _sessionDate: new Date(session.startTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                _isFirstInSession: idx === 0
            });
        });
    });

    // Build labels: only show date for first set in session
    const labels = flatSets.map(s => s._isFirstInSession ? s._sessionDate : '');

    // --- CALCULATED METRICS ---

    // Adjusted e1RM per session (highest)
    const e1rmBySession = relevantSessions.map(session => {
        const sets = session.logs.filter(l => l.exercise_id === exerciseId);
        let maxE1rm = null;
        sets.forEach(s => {
            const w = s.logged_data.weight;
            const r = s.logged_data.reps;
            const rawIntensity = s.logged_data.intensity;
            if (w && r && rawIntensity !== undefined) {
                const rir = rawIntensity;
                const e1rm = w * (1 + (r + rir) / 30);
                if (maxE1rm === null || e1rm > maxE1rm) maxE1rm = e1rm;
            }
        });
        return maxE1rm;
    });

    // Volume per session
    const volumeBySession = relevantSessions.map(session => {
        const sets = session.logs.filter(l => l.exercise_id === exerciseId);
        return sets.reduce((sum, s) => {
            const w = s.logged_data.weight || 0;
            const r = s.logged_data.reps || 0;
            return sum + (w * r);
        }, 0);
    });

    // Plot e1RM (highest per session)
    if (e1rmBySession.some(v => v !== null)) {
        const e1rmLabels = relevantSessions.map(s => {
            const date = new Date(s.startTime);
            return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        });
        createChartCard('Estimated 1RM (Best per Session)', e1rmLabels, e1rmBySession.map(v => v !== null ? Math.round(v * 100) / 100 : null), '#bf5af2');
    }

    // Plot Volume per session
    if (volumeBySession.some(v => v > 0)) {
        const volLabels = relevantSessions.map(s => {
            const date = new Date(s.startTime);
            return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        });
        createChartCard('Session Volume (Weight × Reps)', volLabels, volumeBySession, '#6ffb85');
    }

    // --- RAW METRIC CHARTS ---
    exercise.tracking_fields.forEach(field => {
        if (field === 'sets' || field === 'quality') return;

        const dataPoints = flatSets.map(s => s.logged_data[field] !== undefined ? s.logged_data[field] : null);
        if (!dataPoints.some(v => v !== null)) return;

        createChartCard(field.charAt(0).toUpperCase() + field.slice(1), labels, dataPoints, '#6ffb85');
    });
}

function createChartCard(title, labels, dataPoints, borderColor) {
    const card = document.createElement('div');
    card.className = 'card';

    const canvasEl = document.createElement('canvas');
    card.appendChild(canvasEl);
    analyticsElements.chartsContainer.appendChild(card);

    const chart = new Chart(canvasEl.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: title.toUpperCase(),
                data: dataPoints,
                borderColor: borderColor,
                backgroundColor: borderColor === '#bf5af2' ? 'rgba(191, 90, 242, 0.1)' : 'rgba(111, 251, 133, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                pointBackgroundColor: '#ffffff',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            color: '#ffffff',
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: '#acaaad' }
                },
                x: {
                    grid: {
                        color: (context) => {
                            const label = context.tick ? context.tick.label : '';
                            return label && label !== '' ? 'rgba(255,255,255,0.2)' : 'transparent';
                        },
                        drawBorder: false
                    },
                    ticks: { color: '#acaaad', maxRotation: 45 }
                }
            },
            plugins: {
                legend: { labels: { color: '#ffffff' } }
            }
        }
    });

    activeCharts.push(chart);
}

// --- 9. GEMINI AI COACH LOGIC ---
const aiElements = {
    categorySelect: document.getElementById('ai-category-select'),
    settingsBtn: document.getElementById('ai-settings-btn'),
    getAdviceBtn: document.getElementById('get-advice-btn'),
    chatHistory: document.getElementById('chat-history'),
    promptModal: document.getElementById('prompt-modal'),
    promptInput: document.getElementById('system-prompt-input'),
    savePromptBtn: document.getElementById('save-prompt-btn'),
    cancelPromptBtn: document.getElementById('cancel-prompt-btn')
};

document.querySelector('[data-target="view-ai-chat"]').addEventListener('click', async () => {
    aiElements.categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    appState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        aiElements.categorySelect.appendChild(option);
    });

    const { data } = await supabaseClient.from('user_settings').select('setting_value').eq('setting_key', 'gemini_prompt').eq('user_id', appState.userId).single();
    if (data) appState.customPrompt = data.setting_value;
});

aiElements.settingsBtn.addEventListener('click', () => {
    aiElements.promptInput.value = appState.customPrompt || "";
    aiElements.promptModal.classList.remove('hidden');
});

aiElements.cancelPromptBtn.addEventListener('click', () => {
    aiElements.promptModal.classList.add('hidden');
});

aiElements.savePromptBtn.addEventListener('click', async () => {
    const newPrompt = aiElements.promptInput.value;
    
    const { error } = await supabaseClient.from('user_settings')
        .upsert({ setting_key: 'gemini_prompt', setting_value: newPrompt, user_id: appState.userId }, { onConflict: 'setting_key,user_id' });
        
    if (error) {
        alert("Failed to save prompt.");
        console.error(error);
    } else {
        appState.customPrompt = newPrompt;
        aiElements.promptModal.classList.add('hidden');
    }
});

aiElements.getAdviceBtn.addEventListener('click', async () => {
    const categoryId = aiElements.categorySelect.value;
    if (!categoryId) return alert("Please select a category first!");

    // Show analyzing message
    const analyzingEl = document.createElement('p');
    analyzingEl.id = 'analyzing-msg';
    analyzingEl.style.cssText = 'color: var(--text-muted); font-size: 14px;';
    analyzingEl.innerHTML = '<em>Analyzing recent data...</em>';
    aiElements.chatHistory.appendChild(analyzingEl);

    const relevantExercises = appState.exercises.filter(ex => ex.category_id === categoryId);
    const exIds = relevantExercises.map(ex => ex.id);

    const { data: recentLogs } = await supabaseClient
        .from('workout_logs')
        .select('created_at, logged_data, exercise_id')
        .in('exercise_id', exIds)
        .eq('user_id', appState.userId)
        .order('created_at', { ascending: false })
        .limit(20);

    let formattedHistory = "No recent data for this category.";
    if (recentLogs && recentLogs.length > 0) {
        // Group logs into sessions for clearer data
        const sorted = [...recentLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
        const sessions = [];
        let currentSession = null;

        sorted.forEach(log => {
            const logTime = new Date(log.created_at).getTime();
            if (!currentSession || (logTime - new Date(currentSession.startTime).getTime()) > FIVE_HOURS_MS) {
                currentSession = { startTime: log.created_at, logs: [] };
                sessions.push(currentSession);
            }
            currentSession.logs.push(log);
        });

        const sessionLines = sessions.map((session, i) => {
            const dateStr = new Date(session.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const sets = session.logs.map(log => {
                const exName = relevantExercises.find(e => e.id === log.exercise_id).name;
                return `  - ${exName}: ${log.logged_data.weight}kg x ${log.logged_data.reps} reps`;
            }).join('\n');
            return `Session ${i + 1} (${dateStr}):\n${sets}`;
        });
        formattedHistory = sessionLines.join('\n\n');
    }

    try {
        const response = await fetch('/api/get_advice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutHistory: formattedHistory,
                systemPrompt: appState.customPrompt
            })
        });

        const data = await response.json();

        // Remove analyzing message
        const analyzingMsg = document.getElementById('analyzing-msg');
        if (analyzingMsg) analyzingMsg.remove();

        if (data.advice) {
            const formattedAdvice = marked.parse(data.advice);
            aiElements.chatHistory.innerHTML += `
                <div class="gemini-response" style="font-size: 15px; line-height: 1.5;">${formattedAdvice}</div>`;
        } else {
            throw new Error("No advice returned");
        }
    } catch (error) {
        // Remove analyzing message on error too
        const analyzingMsg = document.getElementById('analyzing-msg');
        if (analyzingMsg) analyzingMsg.remove();

        console.error(error);
        aiElements.chatHistory.innerHTML += `<p style="color: #ff453a;">Failed to connect to the AI server. Are you running this locally or on Vercel?</p>`;
    }
});

// --- 10. AUTHENTICATION & SESSIONS ---

const authElements = {
    viewAuth: document.getElementById('view-auth'),
    emailInput: document.getElementById('auth-email'),
    passwordInput: document.getElementById('auth-password'),
    loginBtn: document.getElementById('login-btn'),
    signupBtn: document.getElementById('signup-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    authMsg: document.getElementById('auth-msg'),
    bottomNav: document.querySelector('.bottom-nav')
};

// Check if user is already logged in when the app opens
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        // User is logged in! Hide auth, show app, load their specific data
        appState.userId = session.user.id;
        authElements.viewAuth.classList.add('hidden');
        elements.viewSections.forEach(view => view.classList.add('hidden'));
        document.getElementById('view-log-workout').classList.remove('hidden');
        
        authElements.bottomNav.classList.remove('hidden');
        authElements.logoutBtn.classList.remove('hidden');
        
        loadDatabaseData(); // Fetch data NOW
    } else {
        // No user. Show auth, hide app.
        authElements.viewAuth.classList.remove('hidden');
        elements.viewSections.forEach(view => {
            if(view.id !== 'view-auth') view.classList.add('hidden');
        });
        authElements.bottomNav.classList.add('hidden');
        authElements.logoutBtn.classList.add('hidden');
    }
}

// Sign Up
authElements.signupBtn.addEventListener('click', async () => {
    const email = authElements.emailInput.value;
    const password = authElements.passwordInput.value;
    authElements.authMsg.textContent = "Loading...";

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
        authElements.authMsg.textContent = error.message;
        authElements.authMsg.style.color = "#ff453a";
    } else {
        authElements.authMsg.textContent = "Success! You can now log in.";
        authElements.authMsg.style.color = "var(--primary-green)";
    }
});

// Log In
authElements.loginBtn.addEventListener('click', async () => {
    const email = authElements.emailInput.value;
    const password = authElements.passwordInput.value;
    authElements.authMsg.textContent = "Loading...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        authElements.authMsg.textContent = error.message;
        authElements.authMsg.style.color = "#ff453a";
    } else {
        authElements.authMsg.textContent = "";
        checkUserSession(); // Triggers the app to load
    }
});

// Log Out
authElements.logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    
    // Clear the local state so data doesn't leak between users
    appState.categories = [];
    appState.exercises = [];
    appState.logs = [];
    
    checkUserSession(); // Kicks them back to the login screen
});

// Run this immediately when the script loads
checkUserSession();

// Listen for auth state changes (token refresh, sign out from another tab, etc.)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        appState.categories = [];
        appState.exercises = [];
        appState.logs = [];
        appState.userId = null;
        checkUserSession();
    }
});