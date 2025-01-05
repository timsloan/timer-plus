function timerApp() {
    return {
        currentTime: 0,
        isRunning: false,
        timerInterval: null,
        phase: 'ready', // ready, work, rest, warmup, cooldown
        currentRound: 1,
        progress: 0,
        soundEnabled: true,
        settings: {
            workTime: 20,
            restTime: 10,
            rounds: 8,
            warmupTime: 0,
            cooldownTime: 0
        },
        customPresets: {},
        newPresetName: '',

        init() {
            // Load custom presets from localStorage
            this.loadCustomPresets();
            // Load sound preference from localStorage
            const savedSound = localStorage.getItem('hiitSoundEnabled');
            if (savedSound !== null) {
                this.soundEnabled = JSON.parse(savedSound);
            }
            // Initialize timer display
            this.resetTimer();
            
            // Add keyboard shortcuts
            window.addEventListener('keydown', (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    this.toggleTimer();
                } else if (e.code === 'KeyR') {
                    this.resetTimer();
                } else if (e.code === 'KeyM') {
                    this.toggleSound();
                }
            });

            // Watch for settings changes
            this.$watch('settings', (value) => {
                if (!this.isRunning) {
                    if (value.warmupTime > 0) {
                        this.phase = 'warmup';
                        this.currentTime = value.warmupTime;
                    } else {
                        this.phase = 'work';
                        this.currentTime = value.workTime;
                    }
                    this.updateProgress();
                }
            }, { deep: true });
        },

        toggleTimer() {
            this.playSound('startSound');
            if (this.isRunning) {
                this.pauseTimer();
            } else {
                this.startTimer();
            }
        },

        startTimer() {
            if (!this.isRunning) {
                this.isRunning = true;
                this.timerInterval = setInterval(() => this.tick(), 1000);
            }
        },

        pauseTimer() {
            this.isRunning = false;
            clearInterval(this.timerInterval);
        },

        resetTimer() {
            this.pauseTimer();
            this.currentTime = this.settings.warmupTime > 0 ? this.settings.warmupTime : this.settings.workTime;
            this.phase = this.settings.warmupTime > 0 ? 'warmup' : 'work';
            this.currentRound = 1;
            this.updateProgress();
        },

        tick() {
            if (this.currentTime > 0) {
                this.currentTime--;
                // Play countdown beep in last 5 seconds of each phase
                if (this.currentTime <= 5 && this.currentTime > 0) {
                    this.playSound('startSound');
                }
                this.updateProgress();
            } else {
                this.transitionPhase();
            }
        },

        transitionPhase() {
            if (this.phase === 'warmup') {
                this.playSound('endSound'); // Play end sound at end of warm-up
                this.phase = 'work';
                this.currentTime = this.settings.workTime;
                this.playSound('startSound');
            } else if (this.phase === 'work') {
                this.playSound('endSound'); // Play end sound at end of work
                if (this.currentRound < this.settings.rounds) {
                    if (this.settings.restTime > 0) {
                        this.phase = 'rest';
                        this.currentTime = this.settings.restTime;
                    } else {
                        // Skip rest phase if rest time is 0
                        this.currentRound++;
                        this.phase = 'work';
                        this.currentTime = this.settings.workTime;
                        this.playSound('startSound');
                    }
                } else if (this.settings.cooldownTime > 0) {
                    this.phase = 'cooldown';
                    this.currentTime = this.settings.cooldownTime;
                } else {
                    this.completeWorkout();
                }
            } else if (this.phase === 'rest') {
                this.playSound('endSound'); // Play end sound at end of rest
                this.currentRound++;
                this.phase = 'work';
                this.currentTime = this.settings.workTime;
                this.playSound('startSound');
            } else if (this.phase === 'cooldown') {
                this.completeWorkout();
            }
            this.updateProgress();
        },

        completeWorkout() {
            this.pauseTimer();
            this.phase = 'ready';
            this.playSound('endSound');
            
            // Start celebration animation
            const container = document.getElementById('celebrationContainer');
            container.style.display = 'block';
            container.innerHTML = ''; // Clear any existing celebrations
            
            // Create 10 tada emojis with staggered animations
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const tada = document.createElement('div');
                    tada.className = 'tada';
                    tada.textContent = '🎉';
                    tada.style.left = Math.random() * 90 + 5 + '%'; // Random horizontal position (5-95%)
                    tada.style.setProperty('--fall-distance', (Math.random() * 30 + 35) + 'vh'); // Random middle point
                    container.appendChild(tada);
                    
                    // Remove the element after animation
                    tada.addEventListener('animationend', () => {
                        tada.remove();
                        // Hide container when last tada is removed
                        if (i === 9) {
                            setTimeout(() => {
                                container.style.display = 'none';
                            }, 500);
                        }
                    });
                }, i * 300); // Stagger each tada by 300ms
            }

            // Use native notification if available
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("Workout Complete!", {
                    body: "Great job! You've completed your workout.",
                    icon: "/favicon.ico"
                });
            }
            
            this.resetTimer();
        },

        updateProgress() {
            const totalDuration = this.calculateTotalDuration();
            if (!this.isRunning && this.phase === 'ready') {
                this.progress = 0;
                return;
            }
            const remainingDuration = this.calculateRemainingDuration();
            this.progress = ((totalDuration - remainingDuration) / totalDuration) * 100;
        },

        calculateTotalDuration() {
            return (
                this.settings.warmupTime +
                (this.settings.workTime + this.settings.restTime) * this.settings.rounds -
                this.settings.restTime + // Subtract last rest period
                this.settings.cooldownTime
            );
        },

        calculateRemainingDuration() {
            let remaining = this.currentTime;
            
            if (this.phase === 'work' || this.phase === 'rest') {
                remaining += (this.settings.rounds - this.currentRound) * (this.settings.workTime + this.settings.restTime);
                if (this.phase === 'work') {
                    remaining += this.settings.restTime;
                }
                if (this.settings.cooldownTime > 0) {
                    remaining += this.settings.cooldownTime;
                }
            } else if (this.phase === 'warmup') {
                remaining += this.calculateTotalDuration() - this.settings.warmupTime;
            } else if (this.phase === 'cooldown') {
                remaining = this.currentTime;
            }

            return remaining;
        },

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        },

        toggleSound() {
            this.soundEnabled = !this.soundEnabled;
            localStorage.setItem('hiitSoundEnabled', JSON.stringify(this.soundEnabled));
        },

        playSound(soundId) {
            if (this.soundEnabled) {
                const sound = document.getElementById(soundId);
                if (sound) {
                    sound.currentTime = 0;
                    try {
                        sound.play().catch(error => {
                            console.log('Error playing sound:', error);
                        });
                    } catch (error) {
                        console.log('Error playing sound:', error);
                    }
                }
            }
        },

        loadPreset(type) {
            switch(type) {
                case 'pomodoro':
                    this.settings = {
                        workTime: 1500, // 25 minutes
                        restTime: 300,  // 5 minutes
                        rounds: 1,
                        warmupTime: 0,
                        cooldownTime: 0
                    };
                    break;
                case '30':
                    this.settings = {
                        workTime: 30,
                        restTime: 0,
                        rounds: 10,
                        warmupTime: 30,
                        cooldownTime: 0
                    };
                    break;
                case 'tabata':
                    this.settings = {
                        workTime: 20,
                        restTime: 10,
                        rounds: 8,
                        warmupTime: 0,
                        cooldownTime: 0
                    };
                    break;
                case '30-30':
                    this.settings = {
                        workTime: 30,
                        restTime: 30,
                        rounds: 10,
                        warmupTime: 0,
                        cooldownTime: 0
                    };
                    break;
                case '40-20':
                    this.settings = {
                        workTime: 40,
                        restTime: 20,
                        rounds: 8,
                        warmupTime: 0,
                        cooldownTime: 0
                    };
                    break;
                case '45-15':
                    this.settings = {
                        workTime: 45,
                        restTime: 15,
                        rounds: 8,
                        warmupTime: 0,
                        cooldownTime: 0
                    };
                    break;
            }
            this.resetTimer();
        },

        saveCustomPreset() {
            if (!this.newPresetName.trim()) {
                alert('Please enter a preset name');
                return;
            }
            // Check if preset name already exists
            if (this.customPresets[this.newPresetName]) {
                if (!confirm('A preset with this name already exists. Do you want to overwrite it?')) {
                    return;
                }
            }
            this.customPresets[this.newPresetName] = { ...this.settings };
            localStorage.setItem('hiitCustomPresets', JSON.stringify(this.customPresets));
            this.newPresetName = '';
        },

        loadCustomPresets() {
            const saved = localStorage.getItem('hiitCustomPresets');
            this.customPresets = saved ? JSON.parse(saved) : {};
        },

        loadCustomPreset(name) {
            if (this.customPresets[name]) {
                this.settings = { ...this.customPresets[name] };
                this.resetTimer();
            }
        },

        deleteCustomPreset(name) {
            if (confirm(`Delete preset "${name}"?`)) {
                delete this.customPresets[name];
                localStorage.setItem('hiitCustomPresets', JSON.stringify(this.customPresets));
            }
        }
    };
}
