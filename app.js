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
        const maxWeightLog = allLogsForExercise.reduce((max, log) => 
            log.logged_data.weight > max.logged_data.weight ? log : max
        );
        pr.weight = maxWeightLog.logged_data.weight;
        pr.reps = maxWeightLog.logged_data.reps;
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

let myChart = null;

document.querySelector('[data-target="view-analytics"]').addEventListener('click', async () => {
    const { data: logData, error } = await supabaseClient
        .from('workout_logs')
        .select('created_at, logged_data, exercise_id')
        .order('created_at', { ascending: true }); 

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }
    appState.logs = logData;
    populatePlotterExercises();
});

function populatePlotterExercises() {
    plotElements.exerciseChips.innerHTML = '';
    
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
        if (field === 'sets' || field === 'quality') return;

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
                tension: 0.3,
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

document.querySelector('[data-target="view-ai-chat"]').addEventListener('click', async () => {
    aiElements.categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    appState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        aiElements.categorySelect.appendChild(option);
    });

    const { data } = await supabaseClient.from('user_settings').select('setting_value').eq('setting_key', 'gemini_prompt').single();
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
        .upsert({ setting_key: 'gemini_prompt', setting_value: newPrompt }, { onConflict: 'setting_key' });
        
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

    aiElements.chatHistory.innerHTML += `<p style="color: var(--text-muted); font-size: 14px;"><em>Analyzing recent data...</em></p>`;

    const relevantExercises = appState.exercises.filter(ex => ex.category_id === categoryId);
    const exIds = relevantExercises.map(ex => ex.id);

    const { data: recentLogs } = await supabaseClient
        .from('workout_logs')
        .select('created_at, logged_data, exercise_id')
        .in('exercise_id', exIds)
        .order('created_at', { ascending: false })
        .limit(10);

    let formattedHistory = "No recent data for this category.";
    if (recentLogs && recentLogs.length > 0) {
        formattedHistory = recentLogs.map(log => {
            const exName = relevantExercises.find(e => e.id === log.exercise_id).name;
            const dateStr = new Date(log.created_at).toLocaleDateString();
            return `${exName} (${dateStr}): ${JSON.stringify(log.logged_data)}`;
        }).join('\n');
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
        
        if (data.advice) {
            const formattedAdvice = data.advice.replace(/\n/g, '<br>'); 
            aiElements.chatHistory.innerHTML += `
                <div style="background: var(--bg-elevated); padding: 12px; border-radius: 8px;">
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