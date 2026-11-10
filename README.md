# Ma Maison en Jeu

Mini-jeu web 3D Pomelo × Clever'hom, joué sur téléphone après une porte ouverte (accès par QR code).

Le joueur plante son arbre, fait entrer sa famille, découvre la Clever'hom, vit une aventure
(la bombe de Noël, la crémaillère, la famille qui s'agrandit), puis peut envoyer son projet
de maison à un conseiller, avec son consentement.

## État

Prototype : la maison 3D allégée, qu'on fait tourner du doigt et qu'on ouvre en vue en coupe.
Ajouter `?mesures=1` à l'adresse pour afficher le nombre d'images par seconde et les temps de chargement.

## Contenu

- `index.html`, `style.css`, `app.js` : la page du jeu (three.js chargé depuis jsDelivr).
- `assets/models/` : la maison (extérieur, coupe), le jardin, l'intérieur et les trois personnages animés, compressés (meshopt, textures WebP).
- `assets/placements.json` : la position de la famille dans chaque vue.
- `credits.html`, `assets/credits.json` : les crédits des modèles 3D.

Premier chargement : environ 7 Mo (maison, jardin, famille). L'intérieur (9 Mo) se charge ensuite en arrière-plan.

## Crédits

Les modèles 3D proviennent de Sketchfab (licence CC-BY, auteurs listés dans la page de crédits du jeu),
de Poly Haven (CC0) et de Microsoft Rocketbox (MIT).
