import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import { SkillBuilders } from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';

// ---------- OpenAI Chat helper ----------
async function chatWithOpenAI(userText, conversation = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment");

  const systemPrompt = `Tu es **Atlas**, l'assistant IA personnel d'une maison connectée.
- Parle en français naturel, clair et concis (2 à 5 phrases).
- Adapte-toi au contexte du foyer (Echo Show 15).
- Si l'utilisateur demande une action domotique, propose une formulation claire à dire à Alexa (ex: "Alexa, allume la lampe du salon.")
- Si la question nécessite des étapes, liste-les brièvement.
- Évite le jargon, sois pratique et agréable.`;

  // Limit conversation history a bit
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversation.slice(-6),
    { role: "user", content: userText }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || "Désolé, je n'ai pas compris.";
  return text;
}

// ---------- Alexa Skill Handlers ----------
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const speakOutput = "Salut, je suis Atlas. Que puis-je faire pour toi ?";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Que puis-je faire pour toi ?")
      .withSimpleCard("Atlas", speakOutput)
      .getResponse();
  }
};

const ChatIntentHandler = {
  canHandle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' && req.intent.name === 'ChatIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.history = sessionAttributes.history || [];

    const utterance = handlerInput.requestEnvelope.request.intent.slots?.utterance?.value
      || handlerInput.requestEnvelope.request.intent.slots?.any?.value
      || handlerInput.requestEnvelope.request.intent.slots?.phrase?.value
      || "";

    // Push user message
    sessionAttributes.history.push({ role: "user", content: utterance });

    let reply;
    try {
      reply = await chatWithOpenAI(utterance, sessionAttributes.history);
      // Push assistant reply
      sessionAttributes.history.push({ role: "assistant", content: reply });
    } catch (e) {
      console.error(e);
      reply = "Désolé, j'ai un souci de connexion pour le moment.";
    }

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(reply)
      .reprompt("Tu veux autre chose ?")
      .withSimpleCard("Atlas", reply)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' && req.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speakOutput = "Tu peux me poser n'importe quelle question, ou me demander un conseil pratique pour la maison.";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Que puis-je faire pour toi ?")
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' &&
      (req.intent.name === 'AMAZON.CancelIntent' || req.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speakOutput = "À plus !";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    return req.type === 'IntentRequest' && req.intent.name === 'AMAZON.FallbackIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes() || {};
    sessionAttributes.history = sessionAttributes.history || [];

    // Take raw transcript if available
    const rawText = handlerInput.requestEnvelope.request.intent?.slots?.utterance?.value || "Peux-tu reformuler ?";
    sessionAttributes.history.push({ role: "user", content: rawText });

    let reply;
    try {
      reply = await chatWithOpenAI(rawText, sessionAttributes.history);
      sessionAttributes.history.push({ role: "assistant", content: reply });
    } catch (e) {
      console.error(e);
      reply = "Désolé, je n'ai pas compris. Peux-tu reformuler ?";
    }

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(reply)
      .reprompt("Tu veux autre chose ?")
      .withSimpleCard("Atlas", reply)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error(`~ Error handled: ${error.stack}`);
    const speakOutput = "Désolé, un problème est survenu. Essaie encore.";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Tu veux réessayer ?")
      .getResponse();
  }
};

// ---------- Build Skill ----------
const skill = SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ChatIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .create();

// ---------- Express App ----------
const app = express();
app.use(express.json({ limit: '2mb' }));

// Mount Alexa endpoint
const adapter = new ExpressAdapter(skill, false, false);
app.post('/alexa', adapter.getRequestHandlers());

// Health check
app.get('/health', (req, res) => res.status(200).send('OK: Atlas up'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Atlas server listening on port ${port}`);
});