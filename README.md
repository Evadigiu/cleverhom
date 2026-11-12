# Ma Maison en Jeu

Mini-jeu web 3D Pomelo × Clever'hom, joué sur téléphone après une porte ouverte (accès par QR code).

Le joueur plante son arbre, fait entrer sa famille, découvre la Clever'hom, vit une aventure
(la bombe de Noël, la crémaillère, la famille qui s'agrandit), puis peut envoyer son projet
de maison à un conseiller, avec son consentement.

## État

Parcours jouable en 3D : accueil, choix de l'arbre (pommier, cerisier, lilas, noisetier, plantés dans le jardin),
famille composée librement (prénoms, âges, adultes, enfants, seniors, chien ou chat, choix parmi 24 personnages), salon en vue en coupe, « Qui dort où ? » à l'étage avec la pièce de 9 m², choix de l'aventure,
puis la fiche pour le conseiller avec consentement.

Pas encore fait : les aventures animées, et l'envoi réel de la fiche (rien n'est transmis pour l'instant).

Ajouter `?mesures=1` à l'adresse pour afficher le nombre d'images par seconde et les temps de chargement.

## Contenu

- `index.html`, `style.css`, `app.js` : la page du jeu (three.js chargé depuis jsDelivr).
- `assets/models/` : la maison (extérieur, coupe du rez-de-chaussée, coupe de l'étage), le jardin, le mobilier, les quatre arbres et les trois personnages animés, compressés (meshopt, textures WebP).
- `assets/avatars/` : les personnages au choix (Microsoft Rocketbox), leur portrait et `catalogue.json` (qui apparaît dans quel onglet).
- `assets/animaux/` : le chien et le chat.
- `credits.html`, `assets/credits.json` : les crédits des modèles 3D.

Premier chargement : environ 5 Mo (maison, jardin, famille). Le reste (intérieur, étage, arbres) se charge ensuite en arrière-plan.

## Crédits

Les modèles 3D proviennent de Sketchfab (licence CC-BY, auteurs listés dans la page de crédits du jeu),
de Poly Haven (CC0) et de Microsoft Rocketbox (MIT).
