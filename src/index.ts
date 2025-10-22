import express, { Request, Response } from 'express';
import { config } from './config';
import { WhatsAppClient } from './whatsappClient';
import { ChatGPTService } from './chatgptService';

const app = express();
app.use(express.json());

const whatsappClient = new WhatsAppClient();
const chatgptService = new ChatGPTService();

// Webhook verification endpoint (GET)
app.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    console.log('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook endpoint to receive messages (POST)
app.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Check if it's a WhatsApp message
    if (body.object === 'whatsapp_business_account') {
      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;

            // Process messages
            if (value.messages && value.messages.length > 0) {
              for (const message of value.messages) {
                const from = message.from; // Sender's phone number
                const messageId = message.id;
                const messageType = message.type;

                // Only process text messages
                if (messageType === 'text') {
                  const messageText = message.text.body;

                  console.log(`Received message from ${from}: ${messageText}`);

                  // Mark message as read
                  await whatsappClient.markAsRead(messageId);

                  // Get ChatGPT response
                  const chatgptResponse = await chatgptService.getResponse(from, messageText);

                  // Send response back to user
                  await whatsappClient.sendMessage(from, chatgptResponse);
                }
              }
            }

            // Handle message status updates (optional)
            if (value.statuses && value.statuses.length > 0) {
              console.log('Message status update:', value.statuses);
            }
          }
        }
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`WhatsApp ChatGPT Bot is running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
