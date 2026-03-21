// --- 1. SUPABASE SETUP ---
const supabaseUrl = 'https://jrqevdwotctdohgtyudx.supabase.co';
const supabaseKey = 'sb_publishable_obWjnqgr4tJ0LVcVC5j3Tw_8kCWcsxT';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. STATE MANAGEMENT ---
let appState = {
    categories: [],
    exercises: [],
    logs: []
};

async function loadDatabaseData() {
    const { data: catData, error: catErr } = await supabaseClient.from('categories').select('*');
    if (!catErr) appState.categories = catData;

    const { data: exData, error: exErr } = await supabaseClient.from('exercises').select('*');
    if (!exErr) appState.exercises = exData;

    renderCategories();

    // --- THE EMPTY STATE UX FIX ---
    if (appState.categories.length === 0) {
        // Give a helpful prompt in the empty space
        elements.dynamicFieldsContainer.innerHTML = '<p class="muted-text" style="color: var(--primary-blue); text-align: center; padding: 20px;">Welcome! 💪🏽<br><br>Start by clicking "+ New" next to <b>Category</b> to set up your first split.</p>';
        
        // Visually disable and lock the Add Exercise button
        elements.addExerciseBtn.style.opacity = '0.3';
        elements.addExerciseBtn.style.pointerEvents = 'none';
    }
}

// --- 3. DOM ELEMENTS ---
const elements = {
    hamburgerBtn: document.getElementById('hamburger-btn'),
    sideMenu: document.getElementById('side-menu'),
    navItems: document.querySelectorAll('.nav-item'),
    viewSections: document.querySelectorAll('.view-section'),
    viewTitle: document.getElementById('current-view-title'),
    
    categorySelect: document.getElementById('category-select'),
    exerciseSelect: document.getElementById('exercise-select'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    addExerciseBtn: document.getElementById('add-exercise-btn'),
    
    dynamicFieldsContainer: document.getElementById('dynamic-fields-container'),
    saveSetBtn: document.getElementById('save-set-btn'),

    // Modal Elements
    exerciseModal: document.getElementById('exercise-modal'),
    newExNameInput: document.getElementById('new-ex-name'),
    cancelExBtn: document.getElementById('cancel-ex-btn'),
    saveExBtn: document.getElementById('save-ex-btn'),
    trackCheckboxes: document.querySelectorAll('.track-cb')
};

// --- 4. UI & NAVIGATION LOGIC ---
elements.hamburgerBtn.addEventListener('click', () => {
    elements.sideMenu.classList.toggle('hidden');
});

elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        elements.viewSections.forEach(view => view.classList.add('hidden'));
        elements.navItems.forEach(nav => nav.classList.remove('active'));
        
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        
        e.target.classList.add('active');
        elements.viewTitle.textContent = e.target.textContent;
        elements.sideMenu.classList.add('hidden'); 
    });
});

// --- 5. RENDERING LOGIC ---
function renderCategories() {
    elements.categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    appState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        elements.categorySelect.appendChild(option);
    });
}

function renderExercises(categoryId) {
    elements.exerciseSelect.innerHTML = '<option value="" disabled selected>Select Exercise...</option>';
    elements.exerciseSelect.disabled = false;
    
    // The foreign key in your Supabase table is 'category_id'
    const filteredExercises = appState.exercises.filter(ex => ex.category_id === categoryId);
    
    filteredExercises.forEach(ex => {
        const option = document.createElement('option');
        option.value = ex.id;
        option.textContent = ex.name;
        elements.exerciseSelect.appendChild(option);
    });
}

function renderInputFields(exerciseId) {
    elements.dynamicFieldsContainer.innerHTML = ''; 
    const exercise = appState.exercises.find(ex => ex.id === exerciseId);
    
    if (!exercise) {
        elements.saveSetBtn.classList.add('hidden');
        return;
    }

    elements.saveSetBtn.classList.remove('hidden');

    // Supabase stores the array as 'tracking_fields'
    exercise.tracking_fields.forEach(field => {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        const labelText = field.charAt(0).toUpperCase() + field.slice(1);
        
        // Form gets 1-5, Intensity gets RIR mapping, everything else gets a number input
        if (field === 'form') {
            inputDiv.innerHTML = `
                <label>Form</label>
                <select id="input-${field}">
                    <option value="5">5 - Perfect</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Acceptable</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Bad / Injury Risk</option>
                </select>
            `;
        } else if (field === 'intensity') {
            // Values are numeric approximations of RIR so the chart can plot them on a Y-axis
            inputDiv.innerHTML = `
                <label>Intensity</label>
                <select id="input-${field}">
                    <option value="0">Failure (0 RIR)</option>
                    <option value="1.5">1-2 RIR</option>
                    <option value="4">3-5 RIR</option>
                    <option value="8">6-10 RIR</option>
                </select>
            `;
        } else {
            inputDiv.innerHTML = `
                <label>${labelText}</label>
                <input type="number" id="input-${field}" inputmode="decimal">
            `;
        }
        elements.dynamicFieldsContainer.appendChild(inputDiv);
    });
}

// --- 6. EVENT LISTENERS ---

// When Category Changes -> Render Exercises and Unlock Button
elements.categorySelect.addEventListener('change', (e) => {
    const categoryId = e.target.value;
    renderExercises(categoryId);
    
    elements.dynamicFieldsContainer.innerHTML = '<p class="muted-text">Select an exercise to log data.</p>';
    elements.saveSetBtn.classList.add('hidden');

    // --- UNLOCK THE EXERCISE BUTTON ---
    elements.addExerciseBtn.style.opacity = '1';
    elements.addExerciseBtn.style.pointerEvents = 'auto';
});

// When Exercise Changes -> Render Dynamic Inputs
elements.exerciseSelect.addEventListener('change', (e) => {
    renderInputFields(e.target.value);
});

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
        renderCategories();
        elements.categorySelect.value = data[0].id;
        elements.categorySelect.dispatchEvent(new Event('change'));
    }
});

// Open Exercise Modal (With strict safety check)
elements.addExerciseBtn.addEventListener('click', () => {
    const categoryId = elements.categorySelect.value;
    if (!categoryId) {
        alert("Please create and select a Category from the dropdown before adding an exercise!");
        return;
    }
    elements.exerciseModal.classList.remove('hidden');
});

// Save New Exercise (With strict safety check)
elements.saveExBtn.addEventListener('click', async () => {
    const name = elements.newExNameInput.value;
    const categoryId = elements.categorySelect.value;
    
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
        renderExercises(categoryId);
        elements.exerciseSelect.value = data[0].id;
        elements.exerciseSelect.dispatchEvent(new Event('change'));
        elements.cancelExBtn.click(); // Reset and close modal
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
    const exerciseId = elements.exerciseSelect.value;
    const currentExercise = appState.exercises.find(ex => ex.id === exerciseId);
    let payload = {};

    currentExercise.tracking_fields.forEach(field => {
        const inputElement = document.getElementById(`input-${field}`);
        if (inputElement && inputElement.value) {
            payload[field] = parseFloat(inputElement.value); 
        }
    });

    if (Object.keys(payload).length === 0) {
        alert("Please enter some data before logging!");
        return;
    }

    const { error } = await supabaseClient
        .from('workout_logs')
        .insert([{ exercise_id: exerciseId, logged_data: payload }]);

    if (error) {
        console.error("Error saving:", error);
        alert("Failed to save set.");
    } else {
        alert("Set logged successfully! 💪🏽");
        // Clear inputs for the next set
        currentExercise.tracking_fields.forEach(field => {
            if(field !== 'quality') {
               const inputElement = document.getElementById(`input-${field}`);
               if(inputElement) inputElement.value = '';
            }
        });
    }
});

// --- 8. ANALYTICS & PLOTTING ---
const plotElements = {
    exerciseSelect: document.getElementById('plot-exercise-select'),
    metricContainer: document.getElementById('plot-metric-container'),
    metricSelect: document.getElementById('plot-metric-select'),
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
    plotElements.exerciseSelect.innerHTML = '<option value="" disabled selected>Select Exercise...</option>';
    
    // Find unique exercise IDs in our logs
    const uniqueExIds = [...new Set(appState.logs.map(log => log.exercise_id))];
    
    uniqueExIds.forEach(id => {
        // Look up the name from our local state
        const exercise = appState.exercises.find(ex => ex.id === id);
        if (exercise) {
            const option = document.createElement('option');
            option.value = exercise.id;
            option.textContent = exercise.name;
            plotElements.exerciseSelect.appendChild(option);
        }
    });
}

// When an exercise is chosen, reveal the Y-Axis options
plotElements.exerciseSelect.addEventListener('change', (e) => {
    const exId = e.target.value;
    const exercise = appState.exercises.find(ex => ex.id === exId);
    
    plotElements.metricSelect.innerHTML = '<option value="" disabled selected>Select Metric...</option>';
    
    // Populate dropdown based on what this specific exercise tracks
    exercise.tracking_fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field.charAt(0).toUpperCase() + field.slice(1);
        plotElements.metricSelect.appendChild(option);
    });

    plotElements.metricContainer.classList.remove('hidden');
    plotElements.chartCard.classList.add('hidden'); // Hide chart until metric is picked
});

// When a metric is chosen, draw the graph
plotElements.metricSelect.addEventListener('change', (e) => {
    const exId = plotElements.exerciseSelect.value;
    const metric = e.target.value;
    
    // Filter logs for this exercise, and only keep rows where this metric exists
    const relevantLogs = appState.logs.filter(log => log.exercise_id === exId && log.logged_data[metric] !== undefined);

    // Prepare data arrays for Chart.js
    const labels = relevantLogs.map(log => {
        const date = new Date(log.created_at);
        return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    });
    const dataPoints = relevantLogs.map(log => log.logged_data[metric]);

    drawChart(labels, dataPoints, metric);
});

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
                borderColor: '#0a84ff', // iOS Blue
                backgroundColor: 'rgba(10, 132, 255, 0.1)',
                borderWidth: 3,
                tension: 0.3, // Adds a slight curve to the line
                pointBackgroundColor: '#ffffff',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            color: '#ffffff',
            scales: {
                y: { grid: { color: '#38383a' }, ticks: { color: '#8e8e93' } },
                x: { grid: { display: false }, ticks: { color: '#8e8e93' } }
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