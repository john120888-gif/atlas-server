# Atlas — Echo Show 15 ↔ OpenAI (Alexa Skill backend)

Ce projet expose un endpoint HTTPS pour un **skill Alexa privé** nommé **Atlas**.
- Tu dis : **« Alexa, parle à Atlas »**, puis ta question.
- Le serveur envoie la phrase à OpenAI (ChatGPT), récupère la réponse et la renvoie à Alexa.
- L'Echo Show 15 lit et/ou affiche la réponse.

## 1) Déploiement sur ton cloud (Render/Replit/Autre)

### Option Render (exemple rapide)
1. Crée un repo GitHub avec ces fichiers.
2. Sur **render.com** → *New + Web Service* → connecte ton repo.
3. **Build Command** : `npm install`  
   **Start Command** : `npm start`
4. **Environment** → ajoute `OPENAI_API_KEY` (ta clé OpenAI).
5. Déploie → tu obtiens une URL HTTPS publique, ex. `https://atlas-yourname.onrender.com`

### Option Replit
1. Crée un Repl Node.js et colle ces fichiers.
2. Ajoute dans les *Secrets* : `OPENAI_API_KEY`.
3. Lance. Active le "Web server". Copie l’URL HTTPS.

> L’endpoint qui doit être utilisé par Alexa est : `POST https://.../alexa`

## 2) Créer le Skill Alexa « Atlas » (fr-FR)

1. Va sur **developer.amazon.com** → *Alexa* → *Create Skill*.
2. Nom du Skill : **Atlas**. Catégorie : **Custom**.
3. Langue : **fr-FR**. Modèle : **Custom**.
4. **Interaction Model** → ajoute un **Intent** `ChatIntent` avec un **slot** `utterance` de type `AMAZON.SearchQuery`.
   - Exemple d'**utterances** :
     - `parle avec {utterance}`
     - `discuter {utterance}`
     - `{utterance}`
     - `question {utterance}`
5. **Save Model** puis **Build Model**.
6. **Endpoint** → HTTPS -> colle ton URL `https://.../alexa`
   - Certificate Type: *My development endpoint has a certificate from a trusted CA*.
7. **Test** → Active *Skill testing is enabled in Development*.
8. Sur ton **Echo Show 15**, dis : **« Alexa, parle à Atlas »** — puis ta question.

## 3) Variables d'environnement
Créer `OPENAI_API_KEY` dans ton cloud (Render/Replit/etc.).  
Tu peux te baser sur `.env.example` en local.

## 4) Personnalisation
- Le prompt système dans `index.js` définit le style d'**Atlas** (clair, concis, maison connectée).
- Tu peux persister `sessionAttributes.history` dans une base si tu veux une mémoire longue.
- Tu peux ajouter des actions domotiques en détectant des phrases et en appelant tes APIs locales.

## 5) Santé
- Vérifie `GET /health` pour l'état du serveur.

## 6) Sécurité
- Ce serveur attend des requêtes Alexa au chemin `/alexa`. N'expose pas d'autres routes sensibles.
- Garde ta `OPENAI_API_KEY` secrète (variables d'env).

Bon test !