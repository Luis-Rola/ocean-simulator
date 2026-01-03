
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

console.log("Main 3D script starting...");

try {
    // ——— Basic Three.js setup ———
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(0, 30, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(renderer.domElement);

    // ——— Procedural Water Normal Map ———
    function createWaterNormals() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(128, 128, 255)';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 20000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 2;
            ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, 255, 0.1)`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    // ——— Sun & Sky ———
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(sun);

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // ——— Water ———
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: createWaterNormals(),
        sunDirection: new THREE.Vector3(),
        sunColor: 0x707070, // Greyish reflection, not bright white
        waterColor: 0x002b36, // Dark Cyan/Blue mix
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotation.x = -Math.PI / 2;
    // Rotate 0 deg to flow Towards Camera (Logic: Opposite of PI/Away)
    water.rotation.z = 0;
    scene.add(water);

    // ——— Updates ———
    const breeze = document.getElementById('breeze');
    function updateSun() {
        if (!breeze) return;
        const theta = THREE.MathUtils.degToRad(parseFloat(breeze.value));

        // FIXED SUN POSITION (No moving glare)
        // Positioned highish and behind the camera or side to avoid direct blinding reflection
        sun.position.set(-10, 50, -100);
        sky.material.uniforms['sunPosition'].value.copy(sun.position);

        if (water && water.material) {
            water.material.uniforms['sunDirection'].value.copy(sun.position).normalize();
            // User controls ONLY water rotation now
            water.rotation.z = -theta;
        }
    }
    if (breeze) breeze.oninput = updateSun;
    updateSun();

    // ——— Storm & Rain ———
    let stormMode = false;
    const stormBtn = document.getElementById('storm');
    if (stormBtn) {
        stormBtn.onclick = () => {
            stormMode = !stormMode;
            console.log("Storm Mode:", stormMode);
            if (stormMode) {
                // PITCH BLACK STORM
                skyUniforms['turbidity'].value = 10; // High turbidity to blur any sun artifacts
                skyUniforms['rayleigh'].value = 0;   // Dark sky
                skyUniforms['mieCoefficient'].value = 0.1;
                sun.intensity = 0.0; // No sun light
                water.material.uniforms['sunColor'].value.setHex(0x000000); // No reflection

                // HIDE SUN DISC
                sky.material.uniforms['sunPosition'].value.set(0, -1000, 0);
            } else {
                // North Atlantic Grey Day
                skyUniforms['turbidity'].value = 5;
                skyUniforms['rayleigh'].value = 0.5;
                skyUniforms['mieCoefficient'].value = 0.005;
                sun.intensity = 0.5;
                water.material.uniforms['sunColor'].value.setHex(0x707070);

                // RESTORE SUN
                updateSun();
            }
        };
    }

    const rainCount = 10000;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = [];
    for (let i = 0; i < rainCount; i++) {
        rainPos.push((Math.random() - 0.5) * 2000, Math.random() * 800 + 50, (Math.random() - 0.5) * 2000);
    }
    rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
    const rainMaterial = new THREE.PointsMaterial({ color: 0xdddddd, size: 0.8, transparent: true, opacity: 0.8 });
    const rainParticles = new THREE.Points(rainGeo, rainMaterial);
    rainParticles.visible = false;
    scene.add(rainParticles);

    const flash = new THREE.PointLight(0xffffff, 0, 0, 1.7);
    flash.position.set(0, 300, 0);
    scene.add(flash);

    // ——— Animation ———
    const wind = document.getElementById('wind');
    const waveHeight = document.getElementById('waveHeight');

    console.log("ATMOSPHERE FIXED MODE ACTIVE");

    // Set initial Atlantic Atmosphere
    skyUniforms['rayleigh'].value = 0.5; // Deep blue/black sky base
    skyUniforms['turbidity'].value = 5;

    function animate() {
        requestAnimationFrame(animate);
        if (water && water.material) {
            // Speed: Normal = 1/60, Storm = 1/20 (very fast)
            const delta = stormMode ? (1.0 / 20.0) : (1.0 / 60.0);
            water.material.uniforms['time'].value += delta;

            if (wind) {
                const baseWind = parseFloat(wind.value); // 0 to 12
                // Normal: 2.0 (Gentle/Choppy). Storm: 10.0 (Fast/Violent).
                water.material.uniforms['size'].value = Math.max(0.1, stormMode ? baseWind * 10.0 : baseWind * 2.0);
            }
            if (waveHeight) {
                const baseWave = parseFloat(waveHeight.value); // 0.0 to 6.0
                // Normal: 3.0 (Rolling). Storm: 20.0 (Huge).
                let targetScale = baseWave * 3.0;
                if (stormMode) {
                    targetScale = baseWave * 20.0;
                }
                water.material.uniforms['distortionScale'].value = targetScale;
            }
        }
        if (stormMode) {
            rainParticles.visible = true;
            rainParticles.rotation.y -= 0.002;
            const positions = rainParticles.geometry.attributes.position.array;
            let needsUpdate = false;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] += 5; // INVERTED GRAVITY (User says previous was up, so trying down/up flip)
                positions[i - 1] -= 1; // Wind blowing X
                positions[i + 1] -= 1; // Wind blowing Z

                // Reset if above 1000 (since we are going UP)
                if (positions[i] > 1000) {
                    positions[i] = Math.random() * 200;
                    // Reset X/Z too to keep them in bounds roughly
                    positions[i - 1] = (Math.random() - 0.5) * 2000;
                    positions[i + 1] = (Math.random() - 0.5) * 2000;
                    needsUpdate = true;
                }
            }
            if (needsUpdate) rainParticles.geometry.attributes.position.needsUpdate = true;
            if (Math.random() < 0.005) {
                flash.intensity = 100 + Math.random() * 200;
                flash.position.set((Math.random() - 0.5) * 1000, 300, (Math.random() - 0.5) * 1000);
            }
        } else {
            rainParticles.visible = false;
        }
        flash.intensity *= 0.85;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

} catch (e) {
    console.error("CRITICAL 3D ERROR:", e);
    // Error will be caught by window.onerror in index.html too
    throw e;
}
