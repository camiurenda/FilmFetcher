const WhatsAppService = require('../services/whatsapp.service');
const ChatbotService = require('../services/chatbot.service');

const verificarWebhook = (req, res) => {
  const verifyToken = "MiSecreto123";  // Asegúrate de que esto coincida con lo que configuraste en el panel de WhatsApp
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Solicitud de verificación recibida:", { mode, token, challenge });

  if (mode && token && challenge) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Verificación de Webhook exitosa, respondiendo con challenge:", challenge);
      return res.status(200).send(challenge);
    } else {
      console.log("Verificación fallida: token no coincide");
      return res.sendStatus(403);
    }
  }

  console.log("Verificación fallida: parámetros incompletos");
  return res.sendStatus(400);
};

const handleWebhook = (req, res) => {
  // Respondemos inmediatamente para evitar timeouts
  res.sendStatus(200);

  // Procesamos el mensaje de forma asíncrona
  processIncomingMessage(req.body).catch(console.error);
};

async function processIncomingMessage(body) {
  if (body.object === 'whatsapp_business_account') {
    if (body.entry && 
        body.entry[0].changes && 
        body.entry[0].changes[0].value.messages && 
        body.entry[0].changes[0].value.messages[0]) {

      const phoneNumber = body.entry[0].changes[0].value.messages[0].from;
      const message = body.entry[0].changes[0].value.messages[0].text.body;

      console.log('Mensaje recibido:', message);

      try {
        const respuesta = await ChatbotService.procesarMensaje(message);
        await WhatsAppService.sendMessage(phoneNumber, respuesta);
        console.log('Respuesta enviada:', respuesta);
      } catch (error) {
        console.error('Error al procesar o enviar mensaje:', error);
        // Intenta enviar un mensaje de error al usuario
        try {
          await WhatsAppService.sendMessage(phoneNumber, "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.");
        } catch (sendError) {
          console.error('Error al enviar mensaje de error:', sendError);
        }
      }
    }
  }
}

module.exports = {
  verificarWebhook,
  handleWebhook
};