import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Get the website's 3D display area
const container = document.getElementById('scene-container');

// 2. Create the 3D scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bbdce);
scene.fog = new THREE.Fog(0x9bbdce, 25, 90);

// 3. Create the camera
const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    200
);

camera.position.set(12, 10, 18);

// 4. Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

container.appendChild(renderer.domElement);

// 5. Add camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 5;
controls.maxDistance = 45;
controls.target.set(0, 1, 0);

// 6. Add lighting
const ambientLight = new THREE.HemisphereLight(
    0xcce5ff,
    0x52613a,
    2
);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(0xffe3b0, 3);
sunlight.position.set(15, 25, 10);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -25;
sunlight.shadow.camera.right = 25;
sunlight.shadow.camera.top = 25;
sunlight.shadow.camera.bottom = -25;
scene.add(sunlight);

// 7. Create the forest ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x496b39,
    roughness: 1
});

const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 8. Create a tree
function createTree(x, z, scale = 1) {
    const tree = new THREE.Group();

    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.25, 2, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x76502e,
        roughness: 1
    });

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);

    // Tree leaves
    const leafMaterial = new THREE.MeshStandardMaterial({
        color: 0x245c32,
        roughness: 1
    });

    const layers = [
        { radius: 1.3, height: 2.2, y: 2.5 },
        { radius: 1.05, height: 2, y: 3.5 },
        { radius: 0.75, height: 1.7, y: 4.4 }
    ];

    layers.forEach(layer => {
        const geometry = new THREE.ConeGeometry(
            layer.radius,
            layer.height,
            8
        );

        const leaves = new THREE.Mesh(geometry, leafMaterial);
        leaves.position.y = layer.y;
        leaves.castShadow = true;
        tree.add(leaves);
    });

    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);

    scene.add(tree);
    return tree;
}

// 9. Create several trees
const trees = [];

const treePositions = [
    [-5, -4], [-8, 2], [-3, 5],
    [5, -5], [8, 1], [3, 6],
    [-10, -8], [10, -9], [0, -9],
    [-12, 5], [12, 6]
];

treePositions.forEach(([x, z]) => {
    trees.push(createTree(x, z, 0.8 + Math.random() * 0.5));
});

// 10. Create mountains
function createMountain(x, z, size) {
    const geometry = new THREE.ConeGeometry(size, size * 1.8, 4);

    const material = new THREE.MeshStandardMaterial({
        color: 0x687b72,
        flatShading: true,
        roughness: 1
    });

    const mountain = new THREE.Mesh(geometry, material);
    mountain.position.set(x, size * 0.85, z);
    mountain.rotation.y = Math.PI / 4;
    mountain.castShadow = true;

    scene.add(mountain);
}

createMountain(-22, -25, 12);
createMountain(-5, -30, 16);
createMountain(17, -27, 13);

// 11. Create the sky atmosphere
scene.background = new THREE.Color(0x9bbdce);

// 12. Handle browser resizing
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
});

// 13. TEXT COMMAND SYSTEM

const commandInput = document.getElementById('command-input');
const generateButton = document.getElementById('generate-btn');
const statusMessage = document.getElementById('status');

const DEFAULT_ENV = {
    sky: 0x9bbdce, fog: 0x9bbdce,
    ambientColor: 0xcce5ff, ambientIntensity: 2,
    sunColor: 0xffe3b0, sunIntensity: 3,
    ground: 0x496b39
};

// Objects created by the AI (so they can be removed, saved and restored)
const customObjects = [];

function setEnvironment(env) {
    if (env.sky !== undefined) scene.background.set(env.sky);
    if (env.fog !== undefined) scene.fog.color.set(env.fog);
    else if (env.sky !== undefined) scene.fog.color.set(env.sky);
    if (env.ambientColor !== undefined) ambientLight.color.set(env.ambientColor);
    if (env.ambientIntensity !== undefined) ambientLight.intensity = env.ambientIntensity;
    if (env.sunColor !== undefined) sunlight.color.set(env.sunColor);
    if (env.sunIntensity !== undefined) sunlight.intensity = env.sunIntensity;
    if (env.ground !== undefined) groundMaterial.color.set(env.ground);
}

function disposeObject(obj) {
    scene.remove(obj);
    obj.traverse(child => {
        if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
        }
    });
}

function clearCustomObjects() {
    customObjects.forEach(disposeObject);
    customObjects.length = 0;
}

// ---- Turn AI scene JSON into real 3D objects (all values are validated) ----

const num = (v, fallback, min = -200, max = 200) =>
    Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
const vec = (arr, n, fallback) =>
    Array.from({ length: n }, (_, i) => num(arr?.[i], fallback[i]));
const validColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#cccccc');

function buildGeometry(shape, size = []) {
    const s = i => num(size[i], 1, 0.01, 60);
    switch (shape) {
        case 'box': return new THREE.BoxGeometry(s(0), s(1), s(2));
        case 'sphere': return new THREE.SphereGeometry(s(0), 24, 16);
        case 'cylinder': return new THREE.CylinderGeometry(num(size[0], 1, 0, 60), num(size[1], 1, 0, 60), s(2), 24);
        case 'cone': return new THREE.ConeGeometry(s(0), s(1), 24);
        case 'torus': return new THREE.TorusGeometry(s(0), Math.min(s(1), s(0)), 12, 32);
        default: return null;
    }
}

function buildCustomObject(spec) {
    const group = new THREE.Group();
    group.userData.spec = spec;
    group.userData.name = String(spec.name || 'object').slice(0, 40).toLowerCase();

    (Array.isArray(spec.parts) ? spec.parts : []).slice(0, 40).forEach(part => {
        const geometry = buildGeometry(part.shape, part.size);
        if (!geometry) return;

        const color = validColor(part.color);
        const material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.85,
            flatShading: part.shape === 'cone',
            emissive: part.emissive ? color : 0x000000,
            emissiveIntensity: part.emissive ? 1.2 : 0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...vec(part.position, 3, [0, 0, 0]));
        mesh.rotation.set(...vec(part.rotation, 3, [0, 0, 0]));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    });

    if (group.children.length === 0) return null;

    const [x, z] = vec(spec.position, 2, [0, 0]);
    group.position.set(x, 0, z);
    group.rotation.y = num(spec.rotationY, 0, -20, 20);
    group.scale.setScalar(num(spec.scale, 1, 0.1, 10));
    scene.add(group);
    return group;
}

function applySceneSpec(spec) {
    if (spec.clearObjects) clearCustomObjects();

    if (Array.isArray(spec.removeNames)) {
        spec.removeNames.forEach(name => {
            const n = String(name).toLowerCase();
            for (let i = customObjects.length - 1; i >= 0; i--) {
                if (customObjects[i].userData.name === n) {
                    disposeObject(customObjects[i]);
                    customObjects.splice(i, 1);
                }
            }
        });
    }

    const env = spec.environment;
    if (env && typeof env === 'object') {
        const hex = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
        setEnvironment({
            sky: hex(env.sky),
            fog: hex(env.fog),
            ambientColor: hex(env.ambientColor),
            ambientIntensity: env.ambientIntensity === undefined ? undefined : num(env.ambientIntensity, 2, 0, 5),
            sunColor: hex(env.sunColor),
            sunIntensity: env.sunIntensity === undefined ? undefined : num(env.sunIntensity, 3, 0, 6),
            ground: hex(env.ground)
        });
        if (typeof env.rain === 'boolean') {
            if (env.rain && !rain) createRain();
            if (!env.rain) removeRain();
        }
    }

    let added = 0;
    (Array.isArray(spec.objects) ? spec.objects : []).slice(0, 12).forEach(objSpec => {
        const obj = buildCustomObject(objSpec);
        if (obj) {
            customObjects.push(obj);
            added++;
        }
    });
    return added;
}

async function askAI(prompt) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            existing: customObjects.map(o => o.userData.name)
        })
    });

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Server returned an unreadable answer.');
    }
    if (!response.ok) throw new Error(data.error || 'AI request failed.');
    return data;
}

// ---- Fast built-in commands (instant, no AI needed) ----
// Returns true if the command was handled locally.

function runLocalCommand(command) {
    const done = message => {
        statusMessage.textContent = message;
        commandInput.value = '';
        return true;
    };

    const addMatch = command.match(/^add\s+(\d+)\s+trees?$/);
    if (addMatch) {
        const quantity = Math.min(Number(addMatch[1]), 50);
        for (let i = 0; i < quantity; i++) {
            trees.push(createTree(
                (Math.random() - 0.5) * 28,
                (Math.random() - 0.5) * 28,
                0.8 + Math.random() * 0.5
            ));
        }
        return done(`${quantity} trees added successfully!`);
    }

    if (/^remove\s+all\s+trees$/.test(command)) {
        trees.forEach(tree => scene.remove(tree));
        trees.length = 0;
        return done('All trees removed!');
    }

    const removeMatch = command.match(/^remove\s+(\d+)\s+trees?$/);
    if (removeMatch) {
        const actual = Math.min(Number(removeMatch[1]), 50, trees.length);
        for (let i = 0; i < actual; i++) scene.remove(trees.pop());
        return done(`${actual} trees removed!`);
    }

    if (/^(stop|no|remove)\s+(the\s+)?rain(ing)?$/.test(command)) {
        removeRain();
        return done('Rain stopped!');
    }

    if (/^(make it |start |turn on )?(the )?rain(y|ing)?$/.test(command)) {
        if (!rain) createRain();
        return done('Rain started!');
    }

    if (/^(make it |change to |turn to )?(the )?night(time)?$/.test(command)) {
        setEnvironment({
            sky: 0x081426, ambientColor: 0x526b91, ambientIntensity: 0.5,
            sunColor: 0x8ca3c7, sunIntensity: 0.3
        });
        return done('Nighttime activated!');
    }

    if (/^(make it |change to |turn to )?(the )?(day|daytime)$/.test(command)) {
        setEnvironment(DEFAULT_ENV);
        return done('Daytime activated!');
    }

    if (/^(make it |change to |turn to )?(the )?sunset$/.test(command)) {
        setEnvironment({
            sky: 0xf29b72, ambientColor: 0xffb080, ambientIntensity: 1.2,
            sunColor: 0xff7040, sunIntensity: 2
        });
        return done('Sunset activated!');
    }

    if (command === 'save world') {
        const worldData = {
            trees: trees.map(tree => ({
                x: tree.position.x, z: tree.position.z, scale: tree.scale.x
            })),
            customObjects: customObjects.map(o => o.userData.spec),
            background: scene.background.getHex(),
            fog: scene.fog.color.getHex(),
            ground: groundMaterial.color.getHex(),
            ambientColor: ambientLight.color.getHex(),
            ambientIntensity: ambientLight.intensity,
            sunlightColor: sunlight.color.getHex(),
            sunlightIntensity: sunlight.intensity,
            rainActive: Boolean(rain),
            cameraPosition: camera.position.toArray(),
            cameraTarget: controls.target.toArray()
        };
        localStorage.setItem('textTo3DWorld', JSON.stringify(worldData));
        return done('World saved successfully!');
    }

    if (command === 'restore world') {
        const savedWorld = localStorage.getItem('textTo3DWorld');
        if (!savedWorld) {
            statusMessage.textContent = 'No saved world found!';
            return true;
        }
        const worldData = JSON.parse(savedWorld);

        trees.forEach(tree => scene.remove(tree));
        trees.length = 0;
        worldData.trees.forEach(t => trees.push(createTree(t.x, t.z, t.scale)));

        clearCustomObjects();
        (worldData.customObjects || []).forEach(spec => {
            const obj = buildCustomObject(spec);
            if (obj) customObjects.push(obj);
        });

        setEnvironment({
            sky: worldData.background,
            fog: worldData.fog,
            ground: worldData.ground ?? DEFAULT_ENV.ground,
            ambientColor: worldData.ambientColor,
            ambientIntensity: worldData.ambientIntensity,
            sunColor: worldData.sunlightColor,
            sunIntensity: worldData.sunlightIntensity
        });

        if (worldData.rainActive) {
            if (!rain) createRain();
        } else {
            removeRain();
        }

        camera.position.fromArray(worldData.cameraPosition);
        controls.target.fromArray(worldData.cameraTarget);
        controls.update();
        return done('Your saved world has been restored!');
    }

    if (command === 'reset world') {
        removeRain();
        clearCustomObjects();
        trees.forEach(tree => scene.remove(tree));
        trees.length = 0;
        treePositions.forEach(([x, z]) => {
            trees.push(createTree(x, z, 0.8 + Math.random() * 0.5));
        });
        setEnvironment(DEFAULT_ENV);
        camera.position.set(12, 10, 18);
        controls.target.set(0, 1, 0);
        controls.update();
        return done('World reset successfully!');
    }

    if (command === 'zoom in' || command === 'zoom out') {
        const zoomIn = command === 'zoom in';
        const direction = camera.position.clone().sub(controls.target);
        const distance = zoomIn
            ? Math.max(controls.minDistance, direction.length() * 0.75)
            : Math.min(controls.maxDistance, direction.length() * 1.3);
        direction.setLength(distance);
        camera.position.copy(controls.target).add(direction);
        controls.update();
        return done(zoomIn ? 'Camera zoomed in!' : 'Camera zoomed out!');
    }

    return false;
}

let busy = false;

async function generateCommand() {
    const original = commandInput.value.trim();
    const command = original.toLowerCase();

    if (command === '') {
        statusMessage.textContent = 'Please enter a command.';
        return;
    }
    if (busy) return;

    if (runLocalCommand(command)) return;

    // Anything else -> ask the AI
    busy = true;
    generateButton.disabled = true;
    statusMessage.textContent = 'Thinking... building your world with AI.';

    try {
        const spec = await askAI(original);
        const added = applySceneSpec(spec);
        statusMessage.textContent =
            (typeof spec.message === 'string' && spec.message.slice(0, 200)) ||
            (added ? `Added ${added} object(s)!` : 'Done!');
        commandInput.value = '';
    } catch (err) {
        statusMessage.textContent = `Sorry, that didn't work: ${err.message}`;
    } finally {
        busy = false;
        generateButton.disabled = false;
    }
}


// Generate button
generateButton.addEventListener('click', generateCommand);

// Press Enter to generate
commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        generateCommand();
    }
});

// Example command buttons
document.querySelectorAll('.example-btn').forEach(button => {
    button.addEventListener('click', () => {
        commandInput.value = button.textContent;
        generateCommand();
    });
});
// RAIN EFFECT

let rain = null;

function createRain() {
    const rainCount = 1500;
    const positions = [];

    for (let i = 0; i < rainCount; i++) {
        positions.push(
            (Math.random() - 0.5) * 40,
            Math.random() * 25,
            (Math.random() - 0.5) * 40
        );
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );

    const material = new THREE.PointsMaterial({
        color: 0xcceeff,
        size: 0.08
    });

    rain = new THREE.Points(geometry, material);
    scene.add(rain);
}

function removeRain() {
    if (rain) {
        scene.remove(rain);
        rain.geometry.dispose();
        rain.material.dispose();
        rain = null;
    }
}

function animateRain() {
    if (!rain) return;

    const positions = rain.geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.25;

        if (positions[i + 1] < 0) {
            positions[i + 1] = 25;
        }
    }

    rain.geometry.attributes.position.needsUpdate = true;
}
// 13. Animation loop
function animate() {
    requestAnimationFrame(animate);

    controls.update();
    animateRain();

    renderer.render(scene, camera);
}

animate();

console.log('3D Forest loaded successfully!');
