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
        // Give a helpful prompt in the empty space
        elements.dynamicFieldsCard.innerHTML = '<p class="muted-text" style="color: var(--primary-green); text-align: center; padding: 20px;">Welcome! 💪🏽<br><br>Start by clicking "+ New" next to <b>Category</b> to set up your first split.</p>';
        
        // Visually disable and lock the Add Exercise button
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
    recentSetsList: document.getElementById('recent-sets-list')
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
            renderExercises(categoryId); // refresh active state
            renderInputFields(ex.id);
            elements.logSetCard.classList.remove('hidden');
            elements.dynamicFieldsCard.classList.add('hidden');
        });
        elements.exerciseChips.appendChild(chip);
    });
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

    elements.logSetTitle.textContent = `Log ${getOrdinal(setsInLast5Hours + 1)} Set:`;

    const allLogsForExercise = appState.logs.filter(log => log.exercise_id === exerciseId && log.logged_data.weight);
    let pr = { weight: 0, reps: 0 };
    if (allLogsForExercise.length > 0) {
        const maxWeightLog = allLogsForExercise.reduce((max, log) => 
            log.logged_data.weight > max.logged_data.weight ? log : max
        );
        pr.weight = maxWeightLog.logged_data.weight;
        pr.reps = maxWeightLog.logged_data.reps;
    }

    elements.prDisplay.textContent = `PR: ${pr.weight}kg x ${pr.reps}reps`;
    
    exercise.tracking_fields.forEach(field => {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        const labelText = field.charAt(0).toUpperCase() + field.slice(1);
        
        if (field === 'quality' || field === 'form') {
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
        } else if (field === 'weight' || field === 'reps') {
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
            <span class="details">${details}</span>
        `;

        item.addEventListener('click', () => {
            let details = `Set Details (${exercise.name} at ${time}):\n\n`;
            for (const key in log.logged_data) {
                details += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${log.logged_data[key]}\n`;
            }
            alert(details);
        });

        elements.recentSetsList.appendChild(item);
    });
}

// --- 6. EVENT LISTENERS ---

// Create Category (Saves directly to Supabase)
elements.addCategoryBtn.addEventListener('click', async () => {
    const name = prompt("Enter new category name (e.g., Legs):");
    if (!name) return;
    
    const { data, error } = await supabaseClient
        .from('categories')
        .insert([{ name: name }])
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

// Open Exercise Modal (With strict safety check)
elements.addExerciseBtn.addEventListener('click', () => {
    const categoryId = appState.selectedCategoryId;
    if (!categoryId) {
        alert("Please create and select a Category from the dropdown before adding an exercise!");
        return;
    }
    elements.exerciseModal.classList.remove('hidden');
});

// Save New Exercise (With strict safety check)
elements.saveExBtn.addEventListener('click', async () => {
    const name = elements.newExNameInput.value;
    const categoryId = appState.selectedCategoryId;
    
    // Safety Check 1: Ensure a category is actually selected
    if (!categoryId) {
        alert("Critical Error: No category selected. Please close this and select a category first.");
        return;
    }

    let selectedFields = [];
    elements.trackCheckboxes.forEach(cb => {
        if (cb.checked) selectedFields.push(cb.value);
    });

    // Safety Check 2: Ensure they typed a name and checked at least one box
    if (!name || selectedFields.length === 0) {
        alert("Please enter an exercise name and select at least one field to track (like Sets or Reps).");
        return;
    }

    const { data, error } = await supabaseClient
        .from('exercises')
        .insert([{ 
            name: name, 
            category_id: categoryId, 
            tracking_fields: selectedFields 
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

// Close Exercise Modal
elements.cancelExBtn.addEventListener('click', () => {
    elements.exerciseModal.classList.add('hidden');
    elements.newExNameInput.value = '';
    elements.trackCheckboxes.forEach(cb => cb.checked = false);
});


// Save Set Data
elements.saveSetBtn.addEventListener('click', async () => {
    const exerciseId = appState.selectedExerciseId;
    const currentExercise = appState.exercises.find(ex => ex.id === exerciseId);
    let payload = {};

    currentExercise.tracking_fields.forEach(field => {
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
        .insert([{ exercise_id: exerciseId, logged_data: payload }])
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
        // Clear inputs for the next set
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
const plotElements = {
    exerciseChips: document.getElementById('plot-exercise-chips'),
    metricContainer: document.getElementById('plot-metric-container'),
    metricChips: document.getElementById('plot-metric-chips'),
    chartCard: document.getElementById('chart-card'),
    ctx: document.getElementById('analytics-chart').getContext('2d')
};

let myChart = null; // Holds the Chart.js instance

// Trigger data load when opening the analytics tab
document.querySelector('[data-target="view-analytics"]').addEventListener('click', async () => {
    // Fetch all logs from the database
    const { data: logData, error } = await supabaseClient
        .from('workout_logs')
        .select('created_at, logged_data, exercise_id')
        .order('created_at', { ascending: true }); // Chronological X-axis

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }
    appState.logs = logData;
    
    // Populate the first dropdown with exercises that actually have data
    populatePlotterExercises();
});

function populatePlotterExercises() {
    plotElements.exerciseChips.innerHTML = '';
    
    // Find unique exercise IDs in our logs
    const uniqueExIds = [...new Set(appState.logs.map(log => log.exercise_id))];
    
    uniqueExIds.forEach(id => {
        const exercise = appState.exercises.find(ex => ex.id === id);
        if (exercise) {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = exercise.name;
            chip.addEventListener('click', () => {
                Array.from(plotElements.exerciseChips.children).forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                
                appState.plotSelectedExerciseId = id;
                populatePlotterMetrics(exercise);
            });
            plotElements.exerciseChips.appendChild(chip);
        }
    });
}

function populatePlotterMetrics(exercise) {
    plotElements.metricChips.innerHTML = '';
    plotElements.metricContainer.classList.remove('hidden');
    plotElements.chartCard.classList.add('hidden');
    
    exercise.tracking_fields.forEach(field => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = field.charAt(0).toUpperCase() + field.slice(1);
        chip.addEventListener('click', () => {
            Array.from(plotElements.metricChips.children).forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            const relevantLogs = appState.logs.filter(log => log.exercise_id === exercise.id && log.logged_data[field] !== undefined);
            const labels = relevantLogs.map(log => {
                const date = new Date(log.created_at);
                return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            });
            const dataPoints = relevantLogs.map(log => log.logged_data[field]);
            
            drawChart(labels, dataPoints, field);
        });
        plotElements.metricChips.appendChild(chip);
    });
}

function drawChart(labels, dataPoints, metricName) {
    plotElements.chartCard.classList.remove('hidden');
    
    // Destroy the old chart if it exists so they don't overlap
    if (myChart) myChart.destroy();

    myChart = new Chart(plotElements.ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metricName.toUpperCase(),
                data: dataPoints,
                borderColor: '#6ffb85', 
                backgroundColor: 'rgba(111, 251, 133, 0.1)',
                borderWidth: 3,
                tension: 0.3, // Adds a slight curve to the line
                pointBackgroundColor: '#ffffff',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            color: '#ffffff',
            scales: {
                y: { grid: { display: false }, ticks: { color: '#acaaad' } },
                x: { grid: { display: false }, ticks: { color: '#acaaad' } }
            },
            plugins: {
                legend: { labels: { color: '#ffffff' } }
            }
        }
    });
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

// 1. Populate the Category Dropdown when the AI tab is clicked
document.querySelector('[data-target="view-ai-chat"]').addEventListener('click', async () => {
    aiElements.categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    appState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        aiElements.categorySelect.appendChild(option);
    });

    // Fetch custom prompt from Supabase
    const { data } = await supabaseClient.from('user_settings').select('setting_value').eq('setting_key', 'gemini_prompt').single();
    if (data) appState.customPrompt = data.setting_value;
});

// 2. Open / Close Prompt Settings
aiElements.settingsBtn.addEventListener('click', () => {
    aiElements.promptInput.value = appState.customPrompt || "";
    aiElements.promptModal.classList.remove('hidden');
});

aiElements.cancelPromptBtn.addEventListener('click', () => {
    aiElements.promptModal.classList.add('hidden');
});

// 3. Save Custom Prompt to Database
aiElements.savePromptBtn.addEventListener('click', async () => {
    const newPrompt = aiElements.promptInput.value;
    
    // Upsert (Update or Insert) the setting
    const { error } = await supabaseClient.from('user_settings')
        .upsert({ setting_key: 'gemini_prompt', setting_value: newPrompt }, { onConflict: 'setting_key' });
        
    if (error) {
        alert("Failed to save prompt.");
        console.error(error);
    } else {
        appState.customPrompt = newPrompt;
        aiElements.promptModal.classList.add('hidden');
    }
});

// 4. Generate AI Advice
aiElements.getAdviceBtn.addEventListener('click', async () => {
    const categoryId = aiElements.categorySelect.value;
    if (!categoryId) return alert("Please select a category first!");

    aiElements.chatHistory.innerHTML += `<p style="color: var(--text-muted); font-size: 14px;"><em>Analyzing recent data...</em></p>`;

    // Find all exercises belonging to this category
    const relevantExercises = appState.exercises.filter(ex => ex.category_id === categoryId);
    const exIds = relevantExercises.map(ex => ex.id);

    // Fetch the last 10 logs for these specific exercises
    const { data: recentLogs } = await supabaseClient
        .from('workout_logs')
        .select('created_at, logged_data, exercise_id')
        .in('exercise_id', exIds)
        .order('created_at', { ascending: false })
        .limit(10);

    // Format the data into clean text for Gemini
    let formattedHistory = "No recent data for this category.";
    if (recentLogs && recentLogs.length > 0) {
        formattedHistory = recentLogs.map(log => {
            const exName = relevantExercises.find(e => e.id === log.exercise_id).name;
            const dateStr = new Date(log.created_at).toLocaleDateString();
            return `${exName} (${dateStr}): ${JSON.stringify(log.logged_data)}`;
        }).join('\n');
    }

    try {
        // Call your Vercel API endpoint
        const response = await fetch('/api/get-advice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workoutHistory: formattedHistory,
                systemPrompt: appState.customPrompt
            })
        });

        const data = await response.json();
        
        if (data.advice) {
            // Use marked.js if you want markdown formatting, or just basic text formatting
            const formattedAdvice = data.advice.replace(/\n/g, '<br>'); 
            aiElements.chatHistory.innerHTML += `
                <div style="background: var(--menu-bg); padding: 12px; border-radius: 8px;">
                    <strong style="color: var(--ai-purple);">Gemini:</strong>
                    <p style="margin-top: 8px; font-size: 15px; line-height: 1.5;">${formattedAdvice}</p>
                </div>`;
        } else {
            throw new Error("No advice returned");
        }
    } catch (error) {
        console.error(error);
        aiElements.chatHistory.innerHTML += `<p style="color: #ff453a;">Failed to connect to the AI server. Are you running this locally or on Vercel?</p>`;
    }
});

// --- 7. START APP ---
loadDatabaseData();