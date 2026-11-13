// Ma Maison en Jeu : le parcours du joueur dans la Clever'hom, en 3D sur téléphone.
// Accueil → arbre → famille → style de la maison → qui dort où → aventure → fiche pour le conseiller.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const M = 'assets/models/';
const DEBUT = performance.now();
const QS = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- rendu ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// définition de rendu plafonnée : sur un grand écran d'ordinateur (retina, 4K), rendre chaque pixel physique coûte des millions
// de pixels par image ; on vise au plus ~2,3 millions de pixels, puis la qualité baisse toute seule si les images ralentissent
const PIXELS_MAX = 2.3e6; let qualite = 1;
function ratioRendu() { return Math.max(0.6, Math.min(devicePixelRatio, 2, Math.sqrt(PIXELS_MAX / (innerWidth * innerHeight))) * qualite); }
renderer.setPixelRatio(ratioRendu());
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true; // les meubles ajoutés au rez-de-chaussée sont coupés à la hauteur des murs de la vue en coupe
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#fdece3');
scene.fog = new THREE.Fog('#fdece3', 34, 70);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const ciel = new THREE.HemisphereLight('#fff0e0', '#c7b48e', 1.05); scene.add(ciel);
const soleil = new THREE.DirectionalLight('#ffdcb5', 3.1);
soleil.position.set(-12, 22, -4); soleil.target.position.set(2, 0, 3);
soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 5, maxDistance: 34, maxPolarAngle: 1.32, autoRotate: true, autoRotateSpeed: -0.6 });

// l'image suit la taille réelle de la zone 3D (et non la hauteur de fenêtre annoncée par le navigateur : avec la barre d'adresse
// flottante de Safari, les deux diffèrent et l'image se retrouvait étirée)
const zone3D = () => ({ w: canvas.clientWidth || innerWidth, h: canvas.clientHeight || innerHeight });
function taille() { const { w, h } = zone3D(); renderer.setPixelRatio(ratioRendu()); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', taille); visualViewport?.addEventListener('resize', taille); if (window.ResizeObserver) new ResizeObserver(taille).observe(canvas); taille();
// position du doigt dans la zone 3D, en coordonnées -1..1
function viserDoigt(ev) { const r = canvas.getBoundingClientRect(); souris.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); rayon.setFromCamera(souris, camera); }

// ---------- plans de caméra (position, cible, angle de champ) ----------
const PLANS = {
  accueil: { pos: [-22, 8, -6], cible: [1.0, 1.4, 3.2], fov: 46 },
  arbre: { pos: [-10.4, 6.0, -3.4], cible: [-5.6, 0.6, 1.3], fov: 50 },
  plantation: { pos: [-12.6, 3.0, -4.7], cible: [-5.6, 0.5, 0.9], fov: 46 },
  famille: { pos: [-14.3, 2.3, 3.7], cible: [-4.6, -0.35, 3.7], fov: 44 },
  salon: { pos: [-4.6, 11.8, 8.6], cible: [3.2, -0.3, 2.4], fov: 46 }, // pivot au centre du rez-de-chaussée, entre la table et la cuisine
  etage: { pos: [-16.4, 32.7, -2.6], cible: [5.2, 2.9, 1.6], fov: 25 }, // centré sur la pièce de 9 m²
  aventures: { pos: [-22, 9, -6], cible: [1.0, -3.2, 3.2], fov: 46 },
  cles: { pos: [-16, 13.5, 2.4], cible: [-4.9, -0.5, 2.4], fov: 60 }, // tout le jardin, vu depuis le fond
  noel: { pos: [-12.2, 2.3, 7.2], cible: [-6.4, 0.25, 3.1], fov: 46 },
  noelDehors: { pos: [-15, 4.0, 6.8], cible: [-2.2, 1.1, 2.0], fov: 50 },
  fete: { pos: [-3.8, 9.6, 9.8], cible: [3.4, 0.2, 3.4], fov: 52 },
  noelMaison: { pos: [10.4, 10.6, -4.5], cible: [5.0, 0.8, 2.0], fov: 48 }, // centré sur le joueur dans la maison
  fiche: { pos: [-20, 12, -8], cible: [0.5, -5.5, 3.0], fov: 46 },
  cigogne: { pos: [-15, 15, -12], cible: [3.8, 5.0, 2.85], fov: 60 },  // toute la maison et le ciel autour
  naissance: { pos: [-3.2, 6.6, 8.6], cible: [2.0, 0.4, 3.6], fov: 50 }, // le séjour, le lit au centre
};
let trajet = null; // transition douce de la caméra
function viser(nom, immediat = false) {
  const p = PLANS[nom]; const fin = { pos: new THREE.Vector3(...p.pos), cible: new THREE.Vector3(...p.cible), fov: p.fov };
  if (immediat || matchMedia('(prefers-reduced-motion: reduce)').matches) { camera.position.copy(fin.pos); controls.target.copy(fin.cible); camera.fov = fin.fov; camera.updateProjectionMatrix(); controls.update(); trajet = null; return; }
  trajet = { t: 0, de: { pos: camera.position.clone(), cible: controls.target.clone(), fov: camera.fov }, fin };
}
function avancerTrajet(dt) {
  if (!trajet) return;
  trajet.t = Math.min(1, trajet.t + dt / 1.2); const k = trajet.t < 0.5 ? 2 * trajet.t * trajet.t : 1 - Math.pow(-2 * trajet.t + 2, 2) / 2;
  camera.position.lerpVectors(trajet.de.pos, trajet.fin.pos, k); controls.target.lerpVectors(trajet.de.cible, trajet.fin.cible, k);
  camera.fov = trajet.de.fov + (trajet.fin.fov - trajet.de.fov) * k; camera.updateProjectionMatrix();
  if (trajet.t >= 1) trajet = null;
}
// la caméra est guidée pendant un trajet ; ensuite le joueur peut tourner librement
controls.addEventListener('start', () => { trajet = null; controls.autoRotate = false; $('astuce').classList.add('cache'); });

// ---------- chargement des modèles ----------
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const octets = {}; let total = 0;
function charger(nom, attendu) {
  return loader.loadAsync(M + nom + '.glb', (e) => { octets[nom] = e.loaded; if (attendu) { const fait = Object.values(octets).reduce((a, b) => a + b, 0); $('barre').style.width = Math.min(100, (100 * fait) / attendu) + '%'; } })
    .then((g) => { const ombre = !/^(interieur|etage|deco\/|noel\/)/.test(nom); g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = ombre && !m.material.transparent; m.receiveShadow = true; } }); total += octets[nom] || 0; return g; });
}
const coques = {}; const decor = {}; const arbres = {};
let dernierChargement = 0; // instant du dernier modèle ajouté (la mesure d'images/s l'ignore)

// ---------- la famille du joueur ----------
// emplacements (x, y, z, orientation) pour les personnes puis les animaux, dans chaque vue
const PLACES = {
  // jardin : deux rangs entre le cerisier (qui cache tout ce qui est en deçà de z ≈ 3,2) et la haie (z ≈ 5,6) ; les animaux devant
  exterieur: { gens: [[-4.75, -0.32, 3.55, -1.75], [-4.75, -0.32, 4.2, -1.55], [-4.75, -0.32, 4.85, -1.4], [-4.75, -0.32, 5.45, -1.3], [-4.1, -0.32, 3.85, -1.7], [-4.1, -0.32, 4.5, -1.55], [-4.1, -0.32, 5.15, -1.4], [-4.1, -0.32, 3.35, -1.8]],
    betes: [[-5.45, -0.32, 3.75, 2.27], [-5.45, -0.32, 4.45, 1.9], [-5.45, -0.32, 5.15, 2.0], [-5.95, -0.32, 4.1, 2.5], [-5.95, -0.32, 4.8, 2.6], [-5.95, -0.32, 3.5, 1.8]] },
  coupe: { gens: [[5.0, 0, 2.0, 2.36], [2.9, 0, 2.55, -1.88], [3.7, 0, 1.3, 3.0], [1.9, 0, 3.2, -1.0], [4.5, 0, 3.1, 2.8], [2.2, 0, 0.9, 0.5], [0.9, 0, 1.9, 1.2], [6.6, 0, 3.2, 2.6]],
    betes: [[1.4, 0, 3.6, 0.6], [2.6, 0, 4.1, 1.5], [0.9, 0, 2.6, 1.0], [4.0, 0, 2.4, 2.4], [2.0, 0, 1.6, 0.2], [5.5, 0, 1.5, 3.0]] },
  etage: { gens: [[3.7, 2.9, 3.3, 0.5], [3.55, 2.9, 1.3, -1.57], [4.1, 2.9, 3.25, -2.2], [2.5, 2.9, 4.7, 0.8], [3.0, 2.9, 0.5, -1.2], [4.6, 2.9, 3.4, -2.6], [0.8, 2.9, 3.0, 0.3], [2.0, 2.9, 2.2, 0]],
    betes: [[2.2, 2.9, 3.4, 0], [0.9, 2.9, 4.6, 0], [1.2, 2.9, 1.0, 0], [2.8, 2.9, 1.0, 0], [0.6, 2.9, 3.4, 0], [2.6, 2.9, 4.4, 0]] },
};
// hauteur réelle et correction d'orientation (référence : le golden retriever)
const ANIMAUX = {
  chien: { h: 0.62, r: 0, nom: 'Golden retriever' }, chien_labrador: { h: 0.62, r: Math.PI, nom: 'Labrador' },
  chien_bergerallemand: { h: 0.72, r: Math.PI / 2, nom: 'Berger allemand' }, chien_husky: { h: 0.64, r: -Math.PI / 2, nom: 'Husky' },
  chien_bordercollie: { h: 0.56, r: Math.PI, nom: 'Border collie' }, chien_beagle: { h: 0.46, r: Math.PI, nom: 'Beagle' },
  chien_jackrussell: { h: 0.36, r: Math.PI, nom: 'Jack russell' }, chien_corgi: { h: 0.34, r: -Math.PI / 2, nom: 'Corgi' },
  chat: { h: 0.3, r: Math.PI, nom: 'Chat' },
};
const modeles = {}; // avatar -> gltf (promesse)
const instances = new Map(); // id du membre -> { avatar, obj, mixer }
const mixers = new Set();
function modele(avatar) {
  if (!modeles[avatar]) modeles[avatar] = charger(ANIMAUX[avatar] ? '../animaux/' + avatar : '../avatars/' + avatar);
  return modeles[avatar];
}
let familleVisible = true;
// accueil : une famille d'exemple pour le décor (le joueur seul + un conjoint, une fillette et un golden retriever).
// Elle n'entre jamais dans les données : dès le parcours commencé, seule la vraie famille est affichée.
const VITRINE = [{ id: 'v1', avatar: 'hb6', type: 'adulte' }, { id: 'v2', avatar: 'fille1', type: 'enfant' }, { id: 'v3', avatar: 'chien', type: 'animal' }];
const familleAffichee = () => ecran === 'accueil' && etat.membres.length === 1 ? etat.membres.concat(VITRINE) : etat.membres;
async function synchroniserFamille() {
  const liste = familleAffichee(); const ids = new Set(liste.map((m) => m.id));
  for (const [id, it] of instances) if (!ids.has(id)) { scene.remove(it.obj); if (it.mixer) mixers.delete(it.mixer); instances.delete(id); }
  await Promise.all(liste.map(async (m) => {
    const it = instances.get(m.id); if (it && it.avatar === m.avatar) return;
    const g = await modele(m.avatar); if (!familleAffichee().some((x) => x.id === m.id && x.avatar === m.avatar)) return;
    const old = instances.get(m.id); if (old) { scene.remove(old.obj); if (old.mixer) mixers.delete(old.mixer); }
    let obj, mixer = null;
    if (ANIMAUX[m.avatar]) { obj = new THREE.Group(); const c = SkeletonUtils.clone(g.scene); obj.add(c); const bb = new THREE.Box3().setFromObject(c); c.scale.setScalar(ANIMAUX[m.avatar].h / (bb.max.y - bb.min.y)); c.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(c); const cc = b2.getCenter(new THREE.Vector3()); c.position.set(-cc.x, -b2.min.y, -cc.z); }
    else { obj = SkeletonUtils.clone(g.scene); if (g.animations[0]) { mixer = new THREE.AnimationMixer(obj); mixer.clipAction(g.animations[0]).play(); mixer.setTime(Math.random() * 3); } }
    obj.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; } });
    obj.updateMatrixWorld(true); const h = new THREE.Box3().setFromObject(obj).max.y;
    try { await renderer.compileAsync(obj, camera, scene); } catch (e) { /* ancien navigateur : compilation à la première image */ }
    if (!familleAffichee().some((x) => x.id === m.id && x.avatar === m.avatar)) return;
    const deja = instances.get(m.id); if (deja) { scene.remove(deja.obj); if (deja.mixer) mixers.delete(deja.mixer); }
    dernierChargement = performance.now(); if (mixer) mixers.add(mixer); scene.add(obj); instances.set(m.id, { avatar: m.avatar, obj, mixer, h });
  }));
  placerFamille();
}
function placerFamille() {
  if (feteActive || naissanceActive) return;
  const P = PLACES[VUES[vue]?.famille || 'exterieur']; let g = 0, b = 0;
  for (const m of familleAffichee()) { const it = instances.get(m.id); if (!it) continue;
    const animal = !!ANIMAUX[m.avatar]; const pl = animal ? P.betes[b++] : P.gens[g++];
    it.obj.visible = familleVisible && !!pl && !(animal && vue === 'etage');
    if (pl) { it.obj.position.set(pl[0], pl[1], pl[2]); it.obj.rotation.y = pl[3] + (animal ? ANIMAUX[m.avatar].r : 0); } }
}

// zone de la pièce de 9 m², surlignée en corail à l'étage
const zone9 = new THREE.Mesh(new THREE.PlaneGeometry(3.24, 2.61), new THREE.MeshBasicMaterial({ color: '#c4d000', transparent: true, opacity: 0.45, depthWrite: false }));
zone9.rotation.x = -Math.PI / 2; zone9.position.set(5.96, 2.94, 1.355); zone9.visible = false; scene.add(zone9);

// ---------- styles de décoration ----------
// « Moderne et épuré » : la maison telle qu'elle est. « Chaleureux et coloré » : on cache certains meubles du modèle d'intérieur,
// on pose à leur place des modèles des banques (chargés seulement à la demande) et les murs d'accent sauge passent en blanc.
// position du centre d'un objet (mise en cache), pour cacher un meuble selon l'endroit où il est
// verre légèrement teinté : la vraie transparence du modèle rendait la paroi invisible vue d'en haut
const VERRE = new THREE.MeshStandardMaterial({ color: '#d6ecf2', transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
const COUPE_RDC = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.3)]; VERRE.clippingPlanes = COUPE_RDC;
const centreDe = (m) => m.userData.centre || (m.userData.centre = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()));
const DECO = {
  // salle d'eau du bas, commune aux deux styles : douche vitrée et meuble vasque à la place de la cabine grise et du lavabo colonne
  commun: {
    cacher: (m) => /^Sink_Main/.test(m.name) || (/^Object_[2-6]$/.test(m.name) && centreDe(m).x > 4.5 && centreDe(m).z > 4.4 && centreDe(m).y < 2.5),
    poser: [
      { f: 'douche', long: 1.0, x: 5.6, y: 0.0, z: 5.2, r: 0, verre: /^Cube\.?00[1-4]/ },                     // douche vitrée (Shower, Ali_Army107), ouverture côté pièce
      { f: 'seche_serviette', haut: 1.0, x: 7.1, y: 3.12, z: 5.6, r: Math.PI, etage: true },        // sèche-serviettes (Atlant by Laris, gorun_architect) à la place du lave-linge de l'étage
      { f: 'tapis_sdb', long: 0.75, x: 6.55, y: 0.04, z: 5.05, r: 0 },            // tapis en paille (petate, ocelotlmx) entre la douche et le lavabo
      { f: 'lavabo', long: 0.75, ech: [1, 1.6, 1.5], x: 7.38, y: 0.0, z: 4.55, r: -Math.PI / 2 }, // meuble vasque et miroir rond (kimlong070809) contre le mur est
    ],
  },
  chaleureux: {
    cacher: /^(Material2_38$|Material2_8$|Material2_15$|Material2_[1-6]$|Material2_9$|Material2_1[23]$|Material2_3[4-7]$|Material2_41$|Material2_7$|Material2_24$|Stool_02_Wood_0|Flower-Vase|Phalaenopsis)/,
    poser: [
      { f: 'canape', long: 2.15, x: 0.62, y: 0.045, z: 4.08, r: Math.PI / 2 },    // canapé (Office Couch, jtressle) à la place de l'ancien, face à la table basse
      { f: 'tapis', long: 2.6, x: 1.15, y: 0.036, z: 4.25, r: Math.PI / 2 },      // tapis rouge (RUG with Bottom, gibbsluke) à la place du tapis gris
      { f: 'fauteuil', haut: 0.8, x: 1.55, y: 0.04, z: 3.05, r: 0 },         // fauteuil bois et tissu blanc (Denague) au bout de la table basse ; dossier du modèle côté -z, donc r = 0 le tourne vers la table
      { f: 'tablebasse', long: 1.05, x: 1.62, y: 0.04, z: 4.3, r: Math.PI / 2 },   // table basse ovale bois et bleu (jufernandez) à la place des tables noires
      { f: 'lampe', haut: 1.05, x: 0.35, y: 0.034, z: 5.3, r: 0 },               // lampe Margot verte (Athezza, Pyramidas) à la place du lampadaire boule blanc
      { f: 'table', long: 1.23, x: 2.05, y: 0.0, z: 1.55, r: 0 },                 // table et chaises (Table & Chair Sets, everycraft) sous la suspension
      { f: 'tulipes', haut: 0.38, x: 2.05, y: 0.745, z: 1.55, r: 0.4 },           // bouquet de tulipes (alban) au centre de la table
      { f: 'fauteuil_parents', haut: 0.8, x: 2.82, y: 2.9, z: 0.36, r: -2.42, etage: true }, // chambre parentale : fauteuil (Clotilde Ngoma, Maride) dans l'angle, tourné vers le lit
    ],
  },
};
const decoPosee = {}; let styleActif = 'moderne';
const SAUGE = [0xcf, 0xe2, 0xd2], BLANC = [0xf7, 0xf4, 0xef];
const palettes = new Map(); // texture d'origine -> version où la couleur sauge est remplacée par du blanc
function sansSauge(tex) {
  if (palettes.has(tex)) return palettes.get(tex);
  let out = null; const im = tex.image;
  if (im && im.width && im.height <= 8) { // seulement les petites palettes de couleurs unies (murs), pas les vraies textures
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height); let n = 0;
    for (let i = 0; i < d.data.length; i += 4) if (Math.abs(d.data[i] - SAUGE[0]) + Math.abs(d.data[i + 1] - SAUGE[1]) + Math.abs(d.data[i + 2] - SAUGE[2]) < 24) { d.data[i] = BLANC[0]; d.data[i + 1] = BLANC[1]; d.data[i + 2] = BLANC[2]; n++; }
    if (n) { x.putImageData(d, 0, 0); out = new THREE.CanvasTexture(c);
      for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'channel', 'generateMipmaps']) out[k] = tex[k]; out.needsUpdate = true; }
  }
  palettes.set(tex, out); return out;
}
function mursBlancs(oui) {
  for (const racine of [...Object.values(coques), ...Object.values(decor)]) racine.traverse((m) => { if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat.userData.mapOrigine === undefined) { if (!mat.map) { mat.userData.mapOrigine = null; continue; } mat.userData.mapOrigine = mat.map; }
      const o = mat.userData.mapOrigine; if (!o) continue; const b = sansSauge(o); if (!b) continue; mat.map = oui ? b : o; } });
}
const NOEL_CACHE = /^(Stool_02_Wood_0|Flower-Vase|Phalaenopsis)/;
const FETE_CACHE = /^(Material2|Flower-Vase|Phalaenopsis)/; // le salon (canapé, tapis, tables basses) laisse la place à la piste
const cache = (nom, m) => { if (nom !== 'commun' && noelActif && NOEL_CACHE.test(m.name)) return true; if (nom !== 'commun' && (feteActive || naissanceActive) && FETE_CACHE.test(m.name)) return true; const c = DECO[nom]?.cacher; return !!c && (typeof c === 'function' ? c(m) : c.test(m.name)); };
async function poserDeco(nom) {
  if (decoPosee[nom]) return decoPosee[nom]; const D = DECO[nom];
  const groupe = new THREE.Group(); decoPosee[nom] = groupe; groupe.visible = false; scene.add(groupe);
  await Promise.all(D.poser.map(async (p) => { const g = await charger('deco/' + p.f); const o = g.scene;
    const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.scale.multiplyScalar(p.haut ? p.haut / t.y : p.long / Math.max(t.x, t.z));
    if (p.ech) o.scale.multiply(new THREE.Vector3(...p.ech));
    const pivot = new THREE.Group(); pivot.add(o); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -b.min.y, -c.z); pivot.position.set(p.x, p.y, p.z); pivot.rotation.y = p.r; pivot.userData.etage = !!p.etage; pivot.userData.f = p.f;
    o.traverse((m) => { if (!m.isMesh) return; m.castShadow = false; m.receiveShadow = true; if (p.verre && p.verre.test(m.name)) m.material = VERRE; if (!p.etage) for (const mt of [].concat(m.material)) mt.clippingPlanes = COUPE_RDC; }); groupe.add(pivot); }));
  return groupe;
}
// meubles du rez-de-chaussée visibles quand l'intérieur l'est, ceux de l'étage quand l'étage l'est
function visibiliteDeco() {
  for (const [k, g] of Object.entries(decoPosee)) { g.visible = k === 'commun' || k === styleActif;
    for (const p of g.children) p.visible = (p.userData.etage ? !!decor.etage?.visible : !!decor.interieur?.visible) && !(noelActif && /^(table|tulipes)$/.test(p.userData.f)) && !((feteActive || naissanceActive) && /^(canape|tapis|fauteuil|tablebasse|lampe|tulipes)$/.test(p.userData.f)); }
}
async function appliquerStyle(nom) {
  styleActif = nom;
  for (const [k, racine] of [['interieur', decor.interieur], ['etage', decor.etage]]) if (racine) racine.traverse((m) => { if (m.isMesh) m.visible = !cache('commun', m) && !cache(nom, m); });
  mursBlancs(nom === 'chaleureux'); visibiliteDeco();
  if (DECO[nom]) { await poserDeco(nom); visibiliteDeco(); }
}

// ---------- l'aventure de Noël ----------
// une boule à toucher dans le jardin ; au toucher : confettis, puis toute la maison se pare de Noël (modèles Sketchfab CC BY, chargés à la demande)
const NOEL = [
  // intérieur
  { f: 'sapin', haut: 2.0, p: [[0.62, 0.034, 0.62, 0.3]] },                                    // sapin décoré dans l'angle de la baie
  { f: 'cadeaux2', haut: 0.55, p: [[1.35, 0.034, 0.45, 0.5]] },                                 // pile de cadeaux au pied du sapin
  { f: 'diner', long: 1.9, p: [[2.05, 0.034, 1.55, 0]] },                                       // table du réveillon à la place de la table
  // façade côté jardin
  { f: 'couronne', long: 1.7, p: [[-0.36, 2.15, 2.1, -Math.PI / 2]], facade: true },                          // guirlande de sapin et boules au-dessus de la baie
  { f: 'panneau', long: 2.4, p: [[-0.36, 2.8, 2.1, -Math.PI / 2]], brille: '#ff3b30', facade: true },       // « Merry Christmas » lumineux
  // jardin
  { f: 'sapin_neige', haut: 2.6, p: [[-9.4, -0.32, -0.8, 0.4], [-10.6, -0.32, 1.6, 1.3]] },
  { f: 'traineau', long: 1.7, p: [[-7.7, -0.32, 4.85, Math.PI / 2]] },
  { f: 'cadeaux1', long: 0.9, p: [[-6.8, -0.32, 5.3, 0.3]] },
  { f: 'village', long: 0.55, p: [[-2.0, 0.77, 2.7, 0.5]] },                                  // village de Noël sur la table de la terrasse
  { f: 'boule_deco', haut: 0.55, p: [[-6.3, -0.32, 2.6, 0], [-6.9, -0.32, 3.3, 1], [-3.5, -0.32, 0.4, 2]] },
  { f: 'sucres', haut: 0.6, p: [[-3.1, -0.32, 0.9, 0], [-3.1, -0.32, 2.1, 0], [-3.1, -0.32, 6.6, 0], [-3.1, -0.32, -0.3, 0]] },
  { f: 'bonhomme1', haut: 1.3, p: [[-7.0, -0.32, 3.7, -2.76], [-3.7, -0.32, 6.4, -2.4]] },        // bonshommes de neige (LeionaChung, bojackart)
  { f: 'bonhomme2', haut: 1.0, p: [[-8.3, -0.32, 2.2, -1.19], [-4.6, -0.32, -2.5, -1.6]] },
  { f: 'guirlande', long: 0.9, p: [-9.3, -8.3, -7.3, -6.3, -5.3, -4.3].map((x) => [x, 1.15, 5.8, Math.PI / 2]), brille: true },
];
const noel = { groupe: null, charge: null, boule: null, fait: false, dedans: false, pops: [] };
// dehors : façade et jardin ; dedans : vue en coupe du rez-de-chaussée (les décos de façade, hors de la coupe, sont alors cachées)
function vueNoel(dedans) { noel.dedans = dedans; montrer(dedans ? 'coupe' : 'exterieur', true); viser(dedans ? 'noelMaison' : 'noelDehors');
  if (noel.groupe) for (const p of noel.groupe.children) if (p.userData.facade) p.visible = !dedans; }
// flocon rond et flou, dessiné une fois
function texFlocon() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
// neige au sol : un voile blanc irrégulier posé sur la pelouse (la terrasse, plus haute, reste en bois)
function texSol() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${200 + Math.random() * 30},${215 + Math.random() * 25},${235 + Math.random() * 20},${Math.random() * 0.35})`; const r = 2 + Math.random() * 10; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, r, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; return t; }
const FLOCONS = 3200, ZONE = { x0: -16, x1: 10, y0: -0.3, y1: 9, z0: -7, z1: 11 };
function creerNeige() {
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(ZONE.x1 - ZONE.x0, ZONE.z1 - ZONE.z0), new THREE.MeshStandardMaterial({ map: texSol(), roughness: 0.95, transparent: true, opacity: 0.88, depthWrite: false }));
  sol.rotation.x = -Math.PI / 2; sol.position.set((ZONE.x0 + ZONE.x1) / 2, -0.305, (ZONE.z0 + ZONE.z1) / 2); sol.receiveShadow = true; sol.renderOrder = 1;
  const pos = new Float32Array(FLOCONS * 3), vit = new Float32Array(FLOCONS);
  for (let i = 0; i < FLOCONS; i++) { pos[i * 3] = ZONE.x0 + Math.random() * (ZONE.x1 - ZONE.x0); pos[i * 3 + 1] = ZONE.y0 + Math.random() * (ZONE.y1 - ZONE.y0); pos[i * 3 + 2] = ZONE.z0 + Math.random() * (ZONE.z1 - ZONE.z0); vit[i] = 0.5 + Math.random() * 0.7; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flocons = new THREE.Points(geo, new THREE.PointsMaterial({ map: texFlocon(), size: 0.16, transparent: true, depthWrite: false, opacity: 0.95 }));
  flocons.userData.vit = vit; flocons.frustumCulled = false; noel.flocons = flocons; noel.sol = sol;
  noel.groupe.add(sol, flocons);
}
function chargerNoel() {
  if (noel.charge) return noel.charge;
  noel.groupe = new THREE.Group(); noel.groupe.visible = false; scene.add(noel.groupe); creerNeige();
  noel.charge = Promise.all(NOEL.map(async (d) => { const g = await charger('noel/' + d.f);
    for (const [x, y, z, r] of d.p) { const o = g.scene.clone(true); const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      o.scale.multiplyScalar(d.haut ? d.haut / t.y : d.long / Math.max(t.x, t.z)); o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
      const pivot = new THREE.Group(); pivot.add(o); pivot.position.set(x, y, z); pivot.rotation.y = r || 0; pivot.userData.facade = !!d.facade;
      o.traverse((m) => { if (!m.isMesh) return; m.castShadow = /^(sapin|bonhomme|traineau)/.test(d.f); m.receiveShadow = true;
        if (d.brille) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(typeof d.brille === 'string' ? d.brille : '#ffffff'); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 1.4; } });
      noel.groupe.add(pivot); } }));
  return noel.charge;
}
function montrerBoule() {
  if (noel.boule) { noel.boule.visible = ecran === 'noel' && !noel.fait; return; }
  if (noel.bouleCharge) return; noel.bouleCharge = true;
  charger('noel/boule').then((g) => { const o = g.scene; const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.scale.multiplyScalar(0.55 / t.y);
    o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const pivot = new THREE.Group(); pivot.add(o); pivot.position.set(-7.2, -0.32, 3.4); o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    noel.boule = pivot; pivot.visible = ecran === 'noel' && !noel.fait; scene.add(pivot); });
}
let noelActif = false;
function cacherNoel() { if (livres) livres.visible = true; if (noel.groupe) noel.groupe.visible = false; if (noel.boule) noel.boule.visible = false; noel.fait = false; noelActif = false; appliquerStyle(styleActif); }
async function ouvrirBoule() {
  if (noel.fait) return; noel.fait = true; confettis();
  if (noel.boule) noel.boule.visible = false;
  dessiner(); await chargerNoel();
  noelActif = true; if (livres) livres.visible = false; noel.dedans = false; appliquerStyle(styleActif); montrer('exterieur', true); viser('noelDehors');
  noel.groupe.visible = true; const objets = noel.groupe.children.filter((p) => p !== noel.sol && p !== noel.flocons);
  noel.pops = objets.map((p, i) => ({ p, t: -i * 0.07 })); for (const p of objets) p.scale.setScalar(0.001);
  dessiner();
}
function avancerNoel(dt) {
  if (noel.boule && noel.boule.visible) { noel.boule.rotation.y += dt * 0.8; noel.boule.position.y = -0.32 + 0.06 + Math.sin(performance.now() / 400) * 0.05; }
  if (noel.flocons && noel.groupe.visible) { const a = noel.flocons.geometry.attributes.position, v = noel.flocons.userData.vit, t = performance.now() / 1000;
    for (let i = 0; i < FLOCONS; i++) { let y = a.array[i * 3 + 1] - v[i] * dt; a.array[i * 3] += Math.sin(t + i) * 0.15 * dt; if (y < ZONE.y0) y = ZONE.y1; a.array[i * 3 + 1] = y; }
    a.needsUpdate = true; }
  if (!noel.pops.length) return;
  for (const q of noel.pops) { q.t += dt; const k = Math.min(1, Math.max(0, q.t / 0.5)); const e = k < 1 ? 1 - Math.pow(1 - k, 3) * Math.cos(k * 6) : 1; q.p.scale.setScalar(Math.max(0.001, e)); }
  noel.pops = noel.pops.filter((q) => q.t < 0.5);
}
// confettis : petite animation sur un canvas posé au-dessus de la scène
function confettis() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confettis'; document.body.appendChild(c); const x = c.getContext('2d');
  const W = c.width = innerWidth * devicePixelRatio, H = c.height = innerHeight * devicePixelRatio;
  const COUL = ['#c4d000', '#c4d000', '#e6ec7a', '#f4c542', '#d6382f', '#ffffff', '#2f8f4e'];
  const P = Array.from({ length: 180 }, () => ({ x: W / 2, y: H * 0.45, vx: (Math.random() - 0.5) * W * 0.035, vy: -Math.random() * H * 0.03 - H * 0.008, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: (6 + Math.random() * 6) * devicePixelRatio, h: (3 + Math.random() * 4) * devicePixelRatio, c: COUL[(Math.random() * COUL.length) | 0] }));
  const t0 = performance.now();
  (function pas() { const t = (performance.now() - t0) / 1000; x.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += H * 0.0009; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2)); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); }
    if (t < 3) requestAnimationFrame(pas); else c.remove(); })();
}
// toucher la boule dans la scène
const rayon = new THREE.Raycaster(), souris = new THREE.Vector2();
canvas.addEventListener('pointerup', (ev) => {
  if (ecran !== 'noel' || noel.fait || !noel.boule) return;
  viserDoigt(ev);
  if (rayon.intersectObject(noel.boule, true).length) ouvrirBoule();
});

// ---------- jardin : chaise longue sur la pelouse, jacinthe sur la terrasse (à la place du fauteuil suspendu) ----------
const JARDIN = [
  { f: 'chaise_jardin', long: 1.95, p: [-3.05, -0.32, -1.3, -Math.PI / 2] },  // Garden Chair (Medhatelo) : dossier vers la maison, pieds vers le jardin
  { f: 'jacinthe', haut: 0.55, p: [-2.25, 0.0, 3.85, 0] },                    // Hyacinth (scadl)
  { f: 'livres', haut: 0.22, p: [-3.15, -0.32, -0.55, 0.5] },                  // pile de livres (Book pile) au pied de la chaise longue, côté terrasse
  // mobilier de terrasse comme la maison témoin : table en bois et six chaises en résine anthracite ; salon tressé chez le voisin
  { f: 'table_jardin', long: 2.2, p: [-2.0, -0.12, 2.7, Math.PI / 2] },        // Wooden Dining Table Set (aziseptian_), chaises teintées
  { f: 'salon_jardin', long: 2.7, p: [-1.85, -0.12, 11.4, -Math.PI / 2] },     // COMPLETE PATIO SET (shirlanne), sans la console
];
// massif planté au pied du mur de côté (là où était le garage) et de celui de la maison voisine :
// un motif de trois espèces répété (boule de buis, ixora rouge, lupin à épis jaunes), plantées en quinconce
// sur deux rangs, sur une bande de paillage. Chaque espèce est dessinée en une seule fois (instanciation).
const MASSIF = { buis: 0.55, ixora: 0.5, lupin: 0.72 }; // hauteurs en mètres
const MOTIF = ['buis', 'ixora', 'lupin'];
const BANDES = [{ x0: -0.15, x1: 7.75, zMur: -0.3, sens: -1 }, { x0: -0.15, x1: 7.75, zMur: 2 * (5.67 + 0.15) + 0.3 + 2.6, sens: 1 }];
function compositionMassif() {
  let graine = 7; const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const P = [], pas = 0.55;
  for (const b of BANDES) {
    const n = Math.floor((b.x1 - b.x0 - 0.5) / pas) + 1, x0 = (b.x0 + b.x1) / 2 - ((n - 1) * pas) / 2;
    for (let i = 0; i < n; i++) P.push({ e: MOTIF[i % 3], x: x0 + i * pas, z: b.zMur + b.sens * (i % 2 ? 0.8 : 0.38) }); // quinconce : un rang sur deux
  }
  return P.map((p) => ({ ...p, r: alea() * Math.PI * 2, s: 0.92 + alea() * 0.16 }));
}
async function poserMassif() {
  // paillage brun foncé et bordure grise
  const paillage = new THREE.MeshStandardMaterial({ color: '#4a3528', roughness: 1 }), bordure = new THREE.MeshStandardMaterial({ color: '#9a9690', roughness: 0.9 });
  for (const b of BANDES) { const zA = b.zMur, zB = b.zMur + b.sens * 1.15, zc = (zA + zB) / 2, L = b.x1 - b.x0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, 0.03, 1.15), paillage); m.position.set((b.x0 + b.x1) / 2, -0.315, zc); m.receiveShadow = true; scene.add(m);
    const e = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.06), bordure); e.position.set((b.x0 + b.x1) / 2, -0.3, zB); e.receiveShadow = true; scene.add(e); }
  const P = compositionMassif();
  await Promise.all(Object.keys(MASSIF).map(async (esp) => { const g = await charger('deco/massif_' + esp); const L = P.filter((p) => p.e === esp); if (!L.length) return;
    const racine = g.scene; racine.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(racine, true), t = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const norm = new THREE.Matrix4().makeScale(MASSIF[esp] / t.y, MASSIF[esp] / t.y, MASSIF[esp] / t.y).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    const place = L.map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, -0.3, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.r), new THREE.Vector3(p.s, p.s, p.s)));
    racine.traverse((m) => { if (!m.isMesh) return; const mat = m.material.clone(); if (mat.transparent) { mat.transparent = false; mat.alphaTest = 0.4; mat.depthWrite = true; } mat.side = THREE.DoubleSide;
      const im = new THREE.InstancedMesh(m.geometry, mat, L.length); const base = new THREE.Matrix4().multiplyMatrices(norm, m.matrixWorld);
      place.forEach((pm, i) => im.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(pm, base))); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true; scene.add(im); }); }));
}
let livres = null; // cachés pendant Noël
const jardinPivots = {}; // premier exemplaire de chaque objet du jardin (cachettes de la chasse aux clés)
// le modèle du jardin : on retire l'ancien salon de jardin (chaises pliantes, parasol) et on fait courir la haie entre les deux maisons,
// du volume en bois jusqu'à la clôture du fond (elle était à la limite de l'ancienne maison jumelle)
function amenagerJardin(j) {
  const haie = [];
  j.traverse((m) => { if (!m.isMesh) return; if (/^(Chair1_|model_tex_u1|CoffeeMug|Patio_Umbrella)/.test(m.name)) m.visible = false; if (/hedge/.test(m.name)) haie.push(m); });
  const g = new THREE.Group(); j.add(g); for (const m of haie) g.attach(m);
  g.position.z += 1.3; // milieu de l'écart entre les deux maisons
  const suite = new THREE.Group(); suite.position.set(3.2, 0, 0.015); g.add(suite); // second tronçon jusqu'au volume en bois
  for (const m of haie) if (!/GRAY/.test(m.name)) suite.add(m.clone());
}
function poserJardin() {
  const modeles = {}; for (const d of JARDIN) (modeles[d.f] ||= charger('deco/' + d.f)).then((g) => { const o = g.scene.clone(true); const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    o.scale.multiplyScalar(d.haut ? d.haut / t.y : d.long / Math.max(t.x, t.z)); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const pivot = new THREE.Group(); pivot.add(o); pivot.position.set(d.p[0], d.p[1], d.p[2]); pivot.rotation.y = d.p[3]; if (d.f === 'livres') livres = pivot; jardinPivots[d.f] ||= pivot; enregistrer(d.f, NOMS_JARDIN[d.f] || d.f, pivot);
    o.traverse((m) => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
      if (m.material.transparent) { m.material.transparent = false; m.material.alphaTest = 0.25; m.material.depthWrite = true; } }); scene.add(pivot); });
}

// ---------- la pièce de 9 m² : une déco par usage ----------
// bureau : le mobilier d'origine du modèle de l'étage (nœuds « bureau__… ») et une bibliothèque ; bébé et sport : à venir
const PIECES = {
  bureau: { garder: /^bureau__/, poser: [{ f: 'bibliotheque', long: 1.45, ech: [1, 1, 0.45], x: 7.33, y: 2.9, z: 0.95, r: -Math.PI / 2 }] },   // Metal frame bookcase (boglarka4)
  bebe: { garder: null, poser: [
    { f: 'bebe_lit', long: 1.25, x: 6.25, y: 2.9, z: 2.24, r: 0, etage: true },                         // Baby Bed (bkarc), contre le mur du fond
    { f: 'bebe_armoire', haut: 1.75, x: 6.9, y: 2.9, z: 0.32, r: 0, etage: true },             // baby boy closet (pinabinicartoons)
    { f: 'bebe_chaise', haut: 0.95, x: 4.95, y: 2.9, z: 0.55, r: 0.5, etage: true },                     // Baby's Highchair (Anastengp)
    { f: 'bebe_pack', long: 0.7, x: 5.55, y: 2.9, z: 1.55, r: 1.2, etage: true },                       // Baby Pack (liebherr996litronic) : couches, peluches, cubes
    { f: 'bebe_draisienne', long: 0.55, x: 6.1, y: 2.9, z: 0.95, r: 0.7, etage: true },                  // XJD Baby Balance Bike (1021.akshays)
  ] },
  sport: { garder: null, poser: [
    { f: 'sport_presse', long: 1.9, x: 6.2, y: 2.9, z: 2.0, r: 0, etage: true },                        // Leg Press Machine (silentsheri), le long du mur du fond
    { f: 'sport_papillon', haut: 1.95, x: 7.15, y: 2.9, z: 0.6, r: Math.PI / 2, etage: true },           // Butterfly Machine (Chenchanchong), face à la pièce
    { f: 'sport_disque', long: 0.4, x: 5.3, y: 2.9, z: 1.1, r: 0, etage: true },                         // Balance Disc (Sahil_3D)
    { f: 'sport_barre', long: 0.45, x: 5.7, y: 2.9, z: 0.35, r: 0.3, etage: true },                      // haltère (Average3DmodelEnjoyer)
    { f: 'sport_haltere', long: 0.33, x: 6.1, y: 2.9, z: 0.45, r: -0.4, etage: true },                   // Dumble (Sahil_3D)
    { f: 'sport_kettlebell', haut: 0.28, x: 4.75, y: 2.9, z: 0.4, r: 0.6, etage: true },                 // Spart Weight (Sahil_3D)
    { f: 'sport_serviettes', long: 0.45, x: 4.7, y: 2.9, z: 2.3, r: 0, etage: true },                    // Towel (Chenchanchong)
  ] },
};
const piecePosee = {};
const PIECE9 = { x0: 4.34, x1: 7.58, z0: 0.05, z1: 2.66, y0: 2.9, y1: Number(QS.get('mur') || 4.2) };
function mursPiece(couleur) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const { x0, x1, z0, z1, y0, y1 } = PIECE9, h = y1 - y0, e = 0.012;
  for (const [w, x, z, r] of [[x1 - x0, (x0 + x1) / 2, z0 + e, 0], [x1 - x0, (x0 + x1) / 2, z1 - e, 0], [z1 - z0, x0 + e, (z0 + z1) / 2, Math.PI / 2], [z1 - z0, x1 - e, (z0 + z1) / 2, Math.PI / 2]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); pl.position.set(x, y0 + h / 2, z); pl.rotation.y = r; pl.receiveShadow = true; g.add(pl); }
  return g;
}
async function amenagerPiece(id) {
  const P = PIECES[id] || PIECES.bureau;
  if (decor.etage) decor.etage.traverse((m) => { if (m.isMesh && /^bureau__/.test(m.name)) m.visible = !!P.garder && P.garder.test(m.name); });
  for (const [k, g] of Object.entries(piecePosee)) g.visible = k === id && !!decor.etage?.visible;
  if (piecePosee[id] || (!P.poser.length && !P.murs)) return;
  const groupe = new THREE.Group(); piecePosee[id] = groupe; scene.add(groupe); if (P.murs) groupe.add(mursPiece(P.murs));
  await Promise.all(P.poser.map(async (p) => { const g = await charger('deco/' + p.f); const o = g.scene;
    const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.scale.multiplyScalar(p.haut ? p.haut / t.y : p.long / Math.max(t.x, t.z)); if (p.ech) o.scale.multiply(new THREE.Vector3(...p.ech));
    const pivot = new THREE.Group(); pivot.add(o); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -b.min.y, -c.z); pivot.position.set(p.x, p.y, p.z); pivot.rotation.y = p.r; groupe.add(pivot); }));
  groupe.visible = (etat.piece || 'bureau') === id && !!decor.etage?.visible;
}

// ---------- l'aventure de la crémaillère ----------
// tous les personnages du jeu arrivent par la porte d'entrée à la queue leu leu, puis dansent dans le salon devenu piste
let feteActive = false, naissanceActive = false;
const FETE = [
  { f: 'piste', long: 2.5, p: [[1.55, 0.02, 4.2, 0]] },                                 // Animated Dance Floor (wwwuengy)
  { f: 'boule', haut: 1.0, p: [[1.55, 1.75, 4.2, 0]] },                                  // Animated Disco Ball (GrafilArtwork), suspendue au-dessus de la piste
  { f: 'guirlande', long: 3.0, p: [[1.55, 2.25, 3.05, 0], [1.55, 2.25, 4.2, 0], [1.55, 2.25, 5.4, 0]], brille: '#ffe9a8' }, // Simple String Lights (TrixtheProtogen)
  { f: 'spot', haut: 0.5, p: [[0.25, 0.0, 2.95, 0], [2.95, 0.0, 5.5, 0]], vise: [1.55, 2.2, 4.2] }, // BEAM LIGHT (eventdesignws), braqués sur la boule
  { f: 'enceinte', long: 0.55, p: [[2.85, 0.0, 3.1, -2.3]] },                            // Bluetooth music boombox (dani-satellite)
  // buffet sur la table à manger
  { f: 'gateau', precis: true, table: true, haut: 0.32, p: [[1.85, 0.745, 1.45, 0]] },                              // Strawberry Cake (strawbie133)
  { f: 'pizza', precis: true, table: true, long: 0.42, p: [[2.35, 0.745, 1.85, 2.6]] },                             // Pizza and pizza box (AMMediaGames)
];
const DISCO = ['#ff7ac4', '#7ad0ff', '#d8ff7a'].map((c) => new THREE.Color(c));
const fete = { calques: [], volume: 1, son: null, pluie: null, groupe: null, charge: null, invites: [], mixers: [], clips: {}, lumieres: [], t: 0, faite: false };
const SEXE = (a) => /^(f|fb|fs|fille)/.test(a) ? 'f' : 'm';
const ENFANT = (a) => /^(fille|garcon)/.test(a);
async function clipFete(nom, enfant) {
  const cle = nom + (enfant ? '_e' : '');
  return (fete.clips[cle] ||= fetch('assets/anims/' + nom + '.json').then((r) => r.json()).then((j) => { let c = THREE.AnimationClip.parse(j); c.userData = { vitesse: j.vitesse };
    // les enfants ont un squelette « Bip02 » : rotations seulement, pistes renommées
    if (enfant) { c = c.clone(); c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => { const k = t.clone(); k.name = k.name.replace(/^Bip01/, 'Bip02'); return k; }); c.userData = { vitesse: j.vitesse }; }
    return c; }));
}
function chargerFete() {
  if (fete.charge) return fete.charge;
  fete.groupe = new THREE.Group(); fete.groupe.visible = false; scene.add(fete.groupe);
  fete.charge = Promise.all(FETE.map(async (d) => { const g = await charger('fete/' + d.f);
    for (const [x, y, z, r] of d.p) { const o = SkeletonUtils.clone(g.scene); const t = new THREE.Box3().setFromObject(o, !!d.precis).getSize(new THREE.Vector3());
      o.scale.multiplyScalar(d.haut ? d.haut / t.y : d.long / Math.max(t.x, t.z)); o.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(o, !!d.precis), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
      const pivot = new THREE.Group(); pivot.add(o); pivot.position.set(x, y, z); pivot.rotation.y = r; pivot.userData.table = d.table;
      if (d.vise) { // le faisceau du modèle part vers +x/+y : on l'oriente vers la boule
        const dir = new THREE.Vector3(...d.vise).sub(pivot.position).normalize(); pivot.quaternion.setFromUnitVectors(new THREE.Vector3(1, 1, 0).normalize(), dir); }
      o.traverse((m) => { if (!m.isMesh) return; m.castShadow = false; m.frustumCulled = false; if (d.brille) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(d.brille); m.material.emissiveIntensity = 0.9; } });
      if (g.animations.length) { const mx = new THREE.AnimationMixer(o); for (const a of g.animations) mx.clipAction(a).play(); fete.mixers.push(mx);
        // calques qui s'allument par changement d'échelle : un calque éteint (échelle nulle) n'est plus dessiné du tout
        for (const a of g.animations) for (const t of a.tracks) if (t.name.endsWith('.scale')) { const n = o.getObjectByName(THREE.PropertyBinding.parseTrackName(t.name).nodeName); if (n) fete.calques.push(n); } }
      fete.groupe.add(pivot); } }));
  // deux lumières de couleur qui tournent autour de la boule
  fete.pluie = creerPluie(); fete.groupe.add(fete.pluie);
  return fete.charge;
}
// pluie de confettis au-dessus de la piste : petits carrés colorés qui tombent en virevoltant
function creerPluie() {
  const N = 400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vit = new Float32Array(N); const C = ['#c4d000', '#ff3ea5', '#3ec8ff', '#f4c542', '#ffffff', '#ff7a3e'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) { pos.set([0.3 + Math.random() * 2.5, Math.random() * 2.6, 2.95 + Math.random() * 2.5], i * 3); C[i % C.length].toArray(col, i * 3); vit[i] = 0.35 + Math.random() * 0.4; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.045, vertexColors: true })); p.userData.vit = vit; p.frustumCulled = false; return p;
}
// musique de fête jouée par le navigateur (Web Audio) : grosse caisse, charleston, basse et accords, sans fichier à télécharger
const musique = { ctx: null, on: false, prochain: 0, pas: 0, tempo: 118, gain: null };
function demarrerMusique() {
  if (!musique.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; musique.ctx = new AC(); musique.gain = musique.ctx.createGain(); musique.gain.gain.value = 0.35; musique.gain.connect(musique.ctx.destination); }
  musique.ctx.resume(); musique.on = true; musique.prochain = musique.ctx.currentTime + 0.05;
}
function arreterMusique() { musique.on = false; musique.ctx?.suspend(); }
function note(t, freq, dur, type, vol, glisse) { const c = musique.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(musique.gain); o.start(t); o.stop(t + dur + 0.02); }
function charleston(t, vol) { const c = musique.ctx, n = c.sampleRate * 0.05, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(musique.gain); s.start(t); }
const BASSE = [55, 55, 82.4, 55, 73.4, 73.4, 61.7, 82.4], ACCORDS = [[220, 277, 330], [220, 277, 330], [196, 247, 294], [208, 262, 311]];
function avancerMusique() {
  if (!musique.on || !musique.ctx) return; const c = musique.ctx, croche = 60 / (musique.tempo * fete.volume) / 2;
  while (musique.prochain < c.currentTime + 0.2) { const t = musique.prochain, k = musique.pas % 16;
    if (k % 2 === 0) note(t, 150, 0.18, 'sine', 0.9, 45);                                  // grosse caisse sur chaque temps
    if (k % 2 === 1) charleston(t, 0.25);                                                    // charleston à contretemps
    if (k % 4 === 2) charleston(t, 0.12);
    note(t, BASSE[(k >> 1) % 8], croche * 0.9, 'sawtooth', 0.12);                            // basse en croches
    if (k % 8 === 4) for (const f of ACCORDS[(musique.pas >> 4) % 4]) note(t, f, croche * 1.6, 'square', 0.03); // accords
    musique.prochain += croche; musique.pas++; }
}
// toucher un invité : il applaudit ou lève les bras, puis reprend la danse
async function feter(v) {
  if (v.occupe || !v.dansant) return; v.occupe = true; const e = ENFANT(v.avatar), c = await clipFete(SEXE(v.avatar) + (Math.random() < 0.5 ? '_claphands_01' : '_cheer_01'), e);
  const a = v.mx.clipAction(c); a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); v.mx.clipAction(v.danse).crossFadeTo(a, 0.25, false);
  setTimeout(() => { a.crossFadeTo(danser(v.mx, v.danse), 0.4, false); v.occupe = false; }, Math.min(3500, c.duration * 1000));
}
canvas.addEventListener('pointerup', (ev) => {
  if (ecran !== 'fete' || !fete.invites.length) return;
  viserDoigt(ev);
  const h = rayon.intersectObjects(fete.invites.map((v) => v.o), true)[0]; if (!h) return;
  const v = fete.invites.find((x) => { let o = h.object; while (o) { if (o === x.o) return true; o = o.parent; } return false; }); if (v) feter(v);
});
function monterLeSon() { fete.volume = fete.volume > 1 ? 1 : 1.45; for (const v of fete.invites) v.mx.timeScale = fete.volume; for (const m of fete.mixers) m.timeScale = fete.volume;
  for (const it of instances.values()) if (it.mixer) it.mixer.timeScale = fete.volume; if (fete.pluie) fete.pluie.visible = true; }
// emplacements de danse : en cercles autour du centre de la piste
// tout le monde danse la même chorégraphie, calée sur le premier danseur
function danser(mx, clip) { const a = mx.clipAction(clip); a.reset(); if (fete.ref) a.time = fete.ref.time % clip.duration; a.play(); if (!fete.ref) fete.ref = a; return a; }
const SUR_PISTE = (p) => p.x > 0.3 && p.x < 2.8 && p.z > 2.95 && p.z < 5.45;
const INVITES_MAX = 8;
function placeDanse(i) { const cx = 1.55, cz = 4.2; if (i === 0) return [cx, cz]; const anneau = i <= 6 ? 0.75 : 1.35, n = i <= 6 ? 6 : 12, k = i <= 6 ? i - 1 : i - 7, a = (k / n) * Math.PI * 2 + (anneau > 1 ? 0.26 : 0);
  return [cx + Math.cos(a) * anneau, cz + Math.sin(a) * anneau * 0.95]; }
const CHEMIN = [[11.5, -0.3, 3.45], [8.3, -0.3, 3.45], [7.3, 0, 3.45], [4.6, 0, 2.85], [3.1, 0, 2.95]];
const DANSES = { f: ['f_dancing_cool', 'f_dancing_silly', 'f_dancing_affective'], m: ['m_dancing_cool', 'm_dancing_silly', 'm_dancing_aggressive'] };
async function lancerFete() {
  if (fete.faite) return; fete.faite = true; feteActive = true; confettis(); demarrerMusique();
  // le buffet se pose sur la table du style choisi (table chaleureuse plus basse que la table moderne)
  fete.charge?.then(() => { for (const q of fete.groupe.children) if (q.userData.table) q.position.y = etat.style === 'chaleureux' ? 0.745 : 0.962; });
  montrer('coupe', false); viser('fete'); fete.pret = false; dessiner(); // la caméra part tout de suite vers le salon pendant le chargement
  await chargerFete(); if (!fete.faite) return;
  try { fete.groupe.visible = true; await renderer.compileAsync(fete.groupe, camera, scene); } catch (e) { /* compilation à la première image */ }
  if (!fete.faite) return; appliquerStyle(styleActif); visibiliteDeco(); fete.pret = true; dessiner();
  // pendant la fête, les ombres de la maison sont calculées une fois puis figées (rien ne bouge à part les danseurs, qui n'en projettent pas)
  for (const it of instances.values()) it.obj.traverse((x) => { if (x.isMesh) x.castShadow = false; });
  soleil.shadow.autoUpdate = false; soleil.shadow.needsUpdate = true;
  soleil.intensity = 1.2; scene.environmentIntensity = 0.35; // ambiance de soirée
  // la famille du joueur danse déjà au centre
  let n = 0;
  for (const m of etat.membres) { const it = instances.get(m.id); if (!it) continue; const [x, z] = placeDanse(n++); it.obj.visible = true; it.obj.position.set(x, 0, z); it.obj.lookAt(1.55, 0, 4.2);
    if (it.mixer && !ANIMAUX[m.avatar]) { const c = await clipFete(DANSES[SEXE(m.avatar)][0], ENFANT(m.avatar)); it.mixer.stopAllAction(); danser(it.mixer, c); } }
  // les invités : tous les autres personnages, qui entrent l'un après l'autre
  const deja = new Set(etat.membres.map((m) => baseAvatar(m.avatar)));
  // 8 invités au plus, panachés : femmes, hommes, seniors et enfants à tour de rôle
  const libres = (L) => (L || []).filter((a) => !deja.has(a));
  const files = [libres(CATALOGUE.adulte).filter((a) => SEXE(a) === 'f'), libres(CATALOGUE.adulte).filter((a) => SEXE(a) === 'm'), libres(CATALOGUE.senior), libres(CATALOGUE.enfant)];
  const tous = []; for (let k = 0; tous.length < INVITES_MAX && files.some((f) => f.length); k++) { const f = files[k % files.length]; if (f.length) tous.push(f.shift()); }
  // chargés l'un après l'autre (le téléphone décode une seule personne à la fois), version légère, compilés avant d'entrer
  const t0 = fete.t, tour = fete.tour = (fete.tour || 0) + 1, encore = () => fete.faite && fete.tour === tour;
  for (const [i, a] of tous.entries()) { if (!encore()) return;
    const g = await charger('../avatars/leger/' + a); const o = SkeletonUtils.clone(g.scene); o.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.frustumCulled = false; } });
    const mx = new THREE.AnimationMixer(o), marche = await clipFete(SEXE(a) + '_walk_neutral_01', ENFANT(a)), danse = await clipFete(DANSES[SEXE(a)][0], ENFANT(a));
    const am = mx.clipAction(marche); am.play(); o.position.set(...CHEMIN[0]);
    try { await renderer.compileAsync(o, camera, scene); } catch (e) { /* compilation à la première image */ }
    if (!encore()) return; o.visible = false; fete.groupe.add(o);
    const v = { avatar: a, o, mx, am, danse, depart: Math.max(fete.t, t0 + i * 1.1), seg: 0, but: placeDanse(n + i), vitesse: (ENFANT(a) ? 0.9 : 1.15) }; fete.invites.push(v); }
}
function avancerFete(dt) {
  if (!feteActive) return; fete.t += dt; avancerMusique();
  if (fete.pluie) { const a = fete.pluie.geometry.attributes.position, v = fete.pluie.userData.vit; for (let i = 0; i < v.length; i++) { let y = a.array[i * 3 + 1] - v[i] * dt * fete.volume; a.array[i * 3] += Math.sin(fete.t * 3 + i) * 0.004; if (y < 0.02) y = 2.6; a.array[i * 3 + 1] = y; } a.needsUpdate = true; }
  for (const mx of fete.mixers) mx.update(dt);
  for (const n of fete.calques) n.visible = n.scale.x > 0.01 && n.scale.y > 0.01;
  // ambiance disco sans lumière supplémentaire : la lumière du ciel change de couleur (rose, bleu, vert), plus vite quand on monte le son
  { const k = (fete.t * (fete.volume > 1 ? 2.4 : 0.8)) % 3, i = Math.floor(k), f = k - i; ciel.color.copy(DISCO[i]).lerp(DISCO[(i + 1) % 3], f); }
  for (const v of fete.invites) { v.mx.update(dt); if (fete.t < v.depart) continue; v.o.visible = true; if (v.fini) continue;
    const pts = CHEMIN.concat([[v.but[0], 0, v.but[1]]]); const cible = new THREE.Vector3(...pts[v.seg + 1]);
    const d = cible.clone().sub(v.o.position);
    // dès qu'il pose le pied sur la piste, l'invité se met à danser, puis rejoint sa place en douceur
    if (!v.dansant && v.seg >= CHEMIN.length - 1 && SUR_PISTE(v.o.position)) { v.dansant = true; v.am.crossFadeTo(danser(v.mx, v.danse), 0.3, false); }
    const pas = (v.dansant ? 0.45 : v.vitesse) * dt;
    if (d.length() <= pas) { v.o.position.copy(cible); v.seg++; if (v.seg >= pts.length - 1) { v.fini = true; v.o.lookAt(1.55, 0, 4.2); if (!v.dansant) { v.dansant = true; v.am.crossFadeTo(danser(v.mx, v.danse), 0.3, false); } } }
    else { v.o.position.addScaledVector(d.normalize(), pas); if (v.dansant) v.o.lookAt(1.55, 0, 4.2); else v.o.lookAt(v.o.position.x + d.x, v.o.position.y, v.o.position.z + d.z); } }
}
function arreterFete() {
  if (!fete.faite) return; fete.faite = false; feteActive = false; fete.t = 0; fete.ref = null; arreterMusique(); if (fete.volume > 1) monterLeSon();
  for (const v of fete.invites) fete.groupe.remove(v.o); fete.invites = [];
  if (fete.groupe) fete.groupe.visible = false; soleil.intensity = 3.1; scene.environmentIntensity = 0.6; ciel.color.set('#fff0e0');
  for (const it of instances.values()) it.obj.traverse((x) => { if (x.isMesh) x.castShadow = true; }); soleil.shadow.autoUpdate = true;
  for (const m of etat.membres) { const it = instances.get(m.id); const g = modeles[m.avatar]; if (it?.mixer) g.then((gg) => { it.mixer.stopAllAction(); if (gg.animations[0]) it.mixer.clipAction(gg.animations[0]).play(); }); }
  appliquerStyle(styleActif); placerFamille();
}

// ---------- aventure « La famille s'agrandit » ----------
// une cigogne fait le tour de la maison, descend dans le salon, « pouf » : un bébé apparaît dans son lit, la famille l'entoure
const nais = { groupe: null, charge: null, cigogne: null, mixer: null, nuage: null, nuageMats: [], lit: null, t: 0, faite: false, pouf: false, famille: false, emoji: 0 };
const BERCEAU = new THREE.Vector3(1.55, 0, 4.2);   // au milieu du séjour, entre le canapé et la table
const TOUR = { c: new THREE.Vector3(3.8, 8.2, 2.85), r: 6.5, duree: 6.5 }; // tour de la maison
const T_DESCENTE = 6.5, T_POUF = 9.0;
async function chargerNaissance() {
  if (nais.charge) return nais.charge;
  nais.groupe = new THREE.Group(); nais.groupe.visible = false; scene.add(nais.groupe);
  const poser = (o, taille, axe = 'y') => { o.updateMatrixWorld(true); o.traverse((x) => { if (x.isSkinnedMesh) x.skeleton.update(); }); const t = new THREE.Box3().setFromObject(o, true).getSize(new THREE.Vector3()); o.scale.multiplyScalar(taille / (axe === 'y' ? t.y : Math.max(t.x, t.z))); o.updateMatrixWorld(true); o.traverse((x) => { if (x.isSkinnedMesh) x.skeleton.update(); });
    const b = new THREE.Box3().setFromObject(o, true), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z); const p = new THREE.Group(); p.add(o); return p; };
  nais.charge = Promise.all(['deco/bebe_lit', 'naissance/bebe', 'naissance/cigogne', 'naissance/nuage'].map((f) => charger(f))).then(([gl, gb, gc, gn]) => {
    // le lit à barreaux blanc de la chambre de l'étage
    const lit = poser(gl.scene.clone(true), 1.25, 'long'); lit.position.copy(BERCEAU); lit.visible = false; nais.groupe.add(lit); nais.lit = lit;
    lit.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.frustumCulled = false; } });
    // le bébé : livré debout bras en croix, on lui baisse les bras puis on le couche sur le dos dans le lit
    const b = SkeletonUtils.clone(gb.scene); b.updateMatrixWorld(true);
    b.traverse((x) => { if (x.isMesh) { x.castShadow = false; x.frustumCulled = false; x.material = x.material.clone(); x.material.transparent = false; x.material.alphaTest = 0.5; x.material.depthWrite = true; } if (!x.isBone || !/(L|R)_Upperarm_\d+$/.test(x.name)) return;
      const p = x.getWorldPosition(new THREE.Vector3()); const d = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (p.x > 0 ? -1 : 1) * 1.22);
      const pq = x.parent.getWorldQuaternion(new THREE.Quaternion()); x.quaternion.premultiply(pq.clone().invert().multiply(d).multiply(pq)); });
    const couche = new THREE.Group(); couche.add(b); b.rotation.x = -Math.PI / 2; // tête vers -z, visage vers le ciel
    const bebe = poser(couche, 0.52, 'long'); lit.updateMatrixWorld(true);
    const bl = new THREE.Box3().setFromObject(lit, true), sl = bl.getSize(new THREE.Vector3());
    if (sl.x > sl.z) bebe.rotation.y = Math.PI / 2; // le bébé dans le sens de la longueur du lit
    // hauteur du matelas : un rayon lancé au centre du lit
    rayon.set(new THREE.Vector3(BERCEAU.x, bl.max.y + 1, BERCEAU.z), new THREE.Vector3(0, -1, 0)); const h = rayon.intersectObject(lit, true)[0];
    bebe.position.set(BERCEAU.x, (h ? h.point.y : bl.min.y + sl.y * 0.45) + 0.01, BERCEAU.z); bebe.visible = false; nais.groupe.add(bebe); nais.bebe = bebe;
    let sac = null; gc.scene.traverse((m) => { if (m.isMesh && /pCube1/.test(m.name)) sac = m; }); nais.sac = sac; // le baluchon du bec disparaît au « pouf »
    // la cigogne et son battement d'ailes
    const c = poser(gc.scene, 2.6, 'long'); // envergure de conte, pour qu'on la voie bien
    c.children[0].rotation.y = Math.PI; // le bec du modèle regarde vers -z : demi-tour pour qu'il pointe dans le sens du vol (vérifié caméra derrière la cigogne)  c.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.frustumCulled = false; } });
    nais.groupe.add(c); nais.cigogne = c; nais.mixer = new THREE.AnimationMixer(c.children[0]); for (const a of gc.animations) nais.mixer.clipAction(a).play();
    // le nuage du « pouf »
    const n = poser(gn.scene, 1.6, 'y'); n.visible = false; n.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.depthWrite = false; m.material.emissive = new THREE.Color('#ffffff'); m.material.emissiveIntensity = 0.55; nais.nuageMats.push(m.material); m.frustumCulled = false; } });
    nais.groupe.add(n); nais.nuage = n;
  });
  return nais.charge;
}
// trajectoire de la cigogne au temps t
function volCigogne(t) {
  if (t < T_DESCENTE) { const a = -Math.PI / 2 + (t / TOUR.duree) * Math.PI * 2; return new THREE.Vector3(TOUR.c.x + Math.cos(a) * TOUR.r, TOUR.c.y + Math.sin(t * 1.3) * 0.4, TOUR.c.z + Math.sin(a) * TOUR.r); }
  const depart = volCigogne(T_DESCENTE - 0.001), arrivee = BERCEAU.clone().add(new THREE.Vector3(0, 1.7, 0));
  if (t < T_POUF) { const k = (t - T_DESCENTE) / (T_POUF - T_DESCENTE), e = k * k * (3 - 2 * k); const milieu = new THREE.Vector3((depart.x + arrivee.x) / 2 - 3, 7, (depart.z + arrivee.z) / 2 + 2);
    return depart.clone().multiplyScalar((1 - e) * (1 - e)).add(milieu.multiplyScalar(2 * e * (1 - e))).add(arrivee.clone().multiplyScalar(e * e)); }
  const k = t - T_POUF; return arrivee.clone().add(new THREE.Vector3(2.4 * k, 1.8 * k, -1.6 * k)); // repart vers le ciel, loin de la caméra
}
async function lancerNaissance() {
  if (nais.faite) return; nais.faite = true; naissanceActive = true; nais.t = 0; nais.pouf = false; nais.famille = false;
  await chargerNaissance(); if (!nais.faite) return;
  nais.groupe.visible = true; nais.cigogne.visible = true; nais.lit.visible = nais.nuage.visible = false; if (nais.bebe) nais.bebe.visible = false; if (nais.sac) nais.sac.visible = true;
  try { await renderer.compileAsync(nais.groupe, camera, scene); } catch (e) { /* compilation à la première image */ }
  dessiner();
}
// la famille entoure le lit et se réjouit (applaudit ou lève les bras)
async function familleAutourDuBebe() {
  const M = familleAffichee(); let i = 0; const n = Math.max(3, M.length);
  for (const m of M) { const it = instances.get(m.id); if (!it) continue; const a = -Math.PI * 0.85 + (i++ / n) * Math.PI * 1.7, r = ANIMAUX[m.avatar] ? 1.3 : 0.95;
    it.obj.visible = true; it.obj.position.set(BERCEAU.x + Math.cos(a) * r, 0, BERCEAU.z + Math.sin(a) * r); it.obj.lookAt(BERCEAU.x, 0, BERCEAU.z);
    if (ANIMAUX[m.avatar]) it.obj.rotation.y += ANIMAUX[m.avatar].r;
    else if (it.mixer) { const c = await clipFete(SEXE(m.avatar) + (i % 2 ? '_claphands_01' : '_cheer_01'), ENFANT(m.avatar)); if (!nais.faite) return; it.mixer.stopAllAction(); it.mixer.clipAction(c).reset().play(); } }
}
// emojis qui montent au-dessus de la famille
let bulles = null;
function emoji() {
  if (!bulles) { bulles = document.createElement('div'); bulles.className = 'emojis'; document.body.appendChild(bulles); }
  const p = BERCEAU.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.2 + Math.random() * 0.7, (Math.random() - 0.5) * 2.2)).project(camera);
  if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return;
  const s = document.createElement('span'); s.textContent = ['👶', '❤️', '💕', '🍼', '💖', '👶'][Math.floor(Math.random() * 6)];
  s.style.left = ((p.x + 1) / 2 * 100) + '%'; s.style.top = ((1 - p.y) / 2 * 100) + '%'; s.style.fontSize = (22 + Math.random() * 16) + 'px';
  bulles.appendChild(s); setTimeout(() => s.remove(), 2600);
}
function avancerNaissance(dt) {
  if (!naissanceActive || !nais.cigogne) return; const t = (nais.t += dt);
  nais.mixer.update(dt);
  // la cigogne rapetisse une fois dans la maison
  if (nais.cigogne.visible) { const p = volCigogne(t); nais.cigogne.position.copy(p); nais.cigogne.lookAt(volCigogne(t + 0.08));
    nais.cigogne.scale.setScalar(t < T_DESCENTE ? 1 : Math.max(0.5, 1 - 0.5 * (t - T_DESCENTE) / (T_POUF - T_DESCENTE)));
    if (t > T_POUF + 3) nais.cigogne.visible = false; }
  // en milieu de descente, la caméra quitte l'extérieur pour la maison ouverte
  if (t >= T_DESCENTE + 0.6 && vue !== 'coupe') { montrer('coupe', false); appliquerStyle(styleActif); visibiliteDeco(); viser('naissance'); }
  // « pouf » : le nuage gonfle d'un coup, le lit et le bébé apparaissent derrière, puis le nuage se dissipe
  if (t >= T_POUF - 0.25 && t < T_POUF + 1.4) { const k = (t - (T_POUF - 0.25)) / 1.65; nais.nuage.visible = true; nais.nuage.position.copy(BERCEAU).add(new THREE.Vector3(0, -0.1, 0));
    nais.nuage.scale.setScalar(Math.min(1, k * 5) * (1 + k * 0.6)); for (const m of nais.nuageMats) m.opacity = k < 0.35 ? 1 : Math.max(0, 1 - (k - 0.35) / 0.65); }
  else if (nais.nuage.visible && t >= T_POUF + 1.4) nais.nuage.visible = false;
  if (!nais.pouf && t >= T_POUF) { nais.pouf = true; nais.lit.visible = true; if (nais.bebe) nais.bebe.visible = true; if (nais.sac) nais.sac.visible = false; confettis(); dessiner(); }
  if (!nais.famille && t >= T_POUF + 0.5) { nais.famille = true; familleAutourDuBebe(); }
  if (nais.famille && (nais.emoji -= dt) <= 0) { nais.emoji = 0.28; emoji(); }
}
function arreterNaissance() {
  if (!nais.faite) return; nais.faite = false; naissanceActive = false; nais.t = 0; nais.pouf = false; nais.famille = false;
  if (nais.groupe) nais.groupe.visible = false; if (bulles) bulles.textContent = ''; appliquerStyle(styleActif);
  for (const m of etat.membres) { const it = instances.get(m.id); const g = modeles[m.avatar]; if (it?.mixer && g) g.then((gg) => { it.mixer.stopAllAction(); if (gg.animations[0]) it.mixer.clipAction(gg.animations[0]).play(); }); }
  placerFamille();
}

// ---------- chasse aux clés : trois clés cachées dans le jardin, à trouver en touchant les objets ----------
// objets ajoutés au jardin (Poly Haven CC0 et Sketchfab CC BY) ; ils restent en place pour tout le parcours
const CACHETTES = [
  { id: 'nain', nom: 'le nain de jardin', haut: 0.75, p: [-6.6, -0.32, 1.7, -Math.PI / 2] },           // Garden Gnome (Poly Haven)
  { id: 'nichoir', nom: 'la petite maison', haut: 0.5, p: [-7.15, -0.32, 0.55, -Math.PI / 2] },      // Bird house (alban)
  { id: 'jardiniere', nom: 'la jardinière', long: 1.25, p: [-2.4, -0.32, 6.62, Math.PI] },           // Planter Box 02 (Poly Haven)
  { id: 'pot', nom: 'le grand pot', haut: 1.05, p: [-3.4, -0.12, 0.4, 0.3] },                         // Potted Plant 01 (Poly Haven)
  { id: 'bottes', nom: 'les bottes', haut: 0.37, p: [-0.62, -0.12, 0.42, -Math.PI / 2] },              // Rubber Boots (Poly Haven)
  { id: 'brasero', nom: 'le brasero', long: 1.3, p: [-7.6, -0.32, 2.5, 0] },                          // Stone Fire Pit (Poly Haven)
  { id: 'balancelle', nom: 'la balancelle', long: 2.1, p: [-8.0, -0.32, 6.15, Math.PI] },              // Swing Bench (johhny_3D), dos à la haie, face au jardin
  { id: 'arrosoir', nom: "l'arrosoir", haut: 0.5, p: [-1.15, -0.32, -1.75, 0.5] },                    // Watering Can (taipl)
];
// cinq érables alignés le long de la bordure gauche du jardin, de la maison jusqu'à la clôture du fond (Maple tree, atrodler)
const ERABLES = [-2.0, -3.9, -5.8, -7.7, -9.5].map((x, i) => ({ id: 'erable' + (i + 1), nom: "l'érable", p: [x, -0.32, -2.3, i * 1.3] }));
const DEJA_LA = { chaise_jardin: 'la chaise longue', livres: 'la pile de livres', jacinthe: 'la jacinthe', table_jardin: 'la table' };
const cles = { objets: [], cle: null, avec: new Set(), trouvees: 0, temps: 45, en_cours: false, fini: false, anims: [] };
const g2 = (g) => g.scene.clone(true);
async function poserCachettes() {
  const poser = (o, d) => { const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.scale.multiplyScalar(d.haut ? d.haut / t.y : d.long / Math.max(t.x, t.z)); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z); const pv = new THREE.Group(); pv.add(o); return pv; };
  await Promise.all(CACHETTES.map(async (d) => { const g = await charger('cles/' + d.id); const pv = poser(g.scene, d); pv.position.set(d.p[0], d.p[1], d.p[2]); pv.rotation.y = d.p[3];
    pv.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material.transparent) { m.material.transparent = false; m.material.alphaTest = 0.4; m.material.depthWrite = true; } } });
    scene.add(pv); cles.objets.push({ id: d.id, nom: d.nom, o: pv }); enregistrer(d.id, d.nom, pv); }));
  const ge = await charger('cles/erable');
  for (const d of ERABLES) { const pv = poser(g2(ge), { haut: 4.3 }); pv.position.set(d.p[0], d.p[1], d.p[2]); pv.rotation.y = d.p[3];
    pv.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(pv); cles.objets.push({ id: d.id, nom: d.nom, o: pv }); enregistrer(d.id, d.nom + ' ' + d.id.slice(-1), pv); }
  const g = await charger('cles/cle'); cles.cle = poser(g.scene, { long: 0.32 }); cles.cle.visible = false;
  cles.cle.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color('#ffcf4a'); m.material.emissiveIntensity = 0.35; } }); scene.add(cles.cle);
}
// zone de toucher invisible autour de chaque cachette : sur un téléphone, viser un petit objet au doigt est difficile
const ZONE_TOUCHER = new THREE.MeshBasicMaterial({ visible: false });
function zoneToucher(o) { if (o.userData.zone) return; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), t = b.getSize(new THREE.Vector3());
  const r = Math.max(0.55, Math.max(t.x, t.y, t.z) * 0.6); const z = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), ZONE_TOUCHER); z.scale.set(Math.max(r, t.x * 0.6), Math.max(r, t.y * 0.6), Math.max(r, t.z * 0.6));
  z.position.copy(o.worldToLocal(c.clone())); z.scale.divide(o.getWorldScale(new THREE.Vector3())); o.add(z); o.userData.zone = z; }
function lancerChasse() {
  for (const [f, nom] of Object.entries(DEJA_LA)) if (jardinPivots[f] && !cles.objets.some((o) => o.id === f)) cles.objets.push({ id: f, nom, o: jardinPivots[f] });
  for (const o of cles.objets) if (!/^erable/.test(o.id)) zoneToucher(o.o); // les arbres sont déjà assez grands
  const dispo = cles.objets.filter((o) => o.o.parent && o.o.visible); const melange = dispo.map((o) => [Math.random(), o]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  cles.avec = new Set(melange.slice(0, 3).map((o) => o.id)); cles.trouvees = 0; cles.temps = 45; cles.en_cours = true; cles.fini = false; cles.indice = false; dessiner();
}
function message(txt) { let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = txt; t.classList.remove('vu'); void t.offsetWidth; t.classList.add('vu'); }
function fouiller(obj) {
  // l'objet tremble ; s'il cache une clé, elle s'envole en tournant
  cles.anims.push({ o: obj.o, t: 0, r0: obj.o.rotation.y, type: 'secoue' });
  if (cles.avec.has(obj.id)) { cles.avec.delete(obj.id); cles.trouvees++;
    const b = new THREE.Box3().setFromObject(obj.o); const k = cles.cle.clone(); k.visible = true; k.position.set((b.min.x + b.max.x) / 2, Math.min(b.max.y, 1.6) + 0.15, (b.min.z + b.max.z) / 2); scene.add(k);
    cles.anims.push({ o: k, t: 0, y0: k.position.y, type: 'cle' });
    message(cles.trouvees < 3 ? `Une clé sous ${obj.nom} ! 🔑` : 'Les 3 clés ! 🎉');
    if (cles.trouvees >= 3) { cles.en_cours = false; cles.fini = true; setTimeout(confettis, 600); }
    dessiner(); }
  else message(`Rien sous ${obj.nom}…`);
}
let appui = null;
canvas.addEventListener('pointerdown', (ev) => { appui = [ev.clientX, ev.clientY]; });
canvas.addEventListener('pointerup', (ev) => {
  if (ecran !== 'cles' || !(cles.en_cours || (cles.indice && !cles.fini)) || !appui || Math.hypot(ev.clientX - appui[0], ev.clientY - appui[1]) > 10) return; // un glissé fait tourner la vue, ce n'est pas un toucher
  viserDoigt(ev);
  const h = rayon.intersectObjects(cles.objets.map((o) => o.o), true)[0]; if (!h) return;
  const obj = cles.objets.find((x) => { let o = h.object; while (o) { if (o === x.o) return true; o = o.parent; } return false; }); if (obj) fouiller(obj);
});
function avancerCles(dt) {
  for (const a of cles.anims) { a.t += dt;
    if (a.type === 'secoue') a.o.rotation.y = a.r0 + Math.sin(a.t * 40) * 0.12 * Math.max(0, 1 - a.t / 0.45);
    if (a.type === 'cle') { a.o.position.y = a.y0 + Math.min(1, a.t / 0.8) * 0.7; a.o.rotation.y += dt * 6; a.o.scale.setScalar(1 + Math.min(1, a.t / 0.8) * 0.6); if (a.t > 1.6) a.o.removeFromParent(); }
    if (a.type === 'indice') a.o.position.y = a.y0 + Math.abs(Math.sin(a.t * 5)) * 0.18; }
  cles.anims = cles.anims.filter((a) => (a.type === 'secoue' ? a.t < 0.45 : a.type === 'cle' ? a.t <= 1.6 : !cles.fini));
  if (!cles.en_cours) return;
  const avant = Math.ceil(cles.temps); cles.temps = Math.max(0, cles.temps - dt);
  if (Math.ceil(cles.temps) !== avant && ecran === 'cles') $('intitule').textContent = ECRANS.cles.intitule();
  if (cles.temps <= 0) { // temps écoulé : personne ne repart bredouille, les cachettes restantes sautillent pour se montrer
    cles.en_cours = false; cles.indice = true; message('Temps écoulé ! Les clés se montrent…');
    for (const o of cles.objets) if (cles.avec.has(o.id)) cles.anims.push({ o: o.o, t: 0, y0: o.o.position.y, type: 'indice' }); dessiner(); }
}
function arreterChasse() { cles.en_cours = false; for (const a of cles.anims) if (a.type === 'indice') a.o.position.y = a.y0; cles.anims = []; }

// ---------- mode aménagement (adresse avec ?amenagement) : déplacer les objets du jardin à la souris, au clavier ou au doigt ----------
// Les réglages restent sur l'appareil (stockage local) ; « Copier les positions » produit un texte à transmettre pour les intégrer au jeu.
const AMENAGEMENT = new URLSearchParams(location.search).has('amenagement');
const NOMS_JARDIN = { chaise_jardin: 'la chaise longue', jacinthe: 'la jacinthe', livres: 'la pile de livres', table_jardin: 'la table et les chaises', salon_jardin: 'le salon du voisin' };
const amen = { objets: new Map(), sel: null, cadre: null, glisse: null, reglages: {} };
try { amen.reglages = JSON.parse(localStorage.getItem('amenagement') || '{}'); } catch (e) { /* stockage indisponible */ }
function enregistrer(id, nom, o) {
  if (amen.objets.has(id)) return; amen.objets.set(id, { id, nom, o, depart: [o.position.x, o.position.z, o.rotation.y] });
  const r = AMENAGEMENT && amen.reglages[id]; if (r === 'retire') o.visible = false; else if (r) { o.position.x = r[0]; o.position.z = r[1]; o.rotation.y = r[2]; }
}
function sauverAmenagement() {
  const R = {}; for (const a of amen.objets.values()) { const o = a.o, d = a.depart;
    if (!o.visible) R[a.id] = 'retire'; else if (Math.abs(o.position.x - d[0]) + Math.abs(o.position.z - d[1]) + Math.abs(o.rotation.y - d[2]) > 1e-3) R[a.id] = [+o.position.x.toFixed(2), +o.position.z.toFixed(2), +o.rotation.y.toFixed(2)]; }
  amen.reglages = R; try { localStorage.setItem('amenagement', JSON.stringify(R)); } catch (e) { /* stockage indisponible */ } majAmenagement();
}
function choisirObjet(a) { amen.sel = a; if (amen.cadre) { amen.cadre.removeFromParent(); amen.cadre = null; }
  if (a) { amen.cadre = new THREE.BoxHelper(a.o, '#c4d000'); scene.add(amen.cadre); } majAmenagement(); }
function majAmenagement() { const b = $('amen'); if (!b) return; const a = amen.sel;
  b.querySelector('.amen-nom').textContent = a ? a.nom : 'Touchez un objet pour le sélectionner';
  b.querySelectorAll('[data-amen]').forEach((x) => { if (['gauche', 'droite', 'retirer', 'origine'].includes(x.dataset.amen)) x.disabled = !a; });
  b.querySelector('.amen-nb').textContent = Object.keys(amen.reglages).length + ' modification(s)'; amen.cadre?.update(); }
function actionAmenagement(k) { const a = amen.sel;
  if (k === 'copier') { const t = 'AMENAGEMENT ' + JSON.stringify(amen.reglages); const z = $('amen-texte'); z.hidden = false; z.value = t; z.select(); navigator.clipboard?.writeText(t).then(() => message('Positions copiées ! Collez-les dans la conversation.'), () => message('Sélectionnez le texte et copiez-le')); return; }
  if (k === 'tout') { if (!confirm('Revenir à la disposition d’origine pour tous les objets ?')) return; for (const x of amen.objets.values()) { x.o.visible = true; x.o.position.x = x.depart[0]; x.o.position.z = x.depart[1]; x.o.rotation.y = x.depart[2]; } choisirObjet(null); sauverAmenagement(); return; }
  if (!a) return;
  if (k === 'gauche') a.o.rotation.y += Math.PI / 12; if (k === 'droite') a.o.rotation.y -= Math.PI / 12;
  if (k === 'retirer') { a.o.visible = false; choisirObjet(null); message('Objet retiré (« Tout rétablir » pour le remettre)'); }
  if (k === 'origine') { a.o.visible = true; a.o.position.x = a.depart[0]; a.o.position.z = a.depart[1]; a.o.rotation.y = a.depart[2]; }
  sauverAmenagement(); }
function objetSousDoigt(ev) { viserDoigt(ev); const L = [...amen.objets.values()].filter((a) => a.o.visible); const h = rayon.intersectObjects(L.map((a) => a.o), true)[0]; if (!h) return null;
  return L.find((a) => { let o = h.object; while (o) { if (o === a.o) return true; o = o.parent; } return false; }); }
function pointSol(ev, y) { viserDoigt(ev); const p = new THREE.Vector3(); return rayon.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; }
function ouvrirAmenagement() {
  document.body.dataset.amenagement = '1'; aller('cles'); $('question').hidden = $('panneau').hidden = true; controls.autoRotate = false;
  const b = document.createElement('div'); b.id = 'amen'; b.className = 'amen';
  b.innerHTML = `<div class="amen-haut"><b>Mode aménagement</b><span class="amen-nb"></span></div><div class="amen-nom"></div>
    <div class="amen-boutons"><button data-amen="gauche" title="Tourner (R)">⟲</button><button data-amen="droite" title="Tourner (E)">⟳</button><button data-amen="origine" title="Remettre à sa place">↺</button><button data-amen="retirer" title="Retirer (Suppr)">🗑</button></div>
    <div class="amen-boutons"><button data-amen="copier" class="amen-copier">Copier les positions</button><button data-amen="tout">Tout rétablir</button></div>
    <p class="amen-aide">Glisser un objet : le déplacer · glisser ailleurs : tourner la vue · flèches : déplacer finement (Maj : plus vite) · R / E : tourner · Suppr : retirer</p>
    <textarea id="amen-texte" hidden readonly></textarea>`;
  document.body.appendChild(b); b.addEventListener('click', (ev) => { const x = ev.target.closest('[data-amen]'); if (x) actionAmenagement(x.dataset.amen); }); majAmenagement();
  canvas.addEventListener('pointerdown', (ev) => { const a = objetSousDoigt(ev); if (!a) return; choisirObjet(a); const p = pointSol(ev, a.o.position.y); if (!p) return;
    amen.glisse = { a, dx: a.o.position.x - p.x, dz: a.o.position.z - p.z }; controls.enabled = false; canvas.setPointerCapture?.(ev.pointerId); }, true);
  canvas.addEventListener('pointermove', (ev) => { const g = amen.glisse; if (!g) return; const p = pointSol(ev, g.a.o.position.y); if (!p) return; g.a.o.position.x = p.x + g.dx; g.a.o.position.z = p.z + g.dz; amen.cadre?.update(); });
  addEventListener('pointerup', () => { if (!amen.glisse) return; amen.glisse = null; controls.enabled = true; sauverAmenagement(); });
  addEventListener('keydown', (ev) => { const a = amen.sel; if (!a || ev.target.tagName === 'TEXTAREA') return; const pas = ev.shiftKey ? 0.5 : 0.1; let fait = true;
    // flèches dans le repère de l'écran : haut = s'éloigner de la caméra
    const av = new THREE.Vector3(); camera.getWorldDirection(av); av.y = 0; av.normalize(); const dr = new THREE.Vector3(-av.z, 0, av.x);
    if (ev.key === 'ArrowUp') a.o.position.addScaledVector(av, pas); else if (ev.key === 'ArrowDown') a.o.position.addScaledVector(av, -pas);
    else if (ev.key === 'ArrowRight') a.o.position.addScaledVector(dr, pas); else if (ev.key === 'ArrowLeft') a.o.position.addScaledVector(dr, -pas);
    else if (ev.key === 'r' || ev.key === 'R') a.o.rotation.y += Math.PI / 12; else if (ev.key === 'e' || ev.key === 'E') a.o.rotation.y -= Math.PI / 12;
    else if (ev.key === 'Delete' || ev.key === 'Backspace') actionAmenagement('retirer'); else if (ev.key === 'Escape') choisirObjet(null); else fait = false;
    if (fait) { ev.preventDefault(); amen.cadre?.update(); sauverAmenagement(); } });
}

// ---------- vues de la maison ----------
let vue = null;
const VUES = {
  exterieur: { coque: 'exterieur', interieur: false, etage: false, famille: 'exterieur' }, // maison fermée : l'intérieur (près d'un million de triangles) n'est pas dessiné
  coupe: { coque: 'coupe', interieur: true, etage: false, famille: 'coupe' },
  etage: { coque: 'etage', interieur: false, etage: true, famille: 'etage' },
};
function montrer(nom, fam = true) {
  vue = nom; const v = VUES[nom]; familleVisible = fam;
  for (const [k, o] of Object.entries(coques)) o.visible = k === v.coque;
  if (decor.interieur) decor.interieur.visible = v.interieur;
  if (decor.etage) decor.etage.visible = v.etage;
  zone9.visible = nom === 'etage' && !etat.piece; visibiliteDeco(); for (const [k, g] of Object.entries(piecePosee)) g.visible = k === (etat.piece || 'bureau') && v.etage;
  placerFamille();
}
// terre au pied de l'arbre, visible seulement une fois l'arbre planté
const terre = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshStandardMaterial({ color: '#6b4b33', roughness: 1 }));
terre.rotation.x = -Math.PI / 2; terre.position.set(-5.6, -0.295, 0.9); terre.receiveShadow = true; terre.visible = false; scene.add(terre);
// motte de terre photoscannée (banque Sketchfab) au pied de l'arbre ; le disque « terre » ne sert plus que de repère
const motte = new THREE.Group(); motte.position.set(terre.position.x, -0.315, terre.position.z); motte.visible = false; scene.add(motte);
let motteChargee = null;
function chargerMotte() {
  return (motteChargee ||= charger('terre/motte').then((g) => { const o = g.scene; const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const k = 1.9 / Math.max(t.x, t.z); o.scale.set(k, k * 0.7, k); o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b2.min.y + 0.005, -c.z);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); motte.add(o); }));
}
// recentre un arbre pour que son tronc (le bas du modèle) tombe au milieu de la terre
// arbre : le pied du tronc au centre de la terre ; arbuste sans tronc net (noisetier) : le milieu du feuillage
const PAR_COURONNE = new Set(['noisetier']);
function centrerTronc(racine, couronne = false) {
  racine.updateMatrixWorld(true);
  let ymin = Infinity; const v = new THREE.Vector3(); const pts = [];
  racine.traverse((m) => { if (!m.isMesh) return; const pos = m.geometry.attributes.position; const pas = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += pas) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); pts.push(v.x, v.y, v.z); if (v.y < ymin) ymin = v.y; } });
  let sx = 0, sz = 0, n = 0;
  if (couronne) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let i = 0; i < pts.length; i += 3) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 2]); z1 = Math.max(z1, pts[i + 2]); } sx = (x0 + x1) / 2; sz = (z0 + z1) / 2; n = 1; }
  else for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] < ymin + 0.35) { sx += pts[i]; sz += pts[i + 2]; n++; }
  if (n) { racine.position.x += terre.position.x - sx / n; racine.position.z += terre.position.z - sz / n; }
}
// chaque arbre est accroché à un pivot posé au centre de la terre : on peut le faire pousser depuis son pied
function chargerArbre(id) {
  return (arbres[id] = charger('arbres/' + id).then((g) => { centrerTronc(g.scene, PAR_COURONNE.has(id));
    const pivot = new THREE.Group(); pivot.position.set(terre.position.x, terre.position.y, terre.position.z); g.scene.position.sub(pivot.position);
    pivot.add(g.scene); scene.add(pivot); g.pivot = pivot; g.scene.visible = etat.arbre === id; arbres[id] = g; return g; }));
}
let croissance = null; // { pivot, t } : l'arbre pousse pendant la plantation
function avancerCroissance(dt) {
  if (!croissance) return; croissance.t = Math.min(1, croissance.t + dt / 2.0);
  const k = 1 - Math.pow(1 - croissance.t, 3); croissance.pivot.scale.setScalar(0.04 + 0.96 * k);
  if (croissance.t >= 1) croissance = null;
}
async function planter(id) {
  motte.visible = !!id || ecran === 'arbre'; if (motte.visible) chargerMotte();
  if (!id) { for (const a of Object.values(arbres)) if (a.scene) a.scene.visible = false; return; }
  if (!arbres[id]) chargerArbre(id);
  const g = await arbres[id];
  for (const [k, a] of Object.entries(arbres)) if (a.scene) a.scene.visible = k === id && etat.arbre === id;
}

// ---------- ce que le joueur choisit ----------
let numero = 0; const membre = (prenom, age, type, avatar) => ({ id: 'm' + (++numero), prenom, age, type, avatar, habitudes: [] });
// on démarre avec le joueur seul (« Vous ») : aucune famille d'exemple ne doit finir dans la fiche du conseiller
const moi = Object.assign(membre('', '', 'adulte', 'f07'), { moi: true });
const etat = { valeur: null, arbre: null, membres: [moi], membre: moi.id, style: null, piece: null, chambres: 3, aventure: null, prenom: '', nom: '', email: '', tel: '', recevoir: true, rappel: false, envoye: false };
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ARBRES = [
  { id: 'pommier', nom: 'Pommier', le: 'le pommier', couleur: '#d6382f', titre: 'Le pommier · ce qui se transmet', texte: "Planté par vous, cueilli par vos enfants, puis par les leurs. L'arbre des vergers alsaciens." },
  { id: 'cerisier', nom: 'Cerisier', le: 'le cerisier', couleur: '#f4b6c8', titre: 'Le cerisier · les moments heureux', texte: "Quand il fleurit, toute la famille sort au jardin. Le rendez-vous de chaque printemps." },
  { id: 'lilas', nom: 'Lilas', le: 'le lilas', couleur: '#b48ad6', titre: "Le lilas · l'accueil", texte: "En mai, son parfum accueille vos invités dès le portail. Et il y a toujours un bouquet à offrir." },
  { id: 'noisetier', nom: 'Noisetier', le: 'le noisetier', couleur: '#a8743f', titre: 'Le noisetier · le calme', texte: "Un coin d'ombre où l'on vient souffler. À l'automne, les noisettes se ramassent sans se presser." },
];
// chaque valeur oriente vers un arbre ; la petite phrase dit ce qu'elle veut dire, concrètement, dans une maison
const ICONES = { son: '🔊', fort: '🔥', transmettre: '🌱', retrouver: '🍽️', recevoir: '🥂', ressourcer: '🍃', moderne: '✨', chaleureux: '🌼', bebe: '👶', bureau: '💻', sport: '🏋️', noel: '🎄', fete: '🥂', teletravail: '💻', cuisine: '🍳', jardin: '🌿', jeux: '🧸', amis: '🥂', adulte: '🧑', enfant: '🧒', senior: '👵', animal: '🐾', personne: '👤' };
// tuiles compactes : une icône et un mot (le détail est dans aria-label)
const tuile = (id, mot, on, aide = mot, cls = '') => `<button type="button" class="tuile ${cls}" data-id="${id}" aria-pressed="${!!on}" aria-label="${esc(aide)}"><i aria-hidden="true">${ICONES[id] || '•'}</i>${mot ? `<span>${esc(mot)}</span>` : ''}</button>`;
const VALEURS = [
  ['transmettre', 'Transmettre', 'pommier', 'Bâtir ce qui restera à vos enfants'],
  ['retrouver', 'Se retrouver', 'cerisier', 'Les repas, les rires, la famille réunie'],
  ['recevoir', 'Recevoir', 'lilas', 'Une maison ouverte aux amis et aux voisins'],
  ['ressourcer', 'Se ressourcer', 'noisetier', 'Un coin de calme pour souffler'],
];
let CATALOGUE = { adulte: [], senior: [], enfant: [], animal: ['chien', 'chat'] };
// l'âge décide de la catégorie : il ne reste à choisir que personne ou animal
const TYPES = [['personne', 'Personne'], ['animal', 'Animal']];
const AJOUTS = [['adulte', '+ 🧑 Adulte'], ['enfant', '+ 🧒 Enfant'], ['senior', '+ 👵 Senior'], ['animal', '+ 🐾 Animal']];
const NOM_TYPE = { adulte: 'Adulte', enfant: 'Enfant', senior: 'Senior', animal: 'Animal' };
const categorieAge = (age) => { const a = parseInt(age, 10); return Number.isNaN(a) ? null : a < 18 ? 'enfant' : a >= 65 ? 'senior' : 'adulte'; };
// visages proposés : un adulte peut prendre un visage plus âgé et inversement ; les enfants ont les leurs
const visages = (type) => type === 'enfant' ? CATALOGUE.enfant : type === 'senior' ? CATALOGUE.senior.concat(CATALOGUE.adulte) : type === 'adulte' ? CATALOGUE.adulte.concat(CATALOGUE.senior) : CATALOGUE.animal;
// une variante de teint compte comme le même visage, pour ne pas proposer deux fois la même personne
const baseAvatar = (x) => { const V = CATALOGUE.teints?.variantes || {}; return Object.keys(V).find((b) => V[b].includes(x)) || x; };
const libreParmi = (liste, sauf) => { const pris = new Set(etat.membres.filter((y) => y !== sauf).map((y) => baseAvatar(y.avatar))); return liste.find((x) => !pris.has(baseAvatar(x))) || liste[0]; };
const nomMembre = (m) => m.prenom || (m.moi ? 'Vous' : m.type === 'animal' ? nomAnimal[m.avatar] : NOM_TYPE[m.type]);
const MAX_MEMBRES = 8;
const nomAnimal = new Proxy({}, { get: (_, k) => ANIMAUX[k]?.nom || 'Animal' });
const membreActif = () => etat.membres.find((m) => m.id === etat.membre) || etat.membres[0];
function composition() {
  const n = (t) => etat.membres.filter((m) => m.type === t).length; const parts = [];
  const a = n('adulte'), s = n('senior'), e = n('enfant'), c = etat.membres.filter((m) => m.avatar.startsWith('chien')).length, ch = etat.membres.filter((m) => m.avatar === 'chat').length;
  if (a) parts.push(a + (a > 1 ? ' adultes' : ' adulte')); if (s) parts.push(s + (s > 1 ? ' seniors' : ' senior')); if (e) parts.push(e + (e > 1 ? ' enfants' : ' enfant'));
  if (c) parts.push(c + (c > 1 ? ' chiens' : ' chien')); if (ch) parts.push(ch + (ch > 1 ? ' chats' : ' chat'));
  return parts.join(', ') || '—';
}
const prenoms = () => { const l = etat.membres.filter((m) => m.type !== 'animal').map(nomMembre); return l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : (l[0] || 'votre famille'); };
const HABITUDES = [['teletravail', 'Télétravail', 'besoin d’un bureau'], ['cuisine', 'Cuisiner', 'cuisine ouverte'], ['sport', 'Sport', 'du rangement'], ['jardin', 'Jardiner', 'un potager'], ['jeux', 'Jouer', 'un coin à soi'], ['amis', 'Recevoir', 'une chambre d’amis']];
const HABITUDES_ENFANT = ['jeux', 'sport', 'jardin', 'cuisine'];
const HABITUDES_CHIEN = [['balade', 'Balades', 'accès jardin'], ['dodo', 'Sieste', 'un panier au calme']];
// deux scénographies pour toute la maison ; la cuisine et les salles d'eau ne changent pas
const STYLES = [['moderne', 'Moderne et épuré', 'Lignes nettes, tons clairs, peu d’objets'], ['chaleureux', 'Chaleureux et coloré', 'Couleurs vives, fleurs, mobilier accueillant']];
const PIECE = [['bebe', 'Chambre de bébé', 'pour la suite'], ['bureau', 'Bureau', 'pour télétravailler'], ['sport', 'Salle de sport', 'pour bouger']];
const AVENTURES = [
  ['noel', 'La bombe de Noël', 'Une boule éclate et toute la maison s’habille de lumières et de neige.', 'De saison', '#c4d000'],
  ['fete', 'La crémaillère', 'Guirlandes, platines et grande tablée : les voisins débarquent.', 'Avec les voisins', '#e6ec9a'],
  ['bebe', 'La famille s’agrandit', 'Une cigogne fait le tour de la maison et dépose un bébé dans le séjour.', 'Une maison qui évolue', '#f5f8d2'],
];
const libelle = (liste, id) => (liste.find((x) => x[0] === id) || [, '—'])[1];

// ---------- écrans ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
const CORBEILLE = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const puceHtml = (p) => p.sous
  ? `<button type="button" class="puce valeur" data-id="${p.id}" aria-pressed="${p.on}"><b>${esc(p.l)}</b><span>${esc(p.sous)}</span></button>`
  : p.suppr
  ? `<span class="puce-membre"><button type="button" class="puce" data-id="${p.id}" aria-pressed="${p.on}">${esc(p.l)}</button><button type="button" class="corbeille" data-suppr="${p.id}" aria-label="Retirer ${esc(p.l)} de la famille">${CORBEILLE}</button></span>`
  : `<button type="button" class="puce${p.ajout ? ' ajout' : ''}" data-id="${p.id}" aria-pressed="${p.on}">${esc(p.l)}</button>`;
const choix = (id, titre, sous, on, classe = '') => `<button type="button" class="choix ${classe}" data-id="${id}" aria-pressed="${!!on}"><b>${esc(titre)}</b>${sous ? `<span>${esc(sous)}</span>` : ''}</button>`;

function visagesHtml(m) {
  const animal = m.type === 'animal', liste = visages(m.type);
  // teint de peau (enfants) : chaque portrait de base a des variantes ; on garde le teint choisi quand on change de visage
  const V = CATALOGUE.teints?.variantes || {}, base = Object.keys(V).find((b) => V[b].includes(m.avatar)), iTeint = base ? V[base].indexOf(m.avatar) : 0;
  return `<div class="portraits">${liste.map((x) => animal
      ? `<button type="button" class="choix animal" data-avatar="${x}" aria-pressed="${m.avatar === x}"><b>${nomAnimal[x]}</b></button>`
      : `<button type="button" class="portrait" data-avatar="${V[x] ? V[x][iTeint] : x}" aria-pressed="${m.avatar === x || base === x}" aria-label="Personnage ${x}"><img src="assets/avatars/${V[x] ? V[x][iTeint] : x}.webp" alt="" width="64" height="64" loading="lazy"></button>`).join('')}</div>`
    + (base ? `<div class="teints"><span>Teint</span>${V[base].map((v, i) => `<button type="button" class="teint" data-avatar="${v}" aria-pressed="${i === iTeint}" aria-label="Teint ${CATALOGUE.teints.noms[i].toLowerCase()}" style="background:${CATALOGUE.teints.couleurs[i]}"></button>`).join('')}</div>` : '');
}
const ORDRE = ['accueil', 'arbre', 'famille', 'style', 'etage', 'cles', 'aventures', 'fiche'];
const ECRANS = {
  arbre: {
    vue: 'exterieur', famille: false, plan: 'arbre', etape: '1/4',
    // avant le choix : la terre est déjà retournée et une bulle montre où l'arbre sera planté
    get bulle() { return etat.arbre ? null : { p: [terre.position.x, 0.25, terre.position.z], t: 'Votre arbre ici' }; },
    intitule: 'Ce qui compte pour vous ?',
    // un seul panneau, en bas : les intentions ; l'arbre et sa description apparaissent une fois l'intention choisie
    contenu: () => { const a = ARBRES.find((x) => x.id === etat.arbre);
      return `<div class="tuiles">${VALEURS.map(([id, l, , sous]) => tuile(id, { ressourcer: 'Souffler', retrouver: 'Se retrouver' }[id] || l, etat.valeur === id, l + ' : ' + sous)).join('')}</div>`
        + (a ? `<details class="detail"><summary>${a.titre}</summary><p>${a.texte}</p></details>` : ''); },
    clic: (id) => { const v = VALEURS.find((x) => x[0] === id); if (!v) return; etat.valeur = id; choisirArbre(v[2]); },
    suite: () => etat.arbre ? 'Planter ' + ARBRES.find((x) => x.id === etat.arbre).le : 'Choisissez ce qui compte', pret: () => !!etat.arbre,
  },
  famille: {
    vue: 'exterieur', plan: 'famille', etape: '2/4',
    intitule: 'Qui vit avec vous ?',
    // une bulle au-dessus du personnage sélectionné, pour savoir qui est qui dans le jardin
    get bulle() { const m = membreActif(), it = instances.get(m.id); if (!it || !it.obj.visible) return null; const p = it.obj.position; return { p: [p.x, p.y + (it.h || 1.6) + 0.18, p.z], t: nomMembre(m) }; },
    puces: () => etat.membres.map((m) => ({ id: m.id, l: nomMembre(m), on: etat.membre === m.id, suppr: !m.moi }))
      // au début, les quatre ajouts sont en vue ; ensuite un seul « + Ajouter » qui les déplie, pour garder le bandeau court
      .concat(etat.membres.length >= MAX_MEMBRES ? [] : etat.membres.length <= 2 || etat.ajoutOuvert ? AJOUTS.map(([t, l]) => ({ id: 'ajouter-' + t, l, on: false, ajout: true })) : [{ id: 'deplier', l: '+ Ajouter', on: false, ajout: true }]),
    puce: (id) => {
      if (id === 'deplier') { etat.ajoutOuvert = true; return; }
      if (!id.startsWith('ajouter-')) { etat.membre = id; etat.ajoutOuvert = false; return; }
      etat.ajoutOuvert = false;
      const t = id.slice(8), liste = t === 'animal' ? CATALOGUE.animal : CATALOGUE[t];
      const m = membre('', '', t, libreParmi(liste)); etat.membres.push(m); etat.membre = m.id; synchroniserFamille();
      setTimeout(() => $('prenom-m')?.focus({ preventScroll: true }), 50);
    },
    contenu: () => {
      const m = membreActif(); const animal = m.type === 'animal';
      return (m.moi && etat.prenomManquant && !moi.prenom.trim() ? `<p class="alerte">Indiquez votre prénom pour entrer dans la maison.</p>` : '')
        + `<div class="champs compact"><input id="prenom-m" aria-label="${m.moi ? 'Votre prénom' : 'Prénom'}" autocomplete="${m.moi ? 'given-name' : 'off'}" maxlength="20" placeholder="${animal ? 'Son nom' : m.moi ? 'Votre prénom' : 'Son prénom'}" value="${esc(m.prenom)}">`
        + (animal ? '' : `<input id="age-m" class="age" aria-label="Âge" type="number" inputmode="numeric" min="0" max="110" placeholder="Âge" value="${esc(m.age)}">`)
        + (m.moi ? '' : TYPES.map(([t, l]) => `<button type="button" class="puce icone" data-type="${t}" aria-label="${l}" aria-pressed="${t === 'animal' ? animal : !animal}">${ICONES[t]}</button>`).join('')) + `</div>`
        + `<div id="visages">${visagesHtml(m)}</div>`
        + (animal ? '' : `<div class="defile puces-habitudes" aria-label="Habitudes à la maison">${HABITUDES.filter(([id]) => m.type !== 'enfant' || HABITUDES_ENFANT.includes(id)).map(([id, l]) => `<button type="button" class="puce" data-id="${id}" aria-pressed="${m.habitudes.includes(id)}">${ICONES[id] || '🏃'} ${l}</button>`).join('')}</div>`);
    },
    clic: (id, el) => {
      const m = membreActif();
      if (el.dataset.type) { const animal = el.dataset.type === 'animal'; if (animal !== (m.type === 'animal')) { m.type = animal ? 'animal' : (categorieAge(m.age) || 'adulte'); m.avatar = visages(m.type)[0]; m.habitudes = []; if (animal) m.age = ''; synchroniserFamille(); } return; }
      if (el.dataset.avatar) { m.avatar = el.dataset.avatar; synchroniserFamille();
        if (el.classList.contains('portrait') || el.classList.contains('animal')) { for (const x of $('visages').querySelectorAll('[data-avatar]')) if (!x.classList.contains('teint')) x.setAttribute('aria-pressed', String(x === el)); }
        else $('visages').innerHTML = visagesHtml(m); // changement de teint : les portraits changent d'image
        $('puces').innerHTML = ECRANS[ecran].puces().map(puceHtml).join(''); return 'partiel'; }
      const i = m.habitudes.indexOf(id); if (i >= 0) m.habitudes.splice(i, 1); else m.habitudes.push(id);
      el.setAttribute('aria-pressed', String(i < 0)); return 'partiel';
    },
    suite: () => 'Entrer dans la maison', pret: () => true,
  },
  style: {
    vue: 'coupe', plan: 'salon', etape: '3/4',
    intitule: 'Votre style ?',
    contenu: () => `<div class="tuiles">${STYLES.map(([id, l, sous]) => tuile(id, l.split(' et ')[0], etat.style === id, l + ' : ' + sous)).join('')}</div>`,
    clic: (id) => { etat.style = id; appliquerStyle(id); },
    suite: () => etat.style ? 'Monter à l’étage' : 'Choisissez un style', pret: () => !!etat.style,
  },
  etage: {
    vue: 'etage', plan: 'etage', etape: '3/4', bulle: { p: [5.96, 3.1, 1.35], t: '9 m²' },
    intitule: 'Cette pièce de 9 m² ?',
    contenu: () => `<div class="tuiles">${PIECE.map(([id, l]) => tuile(id, { bebe: 'Bébé', bureau: 'Bureau', sport: 'Sport' }[id], etat.piece === id, l)).join('')}</div>`
      + `<div class="compteur"><p>🛏️ Chambres idéales</p><div><button type="button" data-id="moins" aria-label="Une chambre de moins">−</button><output>${etat.chambres}</output><button type="button" data-id="plus" aria-label="Une chambre de plus">+</button></div></div>`,
    clic: (id) => { if (id === 'moins') etat.chambres = Math.max(1, etat.chambres - 1); else if (id === 'plus') etat.chambres = Math.min(6, etat.chambres + 1); else { etat.piece = id; zone9.visible = false; amenagerPiece(id); } },
    suite: () => etat.piece ? 'Chercher les clés' : 'Choisissez l’usage de la pièce', pret: () => !!etat.piece,
  },
  aventures: {
    vue: 'exterieur', plan: 'aventures', etape: '4/4',
    intitule: 'Votre aventure ?',
    contenu: () => `<div class="tuiles grandes">${AVENTURES.map(([id, t]) => tuile(id, '', etat.aventure === id, t)).join('')}</div>`,
    clic: (id) => { etat.aventure = id; if (id === 'noel') { chargerNoel(); montrerBoule(); } if (id === 'fete') chargerFete(); if (id === 'bebe') chargerNaissance(); },
    suite: () => etat.aventure ? 'Commencer l’aventure' : 'Voir ma maison', pret: () => !!etat.aventure,
  },
  cles: {
    vue: 'exterieur', plan: 'cles', etape: '🔑',
    intitule: () => cles.fini ? 'La maison est à vous !' : cles.en_cours ? `Clés : ${cles.trouvees}/3 · ${Math.ceil(cles.temps)} s` : cles.indice ? `Clés : ${cles.trouvees}/3 · touchez ce qui bouge` : 'La chasse aux clés',
    contenu: () => cles.fini ? `<div class="cadeau"><b>🎁 Bravo, vous avez trouvé les 3 clés !</b><span>Un cadeau vous attend : présentez cet écran à votre conseiller Clever’hom.</span></div>`
      : (cles.en_cours || cles.indice) ? `<div class="trousseau">${[0, 1, 2].map((i) => `<i class="${i < cles.trouvees ? 'ok' : ''}">🔑</i>`).join('')}</div>`
      : `<p class="accroche">Trois clés sont cachées dans le jardin. Touchez les objets pour les trouver : vous avez 45 secondes !</p>`,
    suite: () => cles.fini || cles.indice ? 'Continuer' : cles.en_cours ? 'Cherchez les clés…' : 'Commencer', pret: () => !cles.en_cours,
  },
  fete: {
    vue: 'coupe', plan: 'fete', etape: '🥂',
    intitule: () => fete.faite && !fete.pret ? 'Les invités arrivent…' : 'Touchez un invité !',
    contenu: () => `<div class="tuiles">${tuile('son', musique.on ? 'Musique' : 'Muet', musique.on, musique.on ? 'Couper la musique' : 'Remettre la musique')}${tuile('fort', 'Monter le son', fete.volume > 1, 'Monter le son')}</div>`,
    clic: (id) => { if (id === 'son') { if (musique.on) arreterMusique(); else demarrerMusique(); } if (id === 'fort') monterLeSon(); },
    suite: () => fete.faite ? 'Voir ma maison' : 'Lancer la fête', pret: () => true,
  },
  naissance: {
    vue: 'exterieur', plan: 'cigogne', etape: '👶',
    intitule: () => nais.pouf ? 'Bienvenue bébé !' : 'Une cigogne approche…',
    contenu: () => '',
    suite: () => 'Voir ma maison', pret: () => nais.pouf,
  },
  noel: {
    vue: 'exterieur', plan: 'noel', etape: '🎄',
    intitule: () => !noel.fait ? 'Touchez la boule de Noël !' : noel.dedans ? 'Le réveillon est prêt !' : 'Joyeux Noël !',
    contenu: () => '',
    suite: () => !noel.fait ? 'Ouvrir la boule' : noel.dedans ? 'Voir ma maison' : 'Entrer', pret: () => true,
  },
  fiche: {
    vue: 'exterieur', plan: 'fiche', etape: '✓',
    intitule: 'Sauvegarder mon résultat',
    contenu: () => {
      const lignes = [['Votre arbre', (ARBRES.find((x) => x.id === etat.arbre)?.nom || '—') + (etat.valeur ? ' · ' + libelle(VALEURS, etat.valeur).toLowerCase() : '')], ['La famille', composition()],
        ['Habitudes', [...new Set(etat.membres.flatMap((m) => m.habitudes))].map((h) => libelle(HABITUDES, h)).join(', ') || '—'],
        ['Le style', libelle(STYLES, etat.style)], ['La pièce de 9 m²', libelle(PIECE, etat.piece)], ['Chambres souhaitées', etat.chambres]];
      return `<details class="detail"><summary>Votre maison en résumé</summary><div>${lignes.map(([a, b]) => `<div class="ligne-recap"><span>${a}</span><b>${esc(b)}</b></div>`).join('')}</div></details>`
        + (etat.envoye ? `<p class="message">C'est noté ! Votre Clever’hom vous attend dans votre boîte mail. (Version de démonstration : l'e-mail n'est pas encore envoyé.)</p>` :
        `<p class="accroche">Recevez votre Clever’hom personnalisée par e-mail, avec le résumé de vos choix.</p>
        <div class="champs compact"><input id="prenom" aria-label="Prénom" placeholder="Prénom" autocomplete="given-name" value="${esc(etat.prenom || moi.prenom)}"><input id="nom" aria-label="Nom" placeholder="Nom" autocomplete="family-name" value="${esc(etat.nom)}"></div>
        <div class="champs compact"><input id="email" type="email" inputmode="email" aria-label="E-mail (obligatoire)" placeholder="E-mail *" autocomplete="email" required value="${esc(etat.email)}"><input id="tel" type="tel" inputmode="tel" aria-label="Téléphone" placeholder="Téléphone" autocomplete="tel" value="${esc(etat.tel)}"></div>
        <label class="consentement"><input type="checkbox" id="recevoir" ${etat.recevoir ? 'checked' : ''}><span>Je souhaite recevoir ma maison par e-mail.</span></label>
        <label class="consentement"><input type="checkbox" id="rappel" ${etat.rappel ? 'checked' : ''}><span>J'accepte d'être recontacté(e) par un conseiller Clever’hom pour parler de mon projet.</span></label>`);
    },
    suite: () => etat.envoye ? 'Recommencer' : 'Recevoir ma maison', pret: () => etat.envoye || (etat.recevoir && EMAIL_OK.test(etat.email.trim())),
  },
};

let ecran = 'accueil';
function aller(nom) {
  if (document.body.dataset.rituel) rituel(null);
  if (noel.fait && nom !== 'noel' && nom !== 'fiche') cacherNoel();
  if (fete.faite && nom !== 'fete' && nom !== 'fiche') arreterFete();
  if (nais.faite && nom !== 'naissance' && nom !== 'fiche') arreterNaissance();
  if (nom !== 'cles') arreterChasse();
  if (nom === 'fiche' && noel.groupe) for (const p of noel.groupe.children) if (p.userData.facade) p.visible = true;
  if (nom !== 'fete') arreterMusique(); // l'écran de fin doit capter l'attention : plus de musique
  ecran = nom; document.body.dataset.ecran = nom; synchroniserFamille();
  if (nom === 'noel') montrerBoule(); else if (noel.boule) noel.boule.visible = false;
  const e = ECRANS[nom];
  $('question').hidden = $('panneau').hidden = !e; $('bulle').hidden = true;
  if (!e) { montrer('exterieur'); planter(etat.arbre); viser('accueil'); controls.autoRotate = true; return; }
  controls.autoRotate = false;
  if (nom === 'noel' && noel.fait) vueNoel(noel.dedans); else { montrer(e.vue, e.famille !== false); viser(e.plan); }
  if (nom === 'arbre') { motte.visible = true; chargerMotte(); }
  dessiner();
}
function dessiner() {
  const e = ECRANS[ecran]; if (!e) return;
  $('etape').textContent = e.etape;
  $('pastille').hidden = !e.pastille; $('pastille').textContent = e.pastille || '';
  $('intitule').textContent = typeof e.intitule === 'function' ? e.intitule() : e.intitule;
  $('puces').innerHTML = e.puces ? e.puces().map(puceHtml).join('') : '';
  $('contenu').innerHTML = e.contenu();
  $('suite').textContent = e.suite(); $('suite').disabled = !e.pret();
}
async function choisirArbre(id) { etat.arbre = id; dessiner(); await planter(id); }

$('puces').addEventListener('click', (ev) => {
  const x = ev.target.closest('[data-suppr]');
  if (x) { const id = x.dataset.suppr; etat.membres = etat.membres.filter((m) => m.id !== id); if (etat.membre === id) etat.membre = etat.membres[0].id; synchroniserFamille(); dessiner(); return; }
  const b = ev.target.closest('.puce'); if (!b) return; ECRANS[ecran].puce(b.dataset.id); dessiner(); });
$('contenu').addEventListener('click', (ev) => { const b = ev.target.closest('[data-id],[data-type],[data-avatar],[data-action]'); if (!b || !ECRANS[ecran].clic) return; if (ECRANS[ecran].clic(b.dataset.id, b) !== 'partiel') dessiner(); });
let attenteAge = null;
$('contenu').addEventListener('change', (ev) => { if (ev.target.id === 'prenom-m') { const m = membreActif(); m.prenom = ev.target.value.trim() ? ev.target.value : ''; $('puces').innerHTML = ECRANS[ecran].puces().map(puceHtml).join(''); } });
$('contenu').addEventListener('input', (ev) => {
  if (ev.target.id === 'prenom-m') ev.target.classList.remove('manquant');
  if (ev.target.id === 'prenom') etat.prenom = ev.target.value;
  for (const k of ['nom', 'email', 'tel']) if (ev.target.id === k) etat[k] = ev.target.value;
  if (ev.target.id === 'recevoir' || ev.target.id === 'rappel') etat[ev.target.id] = ev.target.checked;
  if (ev.target.id === 'age-m') { clearTimeout(attenteAge); attenteAge = setTimeout(() => { const m = membreActif(), c = categorieAge(m.age);
    if (c && c !== m.type && m.type !== 'animal') { m.type = c; m.avatar = libreParmi(visages(c), m);
      if (c === 'enfant') m.habitudes = m.habitudes.filter((h) => HABITUDES_ENFANT.includes(h)); synchroniserFamille(); $('visages').innerHTML = visagesHtml(m); $('puces').innerHTML = ECRANS[ecran].puces().map(puceHtml).join(''); } }, 600); }
  if (ev.target.id === 'prenom-m' || ev.target.id === 'age-m') { const m = membreActif(); if (ev.target.id === 'prenom-m') m.prenom = ev.target.value.trim() ? ev.target.value : ''; else m.age = ev.target.value;
    const e = ECRANS[ecran]; $('puces').innerHTML = e.puces().map(puceHtml).join('');
 }
  $('suite').disabled = !ECRANS[ecran].pret(); $('suite').textContent = ECRANS[ecran].suite();
});
// ---------- le moment de l'arbre ----------
const VOEUX = { transmettre: 'Pour tout ce que vous transmettrez.', retrouver: 'Pour tous les moments où vous vous retrouverez.', recevoir: 'Pour tous ceux que vous recevrez.', ressourcer: 'Pour les jours où vous viendrez vous ressourcer.' };
function rituel(nom) { $('rituel-intro').classList.remove('tout'); $('rituel-plaque').classList.remove('tout'); document.body.dataset.rituel = nom || ''; if (!nom) delete document.body.dataset.rituel; $('rituel-intro').hidden = nom !== 'intro'; $('rituel-plaque').hidden = nom !== 'plaque'; }
async function ceremonie() {
  const a = ARBRES.find((x) => x.id === etat.arbre); const g = await arbres[a.id];
  $('plaque-date').textContent = 'Planté le ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · Wittelsheim';
  $('plaque-titre').textContent = 'Votre ' + a.nom.toLowerCase();
  $('plaque-voeu').textContent = VOEUX[etat.valeur] || a.texte;
  rituel('plaque'); viser('plantation');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { g.pivot.scale.setScalar(0.04); croissance = { pivot: g.pivot, t: 0 }; }
  $('rituel-famille').focus({ preventScroll: true });
}
$('rituel-choisir').addEventListener('click', () => rituel(null));
// un toucher sur le voile fait apparaître tout le texte d'un coup, pour qui ne veut pas attendre
for (const r of ['rituel-intro', 'rituel-plaque']) $(r).addEventListener('click', (ev) => { if (!ev.target.closest('button')) $(r).classList.add('tout'); });
$('rituel-famille').addEventListener('click', () => { if (croissance) { croissance.t = 1; avancerCroissance(0); } rituel(null); aller('famille'); });
$('suite').addEventListener('click', () => {
  if (ecran === 'cles' && !cles.fini && !cles.indice) { lancerChasse(); return; }
  if (ecran === 'fiche') { if (etat.envoye) { location.reload(); return; } etat.envoye = true; dessiner(); return; }
  if (ecran === 'arbre') { ceremonie(); return; }
  if (ecran === 'famille') { // le prénom du joueur est demandé ; on relit le champ (le remplissage automatique d'iOS ne prévient pas toujours)
    const champ = $('prenom-m'); if (champ && membreActif() === moi) moi.prenom = champ.value.trim() ? champ.value : '';
    if (!moi.prenom.trim()) { etat.membre = moi.id; etat.prenomManquant = true; dessiner(); const c = $('prenom-m'); c.classList.add('manquant'); c.focus(); return; }
    etat.prenomManquant = false; }
  if (ecran === 'aventures' && etat.aventure === 'noel') { aller('noel'); return; }
  if (ecran === 'aventures' && etat.aventure === 'fete') { aller('fete'); lancerFete().then(dessiner); return; }
  if (ecran === 'aventures' && etat.aventure === 'bebe') { aller('naissance'); lancerNaissance().then(dessiner); return; }
  if (ecran === 'fete' || ecran === 'naissance') { aller('fiche'); return; }
  if (ecran === 'noel') { if (!noel.fait) { ouvrirBoule(); return; } if (!noel.dedans) { vueNoel(true); dessiner(); return; } aller('fiche'); return; }
  aller(ORDRE[ORDRE.indexOf(ecran) + 1]);
});
$('retour').addEventListener('click', () => aller(ecran === 'noel' || ecran === 'fete' || ecran === 'naissance' ? 'aventures' : ecran === 'fiche' && noel.fait ? 'noel' : ORDRE[Math.max(0, ORDRE.indexOf(ecran) - 1)]));
$('jouer').addEventListener('click', () => { aller('arbre'); if (!etat.introVue) { etat.introVue = true; rituel('intro'); } });

// ---------- démarrage ----------
const mesures = {};
async function demarrer() {
  CATALOGUE = await (await fetch('assets/avatars/catalogue.json?v=' + Date.now())).json();
  const ATTENDU = 4.6e6; // maison, jardin et famille de départ
  for (const m of etat.membres.concat(VITRINE)) octets[m.avatar] = 0;
  const [ext, jardin] = await Promise.all(['maison-exterieur', 'jardin'].map((n) => charger(n, ATTENDU)));
  coques.exterieur = ext.scene; scene.add(ext.scene, jardin.scene); amenagerJardin(jardin.scene); poserJardin(); poserMassif(); poserCachettes();
  vue = 'exterieur'; await synchroniserFamille();
  montrer('exterieur'); viser('accueil', true);
  mesures.pret = (performance.now() - DEBUT) / 1000; mesures.premier = total;
  // écran d'ouverture : le logo reste au moins 2,4 s avant de s'effacer en fondu
  setTimeout(() => $('chargement').classList.add('fini'), Math.max(0, 2400 - (performance.now() - DEBUT)));
  $('jouer').disabled = false;
  // en arrière-plan : l'intérieur, la coupe, l'étage et le pommier
  const [inte, coupe, et, etage] = await Promise.all(['interieur', 'maison-coupe', 'maison-etage', 'etage'].map((n) => charger(n)));
  // plus de garage : on retire la voiture qui y était garée
  { const voiture = []; inte.scene.traverse((m) => { if (m.isMesh && new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z < -0.6) voiture.push(m); }); for (const m of voiture) m.removeFromParent(); }
  decor.interieur = inte.scene; decor.etage = etage.scene; coques.coupe = coupe.scene; coques.etage = et.scene;
  scene.add(inte.scene, etage.scene, coupe.scene, et.scene);
  // cage d'escalier vue de l'étage : le modèle ne contient que les marches du haut, un fond sombre fait lire la descente
  { const fond = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.82), new THREE.MeshBasicMaterial({ color: '#2b2622' })); fond.rotation.x = -Math.PI / 2; fond.position.set(4.225, 1.95, 4.76); et.scene.add(fond); }
  appliquerStyle(etat.style || 'moderne'); poserDeco('commun').then(visibiliteDeco); amenagerPiece(etat.piece || 'bureau');
  montrer(vue, ECRANS[ecran]?.famille !== false);
  if (!arbres.pommier) chargerArbre('pommier');
  mesures.complet = (performance.now() - DEBUT) / 1000; mesures.tout = total;
}
if (AMENAGEMENT) { const ouvrir = () => { $('chargement')?.classList.add('fini'); ouvrirAmenagement(); }; const att = setInterval(() => { if (coques.exterieur) { clearInterval(att); setTimeout(ouvrir, 300); } }, 300); }

// ---------- boucle ----------
const panneauMesures = $('mesures'); if (QS.has('mesures')) panneauMesures.hidden = false;
let images = 0, t0 = performance.now(), lent = 0;
const horloge = new THREE.Clock(); const tmp = new THREE.Vector3();
function image(dt) {
  for (const mx of mixers) mx.update(dt);
  avancerTrajet(dt); avancerCroissance(dt); avancerNoel(dt); avancerFete(dt); avancerNaissance(dt); avancerCles(dt); controls.update(); renderer.render(scene, camera);
  const b = ECRANS[ecran]?.bulle; const bulle = $('bulle');
  if (b && !trajet) { tmp.set(...b.p).project(camera); bulle.hidden = tmp.z > 1; bulle.textContent = b.t; bulle.style.left = ((tmp.x + 1) / 2) * zone3D().w + 'px'; bulle.style.top = ((1 - tmp.y) / 2) * zone3D().h + 'px';
    // pas de bulle par-dessus le bandeau ou le panneau (petits écrans) : elle cacherait les boutons
    const haut = $('question').getBoundingClientRect().bottom, bas = $('panneau').getBoundingClientRect().top, y = ((1 - tmp.y) / 2) * zone3D().h;
    if (y < haut + 36 || y > bas) bulle.hidden = true; }
  else bulle.hidden = true;
}
window.__image = (dt = 0.1) => { if (trajet) trajet.t = 1; avancerTrajet(0); image(dt); };
window.__cadrer = (pos, cible, fov = 40) => { PLANS.test = { pos, cible, fov }; viser('test', true); };
window.__noelDedans = () => { vueNoel(true); dessiner(); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__noel = async () => { await ouvrirBoule(); noel.pops.forEach((q) => { q.t = 1; }); avancerNoel(0); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__lourds = () => { const L = []; scene.traverseVisible((m) => { if (m.isMesh) { let o = m, chemin = ''; while (o.parent && o.parent !== scene) o = o.parent; L.push([((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3) | 0, m.name, o.name || o.uuid.slice(0, 4), m.castShadow]); } }); const par = {}; for (const [n, , r, c] of L) par[r + (c ? ' (ombre)' : '')] = (par[r + (c ? ' (ombre)' : '')] || 0) + n; return { top: L.sort((a, b) => b[0] - a[0]).slice(0, 15), racines: Object.entries(par).sort((a, b) => b[1] - a[1]).slice(0, 12) }; };
window.__perf = () => ({ triangles: renderer.info.render.triangles, appels: renderer.info.render.calls, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, ratio: renderer.getPixelRatio() });
// rendu en tuiles pour l'impression : une portion (x, y, w, h) d'une image de W × H pixels, à la définition exacte
window.__tuile = (W, H, x, y, w, h) => { renderer.setPixelRatio(1); renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  camera.aspect = W / H; camera.setViewOffset(W, H, x, y, w, h); camera.updateProjectionMatrix(); renderer.render(scene, camera); };
window.__bureau = () => { const L = []; decor.etage?.traverse((m) => { if (/bureau/.test(m.name)) L.push(m.type + ':' + m.name + ':' + m.visible); }); return L.join(' | ') + ' // posés ' + Object.keys(piecePosee).join(','); };
window.__cles = (t = 1) => { for (let i = 0; i < t * 20; i++) avancerCles(0.05); };
window.__fouiller = (id) => { const o = cles.objets.find((x) => x.id === id || (id === 'cle' && cles.avec.has(x.id))); if (o) fouiller(o); return o?.id; };
window.__fete = (t = 12) => { for (let i = 0; i < t * 10; i++) avancerFete(0.1); };
window.__naissance = (t = 12) => { for (let i = 0; i < t * 20; i++) avancerNaissance(0.05); };
window.__aller = (n) => { aller(n); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__rituel = async (n, t = 1) => { if (n === 'plaque') { await ceremonie(); if (trajet) { trajet.t = 1; avancerTrajet(0); } if (croissance) { croissance.t = 0; avancerCroissance(2.6 * t); } } else rituel(n); };
window.__famille = () => [...instances.entries()].map(([id, it]) => [id, it.avatar, it.obj.visible, it.obj.position.toArray().map((v) => +v.toFixed(2)), new THREE.Box3().setFromObject(it.obj).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))]);
window.__etat = () => ({ pret: !!mesures.pret, complet: !!mesures.complet, mesures, triangles: renderer.info.render.triangles, etat });
window.__choisir = (cle, val) => { etat[cle] = val; if (cle === 'style') appliquerStyle(val); if (cle === 'piece') { zone9.visible = false; amenagerPiece(val); } if (cle === 'arbre') return planter(val).then(dessiner); dessiner(); };
if (!QS.has('capture')) renderer.setAnimationLoop(() => {
  image(Math.min(horloge.getDelta(), 0.1));
  images++; const t = performance.now();
  if (t - t0 > 1000) { const ips = (images * 1000) / (t - t0); images = 0; t0 = t;
    // moins de 40 images/s deux secondes de suite : on baisse la définition, puis on coupe les ombres douces
    // (pas pendant un chargement : la première image d'un nouveau modèle est toujours lente)
    if (ips < 40 && !document.hidden && performance.now() - dernierChargement > 3000) { lent++; if (lent >= 2 && qualite > 0.55) { qualite -= 0.15; taille(); lent = 0; } } else lent = 0;
    if (!panneauMesures.hidden) panneauMesures.textContent = ['images/s : ' + ips.toFixed(0), 'triangles : ' + renderer.info.render.triangles.toLocaleString('fr-FR'),
      'prêt en : ' + (mesures.pret ? mesures.pret.toFixed(1) + ' s (' + (mesures.premier / 1e6).toFixed(1) + ' Mo)' : '…'),
      'tout en : ' + (mesures.complet ? mesures.complet.toFixed(1) + ' s (' + (mesures.tout / 1e6).toFixed(1) + ' Mo)' : '…')].join('\n'); }
});

demarrer().catch((e) => { const t = $('texte'); t.textContent = 'Le chargement a échoué. Rechargez la page.'; t.classList.remove('visuellement-cache'); console.error(e); });
window.__info = () => { let tex = 0; const vu = new Set(); scene.traverse((o) => { if (!o.visible || !o.material) return; for (const m of [].concat(o.material)) for (const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']) { const t = m[k]; if (t?.image && !vu.has(t)) { vu.add(t); tex += (t.image.width || 0) * (t.image.height || 0) * 4 * 1.33; } } }); return { appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, programmes: renderer.info.programs.length, textures: renderer.info.memory.textures, texturesVisiblesMo: Math.round(tex / 1e6) }; };
window.__ecran = (id) => { const a = amen.objets.get(id); if (!a) return null; const v = new THREE.Box3().setFromObject(a.o).getCenter(new THREE.Vector3()).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height, a.o.position.x, a.o.position.z]; };
