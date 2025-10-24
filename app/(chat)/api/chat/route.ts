import ollama from "ollama"; // Neu: Ollama importieren
import { geolocation } from "@vercel/functions";
// Entferne AI SDK Imports: convertToModelMessages, createUIMessageStream, JsonToSseTransformStream, smoothStream, stepCountIs, streamText, myProvider
// Entferne TokenLens Imports: ModelCatalog, fetchModels, getUsage
// Entferne Tools Imports: createDocument, getWeather, requestSuggestions, updateDocument
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
// Entferne TokenLens Imports: ModelCatalog, fetchModels, getUsage
import { auth, type UserType } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/visibility-selector";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
// Entferne Tools Imports: createDocument, getWeather, requestSuggestions, updateDocument
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getStreamContext = () => {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
};

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    } else {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];
    const allMessages = [...messagesFromDb, message];

    // DEBUG: Logge was aus der DB kommt
    console.log("=== DATABASE MESSAGES DEBUG ===");
    console.log("Messages from DB:", messagesFromDb.length);
    console.log("Total allMessages:", allMessages.length);
    console.log("===============================");

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Hole den Vornamen des Users aus der Session
    const firstName = session?.user?.firstName || "Student";

    let fullResponse = "";
    let finalMergedUsage: AppUsage | undefined;
    let streamCompleted = false; // Flag für erfolgreichen Stream-Abschluss
    const textEncoder = new TextEncoder();

    const systemPromptText = `
    You are an expert tutor in Machine Learning, Artificial Intelligence, Big Data, and Data Science.
    You have deep technical knowledge and excellent didactic skills, making you highly qualified to guide ${firstName} through complex topics.

    Your role is to help ${firstName} learn actively and think independently — not to provide direct answers.

    ---

    ### Core Rules
    - Always respond in **German**.
    - Begin the **FIRST** message of a chat by greeting ${firstName} (e.g., "Hallo ${firstName}!").
    - Encourage self-directed thinking through **context-based questions** and hints — never through final or direct solutions.
    - Adjust the length of your explanations according to the complexity of the topic 
      (minimum 3 sentences, maximum 10 sentences).
    - After each explanation, ask a **contextual follow-up question** that invites reflection, application, or deeper reasoning.
    - Wait for ${firstName}'s response before continuing.
    - Address ${firstName} naturally in about every second message.
    - Maintain a calm, friendly, and professional tone.

    ---

    ### Text Formatting & Structure
    To ensure readability, follow these exact formatting rules:
    - Write in **clear, separated paragraphs**.
    - Each paragraph should contain **one coherent idea** and be followed by **one blank line**.
    - **Never output continuous text blocks** without paragraph breaks.
    - Use **Markdown formatting** for:
      * lists
      * code (fenced code blocks)
      * math formulas (LaTeX style with $...$ or $$...$$)
    - When listing examples or enumerations, start each with a new line and a dash (-) or number.
    - Start new paragraphs for:
      * new subtopics or explanations,
      * examples,
      * follow-up questions,
      * transitions or reflections.
    
    ---

    ### Teaching Behavior
    When ${firstName} asks a question:
    - Start with a short and clear explanation if necessary.  
    - Then ask an **adaptive follow-up question** based on the same topic.  
    - Offer hints or small examples if ${firstName} struggles.  
    - Only after 2–3 unsuccessful attempts, provide a concise final explanation.

    If ${firstName} shows understanding:
    - Smoothly connect to a related concept, real-world application, or deeper topic.

    ---

    ### FEW-SHOT EXAMPLE (Demonstration of Expected Behavior)

    User: "What is overfitting?"

    Tutor (you):  
    "Hallo ${firstName}, schön, dass du da bist!  

    Overfitting occurs when a model learns the training data too closely — including noise and random fluctuations — instead of the underlying pattern.  
    As a result, it performs extremely well on the training set but much worse on new, unseen data.  

    A typical symptom is that the model’s performance (e.g., accuracy) is very high on training data but significantly lower on validation or test data.  
    This happens because the model memorizes examples rather than generalizing from them.  
    Common causes include too many parameters, too few samples, or insufficient regularization.  

    **Question for you, ${firstName}:**  
    How could you detect overfitting in practice, and what strategies would you consider to reduce it?"

    ---

    User: "Maybe when the training accuracy is much higher than the test accuracy?"

    Tutor:  
    "Exactly right, ${firstName}! That’s one of the clearest signs of overfitting.  

    Typical countermeasures include simplifying the model, applying regularization (like L1 or L2), collecting more data, or using dropout for neural networks.  

    **Question for you, ${firstName}:**  
    If you wanted to automatically test several parameter settings to find the best one for your model, which scikit-learn tool could you use?"

    (End of Few-Shot Example)
    `;
    // SSE-Stream mit Ollama
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // DEBUG: Logge die Messages die an Ollama geschickt werden
          const messagesToSend = [
            { role: "system", content: systemPromptText },
            ...allMessages.map((msg: any) => ({
              role: msg.role,
              content: msg.parts.map((p: any) => p.type === 'text' ? p.text : '').join(''),
            })),
          ];
          
          console.log("=== OLLAMA REQUEST DEBUG ===");
          console.log("Total messages:", messagesToSend.length);
          console.log("Messages:", JSON.stringify(messagesToSend.map(m => ({
            role: m.role,
            content: m.content.substring(0, 100) + '...'
          })), null, 2));
          console.log("============================");

          const ollamaStream = await ollama.chat({
            model: "gpt-oss:20b",
            messages: messagesToSend,
            stream: true,
          });

          for await (const chunk of ollamaStream) {
            const content = chunk.message?.content || '';
            if (content) {
              // Sammle die vollständige Antwort
              fullResponse += content;
              
              // JSON-codiert für sichere Übertragung mit Leerzeichen
              const sseData = `data: ${JSON.stringify({ delta: content })}\n\n`;
              controller.enqueue(textEncoder.encode(sseData));
            }
          }

          // Stream erfolgreich abgeschlossen
          streamCompleted = true;

          // Usage-Daten sammeln
          finalMergedUsage = { 
            inputTokens: 0,
            outputTokens: fullResponse.length,
            completionTokens: fullResponse.length, 
            totalTokens: fullResponse.length, 
            modelId: "llama3.2" 
          } as AppUsage;

          // End-Marker senden
          controller.enqueue(textEncoder.encode(`data: [DONE]\n\n`));
          controller.close();

          // WICHTIG: Synchrones Speichern SOFORT nach Stream-Ende
          // damit die nächste Message den kompletten Chat-Verlauf hat
          if (streamCompleted && fullResponse) {
            try {
              // Speichere die Assistant-Nachricht SOFORT
              await saveMessages({
                messages: [
                  {
                    id: generateUUID(),
                    role: "assistant",
                    parts: [{ type: "text", text: fullResponse }],
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });

              // Speichere Usage-Daten
              if (finalMergedUsage) {
                await updateChatLastContextById({
                  chatId: id,
                  context: finalMergedUsage,
                });
              }

              console.log("Message saved successfully after stream");
            } catch (err) {
              console.error("Error saving message after stream:", err);
            }
          }
        } catch (error) {
          console.error("Ollama streaming error:", error);
          const errorData = `data: ${JSON.stringify({ error: "Stream failed" })}\n\n`;
          controller.enqueue(textEncoder.encode(errorData));
          controller.error(error);
        }
      },
      cancel(reason) {
        // Stream wurde vom Client abgebrochen
        console.log("Stream cancelled by client:", reason);
        streamCompleted = false;
      },
    });

    const streamContext = getStreamContext();

    const responseHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    };

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
        { headers: responseHeaders }
      );
    }

    return new Response(stream, { headers: responseHeaders });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}