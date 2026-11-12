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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
scene.add(new THREE.HemisphereLight('#fff0e0', '#c7b48e', 1.05));
const soleil = new THREE.DirectionalLight('#ffdcb5', 3.1);
soleil.position.set(-12, 22, -4); soleil.target.position.set(2, 0, 3);
soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.03;
scene.add(soleil, soleil.target);

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, enablePan: false, minDistance: 5, maxDistance: 34, maxPolarAngle: 1.32, autoRotate: true, autoRotateSpeed: -0.6 });

function taille() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', taille); taille();

// ---------- plans de caméra (position, cible, angle de champ) ----------
const PLANS = {
  accueil: { pos: [-22, 8, -6], cible: [1.0, 1.4, 3.2], fov: 46 },
  arbre: { pos: [-10.4, 6.0, -3.4], cible: [-5.6, 0.6, 1.3], fov: 50 },
  plantation: { pos: [-12.6, 3.0, -4.7], cible: [-5.6, 0.5, 0.9], fov: 46 },
  famille: { pos: [-14.3, 2.3, 3.7], cible: [-4.6, -0.35, 3.7], fov: 44 },
  salon: { pos: [5.5, 10, -1.5], cible: [1.4, -0.9, 4.1], fov: 38 },
  etage: { pos: [-19, 31, -2], cible: [2.6, 1.2, 2.2], fov: 26 },
  aventures: { pos: [-22, 9, -6], cible: [1.0, -3.2, 3.2], fov: 46 },
  noel: { pos: [-12.2, 2.3, 7.2], cible: [-6.4, 0.25, 3.1], fov: 46 },
  noelDehors: { pos: [-15, 4.0, 6.8], cible: [-2.2, 1.1, 2.0], fov: 50 },
  noelMaison: { pos: [6.6, 9.2, -4.6], cible: [1.2, -0.6, 1.9], fov: 48 },
  fiche: { pos: [-20, 12, -8], cible: [0.5, -5.5, 3.0], fov: 46 },
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
    .then((g) => { g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = !m.material.transparent; m.receiveShadow = true; } }); total += octets[nom] || 0; return g; });
}
const coques = {}; const decor = {}; const arbres = {};

// ---------- la famille du joueur ----------
// emplacements (x, y, z, orientation) pour les personnes puis les animaux, dans chaque vue
const PLACES = {
  // jardin : deux rangs entre le cerisier (qui cache tout ce qui est en deçà de z ≈ 3,2) et la haie (z ≈ 5,6) ; les animaux devant
  exterieur: { gens: [[-4.75, -0.32, 3.55, -1.75], [-4.75, -0.32, 4.2, -1.55], [-4.75, -0.32, 4.85, -1.4], [-4.75, -0.32, 5.45, -1.3], [-4.1, -0.32, 3.85, -1.7], [-4.1, -0.32, 4.5, -1.55], [-4.1, -0.32, 5.15, -1.4], [-4.1, -0.32, 3.35, -1.8]],
    betes: [[-5.45, -0.32, 3.75, 2.27], [-5.45, -0.32, 4.45, 1.9], [-5.45, -0.32, 5.15, 2.0], [-5.95, -0.32, 4.1, 2.5], [-5.95, -0.32, 4.8, 2.6], [-5.95, -0.32, 3.5, 1.8]] },
  coupe: { gens: [[5.0, 0, 2.0, 2.36], [2.9, 0, 2.55, -1.88], [3.7, 0, 1.3, 3.0], [1.9, 0, 3.2, -1.0], [4.5, 0, 3.1, 2.8], [2.2, 0, 0.9, 0.5], [0.9, 0, 1.9, 1.2], [6.6, 0, 3.2, 2.6]],
    betes: [[1.4, 0, 3.6, 0.6], [2.6, 0, 4.1, 1.5], [0.9, 0, 2.6, 1.0], [4.0, 0, 2.4, 2.4], [2.0, 0, 1.6, 0.2], [5.5, 0, 1.5, 3.0]] },
  etage: { gens: [[1.4, 2.9, 3.9, 0.5], [3.55, 2.9, 1.3, -1.57], [4.1, 2.9, 3.25, -2.2], [2.5, 2.9, 4.7, 0.8], [3.0, 2.9, 0.5, -1.2], [4.6, 2.9, 3.4, -2.6], [0.8, 2.9, 3.0, 0.3], [2.0, 2.9, 2.2, 0]],
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
async function synchroniserFamille() {
  const ids = new Set(etat.membres.map((m) => m.id));
  for (const [id, it] of instances) if (!ids.has(id)) { scene.remove(it.obj); if (it.mixer) mixers.delete(it.mixer); instances.delete(id); }
  await Promise.all(etat.membres.map(async (m) => {
    const it = instances.get(m.id); if (it && it.avatar === m.avatar) return;
    const g = await modele(m.avatar); if (etat.membres.find((x) => x.id === m.id)?.avatar !== m.avatar) return;
    const old = instances.get(m.id); if (old) { scene.remove(old.obj); if (old.mixer) mixers.delete(old.mixer); }
    let obj, mixer = null;
    if (ANIMAUX[m.avatar]) { obj = new THREE.Group(); const c = g.scene.clone(true); obj.add(c); const bb = new THREE.Box3().setFromObject(c); c.scale.setScalar(ANIMAUX[m.avatar].h / (bb.max.y - bb.min.y)); c.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(c); const cc = b2.getCenter(new THREE.Vector3()); c.position.set(-cc.x, -b2.min.y, -cc.z); }
    else { obj = SkeletonUtils.clone(g.scene); if (g.animations[0]) { mixer = new THREE.AnimationMixer(obj); mixer.clipAction(g.animations[0]).play(); mixer.setTime(Math.random() * 3); mixers.add(mixer); } }
    obj.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; } });
    obj.updateMatrixWorld(true); const h = new THREE.Box3().setFromObject(obj).max.y;
    scene.add(obj); instances.set(m.id, { avatar: m.avatar, obj, mixer, h });
  }));
  placerFamille();
}
function placerFamille() {
  const P = PLACES[VUES[vue]?.famille || 'exterieur']; let g = 0, b = 0;
  for (const m of etat.membres) { const it = instances.get(m.id); if (!it) continue;
    const animal = !!ANIMAUX[m.avatar]; const pl = animal ? P.betes[b++] : P.gens[g++];
    it.obj.visible = familleVisible && !!pl && !(animal && vue === 'etage');
    if (pl) { it.obj.position.set(pl[0], pl[1], pl[2]); it.obj.rotation.y = pl[3] + (animal ? ANIMAUX[m.avatar].r : 0); } }
}

// zone de la pièce de 9 m², surlignée en corail à l'étage
const zone9 = new THREE.Mesh(new THREE.PlaneGeometry(3.24, 2.61), new THREE.MeshBasicMaterial({ color: '#f68f7c', transparent: true, opacity: 0.4, depthWrite: false }));
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
      { f: 'fauteuil_parents', haut: 0.8, x: 2.6, y: 2.9, z: 0.5, r: -2.42, etage: true }, // chambre parentale : fauteuil (Clotilde Ngoma, Maride) dans l'angle, tourné vers le lit
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
const cache = (nom, m) => { if (nom !== 'commun' && noelActif && NOEL_CACHE.test(m.name)) return true; const c = DECO[nom]?.cacher; return !!c && (typeof c === 'function' ? c(m) : c.test(m.name)); };
async function poserDeco(nom) {
  if (decoPosee[nom]) return decoPosee[nom]; const D = DECO[nom];
  const groupe = new THREE.Group(); decoPosee[nom] = groupe; groupe.visible = false; scene.add(groupe);
  await Promise.all(D.poser.map(async (p) => { const g = await charger('deco/' + p.f); const o = g.scene;
    const t = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); o.scale.multiplyScalar(p.haut ? p.haut / t.y : p.long / Math.max(t.x, t.z));
    if (p.ech) o.scale.multiply(new THREE.Vector3(...p.ech));
    const pivot = new THREE.Group(); pivot.add(o); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    o.position.set(-c.x, -b.min.y, -c.z); pivot.position.set(p.x, p.y, p.z); pivot.rotation.y = p.r; pivot.userData.etage = !!p.etage; pivot.userData.f = p.f;
    o.traverse((m) => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true; if (p.verre && p.verre.test(m.name)) m.material = VERRE; if (!p.etage) for (const mt of [].concat(m.material)) mt.clippingPlanes = COUPE_RDC; }); groupe.add(pivot); }));
  return groupe;
}
// meubles du rez-de-chaussée visibles quand l'intérieur l'est, ceux de l'étage quand l'étage l'est
function visibiliteDeco() {
  for (const [k, g] of Object.entries(decoPosee)) { g.visible = k === 'commun' || k === styleActif;
    for (const p of g.children) p.visible = (p.userData.etage ? !!decor.etage?.visible : !!decor.interieur?.visible) && !(noelActif && /^(table|tulipes)$/.test(p.userData.f)); }
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
  { f: 'village', long: 0.55, p: [[-1.35, 0.9, 1.55, 0.5]] },                                  // village de Noël sur la table de la terrasse
  { f: 'boule_deco', haut: 0.55, p: [[-6.3, -0.32, 2.6, 0], [-6.9, -0.32, 3.3, 1], [-3.5, -0.32, 0.4, 2]] },
  { f: 'sucres', haut: 0.6, p: [[-3.1, -0.32, 0.9, 0], [-3.1, -0.32, 2.1, 0], [-3.1, -0.32, 6.6, 0], [-3.1, -0.32, -0.3, 0]] },
  { f: 'bonhomme1', haut: 1.3, p: [[-7.0, -0.32, 3.7, -2.76], [-3.7, -0.32, 6.4, -2.4]] },        // bonshommes de neige (LeionaChung, bojackart)
  { f: 'bonhomme2', haut: 1.0, p: [[-8.3, -0.32, 2.2, -1.19], [-2.9, -0.32, -1.6, -1.6]] },
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
      o.traverse((m) => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
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
function cacherNoel() { if (noel.groupe) noel.groupe.visible = false; if (noel.boule) noel.boule.visible = false; noel.fait = false; noelActif = false; appliquerStyle(styleActif); }
async function ouvrirBoule() {
  if (noel.fait) return; noel.fait = true; confettis();
  if (noel.boule) noel.boule.visible = false;
  dessiner(); await chargerNoel();
  noelActif = true; noel.dedans = false; appliquerStyle(styleActif); montrer('exterieur', true); viser('noelDehors');
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
  const COUL = ['#ee3f81', '#f68f7c', '#7bae8a', '#f4c542', '#d6382f', '#ffffff', '#2f8f4e'];
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
  souris.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1); rayon.setFromCamera(souris, camera);
  if (rayon.intersectObject(noel.boule, true).length) ouvrirBoule();
});

// ---------- vues de la maison ----------
let vue = null;
const VUES = {
  exterieur: { coque: 'exterieur', interieur: true, etage: false, famille: 'exterieur' },
  coupe: { coque: 'coupe', interieur: true, etage: false, famille: 'coupe' },
  etage: { coque: 'etage', interieur: false, etage: true, famille: 'etage' },
};
function montrer(nom, fam = true) {
  vue = nom; const v = VUES[nom]; familleVisible = fam;
  for (const [k, o] of Object.entries(coques)) o.visible = k === v.coque;
  if (decor.interieur) decor.interieur.visible = v.interieur;
  if (decor.etage) decor.etage.visible = v.etage;
  zone9.visible = nom === 'etage'; visibiliteDeco();
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
  if (!croissance) return; croissance.t = Math.min(1, croissance.t + dt / 2.6);
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
const etat = { valeur: null, arbre: null, membres: [moi], membre: moi.id, style: null, piece: null, chambres: 3, aventure: null, prenom: '', contact: '', accord: false, envoye: false };

const ARBRES = [
  { id: 'pommier', nom: 'Pommier', le: 'le pommier', couleur: '#d6382f', titre: 'Le pommier · ce qui se transmet', texte: "Planté par vous, cueilli par vos enfants, puis par les leurs. L'arbre des vergers alsaciens." },
  { id: 'cerisier', nom: 'Cerisier', le: 'le cerisier', couleur: '#f4b6c8', titre: 'Le cerisier · les moments heureux', texte: "Quand il fleurit, toute la famille sort au jardin. Le rendez-vous de chaque printemps." },
  { id: 'lilas', nom: 'Lilas', le: 'le lilas', couleur: '#b48ad6', titre: "Le lilas · l'accueil", texte: "En mai, son parfum accueille vos invités dès le portail. Et il y a toujours un bouquet à offrir." },
  { id: 'noisetier', nom: 'Noisetier', le: 'le noisetier', couleur: '#a8743f', titre: 'Le noisetier · le calme', texte: "Un coin d'ombre où l'on vient souffler. À l'automne, les noisettes se ramassent sans se presser." },
];
// chaque valeur oriente vers un arbre ; la petite phrase dit ce qu'elle veut dire, concrètement, dans une maison
const VALEURS = [
  ['transmettre', 'Transmettre', 'pommier', 'Bâtir ce qui restera à vos enfants'],
  ['retrouver', 'Se retrouver', 'cerisier', 'Les repas, les rires, la famille réunie'],
  ['recevoir', 'Recevoir', 'lilas', 'Une maison ouverte aux amis et aux voisins'],
  ['ressourcer', 'Se ressourcer', 'noisetier', 'Un coin de calme pour souffler'],
];
let CATALOGUE = { adulte: [], senior: [], enfant: [], animal: ['chien', 'chat'] };
// l'âge décide de la catégorie : il ne reste à choisir que personne ou animal
const TYPES = [['personne', 'Personne'], ['animal', 'Animal']];
const AJOUTS = [['adulte', '+ Adulte'], ['enfant', '+ Enfant'], ['senior', '+ Senior'], ['animal', '+ Animal']];
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
const PIECE = [['bureau', 'Bureau', 'pour télétravailler'], ['amis', "Chambre d'amis", 'pour recevoir'], ['jeux', 'Salle de jeux', 'pour les enfants'], ['sport', 'Salle de sport', 'pour bouger'], ['bebe', 'Chambre de bébé', 'pour la suite']];
const AVENTURES = [
  ['noel', 'La bombe de Noël', 'Une boule éclate et toute la maison s’habille de lumières et de neige.', 'De saison', '#ee3f81'],
  ['fete', 'La crémaillère', 'Guirlandes, platines et grande tablée : les voisins débarquent.', 'Avec les voisins', '#f68f7c'],
  ['bebe', 'La famille s’agrandit', 'Une cigogne arrive : la pièce de 9 m² devient la chambre de bébé.', 'Une maison qui évolue', '#7bae8a'],
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
const ORDRE = ['accueil', 'arbre', 'famille', 'style', 'etage', 'aventures', 'fiche'];
const ECRANS = {
  arbre: {
    vue: 'exterieur', famille: false, plan: 'arbre', etape: 'Étape 1 sur 4 · Votre arbre', pastille: 'Pousse en Alsace',
    // avant le choix : la terre est déjà retournée et une bulle montre où l'arbre sera planté
    get bulle() { return etat.arbre ? null : { p: [terre.position.x, 0.25, terre.position.z], t: 'Votre arbre ici' }; },
    intitule: 'Avant d’entrer, qu’est-ce qui compte le plus pour vous ?',
    puces: () => VALEURS.map(([id, l, , sous]) => ({ id, l, sous, on: etat.valeur === id })),
    puce: (id) => { etat.valeur = id; choisirArbre(VALEURS.find((v) => v[0] === id)[2]); },
    contenu: () => { const a = ARBRES.find((x) => x.id === etat.arbre);
      return `<div class="grille quatre">${ARBRES.map((x) => `<button type="button" class="choix arbre" data-id="${x.id}" aria-pressed="${etat.arbre === x.id}"><i style="background:${x.couleur}"></i><b>${x.nom}</b></button>`).join('')}</div>`
        + (a ? `<div class="encart">${(() => { const v = VALEURS.find((x) => x[0] === etat.valeur && x[2] === a.id); return v ? `<p class="etiquette">Pour ${v[1].toLowerCase()}</p>` : ''; })()}<p class="titre-panneau">${a.titre}</p><p class="sous">${a.texte}</p></div>`
          : `<p class="sous">Chaque réponse vous oriente vers un arbre. Vous restez libre de choisir celui qui vous plaît.</p>`); },
    clic: (id) => choisirArbre(id),
    suite: () => etat.arbre ? 'Planter ' + ARBRES.find((x) => x.id === etat.arbre).le : 'Choisissez un arbre', pret: () => !!etat.arbre,
  },
  famille: {
    vue: 'exterieur', plan: 'famille', etape: 'Étape 2 sur 4 · Votre famille',
    intitule: () => `Votre ${ARBRES.find((x) => x.id === etat.arbre)?.nom.toLowerCase() || 'arbre'} est planté. Qui va vivre ici avec vous ?`,
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
      return `<div class="champs"><div class="champ"><label for="prenom-m">${m.moi ? 'Votre prénom' : 'Prénom'}</label><input id="prenom-m" autocomplete="${m.moi ? 'given-name' : 'off'}" maxlength="20" placeholder="${animal ? 'Son nom' : m.moi ? 'Votre prénom' : 'Son prénom'}" value="${esc(m.prenom)}"></div>`
        + (animal ? '' : `<div class="champ age"><label for="age-m">Âge</label><input id="age-m" type="number" inputmode="numeric" min="0" max="110" placeholder="ans" value="${esc(m.age)}"></div>`) + `</div>`
        + (m.moi ? '' : `<div class="onglets">${TYPES.map(([t, l]) => `<button type="button" class="puce" data-type="${t}" aria-pressed="${t === 'animal' ? animal : !animal}">${l}</button>`).join('')}</div>`)
        + `<div id="visages">${visagesHtml(m)}</div>`
        + (animal ? '' : `<div class="habitudes"><p class="titre-habitudes">${m.moi ? 'Vos habitudes' : 'Ses habitudes'} à la maison <span class="sous">plusieurs choix</span></p><div class="puces-habitudes">${HABITUDES.filter(([id]) => m.type !== 'enfant' || HABITUDES_ENFANT.includes(id)).map(([id, l]) => `<button type="button" class="puce" data-id="${id}" aria-pressed="${m.habitudes.includes(id)}">${l}</button>`).join('')}</div></div>`);
    },
    clic: (id, el) => {
      const m = membreActif();
      if (el.dataset.type) { const animal = el.dataset.type === 'animal'; if (animal !== (m.type === 'animal')) { m.type = animal ? 'animal' : (categorieAge(m.age) || 'adulte'); m.avatar = visages(m.type)[0]; m.habitudes = []; if (animal) m.age = ''; synchroniserFamille(); } return; }
      if (el.dataset.avatar) { m.avatar = el.dataset.avatar; synchroniserFamille(); return; }
      const i = m.habitudes.indexOf(id); if (i >= 0) m.habitudes.splice(i, 1); else m.habitudes.push(id);
    },
    suite: () => moi.prenom.trim() ? 'Entrer dans la maison' : 'Indiquez votre prénom', pret: () => !!moi.prenom.trim(),
  },
  style: {
    vue: 'coupe', plan: 'salon', etape: 'Étape 3 sur 4 · Votre intérieur',
    intitule: 'À quoi ressemblera votre Clever’hom ?',
    contenu: () => `<div class="grille">${STYLES.map(([id, l, sous]) => choix(id, l, sous, etat.style === id)).join('')}</div>`
      + (etat.style ? '' : `<p class="sous">Touchez un style : toute la maison s’habille en direct.</p>`),
    clic: (id) => { etat.style = id; appliquerStyle(id); },
    suite: () => etat.style ? 'Monter à l’étage' : 'Choisissez un style', pret: () => !!etat.style,
  },
  etage: {
    vue: 'etage', plan: 'etage', etape: 'Étape 3 sur 4 · Qui dort où ?', bulle: { p: [5.96, 3.1, 1.35], t: '9 m² · à vous de choisir' },
    intitule: () => `${prenoms()}… et une pièce de 9 m² à imaginer.`,
    contenu: () => `<p class="titre-panneau">Cette pièce devient…</p><div class="grille trois">${PIECE.map(([id, l, s]) => choix(id, l, s, etat.piece === id)).join('')}</div>`
      + `<div class="compteur"><p>Idéalement, combien de chambres vous faudrait-il ?</p><div><button type="button" data-id="moins" aria-label="Une chambre de moins">−</button><output>${etat.chambres}</output><button type="button" data-id="plus" aria-label="Une chambre de plus">+</button></div></div>`,
    clic: (id) => { if (id === 'moins') etat.chambres = Math.max(1, etat.chambres - 1); else if (id === 'plus') etat.chambres = Math.min(6, etat.chambres + 1); else etat.piece = id; },
    suite: () => etat.piece ? 'Choisir une aventure' : 'Choisissez l’usage de la pièce', pret: () => !!etat.piece,
  },
  aventures: {
    vue: 'exterieur', plan: 'aventures', etape: 'Étape 4 sur 4 · Votre aventure',
    intitule: 'La famille est installée. Place à la vie !',
    contenu: () => AVENTURES.map(([id, t, s, tag, c]) => `<button type="button" class="choix aventure" data-id="${id}" aria-pressed="${etat.aventure === id}"><div><span class="tag" style="background:${c}">${tag}</span><b>${t}</b><span>${s}</span></div></button>`).join('')
      + (etat.aventure && etat.aventure !== 'noel' ? `<p class="message">Cette aventure arrive dans la prochaine version. Votre choix est noté.</p>` : `<p class="sous">Environ 2 minutes par aventure.</p>`),
    clic: (id) => { etat.aventure = id; if (id === 'noel') { chargerNoel(); montrerBoule(); } },
    suite: () => etat.aventure === 'noel' ? 'Commencer l’aventure' : 'Voir ma maison', pret: () => !!etat.aventure,
  },
  noel: {
    vue: 'exterieur', plan: 'noel', etape: 'Aventure · La bombe de Noël',
    intitule: () => !noel.fait ? 'Vous avez trouvé une boule de Noël ! Touchez-la pour décorer votre maison.' : noel.dedans ? 'Le réveillon est prêt !' : 'Joyeux Noël chez vous !',
    contenu: () => !noel.fait ? `<p class="sous">La boule brille dans le jardin. Touchez-la, ou utilisez le bouton.</p>`
      : noel.dedans ? `<p class="titre-panneau">Sapin, cadeaux et table de fête</p><p class="sous">Faites tourner la maison pour tout voir.</p>`
      : `<p class="titre-panneau">Guirlandes, sapins enneigés et traîneau</p><p class="sous">La Clever’hom s’est habillée pour les fêtes. Entrez voir le salon !</p>`,
    suite: () => !noel.fait ? 'Ouvrir la boule de Noël' : noel.dedans ? 'Voir ma maison' : 'Entrer dans la maison', pret: () => true,
  },
  fiche: {
    vue: 'exterieur', plan: 'fiche', etape: 'Partie terminée', pastille: '4 sur 4',
    intitule: 'Bravo ! Votre Clever’hom est prête.',
    contenu: () => {
      const lignes = [['Votre arbre', (ARBRES.find((x) => x.id === etat.arbre)?.nom || '—') + (etat.valeur ? ' · ' + libelle(VALEURS, etat.valeur).toLowerCase() : '')], ['La famille', composition()],
        ['Habitudes', [...new Set(etat.membres.flatMap((m) => m.habitudes))].map((h) => libelle(HABITUDES, h)).join(', ') || '—'],
        ['Le style', libelle(STYLES, etat.style)], ['La pièce de 9 m²', libelle(PIECE, etat.piece)], ['Chambres souhaitées', etat.chambres]];
      return `<div>${lignes.map(([a, b]) => `<div class="ligne-recap"><span>${a}</span><b>${esc(b)}</b></div>`).join('')}</div>`
        + (etat.envoye ? `<p class="message">C'est noté ! Dans cette version de démonstration, la fiche n'est pas encore transmise au conseiller.</p>` :
        `<div class="champs"><div class="champ"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" value="${esc(etat.prenom || moi.prenom)}"></div><div class="champ"><label for="contact">Téléphone ou e-mail</label><input id="contact" autocomplete="tel" value="${esc(etat.contact)}"></div></div>
        <label class="consentement"><input type="checkbox" id="accord" ${etat.accord ? 'checked' : ''}><span>J'accepte qu'un conseiller Clever'hom me recontacte au sujet de ma future maison.</span></label>`);
    },
    suite: () => etat.envoye ? 'Recommencer' : 'Envoyer au conseiller', pret: () => etat.envoye || (etat.accord && etat.contact.trim().length >= 6),
  },
};

let ecran = 'accueil';
function aller(nom) {
  if (document.body.dataset.rituel) rituel(null);
  if (noel.fait && nom !== 'noel' && nom !== 'fiche') cacherNoel();
  if (nom === 'fiche' && noel.groupe) for (const p of noel.groupe.children) if (p.userData.facade) p.visible = true;
  ecran = nom; document.body.dataset.ecran = nom;
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
$('contenu').addEventListener('click', (ev) => { const b = ev.target.closest('[data-id],[data-type],[data-avatar],[data-action]'); if (!b || !ECRANS[ecran].clic) return; ECRANS[ecran].clic(b.dataset.id, b); dessiner(); });
let attenteAge = null;
$('contenu').addEventListener('input', (ev) => {
  if (ev.target.id === 'prenom') etat.prenom = ev.target.value;
  if (ev.target.id === 'contact') etat.contact = ev.target.value;
  if (ev.target.id === 'accord') etat.accord = ev.target.checked;
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
  if (ecran === 'fiche') { if (etat.envoye) { location.reload(); return; } etat.envoye = true; dessiner(); return; }
  if (ecran === 'arbre') { ceremonie(); return; }
  if (ecran === 'aventures' && etat.aventure === 'noel') { aller('noel'); return; }
  if (ecran === 'noel') { if (!noel.fait) { ouvrirBoule(); return; } if (!noel.dedans) { vueNoel(true); dessiner(); return; } aller('fiche'); return; }
  aller(ORDRE[ORDRE.indexOf(ecran) + 1]);
});
$('retour').addEventListener('click', () => aller(ecran === 'noel' ? 'aventures' : ecran === 'fiche' && noel.fait ? 'noel' : ORDRE[Math.max(0, ORDRE.indexOf(ecran) - 1)]));
$('jouer').addEventListener('click', () => { aller('arbre'); if (!etat.introVue) { etat.introVue = true; rituel('intro'); } });

// ---------- démarrage ----------
const mesures = {};
async function demarrer() {
  CATALOGUE = await (await fetch('assets/avatars/catalogue.json?v=' + Date.now())).json();
  const ATTENDU = 4.6e6; // maison, jardin et famille de départ
  for (const m of etat.membres) octets[m.avatar] = 0;
  const [ext, jardin] = await Promise.all(['maison-exterieur', 'jardin'].map((n) => charger(n, ATTENDU)));
  coques.exterieur = ext.scene; scene.add(ext.scene, jardin.scene);
  vue = 'exterieur'; await synchroniserFamille();
  montrer('exterieur'); viser('accueil', true);
  mesures.pret = (performance.now() - DEBUT) / 1000; mesures.premier = total;
  // écran d'ouverture : le logo reste au moins 2,4 s avant de s'effacer en fondu
  setTimeout(() => $('chargement').classList.add('fini'), Math.max(0, 2400 - (performance.now() - DEBUT)));
  $('jouer').disabled = false;
  // en arrière-plan : l'intérieur, la coupe, l'étage et le pommier
  const [inte, coupe, et, etage] = await Promise.all(['interieur', 'maison-coupe', 'maison-etage', 'etage'].map((n) => charger(n)));
  decor.interieur = inte.scene; decor.etage = etage.scene; coques.coupe = coupe.scene; coques.etage = et.scene;
  scene.add(inte.scene, etage.scene, coupe.scene, et.scene);
  appliquerStyle(etat.style || 'moderne'); poserDeco('commun').then(visibiliteDeco);
  montrer(vue, ECRANS[ecran]?.famille !== false);
  if (!arbres.pommier) chargerArbre('pommier');
  mesures.complet = (performance.now() - DEBUT) / 1000; mesures.tout = total;
}

// ---------- boucle ----------
const panneauMesures = $('mesures'); if (QS.has('mesures')) panneauMesures.hidden = false;
let images = 0, t0 = performance.now();
const horloge = new THREE.Clock(); const tmp = new THREE.Vector3();
function image(dt) {
  for (const mx of mixers) mx.update(dt);
  avancerTrajet(dt); avancerCroissance(dt); avancerNoel(dt); controls.update(); renderer.render(scene, camera);
  const b = ECRANS[ecran]?.bulle; const bulle = $('bulle');
  if (b && !trajet) { tmp.set(...b.p).project(camera); bulle.hidden = tmp.z > 1; bulle.textContent = b.t; bulle.style.left = ((tmp.x + 1) / 2) * innerWidth + 'px'; bulle.style.top = ((1 - tmp.y) / 2) * innerHeight + 'px'; }
  else bulle.hidden = true;
}
window.__image = (dt = 0.1) => { if (trajet) trajet.t = 1; avancerTrajet(0); image(dt); };
window.__cadrer = (pos, cible, fov = 40) => { PLANS.test = { pos, cible, fov }; viser('test', true); };
window.__noelDedans = () => { vueNoel(true); dessiner(); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__noel = async () => { await ouvrirBoule(); noel.pops.forEach((q) => { q.t = 1; }); avancerNoel(0); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__aller = (n) => { aller(n); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__rituel = async (n, t = 1) => { if (n === 'plaque') { await ceremonie(); if (trajet) { trajet.t = 1; avancerTrajet(0); } if (croissance) { croissance.t = 0; avancerCroissance(2.6 * t); } } else rituel(n); };
window.__famille = () => [...instances.entries()].map(([id, it]) => [id, it.avatar, it.obj.visible, it.obj.position.toArray().map((v) => +v.toFixed(2)), new THREE.Box3().setFromObject(it.obj).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))]);
window.__etat = () => ({ pret: !!mesures.pret, complet: !!mesures.complet, mesures, triangles: renderer.info.render.triangles, etat });
window.__choisir = (cle, val) => { etat[cle] = val; if (cle === 'style') appliquerStyle(val); if (cle === 'arbre') return planter(val).then(dessiner); dessiner(); };
if (!QS.has('capture')) renderer.setAnimationLoop(() => {
  image(Math.min(horloge.getDelta(), 0.1));
  images++; const t = performance.now();
  if (t - t0 > 1000) { const ips = (images * 1000) / (t - t0); images = 0; t0 = t;
    if (!panneauMesures.hidden) panneauMesures.textContent = ['images/s : ' + ips.toFixed(0), 'triangles : ' + renderer.info.render.triangles.toLocaleString('fr-FR'),
      'prêt en : ' + (mesures.pret ? mesures.pret.toFixed(1) + ' s (' + (mesures.premier / 1e6).toFixed(1) + ' Mo)' : '…'),
      'tout en : ' + (mesures.complet ? mesures.complet.toFixed(1) + ' s (' + (mesures.tout / 1e6).toFixed(1) + ' Mo)' : '…')].join('\n'); }
});

demarrer().catch((e) => { const t = $('texte'); t.textContent = 'Le chargement a échoué. Rechargez la page.'; t.classList.remove('visuellement-cache'); console.error(e); });
