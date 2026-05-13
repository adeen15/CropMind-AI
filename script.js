// Service Worker Registration
if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Chart.js Setup
    const ctx = document.getElementById('yieldChart').getContext('2d');
    
    // Gradients for charts
    const gradientOpt = ctx.createLinearGradient(0, 0, 0, 300);
    gradientOpt.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradientOpt.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const gradientDis = ctx.createLinearGradient(0, 0, 0, 300);
    gradientDis.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    gradientDis.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
            datasets: [{
                label: 'Projected Yield (Healthy)',
                data: [65, 68, 75, 82, 85, 90, 95],
                borderColor: '#10b981',
                backgroundColor: gradientOpt,
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }, {
                label: 'Forecast (Current Trajectory)',
                data: [65, 62, 58, 50, 42, 35, 28],
                borderColor: '#ef4444',
                backgroundColor: gradientDis,
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { 
                        color: 'rgba(255,255,255,0.7)', 
                        font: { family: 'Outfit', size: 11 },
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,10,0.9)',
                    titleFont: { family: 'Outfit', size: 13 },
                    bodyFont: { family: 'Outfit', size: 12 },
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Outfit', size: 11 } },
                    beginAtZero: true
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { family: 'Outfit', size: 11 } }
                }
            }
        }
    });

    // Upload & Scan Logic
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const demoBtn = document.getElementById('demoBtn');
    const uploadedImage = document.getElementById('uploadedImage');
    const scanLaser = document.getElementById('scanLaser');
    const resultsPanel = document.getElementById('resultsPanel');
    const initialPrompt = document.getElementById('initialPrompt');
    const scanText = document.getElementById('scanText');
    const scanTextInner = document.getElementById('scanTextInner');
    const imageContainer = document.getElementById('imageContainer');

    // Drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', (e) => {
        if(e.target !== demoBtn && !demoBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    demoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // High-res realistic crop disease image
        uploadedImage.src = 'https://images.unsplash.com/photo-1592079927431-3f8ced0dcee9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';
        startScan(true); // true means simulation
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    uploadedImage.src = e.target.result;
                    startScan(false); // false means real AI if possible
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please upload a valid image file.');
            }
        }
    }

    async function startScan(isSimulation) {
        const apiKey = localStorage.getItem('cropmind_api_key');
        
        // If not simulation and no API key, alert user
        if (!isSimulation && !apiKey) {
            alert('Please configure your Gemini API Key in Settings to run real analysis. Running simulation for now.');
            isSimulation = true;
        }

        // Reset state
        const existingBoxes = imageContainer.querySelectorAll('.bounding-box');
        existingBoxes.forEach(box => box.remove());
        
        initialPrompt.classList.add('hidden');
        imageContainer.classList.remove('hidden');
        scanLaser.style.display = 'block';
        
        // Hide results if they were open
        resultsPanel.classList.add('hidden');
        resultsPanel.classList.remove('flex', 'scale-100', 'opacity-100');
        resultsPanel.classList.add('scale-95', 'opacity-0');
        
        scanText.classList.remove('hidden');
        scanText.classList.add('flex');
        
        const steps = [
            'Initializing vision models...',
            'Extracting morphological features...',
            'Analyzing spectral deviations...',
            'Cross-referencing pathogen database...',
            'Synthesizing remediation strategy...'
        ];
        
        let stepIndex = 0;
        scanTextInner.innerText = steps[0];
        
        const textInterval = setInterval(() => {
            stepIndex++;
            if(stepIndex < steps.length) {
                scanTextInner.innerText = steps[stepIndex];
            } else {
                clearInterval(textInterval);
            }
        }, 800);

        if (isSimulation) {
            // Original Simulation Logic
            setTimeout(() => {
                showResults({
                    name: 'Wheat Leaf Rust (Puccinia triticina)',
                    severity: 'Critical Severity',
                    description: 'Fungal infection detected with high sporulation density. Approximately 42% of the visible leaf area is compromised, critically affecting photosynthesis capability.',
                    confidence: '98.7%',
                    chemical: 'Apply Tebuconazole or Propiconazole based fungicide immediately. Dosage: 250ml per acre mixed with 100L water.',
                    environmental: 'Halt overhead sprinkler irrigation for 48 hours. The current ambient humidity of 82% is accelerating fungal spread.'
                });
            }, 4500);
        } else {
            // Real AI Logic
            try {
                const result = await analyzeImageWithAI(uploadedImage.src, apiKey);
                showResults(result);
            } catch (error) {
                console.error(error);
                alert('AI Analysis failed. Falling back to simulation.');
                startScan(true);
            }
        }

        function showResults(data) {
            clearInterval(textInterval);
            scanLaser.style.display = 'none';
            scanText.classList.add('hidden');
            scanText.classList.remove('flex');
            
            // Update UI with data
            document.getElementById('resDiseaseName').innerText = data.name;
            document.getElementById('resSeverity').innerText = data.severity;
            document.getElementById('resDescription').innerText = data.description;
            document.getElementById('resConfidence').innerText = data.confidence;
            document.getElementById('resChemical').innerText = data.chemical;
            document.getElementById('resEnvironmental').innerText = data.environmental;

            // Show results
            resultsPanel.classList.remove('hidden');
            resultsPanel.classList.add('flex');
            
            // Trigger animation
            setTimeout(() => {
                resultsPanel.classList.remove('scale-95', 'opacity-0');
                resultsPanel.classList.add('scale-100', 'opacity-100');
            }, 50);
            
            addBoundingBox();
        }
    }

    async function analyzeImageWithAI(base64Image, apiKey) {
        const url = "https://openrouter.ai/api/v1/chat/completions";
        
        const prompt = `Analyze this crop image for diseases. Return a JSON object ONLY with these fields: 
        { "name": "Disease Name", "severity": "Severity Level (e.g. Low Risk, Warning, Critical Severity)", "description": "Brief description of the disease and its impact", "confidence": "0-100% string", "chemical": "Detailed chemical treatment recommendation", "environmental": "Detailed environmental/physical recommendation" }
        If healthy, state "Healthy" in name and provide maintenance tips.`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": window.location.href, // Optional, for OpenRouter rankings
                "X-Title": "CropMind AI", // Optional
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-flash-1.5",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": base64Image
                                }
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'OpenRouter API Error');
        }

        const data = await response.json();
        if (data.choices && data.choices[0].message.content) {
            let text = data.choices[0].message.content;
            // Clean up JSON if AI adds markdown backticks
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        } else {
            throw new Error('Invalid OpenRouter response');
        }
    }
    
    
    // Settings Modal Logic
    const openSettings = document.getElementById('openSettings');
    const closeSettings = document.getElementById('closeSettings');
    const settingsModal = document.getElementById('settingsModal');
    const modalContent = document.getElementById('modalContent');
    const saveSettings = document.getElementById('saveSettings');
    const apiKeyInput = document.getElementById('apiKeyInput');

    // Load existing key
    apiKeyInput.value = localStorage.getItem('cropmind_api_key') || '';

    openSettings.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        setTimeout(() => {
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    });

    const hideModal = () => {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => settingsModal.classList.add('hidden'), 300);
    };

    closeSettings.addEventListener('click', hideModal);
    settingsModal.addEventListener('click', (e) => {
        if(e.target === settingsModal) hideModal();
    });

    saveSettings.addEventListener('click', () => {
        localStorage.setItem('cropmind_api_key', apiKeyInput.value);
        saveSettings.innerText = 'Configuration Saved!';
        saveSettings.classList.replace('bg-primary', 'bg-blue-600');
        setTimeout(() => {
            saveSettings.innerText = 'Save Configuration';
            saveSettings.classList.replace('bg-blue-600', 'bg-primary');
            hideModal();
        }, 1500);
    });

    // Chat Assistant Logic
    const chatToggle = document.getElementById('chatToggle');
    const chatWindow = document.getElementById('chatWindow');
    const closeChat = document.getElementById('closeChat');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    let conversationHistory = [
        { role: "system", content: "You are an expert AI Agronomist for CropMind AI. Help farmers with crop diseases, treatment, weather advice, and soil health. Keep responses concise and professional." }
    ];

    chatToggle.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        setTimeout(() => {
            chatWindow.classList.remove('translate-y-10', 'opacity-0');
            chatWindow.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    });

    closeChat.addEventListener('click', () => {
        chatWindow.classList.remove('translate-y-0', 'opacity-100');
        chatWindow.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => chatWindow.classList.add('hidden'), 300);
    });

    const addMessage = (role, content) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `flex items-start gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`;
        
        const icon = role === 'user' ? 'ph ph-user' : 'ph ph-robot';
        const color = role === 'user' ? 'bg-white/10' : 'bg-primary/20';
        const textColor = role === 'user' ? 'text-gray-300' : 'text-primary';
        const borderRadius = role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none';

        msgDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center shrink-0">
                <i class="${icon} ${textColor}"></i>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-2xl ${borderRadius} p-3 text-sm text-gray-200 max-w-[80%]">
                ${content}
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleSendMessage = async () => {
        const text = chatInput.value.trim();
        const apiKey = localStorage.getItem('cropmind_api_key');

        if (!text) return;
        if (!apiKey) {
            alert('Please configure your OpenRouter API Key in Settings to chat with the AI.');
            return;
        }

        // Add user message to UI and history
        addMessage('user', text);
        conversationHistory.push({ role: "user", content: text });
        chatInput.value = '';

        // Typing indicator
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'flex items-start gap-3';
        typingDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <i class="ph ph-robot text-primary"></i>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-3 text-sm text-gray-200">
                <div class="flex gap-1">
                    <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                    <span class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // Check if running on file:// protocol (which blocks most APIs)
            if (window.location.protocol === 'file:') {
                throw new Error("CORS Security: Browsers block AI requests when opening files directly. Please use 'Live Server' in VS Code or deploy the app to Vercel/Netlify.");
            }

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.origin === 'null' ? 'https://cropmind-ai.vercel.app' : window.location.origin,
                    "X-Title": "CropMind AI",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "google/gemini-flash-1.5",
                    "messages": conversationHistory
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `API Error: ${response.status}`);
            }

            const data = await response.json();
            const typingElem = document.getElementById(typingId);
            if(typingElem) typingElem.remove();

            if (data.choices && data.choices[0].message.content) {
                const aiText = data.choices[0].message.content;
                addMessage('assistant', aiText);
                conversationHistory.push({ role: "assistant", content: aiText });
            } else {
                throw new Error("No response from AI model.");
            }
        } catch (error) {
            const typingElem = document.getElementById(typingId);
            if(typingElem) typingElem.remove();
            
            console.error("AI Error:", error.message);
            
            // Show the actual error first so user can fix it
            addMessage('assistant', `<span class="text-red-400 font-bold italic">Connection Blocked: ${error.message}</span>`);

            // Fallback to simulation so they can still demo
            const simulationResponses = [
                "I've analyzed the recent moisture data. It seems Sector B is slightly underwatered. I recommend a 15% increase in irrigation for the next 48 hours.",
                "The current leaf pattern suggests early-stage fungal infection. Please check the 'Marketplace' for recommended Tebuconazole treatments.",
                "Looking at the 7-day forecast, we expect heavy rain. I suggest reinforcing the drainage systems in the lowland fields.",
                "Crop yield is currently projected at 88%. Applying a potassium-rich fertilizer now could boost this to 94% by harvest."
            ];
            const randomResponse = simulationResponses[Math.floor(Math.random() * simulationResponses.length)];
            
            setTimeout(() => {
                addMessage('assistant', `[Demo Mode Active] ${randomResponse}`);
            }, 1500);
        }
    };

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // Language Translation Logic
    const translations = {
        en: {
            nav_diagnostics: "AI Diagnostics",
            nav_forecast: "Yield Forecast",
            nav_weather: "Agro-Weather",
            nav_drone: "Drone Mapping",
            header_title: "Diagnostics Center",
            header_subtitle: "Analyze plant health in real-time with proprietary vision models",
            scanner_title: "AI Pathogen Scanner",
            scanner_subtitle: "Upload a leaf image for instant diagnosis",
            drop_zone_text: "Drag & Drop Leaf Image",
            drop_zone_subtext: "Supports JPG, PNG, WEBP (Max 10MB)",
            demo_or: "or try demo",
            demo_btn: "Run Live Simulation",
            forecast_title: "Financial & Yield Forecast",
            forecast_subtitle: "Impact analysis over 7-week maturity cycle",
            crop_wheat: "Wheat",
            crop_cotton: "Cotton",
            crop_corn: "Corn",
            ai_insight_title: "AI Insight",
            ai_insight_desc: "Based on historical data for this region, early application of fungicides reduces total yield loss by an average of 28% compared to delayed intervention.",
            iot_title: "IoT Field Sensors",
            recent_scans_title: "Recent Scans",
            view_all: "View All",
            chat_welcome: "Hello! I'm your AI Agronomist. How can I help you with your crops today?",
            chat_placeholder: "Ask about treatments, weather..."
        },
        hi: {
            nav_diagnostics: "एआई निदान",
            nav_forecast: "उपज का पूर्वानुमान",
            nav_weather: "कृषि मौसम",
            nav_drone: "ड्रोन मैपिंग",
            header_title: "निदान केंद्र",
            header_subtitle: "मालिकाना दृष्टि मॉडल के साथ वास्तविक समय में पौधों के स्वास्थ्य का विश्लेषण करें",
            scanner_title: "एआई रोगजनक स्कैनर",
            scanner_subtitle: "तत्काल निदान के लिए पत्ती की छवि अपलोड करें",
            drop_zone_text: "पत्ती की छवि खींचें और छोड़ें",
            drop_zone_subtext: "JPG, PNG, WEBP का समर्थन करता है (अधिकतम 10MB)",
            demo_or: "या डेमो आज़माएं",
            demo_btn: "लाइव सिमुलेशन चलाएं",
            forecast_title: "वित्तीय और उपज पूर्वानुमान",
            forecast_subtitle: "7-सप्ताह के परिपक्वता चक्र पर प्रभाव विश्लेषण",
            crop_wheat: "गेहूं",
            crop_cotton: "कपास",
            crop_corn: "मक्का",
            ai_insight_title: "एआई अंतर्दृष्टि",
            ai_insight_desc: "इस क्षेत्र के ऐतिहासिक आंकड़ों के आधार पर, कवकनाशी का शीघ्र प्रयोग विलंबित हस्तक्षेप की तुलना में कुल उपज हानि को औसतन 28% कम कर देता है।",
            iot_title: "IoT फील्ड सेंसर",
            recent_scans_title: "हाल के स्कैन",
            view_all: "सभी देखें",
            chat_welcome: "नमस्ते! मैं आपका एआई कृषि विज्ञानी हूं। आज मैं आपकी फसलों में आपकी कैसे मदद कर सकता हूं?",
            chat_placeholder: "उपचार, मौसम के बारे में पूछें..."
        },
        es: {
            nav_diagnostics: "Diagnóstico AI",
            nav_forecast: "Pronóstico de Rendimiento",
            nav_weather: "Clima Agrícola",
            nav_drone: "Mapeo con Drones",
            header_title: "Centro de Diagnóstico",
            header_subtitle: "Analice la salud de las plantas en tiempo real con modelos de visión patentados",
            scanner_title: "Escáner de Patógenos AI",
            scanner_subtitle: "Sube una imagen de una hoja para un diagnóstico instantáneo",
            drop_zone_text: "Arrastra y suelta la imagen de la hoja",
            drop_zone_subtext: "Soporta JPG, PNG, WEBP (Máx. 10MB)",
            demo_or: "o prueba el demo",
            demo_btn: "Ejecutar simulación en vivo",
            forecast_title: "Pronóstico Financiero y de Rendimiento",
            forecast_subtitle: "Análisis de impacto sobre el ciclo de madurez de 7 semanas",
            crop_wheat: "Trigo",
            crop_cotton: "Algodón",
            crop_corn: "Maíz",
            ai_insight_title: "Información de AI",
            ai_insight_desc: "Basado en datos históricos para esta región, la aplicación temprana de fungicidas reduce la pérdida total de rendimiento en un promedio del 28% en comparación con la intervención tardía.",
            iot_title: "Sensores de campo IoT",
            recent_scans_title: "Escaneos recientes",
            view_all: "Ver todo",
            chat_welcome: "¡Hola! Soy su Agrónomo de AI. ¿Cómo puedo ayudarle con sus cultivos hoy?",
            chat_placeholder: "Pregunte sobre tratamientos, clima..."
        },
        ur: {
            nav_diagnostics: "AI تشخیص",
            nav_forecast: "پیداوار کی پیشن گوئی",
            nav_weather: "زرعی موسم",
            nav_drone: "ڈرون میپنگ",
            header_title: "تشخیصی مرکز",
            header_subtitle: "پروپرائٹری ویژن ماڈلز کے ساتھ ریئل ٹائم میں پودوں کی صحت کا تجزیہ کریں",
            scanner_title: "AI پیتھوجین اسکینر",
            scanner_subtitle: "فوری تشخیص کے لیے پتے کی تصویر اپ لوڈ کریں",
            drop_zone_text: "پتے کی تصویر یہاں ڈریگ کریں",
            drop_zone_subtext: "JPG، PNG، WEBP کو سپورٹ کرتا ہے (زیادہ سے زیادہ 10MB)",
            demo_or: "یا ڈیمو آزمائیں",
            demo_btn: "لائیو سمولیشن چلائیں",
            forecast_title: "مالیاتی اور پیداوار کی پیشن گوئی",
            forecast_subtitle: "7 ہفتوں کے پختگی کے چکر پر اثرات کا تجزیہ",
            crop_wheat: "گندم",
            crop_cotton: "کپاس",
            crop_corn: "مکئی",
            ai_insight_title: "AI بصیرت",
            ai_insight_desc: "اس خطے کے تاریخی ڈیٹا کی بنیاد پر، فنگسائڈز کا جلد استعمال تاخیر سے مداخلت کے مقابلے میں کل پیداوار کے نقصان کو اوسطاً 28 فیصد کم کرتا ہے۔",
            iot_title: "IoT فیلڈ سینسرز",
            recent_scans_title: "حالیہ اسکینز",
            view_all: "سب دیکھیں",
            chat_welcome: "ہیلو! میں آپ کا AI زرعی ماہر ہوں۔ آج میں آپ کی فصلوں میں آپ کی کیا مدد کر سکتا ہوں؟",
            chat_placeholder: "علاج، موسم کے بارے میں پوچھیں..."
        }
    };

    const langSelect = document.getElementById('langSelect');
    
    const updateLanguage = (lang) => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[lang][key]) {
                el.innerText = translations[lang][key];
            }
        });
        
        // Update input placeholders
        document.getElementById('chatInput').placeholder = translations[lang].chat_placeholder;
        
        // Update AI system prompt
        conversationHistory[0].content = `You are an expert AI Agronomist for CropMind AI. Help farmers with crop diseases, treatment, weather advice, and soil health. Respond in ${lang === 'hi' ? 'Hindi' : lang === 'es' ? 'Spanish' : lang === 'ur' ? 'Urdu' : 'English'}. Keep responses concise and professional.`;
    };

    // Weather & IoT Sensor Logic
    const sensorMoisture = document.getElementById('sensorMoisture');
    const sensorTemp = document.getElementById('sensorTemp');
    const sensorHumid = document.getElementById('sensorHumid');

    const fetchRealWeather = async (lat, lon) => {
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`);
            const data = await response.json();
            
            if (data.current) {
                sensorTemp.innerText = `${data.current.temperature_2m.toFixed(1)}°C`;
                sensorHumid.innerText = `${data.current.relative_humidity_2m}%`;
            }
        } catch (error) {
            console.error('Weather fetch failed:', error);
        }
    };

    const updateLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchRealWeather(position.coords.latitude, position.coords.longitude);
                },
                () => {
                    // Fallback to a central coordinate if denied (e.g., London)
                    fetchRealWeather(51.5, -0.1);
                }
            );
        }
    };

    // Live Sensor Fluctuation
    setInterval(() => {
        // Slightly fluctuate moisture (30-35%)
        const m = 30 + Math.random() * 5;
        sensorMoisture.innerText = `${m.toFixed(0)}%`;
        
        // Slightly fluctuate current temperature (+/- 0.2 degrees)
        const currentT = parseFloat(sensorTemp.innerText);
        const newT = currentT + (Math.random() - 0.5) * 0.4;
        sensorTemp.innerText = `${newT.toFixed(1)}°C`;
        
        // Slightly fluctuate humidity
        const currentH = parseInt(sensorHumid.innerText);
        const newH = currentH + (Math.random() > 0.5 ? 1 : -1);
        sensorHumid.innerText = `${Math.max(0, Math.min(100, newH))}%`;
    }, 4000);

    // Marketplace Logic
    const orderTreatmentBtn = document.getElementById('orderTreatmentBtn');
    const marketModal = document.getElementById('marketModal');
    const marketContent = document.getElementById('marketContent');
    const closeMarket = document.getElementById('closeMarket');

    orderTreatmentBtn.addEventListener('click', () => {
        marketModal.classList.remove('hidden');
        setTimeout(() => {
            marketContent.classList.remove('scale-95', 'opacity-0');
            marketContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    });

    const hideMarket = () => {
        marketContent.classList.remove('scale-100', 'opacity-100');
        marketContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => marketModal.classList.add('hidden'), 300);
    };

    closeMarket.addEventListener('click', hideMarket);
    marketModal.addEventListener('click', (e) => {
        if(e.target === marketModal) hideMarket();
    });
});
