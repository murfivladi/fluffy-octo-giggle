// ===================================================================
// КОНФИГУРАЦИЯ И УТИЛИТЫ
// ===================================================================
const CONFIG = {
    NEURON_COUNT: 1500,
    SYNAPSE_DENSITY: 0.02, // Вероятность связи между двумя нейронами
    REFRACTORY_PERIOD: 5,
    SPIKE_DELAY: 1,
    THOUGHT_THRESHOLD: 0.6, // Уровень активации для формирования мысли
    THOUGHT_DECAY: 0.995,
    MEMORY_CONSOLIDATION_THRESHOLD: 0.8,
    CANVAS_SCALE: 1.5,
    WORKER_TICK_INTERVAL_MS: 50, // Как часто worker обновляет симуляцию
};

const UTILS = {
    randFloat(min, max) { return Math.random() * (max - min) + min; },
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    gaussianRandom() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    },
    clamp(value, min, max) { return Math.min(Math.max(value, min), max); },
    distance(p1, p2) { return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2); }
};

// ===================================================================
// МОДЕЛЬ ДАННЫХ
// ===================================================================
class Neuron {
    constructor(id, x, y, regionId, type = 'excitatory') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.regionId = regionId;
        this.type = type; // 'excitatory' or 'inhibitory'
        this.potential = UTILS.randFloat(-0.05, 0.05);
        this.threshold = UTILS.randFloat(0.5, 0.7);
        this.refractoryTimer = 0;
        this.fatigue = 0;
        this.lastSpikeTime = -Infinity;
        this.isSpiking = false;
    }

    reset() {
        this.potential = 0;
        this.isSpiking = false;
    }
}

class Synapse {
    constructor(id, fromNeuronId, toNeuronId) {
        this.id = id;
        this.fromNeuronId = fromNeuronId;
        this.toNeuronId = toNeuronId;
        this.weight = UTILS.randFloat(0.1, 0.5);
        this.delay = CONFIG.SPIKE_DELAY + UTILS.randInt(0, 2);
        this.lastPreSpikeTime = -Infinity;
        this.lastPostSpikeTime = -Infinity;
    }
}

class BrainRegion {
    constructor(id, name, centerX, centerY, radius, color) {
        this.id = id;
        this.name = name;
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
        this.color = color;
        this.neuronIds = new Set();
        this.activity = 0;
        this.influence = 1.0;
    }
}

// ===================================================================
// WEB WORKER CODE (встроен как строка)
// ===================================================================
const workerCode = `
    // --- Переменные, полученные из основного потока ---
    let neurons, synapses, regions, thoughts, emotions, attention, consciousness, memory, state, time;
    let config;

    // --- Внутренние функции Worker ---
    const UTILS = {
        randFloat(min, max) { return Math.random() * (max - min) + min; },
        clamp(value, min, max) { return Math.min(Math.max(value, min), max); },
    };

    function initializeBrain(data) {
        ({ neurons, synapses, regions, thoughts, emotions, attention, consciousness, memory, state, time, config } = data);
        neurons = new Map(neurons);
        synapses = new Map(synapses);
        regions = new Map(regions);
        thoughts = new Map(thoughts);
        emotions = new Map(emotions);
    }

    function tick(stimulusLevel, isSleeping) {
        time++;
        const spikes = [];

        // 1. Сенсорный вход и внутренний шум
        if (!isSleeping) {
            const sensoryRegion = regions.get('sensory');
            for (const neuronId of sensoryRegion.neuronIds) {
                if (Math.random() < stimulusLevel / 1000) {
                    const neuron = neurons.get(neuronId);
                    neuron.potential += UTILS.randFloat(0.5, 1.0);
                }
            }
        } else { // Сон: случайные активации (репетиция)
            if(Math.random() < 0.01) {
                const randomNeuronId = Array.from(neurons.keys())[UTILS.randInt(0, neurons.size - 1)];
                neurons.get(randomNeuronId).potential += 0.8;
            }
        }

        // 2. Обновление нейронов
        for (const neuron of neurons.values()) {
            if (neuron.refractoryTimer > 0) {
                neuron.refractoryTimer--;
                neuron.potential *= 0.9; // Быстрое затухание в рефрактерности
                continue;
            }

            // Шум
            neuron.potential += UTILS.gaussianRandom() * 0.02;

            // Применение глобальных модуляторов (эмоции, усталость)
            const stress = emotions.get('stress').level;
            neuron.threshold = 0.6 + stress * 0.2;
            neuron.fatigue = Math.min(1, neuron.fatigue + 0.0001);

            // Проверка на спайк
            if (neuron.potential > neuron.threshold) {
                neuron.isSpiking = true;
                neuron.lastSpikeTime = time;
                neuron.refractoryTimer = config.REFRACTORY_PERIOD;
                neuron.potential = 0;
                neuron.fatigue = Math.max(0, neuron.fatigue - 0.01);

                // Создание спайка для передачи по синапсам
                for (const synapseId of neuron.synapsesOut) {
                    const synapse = synapses.get(synapseId);
                    spikes.push({ toNeuronId: synapse.toNeuronId, weight: synapse.weight, delay: synapse.delay });
                }
            } else {
                neuron.isSpiking = false;
                // Естественное затухание потенциала
                neuron.potential *= 0.98;
            }
        }

        // 3. Распространение спайков и обучение синапсов
        for (const spike of spikes) {
            setTimeout(() => {
                const targetNeuron = neurons.get(spike.toNeuronId);
                if (targetNeuron && targetNeuron.refractoryTimer === 0) {
                    targetNeuron.potential += spike.weight;
                }
            }, spike.delay);
        }

        // Обучение Хебба (упрощенное)
        for (const synapse of synapses.values()) {
            const preNeuron = neurons.get(synapse.fromNeuronId);
            const postNeuron = neurons.get(synapse.toNeuronId);
            if (preNeuron.lastSpikeTime === time && postNeuron.lastSpikeTime === time) {
                synapse.weight = UTILS.clamp(synapse.weight * 1.01, 0, 1.0);
            } else if (time - preNeuron.lastSpikeTime > 100) {
                synapse.weight *= 0.9999; // Затухание неиспользуемых связей
            }
        }

        // 4. Обновление высокоуровневых состояний
        updateHighLevelCognition(isSleeping);

        return getSimulationState();
    }
    
    function updateHighLevelCognition(isSleeping) {
        // Обновление активности регионов
        for (const region of regions.values()) {
            let totalPotential = 0;
            let count = 0;
            for (const nid of region.neuronIds) {
                totalPotential += neurons.get(nid).potential;
                count++;
            }
            region.activity = count > 0 ? totalPotential / count : 0;
        }

        // Эмоции
        const emotionRegion = regions.get('emotion');
        const stress = emotions.get('stress');
        const joy = emotions.get('joy');
        if (emotionRegion.activity > 0.6) {
            if (regions.get('sensory').activity > 0.5) {
                joy.level = UTILS.clamp(joy.level + 0.01, 0, 1);
            } else {
                stress.level = UTILS.clamp(stress.level + 0.005, 0, 1);
            }
        } else {
            stress.level = UTILS.clamp(stress.level - 0.002, 0, 1);
            joy.level = UTILS.clamp(joy.level - 0.003, 0, 1);
        }

        // Сознание (глобальное рабочее пространство)
        const execActivity = regions.get('executive').activity;
        const assocActivity = regions.get('association').activity;
        consciousness.clarity = (execActivity + assocActivity) / 2 * (1 - stress.level);

        // Внимание
        const mostActiveThought = findMostActiveThought();
        if (mostActiveThought) {
            attention.focus = mostActiveThought.id;
            attention.level = mostActiveThought.strength;
        } else {
            attention.focus = null;
            attention.level = 0.1;
        }
        
        // Мысли
        updateThoughts(isSleeping);
    }

    function findMostActiveThought() {
        let mostActive = null;
        for (const thought of thoughts.values()) {
            if (!mostActive || thought.strength > mostActive.strength) {
                mostActive = thought;
            }
        }
        return mostActive;
    }

    function updateThoughts(isSleeping) {
        const assocRegion = regions.get('association');
        // Упрощенная детекция мыслей: если ассоциативная зона активна, создаем мысль
        if (assocRegion.activity > CONFIG.THOUGHT_THRESHOLD && Math.random() < 0.1) {
            const thoughtId = 'thought_' + time;
            const thoughtText = generateThoughtText();
            thoughts.set(thoughtId, {
                id: thoughtId,
                text: thoughtText,
                strength: assocRegion.activity,
                age: 0
            });
        }

        // Старение и затухание мыслей
        for (const [id, thought] of thoughts.entries()) {
            thought.age++;
            thought.strength *= CONFIG.THOUGHT_DECAY;
            if (thought.strength < 0.01) {
                thoughts.delete(id);
            }
        }
    }
    
    function generateThoughtText() {
        const fragments = ["Что если...", "Интересно, а...", "Вспомнил...", "Надо...", "Почему..."];
        const subjects = ["это работает", "я так сделал", "он сказал", "ничего не происходит", "всё связано"];
        return fragments[UTILS.randInt(0, fragments.length - 1)] + " " + subjects[UTILS.randInt(0, subjects.length - 1)];
    }

    function getSimulationState() {
        return {
            neurons: Array.from(neurons.values()),
            regions: Array.from(regions.values()),
            thoughts: Array.from(thoughts.values()),
            emotions: Array.from(emotions.values()),
            consciousness: consciousness,
            attention: attention,
            time: time
        };
    }

    // --- Сообщения от основного потока ---
    self.onmessage = function(e) {
        const { type, data } = e.data;
        if (type === 'init') {
            initializeBrain(data);
            self.postMessage({ type: 'ready' });
        } else if (type === 'tick') {
            const state = tick(data.stimulusLevel, data.isSleeping);
            self.postMessage({ type: 'update', state: state });
        }
    };
`;


// ===================================================================
// ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// ===================================================================
class BrainSimulation {
    constructor() {
        this.canvas = document.getElementById('brainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worker = null;
        this.neurons = new Map();
        this.synapses = new Map();
        this.regions = new Map();
        this.thoughts = new Map();
        this.emotions = new Map();
        this.attention = { focus: null, level: 0.1 };
        this.consciousness = { clarity: 0.5 };
        this.state = 'awake';
        this.time = 0;
        this.isRunning = false;
        this.speedMultiplier = 1.0;
        this.stimulusLevel = 5;

        this.setupCanvas();
        this.initializeBrainModel();
        this.setupWorker();
        this.setupEventListeners();
        this.loadState();
        this.start();
    }

    setupCanvas() {
        const resize = () => {
            this.canvas.width = this.canvas.offsetWidth;
            this.canvas.height = this.canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);
    }

    initializeBrainModel() {
        // Создание регионов
        const w = this.canvas.width / CONFIG.CANVAS_SCALE;
        const h = this.canvas.height / CONFIG.CANVAS_SCALE;
        this.regions.set('sensory', new BrainRegion('sensory', 'Сенсорная', w * 0.2, h * 0.2, 80, '#ff6b6b'));
        this.regions.set('association', new BrainRegion('association', 'Ассоциативная', w * 0.5, h * 0.5, 120, '#4ecdc4'));
        this.regions.set('memory', new BrainRegion('memory', 'Память', w * 0.8, h * 0.3, 90, '#45b7d1'));
        this.regions.set('emotion', new BrainRegion('emotion', 'Эмоции', w * 0.25, h * 0.7, 70, '#f9ca24'));
        this.regions.set('attention', new BrainRegion('attention', 'Внимание', w * 0.7, h * 0.7, 60, '#6c5ce7'));
        this.regions.set('executive', new BrainRegion('executive', 'Исполнительный', w * 0.5, h * 0.2, 70, '#a29bfe'));
        this.regions.set('self', new BrainRegion('self', 'Самосознание', w * 0.5, h * 0.8, 50, '#fd79a8'));

        // Создание нейронов
        let neuronId = 0;
        for (const region of this.regions.values()) {
            const neuronCountInRegion = Math.floor(CONFIG.NEURON_COUNT / this.regions.size);
            for (let i = 0; i < neuronCountInRegion; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const r = Math.random() * region.radius;
                const x = region.centerX + r * Math.cos(angle);
                const y = region.centerY + r * Math.sin(angle);
                const type = Math.random() < 0.8 ? 'excitatory' : 'inhibitory';
                const neuron = new Neuron(neuronId++, x, y, region.id, type);
                this.neurons.set(neuron.id, neuron);
                region.neuronIds.add(neuron.id);
                neuron.synapsesOut = new Set();
                neuron.synapsesIn = new Set();
            }
        }

        // Создание синапсов
        let synapseId = 0;
        const neuronArray = Array.from(this.neurons.values());
        for (let i = 0; i < neuronArray.length; i++) {
            for (let j = 0; j < neuronArray.length; j++) {
                if (i === j) continue;
                if (Math.random() < CONFIG.SYNAPSE_DENSITY) {
                    const fromNeuron = neuronArray[i];
                    const toNeuron = neuronArray[j];
                    
                    // Предпочтение внутрирегиональным связям
                    const dist = UTILS.distance(fromNeuron, toNeuron);
                    const maxDist = this.regions.get(fromNeuron.regionId).radius * 2;
                    if (fromNeuron.regionId === toNeuron.regionId || dist < maxDist) {
                        const synapse = new Synapse(synapseId++, fromNeuron.id, toNeuron.id);
                        if (fromNeuron.type === 'inhibitory') synapse.weight *= -1;
                        this.synapses.set(synapse.id, synapse);
                        fromNeuron.synapsesOut.add(synapse.id);
                        toNeuron.synapsesIn.add(synapse.id);
                    }
                }
            }
        }
        
        // Инициализация эмоций
        this.emotions.set('fear', { level: 0.1, color: '#c0392b' });
        this.emotions.set('joy', { level: 0.1, color: '#f1c40f' });
        this.emotions.set('stress', { level: 0.1, color: '#e74c3c' });
        this.emotions.set('interest', { level: 0.2, color: '#3498db' });
        this.emotions.set('apathy', { level: 0.1, color: '#7f8c8d' });
    }

    setupWorker() {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e) => {
            const { type, state } = e.data;
            if (type === 'ready') {
                console.log("Worker готов.");
                this.isRunning = true;
                this.runSimulationLoop();
            } else if (type === 'update') {
                this.updateState(state);
                this.render();
            }
        };
        
        const initialData = {
            neurons: Array.from(this.neurons.entries()),
            synapses: Array.from(this.synapses.entries()),
            regions: Array.from(this.regions.entries()),
            thoughts: Array.from(this.thoughts.entries()),
            emotions: Array.from(this.emotions.entries()),
            attention: this.attention,
            consciousness: this.consciousness,
            memory: [], // упрощено
            state: this.state,
            time: this.time,
            config: CONFIG
        };
        this.worker.postMessage({ type: 'init', data: initialData });
    }

    setupEventListeners() {
        // Слайдеры
        const speedSlider = document.getElementById('speedSlider');
        speedSlider.addEventListener('input', (e) => {
            this.speedMultiplier = e.target.value / 100;
            document.getElementById('speedValue').textContent = this.speedMultiplier.toFixed(1) + 'x';
        });

        const stimulusSlider = document.getElementById('stimulusSlider');
        stimulusSlider.addEventListener('input', (e) => {
            this.stimulusLevel = parseInt(e.target.value);
        });

        // Кнопки
        document.getElementById('sleepBtn').addEventListener('click', () => {
            this.state = this.state === 'sleeping' ? 'awake' : 'sleeping';
            document.getElementById('sleepBtn').textContent = this.state === 'sleeping' ? 'Пробудиться' : 'Сон';
        });

        document.getElementById('damageBtn').addEventListener('click', () => {
            const regionNames = Array.from(this.regions.keys());
            const targetRegionName = regionNames[UTILS.randInt(0, regionNames.length - 1)];
            const targetRegion = this.regions.get(targetRegionName);
            console.log(`Повреждение зоны: ${targetRegion.name}`);
            for (const neuronId of targetRegion.neuronIds) {
                const neuron = this.neurons.get(neuronId);
                neuron.threshold *= 1.5; // Повышаем порог, делая возбуждение сложнее
                neuron.fatigue = 1.0;
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            if(confirm('Это сбросит всю симуляцию. Продолжить?')) {
                localStorage.removeItem('brainSimulationState');
                location.reload();
            }
        });

        // Взаимодействие с canvas
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / CONFIG.CANVAS_SCALE;
            const y = (e.clientY - rect.top) / CONFIG.CANVAS_SCALE;
            
            // Найти ближайшие нейроны и стимулировать их
            for (const neuron of this.neurons.values()) {
                if (UTILS.distance({x, y}, neuron) < 30) {
                    neuron.potential += 1.0;
                }
            }
        });
    }

    runSimulationLoop() {
        setInterval(() => {
            if (!this.isRunning) return;
            this.worker.postMessage({
                type: 'tick',
                data: {
                    stimulusLevel: this.stimulusLevel,
                    isSleeping: this.state === 'sleeping'
                }
            });
        }, CONFIG.WORKER_TICK_INTERVAL_MS / this.speedMultiplier);
    }

    updateState(state) {
        // Обновляем состояние на основе данных от worker
        this.neurons = new Map(state.neurons.map(n => [n.id, n]));
        this.regions = new Map(state.regions.map(r => [r.id, r]));
        this.thoughts = new Map(state.thoughts.map(t => [t.id, t]));
        this.emotions = new Map(state.emotions.map(e => [e.type, e]));
        this.consciousness = state.consciousness;
        this.attention = state.attention;
        this.time = state.time;

        this.updateUI();
    }

    updateUI() {
        document.getElementById('consciousnessLevel').textContent = this.consciousness.clarity.toFixed(2);
        
        const focusText = this.attention.focus ? this.thoughts.get(this.attention.focus)?.text || '...' : 'Нет';
        document.getElementById('attentionFocus').textContent = focusText.substring(0, 30) + '...';

        let dominantEmotion = 'Спокойствие';
        let maxLevel = 0;
        for (const [name, emotion] of this.emotions.entries()) {
            if (emotion.level > maxLevel) {
                maxLevel = emotion.level;
                dominantEmotion = name;
            }
        }
        document.getElementById('dominantEmotion').textContent = dominantEmotion.charAt(0).toUpperCase() + dominantEmotion.slice(1);

        const thoughtLog = document.getElementById('thoughtLog');
        const newThoughts = Array.from(this.thoughts.values()).sort((a,b) => b.age - a.age).slice(0, 5);
        thoughtLog.innerHTML = '';
        newThoughts.forEach(t => {
            const div = document.createElement('div');
            div.className = 'thought';
            div.textContent = t.text;
            thoughtLog.appendChild(div);
        });
    }

    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.scale(CONFIG.CANVAS_SCALE, CONFIG.CANVAS_SCALE);

        // Рисуем регионы
        for (const region of this.regions.values()) {
            const gradient = this.ctx.createRadialGradient(region.centerX, region.centerY, 0, region.centerX, region.centerY, region.radius);
            const baseColor = region.color;
            const activity = region.activity;
            gradient.addColorStop(0, baseColor + '40'); // Полупрозрачный центр
            gradient.addColorStop(1, baseColor + '00'); // Прозрачные края
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.arc(region.centerX, region.centerY, region.radius * (1 + activity * 0.2), 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Рисуем синапсы (только активные)
        // this.ctx.strokeStyle = '#ffffff10';
        // for (const synapse of this.synapses.values()) {
        //     const from = this.neurons.get(synapse.fromNeuronId);
        //     const to = this.neurons.get(synapse.toNeuronId);
        //     if(from && to) {
        //         this.ctx.beginPath();
        //         this.ctx.moveTo(from.x, from.y);
        //         this.ctx.lineTo(to.x, to.y);
        //         this.ctx.stroke();
        //     }
        // }

        // Рисуем нейроны
        for (const neuron of this.neurons.values()) {
            const potential = UTILS.clamp(neuron.potential, 0, 1);
            const size = neuron.type === 'inhibitory' ? 1.5 : 1;
            
            if (neuron.isSpiking) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(neuron.x, neuron.y, 4 * size, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                const brightness = Math.floor(potential * 255);
                const region = this.regions.get(neuron.regionId);
                const color = region ? region.color : '#ffffff';
                this.ctx.fillStyle = color + Math.floor(brightness * 0.5).toString(16).padStart(2, '0');
                this.ctx.beginPath();
                this.ctx.arc(neuron.x, neuron.y, 2 * size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }
    
    saveState() {
        const stateToSave = {
            neurons: Array.from(this.neurons.entries()),
            synapses: Array.from(this.synapses.entries()),
            regions: Array.from(this.regions.entries()),
            time: this.time
        };
        localStorage.setItem('brainSimulationState', JSON.stringify(stateToSave));
    }

    loadState() {
        const savedState = localStorage.getItem('brainSimulationState');
        if (savedState) {
            try {
                const data = JSON.parse(savedState);
                // Упрощенная загрузка, полная загрузка потребовала бы сложной реконструкции объектов
                console.log("Загружено предыдущее состояние симуляции.");
            } catch (e) {
                console.error("Не удалось загрузить состояние:", e);
            }
        }
    }

    start() {
        this.isRunning = true;
        console.log("Симуляция запущена.");
        setInterval(() => this.saveState(), 10000); // Автосохранение каждые 10 секунд
    }
}

// ===================================================================
// ЗАПУСК
// ===================================================================
window.addEventListener('DOMContentLoaded', () => {
    new BrainSimulation();
});
