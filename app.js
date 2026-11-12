// Ma Maison en Jeu : le parcours du joueur dans la Clever'hom, en 3D sur téléphone.
// Accueil → arbre → famille → salon → qui dort où → aventure → fiche pour le conseiller.
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
  famille: { pos: [-14.3, 2.3, 3.7], cible: [-4.6, -0.35, 3.7], fov: 44 },
  salon: { pos: [5.5, 10, -1.5], cible: [1.4, -0.9, 4.1], fov: 38 },
  etage: { pos: [-19, 31, -2], cible: [2.6, 1.2, 2.2], fov: 26 },
  aventures: { pos: [-22, 9, -6], cible: [1.0, -3.2, 3.2], fov: 46 },
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
  exterieur: { gens: [[-4.3, -0.32, 3.55, -1.82], [-4.15, -0.32, 4.35, -1.42], [-4.75, -0.32, 2.95, -2.07], [-4.55, -0.32, 5.1, -1.3], [-4.95, -0.32, 2.2, -2.3], [-4.45, -0.32, 5.8, -1.2], [-5.2, -0.32, 4.6, -1.6], [-5.3, -0.32, 3.4, -1.9]],
    betes: [[-5.0, -0.32, 4.15, 2.27], [-4.95, -0.32, 3.15, 1.9], [-4.9, -0.32, 2.0, 2.0], [-4.8, -0.32, 5.35, 2.5], [-4.65, -0.32, 6.25, 2.6], [-4.7, -0.32, 1.2, 1.8]] },
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
    scene.add(obj); instances.set(m.id, { avatar: m.avatar, obj, mixer });
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
  zone9.visible = nom === 'etage';
  placerFamille();
}
// terre au pied de l'arbre, visible seulement une fois l'arbre planté
const terre = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshStandardMaterial({ color: '#6b4b33', roughness: 1 }));
terre.rotation.x = -Math.PI / 2; terre.position.set(-5.6, -0.295, 0.9); terre.receiveShadow = true; terre.visible = false; scene.add(terre);
// recentre un arbre pour que son tronc (le bas du modèle) tombe au milieu de la terre
function centrerTronc(racine) {
  racine.updateMatrixWorld(true);
  let ymin = Infinity; const v = new THREE.Vector3(); const pts = [];
  racine.traverse((m) => { if (!m.isMesh) return; const pos = m.geometry.attributes.position; const pas = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += pas) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); pts.push(v.x, v.y, v.z); if (v.y < ymin) ymin = v.y; } });
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] < ymin + 0.35) { sx += pts[i]; sz += pts[i + 2]; n++; }
  if (n) { racine.position.x += terre.position.x - sx / n; racine.position.z += terre.position.z - sz / n; }
}
async function planter(id) {
  terre.visible = !!id;
  if (!id) { for (const a of Object.values(arbres)) if (a.scene) a.scene.visible = false; return; }
  if (!arbres[id]) arbres[id] = charger('arbres/' + id).then((g) => { centrerTronc(g.scene); scene.add(g.scene); arbres[id] = g; return g; });
  const g = await arbres[id];
  for (const [k, a] of Object.entries(arbres)) if (a.scene) a.scene.visible = k === id && etat.arbre === id;
}

// ---------- ce que le joueur choisit ----------
let numero = 0; const membre = (prenom, age, type, avatar) => ({ id: 'm' + (++numero), prenom, age, type, avatar, habitudes: [] });
const etat = { valeur: null, arbre: null, membres: [membre('Léa', 36, 'adulte', 'f07'), membre('Thomas', 38, 'adulte', 'm04'), membre('Lou', 8, 'enfant', 'garcon1'), membre('Biscotte', '', 'animal', 'chien')], membre: 'm1', salon: [], piece: null, chambres: 3, aventure: null, prenom: '', contact: '', accord: false, envoye: false };

const ARBRES = [
  { id: 'pommier', nom: 'Pommier', le: 'le pommier', couleur: '#d6382f', titre: "Le pommier · l'abondance", texte: "Ce que l'on cultive et que l'on transmet. L'arbre des vergers alsaciens." },
  { id: 'cerisier', nom: 'Cerisier', le: 'le cerisier', couleur: '#f4b6c8', titre: 'Le cerisier · les moments heureux', texte: "Le renouveau, une floraison qu'on attend chaque printemps." },
  { id: 'lilas', nom: 'Lilas', le: 'le lilas', couleur: '#b48ad6', titre: 'Le lilas · la tendresse', texte: "L'amitié et l'accueil. Un arbuste qui parfume le jardin en mai." },
  { id: 'noisetier', nom: 'Noisetier', le: 'le noisetier', couleur: '#a8743f', titre: 'Le noisetier · la sagesse', texte: "La patience et l'ancrage. Un arbuste généreux, des noisettes à l'automne." },
];
const VALEURS = [['transmettre', 'Transmettre', 'pommier'], ['retrouver', 'Se retrouver', 'cerisier'], ['recevoir', 'Recevoir', 'lilas'], ['ressourcer', 'Se ressourcer', 'noisetier']];
let CATALOGUE = { adulte: [], senior: [], enfant: [], animal: ['chien', 'chat'] };
const TYPES = [['adulte', 'Adulte'], ['enfant', 'Enfant'], ['senior', 'Senior'], ['animal', 'Animal']];
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
const prenoms = () => { const l = etat.membres.filter((m) => m.type !== 'animal').map((m) => m.prenom || 'Sans prénom'); return l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : (l[0] || 'votre famille'); };
const HABITUDES = [['teletravail', 'Télétravail', 'besoin d’un bureau'], ['cuisine', 'Cuisiner', 'cuisine ouverte'], ['sport', 'Sport', 'du rangement'], ['jardin', 'Jardiner', 'un potager'], ['jeux', 'Jouer', 'un coin à soi'], ['amis', 'Recevoir', 'une chambre d’amis']];
const HABITUDES_CHIEN = [['balade', 'Balades', 'accès jardin'], ['dodo', 'Sieste', 'un panier au calme']];
const SALON = [['famille', 'Se poser en famille', 'canapé, plaid, série'], ['amis', 'Recevoir les amis', 'apéro et grandes tablées'], ['enfants', 'Jouer avec les enfants', 'tapis, jeux, cabanes'], ['lire', 'Lire au calme', 'un fauteuil, une lampe']];
const PIECE = [['bureau', 'Bureau', 'pour télétravailler'], ['amis', "Chambre d'amis", 'pour recevoir'], ['jeux', 'Salle de jeux', 'pour Lou'], ['sport', 'Salle de sport', 'pour bouger'], ['bebe', 'Chambre de bébé', 'pour la suite']];
const AVENTURES = [
  ['noel', 'La bombe de Noël', 'Une boule éclate et toute la maison s’habille de lumières et de neige.', 'De saison', '#ee3f81'],
  ['fete', 'La crémaillère', 'Guirlandes, platines et grande tablée : les voisins débarquent.', 'Avec les voisins', '#f68f7c'],
  ['bebe', 'La famille s’agrandit', 'Une cigogne arrive : la pièce de 9 m² devient la chambre de bébé.', 'Une maison qui évolue', '#7bae8a'],
];
const libelle = (liste, id) => (liste.find((x) => x[0] === id) || [, '—'])[1];

// ---------- écrans ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));
const CORBEILLE = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
const puceHtml = (p) => p.suppr
  ? `<span class="puce-membre"><button type="button" class="puce" data-id="${p.id}" aria-pressed="${p.on}">${esc(p.l)}</button><button type="button" class="corbeille" data-suppr="${p.id}" aria-label="Retirer ${esc(p.l)} de la famille">${CORBEILLE}</button></span>`
  : `<button type="button" class="puce" data-id="${p.id}" aria-pressed="${p.on}">${esc(p.l)}</button>`;
const choix = (id, titre, sous, on, classe = '') => `<button type="button" class="choix ${classe}" data-id="${id}" aria-pressed="${!!on}"><b>${esc(titre)}</b>${sous ? `<span>${esc(sous)}</span>` : ''}</button>`;

const ORDRE = ['accueil', 'arbre', 'famille', 'salon', 'etage', 'aventures', 'fiche'];
const ECRANS = {
  arbre: {
    vue: 'exterieur', famille: false, plan: 'arbre', etape: 'Étape 1 sur 4 · Votre arbre', pastille: 'Pousse en Alsace',
    intitule: 'Avant d’entrer, qu’est-ce qui compte le plus pour vous ?',
    puces: () => VALEURS.map(([id, l]) => ({ id, l, on: etat.valeur === id })),
    puce: (id) => { etat.valeur = id; choisirArbre(VALEURS.find((v) => v[0] === id)[2]); },
    contenu: () => { const a = ARBRES.find((x) => x.id === etat.arbre);
      return `<div class="grille quatre">${ARBRES.map((x) => `<button type="button" class="choix arbre" data-id="${x.id}" aria-pressed="${etat.arbre === x.id}"><i style="background:${x.couleur}"></i><b>${x.nom}</b></button>`).join('')}</div>`
        + (a ? `<div class="encart"><p class="titre-panneau">${a.titre}</p><p class="sous">${a.texte}</p></div>` : `<p class="sous">Choisissez l'arbre que vous planterez dans votre jardin.</p>`); },
    clic: (id) => choisirArbre(id),
    suite: () => etat.arbre ? 'Planter ' + ARBRES.find((x) => x.id === etat.arbre).le : 'Choisissez un arbre', pret: () => !!etat.arbre,
  },
  famille: {
    vue: 'exterieur', plan: 'famille', etape: 'Étape 2 sur 4 · Votre famille',
    intitule: () => `Votre ${ARBRES.find((x) => x.id === etat.arbre)?.nom.toLowerCase() || 'arbre'} est planté. Qui vit dans la maison ?`,
    puces: () => etat.membres.map((m) => ({ id: m.id, l: m.prenom || (m.type === 'animal' ? nomAnimal[m.avatar] : 'Sans prénom'), on: etat.membre === m.id, suppr: etat.membres.length > 1 }))
      .concat(etat.membres.length < MAX_MEMBRES ? [{ id: 'ajouter', l: '+ Ajouter', on: false }] : []),
    puce: (id) => {
      if (id !== 'ajouter') { etat.membre = id; return; }
      const pris = new Set(etat.membres.map((m) => m.avatar)); const av = CATALOGUE.adulte.find((x) => !pris.has(x)) || CATALOGUE.adulte[0];
      const m = membre('', '', 'adulte', av); etat.membres.push(m); etat.membre = m.id; synchroniserFamille();
    },
    contenu: () => {
      const m = membreActif(); const animal = m.type === 'animal';
      const liste = CATALOGUE[m.type] || [];
      return `<div class="champs"><div class="champ"><label for="prenom-m">Prénom</label><input id="prenom-m" autocomplete="off" maxlength="20" placeholder="${animal ? 'Son nom' : 'Son prénom'}" value="${esc(m.prenom)}"></div>`
        + (animal ? '' : `<div class="champ age"><label for="age-m">Âge</label><input id="age-m" type="number" inputmode="numeric" min="0" max="110" value="${esc(m.age)}"></div>`) + `</div>`
        + `<div class="onglets">${TYPES.map(([t, l]) => `<button type="button" class="puce" data-type="${t}" aria-pressed="${m.type === t}">${l}</button>`).join('')}</div>`
        + `<div class="portraits">${liste.map((x) => animal
            ? `<button type="button" class="choix animal" data-avatar="${x}" aria-pressed="${m.avatar === x}"><b>${nomAnimal[x]}</b></button>`
            : `<button type="button" class="portrait" data-avatar="${x}" aria-pressed="${m.avatar === x}" aria-label="Personnage ${x}"><img src="assets/avatars/${x}.webp" alt="" width="64" height="64" loading="lazy"></button>`).join('')}</div>`
        + (animal ? '' : `<details class="habitudes" ${etat.habitudesOuvert ? 'open' : ''}><summary>Ses habitudes à la maison${m.habitudes.length ? ' · ' + m.habitudes.length : ''}</summary><div class="grille">${HABITUDES.map(([id, l, sous]) => choix(id, l, sous, m.habitudes.includes(id))).join('')}</div></details>`)
;
    },
    clic: (id, el) => {
      const m = membreActif();
      if (el.dataset.type) { const t = el.dataset.type; if (t !== m.type) { m.type = t; m.avatar = CATALOGUE[t][0]; if (t === 'animal') m.age = ''; synchroniserFamille(); } return; }
      if (el.dataset.avatar) { m.avatar = el.dataset.avatar; synchroniserFamille(); return; }
      if (el.dataset.action === 'retirer') { etat.membres = etat.membres.filter((x) => x.id !== m.id); etat.membre = etat.membres[0].id; synchroniserFamille(); return; }
      const i = m.habitudes.indexOf(id); if (i >= 0) m.habitudes.splice(i, 1); else m.habitudes.push(id);
    },
    suite: () => 'Entrer dans la maison', pret: () => etat.membres.some((m) => m.type !== 'animal'),
  },
  salon: {
    vue: 'coupe', plan: 'salon', etape: 'Étape 3 sur 4 · Le salon', bulle: { p: [1.5, 1.4, 4.3], t: 'Le salon' },
    intitule: 'Le soir, chez vous, ça ressemble à quoi ?',
    contenu: () => `<p class="titre-panneau">Ce salon, c'est surtout pour… <span class="sous">plusieurs choix</span></p><div class="grille">${SALON.map(([id, l, s]) => choix(id, l, s, etat.salon.includes(id))).join('')}</div>`,
    clic: (id) => { const i = etat.salon.indexOf(id); if (i >= 0) etat.salon.splice(i, 1); else etat.salon.push(id); },
    suite: () => 'Monter à l’étage', pret: () => true,
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
      + (etat.aventure ? `<p class="message">Les aventures animées arrivent dans la prochaine version. Votre choix est noté.</p>` : `<p class="sous">Environ 2 minutes par aventure.</p>`),
    clic: (id) => { etat.aventure = id; },
    suite: () => 'Voir ma maison', pret: () => !!etat.aventure,
  },
  fiche: {
    vue: 'exterieur', plan: 'fiche', etape: 'Partie terminée', pastille: '4 sur 4',
    intitule: 'Bravo ! Votre Clever’hom est prête.',
    contenu: () => {
      const lignes = [['Votre arbre', (ARBRES.find((x) => x.id === etat.arbre)?.nom || '—') + (etat.valeur ? ' · ' + libelle(VALEURS, etat.valeur).toLowerCase() : '')], ['La famille', composition()],
        ['Le salon', etat.salon.map((s) => libelle(SALON, s)).join(', ') || '—'], ['La pièce de 9 m²', libelle(PIECE, etat.piece)], ['Chambres souhaitées', etat.chambres]];
      return `<div>${lignes.map(([a, b]) => `<div class="ligne-recap"><span>${a}</span><b>${esc(b)}</b></div>`).join('')}</div>`
        + (etat.envoye ? `<p class="message">C'est noté ! Dans cette version de démonstration, la fiche n'est pas encore transmise au conseiller.</p>` :
        `<div class="champs"><div class="champ"><label for="prenom">Prénom</label><input id="prenom" autocomplete="given-name" value="${esc(etat.prenom)}"></div><div class="champ"><label for="contact">Téléphone ou e-mail</label><input id="contact" autocomplete="tel" value="${esc(etat.contact)}"></div></div>
        <label class="consentement"><input type="checkbox" id="accord" ${etat.accord ? 'checked' : ''}><span>J'accepte qu'un conseiller Clever'hom me recontacte au sujet de ma future maison.</span></label>`);
    },
    suite: () => etat.envoye ? 'Recommencer' : 'Envoyer au conseiller', pret: () => etat.envoye || (etat.accord && etat.contact.trim().length >= 6),
  },
};

let ecran = 'accueil';
function aller(nom) {
  ecran = nom; document.body.dataset.ecran = nom;
  const e = ECRANS[nom];
  $('question').hidden = $('panneau').hidden = !e; $('bulle').hidden = true;
  if (!e) { montrer('exterieur'); planter(etat.arbre); viser('accueil'); controls.autoRotate = true; return; }
  controls.autoRotate = false;
  montrer(e.vue, e.famille !== false); viser(e.plan);
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
$('contenu').addEventListener('input', (ev) => {
  if (ev.target.id === 'prenom') etat.prenom = ev.target.value;
  if (ev.target.id === 'contact') etat.contact = ev.target.value;
  if (ev.target.id === 'accord') etat.accord = ev.target.checked;
  if (ev.target.id === 'prenom-m' || ev.target.id === 'age-m') { const m = membreActif(); if (ev.target.id === 'prenom-m') m.prenom = ev.target.value.trim() ? ev.target.value : ''; else m.age = ev.target.value;
    const e = ECRANS[ecran]; $('puces').innerHTML = e.puces().map(puceHtml).join('');
 }
  $('suite').disabled = !ECRANS[ecran].pret();
});
$('contenu').addEventListener('toggle', (ev) => { if (ev.target.matches('details.habitudes')) etat.habitudesOuvert = ev.target.open; }, true);
$('suite').addEventListener('click', () => {
  if (ecran === 'fiche') { if (etat.envoye) { location.reload(); return; } etat.envoye = true; dessiner(); return; }
  aller(ORDRE[ORDRE.indexOf(ecran) + 1]);
});
$('retour').addEventListener('click', () => aller(ORDRE[Math.max(0, ORDRE.indexOf(ecran) - 1)]));
$('jouer').addEventListener('click', () => aller('arbre'));

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
  montrer(vue, ECRANS[ecran]?.famille !== false);
  planter(null); arbres.pommier = charger('arbres/pommier').then((g) => { centrerTronc(g.scene); g.scene.visible = etat.arbre === 'pommier'; scene.add(g.scene); arbres.pommier = g; return g; });
  mesures.complet = (performance.now() - DEBUT) / 1000; mesures.tout = total;
}

// ---------- boucle ----------
const panneauMesures = $('mesures'); if (QS.has('mesures')) panneauMesures.hidden = false;
let images = 0, t0 = performance.now();
const horloge = new THREE.Clock(); const tmp = new THREE.Vector3();
function image(dt) {
  for (const mx of mixers) mx.update(dt);
  avancerTrajet(dt); controls.update(); renderer.render(scene, camera);
  const b = ECRANS[ecran]?.bulle; const bulle = $('bulle');
  if (b && !trajet) { tmp.set(...b.p).project(camera); bulle.hidden = tmp.z > 1; bulle.textContent = b.t; bulle.style.left = ((tmp.x + 1) / 2) * innerWidth + 'px'; bulle.style.top = ((1 - tmp.y) / 2) * innerHeight + 'px'; }
  else bulle.hidden = true;
}
window.__image = (dt = 0.1) => { if (trajet) trajet.t = 1; avancerTrajet(0); image(dt); };
window.__aller = (n) => { aller(n); if (trajet) { trajet.t = 1; avancerTrajet(0); } };
window.__famille = () => [...instances.entries()].map(([id, it]) => [id, it.avatar, it.obj.visible, it.obj.position.toArray().map((v) => +v.toFixed(2)), new THREE.Box3().setFromObject(it.obj).getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))]);
window.__etat = () => ({ pret: !!mesures.pret, complet: !!mesures.complet, mesures, triangles: renderer.info.render.triangles, etat });
window.__choisir = (cle, val) => { etat[cle] = val; if (cle === 'arbre') return planter(val).then(dessiner); dessiner(); };
if (!QS.has('capture')) renderer.setAnimationLoop(() => {
  image(Math.min(horloge.getDelta(), 0.1));
  images++; const t = performance.now();
  if (t - t0 > 1000) { const ips = (images * 1000) / (t - t0); images = 0; t0 = t;
    if (!panneauMesures.hidden) panneauMesures.textContent = ['images/s : ' + ips.toFixed(0), 'triangles : ' + renderer.info.render.triangles.toLocaleString('fr-FR'),
      'prêt en : ' + (mesures.pret ? mesures.pret.toFixed(1) + ' s (' + (mesures.premier / 1e6).toFixed(1) + ' Mo)' : '…'),
      'tout en : ' + (mesures.complet ? mesures.complet.toFixed(1) + ' s (' + (mesures.tout / 1e6).toFixed(1) + ' Mo)' : '…')].join('\n'); }
});

demarrer().catch((e) => { const t = $('texte'); t.textContent = 'Le chargement a échoué. Rechargez la page.'; t.classList.remove('visuellement-cache'); console.error(e); });
