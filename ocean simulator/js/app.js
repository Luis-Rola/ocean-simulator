import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

console.log("Main 3D script starting (v18.3 corrected)...");

try {
    // ——— Basic Three.js setup ———
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);
    camera.position.set(0, 100, 300); // Higher camera to see the swells

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
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const w = Math.random() * 60 + 20;
            const h = Math.random() * 2 + 0.5;
            const r = 124 + Math.random() * 8;
            const g = 124 + Math.random() * 8;
            ctx.fillStyle = `rgba(${r}, ${g}, 255, 0.4)`;
            ctx.beginPath();
            ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.ellipse(x - size, y, w, h, 0, 0, Math.PI * 2);
            ctx.ellipse(x + size, y, w, h, 0, 0, Math.PI * 2);
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

    // ——— Water (High Resolution Plane for Displacement) ———
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000, 128, 128);
    const water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: createWaterNormals(),
        sunDirection: new THREE.Vector3(),
        sunColor: 0x707070,
        waterColor: 0x002b36,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotation.x = -Math.PI / 2;

    // Physical Vertex Displacement (Simplified)
    water.material.onBeforeCompile = (shader) => {
        water.material.userData.shader = shader;
        shader.uniforms.waveWeight = { value: 0.0 };

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\nuniform float waveWeight;`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float v_time = time * 0.5;
            float v_wave = sin(position.x * 0.005 + v_time) * cos(position.y * 0.005 + v_time);
            v_wave += sin(position.x * 0.002 - v_time * 0.8) * 0.5;
            v_wave += sin(position.y * 0.001 + v_time * 0.3) * 0.3;
            transformed.z += v_wave * waveWeight * 5.0; 
            `
        );
    };
    scene.add(water);

    // ——— Controls ———
    const wind = document.getElementById('wind');
    const waveHeight = document.getElementById('waveHeight');
    const breeze = document.getElementById('breeze');
    const currentDirection = document.getElementById('currentDirection');
    const stormBtn = document.getElementById('storm');

    function updateSun() {
        if (!breeze) return;
        const theta = THREE.MathUtils.degToRad(parseFloat(breeze.value));
        const phi = THREE.MathUtils.degToRad(90 - 30);
        const radius = 400;
        sun.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
        sky.material.uniforms['sunPosition'].value.copy(sun.position);
        if (water && water.material) {
            water.material.uniforms['sunDirection'].value.copy(sun.position).normalize();
        }
    }

    function updateCurrentDirection() {
        if (!currentDirection || !water) return;
        const currentTheta = THREE.MathUtils.degToRad(parseFloat(currentDirection.value));
        water.rotation.z = -currentTheta;
    }

    if (breeze) breeze.oninput = updateSun;
    if (currentDirection) currentDirection.oninput = updateCurrentDirection;

    updateSun();
    updateCurrentDirection();

    // ——— Storm & Rain ———
    let stormMode = false;
    if (stormBtn) {
        stormBtn.onclick = () => {
            stormMode = !stormMode;
            if (stormMode) {
                skyUniforms['turbidity'].value = 20;
                skyUniforms['rayleigh'].value = 0.05;
                skyUniforms['mieCoefficient'].value = 0.1;
                sun.intensity = 0.2;
                water.material.uniforms['sunColor'].value.setHex(0x202020);
                water.material.uniforms['waterColor'].value.setHex(0x000508); // Almost black water in storm
            } else {
                skyUniforms['turbidity'].value = 5;
                skyUniforms['rayleigh'].value = 0.5;
                skyUniforms['mieCoefficient'].value = 0.005;
                sun.intensity = 0.5;
                water.material.uniforms['sunColor'].value.setHex(0x707070);
                water.material.uniforms['waterColor'].value.setHex(0x002b36); // Deep cyan back to normal
            }
            updateSun();
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

    // ——— Animation Loop ———
    let frameCounter = 0;
    function animate() {
        frameCounter++;
        requestAnimationFrame(animate);

        if (water && water.material) {
            const delta = stormMode ? (1.0 / 20.0) : (1.0 / 60.0);
            water.material.uniforms['time'].value += delta;

            if (wind) {
                const baseWind = parseFloat(wind.value);
                water.material.uniforms['size'].value = Math.max(0.5, baseWind * 0.5);
            }

            if (waveHeight) {
                const baseWave = parseFloat(waveHeight.value);
                water.material.uniforms['distortionScale'].value = baseWave * 5.0;

                // Update vertex displacement uniform
                if (water.material.userData.shader && water.material.userData.shader.uniforms.waveWeight) {
                    water.material.userData.shader.uniforms.waveWeight.value = baseWave * 1.5;
                }

                if (frameCounter % 60 === 0) {
                    console.log("%c WAVE SCALE:", "color: #00ff00; font-weight: bold;", "Height:", baseWave);
                }
            }
        }

        if (stormMode) {
            rainParticles.visible = true;
            rainParticles.rotation.y -= 0.002;
            const positions = rainParticles.geometry.attributes.position.array;
            let needsUpdate = false;
            for (let i = 1; i < positions.length; i += 3) {
                positions[i] += 5;
                if (positions[i] > 1000) {
                    positions[i] = Math.random() * 200;
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
    throw e;
}
