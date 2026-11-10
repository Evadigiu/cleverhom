// Ma Maison en Jeu : prototype de la maison 3D qui tourne sur téléphone.
// Premier chargement : la maison fermée, le jardin et la famille. L'intérieur se charge ensuite en arrière-plan.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const M = 'assets/models/';
const DEBUT = performance.now();
const QS = new URLSearchParams(location.search);

// ---------- rendu ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#fdece3');
scene.fog = new THREE.Fog('#fdece3', 34, 70);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

scene.add(new THREE.HemisphereLight('#fff0e0', '#c7b48e', 1.05));
const soleil = new THREE.DirectionalLight('#ffdcb5', 3.1);
soleil.position.set(-12, 22, -4);
soleil.target.position.set(2, 0, 3);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 30;
controls.maxPolarAngle = 1.32;
controls.autoRotate = true;
controls.autoRotateSpeed = -0.6;

// vue extérieure : la maison vue du jardin, de trois-quarts
const VUES = {
  exterieur: { cible: [1.0, 1.4, 3.2], camera: [-22, 8, -6] },
  coupe: { cible: [3.0, 0.2, 2.6], camera: [-9, 11, -7] },
};
function placerCamera(v) { const c = VUES[v]; controls.target.set(...c.cible); camera.position.set(...c.camera); controls.update(); }

function taille() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 46 : 36; camera.updateProjectionMatrix();
}
addEventListener('resize', taille); taille();

// ---------- chargement ----------
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const octets = {}; let total = 0;
const barre = document.getElementById('barre'), texte = document.getElementById('texte');
function suivi(nom, attendu) {
  return (e) => { octets[nom] = e.loaded; if (attendu) { const fait = Object.values(octets).reduce((a, b) => a + b, 0); barre.style.width = Math.min(100, (100 * fait) / attendu) + '%'; } };
}
async function charger(nom, attendu) {
  const g = await loader.loadAsync(M + nom + '.glb', suivi(nom, attendu));
  g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = !m.material.transparent; m.receiveShadow = true; } });
  total += octets[nom] || 0;
  return g;
}

const personnages = {}; const mixers = [];
let placements = null, vue = 'exterieur';
let coque = {}, interieur = null;

function placerFamille() {
  for (const [qui, obj] of Object.entries(personnages)) {
    const p = placements[vue][qui]; obj.visible = !!p;
    if (p) { obj.position.set(...p.p); obj.rotation.y = p.r; }
  }
}

async function demarrer() {
  placements = await (await fetch('assets/placements.json')).json();
  const ATTENDU = 7.1e6; // maison, jardin et famille, pour la barre de progression
  const [ext, jardin, lea, thomas, lou] = await Promise.all([
    charger('maison-exterieur', ATTENDU), charger('jardin', ATTENDU), charger('lea', ATTENDU), charger('thomas', ATTENDU), charger('lou', ATTENDU),
  ]);
  coque.exterieur = ext.scene; scene.add(ext.scene, jardin.scene);
  for (const [qui, g] of Object.entries({ lea, thomas, lou })) {
    personnages[qui] = g.scene; scene.add(g.scene);
    if (g.animations[0]) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(g.animations[0]).play(); mx.setTime(Math.random() * 2); mixers.push(mx); }
  }
  placerFamille(); placerCamera('exterieur');
  const pret = (performance.now() - DEBUT) / 1000;
  document.getElementById('chargement').classList.add('fini');
  mesures.pret = pret; mesures.premier = total;

  // en arrière-plan : l'intérieur et la maison en coupe
  const [inte, coupe] = await Promise.all([charger('interieur'), charger('maison-coupe')]);
  interieur = inte.scene; scene.add(interieur);
  coque.coupe = coupe.scene; coupe.scene.visible = false; scene.add(coupe.scene);
  mesures.complet = (performance.now() - DEBUT) / 1000; mesures.tout = total;
  const b = document.getElementById('vue'); b.disabled = false;
}

// ---------- ouvrir / fermer la maison ----------
function basculer() {
  if (!coque.coupe) return;
  vue = vue === 'exterieur' ? 'coupe' : 'exterieur';
  coque.exterieur.visible = vue === 'exterieur'; coque.coupe.visible = vue === 'coupe';
  placerFamille(); placerCamera(vue);
  document.getElementById('vue').textContent = vue === 'coupe' ? 'Fermer la maison' : 'Ouvrir la maison';
}
document.getElementById('vue').addEventListener('click', basculer);
document.getElementById('jouer').addEventListener('click', (e) => { e.preventDefault(); if (vue === 'exterieur') basculer(); });

// l'indication disparaît dès qu'on touche la maison ; la rotation automatique s'arrête
const astuce = document.getElementById('astuce');
controls.addEventListener('start', () => { controls.autoRotate = false; astuce.classList.add('cache'); });

// ---------- mesures (ajouter ?mesures=1 à l'adresse) ----------
const mesures = {};
const panneau = document.getElementById('mesures');
if (QS.has('mesures')) panneau.hidden = false;
let images = 0, t0 = performance.now(), ips = 0;
const horloge = new THREE.Clock();

// mode capture (tests automatiques sans processeur graphique) : une image à la demande
const CAPTURE = QS.has('capture');
window.__image = (secondes = 0.1) => { for (const mx of mixers) mx.update(secondes); controls.update(); renderer.render(scene, camera); };
window.__basculer = () => basculer();
window.__etat = () => ({ pret: !!mesures.pret, complet: !!mesures.complet, mesures, triangles: renderer.info.render.triangles });
if (!CAPTURE) renderer.setAnimationLoop(() => {
  const dt = Math.min(horloge.getDelta(), 0.1);
  for (const mx of mixers) mx.update(dt);
  controls.update();
  renderer.render(scene, camera);
  images++; const t = performance.now();
  if (t - t0 > 1000) { ips = (images * 1000) / (t - t0); images = 0; t0 = t;
    if (!panneau.hidden) panneau.textContent = [
      'images/s : ' + ips.toFixed(0),
      'triangles : ' + renderer.info.render.triangles.toLocaleString('fr-FR'),
      'prêt en : ' + (mesures.pret ? mesures.pret.toFixed(1) + ' s (' + (mesures.premier / 1e6).toFixed(1) + ' Mo)' : '…'),
      'tout en : ' + (mesures.complet ? mesures.complet.toFixed(1) + ' s (' + (mesures.tout / 1e6).toFixed(1) + ' Mo)' : '…'),
    ].join('\n'); }
});

demarrer().catch((e) => { texte.textContent = 'Le chargement a échoué. Rechargez la page.'; console.error(e); });
