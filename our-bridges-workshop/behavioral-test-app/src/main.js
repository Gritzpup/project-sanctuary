// Conditionally import Tauri API for desktop app
let invoke;

// Create a mock invoke function for web browser fallback
const createMockInvoke = () => {
    return async (command, payload) => {
        console.log(`Mock invoke: ${command}`, payload);
        if (command === 'run_behavioral_test') {
            return await mockBehavioralTest(payload.config);
        }
        return Promise.resolve({});
    };
};

// Try to use Tauri API if available, otherwise use mock
if (typeof window !== 'undefined' && window.__TAURI__) {
    try {
        const { invoke: tauriInvoke } = window.__TAURI__.tauri;
        invoke = tauriInvoke;
    } catch (error) {
        invoke = createMockInvoke();
    }
} else {
    invoke = createMockInvoke();
}

import Chart from 'chart.js/auto';

// Mock behavioral test function for web browser demonstration
async function mockBehavioralTest(config) {
    const personalities = ['Control', 'High Conscientiousness', 'High Openness', 'High Extraversion'];
    const categories = ['reasoning', 'creativity', 'ethics', 'communication', 'memory'];
    const prompts = [
        "Describe a complex problem you've solved.",
        "What's your approach to creative tasks?",
        "How do you handle ethical dilemmas?",
        "Explain a technical concept simply.",
        "Recall and analyze a past decision."
    ];
    
    const results = [];
    let promptId = 1;
    
    config.selected_groups.forEach(personality => {
        for (let i = 0; i < config.num_prompts; i++) {
            const categoryIndex = i % categories.length;
            const baseWordCount = personality === 'High Conscientiousness' ? 45 : 
                                 personality === 'High Openness' ? 52 : 
                                 personality === 'High Extraversion' ? 38 : 35;
            
            results.push({
                prompt_id: promptId++,
                category: categories[categoryIndex],
                prompt: prompts[categoryIndex],
                personality_group: personality,
                word_count: baseWordCount + Math.floor(Math.random() * 20) - 10,
                complexity_score: 0.5 + Math.random() * 0.4,
                sentiment_score: 0.3 + Math.random() * 0.4
            });
        }
    });
    
    return results;
}

class BehavioralTestApp {
    constructor() {
        this.isTestRunning = false;
        this.testResults = [];
        this.charts = {};
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupSliders();
        this.updateStats();
    }

    setupEventListeners() {
        // Start test button
        document.getElementById('start-test').addEventListener('click', () => {
            this.startTest();
        });

        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    setupTabs() {
        // Initialize first tab as active
        this.switchTab('dashboard');
    }

    setupSliders() {
        // Number of prompts slider
        const numPromptsSlider = document.getElementById('num-prompts');
        const numPromptsValue = document.getElementById('num-prompts-value');
        
        numPromptsSlider.addEventListener('input', (e) => {
            numPromptsValue.textContent = e.target.value;
        });

        // Test speed slider
        const testSpeedSlider = document.getElementById('test-speed');
        const testSpeedValue = document.getElementById('test-speed-value');
        
        testSpeedSlider.addEventListener('input', (e) => {
            testSpeedValue.textContent = parseFloat(e.target.value).toFixed(1);
        });
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab content
        document.getElementById(tabName).classList.add('active');
        
        // Add active class to selected tab button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Initialize charts if switching to charts tab
        if (tabName === 'charts' && this.testResults.length > 0) {
            this.initializeCharts();
        }
    }

    async startTest() {
        if (this.isTestRunning) {
            return;
        }

        this.isTestRunning = true;
        const startButton = document.getElementById('start-test');
        startButton.disabled = true;
        startButton.textContent = '⏳ Running Test...';

        // Show progress section
        document.getElementById('progress-section').classList.remove('hidden');
        document.getElementById('current-test-info').classList.remove('hidden');

        try {
            // Get test configuration
            const config = this.getTestConfig();

            // Start backend if needed
            await invoke('start_python_backend');

            // Run the test
            const results = await invoke('run_behavioral_test', { config });
            
            // Simulate progress updates
            await this.simulateTestProgress(config, results);

            this.testResults = results;
            this.updateStats();
            this.updateResults();
            this.updateAnalysis();

            // Switch to results tab
            this.switchTab('results');

        } catch (error) {
            console.error('Test failed:', error);
            alert('Test failed: ' + error);
        } finally {
            this.isTestRunning = false;
            startButton.disabled = false;
            startButton.textContent = '🚀 Start Behavioral Test';
        }
    }

    getTestConfig() {
        const numPrompts = parseInt(document.getElementById('num-prompts').value);
        const testSpeed = parseFloat(document.getElementById('test-speed').value);
        
        const selectedGroups = [];
        const checkboxes = [
            { id: 'control', name: 'Control' },
            { id: 'high-conscientiousness', name: 'High Conscientiousness' },
            { id: 'high-openness', name: 'High Openness' },
            { id: 'high-extraversion', name: 'High Extraversion' }
        ];

        checkboxes.forEach(checkbox => {
            if (document.getElementById(checkbox.id).checked) {
                selectedGroups.push(checkbox.name);
            }
        });

        return {
            num_prompts: numPrompts,
            test_speed: testSpeed,
            selected_groups: selectedGroups
        };
    }

    async simulateTestProgress(config, results) {
        const totalTests = config.num_prompts * config.selected_groups.length;
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const currentPrompt = document.getElementById('current-prompt');

        for (let i = 0; i < totalTests; i++) {
            const progress = ((i + 1) / totalTests) * 100;
            
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Testing ${i + 1}/${totalTests} (${progress.toFixed(1)}%)`;
            
            if (results[i]) {
                currentPrompt.textContent = `${results[i].category}: "${results[i].prompt}"`;
            }

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, config.test_speed * 100));
        }

        progressText.textContent = '✅ Test completed!';
    }

    updateStats() {
        const totalResponses = this.testResults.length;
        const personalityGroups = new Set(this.testResults.map(r => r.personality_group)).size;
        const testProgress = this.isTestRunning ? '...' : (totalResponses > 0 ? '100%' : '0%');
        
        document.getElementById('total-responses').textContent = totalResponses;
        document.getElementById('personality-groups').textContent = personalityGroups;
        document.getElementById('test-progress').textContent = testProgress;

        // Calculate effect size if we have data
        if (this.testResults.length > 10) {
            const effectSize = this.calculateEffectSize();
            document.getElementById('effect-size').textContent = effectSize.toFixed(3);
        }
    }

    calculateEffectSize() {
        const groups = {};
        this.testResults.forEach(result => {
            if (!groups[result.personality_group]) {
                groups[result.personality_group] = [];
            }
            groups[result.personality_group].push(result.word_count);
        });

        const groupNames = Object.keys(groups);
        if (groupNames.length < 2) return 0;

        const group1 = groups[groupNames[0]];
        const group2 = groups[groupNames[1]];

        if (group1.length === 0 || group2.length === 0) return 0;

        const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
        const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

        const variance1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
        const variance2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);

        const pooledStd = Math.sqrt(((group1.length - 1) * variance1 + (group2.length - 1) * variance2) / (group1.length + group2.length - 2));

        if (pooledStd === 0) return 0;

        return Math.abs(mean1 - mean2) / pooledStd;
    }

    updateResults() {
        const container = document.getElementById('results-container');
        
        if (this.testResults.length === 0) {
            container.innerHTML = '<p>No test results yet. Run a test to see detailed data.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'results-table';

        // Create header
        const header = table.createTHead();
        const headerRow = header.insertRow();
        const headers = ['Prompt ID', 'Category', 'Personality Group', 'Word Count', 'Complexity', 'Sentiment'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });

        // Create body
        const tbody = table.createTBody();
        this.testResults.forEach(result => {
            const row = tbody.insertRow();
            row.insertCell().textContent = result.prompt_id;
            row.insertCell().textContent = result.category;
            row.insertCell().textContent = result.personality_group;
            row.insertCell().textContent = result.word_count;
            row.insertCell().textContent = result.complexity_score.toFixed(2);
            row.insertCell().textContent = result.sentiment_score.toFixed(2);
        });

        container.innerHTML = '';
        container.appendChild(table);
    }

    updateAnalysis() {
        const container = document.getElementById('analysis-container');
        
        if (this.testResults.length === 0) {
            container.innerHTML = '<p>Statistical analysis will appear here after test completion.</p>';
            return;
        }

        // Calculate basic statistics
        const groups = {};
        this.testResults.forEach(result => {
            if (!groups[result.personality_group]) {
                groups[result.personality_group] = {
                    word_counts: [],
                    complexity_scores: [],
                    sentiment_scores: []
                };
            }
            groups[result.personality_group].word_counts.push(result.word_count);
            groups[result.personality_group].complexity_scores.push(result.complexity_score);
            groups[result.personality_group].sentiment_scores.push(result.sentiment_score);
        });

        let analysisHTML = '<h3>Group Statistics</h3>';
        
        Object.keys(groups).forEach(groupName => {
            const groupData = groups[groupName];
            const wordCountMean = groupData.word_counts.reduce((a, b) => a + b, 0) / groupData.word_counts.length;
            const complexityMean = groupData.complexity_scores.reduce((a, b) => a + b, 0) / groupData.complexity_scores.length;
            const sentimentMean = groupData.sentiment_scores.reduce((a, b) => a + b, 0) / groupData.sentiment_scores.length;

            analysisHTML += `
                <div class="stat-card">
                    <h4>${groupName}</h4>
                    <p><strong>Word Count:</strong> ${wordCountMean.toFixed(1)}</p>
                    <p><strong>Complexity:</strong> ${complexityMean.toFixed(2)}</p>
                    <p><strong>Sentiment:</strong> ${sentimentMean.toFixed(2)}</p>
                </div>
            `;
        });

        // Calculate effect size
        const effectSize = this.calculateEffectSize();
        
        analysisHTML += '<h3>Effect Size Analysis</h3>';
        if (effectSize > 0.8) {
            analysisHTML += `<p class="success">✅ Large effect size detected (Cohen's d = ${effectSize.toFixed(3)})</p>`;
        } else if (effectSize > 0.5) {
            analysisHTML += `<p class="warning">⚠️ Medium effect size detected (Cohen's d = ${effectSize.toFixed(3)})</p>`;
        } else if (effectSize > 0.2) {
            analysisHTML += `<p class="warning">📈 Small effect size detected (Cohen's d = ${effectSize.toFixed(3)})</p>`;
        } else {
            analysisHTML += `<p class="error">❌ Very small effect size (Cohen's d = ${effectSize.toFixed(3)})</p>`;
        }

        container.innerHTML = analysisHTML;
    }

    initializeCharts() {
        // Clean up existing charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        if (this.testResults.length === 0) return;

        // Prepare data for charts
        const groupData = {};
        this.testResults.forEach(result => {
            if (!groupData[result.personality_group]) {
                groupData[result.personality_group] = {
                    word_counts: [],
                    complexity_scores: []
                };
            }
            groupData[result.personality_group].word_counts.push(result.word_count);
            groupData[result.personality_group].complexity_scores.push(result.complexity_score);
        });

        // Word count chart
        const lengthCtx = document.getElementById('length-chart').getContext('2d');
        this.charts.length = new Chart(lengthCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(groupData),
                datasets: [{
                    label: 'Average Word Count',
                    data: Object.values(groupData).map(group => {
                        return group.word_counts.reduce((a, b) => a + b, 0) / group.word_counts.length;
                    }),
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.6)',
                        'rgba(118, 75, 162, 0.6)',
                        'rgba(255, 193, 7, 0.6)',
                        'rgba(40, 167, 69, 0.6)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(40, 167, 69, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Response Length by Personality Group'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Complexity chart
        const complexityCtx = document.getElementById('complexity-chart').getContext('2d');
        this.charts.complexity = new Chart(complexityCtx, {
            type: 'line',
            data: {
                labels: Object.keys(groupData),
                datasets: [{
                    label: 'Average Complexity Score',
                    data: Object.values(groupData).map(group => {
                        return group.complexity_scores.reduce((a, b) => a + b, 0) / group.complexity_scores.length;
                    }),
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Average Response Complexity by Personality Group'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BehavioralTestApp();
});