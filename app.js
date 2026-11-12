// Ma Maison en Jeu : le parcours du joueur dans la Clever'hom, en 3D sur téléphone.
// Accueil → arbre → famille → salon → qui dort où → aventure → fiche pour le conseiller.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  famille: { pos: [-10.3, 3.8, 3.65], cible: [-4.4, 0.0, 3.6], fov: 46 },
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
const coques = {}; const decor = {}; const personnages = {}; const mixers = []; const arbres = {};
let placements = null;
const pret = { interieur: null };

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
function montrer(nom, familleVisible = true) {
  vue = nom; const v = VUES[nom];
  for (const [k, o] of Object.entries(coques)) o.visible = k === v.coque;
  if (decor.interieur) decor.interieur.visible = v.interieur;
  if (decor.etage) decor.etage.visible = v.etage;
  zone9.visible = nom === 'etage';
  for (const [qui, obj] of Object.entries(personnages)) {
    const p = placements[v.famille]?.[qui]; obj.visible = familleVisible && !!p;
    if (p) { obj.position.set(...p.p); obj.rotation.y = p.r; }
  }
}
async function planter(id) {
  if (!id) { for (const a of Object.values(arbres)) if (a.scene) a.scene.visible = false; return; }
  if (!arbres[id]) arbres[id] = charger('arbres/' + id).then((g) => { scene.add(g.scene); arbres[id] = g; return g; });
  const g = await arbres[id];
  for (const [k, a] of Object.entries(arbres)) if (a.scene) a.scene.visible = k === id && etat.arbre === id;
}

// ---------- ce que le joueur choisit ----------
const etat = { valeur: null, arbre: null, habitudes: { lea: [], thomas: [], lou: [], biscotte: [] }, membre: 'lea', salon: [], piece: null, chambres: 3, aventure: null, prenom: '', contact: '', accord: false, envoye: false };

const ARBRES = [
  { id: 'pommier', nom: 'Pommier', le: 'le pommier', couleur: '#d6382f', titre: "Le pommier · l'abondance", texte: "Ce que l'on cultive et que l'on transmet. L'arbre des vergers alsaciens." },
  { id: 'cerisier', nom: 'Cerisier', le: 'le cerisier', couleur: '#f4b6c8', titre: 'Le cerisier · les moments heureux', texte: "Le renouveau, une floraison qu'on attend chaque printemps." },
  { id: 'lilas', nom: 'Lilas', le: 'le lilas', couleur: '#b48ad6', titre: 'Le lilas · la tendresse', texte: "L'amitié et l'accueil. Un arbuste qui parfume le jardin en mai." },
  { id: 'noisetier', nom: 'Noisetier', le: 'le noisetier', couleur: '#a8743f', titre: 'Le noisetier · la sagesse', texte: "La patience et l'ancrage. Un arbuste généreux, des noisettes à l'automne." },
];
const VALEURS = [['transmettre', 'Transmettre', 'pommier'], ['retrouver', 'Se retrouver', 'cerisier'], ['recevoir', 'Recevoir', 'lilas'], ['ressourcer', 'Se ressourcer', 'noisetier']];
const MEMBRES = [['lea', 'Léa', '36 ans'], ['thomas', 'Thomas', '38 ans'], ['lou', 'Lou', '8 ans'], ['biscotte', 'Biscotte', 'le chien']];
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
    intitule: () => `Votre ${ARBRES.find((x) => x.id === etat.arbre)?.nom.toLowerCase() || 'arbre'} est planté. Faites entrer votre famille.`,
    puces: () => MEMBRES.map(([id, l]) => ({ id, l, on: etat.membre === id })),
    puce: (id) => { etat.membre = id; },
    contenu: () => { const m = MEMBRES.find((x) => x[0] === etat.membre); const liste = etat.membre === 'biscotte' ? HABITUDES_CHIEN : HABITUDES;
      return `<p class="titre-panneau">${m[1]} <span class="sous">${m[2]}</span></p><p class="sous">Ses habitudes à la maison :</p><div class="grille">${liste.map(([id, l, s]) => choix(id, l, s, etat.habitudes[etat.membre].includes(id))).join('')}</div>`; },
    clic: (id) => { const h = etat.habitudes[etat.membre]; const i = h.indexOf(id); if (i >= 0) h.splice(i, 1); else h.push(id); },
    suite: () => 'Entrer dans la maison', pret: () => true,
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
    intitule: 'Parents, Lou… et une pièce de 9 m² à imaginer.',
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
      const fam = 'Léa, Thomas, Lou et Biscotte';
      const lignes = [['Votre arbre', (ARBRES.find((x) => x.id === etat.arbre)?.nom || '—') + (etat.valeur ? ' · ' + libelle(VALEURS, etat.valeur).toLowerCase() : '')], ['La famille', fam],
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
  $('puces').innerHTML = e.puces ? e.puces().map((p) => `<button type="button" class="puce" data-id="${p.id}" aria-pressed="${p.on}">${esc(p.l)}</button>`).join('') : '';
  $('contenu').innerHTML = e.contenu();
  $('suite').textContent = e.suite(); $('suite').disabled = !e.pret();
}
async function choisirArbre(id) { etat.arbre = id; dessiner(); await planter(id); }

$('puces').addEventListener('click', (ev) => { const b = ev.target.closest('.puce'); if (!b) return; ECRANS[ecran].puce(b.dataset.id); dessiner(); });
$('contenu').addEventListener('click', (ev) => { const b = ev.target.closest('[data-id]'); if (!b || !ECRANS[ecran].clic) return; ECRANS[ecran].clic(b.dataset.id); dessiner(); });
$('contenu').addEventListener('input', (ev) => {
  if (ev.target.id === 'prenom') etat.prenom = ev.target.value;
  if (ev.target.id === 'contact') etat.contact = ev.target.value;
  if (ev.target.id === 'accord') etat.accord = ev.target.checked;
  $('suite').disabled = !ECRANS[ecran].pret();
});
$('suite').addEventListener('click', () => {
  if (ecran === 'fiche') { if (etat.envoye) { location.reload(); return; } etat.envoye = true; dessiner(); return; }
  aller(ORDRE[ORDRE.indexOf(ecran) + 1]);
});
$('retour').addEventListener('click', () => aller(ORDRE[Math.max(0, ORDRE.indexOf(ecran) - 1)]));
$('jouer').addEventListener('click', () => aller('arbre'));

// ---------- démarrage ----------
const mesures = {};
async function demarrer() {
  placements = await (await fetch('assets/placements.json')).json();
  const ATTENDU = 4.9e6; // maison, jardin et famille
  const [ext, jardin, lea, thomas, lou] = await Promise.all(['maison-exterieur', 'jardin', 'lea', 'thomas', 'lou'].map((n) => charger(n, ATTENDU)));
  coques.exterieur = ext.scene; scene.add(ext.scene, jardin.scene);
  for (const [qui, g] of Object.entries({ lea, thomas, lou })) {
    personnages[qui] = g.scene; scene.add(g.scene);
    if (g.animations[0]) { const mx = new THREE.AnimationMixer(g.scene); mx.clipAction(g.animations[0]).play(); mx.setTime(Math.random() * 2); mixers.push(mx); }
  }
  montrer('exterieur'); viser('accueil', true);
  mesures.pret = (performance.now() - DEBUT) / 1000; mesures.premier = total;
  $('chargement').classList.add('fini'); $('jouer').disabled = false;
  // en arrière-plan : l'intérieur, la coupe, l'étage et le pommier
  const [inte, coupe, et, etage] = await Promise.all(['interieur', 'maison-coupe', 'maison-etage', 'etage'].map((n) => charger(n)));
  decor.interieur = inte.scene; decor.etage = etage.scene; coques.coupe = coupe.scene; coques.etage = et.scene;
  scene.add(inte.scene, etage.scene, coupe.scene, et.scene);
  montrer(vue, ECRANS[ecran]?.famille !== false);
  planter(null); arbres.pommier = charger('arbres/pommier').then((g) => { g.scene.visible = etat.arbre === 'pommier'; scene.add(g.scene); arbres.pommier = g; return g; });
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

demarrer().catch((e) => { $('texte').textContent = 'Le chargement a échoué. Rechargez la page.'; console.error(e); });
