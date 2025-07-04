import * as THREE from "https://cdn.skypack.dev/three@0.129.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js";

// Scene setup
let scene, camera, renderer, controls;
let planet_sun, planet_mercury, planet_venus, planet_earth, planet_mars, 
    planet_jupiter, planet_saturn, planet_uranus, planet_neptune;
let orbitLines = [];
let animationPaused = false;
let planetLabels = {};

// Planet properties
const planetProperties = {
    mercury: { radius: 50, size: 2, speed: 2, texture: "../img/mercury_hd.jpg" },
    venus: { radius: 60, size: 3, speed: 1.5, texture: "../img/venus_hd.jpg" },
    earth: { radius: 70, size: 4, speed: 1, texture: "../img/earth_hd.jpg" },
    mars: { radius: 80, size: 3.5, speed: 0.8, texture: "../img/mars_hd.jpg" },
    jupiter: { radius: 100, size: 10, speed: 0.7, texture: "../img/jupiter_hd.jpg" },
    saturn: { radius: 120, size: 8, speed: 0.6, texture: "../img/saturn_hd.jpg" },
    uranus: { radius: 140, size: 6, speed: 0.5, texture: "../img/uranus_hd.jpg" },
    neptune: { radius: 160, size: 5, speed: 0.4, texture: "../img/neptune_hd.jpg" },
    sun: { radius: 20, size: 20, speed: 0, texture: "../img/sun_hd.jpg" }
};

// Load planet texture
function loadPlanetTexture(texture, radius, widthSegments, heightSegments, meshType) {
    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const loader = new THREE.TextureLoader();
    const planetTexture = loader.load(texture);
    const material = meshType == 'standard' ? 
        new THREE.MeshStandardMaterial({ map: planetTexture }) : 
        new THREE.MeshBasicMaterial({ map: planetTexture });
    return new THREE.Mesh(geometry, material);
}

// Create orbit rings
function createRing(innerRadius) {
    const geometry = new THREE.RingGeometry(innerRadius, innerRadius - 0.1, 100);
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    mesh.rotation.x = Math.PI / 2;
    orbitLines.push(mesh);
    return mesh;
}

// Create planet label
function createPlanetLabel(planetName, planetMesh) {
    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = planetName.charAt(0).toUpperCase() + planetName.slice(1);
    label.style.position = 'absolute';
    label.style.color = 'white';
    label.style.pointerEvents = 'none';
    label.style.fontFamily = 'Arial, sans-serif';
    label.style.fontSize = '14px';
    label.style.fontWeight = 'bold';
    label.style.textShadow = '0 0 5px black';
    label.style.visibility = 'hidden';
    document.body.appendChild(label);
    planetLabels[planetName] = { element: label, mesh: planetMesh };
}

// Update planet labels position
function updateLabels() {
    for (const planetName in planetLabels) {
        const { element, mesh } = planetLabels[planetName];
        const vector = new THREE.Vector3();
        vector.setFromMatrixPosition(mesh.matrixWorld);
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
        const y = (-(vector.y * 0.5) + 0.5) * renderer.domElement.clientHeight;
        
        element.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
    }
}

// Create speed control panel
function createSpeedControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'speed-control-panel';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.left = '20px';
    panel.style.backgroundColor = 'rgba(0,0,0,0.7)';
    panel.style.padding = '15px';
    panel.style.borderRadius = '10px';
    panel.style.color = 'white';
    panel.style.zIndex = '1000';
    
    const title = document.createElement('h3');
    title.textContent = 'Planet Speed Controls';
    title.style.marginTop = '0';
    panel.appendChild(title);
    
    for (const planet in planetProperties) {
        if (planet === 'sun') continue;
        
        const container = document.createElement('div');
        container.style.margin = '10px 0';
        
        const label = document.createElement('label');
        label.textContent = `${planet.charAt(0).toUpperCase() + planet.slice(1)}: `;
        label.style.display = 'inline-block';
        label.style.width = '100px';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '5';
        slider.step = '0.1';
        slider.value = planetProperties[planet].speed;
        slider.style.width = '150px';
        
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = planetProperties[planet].speed;
        valueDisplay.style.marginLeft = '10px';
        valueDisplay.style.display = 'inline-block';
        valueDisplay.style.width = '40px';
        
        slider.addEventListener('input', (e) => {
            planetProperties[planet].speed = parseFloat(e.target.value);
            valueDisplay.textContent = e.target.value;
        });
        
        container.appendChild(label);
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        panel.appendChild(container);
    }
    
    document.body.appendChild(panel);
}

// Create pause/resume button
function createPauseButton() {
    const btn = document.createElement('button');
    btn.id = 'pause-btn';
    btn.textContent = 'Pause';
    btn.style.position = 'fixed';
    btn.style.top = '20px';
    btn.style.left = '20px';
    btn.style.zIndex = '1000';
    btn.style.padding = '10px 20px';
    btn.style.backgroundColor = '#222';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    
    btn.addEventListener('click', () => {
        animationPaused = !animationPaused;
        btn.textContent = animationPaused ? 'Resume' : 'Pause';
    });
    
    document.body.appendChild(btn);
}

// Setup raycasting for planet interaction
function setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    function onMouseMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        
        // Hide all labels first
        for (const planetName in planetLabels) {
            planetLabels[planetName].element.style.visibility = 'hidden';
        }
        
        // Show label for hovered planet
        for (let i = 0; i < intersects.length; i++) {
            const planetName = Object.keys(planetLabels).find(name => 
                planetLabels[name].mesh === intersects[i].object
            );
            if (planetName) {
                planetLabels[planetName].element.style.visibility = 'visible';
                break;
            }
        }
       

    }
    function onClick(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children);
  
      for (let i = 0; i < intersects.length; i++) {
          const planetName = Object.keys(planetLabels).find(name =>
              planetLabels[name].mesh === intersects[i].object
          );
          if (planetName) {
              const planet = planetLabels[planetName].mesh;
              const targetPosition = new THREE.Vector3();
              planet.getWorldPosition(targetPosition);
  
              // Smooth zoom (optional)
              const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
              controls.target.copy(targetPosition);
              camera.position.copy(targetPosition).add(direction);
  
              controls.update(); // This is the critical part
              break;
          }
      }
  }
  
    
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onClick, false);
}

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Load planets
    for (const planet in planetProperties) {
        const props = planetProperties[planet];
        const mesh = loadPlanetTexture(
            props.texture, 
            props.size, 
            100, 
            100, 
            planet === 'sun' ? 'basic' : 'standard'
        );
        
        scene.add(mesh);
        if (planet === 'sun') {
            planet_sun = mesh;
            // Add sun light
            const sunLight = new THREE.PointLight(0xffffff, 1, 0);
            sunLight.position.copy(planet_sun.position);
            scene.add(sunLight);
        } else {
            createPlanetLabel(planet, mesh);
            createRing(props.radius);
        }
    }
    
    // Assign planet variables
    planet_mercury = planetLabels.mercury.mesh;
    planet_venus = planetLabels.venus.mesh;
    planet_earth = planetLabels.earth.mesh;
    planet_mars = planetLabels.mars.mesh;
    planet_jupiter = planetLabels.jupiter.mesh;
    planet_saturn = planetLabels.saturn.mesh;
    planet_uranus = planetLabels.uranus.mesh;
    planet_neptune = planetLabels.neptune.mesh;

    // Set up renderer and controls
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 12;
    controls.maxDistance = 1000;
    camera.position.z = 100;
    
    // Create UI elements
    createSpeedControlPanel();
    createPauseButton();
    setupRaycaster();
}

function updateOrbitLinesColor(isDarkTheme) {
    const color = isDarkTheme ? 0xffffff : 0x000000;
    orbitLines.forEach(line => line.material.color.setHex(color));
}

function updateStarColors(isDarkTheme) {
    if (window.stars) {
        window.stars.material.color.setHex(isDarkTheme ? 0xffffff : 0x000000);
    }
}

function setupThemeToggle() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'theme-toggle-btn';
    toggleBtn.style.position = 'fixed';
    toggleBtn.style.top = '20px';
    toggleBtn.style.right = '20px';
    toggleBtn.style.zIndex = '1000';
    toggleBtn.style.padding = '10px 20px';
    toggleBtn.style.border = 'none';
    toggleBtn.style.borderRadius = '5px';
    toggleBtn.style.cursor = 'pointer';
    
    // Set initial theme
    let currentTheme = localStorage.getItem('theme') || 'dark';
    localStorage.setItem('theme', currentTheme);
    document.body.setAttribute('data-theme', currentTheme);
    
    function updateTheme() {
        const isDark = currentTheme === 'dark';
        toggleBtn.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        toggleBtn.style.background = isDark ? '#222' : '#fff';
        toggleBtn.style.color = isDark ? '#fff' : '#222';
        
        renderer.setClearColor(isDark ? 0x000000 : 0xffffff, 1);
        updateOrbitLinesColor(isDark);
        updateStarColors(isDark);
    }
    
    toggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        document.body.setAttribute('data-theme', currentTheme);
        updateTheme();
    });
    
    updateTheme();
    document.body.appendChild(toggleBtn);
}

function animate(time) {
    requestAnimationFrame(animate);
    
    if (!animationPaused) {
        // Rotate planets
        const rotationSpeed = 0.005;
        [planet_earth, planet_sun, planet_mercury, planet_venus, planet_mars, 
         planet_jupiter, planet_saturn, planet_uranus, planet_neptune].forEach(planet => {
            planet.rotation.y += rotationSpeed;
        });
        
        // Revolve planets using current speeds
        planetRevolver(time, planetProperties.mercury.speed, planet_mercury, planetProperties.mercury.radius);
        planetRevolver(time, planetProperties.venus.speed, planet_venus, planetProperties.venus.radius);
        planetRevolver(time, planetProperties.earth.speed, planet_earth, planetProperties.earth.radius);
        planetRevolver(time, planetProperties.mars.speed, planet_mars, planetProperties.mars.radius);
        planetRevolver(time, planetProperties.jupiter.speed, planet_jupiter, planetProperties.jupiter.radius);
        planetRevolver(time, planetProperties.saturn.speed, planet_saturn, planetProperties.saturn.radius);
        planetRevolver(time, planetProperties.uranus.speed, planet_uranus, planetProperties.uranus.radius);
        planetRevolver(time, planetProperties.neptune.speed, planet_neptune, planetProperties.neptune.radius);
    }
    
    // Theme toggle setup (once)
    if (!window.themeToggleAdded) {
        setupThemeToggle();
        window.themeToggleAdded = true;
    }
    
    // Add stars (once)
    if (!window.starsAdded) {
        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < 2000; i++) {
            starVertices.push(
                (Math.random() - 0.5) * 2000,
                (Math.random() - 0.5) * 2000,
                (Math.random() - 0.5) * 2000
            );
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const isDark = localStorage.getItem('theme') === 'dark';
        window.stars = new THREE.Points(
            starGeometry,
            new THREE.PointsMaterial({ color: isDark ? 0xffffff : 0x000000, size: 1 })
        );
        scene.add(window.stars);
        window.starsAdded = true;
    }
    
    updateLabels();
    controls.update();
    renderer.render(scene, camera);
}
function planetRevolver(time, speed, planet, orbitRadius) {
    const planetAngle = time * 0.001 * speed;
    planet.position.x = planet_sun.position.x + orbitRadius * Math.cos(planetAngle);
    planet.position.z = planet_sun.position.z + orbitRadius * Math.sin(planetAngle);
}

// Add some basic CSS for labels
const style = document.createElement('style');
style.textContent = `
    .planet-label {
        position: absolute;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        text-shadow: 0 0 5px black;
        pointer-events: none;
        transform: translate(-50%, -50%);
        transition: transform 0.1s;
    }
`;
document.head.appendChild(style);

init();
animate(0);