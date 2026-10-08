let scene, camera, renderer, clock;
let player, horse, soldier, sword;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isPaused = false, isGameOver = false;

let playerDamage = 0;
let killCount = 0;
let lives = 3; // ═══ NUEVO: Sistema de vidas
let isSoldierVisible = true;
let isStriking = false;
let strikeTimer = 0;

let enemyPool = [];
let airdropPool = [];
let totalRunTime = 0;
let enemySpawnCounter = 0;
let isAirdropTriggered = false;
let autoResumeTimeout = null;
let dustParticles;

// ============ INICIALIZACIÓN ============
function initGameEngine() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdfaf6e, 0.008);   
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
// No hacer scene.add(camera) ni player.add(camera)   

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xc29b63, 0.6);
    scene.add(hemiLight);
    const ambientLight = new THREE.AmbientLight(0xfff3db, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.0);
    sunLight.position.set(120, 180, 90);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    buildEnvironment();
    assembleMountedPlayer();
    buildSkyDome();
    buildDustParticles();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('click', executeSwordStrike);
    window.addEventListener('resize', onWindowResize);

    refreshHUD();
}

// ============ CIELO ============
function buildSkyDome() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x4a90d9) },
            midColor: { value: new THREE.Color(0xdfaf6e) },
            bottomColor: { value: new THREE.Color(0xc29b63) }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 midColor;
            uniform vec3 bottomColor;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition).y;
                vec3 color;
                if (h > 0.0) {
                    color = mix(midColor, topColor, pow(h, 0.6));
                } else {
                    color = mix(midColor, bottomColor, pow(-h, 0.4));
                }
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ============ PARTÍCULAS DE POLVO ============
function buildDustParticles() {
    const dustCount = 800;
    const positions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 300;
        positions[i * 3 + 1] = Math.random() * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xd4b896, size: 0.25,
        transparent: true, opacity: 0.5, sizeAttenuation: true
    });
    dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);
}

// ============ ENTORNO ============
function buildEnvironment() {
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 64, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xc29b63, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Agua
    const waterGeo = new THREE.CircleGeometry(45, 64);
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x1a75ff, roughness: 0.05, metalness: 0.3,
        transparent: true, opacity: 0.85
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.08, 0);
    scene.add(water);

    // Arena húmeda
    const wetSandGeo = new THREE.RingGeometry(45, 52, 64);
    const wetSandMat = new THREE.MeshStandardMaterial({ color: 0x9b7b4a, roughness: 0.8 });
    const wetSand = new THREE.Mesh(wetSandGeo, wetSandMat);
    wetSand.rotation.x = -Math.PI / 2;
    wetSand.position.set(0, 0.05, 0);
    scene.add(wetSand);

    // Pasto
    const grassGeo = new THREE.RingGeometry(52, 70, 64);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x47662b, roughness: 0.9 });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0.04, 0);
    scene.add(grass);

    // Rocas y árboles
    for (let i = 0; i < 120; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 85 + Math.random() * 400;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        const sizeRoll = Math.random();
        let height, width;
        if (sizeRoll < 0.5) { height = 2 + Math.random() * 3; width = 2 + Math.random() * 2; }
        else if (sizeRoll < 0.85) { height = 6 + Math.random() * 5; width = 5 + Math.random() * 4; }
        else { height = 18 + Math.random() * 15; width = 14 + Math.random() * 10; }

        const rockGeo = new THREE.ConeGeometry(width, height, 6 + Math.floor(Math.random() * 3));
        const goldColor = new THREE.Color().setHSL(0.12 + Math.random() * 0.03, 0.6 + Math.random() * 0.2, 0.45 + Math.random() * 0.1);
        const goldMat = new THREE.MeshStandardMaterial({ color: goldColor, metalness: 0.7 + Math.random() * 0.2, roughness: 0.15 + Math.random() * 0.15 });
        const rock = new THREE.Mesh(rockGeo, goldMat);
        rock.position.set(x, height / 2, z);
        rock.rotation.y = Math.random() * Math.PI;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);

        if (Math.random() > 0.4) {
            const tree = new THREE.Group();
            const trunkHeight = 4 + Math.random() * 3;
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.5, trunkHeight, 6),
                new THREE.MeshStandardMaterial({ color: 0x4d3319, roughness: 0.95 })
            );
            trunk.position.y = trunkHeight / 2;
            trunk.castShadow = true;
            tree.add(trunk);

            const foliageMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0.28 + Math.random() * 0.05, 0.5, 0.2 + Math.random() * 0.1),
                roughness: 0.95
            });
            const foliageCount = 2 + Math.floor(Math.random() * 3);
            for (let f = 0; f < foliageCount; f++) {
                const size = 1.5 + Math.random() * 2;
                const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), foliageMat);
                foliage.position.set((Math.random() - 0.5) * 2, trunkHeight + (Math.random() * 2 - 1), (Math.random() - 0.5) * 2);
                foliage.castShadow = true;
                tree.add(foliage);
            }
            tree.position.set(x + (Math.random() * 10 - 5), 0, z + (Math.random() * 10 - 5));
            scene.add(tree);
        }
    }

    // Dunas
    for (let d = 0; d < 30; d++) {
        const duneGeo = new THREE.SphereGeometry(3 + Math.random() * 5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        const duneMat = new THREE.MeshStandardMaterial({ color: 0xb8945a, roughness: 0.95 });
        const dune = new THREE.Mesh(duneGeo, duneMat);
        const duneAngle = Math.random() * Math.PI * 2;
        const duneDist = 70 + Math.random() * 350;
        dune.position.set(Math.cos(duneAngle) * duneDist, -0.5, Math.sin(duneAngle) * duneDist);
        dune.scale.y = 0.3 + Math.random() * 0.3;
        dune.receiveShadow = true;
        scene.add(dune);
    }
}

// ============ JUGADOR (TERCERA PERSONA) ============
function assembleMountedPlayer() {
    player = new THREE.Group();
    player.position.set(0, 0, 60);
    scene.add(player);

    // --- CABALLO ---
    horse = new THREE.Group();
    const whiteHorseMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6, metalness: 0.05 });
    const maneMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });

    // Cuerpo
    const horseBody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 3.2, 2, 2, 4), whiteHorseMat);
    horseBody.position.y = 1.6;
    horseBody.castShadow = true;
    horse.add(horseBody);

    // Cuello
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6), whiteHorseMat);
    neck.position.set(0, 2.4, 1.2);
    neck.rotation.x = -0.5;
    neck.castShadow = true;
    horse.add(neck);

    // Cabeza
    const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 1.0, 1, 1, 2), whiteHorseMat);
    horseHead.position.set(0, 2.9, 1.7);
    horseHead.rotation.x = -0.3;
    horseHead.castShadow = true;
    horse.add(horseHead);

    // Orejas
    const earGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
    const earL = new THREE.Mesh(earGeo, whiteHorseMat);
    earL.position.set(-0.15, 3.3, 1.5);
    earL.rotation.z = 0.2;
    horse.add(earL);
    const earR = new THREE.Mesh(earGeo, whiteHorseMat);
    earR.position.set(0.15, 3.3, 1.5);
    earR.rotation.z = -0.2;
    horse.add(earR);

    // Crin
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.25), maneMat);
    mane.position.set(0, 2.5, 0.9);
    mane.rotation.x = -0.3;
    horse.add(mane);

    // Cola
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 1.4, 5), maneMat);
    tail.position.set(0, 1.0, -1.8);
    tail.rotation.x = 0.5;
    horse.add(tail);

    // Patas (con "rodillas")
    const legUpperGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.7, 6);
    const legLowerGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.7, 6);
    const hoofGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });

    for (let xOffset of [-0.5, 0.5]) {
        for (let zOffset of [-1.1, 1.1]) {
            const upperLeg = new THREE.Mesh(legUpperGeo, whiteHorseMat);
            upperLeg.position.set(xOffset, 0.85, zOffset);
            upperLeg.castShadow = true;
            horse.add(upperLeg);

            const lowerLeg = new THREE.Mesh(legLowerGeo, whiteHorseMat);
            lowerLeg.position.set(xOffset, 0.3, zOffset);
            lowerLeg.castShadow = true;
            horse.add(lowerLeg);

            const hoof = new THREE.Mesh(hoofGeo, hoofMat);
            hoof.position.set(xOffset, 0.05, zOffset);
            horse.add(hoof);
        }
    }

    // Montura
    const saddle = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.15, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.8 })
    );
    saddle.position.set(0, 2.3, 0);
    horse.add(saddle);

    player.add(horse);

    // --- SOLDADO (cuerpo completo) ---
    soldier = new THREE.Group();
    soldier.position.set(0, 2.4, -0.1);

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.75, roughness: 0.25 });
    const darkGoldMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.7, roughness: 0.3 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });

    // Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 1.2, 8), goldMat);
    torso.position.y = 0.6;
    torso.castShadow = true;
    soldier.add(torso);

    // Cinturón
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 8), leatherMat);
    belt.position.y = 0.1;
    soldier.add(belt);

    // Hombros (pauldrons)
    const shoulderGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const shoulderL = new THREE.Mesh(shoulderGeo, darkGoldMat);
    shoulderL.position.set(-0.48, 1.05, 0);
    shoulderL.castShadow = true;
    soldier.add(shoulderL);
    const shoulderR = new THREE.Mesh(shoulderGeo, darkGoldMat);
    shoulderR.position.set(0.48, 1.05, 0);
    shoulderR.castShadow = true;
    soldier.add(shoulderR);

    // Brazos (hombro → codo → antebrazo)
    const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.5, 6);
    const forearmGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6);
    const handGeo = new THREE.SphereGeometry(0.07, 6, 5);

    // Brazo derecho (sostiene espada)
    const armR_upper = new THREE.Mesh(upperArmGeo, goldMat);
    armR_upper.position.set(0.5, 0.75, 0.1);
    armR_upper.rotation.z = -0.3;
    armR_upper.castShadow = true;
    soldier.add(armR_upper);

    const armR_fore = new THREE.Mesh(forearmGeo, darkGoldMat);
    armR_fore.position.set(0.55, 0.4, 0.25);
    armR_fore.rotation.x = -0.5;
    soldier.add(armR_fore);

    const handR = new THREE.Mesh(handGeo, new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8 }));
    handR.position.set(0.58, 0.2, 0.4);
    soldier.add(handR);

    // Brazo izquierdo (sostiene escudo)
    const armL_upper = new THREE.Mesh(upperArmGeo, goldMat);
    armL_upper.position.set(-0.5, 0.75, 0.1);
    armL_upper.rotation.z = 0.3;
    armL_upper.castShadow = true;
    soldier.add(armL_upper);

    const armL_fore = new THREE.Mesh(forearmGeo, darkGoldMat);
    armL_fore.position.set(-0.55, 0.4, 0.2);
    armL_fore.rotation.x = -0.4;
    soldier.add(armL_fore);

    const handL = new THREE.Mesh(handGeo, new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8 }));
    handL.position.set(-0.58, 0.2, 0.35);
    soldier.add(handL);

    // ═══ ESCUDO (lado izquierdo) ═══
    const shieldGroup = new THREE.Group();
    const shieldBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.4, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.4, roughness: 0.5 })
    );
    shieldBody.rotation.z = Math.PI / 2;
    shieldGroup.add(shieldBody);

    // Emblema del escudo (cruz dorada)
    const emblemH = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), goldMat);
    emblemH.position.set(0.05, 0, 0);
    shieldGroup.add(emblemH);
    const emblemV = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.02), goldMat);
    emblemV.position.set(0.05, 0, 0);
    shieldGroup.add(emblemV);

    shieldGroup.position.set(-0.75, 0.4, 0.35);
    shieldGroup.rotation.y = 0.3;
    soldier.add(shieldGroup);

    // Piernas (muslo → rodilla → pantorrilla → bota)
    const thighGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.5, 6);
    const shinGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6);
    const bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.25);

    // Pierna derecha
    const legR_thigh = new THREE.Mesh(thighGeo, darkGoldMat);
    legR_thigh.position.set(0.15, -0.2, 0);
    legR_thigh.castShadow = true;
    soldier.add(legR_thigh);
    const legR_shin = new THREE.Mesh(shinGeo, goldMat);
    legR_shin.position.set(0.15, -0.6, 0);
    soldier.add(legR_shin);
    const legR_boot = new THREE.Mesh(bootGeo, leatherMat);
    legR_boot.position.set(0.15, -0.85, 0.05);
    soldier.add(legR_boot);

    // Pierna izquierda
    const legL_thigh = new THREE.Mesh(thighGeo, darkGoldMat);
    legL_thigh.position.set(-0.15, -0.2, 0);
    legL_thigh.castShadow = true;
    soldier.add(legL_thigh);
    const legL_shin = new THREE.Mesh(shinGeo, goldMat);
    legL_shin.position.set(-0.15, -0.6, 0);
    soldier.add(legL_shin);
    const legL_boot = new THREE.Mesh(bootGeo, leatherMat);
    legL_boot.position.set(-0.15, -0.85, 0.05);
    soldier.add(legL_boot);

    // Casco con visera y cresta
    const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
        new THREE.MeshStandardMaterial({ color: 0xb5b5b5, metalness: 0.85, roughness: 0.2 })
    );
    helmet.position.y = 1.45;
    helmet.castShadow = true;
    soldier.add(helmet);

    // Visera
    const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.08, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 })
    );
    visor.position.set(0, 1.4, 0.25);
    soldier.add(visor);

    // Cresta roja
    const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.25, 0.55),
        new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.7 })
    );
    crest.position.set(0, 1.7, 0);
    soldier.add(crest);

    // Espada (brazo derecho)
    sword = new THREE.Group();
    const swordBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.5, 0.2, 1, 4, 1),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.15 })
    );
    swordBlade.position.y = 0.75;
    swordBlade.castShadow = true;
    sword.add(swordBlade);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.08), darkGoldMat);
    guard.position.y = 0.02;
    sword.add(guard);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), leatherMat);
    handle.position.y = -0.12;
    sword.add(handle);

    sword.position.set(0.6, 0.15, 0.4);
    soldier.add(sword);

    player.add(soldier);


// ============ ENEMIGOS (cuerpo completo) ============
function spawnEnemyUnit() {
    const enemyUnit = new THREE.Group();

    const spawnAngle = Math.random() * Math.PI * 2;
    const x = player.position.x + Math.cos(spawnAngle) * 80;
    const z = player.position.z + Math.sin(spawnAngle) * 80;
    enemyUnit.position.set(x, 0, z);

    const enemyMat = new THREE.MeshStandardMaterial({ color: 0x6e2222, roughness: 0.7, metalness: 0.1 });
    const darkEnemyMat = new THREE.MeshStandardMaterial({ color: 0x4a1515, roughness: 0.8 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });

    // Torso
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8), enemyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    enemyUnit.add(body);

    // Cabeza
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc4956a, roughness: 0.8 }));
    head.position.y = 2.0;
    enemyUnit.add(head);

    // Casco enemigo
    const eHelmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.4 })
    );
    eHelmet.position.y = 2.05;
    eHelmet.castShadow = true;
    enemyUnit.add(eHelmet);

    // Brazos
    const eArmGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.7, 5);
    const eArmL = new THREE.Mesh(eArmGeo, enemyMat);
    eArmL.position.set(-0.45, 1.3, 0);
    eArmL.rotation.z = 0.3;
    enemyUnit.add(eArmL);
    const eArmR = new THREE.Mesh(eArmGeo, enemyMat);
    eArmR.position.set(0.45, 1.3, 0);
    eArmR.rotation.z = -0.3;
    enemyUnit.add(eArmR);

    // Piernas
    const eLegGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.8, 5);
    const eLegL = new THREE.Mesh(eLegGeo, darkEnemyMat);
    eLegL.position.set(-0.15, 0.4, 0);
    eLegL.castShadow = true;
    enemyUnit.add(eLegL);
    const eLegR = new THREE.Mesh(eLegGeo, darkEnemyMat);
    eLegR.position.set(0.15, 0.4, 0);
    eLegR.castShadow = true;
    enemyUnit.add(eLegR);

    // Botas
    const eBootGeo = new THREE.BoxGeometry(0.14, 0.1, 0.22);
    const eBootL = new THREE.Mesh(eBootGeo, leatherMat);
    eBootL.position.set(-0.15, 0.05, 0.05);
    enemyUnit.add(eBootL);
    const eBootR = new THREE.Mesh(eBootGeo, leatherMat);
    eBootR.position.set(0.15, 0.05, 0.05);
    enemyUnit.add(eBootR);

    // Espada enemiga
    const eSword = new THREE.Group();
    const eBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.0, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x6e6e6e, metalness: 0.6, roughness: 0.3 })
    );
    eBlade.position.y = 0.5;
    eBlade.castShadow = true;
    eSword.add(eBlade);
    eSword.position.set(0.5, 1.0, 0.3);
    eSword.rotation.x = -0.5;
    enemyUnit.add(eSword);

    // ═══ ESCUDO ENEMIGO ═══
    const eShield = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.35, 0.06, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.5 })
    );
    eShield.rotation.z = Math.PI / 2;
    eShield.position.set(-0.55, 1.2, 0.2);
    eShield.rotation.y = 0.3;
    enemyUnit.add(eShield);

    enemyUnit.userData = { currentHealth: 100 };
    scene.add(enemyUnit);
    enemyPool.push(enemyUnit);
}

// ============ COMBATE ============
function executeSwordStrike() {
    if (isPaused || isGameOver || isStriking) return;
    isStriking = true;
    strikeTimer = 0;
}

function processSwordAnimation(deltaTime) {
    if (!isStriking) return;
    strikeTimer += deltaTime * 9.5;
    if (strikeTimer < Math.PI) {
        sword.rotation.x = Math.sin(strikeTimer) * 1.6;
        sword.position.z = 0.4 + Math.sin(strikeTimer) * 0.4;
    } else {
        sword.rotation.x = 0;
        sword.position.z = 0.4;
        isStriking = false;
        evaluateCombatDamage();
    }
}

function evaluateCombatDamage() {
    for (let i = enemyPool.length - 1; i >= 0; i--) {
        const target = enemyPool[i];
        const range = player.position.distanceTo(target.position);
        if (range <= 5.5) {
            target.userData.currentHealth -= 50;
            if (target.children[0]) {
                target.children[0].material.color.setHex(0xffffff);
                setTimeout(() => {
                    if (target && target.children[0])
                        target.children[0].material.color.setHex(0x6e2222);
                }, 80);
            }
            if (target.userData.currentHealth <= 0) {
                scene.remove(target);
                enemyPool.splice(i, 1);
                killCount++;
                refreshHUD();
            }
        }
    }
}

// ============ CONTROLES ============
function handleKeyDown(e) {
    switch (e.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'KeyE': executeSwordStrike(); break;
        case 'KeyF':
            isSoldierVisible = !isSoldierVisible;
            soldier.visible = isSoldierVisible;
            break;
        case 'Space':
            e.preventDefault();
            togglePauseSystem();
            break;
    }
}

function handleKeyUp(e) {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function togglePauseSystem() {
    if (isGameOver) return;
    isPaused = !isPaused;
    const pauseOverlay = document.getElementById('pause-screen');
    if (isPaused) {
        if (pauseOverlay) pauseOverlay.classList.remove('hidden');
        if (autoResumeTimeout) clearTimeout(autoResumeTimeout);
        autoResumeTimeout = setTimeout(() => { if (isPaused) togglePauseSystem(); }, 600000);
    } else {
        if (pauseOverlay) pauseOverlay.classList.add('hidden');
        if (autoResumeTimeout) clearTimeout(autoResumeTimeout);
    }
}

// ============ HUD ============
function refreshHUD() {
    const healthBar = document.getElementById('health-bar');
    const damageText = document.getElementById('damage-text');
    const killEl = document.getElementById('kill-count');
    const livesEl = document.getElementById('lives-count');
    if (!healthBar) return;

    let visualPercentage = Math.max(0, 100 - playerDamage);
    healthBar.style.width = visualPercentage + '%';

    let rChannel = Math.floor((playerDamage / 100) * 255);
    let gChannel = Math.floor(((100 - playerDamage) / 100) * 255);
    healthBar.style.backgroundColor = `rgb(${rChannel}, ${gChannel}, 0)`;

    if (damageText) damageText.textContent = Math.floor(playerDamage) + '%';
    if (killEl) killEl.textContent = killCount;
    if (livesEl) livesEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);

    if (playerDamage >= 90 && !isGameOver) {
        lives--;
        if (lives <= 0) {
            isGameOver = true;
            const gameOverScreen = document.getElementById('game-over-screen');
            if (gameOverScreen) gameOverScreen.classList.remove('hidden');
        } else {
            // ═══ NUEVO: Perder una vida → resetear daño ═══
            playerDamage = 0;
        }
    }
}

// ============ AIRDROP ============
function spawnSupplyAirdrop() {
    const airdropBox = new THREE.Group();
    const targetX = player.position.x + (Math.random() * 30 - 15);
    const targetZ = player.position.z + (Math.random() * 30 - 15);
    airdropBox.position.set(targetX, 55, targetZ);

    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 2.5, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x1f5c2e, roughness: 0.7, metalness: 0.1 })
    );
    crate.castShadow = true;
    airdropBox.add(crate);

    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.1), crossMat);
    crossH.position.z = 1.28;
    airdropBox.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.1), crossMat);
    crossV.position.z = 1.28;
    airdropBox.add(crossV);

    scene.add(airdropBox);
    airdropPool.push(airdropBox);
}

// ============ GAME LOOP ============
function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (isPaused || isGameOver) return;

    const deltaTime = clock.getDelta();
    totalRunTime += deltaTime;
    enemySpawnCounter += deltaTime;

    if (enemySpawnCounter >= 10) {
        spawnEnemyUnit();
        enemySpawnCounter = 0;
    }

    if (totalRunTime >= 180 && !isAirdropTriggered) {
        spawnSupplyAirdrop();
        isAirdropTriggered = true;
    }

    const runVelocity = 18 * deltaTime;
    const rotVelocity = 2.4 * deltaTime;

    if (moveLeft) player.rotation.y += rotVelocity;
    if (moveRight) player.rotation.y -= rotVelocity;

    if (moveForward) {
        player.translateZ(runVelocity);
        horse.position.y = Math.abs(Math.sin(totalRunTime * 6.5)) * 0.25;
        horse.rotation.z = Math.sin(totalRunTime * 6.5) * 0.03;
    } else if (moveBackward) {
        player.translateZ(-runVelocity * 0.55);
        horse.position.y = Math.abs(Math.sin(totalRunTime * 4.0)) * 0.12;
        horse.rotation.z = Math.sin(totalRunTime * 4.0) * 0.02;
    } else {
        horse.position.y = 0;
        horse.rotation.z = 0;
    }

    processSwordAnimation(deltaTime);

    if (dustParticles) {
        dustParticles.position.x = player.position.x;
        dustParticles.position.z = player.position.z;
        dustParticles.rotation.y += deltaTime * 0.02;
    }

    for (let i = 0; i < enemyPool.length; i++) {
        const enemy = enemyPool[i];
        enemy.lookAt(player.position.x, enemy.position.y, player.position.z);
        enemy.translateZ(4.5 * deltaTime);
        if (enemy.position.distanceTo(player.position) < 2.5) {
            playerDamage += 12 * deltaTime;
            refreshHUD();
        }
    }

    for (let j = airdropPool.length - 1; j >= 0; j--) {
        const drop = airdropPool[j];
        if (drop.position.y > 1.2) {
            drop.position.y -= 7.5 * deltaTime;
            drop.rotation.y += deltaTime * 1.5;
        } else {
            if (player.position.distanceTo(drop.position) < 3.8) {
                playerDamage = Math.max(0, playerDamage - 45);
                refreshHUD();
                scene.remove(drop);
                airdropPool.splice(j, 1);
            }
        }
    }
// ═══ CÁMARA TERCERA PERSONA (independiente) ═══
const camDist = 6;
const camHeight = 4.5;
const camX = player.position.x - Math.sin(player.rotation.y) * camDist;
const camZ = player.position.z - Math.cos(player.rotation.y) * camDist;
camera.position.set(camX, player.position.y + camHeight, camZ);
camera.lookAt(player.position.x, player.position.y + 2.5, player.position.z);   
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============ INICIO ============
initGameEngine();
gameLoop();   
}
